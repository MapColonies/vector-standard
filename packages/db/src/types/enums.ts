export const columnType = {
  bigint: 'xsd:long',
  real: 'xsd:double',
  boolean: 'xsd:boolean',
  text: 'xsd:string',
  timestamp: 'xsd:dateTime',
  geom: 'gml:GeometryPropertyType',
  point: 'gml:PointPropertyType',
  lineString: 'gml:LineStringPropertyType',
  polygon: 'gml:PolygonPropertyType',
  multiPoint: 'gml:MultiPointPropertyType',
  multiLineString: 'gml:MultiLineStringPropertyType',
  multiPolygon: 'gml:MultiPolygonPropertyType',
} as const;

export type ColumnType = (typeof columnType)[keyof typeof columnType];

export const layerSource = {
  sharedLua: 'sharedLua',
  perLayerJson: 'perLayerJson',
} as const;

export type LayerSource = (typeof layerSource)[keyof typeof layerSource];
