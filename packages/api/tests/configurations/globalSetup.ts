import { Client } from 'pg';
import { createSslOptions } from '@db';
import { getConfig, initConfig } from '@src/common/config';

export default async function setup(): Promise<void> {
  await initConfig(true);
  const dbConfig = getConfig().get('db');

  const pgClient = new Client({ ...dbConfig, user: dbConfig.username, ssl: createSslOptions(dbConfig.ssl) });
  await pgClient.connect();
  await pgClient.query(`DROP TABLE IF EXISTS "${dbConfig.schema}"."enum_value" CASCADE`);
  await pgClient.query(`DROP TABLE IF EXISTS "${dbConfig.schema}"."property" CASCADE`);
  await pgClient.query(`DROP TABLE IF EXISTS "${dbConfig.schema}"."layer" CASCADE`);
  await pgClient.query(`DROP TYPE IF EXISTS "${dbConfig.schema}"."column_type"`);
  await pgClient.end();
}
