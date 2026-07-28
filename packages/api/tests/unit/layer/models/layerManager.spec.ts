import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { jsLogger } from '@map-colonies/js-logger';
import { LAYER_REPOSITORY_SYMBOL } from '@map-colonies/vector-standard-db';
import { LayerManager } from '@src/layer/models/layerManager';
import { NotFoundError } from '@src/common/error';
import { SERVICES } from '@src/common/constants';
import { registerDependencies } from '@src/common/dependencyRegistration';

describe('LayerManager', function () {
  let manager: LayerManager;

  const find = vi.fn();
  const findOne = vi.fn();

  beforeAll(async function () {
    const logger = await jsLogger({ enabled: false });
    const container = await registerDependencies(
      [
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        { token: LAYER_REPOSITORY_SYMBOL, provider: { useValue: { find, findOne } } },
      ],
      [],
      true
    );
    manager = container.resolve(LayerManager);
  });

  afterEach(function () {
    vi.clearAllMocks();
  });

  describe('Happy Path', function () {
    describe('getLayers', function () {
      it('should return the layer names when layers exist', async function () {
        const layers = [
          { layerName: 'buildings_polygon', alias: 'Buildings Polygon' },
          { layerName: 'fences_line', alias: 'Fences Line' },
        ];
        find.mockResolvedValue(layers);

        const result = await manager.getLayers();

        expect(result).toEqual(layers);
      });
    });

    describe('getLayerSpecByName', function () {
      it('should query using the provided layer name', async function () {
        findOne.mockResolvedValue({ layerName: 'buildings_polygon', alias: 'Buildings', properties: [] });

        await manager.getLayerSpecByName('buildings_polygon');

        expect(findOne).toHaveBeenCalledWith({ where: { layerName: 'buildings_polygon' }, relations: { properties: { possibleValues: true } } });
      });

      it.each([
        {
          name: 'leave possibleValues undefined for non-enum properties',
          inputProperties: [
            { property: 'code', type: 'text' },
            { property: 'height', type: 'real' },
          ],
          expectedPossibleValues: [
            { property: 'code', possibleValues: undefined },
            { property: 'height', possibleValues: undefined },
          ],
        },
        {
          name: 'return possibleValues as EnumValue objects for enum properties',
          inputProperties: [{ property: 'classification', type: 'enum', possibleValues: [{ value: 'A' }, { value: 'B' }] }],
          expectedPossibleValues: [{ property: 'classification', possibleValues: ['A', 'B'] }],
        },
        {
          name: 'only populate possibleValues for enum properties when types are mixed',
          inputProperties: [
            { property: 'name', type: 'text' },
            { property: 'classification', type: 'enum', possibleValues: [{ value: 'A' }] },
          ],
          expectedPossibleValues: [
            { property: 'name', possibleValues: undefined },
            { property: 'classification', possibleValues: ['A'] },
          ],
        },
      ])('should $name', async function ({ inputProperties, expectedPossibleValues }) {
        findOne.mockResolvedValue({ layerName: 'buildings_polygon', alias: 'Buildings', properties: inputProperties });

        const { properties } = await manager.getLayerSpecByName('buildings_polygon');

        for (const { property, possibleValues } of expectedPossibleValues) {
          expect(properties.find((p: { property: string }) => p.property === property)?.possibleValues).toEqual(possibleValues);
        }
      });
    });
  });

  describe('Sad Path', function () {
    describe('getLayers', function () {
      it('should return an empty array when there are no layers', async function () {
        find.mockResolvedValue([]);

        const result = await manager.getLayers();

        expect(result).toEqual([]);
      });
    });

    describe('getLayerSpecByName', function () {
      it('should throw a NotFoundError when the layer does not exist', async function () {
        findOne.mockResolvedValue(null);

        await expect(manager.getLayerSpecByName('nonexistent')).rejects.toThrow(NotFoundError);
      });
    });
  });
});
