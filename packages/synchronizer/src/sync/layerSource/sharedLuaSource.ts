import type { Logger } from '@map-colonies/js-logger';
import { layerSource } from '@db';
import type { LayerEnums, SharedLuaSourceConfig } from '@common/interfaces';
import type { FsRepository } from '@common/fs/fsRepository';
import { fetchPropertyAliases } from '../aliasEnricher';
import { parseLuaLayers, type LuaLayer } from '../luaParser';
import type { LayerSourceRecord, FileDownloader, LayerSourceStrategy } from './types';

const resolveOne = async (layer: LayerEnums, luaLayer: LuaLayer, config: SharedLuaSourceConfig, logger: Logger): Promise<LayerSourceRecord> => {
  let propertyAliases = new Map<string, string>();
  if (config.enrichment.enabled) {
    try {
      propertyAliases = await fetchPropertyAliases(layer.layerName, luaLayer.layerId, config.enrichment);
    } catch (err) {
      logger.warn({ msg: `Failed to fetch property aliases for ${layer.layerName} (${luaLayer.layerId}), continuing without them`, err });
    }
  }

  return {
    layerId: luaLayer.layerId,
    alias: luaLayer.alias,
    propertyAliases,
    source: layerSource.sharedLua,
  };
};

export class SharedLuaSource implements LayerSourceStrategy {
  public constructor(
    private readonly s3Repository: FileDownloader,
    private readonly fsRepository: FsRepository,
    private readonly logger: Logger,
    private readonly bucket: string,
    private readonly config: SharedLuaSourceConfig
  ) {}

  public async tick(layers: LayerEnums[]): Promise<Map<string, LayerSourceRecord>> {
    this.logger.debug('Loading lua query data');
    const filePath = await this.s3Repository.downloadFile(this.bucket, this.config.fileName);
    const content = (await this.fsRepository.readFile(filePath, 'utf-8')).toString();
    const luaLayers = parseLuaLayers(
      content,
      this.config.layersVariable,
      this.config.idFieldName,
      this.config.nameFieldName,
      this.config.aliasFieldName
    );

    const records = new Map<string, LayerSourceRecord>();
    for (const layer of layers) {
      const luaLayer = luaLayers.get(layer.layerName);
      if (luaLayer === undefined) {
        this.logger.warn({ msg: `Layer ${layer.layerName} not found in lua file, skipping` });
        continue;
      }
      records.set(layer.layerName, await resolveOne(layer, luaLayer, this.config, this.logger));
    }
    return records;
  }
}
