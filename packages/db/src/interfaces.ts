import type { DataSourceOptions } from 'typeorm';
import type { ConfigType } from './db/config';

export type DbConfig = ReturnType<ConfigType['getAll']>['db'];

export type SslConfig = DbConfig['ssl'];

export type SslOptions = Extract<DataSourceOptions, { type: 'postgres' }>['ssl'];
