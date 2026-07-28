import type { Property } from '@db';
import type { ConfigType } from './config';

export type InsertPropertyDTO = Omit<Property, 'possibleValues' | 'layerRelation'>;

export interface LayerEnums {
  layerName: string;
  enums: string[];
}

export type EnrichmentConfig = ReturnType<ConfigType['getAll']>['enrichment'];
