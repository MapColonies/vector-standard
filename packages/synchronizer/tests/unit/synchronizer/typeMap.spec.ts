import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { JsonValue } from 'type-fest';
import { columnType } from '@map-colonies/vector-standard-db';
import { parseTypeMap } from '@src/sync/typeMap';
import { TypeMapError } from '@src/sync/errors';

const typeMapFile = './config/typeMap.json';
const source = 'test.json';

describe('parseTypeMap', function () {
  describe('Happy Path', function () {
    it('should parse the type map file shipped with the service', function () {
      const typeMap = parseTypeMap(JSON.parse(readFileSync(typeMapFile, 'utf-8')) as JsonValue, typeMapFile);

      expect(typeMap.types.get('integer')).toBe(columnType.bigint);
      expect(typeMap.geometrySubTypes.get('point')).toBe(columnType.point);
    });

    it('should lowercase and trim the keys', function () {
      const typeMap = parseTypeMap({ types: { ' MyType ': columnType.text }, geometrySubTypes: { ['POINT']: columnType.point } }, source);

      expect(typeMap.types.get('mytype')).toBe(columnType.text);
      expect(typeMap.geometrySubTypes.get('point')).toBe(columnType.point);
    });

    it('should accept empty sections', function () {
      const typeMap = parseTypeMap({ types: {}, geometrySubTypes: {} }, source);

      expect(typeMap.types.size).toBe(0);
      expect(typeMap.geometrySubTypes.size).toBe(0);
    });
  });

  describe('Bad Path', function () {
    it.each([[null], ['not an object'], [[]]])('should throw for a non object root (%s)', function (raw) {
      expect(() => parseTypeMap(raw, source)).toThrow(TypeMapError);
    });

    it('should throw when a section is missing', function () {
      expect(() => parseTypeMap({ types: {} }, source)).toThrow(/missing sections \[geometrySubTypes\]/);
    });

    it('should throw when a section is not an object', function () {
      expect(() => parseTypeMap({ types: [], geometrySubTypes: {} }, source)).toThrow(/"types" must be an object/);
    });

    it('should throw when a value is not a supported column type', function () {
      expect(() => parseTypeMap({ types: { integer: 'xsd:banana' }, geometrySubTypes: {} }, source)).toThrow(
        /unsupported column types \[types.integer = "xsd:banana"\]/
      );
    });

    it('should throw when a value is not a string', function () {
      expect(() => parseTypeMap({ types: { integer: 5 }, geometrySubTypes: {} }, source)).toThrow(TypeMapError);
    });
  });
});
