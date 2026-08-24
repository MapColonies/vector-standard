import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import { schedule, type ScheduledTask } from 'node-cron';
import { context as contextAPI } from '@opentelemetry/api';
import { SERVICES, NAMESPACE_HANDLES } from '@common/constants';
import { ConfigType } from '@common/config';
import { startActivePromisifiedSpan } from '@common/tracing/util';
import { SyncSpanName } from '@common/tracing/sync';
import { FileReader, type FileAliases } from './fileReader';
import type { TypeMap } from './typeMap';
import type { NamespaceHandle } from './namespaceHandle/types';

export const CRON_MANAGER_SYMBOL = Symbol('cronManagerSymbol');

@injectable()
export class CronManager {
  private task: ScheduledTask | undefined;
  private readonly lastLayersChecksum = new Map<string, string>();

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(NAMESPACE_HANDLES) private readonly namespaces: NamespaceHandle[],
    private readonly fileReader: FileReader
  ) {}

  public async tick(): Promise<void> {
    await startActivePromisifiedSpan(SyncSpanName.SYNC_TICK, {}, contextAPI.active(), async () => {
      const typeMap = await this.fileReader.readTypeMap(this.config.get('typeMapFile'));
      const fileAliases = await this.fileReader.readAliases(this.config.get('aliasesFile'));

      for (const namespace of this.namespaces) {
        try {
          await this.tickNamespace(namespace, typeMap, fileAliases);
        } catch (err) {
          this.logger.error({ msg: `Failed to sync namespace ${namespace.name}, skipping`, err });
        }
      }
    });
  }

  public start(): void {
    this.task = schedule(
      this.config.get('schedule'),
      async () => {
        await this.tick();
      },
      { noOverlap: true }
    );
    this.task.on('execution:overlap', () => {
      this.logger.warn('previous sync tick still running, skipping this execution');
    });
  }

  public async stop(): Promise<void> {
    await this.task?.stop();
  }

  private async tickNamespace(namespace: NamespaceHandle, typeMap: TypeMap, fileAliases: FileAliases): Promise<void> {
    if (!namespace.sourceDataSource.isInitialized) {
      try {
        await namespace.sourceDataSource.initialize();
      } catch (err) {
        this.logger.warn({ msg: `Source database unreachable for namespace ${namespace.name}, skipping`, err });
        throw err;
      }
    }

    const { checksum, layers } = await this.fileReader.readLayersWithChecksum(namespace.layersFile);
    const layersChanged = checksum !== this.lastLayersChecksum.get(namespace.name);

    const records = await namespace.layerSource.tick(layers);

    for (const layer of layers) {
      const record = records.get(layer.layerName);
      if (record === undefined) {
        continue;
      }

      await namespace.dal.syncLayer(namespace.name, layer.layerName, record.layerId ?? null, record.source, record.alias);
      try {
        const affected = await namespace.dal.syncProperties(namespace.name, layer, typeMap, fileAliases, record.propertyAliases);
        this.logger.info({ msg: `Synced properties for ${namespace.name}/${layer.layerName}`, affected });
      } catch (err) {
        this.logger.warn({ msg: `Failed to sync properties for ${namespace.name}/${layer.layerName}, skipping to enum sync`, err });
      }
      const enumsAffected = await namespace.dal.syncEnum(namespace.name, layer);
      this.logger.info({ msg: `Synced enums for ${namespace.name}/${layer.layerName}`, enumsAffected });
      if (layersChanged) {
        await namespace.dal.deleteStaleEnumValues(namespace.name, layer.layerName, layer.enums);
      }
    }

    if (layersChanged) {
      await namespace.dal.deleteLayersNotIn(
        namespace.name,
        layers.map((l) => l.layerName)
      );
      this.lastLayersChecksum.set(namespace.name, checksum);
    }
  }
}
