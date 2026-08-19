/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { jsLogger } from '@map-colonies/js-logger';
import type { Logger } from '@map-colonies/js-logger';
import { PerLayerJsonSource } from '@src/sync/layerSource/perLayerJsonSource';
import type { FileDownloader } from '@src/sync/layerSource/types';
import { FsRepository } from '@src/common/fs/fsRepository';
import type { PerLayerJsonSourceConfig } from '@src/common/interfaces';

const BUCKET = 'test-bucket';

const config: PerLayerJsonSourceConfig = {
  type: 'perLayerJson',
  prefix: '',
  aliasLayerNameField: 'alias_layer_name',
  fieldsField: 'fields',
  fieldNameField: 'field_name',
  aliasFieldNameField: 'alias_field_name',
};

describe('PerLayerJsonSource', function () {
  let tmpDir: string;
  let logger: Logger;
  let fsRepository: FsRepository;

  const makeS3Repository = (key: string, content: string): { s3Repository: FileDownloader; downloadFile: ReturnType<typeof vi.fn> } => {
    const filePath = join(tmpDir, 'downloaded.json');
    writeFileSync(filePath, content);
    const downloadFile = vi.fn().mockImplementation((_bucket: string, requestedKey: string) => {
      if (requestedKey !== key) {
        throw new Error('unexpected key');
      }
      return filePath;
    });
    return { s3Repository: { downloadFile }, downloadFile };
  };

  beforeAll(async function () {
    logger = await jsLogger({ enabled: false });
    fsRepository = new FsRepository(logger);
  });

  beforeEach(function () {
    tmpDir = mkdtempSync(join(tmpdir(), 'per-layer-json-source-test-'));
  });

  afterEach(function () {
    rmSync(tmpDir, { recursive: true });
  });

  describe('Happy Path', function () {
    it('should resolve a layer alias and case-insensitive property aliases', async function () {
      const { s3Repository } = makeS3Repository(
        'BUILDINGS.json',
        JSON.stringify({
          alias_layer_name: 'Buildings',
          fields: [{ field_name: 'PROPERTY', alias_field_name: 'Property Alias' }],
        })
      );
      const source = new PerLayerJsonSource(s3Repository, fsRepository, logger, BUCKET, config);

      const records = await source.tick([{ layerName: 'buildings', enums: [], sourceKey: 'BUILDINGS.json' }]);
      const record = records.get('buildings');

      expect(record?.alias).toBe('Buildings');
      expect(record?.layerId).toBeUndefined();
      expect(record?.source).toBe('perLayerJson');
      expect(record?.propertyAliases.get('property')).toBe('Property Alias');
    });

    it('should prepend the configured prefix to the sourceKey', async function () {
      const prefixedConfig: PerLayerJsonSourceConfig = { ...config, prefix: 'layers/' };
      const { s3Repository } = makeS3Repository('layers/BUILDINGS.json', JSON.stringify({ alias_layer_name: 'Buildings', fields: [] }));
      const source = new PerLayerJsonSource(s3Repository, fsRepository, logger, BUCKET, prefixedConfig);

      const records = await source.tick([{ layerName: 'buildings', enums: [], sourceKey: 'BUILDINGS.json' }]);

      expect(records.get('buildings')?.alias).toBe('Buildings');
    });

    it('should ignore fields with no matching field_name or alias_field_name', async function () {
      const { s3Repository } = makeS3Repository(
        'BUILDINGS.json',
        JSON.stringify({
          alias_layer_name: 'Buildings',
          fields: [{ field_name: 'PROPERTY' }, { alias_field_name: 'Orphan Alias' }, 'not-an-object'],
        })
      );
      const source = new PerLayerJsonSource(s3Repository, fsRepository, logger, BUCKET, config);

      const records = await source.tick([{ layerName: 'buildings', enums: [], sourceKey: 'BUILDINGS.json' }]);

      expect(records.get('buildings')?.propertyAliases.size).toBe(0);
    });
  });

  describe('Sad Path', function () {
    it('should skip and warn when the layer has no sourceKey', async function () {
      const { s3Repository, downloadFile } = makeS3Repository('BUILDINGS.json', '{}');
      const source = new PerLayerJsonSource(s3Repository, fsRepository, logger, BUCKET, config);

      const records = await source.tick([{ layerName: 'buildings', enums: [] }]);

      expect(records.has('buildings')).toBe(false);
      expect(downloadFile).not.toHaveBeenCalled();
    });

    it('should skip a layer whose object is missing from S3', async function () {
      const downloadFile = vi.fn().mockRejectedValue(new Error('NoSuchKey'));
      const s3Repository: FileDownloader = { downloadFile };
      const source = new PerLayerJsonSource(s3Repository, fsRepository, logger, BUCKET, config);

      const records = await source.tick([{ layerName: 'buildings', enums: [], sourceKey: 'MISSING.json' }]);

      expect(records.has('buildings')).toBe(false);
    });
  });

  describe('Bad Path', function () {
    it('should skip a layer with unparseable JSON', async function () {
      const { s3Repository } = makeS3Repository('BUILDINGS.json', 'not json');
      const source = new PerLayerJsonSource(s3Repository, fsRepository, logger, BUCKET, config);

      const records = await source.tick([{ layerName: 'buildings', enums: [], sourceKey: 'BUILDINGS.json' }]);

      expect(records.has('buildings')).toBe(false);
    });

    it('should skip a layer missing required fields', async function () {
      const { s3Repository } = makeS3Repository('BUILDINGS.json', JSON.stringify({ fields: [] }));
      const source = new PerLayerJsonSource(s3Repository, fsRepository, logger, BUCKET, config);

      const records = await source.tick([{ layerName: 'buildings', enums: [], sourceKey: 'BUILDINGS.json' }]);

      expect(records.has('buildings')).toBe(false);
    });
  });
});
