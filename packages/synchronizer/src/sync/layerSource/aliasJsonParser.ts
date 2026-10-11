import ajvCtor from 'ajv';
import type { PerLayerJsonSourceConfig } from '@common/interfaces';
import { CaseInsensitiveMap } from '@src/common/caseInsensitiveMap';

const ajv = new ajvCtor();
const isRecord = ajv.compile<Record<string, unknown>>({ type: 'object' });
const isString = ajv.compile<string>({ type: 'string' });
const isArray = ajv.compile<unknown[]>({ type: 'array' });

const isRecordEntry = (value: unknown): value is Record<string, unknown> => isRecord(value);

const buildPropertyAliases = (rawFields: unknown[], config: PerLayerJsonSourceConfig): Map<string, string> =>
  new CaseInsensitiveMap(
    rawFields
      .filter(isRecordEntry)
      .map((field) => ({ fieldName: field[config.fieldNameField], aliasFieldName: field[config.aliasFieldNameField] }))
      .filter((field): field is { fieldName: string; aliasFieldName: string } => isString(field.fieldName) && isString(field.aliasFieldName))
      .map(({ fieldName, aliasFieldName }): [string, string] => [fieldName, aliasFieldName])
  );

export interface ParsedDocument {
  alias: string;
  propertyAliases: Map<string, string>;
}

export const parseDocument = (content: string, config: PerLayerJsonSourceConfig): ParsedDocument => {
  const raw: unknown = JSON.parse(content);
  if (!isRecord(raw)) {
    throw new Error('layer JSON must be an object');
  }

  const alias = raw[config.aliasLayerNameField];
  const fields = raw[config.fieldsField];
  if (!isString(alias) || !isArray(fields)) {
    throw new Error(`layer JSON must have a string "${config.aliasLayerNameField}" and an array "${config.fieldsField}"`);
  }

  return { alias, propertyAliases: buildPropertyAliases(fields, config) };
};
