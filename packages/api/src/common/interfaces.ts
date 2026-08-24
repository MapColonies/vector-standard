import type { OpenAPIV3 } from 'openapi-types';

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export type OpenapiSpec = OpenAPIV3.Document;

export interface GatewayBases {
  namespaced: string;
  root: string;
}

export interface PublicPath {
  path: string;
  scope: keyof GatewayBases;
}

export type PathRewrite = (pathItem: OpenAPIV3.PathItemObject, bases: GatewayBases) => OpenAPIV3.PathItemObject;
