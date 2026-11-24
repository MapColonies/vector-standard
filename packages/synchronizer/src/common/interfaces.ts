import type { Property } from '@db';
import type { ConfigType } from './config';
import type { layerEntrySource } from './constants';

export type InsertPropertyDTO = Omit<Property, 'possibleValues' | 'layerRelation'>;

export interface BaseLayerEnums {
  layerName: string;
  enums: string[];
  excludeProperties?: string[];
  sourceKey?: string;
}

export interface LuaLayerEnums extends BaseLayerEnums {
  source: typeof layerEntrySource.lua;
}

export interface LogicalLayerEnums extends BaseLayerEnums {
  source: typeof layerEntrySource.logical;
  layerId: number;
  alias: string;
}

export type LayerEnums = LuaLayerEnums | LogicalLayerEnums;

export type NamespacesConfig = ReturnType<ConfigType['getAll']>['namespaces'];
export type NamespaceConfig = NamespacesConfig[number];
export type LayerSourceConfig = NamespaceConfig['layerSource'];
export type SharedLuaSourceConfig = Extract<LayerSourceConfig, { type: 'sharedLua' }>;
export type PerLayerJsonSourceConfig = Extract<LayerSourceConfig, { type: 'perLayerJson' }>;
export type EnrichmentConfig = SharedLuaSourceConfig['enrichment'];
