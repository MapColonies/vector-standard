import { jsLogger } from '@map-colonies/js-logger';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import type { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE_PROVIDER, EnumValue, LAYER_REPOSITORY_SYMBOL, Property, columnType } from '@map-colonies/vector-standard-db';
import type { Layer } from '@map-colonies/vector-standard-db';
import { getApp } from '@src/app';
import { SERVICES } from '@src/common/constants';
import { initConfig } from '@src/common/config';
import { LayerRequestSender } from './helpers/layerRequestSender';

describe('layer', function () {
  let requestSender: LayerRequestSender;
  let dataSource: DataSource;
  let layerRepository: Repository<Layer>;
  let propertyRepository: Repository<Property>;
  let enumValueRepository: Repository<EnumValue>;

  beforeAll(async function () {
    await initConfig(true);

    const [app, container] = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new LayerRequestSender(app);
    dataSource = container.resolve<DataSource>(DATA_SOURCE_PROVIDER);
    layerRepository = container.resolve<Repository<Layer>>(LAYER_REPOSITORY_SYMBOL);
    propertyRepository = dataSource.getRepository(Property);
    enumValueRepository = dataSource.getRepository(EnumValue);
  });

  afterEach(async function () {
    await propertyRepository.createQueryBuilder().delete().execute();
    await layerRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async function () {
    await dataSource.destroy();
  });

  describe('Happy Path', function () {
    describe('GET /layers', function () {
      beforeEach(async function () {
        await layerRepository.save([
          { layerName: 'buildings_polygon', layerId: 1, alias: 'Buildings Polygon' },
          { layerName: 'fences_line', layerId: 2, alias: 'Fences Line' },
        ]);
        await propertyRepository.save([
          { layerName: 'buildings_polygon', property: 'code', type: columnType.text },
          { layerName: 'fences_line', property: 'height', type: columnType.real },
        ]);
      });

      it('should return 200 with all layers including their aliases', async function () {
        const response = await requestSender.getLayers();
        const { layers } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(layers).toContainEqual({ layerName: 'buildings_polygon', alias: 'Buildings Polygon' });
        expect(layers).toContainEqual({ layerName: 'fences_line', alias: 'Fences Line' });
      });
    });

    describe('GET /layers/:layerName', function () {
      it('should return 200 with the layer spec for non-enum properties', async function () {
        await layerRepository.save({ layerName: 'buildings_polygon', layerId: 1, alias: 'Buildings Polygon' });
        await propertyRepository.save([
          { layerName: 'buildings_polygon', property: 'code', type: columnType.text },
          { layerName: 'buildings_polygon', property: 'height', type: columnType.real },
        ]);

        const response = await requestSender.getLayerByName('buildings_polygon');
        const { layerName, properties } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(layerName).toBe('buildings_polygon');
        expect(properties).toContainEqual({ property: 'code', type: columnType.text });
        expect(properties).toContainEqual({ property: 'height', type: columnType.real });
      });

      it('should return 200 with possibleValues for enum properties', async function () {
        await layerRepository.save({ layerName: 'buildings_polygon', layerId: 1, alias: 'Buildings Polygon' });
        await propertyRepository.save({ layerName: 'buildings_polygon', property: 'classification', type: columnType.text });
        await enumValueRepository.save([
          { value: 'A', layerName: 'buildings_polygon', property: 'classification' },
          { value: 'B', layerName: 'buildings_polygon', property: 'classification' },
        ]);

        const response = await requestSender.getLayerByName('buildings_polygon');
        const { properties } = response.body;
        const classificationProp = properties.find((p) => p.property === 'classification');

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(classificationProp?.type).toBe(columnType.text);
        expect(classificationProp?.possibleValues).toContain('A');
        expect(classificationProp?.possibleValues).toContain('B');
      });
    });
  });

  describe('Sad Path', function () {
    describe('GET /layers', function () {
      it('should return 200 with an empty list when there are no layers', async function () {
        const response = await requestSender.getLayers();
        const { layers } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(layers).toHaveLength(0);
      });
    });

    describe('GET /layers/:layerName', function () {
      it('should return 404 not found for a non-existent layer', async function () {
        const response = await requestSender.getLayerByName('nonexistent');

        expect(response.statusCode).toBe(httpStatusCodes.NOT_FOUND);
      });
    });
  });
});
