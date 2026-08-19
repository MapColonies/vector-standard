import { jsLogger } from '@map-colonies/js-logger';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import type { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE_PROVIDER, EnumValue, LAYER_REPOSITORY_SYMBOL, Property, columnType, layerSource } from '@map-colonies/vector-standard-db';
import type { Layer } from '@map-colonies/vector-standard-db';
import { getApp } from '@src/app';
import { SERVICES } from '@src/common/constants';
import { initConfig } from '@src/common/config';
import { LayerRequestSender } from './helpers/layerRequestSender';

const NAMESPACE = 'data-2025';
const OTHER_NAMESPACE = 'data-2024';

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
    describe('GET /namespaces', function () {
      it('should return 200 with every namespace holding layers, without duplicates', async function () {
        await layerRepository.save([
          { namespace: NAMESPACE, layerName: 'buildings_polygon', layerId: 1, source: layerSource.sharedLua, alias: 'Buildings Polygon' },
          { namespace: NAMESPACE, layerName: 'fences_line', layerId: 2, source: layerSource.sharedLua, alias: 'Fences Line' },
          { namespace: OTHER_NAMESPACE, layerName: 'buildings_polygon', layerId: null, source: layerSource.perLayerJson, alias: 'Old Buildings' },
        ]);

        const response = await requestSender.getNamespaces();
        const { namespaces } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(namespaces).toEqual([{ name: OTHER_NAMESPACE }, { name: NAMESPACE }]);
      });
    });

    describe('GET /namespaces/:namespace/layers', function () {
      beforeEach(async function () {
        await layerRepository.save([
          { namespace: NAMESPACE, layerName: 'buildings_polygon', layerId: 1, source: layerSource.sharedLua, alias: 'Buildings Polygon' },
          { namespace: NAMESPACE, layerName: 'fences_line', layerId: 2, source: layerSource.sharedLua, alias: 'Fences Line' },
        ]);
        await propertyRepository.save([
          { namespace: NAMESPACE, layerName: 'buildings_polygon', property: 'code', type: columnType.text },
          { namespace: NAMESPACE, layerName: 'fences_line', property: 'height', type: columnType.real },
        ]);
      });

      it('should return 200 with all layers including their aliases', async function () {
        const response = await requestSender.getLayers(NAMESPACE);
        const { layers } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(layers).toContainEqual({ layerName: 'buildings_polygon', alias: 'Buildings Polygon' });
        expect(layers).toContainEqual({ layerName: 'fences_line', alias: 'Fences Line' });
      });

      it('should not return layers belonging to another namespace', async function () {
        await layerRepository.save({
          namespace: OTHER_NAMESPACE,
          layerName: 'rivers_line',
          layerId: null,
          source: layerSource.perLayerJson,
          alias: 'Rivers',
        });

        const response = await requestSender.getLayers(NAMESPACE);
        const { layers } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(layers).toHaveLength(2);
        expect(layers).not.toContainEqual({ layerName: 'rivers_line', alias: 'Rivers' });
      });
    });

    describe('GET /namespaces/:namespace/layers/:layerName', function () {
      it('should return 200 with the layer spec for non-enum properties', async function () {
        await layerRepository.save({
          namespace: NAMESPACE,
          layerName: 'buildings_polygon',
          layerId: 1,
          source: layerSource.sharedLua,
          alias: 'Buildings Polygon',
        });
        await propertyRepository.save([
          { namespace: NAMESPACE, layerName: 'buildings_polygon', property: 'code', type: columnType.text },
          { namespace: NAMESPACE, layerName: 'buildings_polygon', property: 'height', type: columnType.real },
        ]);

        const response = await requestSender.getLayerByName(NAMESPACE, 'buildings_polygon');
        const { layerName, properties } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(layerName).toBe('buildings_polygon');
        expect(properties).toContainEqual({ property: 'code', type: columnType.text });
        expect(properties).toContainEqual({ property: 'height', type: columnType.real });
      });

      it('should return 200 with possibleValues for enum properties', async function () {
        await layerRepository.save({
          namespace: NAMESPACE,
          layerName: 'buildings_polygon',
          layerId: 1,
          source: layerSource.sharedLua,
          alias: 'Buildings Polygon',
        });
        await propertyRepository.save({ namespace: NAMESPACE, layerName: 'buildings_polygon', property: 'classification', type: columnType.text });
        await enumValueRepository.save([
          { namespace: NAMESPACE, value: 'A', layerName: 'buildings_polygon', property: 'classification' },
          { namespace: NAMESPACE, value: 'B', layerName: 'buildings_polygon', property: 'classification' },
        ]);

        const response = await requestSender.getLayerByName(NAMESPACE, 'buildings_polygon');
        const { properties } = response.body;
        const classificationProp = properties.find((p) => p.property === 'classification');

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(classificationProp?.type).toBe(columnType.text);
        expect(classificationProp?.possibleValues).toContain('A');
        expect(classificationProp?.possibleValues).toContain('B');
      });

      it('should return the spec of the requested namespace when the layer name exists in both', async function () {
        await layerRepository.save([
          { namespace: NAMESPACE, layerName: 'buildings_polygon', layerId: 1, source: layerSource.sharedLua, alias: 'New Buildings' },
          { namespace: OTHER_NAMESPACE, layerName: 'buildings_polygon', layerId: null, source: layerSource.perLayerJson, alias: 'Old Buildings' },
        ]);
        await propertyRepository.save([
          { namespace: NAMESPACE, layerName: 'buildings_polygon', property: 'code', type: columnType.text },
          { namespace: OTHER_NAMESPACE, layerName: 'buildings_polygon', property: 'legacy_code', type: columnType.text },
        ]);

        const response = await requestSender.getLayerByName(OTHER_NAMESPACE, 'buildings_polygon');
        const { alias, properties } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(alias).toBe('Old Buildings');
        expect(properties).toContainEqual({ property: 'legacy_code', type: columnType.text });
        expect(properties).not.toContainEqual({ property: 'code', type: columnType.text });
      });
    });
  });

  describe('Sad Path', function () {
    describe('GET /namespaces', function () {
      it('should return 200 with an empty list when there are no layers', async function () {
        const response = await requestSender.getNamespaces();
        const { namespaces } = response.body;

        expect(response.statusCode).toBe(httpStatusCodes.OK);
        expect(namespaces).toHaveLength(0);
      });
    });

    describe('GET /namespaces/:namespace/layers', function () {
      it('should return 404 not found for a namespace holding no layers', async function () {
        const response = await requestSender.getLayers('nonexistent');

        expect(response.statusCode).toBe(httpStatusCodes.NOT_FOUND);
      });
    });

    describe('GET /namespaces/:namespace/layers/:layerName', function () {
      it('should return 404 not found for a non-existent layer', async function () {
        const response = await requestSender.getLayerByName(NAMESPACE, 'nonexistent');

        expect(response.statusCode).toBe(httpStatusCodes.NOT_FOUND);
      });

      it('should return 404 not found when the layer exists only in another namespace', async function () {
        await layerRepository.save({
          namespace: OTHER_NAMESPACE,
          layerName: 'rivers_line',
          layerId: null,
          source: layerSource.perLayerJson,
          alias: 'Rivers',
        });

        const response = await requestSender.getLayerByName(NAMESPACE, 'rivers_line');

        expect(response.statusCode).toBe(httpStatusCodes.NOT_FOUND);
      });
    });
  });
});
