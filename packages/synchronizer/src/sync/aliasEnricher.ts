import axios from 'axios';
import type { JsonObject, JsonValue } from 'type-fest';
import { context as contextAPI } from '@opentelemetry/api';
import { startActivePromisifiedSpan } from '@common/tracing/util';
import { SyncAttributes, SyncSpanName } from '@common/tracing/sync';
import type { EnrichmentConfig } from '@src/common/interfaces';
import { CaseInsensitiveMap } from '@src/common/caseInsensitiveMap';

const resolveTemplate = (template: string, vars: Record<string, string>): string => {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
};

export const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
      const { data } = await axios.get<JsonObject>(url);
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
