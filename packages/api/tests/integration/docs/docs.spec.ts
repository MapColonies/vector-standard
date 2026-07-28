import { jsLogger } from '@map-colonies/js-logger';
import { describe, beforeEach, it, expect, beforeAll, vi } from 'vitest';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { DATA_SOURCE_PROVIDER, LAYER_REPOSITORY_SYMBOL, PROPERTY_REPOSITORY_SYMBOL } from '@map-colonies/vector-standard-db';
import { getApp } from '@src/app';
import { SERVICES } from '@src/common/constants';
import { initConfig } from '@src/common/config';
import { DocsRequestSender } from './helpers/docsRequestSender';

describe('docs', function () {
  let requestSender: DocsRequestSender;

  beforeAll(async function () {
    await initConfig(true);
  });

  beforeEach(async function () {
    const [app] = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        { token: DATA_SOURCE_PROVIDER, provider: { useValue: { isInitialized: true, destroy: vi.fn().mockResolvedValue(undefined) } } },
        { token: LAYER_REPOSITORY_SYMBOL, provider: { useValue: {} } },
        { token: PROPERTY_REPOSITORY_SYMBOL, provider: { useValue: {} } },
      ],
      useChild: true,
    });
    requestSender = new DocsRequestSender(app);
  });

  describe('Happy Path', function () {
    it('should return 200 status code and the resource', async function () {
      const response = await requestSender.getDocs();

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.type).toBe('text/html');
    });

    it('should return 200 status code and the json spec', async function () {
      const response = await requestSender.getDocsJson();

      expect(response.status).toBe(httpStatusCodes.OK);

      expect(response.type).toBe('application/json');
      expect(response.body).toHaveProperty('openapi');
    });
  });
});
