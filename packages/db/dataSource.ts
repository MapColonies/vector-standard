import { DataSource } from 'typeorm';
import { initConfig, getConfig } from './src/db/config';
import { createDataSourceOptions } from './src/db/connection';

const SERVICE_NAME = 'vector-standard-api/db';

const dataSourceFactory = async (): Promise<DataSource> => {
  await initConfig(true);
  const config = getConfig();
  const connectionOptions = config.get('db');

  const appDataSource = new DataSource({
    ...createDataSourceOptions(connectionOptions, SERVICE_NAME),
    entities: ['src/entities/*.ts'],
    migrationsTableName: 'migrations_table',
    migrations: ['src/migrations/*.ts'],
  });

  return appDataSource;
};

export default dataSourceFactory();
