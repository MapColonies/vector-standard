import { createHash } from 'node:crypto';
import { columnType } from '@db';
import type { ColumnType } from '@db';
import type { DataSource } from 'typeorm';
import type { JsonObject, JsonValue } from 'type-fest';
import type { InsertPropertyDTO } from '@common/interfaces';
import type { ColumnInfo } from './SyncModel';
import type { TypeMap } from './typeMap';

const MAX_IDENTIFIER_BYTES = 63;
const IDENTIFIER_HASH_LENGTH = 8;
const IDENTIFIER_SEPARATOR = '_';

const geometryTypePattern = /^geo(?:metry|graphy)\((\w+)(?:,\s*-?\d+)?\)$/;

const normalizeUdtName = (rawUdtName: string, typeMap: TypeMap): ColumnType | undefined => {
  const udtName = rawUdtName.trim().toLowerCase();

  const plain = typeMap.types.get(udtName);
  if (plain !== undefined) {
    return plain;
  }

  const withoutModifier = udtName.replace(/\s*\(\d+(?:,\s*\d+)?\)$/, '');
  if (withoutModifier !== udtName) {
    const stripped = typeMap.types.get(withoutModifier);
    if (stripped !== undefined) {
      return stripped;
    }
  }

  const geometryMatch = geometryTypePattern.exec(udtName);
  if (geometryMatch) {
    return typeMap.geometrySubTypes.get(geometryMatch[1]) ?? columnType.geom;
  }

  if (udtName.startsWith('geometry') || udtName.startsWith('geography')) {
    return columnType.geom;
  }

  return undefined;
};

export const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const excludedPropertySet = (excludeProperties?: string[]): ReadonlySet<string> => {
  return new Set((excludeProperties ?? []).map((property) => property.toLowerCase()));
};

export const schemaOf = (dataSource: DataSource): string => {
  const options = dataSource.options;
  return 'schema' in options && typeof options.schema === 'string' ? options.schema : 'public';
};

export const columnInfosToProperties = (
  columnInfos: ColumnInfo[],
  namespace: string,
  layerName: string,
  typeMap: TypeMap,
  onUnknown?: (columnName: string, udtName: string) => void
): InsertPropertyDTO[] => {
  const result: InsertPropertyDTO[] = [];
  for (const { columnName, udtName } of columnInfos) {
    const type = normalizeUdtName(udtName, typeMap);
    if (type === undefined) {
      onUnknown?.(columnName, udtName);
    } else {
      result.push({ namespace, layerName, property: columnName, type });
    }
  }
  return result;
};

export const toPostgresIdentifier = (name: string): string => {
  if (Buffer.byteLength(name) <= MAX_IDENTIFIER_BYTES) {
    return name;
  }

  const hash = createHash('sha256').update(name).digest('hex').slice(0, IDENTIFIER_HASH_LENGTH);
  const prefixBytes = MAX_IDENTIFIER_BYTES - IDENTIFIER_HASH_LENGTH - IDENTIFIER_SEPARATOR.length;
  let prefix = '';
  for (const char of name) {
    if (Buffer.byteLength(prefix + char) > prefixBytes) {
      break;
    }
    prefix += char;
  }

  return `${prefix}${IDENTIFIER_SEPARATOR}${hash}`;
};
