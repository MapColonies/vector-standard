import type { FactoryFunction, DependencyContainer } from 'tsyringe';
import { DataSource } from 'typeorm';
import { createDataSourceOptions, createDataSourceHealthCheck, DATA_SOURCE_PROVIDER } from '@db';
import { type HealthCheck } from '@godaddy/terminus';
import { SERVICE_NAME, SERVICES } from '../constants';
import type { ConfigType } from '../config';

export const dataSourceFactory: FactoryFunction<DataSource> = (container: DependencyContainer): DataSource => {
  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  const dbConfig = config.get('db');
  return new DataSource(createDataSourceOptions(dbConfig, SERVICE_NAME));
};

export const healthCheckFactory: FactoryFunction<HealthCheck> = (container: DependencyContainer): HealthCheck =>
  createDataSourceHealthCheck(container, [DATA_SOURCE_PROVIDER]);
