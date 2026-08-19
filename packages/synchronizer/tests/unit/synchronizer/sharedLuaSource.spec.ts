/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import nock, { disableNetConnect, enableNetConnect, cleanAll } from 'nock';
import { jsLogger } from '@map-colonies/js-logger';
import type { Logger } from '@map-colonies/js-logger';
import { SharedLuaSource } from '@src/sync/layerSource/sharedLuaSource';
import type { FileDownloader } from '@src/sync/layerSource/types';
import { FsRepository } from '@src/common/fs/fsRepository';
import type { SharedLuaSourceConfig } from '@src/common/interfaces';

const ID_FIELD = 'layer_id';
const NAME_FIELD = 'layer_name';
const ALIAS_FIELD = 'layer_alias';
const BUCKET = 'test-bucket';
const FILE_NAME = 'query.lua';
const ENRICHMENT_ORIGIN = 'http://mock-api';

const makeLua = (entries: string): string => `local layers = {\n${entries}\n}`;

const makeEntry = (layerId: string, layerName: string, alias: string): string =>
  `  { ${ID_FIELD} = '${layerId}', ${NAME_FIELD} = '${layerName}', ${ALIAS_FIELD} = '${alias}' },`;

describe('SharedLuaSource', function () {
  let tmpDir: string;
  let logger: Logger;
  let fsRepository: FsRepository;

  const makeS3Repository = (content: string): FileDownloader => {
    const filePath = join(tmpDir, FILE_NAME);
    writeFileSync(filePath, content);
    return { downloadFile: vi.fn().mockResolvedValue(filePath) };
  };

  const disabledEnrichmentConfig: SharedLuaSourceConfig = {
    type: 'sharedLua',
    fileName: FILE_NAME,
    layersVariable: 'layers',
    aliasFieldName: ALIAS_FIELD,
    idFieldName: ID_FIELD,
    nameFieldName: NAME_FIELD,
    enrichment: { enabled: false },
  };

  beforeAll(async function () {
    logger = await jsLogger({ enabled: false });
    fsRepository = new FsRepository(logger);
    disableNetConnect();
  });

  beforeEach(function () {
    tmpDir = mkdtempSync(join(tmpdir(), 'shared-lua-source-test-'));
    cleanAll();
  });

  afterEach(function () {
    rmSync(tmpDir, { recursive: true });
    cleanAll();
  });

  afterAll(function () {
    enableNetConnect();
  });

  describe('Happy Path', function () {
    it('should resolve a known layer with its id and alias', async function () {
      const s3Repository = makeS3Repository(makeLua(makeEntry('1', 'buildings', 'Buildings')));
      const source = new SharedLuaSource(s3Repository, fsRepository, logger, BUCKET, disabledEnrichmentConfig);

      const records = await source.tick([{ layerName: 'buildings', enums: [] }]);
      const record = records.get('buildings');

      expect(record?.layerId).toBe(1);
      expect(record?.alias).toBe('Buildings');
      expect(record?.source).toBe('sharedLua');
      expect(record?.propertyAliases.size).toBe(0);
    });

    it('should fetch property aliases from the enrichment API when enabled', async function () {
      const enrichmentConfig: SharedLuaSourceConfig = {
        ...disabledEnrichmentConfig,
        enrichment: {
          enabled: true,
          api: `${ENRICHMENT_ORIGIN}/{layerName}`,
          propertiesPath: 'fields_list',
          aliasField: 'display_name',
          requestTimeoutMilliseconds: 5000,
        },
      };
      nock(ENRICHMENT_ORIGIN)
        .get('/buildings')
        .reply(200, { fields_list: { name: { display_name: 'Name' } } });

      const s3Repository = makeS3Repository(makeLua(makeEntry('1', 'buildings', 'Buildings')));
      const source = new SharedLuaSource(s3Repository, fsRepository, logger, BUCKET, enrichmentConfig);

      const records = await source.tick([{ layerName: 'buildings', enums: [] }]);
      const record = records.get('buildings');

      expect(record?.propertyAliases.get('name')).toBe('Name');
    });
  });

  describe('Sad Path', function () {
    it('should not include a layer absent from the lua file', async function () {
      const s3Repository = makeS3Repository(makeLua(makeEntry('1', 'buildings', 'Buildings')));
      const source = new SharedLuaSource(s3Repository, fsRepository, logger, BUCKET, disabledEnrichmentConfig);

      const records = await source.tick([{ layerName: 'roads', enums: [] }]);

      expect(records.has('roads')).toBe(false);
    });
  });

  describe('Bad Path', function () {
    it('should resolve without property aliases when the enrichment API fails', async function () {
      const enrichmentConfig: SharedLuaSourceConfig = {
        ...disabledEnrichmentConfig,
        enrichment: {
          enabled: true,
          api: `${ENRICHMENT_ORIGIN}/{layerName}`,
          propertiesPath: 'fields_list',
          aliasField: 'display_name',
          requestTimeoutMilliseconds: 5000,
        },
      };
      nock(ENRICHMENT_ORIGIN).get('/buildings').reply(500);

      const s3Repository = makeS3Repository(makeLua(makeEntry('1', 'buildings', 'Buildings')));
      const source = new SharedLuaSource(s3Repository, fsRepository, logger, BUCKET, enrichmentConfig);

      const records = await source.tick([{ layerName: 'buildings', enums: [] }]);
      const record = records.get('buildings');

      expect(record?.layerId).toBe(1);
      expect(record?.propertyAliases.size).toBe(0);
    });
  });
});
