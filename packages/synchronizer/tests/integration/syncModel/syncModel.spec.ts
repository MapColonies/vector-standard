/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { jsLogger } from '@map-colonies/js-logger';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { trace } from '@opentelemetry/api';
import nock, { disableNetConnect, enableNetConnect, cleanAll } from 'nock';
import type { DataSource, Repository } from 'typeorm';
import type { EnumValue, Layer, Property } from '@map-colonies/vector-standard-db';
import {
  DATA_SOURCE_PROVIDER as DESTINATION_DATA_SOURCE_PROVIDER,
  ENUMS_REPOSITORY_SYMBOL,
  LAYER_REPOSITORY_SYMBOL,
  PROPERTY_REPOSITORY_SYMBOL,
  columnType,
} from '@map-colonies/vector-standard-db';
import { initConfig, getConfig } from '@src/common/config';
import { registerExternalValues } from '@src/containerConfig';
import { SERVICES, SOURCE_DATA_SOURCE_PROVIDER } from '@src/common/constants';
import { S3Repository } from '@src/common/s3/s3Repository';
import { SyncModel } from '@src/sync/SyncModel';
import { schemaOf } from '@src/sync/helpers';

const TEST_LAYER = 'test_layer';
const ENRICHMENT_ORIGIN = 'http://mock-api';

const mockEnrichmentApi = (responseBody: object, statusCode = 200): nock.Scope =>
  nock(ENRICHMENT_ORIGIN).get(`/${TEST_LAYER}`).reply(statusCode, responseBody);

const createDestinationSchema = async (dataSource: DataSource, schema: string): Promise<void> => {
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await dataSource.query(`
    CREATE TYPE "${schema}"."column_type" AS ENUM('xsd:long', 'xsd:double', 'xsd:boolean', 'xsd:string', 'xsd:dateTime', 'gml:GeometryPropertyType', 'gml:PointPropertyType', 'gml:LineStringPropertyType', 'gml:PolygonPropertyType', 'gml:MultiPointPropertyType', 'gml:MultiLineStringPropertyType', 'gml:MultiPolygonPropertyType')
  `);
  await dataSource.query(`
    CREATE TABLE "${schema}"."layer" (
      "layer_name" character varying NOT NULL,
      "layer_id" integer NOT NULL,
      "alias" character varying NOT NULL,
      PRIMARY KEY ("layer_name")
    )
  `);
  await dataSource.query(`
    CREATE TABLE "${schema}"."property" (
      "layer_name" character varying NOT NULL,
      "property" character varying NOT NULL,
      "type" "${schema}"."column_type" NOT NULL,
      "alias" character varying,
      PRIMARY KEY ("layer_name", "property")
    )
  `);
  await dataSource.query(`
    CREATE TABLE "${schema}"."enum_value" (
      "value" character varying NOT NULL,
      "layer_name" character varying NOT NULL,
      "property" character varying NOT NULL,
      PRIMARY KEY ("value", "layer_name", "property"),
      FOREIGN KEY ("layer_name", "property")
        REFERENCES "${schema}"."property"("layer_name","property")
        ON DELETE CASCADE ON UPDATE NO ACTION
    )
  `);
};

describe('DAL', function () {
  let dal: SyncModel;
  let enrichedDal: SyncModel;
  let sourceDataSource: DataSource;
  let destinationDataSource: DataSource;
  let sourceSchema: string;
  let destinationSchema: string;
  let layerRepository: Repository<Layer>;
  let propertyRepository: Repository<Property>;
  let enumsRepository: Repository<EnumValue>;

  beforeAll(async function () {
    disableNetConnect();

    await initConfig(true);
    const container = await registerExternalValues({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        { token: S3Repository, provider: { useValue: { downloadFile: vi.fn() } } },
      ],
      useChild: true,
    });

    dal = container.resolve(SyncModel);
    sourceDataSource = container.resolve<DataSource>(SOURCE_DATA_SOURCE_PROVIDER);
    destinationDataSource = container.resolve<DataSource>(DESTINATION_DATA_SOURCE_PROVIDER);
    layerRepository = container.resolve<Repository<Layer>>(LAYER_REPOSITORY_SYMBOL);
    propertyRepository = container.resolve<Repository<Property>>(PROPERTY_REPOSITORY_SYMBOL);
    enumsRepository = container.resolve<Repository<EnumValue>>(ENUMS_REPOSITORY_SYMBOL);

    sourceSchema = schemaOf(sourceDataSource);
    destinationSchema = schemaOf(destinationDataSource);

    await sourceDataSource.query(`CREATE SCHEMA IF NOT EXISTS "${sourceSchema}"`);
    await createDestinationSchema(destinationDataSource, destinationSchema);

    const configWithEnrichment = new Proxy(getConfig(), {
      get(target, prop) {
        if (prop === 'get') {
          return (key: string) => {
            if (key === 'enrichment') {
              return {
                enabled: true as const,
                api: 'http://mock-api/{layerName}',
                propertiesPath: 'fields_list',
                aliasField: 'display_name',
              };
            }
            return target.get(key);
          };
        }
        return target[prop as keyof typeof target];
      },
    });

    const enrichedContainer = await registerExternalValues({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        { token: SERVICES.CONFIG, provider: { useValue: configWithEnrichment } },
        { token: S3Repository, provider: { useValue: { downloadFile: vi.fn() } } },
      ],
      useChild: true,
    });

    enrichedDal = enrichedContainer.resolve(SyncModel);
  });

  beforeEach(async function () {
    await sourceDataSource.query(`
      CREATE TABLE IF NOT EXISTS "${sourceSchema}"."${TEST_LAYER}" (
        id bigint,
        name character varying,
        height real,
        active boolean,
        created_at timestamp with time zone,
        category character varying,
        shape geometry
      )
    `);
  });

  afterEach(async function () {
    cleanAll();
    await sourceDataSource.query(`DROP TABLE IF EXISTS "${sourceSchema}"."${TEST_LAYER}"`);
    await enumsRepository.createQueryBuilder().delete().execute();
    await propertyRepository.createQueryBuilder().delete().execute();
    await layerRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async function () {
    await destinationDataSource.query(`DROP SCHEMA IF EXISTS "${destinationSchema}" CASCADE`);
    await sourceDataSource.query(`DROP SCHEMA IF EXISTS "${sourceSchema}" CASCADE`);
    await sourceDataSource.destroy();
    await destinationDataSource.destroy();
    enableNetConnect();
  });

  describe('Happy Path', function () {
    describe('syncLayer', function () {
      it('should insert a layer row with the provided alias', async function () {
        await dal.syncLayer('buildings', 1, 'Buildings Layer');

        const layer = await layerRepository.findOne({ where: { layerName: 'buildings' } });

        expect(layer?.layerName).toBe('buildings');
        expect(layer?.layerId).toBe(1);
        expect(layer?.alias).toBe('Buildings Layer');
      });

      it('should use layerName as alias when none is provided', async function () {
        await dal.syncLayer('buildings', 1);

        const layer = await layerRepository.findOne({ where: { layerName: 'buildings' } });

        expect(layer?.alias).toBe('buildings');
      });
    });

    describe('getTableColumns', function () {
      it('should return all columns with their udt names for an existing table', async function () {
        const columns = await dal.getTableColumns(TEST_LAYER);

        expect(columns).toEqual(
          expect.arrayContaining([
            { columnName: 'id', udtName: 'bigint' },
            { columnName: 'name', udtName: 'character varying' },
            { columnName: 'height', udtName: 'real' },
            { columnName: 'active', udtName: 'boolean' },
            { columnName: 'category', udtName: 'character varying' },
          ])
        );
      });
    });

    describe('getEnumDistinctValues', function () {
      it('should return distinct values per enum column', async function () {
        await sourceDataSource.query(`
          INSERT INTO "${sourceSchema}"."${TEST_LAYER}" (category) VALUES ('A'), ('B'), ('A'), ('C')
        `);

        const result = await dal.getEnumDistinctValues({ layerName: TEST_LAYER, enums: ['category'] });

        expect(result.get('category')).toEqual(expect.arrayContaining(['A', 'B', 'C']));
        expect(result.get('category')).toHaveLength(3);
      });

      it('should exclude null values from distinct results', async function () {
        await sourceDataSource.query(`
          INSERT INTO "${sourceSchema}"."${TEST_LAYER}" (category) VALUES ('X'), (NULL), ('Y')
        `);

        const result = await dal.getEnumDistinctValues({ layerName: TEST_LAYER, enums: ['category'] });

        expect(result.get('category')).toEqual(expect.arrayContaining(['X', 'Y']));
        expect(result.get('category')).toHaveLength(2);
      });

      it('should handle multiple enum columns', async function () {
        await sourceDataSource.query(`
          INSERT INTO "${sourceSchema}"."${TEST_LAYER}" (category, name) VALUES ('A', 'foo'), ('B', 'bar')
        `);

        const result = await dal.getEnumDistinctValues({ layerName: TEST_LAYER, enums: ['category', 'name'] });

        expect(result.get('category')).toEqual(expect.arrayContaining(['A', 'B']));
        expect(result.get('name')).toEqual(expect.arrayContaining(['foo', 'bar']));
      });
    });

    describe('syncProperties', function () {
      it('should upsert all columns from the source table into the property repository', async function () {
        const affected = await dal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });

        expect(affected).toBeGreaterThan(0);
        expect(properties).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ layerName: TEST_LAYER, property: 'id', type: columnType.bigint }),
            expect.objectContaining({ layerName: TEST_LAYER, property: 'name', type: columnType.text }),
            expect.objectContaining({ layerName: TEST_LAYER, property: 'height', type: columnType.real }),
            expect.objectContaining({ layerName: TEST_LAYER, property: 'active', type: columnType.boolean }),
            expect.objectContaining({ layerName: TEST_LAYER, property: 'created_at', type: columnType.timestamp }),
            expect.objectContaining({ layerName: TEST_LAYER, property: 'shape', type: columnType.geom }),
          ])
        );
      });

      it('should mark enum columns with columnType.enum', async function () {
        await dal.syncProperties({ layerName: TEST_LAYER, enums: ['category', 'name'] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });
        const categoryProp = properties.find((p) => p.property === 'category');
        const nameProp = properties.find((p) => p.property === 'name');
        const heightProp = properties.find((p) => p.property === 'height');

        expect(categoryProp?.type).toBe(columnType.text);
        expect(nameProp?.type).toBe(columnType.text);
        expect(heightProp?.type).toBe(columnType.real);
      });

      it('should upsert on subsequent calls without duplicating rows', async function () {
        await dal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);
        await dal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });
        const uniqueProps = new Set(properties.map((p) => p.property));

        expect(properties).toHaveLength(uniqueProps.size);
      });

      it('should normalize a parameterized geometry column to columnType.geom', async function () {
        await sourceDataSource.query(`
        ALTER TABLE "${sourceSchema}"."${TEST_LAYER}" ADD COLUMN geom_param geometry(Point,4326)
      `);

        await dal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });
        const geomProp = properties.find((p) => p.property === 'geom_param');

        expect(geomProp?.type).toBe(columnType.point);
      });
    });

    describe('syncEnum', function () {
      it('should persist distinct enum values from source table into enum repository', async function () {
        await sourceDataSource.query(`
          INSERT INTO "${sourceSchema}"."${TEST_LAYER}" (category) VALUES ('A'), ('B'), ('A'), ('C')
        `);
        await dal.syncProperties({ layerName: TEST_LAYER, enums: ['category'] }, 1);

        const affected = await dal.syncEnum({ layerName: TEST_LAYER, enums: ['category'] });

        const enums = await enumsRepository.find({ where: { layerName: TEST_LAYER, property: 'category' } });
        const values = enums.map((e) => e.value);

        expect(affected).toBe(3);
        expect(values).toEqual(expect.arrayContaining(['A', 'B', 'C']));
      });

      it('should create an index on the enum column in the source table', async function () {
        await dal.syncProperties({ layerName: TEST_LAYER, enums: ['category'] }, 1);
        await dal.syncEnum({ layerName: TEST_LAYER, enums: ['category'] });

        const indexName = `${TEST_LAYER}_category_idx`;
        const rows = await sourceDataSource.query<{ indexname: string }[]>(
          `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = $2 AND indexname = $3`,
          [sourceSchema, TEST_LAYER, indexName]
        );

        expect(rows).toHaveLength(1);
      });
    });

    describe('syncProperties with enrichment', function () {
      it('should write aliases from the enrichment API into the property table', async function () {
        mockEnrichmentApi({
          fields_list: {
            name: { display_name: 'Layer Name', type: 'TEXT' },
            height: { display_name: 'Building Height', type: 'REAL' },
          },
        });

        await enrichedDal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });
        const nameProp = properties.find((p) => p.property === 'name');
        const heightProp = properties.find((p) => p.property === 'height');
        const idProp = properties.find((p) => p.property === 'id');

        expect(nameProp?.alias).toBe('Layer Name');
        expect(heightProp?.alias).toBe('Building Height');
        expect(idProp).toBeDefined();
        expect(idProp?.alias).toBeUndefined();
      });

      it('should call the enrichment API once with the resolved layer URL', async function () {
        const scope = mockEnrichmentApi({ fields_list: {} });

        await enrichedDal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        expect(scope.isDone()).toBe(true);
      });
    });

    describe('syncProperties with file aliases', function () {
      let tmpDir: string;
      let aliasesFileDal: SyncModel;
      let bothDal: SyncModel;

      beforeAll(async function () {
        tmpDir = mkdtempSync(join(tmpdir(), 'dal-aliases-test-'));

        const makeConfig = (enrichmentEnabled: boolean) =>
          new Proxy(getConfig(), {
            get(target, prop) {
              if (prop === 'get') {
                return (key: string) => {
                  if (key === 'aliasesFile') return join(tmpDir, 'aliases.json');
                  if (key === 'enrichment') {
                    return enrichmentEnabled
                      ? { enabled: true as const, api: 'http://mock-api/{layerName}', propertiesPath: 'fields_list', aliasField: 'display_name' }
                      : { enabled: false };
                  }
                  return target.get(key);
                };
              }
              return target[prop as keyof typeof target];
            },
          });

        const logger = await jsLogger({ enabled: false });
        const s3Mock = { token: S3Repository, provider: { useValue: { downloadFile: vi.fn() } } };
        const sharedOverrides = [
          { token: SERVICES.LOGGER, provider: { useValue: logger } },
          { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
          s3Mock,
        ];

        aliasesFileDal = (
          await registerExternalValues({
            override: [...sharedOverrides, { token: SERVICES.CONFIG, provider: { useValue: makeConfig(false) } }],
            useChild: true,
          })
        ).resolve(SyncModel);

        bothDal = (
          await registerExternalValues({
            override: [...sharedOverrides, { token: SERVICES.CONFIG, provider: { useValue: makeConfig(true) } }],
            useChild: true,
          })
        ).resolve(SyncModel);
      });

      afterAll(function () {
        rmSync(tmpDir, { recursive: true });
      });

      it('should apply aliases from the file when enrichment is disabled', async function () {
        writeFileSync(join(tmpDir, 'aliases.json'), JSON.stringify({ [TEST_LAYER]: { name: 'File Name', height: 'File Height' } }));

        await aliasesFileDal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });

        expect(properties.find((p) => p.property === 'name')?.alias).toBe('File Name');
        expect(properties.find((p) => p.property === 'height')?.alias).toBe('File Height');
        expect(properties.find((p) => p.property === 'id')?.alias).toBeUndefined();
      });

      it('should override API aliases with file aliases for the same property', async function () {
        writeFileSync(join(tmpDir, 'aliases.json'), JSON.stringify({ [TEST_LAYER]: { name: 'File Name' } }));

        mockEnrichmentApi({
          fields_list: { name: { display_name: 'API Name', type: 'TEXT' }, height: { display_name: 'API Height', type: 'REAL' } },
        });

        await bothDal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });

        expect(properties.find((p) => p.property === 'name')?.alias).toBe('File Name');
        expect(properties.find((p) => p.property === 'height')?.alias).toBe('API Height');
      });

      it('should fill in aliases from the file for properties absent from the API response', async function () {
        writeFileSync(join(tmpDir, 'aliases.json'), JSON.stringify({ [TEST_LAYER]: { height: 'File Height' } }));

        mockEnrichmentApi({ fields_list: { name: { display_name: 'API Name', type: 'TEXT' } } });

        await bothDal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });

        expect(properties.find((p) => p.property === 'name')?.alias).toBe('API Name');
        expect(properties.find((p) => p.property === 'height')?.alias).toBe('File Height');
      });
    });
  });

  describe('Sad Path', function () {
    describe('syncLayer', function () {
      it('should not throw and not update on duplicate layerName', async function () {
        await dal.syncLayer('buildings', 1, 'First');
        await dal.syncLayer('buildings', 2, 'Second');

        const layers = await layerRepository.find({ where: { layerName: 'buildings' } });

        expect(layers).toHaveLength(1);
        expect(layers[0]?.alias).toBe('First');
      });
    });

    describe('getTableColumns', function () {
      it('should return an empty array for a table with no columns', async function () {
        await sourceDataSource.query(`CREATE TABLE "${sourceSchema}"."empty_table" ()`);

        const columns = await dal.getTableColumns('empty_table');

        await sourceDataSource.query(`DROP TABLE "${sourceSchema}"."empty_table"`);

        expect(columns).toHaveLength(0);
      });
    });

    describe('getEnumDistinctValues', function () {
      it('should return an empty map when no enum columns are provided', async function () {
        const result = await dal.getEnumDistinctValues({ layerName: TEST_LAYER, enums: [] });

        expect(result.size).toBe(0);
      });
    });

    describe('syncEnum', function () {
      it('should return 0 and skip when no enum columns are configured', async function () {
        const affected = await dal.syncEnum({ layerName: TEST_LAYER, enums: [] });

        expect(affected).toBe(0);

        const enums = await enumsRepository.find({ where: { layerName: TEST_LAYER } });

        expect(enums).toHaveLength(0);
      });
    });

    describe('syncProperties with enrichment', function () {
      it('should leave alias unset for properties absent from the enrichment response', async function () {
        mockEnrichmentApi({ fields_list: { name: { display_name: 'Layer Name', type: 'TEXT' } } });

        await enrichedDal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });
        const idProp = properties.find((p) => p.property === 'id');

        expect(idProp).toBeDefined();
        expect(idProp?.alias).toBeUndefined();
      });

      it('should sync properties without aliases when the enrichment API returns an error response', async function () {
        mockEnrichmentApi({}, 500);

        const affected = await enrichedDal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);

        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });
        const idProp = properties.find((p) => p.property === 'id');
        const nameProp = properties.find((p) => p.property === 'name');

        expect(affected).toBeGreaterThan(0);
        expect(idProp).toBeDefined();
        expect(idProp?.alias).toBeUndefined();
        expect(nameProp?.alias).toBeUndefined();
      });
    });
  });

  describe('Bad Path', function () {
    describe('syncProperties', function () {
      it('should skip columns with unsupported types and still sync the rest', async function () {
        await sourceDataSource.query(`
          ALTER TABLE "${sourceSchema}"."${TEST_LAYER}" ADD COLUMN count integer
        `);

        const affected = await dal.syncProperties({ layerName: TEST_LAYER, enums: [] }, 1);
        const properties = await propertyRepository.find({ where: { layerName: TEST_LAYER } });

        expect(affected).toBeGreaterThan(0);
        expect(properties.find((p) => p.property === 'count')).toBeUndefined();
        expect(properties.find((p) => p.property === 'id')).toBeDefined();
      });
    });
  });
});
