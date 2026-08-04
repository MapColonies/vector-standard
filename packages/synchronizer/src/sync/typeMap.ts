import type { JsonValue } from 'type-fest';
import { columnType } from '@db';
import type { ColumnType } from '@db';
import { TypeMapError } from './errors';
import { isJsonObject } from './helpers';

const TYPE_MAP_SECTIONS = ['types', 'geometrySubTypes'] as const;

const supportedColumnTypes = new Set<string>(Object.values(columnType));

const parseSection = (source: string, section: string, value: JsonValue | undefined): Map<string, ColumnType> => {
  if (!isJsonObject(value)) {
    throw new TypeMapError(source, `"${section}" must be an object of postgres type name to column type`);
  }

  const result = new Map<string, ColumnType>();
  const invalid: string[] = [];
  for (const [key, columnTypeValue] of Object.entries(value)) {
    if (typeof columnTypeValue !== 'string' || !supportedColumnTypes.has(columnTypeValue)) {
      invalid.push(`${section}.${key} = ${JSON.stringify(columnTypeValue)}`);
      continue;
    }
    result.set(key.trim().toLowerCase(), columnTypeValue as ColumnType);
  }

  if (invalid.length > 0) {
    throw new TypeMapError(
      source,
      `unsupported column types [${invalid.join(', ')}], supported values are [${[...supportedColumnTypes].join(', ')}]`
    );
  }

  return result;
};

export const parseTypeMap = (raw: JsonValue, source: string): TypeMap => {
  if (!isJsonObject(raw)) {
    throw new TypeMapError(source, `expected an object with the sections [${TYPE_MAP_SECTIONS.join(', ')}]`);
  }

  const missing = TYPE_MAP_SECTIONS.filter((section) => !(section in raw));
  if (missing.length > 0) {
    throw new TypeMapError(source, `missing sections [${missing.join(', ')}]`);
  }

  return {
    types: parseSection(source, 'types', raw.types),
    geometrySubTypes: parseSection(source, 'geometrySubTypes', raw.geometrySubTypes),
  };
};

export interface TypeMap {
  types: Map<string, ColumnType>;
  geometrySubTypes: Map<string, ColumnType>;
}
