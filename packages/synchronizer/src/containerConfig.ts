import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import type { Logger } from '@map-colonies/js-logger';
import { jsLogger } from '@map-colonies/js-logger';
import { instancePerContainerCachingFactory } from 'tsyringe';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import type { DataSource, Repository } from 'typeorm';
import type { HealthCheck } from '@godaddy/terminus';
import { DATA_SOURCE_PROVIDER as DESTINATION_DATA_SOURCE_PROVIDER, createDataSource, createDataSourceHealthCheck } from '@db';
import type { S3Client } from '@aws-sdk/client-s3';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { type ConfigType, getConfig } from '@common/config';
import { type InjectionObject, registerDependencies } from '@common/dependencyRegistration';
import { DESTINATION_DB_CONFIG_PATH, HEALTHCHECK, NAMESPACE_HANDLES, ON_SIGNAL, REPOSITORIES, SERVICES, SERVICE_NAME } from '@common/constants';
import { getTracing } from '@common/tracing';
import { CRON_MANAGER_SYMBOL, CronManager } from './sync/cron';
import { s3ClientFactory } from './common/s3';
import { S3Repository } from './common/s3/s3Repository';
import { FsRepository } from './common/fs/fsRepository';
import { buildNamespaceHandle } from './sync/namespaceHandle';

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
      {
        token: S3Repository,
        provider: { useFactory: instancePerContainerCachingFactory((container) => container.resolve(S3Repository)) },
        postInjectionHook: (deps: DependencyContainer): void => {
          const s3Repository = deps.resolve(S3Repository);
          deps.register(S3Repository, { useValue: s3Repository });
        },
      },
      {
        token: DESTINATION_DATA_SOURCE_PROVIDER,
        provider: {
          useFactory: instancePerContainerCachingFactory((container) => {
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            return createDataSource(config.get(DESTINATION_DB_CONFIG_PATH), SERVICE_NAME);
          }),
        },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const dataSource = deps.resolve<DataSource>(DESTINATION_DATA_SOURCE_PROVIDER);

          if (!dataSource.isInitialized) {
            await dataSource.initialize();
          }

          deps.register(DESTINATION_DATA_SOURCE_PROVIDER, { useValue: dataSource });

          cleanupRegistry.register({
            id: DESTINATION_DATA_SOURCE_PROVIDER,
            func: dataSource.destroy.bind(dataSource),
          });
        },
      },
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
        token: NAMESPACE_HANDLES,
        provider: {
          useFactory: instancePerContainerCachingFactory((container) => {
            const config = container.resolve<ConfigType>(SERVICES.CONFIG);
            const logger = container.resolve<Logger>(SERVICES.LOGGER);
            const s3Repository = container.resolve(S3Repository);
            const fsRepository = container.resolve(FsRepository);
            return config
              .get('namespaces')
              .map((namespaceConfig) => buildNamespaceHandle(container, namespaceConfig, s3Repository, fsRepository, logger, cleanupRegistry));
          }),
        },
      },
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
          useFactory: (container: DependencyContainer): HealthCheck => createDataSourceHealthCheck(container, [DESTINATION_DATA_SOURCE_PROVIDER]),
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
