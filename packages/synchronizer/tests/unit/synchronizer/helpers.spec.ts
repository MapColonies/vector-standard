import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import type { JsonValue } from 'type-fest';
import { columnType } from '@map-colonies/vector-standard-db';
import { columnInfosToProperties } from '@src/sync/helpers';
import { parseTypeMap } from '@src/sync/typeMap';
import type { ColumnInfo } from '@src/sync/SyncModel';

const typeMapFile = './config/typeMap.json';
const typeMap = parseTypeMap(JSON.parse(readFileSync(typeMapFile, 'utf-8')) as JsonValue, typeMapFile);

describe('columnInfosToProperties', function () {
  const layer = 'test_layer';

  describe('Happy Path', function () {
    it.each([
      ['character varying(255)', columnType.text],
      ['character varying(100)', columnType.text],
      ['numeric(10,2)', columnType.real],
      ['bigint', columnType.bigint],
      ['int8', columnType.bigint],
      ['integer', columnType.bigint],
      ['int4', columnType.bigint],
      ['smallint', columnType.bigint],
      ['bigserial', columnType.bigint],
      ['real', columnType.real],
      ['float4', columnType.real],
      ['float8', columnType.real],
      ['double precision', columnType.real],
      ['numeric', columnType.real],
      ['decimal', columnType.real],
      ['boolean', columnType.boolean],
      ['bool', columnType.boolean],
      ['text', columnType.text],
      ['character varying', columnType.text],
      ['varchar', columnType.text],
      ['bpchar', columnType.text],
      ['uuid', columnType.text],
      ['json', columnType.text],
      ['jsonb', columnType.text],
      ['bytea', columnType.text],
      ['inet', columnType.text],
      ['interval', columnType.text],
      ['time without time zone', columnType.text],
      ['text[]', columnType.text],
      ['timestamp with time zone', columnType.timestamp],
      ['timestamp without time zone', columnType.timestamp],
      ['timestamptz', columnType.timestamp],
      ['timestamp', columnType.timestamp],
      ['date', columnType.timestamp],
      ['geometry', columnType.geom],
      ['geography', columnType.geom],
    ])('should map udt "%s" to %s', function (udtName, expected) {
      const columnInfos: ColumnInfo[] = [{ columnName: 'col', udtName }];

      const [result] = columnInfosToProperties(columnInfos, layer, typeMap);

      expect(result.type).toBe(expected);
    });

    it.each([
      ['geometry(Point,4326)', columnType.point],
      ['geometry(LineString,4326)', columnType.lineString],
      ['geometry(Polygon,4326)', columnType.polygon],
      ['geometry(MultiPoint,4326)', columnType.multiPoint],
      ['geometry(MultiLineString,4326)', columnType.multiLineString],
      ['geometry(MultiPolygon,4326)', columnType.multiPolygon],
      ['geometry(Point)', columnType.point],
      ['geometry(PointZ,4326)', columnType.point],
      ['geometry(MultiPolygonZM,4326)', columnType.multiPolygon],
      ['geography(Point,4326)', columnType.point],
      ['geography(MultiPolygon,4326)', columnType.multiPolygon],
      ['geometry(GeometryCollection,4326)', columnType.geom],
    ])('should map "%s" to its specific GML type', function (udtName, expected) {
      const [result] = columnInfosToProperties([{ columnName: 'shape', udtName }], layer, typeMap);

      expect(result.type).toBe(expected);
    });

    it('should map unqualified geometry to gml:GeometryPropertyType', function () {
      const [result] = columnInfosToProperties([{ columnName: 'shape', udtName: 'geometry' }], layer, typeMap);

      expect(result.type).toBe(columnType.geom);
    });

    it('should match udt names case insensitively', function () {
      const [result] = columnInfosToProperties([{ columnName: 'name', udtName: 'CHARACTER VARYING(255)' }], layer, typeMap);

      expect(result.type).toBe(columnType.text);
    });

    it('should set layerName and property on every result', function () {
      const columnInfos: ColumnInfo[] = [
        { columnName: 'name', udtName: 'text' },
        { columnName: 'height', udtName: 'real' },
      ];

      const result = columnInfosToProperties(columnInfos, layer, typeMap);

      expect(result).toEqual([
        { layerName: layer, property: 'name', type: columnType.text },
        { layerName: layer, property: 'height', type: columnType.real },
      ]);
    });
  });

  describe('Sad Path', function () {
    it('should return an empty array for no column infos', function () {
      expect(columnInfosToProperties([], layer, typeMap)).toEqual([]);
    });
  });

  describe('Bad Path', function () {
    it('should map unknown geometry sub-type to gml:GeometryPropertyType', function () {
      const [result] = columnInfosToProperties([{ columnName: 'shape', udtName: 'geometry(Curve,4326)' }], layer, typeMap);

      expect(result.type).toBe(columnType.geom);
    });

    it('should return no properties for a udt name not in the type map', function () {
      const result = columnInfosToProperties([{ columnName: 'data', udtName: 'pg_lsn' }], layer, typeMap);

      expect(result).toHaveLength(0);
    });

    it('should skip unsupported types and call onUnknown', function () {
      const onUnknown = vi.fn();
      const columnInfos: ColumnInfo[] = [
        { columnName: 'name', udtName: 'text' },
        { columnName: 'lsn', udtName: 'pg_lsn' },
        { columnName: 'height', udtName: 'real' },
      ];

      const result = columnInfosToProperties(columnInfos, layer, typeMap, onUnknown);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.property)).toEqual(['name', 'height']);
      expect(onUnknown).toHaveBeenCalledExactlyOnceWith('lsn', 'pg_lsn');
    });
  });
});
