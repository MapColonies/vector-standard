import type { components } from '../openapi';

export type Layer = Omit<components['schemas']['LayerSpec'], 'properties'>;
export type LayerSpec = components['schemas']['LayerSpec'];
export type LayerSummary = components['schemas']['LayerSummary'];
