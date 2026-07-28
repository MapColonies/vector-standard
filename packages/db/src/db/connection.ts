import { readFileSync } from 'node:fs';
import type { DataSource, DataSourceOptions } from 'typeorm';
import type { DependencyContainer, InjectionToken } from 'tsyringe';
import { Property } from '../entities/property';
import { EnumValue } from '../entities/enumValue';
import { Layer } from '../entities/layer';
import type { DbConfig, SslConfig, SslOptions } from '../interfaces';

export const DB_ENTITIES = [Layer, Property, EnumValue];
export const DATA_SOURCE_PROVIDER = Symbol('dataSourceProvider');

export const createDataSourceHealthCheck = (container: DependencyContainer, tokens: InjectionToken<DataSource>[]) => async (): Promise<void> => {
  await Promise.all(
    tokens.map(async (token) => {
      const dataSource = container.resolve<DataSource>(token);
      if (!dataSource.isInitialized) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        throw new Error(`DataSource ${token.toString()} is not initialized`);
      }
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.query('SELECT 1');
      } finally {
        await queryRunner.release();
      }
    })
  );
};

export const createSslOptions = (ssl: SslConfig): SslOptions => {
  if (!ssl.enabled) {
    return false;
  }

  return {
    key: readFileSync(ssl.key),
    cert: readFileSync(ssl.cert),
    ca: ssl.ca !== undefined ? readFileSync(ssl.ca) : undefined,
  };
};

export const createDataSourceOptions = (dbConfig: DbConfig, applicationName: string): DataSourceOptions => {
  const { ssl, ...restConfig } = dbConfig;

  return {
    ...restConfig,
    type: 'postgres' as const,
    applicationName: applicationName,
    entities: DB_ENTITIES,
    ssl: createSslOptions(ssl),
  };
};
