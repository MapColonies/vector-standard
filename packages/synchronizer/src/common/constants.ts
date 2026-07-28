import { readPackageJsonSync } from '@map-colonies/read-pkg';
import {
  DATA_SOURCE_PROVIDER as DESTINATION_DATA_SOURCE_PROVIDER,
  ENUMS_REPOSITORY_SYMBOL,
  EnumValue,
  Layer,
  LAYER_REPOSITORY_SYMBOL,
  Property,
  PROPERTY_REPOSITORY_SYMBOL,
} from '@db';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];
export const ON_SIGNAL = Symbol('OnSignal');
export const SOURCE_DATA_SOURCE_PROVIDER = Symbol('SourceDataSourceProvider');

export const HEALTHCHECK = Symbol('HealthCheck');

export const s3ConfigPath = 'dbs.s3';

export const DB_CONFIGS = [
  { configKey: 'dbs.source', token: SOURCE_DATA_SOURCE_PROVIDER },
  { configKey: 'dbs.destination', token: DESTINATION_DATA_SOURCE_PROVIDER },
] as const;

export const REPOSITORIES = [
  { entity: Layer, token: LAYER_REPOSITORY_SYMBOL },
  { entity: Property, token: PROPERTY_REPOSITORY_SYMBOL },
  { entity: EnumValue, token: ENUMS_REPOSITORY_SYMBOL },
] as const;

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  S3_CLIENT: Symbol('S3Client'),
  TRACER: Symbol('Tracer'),
  METRICS: Symbol('METRICS'),
  CLEANUP_REGISTRY: Symbol('CleanupRegistry'),
} satisfies Record<string, symbol>;
/* eslint-enable @typescript-eslint/naming-convention */
