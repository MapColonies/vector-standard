import axios from 'axios';
import type { JsonObject } from 'type-fest';
import { context as contextAPI } from '@opentelemetry/api';
import { startActivePromisifiedSpan } from '@common/tracing/util';
import { SyncAttributes, SyncSpanName } from '@common/tracing/sync';
import type { EnrichmentConfig } from '@src/common/interfaces';
import { CaseInsensitiveMap } from '@src/common/caseInsensitiveMap';
import { isJsonObject } from './helpers';

const resolveTemplate = (template: string, vars: Record<string, string>): string => {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
};

export const resolvePath = (data: JsonObject, path: string): JsonObject | undefined => {
  return path.split('.').reduce<JsonObject | undefined>((acc, key) => {
    const val = acc?.[key];
    return isJsonObject(val) ? val : undefined;
  }, data);
};

export const fetchPropertyAliases = async (
  layerName: string,
  layerId: number,
  config: Extract<EnrichmentConfig, { enabled: true }>
): Promise<Map<string, string>> => {
  return startActivePromisifiedSpan(
    SyncSpanName.FETCH_ALIASES,
    { [SyncAttributes.LAYER_NAME]: layerName, [SyncAttributes.LAYER_ID]: layerId },
    contextAPI.active(),
    async (span) => {
      const url = resolveTemplate(config.api, { layerName, layerId: String(layerId) });
      span.setAttribute(SyncAttributes.ENRICHMENT_URL, url);
      span.setAttribute(SyncAttributes.ENRICHMENT_TIMEOUT_MILLISECONDS, config.requestTimeoutMilliseconds);

      let data: JsonObject;
      try {
        const response = await axios.get<JsonObject>(url, {
          timeout: config.requestTimeoutMilliseconds,
          signal: AbortSignal.timeout(config.requestTimeoutMilliseconds),
        });
        span.setAttribute(SyncAttributes.ENRICHMENT_STATUS_CODE, response.status);
        data = response.data;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          span.setAttribute(SyncAttributes.ENRICHMENT_ERROR_CODE, err.code ?? 'unknown');
          if (err.response !== undefined) {
            span.setAttribute(SyncAttributes.ENRICHMENT_STATUS_CODE, err.response.status);
          }
        }
        throw err;
      }

      const propertiesMap = resolvePath(data, resolveTemplate(config.propertiesPath, { layerName }));

      const result = new CaseInsensitiveMap();
      Object.entries(propertiesMap ?? {}).forEach(([key, value]) => {
        if (isJsonObject(value)) {
          const alias = value[config.aliasField];
          if (typeof alias === 'string') {
            result.set(key, alias);
          }
        }
      });

      span.setAttribute(SyncAttributes.ALIASES_COUNT, result.size);
      return result;
    }
  );
};
