import type { Logger } from '@map-colonies/js-logger';
import { layerSource } from '@db';
import type { LayerEnums, PerLayerJsonSourceConfig } from '@common/interfaces';
import type { FsRepository } from '@common/fs/fsRepository';
import { LayerJsonFetchError, LayerJsonParseError } from '../errors';
import type { FileDownloader, LayerSourceRecord, LayerSourceStrategy } from './types';
import { parseDocument } from './aliasJsonParser';

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
    logger.warn({ msg: `Failed to fetch layer JSON ${key}, skipping layer`, err: new LayerJsonFetchError(layer.layerName, key, err) });
    return undefined;
  }

  try {
    const content = (await fsRepository.readFile(filePath, 'utf-8')).toString();
    const document = parseDocument(content, config);
    return {
      alias: document.alias,
      propertyAliases: document.propertyAliases,
      source: layerSource.perLayerJson,
    };
  } catch (err) {
    logger.warn({ msg: `Failed to read or parse layer JSON ${key}, skipping layer`, err: new LayerJsonParseError(layer.layerName, key, err) });
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
        this.logger.warn({ msg: `No sourceKey configured for perLayerJson layer ${layer.layerName}, skipping` });
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
