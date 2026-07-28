import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import type { Logger } from '@map-colonies/js-logger';
import { jsLogger } from '@map-colonies/js-logger';
import { instancePerContainerCachingFactory } from 'tsyringe';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import type { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE_PROVIDER as DESTINATION_DATA_SOURCE_PROVIDER } from '@db';
import type { S3Client } from '@aws-sdk/client-s3';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { type ConfigType, getConfig } from '@common/config';
import { type InjectionObject, registerDependencies } from '@common/dependencyRegistration';
import { DB_CONFIGS, HEALTHCHECK, ON_SIGNAL, REPOSITORIES, SERVICES, SERVICE_NAME } from '@common/constants';
import { getTracing } from '@common/tracing';
import { createDataSourceFactory, healthCheckFactory } from './common/db/connection';
import { CRON_MANAGER_SYMBOL, CronManager } from './sync/cron';
import { s3ClientFactory } from './common/s3';

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
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const logger = await deps.resolve<Promise<Logger>>(SERVICES.LOGGER);
          deps.register(SERVICES.LOGGER, { useValue: logger });
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
        token: SERVICES.CLEANUP_REGISTRY,
        provider: { useValue: cleanupRegistry },
      },
      {
        token: ON_SIGNAL,
        provider: {
          useValue: cleanupRegistry.trigger.bind(cleanupRegistry),
        },
      },
      {
        token: SERVICES.S3_CLIENT,
        provider: { useFactory: instancePerContainerCachingFactory(s3ClientFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const s3Client = deps.resolve<S3Client>(SERVICES.S3_CLIENT);
          const logger = deps.resolve<Logger>(SERVICES.LOGGER);
          try {
            await s3Client.send(new ListBucketsCommand({}));
            logger.info('Connected to S3');
          } catch (err) {
            logger.error({ msg: 'Failed to connect to S3', err });
          }
          cleanupRegistry.register({
            id: SERVICES.S3_CLIENT,
            func: async () => Promise.resolve(s3Client.destroy.bind(s3Client)),
          });
        },
      },
      ...DB_CONFIGS.map(({ configKey, token }) => {
        return {
          token,
          provider: {
            useFactory: instancePerContainerCachingFactory(createDataSourceFactory(configKey)),
          },
          postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
            const dataSource = deps.resolve<DataSource>(token);

            if (!dataSource.isInitialized) {
              await dataSource.initialize();
            }

            cleanupRegistry.register({
              id: token,
              func: dataSource.destroy.bind(dataSource),
            });
          },
        };
      }),
      ...REPOSITORIES.map(({ token, entity }) => ({
        token,
        provider: {
          useFactory(container: DependencyContainer): Repository<object> {
            const dataSource = container.resolve<DataSource>(DESTINATION_DATA_SOURCE_PROVIDER);
            return dataSource.getRepository(entity);
          },
        },
      })),
      {
        token: CRON_MANAGER_SYMBOL,
        provider: { useClass: CronManager },
        postInjectionHook: (deps: DependencyContainer): void => {
          const cronManager = deps.resolve(CronManager);
          cronManager.start();
          cleanupRegistry.register({
            id: 'cronManager',
            func: cronManager.stop.bind(cronManager),
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
