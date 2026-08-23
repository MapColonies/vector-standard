import { readPackageJsonSync } from '@map-colonies/read-pkg';
import type { PublicPath } from './interfaces';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

export const PREFIX_HEADER = 'x-forwarded-prefix';
export const ROOT_HEADER = 'x-gateway-root';
export const NAMESPACE_PARAM_REF = '#/components/parameters/NamespaceParam';

export const PUBLIC_PATHS = new Map<string, PublicPath>([
  ['/namespaces', { path: '/namespaces', scope: 'root' }],
  ['/namespaces/{namespace}/layers', { path: '/', scope: 'namespaced' }],
  ['/namespaces/{namespace}/layers/{layerName}', { path: '/{layerName}', scope: 'namespaced' }],
]);

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
