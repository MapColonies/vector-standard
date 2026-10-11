import type { ConfigType } from './db/config';

export type DbConfig = ReturnType<ConfigType['getAll']>['db'];

export type SslConfig = DbConfig['ssl'];

export type SslOptions = false | { key?: Buffer; cert?: Buffer; ca?: Buffer };
