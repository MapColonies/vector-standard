/* eslint-disable @typescript-eslint/naming-convention */
import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import nock, { disableNetConnect, enableNetConnect, cleanAll } from 'nock';
import { fetchPropertyAliases } from '@src/sync/aliasEnricher';
import { type ConfigType, getConfig, initConfig } from '@src/common/config';

const ENRICHMENT_ORIGIN = 'https://example.com';

const makeBody = (fields: Record<string, { display_name: string; type: string }>) => ({
  display_name: 'Layer',
  name: 'layer',
  fields_list: fields,
});

describe('fetchPropertyAliases', function () {
  let enrichmentConfig: ReturnType<ConfigType['getAll']>['enrichment'] & { enabled: true };

  beforeAll(async function () {
    await initConfig(true);
    enrichmentConfig = getConfig().get('enrichmentApi');
    disableNetConnect();
  });

  beforeEach(function () {
    cleanAll();
  });

  afterEach(function () {
    cleanAll();
  });

  afterAll(function () {
    enableNetConnect();
  });

  describe('Happy Path', function () {
    it('should call the API once with the layer name substituted into the URL', async function () {
      const scope = nock(ENRICHMENT_ORIGIN).get('/buildings').reply(200, makeBody({}));

      await fetchPropertyAliases('buildings', 1, getConfig().get('enrichmentApi'));

      expect(scope.isDone()).toBe(true);
    });

    it('should navigate a nested propertiesPath using dot notation', async function () {
      nock(ENRICHMENT_ORIGIN)
        .get('/buildings')
        .reply(200, { wrapper: { fields_list: { IS_DELETED: { display_name: 'Is Deleted', type: 'BOOLEAN' } } } });

      const result = await fetchPropertyAliases('buildings', 1, { ...enrichmentConfig, propertiesPath: 'wrapper.fields_list' });

      expect(result.get('IS_DELETED')).toBe('Is Deleted');
    });
  });

  describe('Bad Path', function () {
    it('should skip entries where the alias field is absent', async function () {
      nock(ENRICHMENT_ORIGIN)
        .get('/buildings')
        .reply(200, {
          fields_list: {
            IS_DELETED: { display_name: 'Is Deleted', type: 'BOOLEAN' },
            NO_ALIAS: { type: 'TEXT' },
          },
        });

      const result = await fetchPropertyAliases('buildings', 1, enrichmentConfig);

      expect(result.size).toBe(1);
      expect(result.has('NO_ALIAS')).toBe(false);
    });
  });
});
