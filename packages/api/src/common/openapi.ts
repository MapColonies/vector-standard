import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { OpenAPIV3 } from 'openapi-types';
import { NAMESPACE_PARAM_REF, PUBLIC_PATHS } from './constants';
import type { GatewayBases, OpenapiSpec, PathRewrite } from './interfaces';

const stripNamespaceParam = (pathItem: OpenAPIV3.PathItemObject): OpenAPIV3.PathItemObject => {
  const stripped: OpenAPIV3.PathItemObject = { ...pathItem };

  for (const method of Object.values(OpenAPIV3.HttpMethods)) {
    const operation = stripped[method];

    if (operation?.parameters === undefined) {
      continue;
    }

    stripped[method] = {
      ...operation,
      parameters: operation.parameters.filter((param) => !('$ref' in param) || param.$ref !== NAMESPACE_PARAM_REF),
    };
  }

  return stripped;
};

const SCOPE_REWRITES = {
  namespaced: stripNamespaceParam,
  root: (pathItem, bases): OpenAPIV3.PathItemObject => ({ ...pathItem, servers: [{ url: bases.root }] }),
} satisfies Record<keyof GatewayBases, PathRewrite>;

const loadSpec = (filePath: string): OpenapiSpec => load(readFileSync(filePath, 'utf8')) as OpenapiSpec;

const toPublicSpec = (spec: OpenapiSpec, bases: GatewayBases): OpenapiSpec => {
  const paths = Object.entries(spec.paths).flatMap(([path, pathItem]): [string, OpenAPIV3.PathItemObject][] => {
    const publicPath = PUBLIC_PATHS.get(path);

    if (publicPath === undefined || pathItem === undefined) {
      return [];
    }

    return [[publicPath.path, SCOPE_REWRITES[publicPath.scope](pathItem, bases)]];
  });

  return {
    ...spec,
    servers: [{ url: bases.namespaced, description: 'The API gateway. It rewrites these URLs onto the routes the service serves' }],
    paths: Object.fromEntries(paths),
  };
};

export { loadSpec, toPublicSpec };
