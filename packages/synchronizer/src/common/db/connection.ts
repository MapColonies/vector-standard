import type { FactoryFunction, DependencyContainer } from 'tsyringe';
import { DataSource } from 'typeorm';
import { createDataSourceOptions, createDataSourceHealthCheck, type DbConfig } from '@db';
import type { HealthCheck } from '@godaddy/terminus';
import { DB_CONFIGS, SERVICE_NAME, SERVICES } from '../constants';
import type { ConfigType } from '../config';

type DbConfigKey = (typeof DB_CONFIGS)[number]['configKey'];

export const createDataSourceFactory =
  (configKey: DbConfigKey): FactoryFunction<DataSource> =>
  (container: DependencyContainer): DataSource => {
    const config = container.resolve<ConfigType>(SERVICES.CONFIG);
    const dbConfig: DbConfig = config.get(configKey);
    return new DataSource(createDataSourceOptions(dbConfig, SERVICE_NAME));
  };

export const healthCheckFactory: FactoryFunction<HealthCheck> = (container: DependencyContainer): HealthCheck =>
  createDataSourceHealthCheck(
    container,
    DB_CONFIGS.map(({ token }) => token)
  );
