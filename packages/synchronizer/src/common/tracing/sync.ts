/* eslint-disable @typescript-eslint/naming-convention */
export const SyncSpanName = {
  SYNC_TICK: 'sync.tick',
  SYNC_LAYER: 'sync.layer',
  SYNC_PROPERTIES: 'sync.properties',
  SYNC_ENUM: 'sync.enum',
  LOAD_LUA_DATA: 'sync.lua.load',
  GET_ENUM_DISTINCT_VALUES: 'sync.dal.enumDistinctValues',
  UPSERT_PROPERTIES: 'sync.dal.upsertProperties',
  FETCH_ALIASES: 'sync.aliases.fetch',
} as const;

export type SyncSpanName = (typeof SyncSpanName)[keyof typeof SyncSpanName];

export const SyncAttributes = {
  LAYER_NAME: 'layer.name',
  LAYER_ID: 'layer.id',
  LAYERS_COUNT: 'layers.count',
  LAYERS_CHANGED: 'layers.changed',
  PROPERTIES_AFFECTED: 'properties.affected',
  ENUMS_AFFECTED: 'enums.affected',
  ALIASES_COUNT: 'aliases.count',
} as const;

export type SyncAttributes = (typeof SyncAttributes)[keyof typeof SyncAttributes];
