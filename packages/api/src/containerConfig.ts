import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import { jsLogger, type Logger } from '@map-colonies/js-logger';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { DATA_SOURCE_PROVIDER, Layer, LAYER_REPOSITORY_SYMBOL } from '@db';
import type { Repository, DataSource } from 'typeorm';
import { instancePerContainerCachingFactory } from 'tsyringe';
import { type InjectionObject, registerDependencies } from '@common/dependencyRegistration';
import { HEALTHCHECK, ON_SIGNAL, SERVICES, SERVICE_NAME } from '@common/constants';
import { getTracing } from '@common/tracing';
import { LAYER_ROUTER_SYMBOL, layerRouterFactory } from './layer/routes/layer';
import { dataSourceFactory, healthCheckFactory } from './common/db/connection';
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
      { token: LAYER_ROUTER_SYMBOL, provider: { useFactory: layerRouterFactory } },
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
          useFactory: instancePerContainerCachingFactory(dataSourceFactory),
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
          useFactory: healthCheckFactory,
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
