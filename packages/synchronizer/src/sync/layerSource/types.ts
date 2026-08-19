import type { LayerSource } from '@db';
import type { LayerEnums } from '@common/interfaces';

export interface LayerSourceRecord {
  layerId?: number;
  alias: string;
  propertyAliases: Map<string, string>;
  source: LayerSource;
}

export interface LayerSourceStrategy {
  tick: (layers: LayerEnums[]) => Promise<Map<string, LayerSourceRecord>>;
}

export interface FileDownloader {
  downloadFile: (bucket: string, key: string) => Promise<string>;
}
