import ajvCtor from 'ajv';
import type { Logger } from '@map-colonies/js-logger';
import { layerSource } from '@db';
import type { LayerEnums, PerLayerJsonSourceConfig } from '@common/interfaces';
import { CaseInsensitiveMap } from '@src/common/caseInsensitiveMap';
import type { FsRepository } from '@common/fs/fsRepository';
import { LayerJsonFetchError, LayerJsonParseError } from '../errors';
import type { FileDownloader, LayerSourceRecord, LayerSourceStrategy } from './types';

const ajv = new ajvCtor();
const isRecord = ajv.compile<Record<string, unknown>>({ type: 'object' });
const isString = ajv.compile<string>({ type: 'string' });
const isArray = ajv.compile<unknown[]>({ type: 'array' });

interface ParsedDocument {
  alias: string;
  propertyAliases: Map<string, string>;
}

const isRecordEntry = (value: unknown): value is Record<string, unknown> => isRecord(value);

const buildPropertyAliases = (rawFields: unknown[], config: PerLayerJsonSourceConfig): Map<string, string> =>
  new CaseInsensitiveMap(
    rawFields
      .filter(isRecordEntry)
      .map((field) => ({ fieldName: field[config.fieldNameField], aliasFieldName: field[config.aliasFieldNameField] }))
      .filter((field): field is { fieldName: string; aliasFieldName: string } => isString(field.fieldName) && isString(field.aliasFieldName))
      .map(({ fieldName, aliasFieldName }): [string, string] => [fieldName, aliasFieldName])
  );

const parseDocument = (content: string, config: PerLayerJsonSourceConfig): ParsedDocument => {
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

const resolveOne = async (
  layer: LayerEnums,
  sourceKey: string,
  s3Repository: FileDownloader,
  fsRepository: FsRepository,
  bucket: string,
  config: PerLayerJsonSourceConfig,
  logger: Logger
): Promise<LayerSourceRecord | undefined> => {
  const key = `${config.prefix}${sourceKey}`;

  let filePath: string;
  try {
    filePath = await s3Repository.downloadFile(bucket, key);
  } catch (err) {
    logger.warn({ err: new LayerJsonFetchError(layer.layerName, key, err) }, 'Failed to fetch layer JSON, skipping layer');
    return undefined;
  }

  try {
    const content = (await fsRepository.readFile(filePath, 'utf-8')).toString();
    const document = parseDocument(content, config);
    return {
      layerId: undefined,
      alias: document.alias,
      propertyAliases: document.propertyAliases,
      source: layerSource.perLayerJson,
    };
  } catch (err) {
    logger.warn({ err: new LayerJsonParseError(layer.layerName, key, err) }, 'Failed to read or parse layer JSON, skipping layer');
    return undefined;
  }
};

export class PerLayerJsonSource implements LayerSourceStrategy {
  public constructor(
    private readonly s3Repository: FileDownloader,
    private readonly fsRepository: FsRepository,
    private readonly logger: Logger,
    private readonly bucket: string,
    private readonly config: PerLayerJsonSourceConfig
  ) {}

  public async tick(layers: LayerEnums[]): Promise<Map<string, LayerSourceRecord>> {
    const records = new Map<string, LayerSourceRecord>();
    for (const layer of layers) {
      if (layer.sourceKey === undefined) {
        this.logger.warn({ layerName: layer.layerName }, 'No sourceKey configured for perLayerJson layer, skipping');
        continue;
      }

      const record = await resolveOne(layer, layer.sourceKey, this.s3Repository, this.fsRepository, this.bucket, this.config, this.logger);
      if (record !== undefined) {
        records.set(layer.layerName, record);
      }
    }
    return records;
  }
}
