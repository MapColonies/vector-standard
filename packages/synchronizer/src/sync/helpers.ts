import { columnType } from '@db';
import type { ColumnType } from '@db';
import type { DataSource } from 'typeorm';
import type { InsertPropertyDTO } from '@common/interfaces';
import type { ColumnInfo } from './SyncModel';

const postgresTypeMap = new Map<string, ColumnType>([
  // bigint
  ['bigint', columnType.bigint],
  ['int8', columnType.bigint],
  // real
  ['real', columnType.real],
  ['float4', columnType.real],
  ['float8', columnType.real],
  ['double precision', columnType.real],
  ['numeric', columnType.real],
  ['decimal', columnType.real],
  // boolean
  ['boolean', columnType.boolean],
  ['bool', columnType.boolean],
  // text
  ['text', columnType.text],
  ['character varying', columnType.text],
  ['varchar', columnType.text],
  // timestamp
  ['timestamp with time zone', columnType.timestamp],
  ['timestamp without time zone', columnType.timestamp],
  ['timestamptz', columnType.timestamp],
  ['timestamp', columnType.timestamp],
  // geometry (plain, no sub-type)
  ['geometry', columnType.geom],
]);

const geometrySubTypeMap = new Map<string, ColumnType>([
  ['point', columnType.point],
  ['linestring', columnType.lineString],
  ['polygon', columnType.polygon],
  ['multipoint', columnType.multiPoint],
  ['multilinestring', columnType.multiLineString],
  ['multipolygon', columnType.multiPolygon],
]);

const normalizeUdtName = (udtName: string): ColumnType | undefined => {
  const plain = postgresTypeMap.get(udtName);
  if (plain !== undefined) {
    return plain;
  }

  // Strip length/precision modifier e.g. "character varying(255)" → "character varying"
  const withoutModifier = udtName.replace(/\s*\(\d+(?:,\d+)?\)$/, '');
  if (withoutModifier !== udtName) {
    const stripped = postgresTypeMap.get(withoutModifier);
    if (stripped !== undefined) {
      return stripped;
    }
  }

  const geometryMatch = /^geometry\((\w+)(?:,\d+)?\)$/i.exec(udtName);
  if (geometryMatch) {
    return geometrySubTypeMap.get(geometryMatch[1].toLowerCase()) ?? columnType.geom;
  }

  if (udtName.startsWith('geometry')) {
    return columnType.geom;
  }

  return undefined;
};

export const schemaOf = (dataSource: DataSource): string => {
  const options = dataSource.options;
  return 'schema' in options && typeof options.schema === 'string' ? options.schema : 'public';
};

export const columnInfosToProperties = (
  columnInfos: ColumnInfo[],
  layerName: string,
  onUnknown?: (columnName: string, udtName: string) => void
): InsertPropertyDTO[] => {
  const result: InsertPropertyDTO[] = [];
  for (const { columnName, udtName } of columnInfos) {
    const type = normalizeUdtName(udtName);
    if (type === undefined) {
      onUnknown?.(columnName, udtName);
    } else {
      result.push({ layerName, property: columnName, type });
    }
  }
  return result;
};
