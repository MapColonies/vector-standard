import { readPackageJsonSync } from '@map-colonies/read-pkg';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

export const HEALTHCHECK = Symbol('HealthCheck');
export const ON_SIGNAL = Symbol('onSignal');

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METRICS: Symbol('METRICS'),
} satisfies Record<string, symbol>;
/* eslint-enable @typescript-eslint/naming-convention */
