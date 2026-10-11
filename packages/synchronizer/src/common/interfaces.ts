import type { Property } from '@db';
import type { ConfigType } from './config';

export type InsertPropertyDTO = Omit<Property, 'possibleValues' | 'layerRelation'>;

export interface LayerEnums {
  layerName: string;
  enums: string[];
  excludeProperties?: string[];
  sourceKey?: string;
}

export type NamespacesConfig = ReturnType<ConfigType['getAll']>['namespaces'];
export type NamespaceConfig = NamespacesConfig[number];
export type LayerSourceConfig = NamespaceConfig['layerSource'];
export type SharedLuaSourceConfig = Extract<LayerSourceConfig, { type: 'sharedLua' }>;
export type PerLayerJsonSourceConfig = Extract<LayerSourceConfig, { type: 'perLayerJson' }>;
export type EnrichmentConfig = SharedLuaSourceConfig['enrichment'];
