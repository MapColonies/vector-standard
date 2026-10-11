import { Client } from 'pg';
import { getConfig, initConfig } from '@src/common/config';
import { createSslOptions } from '../../../db/dist/db/connection';

export default async function setup(): Promise<void> {
  await initConfig(true);
  const config = getConfig();
  const destination = config.get('dbs.destination');
  const namespaces = config.get('namespaces');

  const pgClient = new Client({ ...destination, user: destination.username, ssl: createSslOptions(destination.ssl) });
  await pgClient.connect();
  await pgClient.query(`DROP SCHEMA IF EXISTS "${destination.schema}" CASCADE`);
  for (const namespace of namespaces) {
    await pgClient.query(`DROP SCHEMA IF EXISTS "${namespace.db.schema}" CASCADE`);
  }
  await pgClient.end();
}
