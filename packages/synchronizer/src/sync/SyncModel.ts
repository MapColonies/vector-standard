import { inject, injectable } from 'tsyringe';
import { DataSource, Repository } from 'typeorm';
import { ENUMS_REPOSITORY_SYMBOL, EnumValue, Layer, LAYER_REPOSITORY_SYMBOL, LayerSource, Property, PROPERTY_REPOSITORY_SYMBOL } from '@db';

import { Logger } from '@map-colonies/js-logger';
import { context as contextAPI } from '@opentelemetry/api';
import { startActivePromisifiedSpan } from '@common/tracing/util';
import { SyncAttributes, SyncSpanName } from '@common/tracing/sync';
import { SERVICES, SOURCE_DATA_SOURCE_PROVIDER } from '@common/constants';
import { ConfigType } from '@common/config';
import { InsertPropertyDTO, LayerEnums } from '@src/common/interfaces';
import { CaseInsensitiveMap } from '@src/common/caseInsensitiveMap';
import { columnInfosToProperties, excludedPropertySet, schemaOf } from './helpers';
import {
  EnumDistinctValuesError,
  EnumIndexError,
  EnumSaveError,
  LayerSyncError,
  LayersDeletionError,
  PropertyUpsertError,
  StaleEnumValuesDeletionError,
  StalePropertiesDeletionError,
  TableColumnsQueryError,
} from './errors';
import { resolveFileAliases, type FileAliases } from './fileReader';
import type { TypeMap } from './typeMap';
import type { LayerSourceRecord } from './layerSource/types';

export interface ColumnInfo {
  columnName: string;
  udtName: string;
}

export interface SyncFullLayerContext {
  typeMap: TypeMap;
  fileAliases: FileAliases;
  pruneStale: boolean;
}

@injectable()
export class SyncModel {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SOURCE_DATA_SOURCE_PROVIDER) private readonly sourceDataSource: DataSource,
    @inject(LAYER_REPOSITORY_SYMBOL) private readonly layerRepository: Repository<Layer>,
    @inject(PROPERTY_REPOSITORY_SYMBOL) private readonly propertyRepository: Repository<Property>,
    @inject(ENUMS_REPOSITORY_SYMBOL) private readonly enumsRepository: Repository<EnumValue>
  ) {}

  public async syncFullLayer(namespace: string, layer: LayerEnums, record: LayerSourceRecord, context: SyncFullLayerContext): Promise<void> {
    return startActivePromisifiedSpan(
      SyncSpanName.SYNC_FULL_LAYER,
      { [SyncAttributes.LAYER_NAME]: layer.layerName, [SyncAttributes.NAMESPACE]: namespace },
      contextAPI.active(),
      async () => {
        const { typeMap, fileAliases, pruneStale } = context;

        await this.syncLayer(namespace, layer.layerName, record.layerId ?? null, record.source, record.alias);

        try {
          const affected = await this.syncProperties(namespace, layer, typeMap, fileAliases, record.propertyAliases);
          this.logger.info({ msg: `Synced properties for ${namespace}/${layer.layerName}`, affected });
        } catch (err) {
          this.logger.warn({ msg: `Failed to sync properties for ${namespace}/${layer.layerName}, skipping to enum sync`, err });
        }

        const enumsAffected = await this.syncEnum(namespace, layer);
        this.logger.info({ msg: `Synced enums for ${namespace}/${layer.layerName}`, enumsAffected });

        if (pruneStale) {
          await this.deleteStaleEnumValues(namespace, layer.layerName, layer.enums);
        }
      }
    );
  }

  public async syncLayer(namespace: string, layerName: string, layerId: number | null, source: LayerSource, alias?: string): Promise<void> {
    return startActivePromisifiedSpan(
      SyncSpanName.SYNC_LAYER,
      { [SyncAttributes.LAYER_NAME]: layerName, [SyncAttributes.NAMESPACE]: namespace },
      contextAPI.active(),
      async () => {
        try {
          await this.layerRepository
            .createQueryBuilder()
            .insert()
            .values({ namespace, layerName, layerId, source, alias: alias ?? layerName })
            .orUpdate(['layer_id', 'source', 'alias'], ['namespace', 'layer_name'])
            .execute();
        } catch (err) {
          this.logger.error({ msg: `Failed to sync layer ${namespace}/${layerName}`, err });
          throw new LayerSyncError(layerName, layerId, err);
        }
      }
    );
  }

  public async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const schema = schemaOf(this.sourceDataSource);
    try {
      return await this.sourceDataSource.query<ColumnInfo[]>(
        `SELECT
       a.attname AS "columnName",
       format_type(a.atttypid, a.atttypmod) AS "udtName"
     FROM pg_catalog.pg_attribute a
     JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1
       AND c.relname = $2
       AND a.attnum > 0
       AND NOT a.attisdropped`,
        [schema, tableName]
      );
    } catch (err) {
      this.logger.error({ msg: `Failed to get table columns for ${schema}.${tableName}`, err });
      throw new TableColumnsQueryError(schema, tableName, err);
    }
  }

  public async getEnumDistinctValues({ layerName, enums }: LayerEnums): Promise<Map<string, string[]>> {
    return startActivePromisifiedSpan(
      SyncSpanName.GET_ENUM_DISTINCT_VALUES,
      { [SyncAttributes.LAYER_NAME]: layerName },
      contextAPI.active(),
      async () => {
        if (enums.length === 0) {
          return new Map<string, string[]>();
        }

        const schema = schemaOf(this.sourceDataSource);
        const qualifiedTable = `"${schema}"."${layerName}"`;

        const cteParts = enums.map(
          (col) => `cte_${col} AS (
        SELECT MIN("${col}") AS value FROM ${qualifiedTable}
        UNION ALL
        SELECT (SELECT MIN("${col}") FROM ${qualifiedTable} WHERE "${col}" > cte_${col}.value)
        FROM cte_${col} WHERE cte_${col}.value IS NOT NULL
      )`
        );

        const selectParts = enums.map((col) => `SELECT '${col}' AS "columnName", value::text AS value FROM cte_${col} WHERE value IS NOT NULL`);

        const sql = `WITH RECURSIVE ${cteParts.join(',\n')} ${selectParts.join(' UNION ALL ')}`;

        let rows: { columnName: string; value: string }[];
        try {
          rows = await this.sourceDataSource.query<{ columnName: string; value: string }[]>(sql);
        } catch (err) {
          this.logger.error({ msg: `Failed to get enum distinct values for ${layerName}`, err });
          throw new EnumDistinctValuesError(layerName, err);
        }

        const result = new Map<string, string[]>(enums.map((col) => [col, []]));
        for (const row of rows) {
          result.get(row.columnName)!.push(row.value);
        }
        return result;
      }
    );
  }

  public async upsertProperties(properties: InsertPropertyDTO[]): Promise<number> {
    return startActivePromisifiedSpan(SyncSpanName.UPSERT_PROPERTIES, {}, contextAPI.active(), async (span) => {
      try {
        const result = await this.propertyRepository.upsert(properties, ['namespace', 'layerName', 'property']);
        span.setAttribute(SyncAttributes.PROPERTIES_AFFECTED, result.identifiers.length);
        return result.identifiers.length;
      } catch (err) {
        this.logger.error({ msg: 'Failed to upsert properties', err });
        throw new PropertyUpsertError(err);
      }
    });
  }

  public async syncProperties(
    namespace: string,
    layer: LayerEnums,
    typeMap: TypeMap,
    fileAliases: FileAliases,
    sourceAliases: Map<string, string>
  ): Promise<number> {
    return startActivePromisifiedSpan(
      SyncSpanName.SYNC_PROPERTIES,
      { [SyncAttributes.LAYER_NAME]: layer.layerName, [SyncAttributes.NAMESPACE]: namespace },
      contextAPI.active(),
      async (span) => {
        const excluded = excludedPropertySet(layer.excludeProperties);
        const columns = (await this.getTableColumns(layer.layerName)).filter(({ columnName }) => !excluded.has(columnName.toLowerCase()));
        if (excluded.size > 0) {
          this.logger.debug({ msg: `Excluding properties from sync for ${layer.layerName}`, excludeProperties: layer.excludeProperties });
        }

        const properties = columnInfosToProperties(columns, namespace, layer.layerName, typeMap, (columnName, udtName) => {
          this.logger.warn({ msg: `Unknown column type ${udtName} for ${layer.layerName}.${columnName}, skipping property` });
        });

        const fileLayerAliases = resolveFileAliases(fileAliases, namespace, layer.layerName);
        const aliases = new CaseInsensitiveMap([...sourceAliases, ...fileLayerAliases]);

        for (const property of properties) {
          const alias = aliases.get(property.property);
          if (alias !== undefined) {
            property.alias = alias;
          }
        }

        const withAlias = properties.filter((p) => p.alias !== undefined);
        const withoutAlias = properties.filter((p) => p.alias === undefined);
        let affected = withAlias.length > 0 ? await this.upsertProperties(withAlias) : 0;
        if (withoutAlias.length > 0) {
          affected += await this.upsertProperties(withoutAlias);
        }
        await this.deleteStaleProperties(
          namespace,
          layer.layerName,
          properties.map((p) => p.property)
        );
        span.setAttribute(SyncAttributes.PROPERTIES_AFFECTED, affected);
        return affected;
      }
    );
  }

  public async deleteStaleProperties(namespace: string, layerName: string, currentPropertyNames: string[]): Promise<void> {
    const qb = this.propertyRepository
      .createQueryBuilder()
      .delete()
      .where('"namespace" = :namespace', { namespace })
      .andWhere('"layer_name" = :layerName', { layerName });
    if (currentPropertyNames.length > 0) {
      qb.andWhere('"property" NOT IN (:...properties)', { properties: currentPropertyNames });
    }
    try {
      await qb.execute();
    } catch (err) {
      this.logger.error({ msg: `Failed to delete stale properties for ${namespace}/${layerName}`, err });
      throw new StalePropertiesDeletionError(layerName, err);
    }
  }

  public async deleteLayersNotIn(namespace: string, layerNames: string[]): Promise<void> {
    if (layerNames.length === 0) {
      return;
    }
    try {
      await this.propertyRepository
        .createQueryBuilder()
        .delete()
        .where('"namespace" = :namespace', { namespace })
        .andWhere('"layer_name" NOT IN (:...layerNames)', { layerNames })
        .execute();
      await this.layerRepository
        .createQueryBuilder()
        .delete()
        .where('"namespace" = :namespace', { namespace })
        .andWhere('"layer_name" NOT IN (:...layerNames)', { layerNames })
        .execute();
    } catch (err) {
      this.logger.error({ msg: `Failed to delete layers not in [${layerNames.join(', ')}] for namespace ${namespace}`, err });
      throw new LayersDeletionError(layerNames, err);
    }
  }

  public async ensureEnumIndexes(layer: LayerEnums): Promise<void> {
    if (layer.enums.length === 0) {
      return;
    }

    const schema = schemaOf(this.sourceDataSource);
    try {
      await Promise.all(
        layer.enums.map(async (col) => {
          const format = this.config.get('indexNameFormat');
          const indexName = format.replace('{layerName}', layer.layerName).replace('{column}', col);
          await this.sourceDataSource.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${schema}"."${layer.layerName}" ("${col}")`);
        })
      );
    } catch (err) {
      this.logger.error({ msg: `Failed to ensure enum indexes for ${layer.layerName}`, err });
      throw new EnumIndexError(layer.layerName, err);
    }
  }

  public async deleteStaleEnumValues(namespace: string, layerName: string, currentEnums: string[]): Promise<void> {
    const qb = this.enumsRepository
      .createQueryBuilder()
      .delete()
      .where('"namespace" = :namespace', { namespace })
      .andWhere('"layer_name" = :layerName', { layerName });
    if (currentEnums.length > 0) {
      qb.andWhere('"property" NOT IN (:...properties)', { properties: currentEnums });
    }
    try {
      await qb.execute();
    } catch (err) {
      this.logger.error({ msg: `Failed to delete stale enum values for ${namespace}/${layerName}`, err });
      throw new StaleEnumValuesDeletionError(layerName, err);
    }
  }

  public async existingEnumColumns(layer: LayerEnums): Promise<string[]> {
    if (layer.enums.length === 0) {
      return [];
    }

    const tableColumns = new Set((await this.getTableColumns(layer.layerName)).map((column) => column.columnName));
    const existing = layer.enums.filter((col) => tableColumns.has(col));

    if (existing.length !== layer.enums.length) {
      const missing = layer.enums.filter((col) => !tableColumns.has(col));
      this.logger.warn({ msg: `Enum columns do not exist in table ${layer.layerName}, skipping`, columns: missing });
    }

    return existing;
  }

  public async syncEnum(namespace: string, layer: LayerEnums): Promise<number> {
    return startActivePromisifiedSpan(SyncSpanName.SYNC_ENUM, { [SyncAttributes.LAYER_NAME]: layer.layerName }, contextAPI.active(), async (span) => {
      const existingLayer: LayerEnums = { layerName: layer.layerName, enums: await this.existingEnumColumns(layer) };

      await this.ensureEnumIndexes(existingLayer);
      const enumValuesByColumn = await this.getEnumDistinctValues(existingLayer);

      const entities = [...enumValuesByColumn.entries()].flatMap(([col, values]) =>
        values.map((value) => this.enumsRepository.create({ namespace, layerName: layer.layerName, property: col, value }))
      );

      let affected: number;
      try {
        affected = (await this.enumsRepository.save(entities)).length;
      } catch (err) {
        this.logger.error({ msg: `Failed to save enum values for ${namespace}/${layer.layerName}`, err });
        throw new EnumSaveError(layer.layerName, err);
      }
      span.setAttribute(SyncAttributes.ENUMS_AFFECTED, affected);
      return affected;
    });
  }
}
