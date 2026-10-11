import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import { jsLogger, type Logger } from '@map-colonies/js-logger';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { DATA_SOURCE_PROVIDER, Layer, LAYER_REPOSITORY_SYMBOL, createDataSource, createDataSourceHealthCheck } from '@db';
import type { HealthCheck } from '@godaddy/terminus';
import type { Repository, DataSource } from 'typeorm';
import { instancePerContainerCachingFactory } from 'tsyringe';
import { type InjectionObject, registerDependencies } from '@common/dependencyRegistration';
import { HEALTHCHECK, ON_SIGNAL, OPENAPI_SPEC, SERVICES, SERVICE_NAME } from '@common/constants';
import { loadSpec } from '@common/openapi';
import type { OpenapiSpec } from '@common/interfaces';
import { getTracing } from '@common/tracing';
import { LAYER_ROUTER_SYMBOL, layerRouterFactory } from './layer/routes/layer';
import { NAMESPACE_ROUTER_SYMBOL, namespaceRouterFactory } from './namespace/routes/namespace';
import { DOCS_ROUTER_SYMBOL, docsRouterFactory } from './docs/routes/docs';
import { type ConfigType, getConfig } from './common/config';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const cleanupRegistry = new CleanupRegistry();
  try {
    const dependencies: InjectionObject<unknown>[] = [
      { token: SERVICES.CONFIG, provider: { useValue: getConfig() } },
      {
        token: SERVICES.LOGGER,
        provider: {
          useFactory: instancePerContainerCachingFactory(async (container) => {
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            const loggerConfig = config.get('telemetry.logger');
            return jsLogger({ ...loggerConfig, mixin: getOtelMixin() });
          }),
        },
        postInjectionHook: async (container: DependencyContainer): Promise<void> => {
          const logger = await container.resolve<Promise<Logger>>(SERVICES.LOGGER);
          container.register(SERVICES.LOGGER, { useValue: logger });
        },
      },
      {
        token: SERVICES.TRACER,
        provider: {
          useFactory: instancePerContainerCachingFactory(() => {
            cleanupRegistry.register({ id: SERVICES.TRACER, func: getTracing().stop.bind(getTracing()) });
            const tracer = trace.getTracer(SERVICE_NAME);
            return tracer;
          }),
        },
      },
      {
        token: SERVICES.METRICS,
        provider: {
          useFactory: instancePerContainerCachingFactory((container) => {
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            const metricsRegistry = new Registry();
            config.initializeMetrics(metricsRegistry);
            return metricsRegistry;
          }),
        },
      },
      {
        token: ON_SIGNAL,
        provider: {
          useValue: cleanupRegistry.trigger.bind(cleanupRegistry),
        },
      },
      {
        token: OPENAPI_SPEC,
        provider: {
          useFactory: instancePerContainerCachingFactory((container): OpenapiSpec => {
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            return loadSpec(config.get('openapiConfig.filePath'));
          }),
        },
      },
      { token: LAYER_ROUTER_SYMBOL, provider: { useFactory: layerRouterFactory } },
      { token: NAMESPACE_ROUTER_SYMBOL, provider: { useFactory: namespaceRouterFactory } },
      { token: DOCS_ROUTER_SYMBOL, provider: { useFactory: docsRouterFactory } },
      {
        token: LAYER_REPOSITORY_SYMBOL,
        provider: {
          useFactory(container): Repository<Layer> {
            const dataSource = container.resolve<DataSource>(DATA_SOURCE_PROVIDER);
            return dataSource.getRepository(Layer);
          },
        },
      },
      {
        token: DATA_SOURCE_PROVIDER,
        provider: {
          useFactory: instancePerContainerCachingFactory((container) => {
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            return createDataSource(config.get('db'), SERVICE_NAME);
          }),
        },
        postInjectionHook: async (container: DependencyContainer): Promise<void> => {
          const dataSource = container.resolve<DataSource>(DATA_SOURCE_PROVIDER);

          if (!dataSource.isInitialized) {
            await dataSource.initialize();
          }

          cleanupRegistry.register({
            id: DATA_SOURCE_PROVIDER,
            func: dataSource.destroy.bind(dataSource),
          });
        },
      },
      {
        token: HEALTHCHECK,
        provider: {
          useFactory: (container: DependencyContainer): HealthCheck => createDataSourceHealthCheck(container, [DATA_SOURCE_PROVIDER]),
        },
      },
    ];

    const container = await registerDependencies(dependencies, options?.override, options?.useChild);
    return container;
  } catch (error) {
    await cleanupRegistry.trigger();
    throw error;
  }
};
