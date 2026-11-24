import { describe, it, expect } from 'vitest';
import { parseLayers } from '@src/sync/layersFile';
import { LayersFileError } from '@src/sync/errors';

const source = 'layers.json';

describe('parseLayers', function () {
  describe('Happy Path', function () {
    it('should default the source to lua when omitted', function () {
      const layers = parseLayers([{ layerName: 'buildings', enums: [] }], source);

      expect(layers[0]?.source).toBe('lua');
    });

    it('should accept a layer with an explicit lua source', function () {
      const layers = parseLayers([{ layerName: 'buildings', enums: [], source: 'lua' }], source);

      expect(layers[0]?.source).toBe('lua');
    });

    it('should accept a logical layer with a layer id and alias', function () {
      const layers = parseLayers([{ layerName: 'roads', enums: [], source: 'logical', layerId: 7, alias: 'Roads' }], source);

      expect(layers[0]).toMatchObject({ source: 'logical', layerId: 7, alias: 'Roads' });
    });
  });

  describe('Bad Path', function () {
    it('should reject an unknown source', function () {
      expect(() => parseLayers([{ layerName: 'roads', enums: [], source: 'other' }], source)).toThrow(LayersFileError);
    });

    it('should reject a logical layer without a layer id', function () {
      expect(() => parseLayers([{ layerName: 'roads', enums: [], source: 'logical', alias: 'Roads' }], source)).toThrow(LayersFileError);
    });

    it('should reject a logical layer without an alias', function () {
      expect(() => parseLayers([{ layerName: 'roads', enums: [], source: 'logical', layerId: 7 }], source)).toThrow(LayersFileError);
    });

    it('should reject a layer id on a non-logical layer', function () {
      expect(() => parseLayers([{ layerName: 'roads', enums: [], layerId: 7 }], source)).toThrow(LayersFileError);
    });

    it('should reject an alias on a non-logical layer', function () {
      expect(() => parseLayers([{ layerName: 'roads', enums: [], source: 'lua', alias: 'Roads' }], source)).toThrow(LayersFileError);
    });

    it('should reject a non-integer layer id', function () {
      expect(() => parseLayers([{ layerName: 'roads', enums: [], source: 'logical', layerId: '7', alias: 'Roads' }], source)).toThrow(
        LayersFileError
      );
    });
  });
});
