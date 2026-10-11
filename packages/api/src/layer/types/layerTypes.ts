import type { LayerSummary } from '@db';

export interface GetLayersParam {
  namespace: string;
}

export interface GetLayerByNameParam {
  namespace: string;
  layerName: string;
}

export interface GetLayersResponse {
  layers: LayerSummary[];
}
