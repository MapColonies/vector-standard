import type { LayerSummary } from '@db';

export interface GetLayerByNameParam {
  layerName: string;
}

export interface GetLayersResponse {
  layers: LayerSummary[];
}
