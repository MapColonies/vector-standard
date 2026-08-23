import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadSpec, toPublicSpec } from '@src/common/openapi';
import type { OpenapiSpec } from '@src/common/interfaces';

describe('openapi', function () {
  const specPath = resolve('../../openapi3.yaml');
  const bases = { namespaced: 'https://gateway/vector/{namespace}', root: 'https://gateway/vector' };

  const toPublic = (): OpenapiSpec => toPublicSpec(loadSpec(specPath), bases);

  const paramRefs = (spec: OpenapiSpec, route: string): (string | undefined)[] =>
    spec.paths[route]?.get?.parameters?.map((param) => ('$ref' in param ? param.$ref : undefined)) ?? [];

  describe('toPublicSpec', function () {
    it('should give every path in the spec a public equivalent', function () {
      const spec = loadSpec(specPath);

      expect(Object.keys(toPublicSpec(spec, bases).paths)).toHaveLength(Object.keys(spec.paths).length);
    });

    it('should point the top level servers at the namespaced gateway base', function () {
      expect(toPublic().servers?.map((server) => server.url)).toEqual([bases.namespaced]);
    });

    it('should strip the namespace parameter from namespaced paths', function () {
      const spec = toPublic();

      expect(paramRefs(spec, '/')).toEqual([]);
      expect(paramRefs(spec, '/{layerName}')).toEqual(['#/components/parameters/LayerNameParam']);
    });

    it('should override the servers of root scoped paths', function () {
      expect(toPublic().paths['/namespaces']?.servers).toEqual([{ url: bases.root }]);
    });

    it('should drop paths that have no public equivalent', function () {
      const spec = loadSpec(specPath);
      spec.paths['/unmapped'] = { get: { responses: {} } };

      expect(toPublicSpec(spec, bases).paths).not.toHaveProperty('/unmapped');
    });
  });
});
