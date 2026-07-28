import { Client } from 'pg';
import { getConfig, initConfig } from '@src/common/config';
import { createSslOptions } from '../../../db/dist/db/connection';

export default async function setup(): Promise<void> {
  await initConfig(true);
  const { source, destination } = getConfig().get('dbs');

  const pgClient = new Client({ ...destination, user: destination.username, ssl: createSslOptions(destination.ssl) });
  await pgClient.connect();
  await pgClient.query(`DROP SCHEMA IF EXISTS "${destination.schema}" CASCADE`);
  await pgClient.query(`DROP SCHEMA IF EXISTS "${source.schema}" CASCADE`);
  await pgClient.end();
}
