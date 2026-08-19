import type { FactoryFunction, DependencyContainer, InjectionToken } from 'tsyringe';
import { DataSource } from 'typeorm';
import { createDataSourceOptions, createDataSourceHealthCheck, type DbConfig } from '@db';
import type { HealthCheck } from '@godaddy/terminus';
import { DESTINATION_DATA_SOURCE_PROVIDER, DESTINATION_DB_CONFIG_PATH, SERVICE_NAME, SERVICES } from '../constants';
import type { ConfigType } from '../config';

const HEALTHCHECK_TOKENS: InjectionToken<DataSource>[] = [DESTINATION_DATA_SOURCE_PROVIDER];

export const destinationDataSourceFactory: FactoryFunction<DataSource> = (container: DependencyContainer): DataSource => {
  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  const dbConfig: DbConfig = config.get(DESTINATION_DB_CONFIG_PATH);
  return new DataSource(createDataSourceOptions(dbConfig, SERVICE_NAME));
};

export const healthCheckFactory: FactoryFunction<HealthCheck> = (container: DependencyContainer): HealthCheck =>
  createDataSourceHealthCheck(container, HEALTHCHECK_TOKENS);
