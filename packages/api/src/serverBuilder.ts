import express, { Router } from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { middleware as OpenApiMiddleware } from 'express-openapi-validator';
import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import { httpLogger } from '@map-colonies/express-access-log-middleware';
import { collectMetricsExpressMiddleware } from '@map-colonies/prometheus';
import { Registry } from 'prom-client';
import { SERVICES } from '@common/constants';
import { LAYER_ROUTER_SYMBOL } from './layer/routes/layer';
import { NAMESPACE_ROUTER_SYMBOL } from './namespace/routes/namespace';
import { DOCS_ROUTER_SYMBOL } from './docs/routes/docs';
import { ConfigType } from './common/config';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METRICS) private readonly metricsRegistry: Registry,
    @inject(LAYER_ROUTER_SYMBOL) private readonly layerRouter: Router,
    @inject(NAMESPACE_ROUTER_SYMBOL) private readonly namespaceRouter: Router,
    @inject(DOCS_ROUTER_SYMBOL) private readonly docsRouter: Router
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.buildRoutes();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private buildRoutes(): void {
    this.serverInstance.use('/namespaces', this.namespaceRouter);
    this.serverInstance.use('/namespaces', this.layerRouter);
    this.serverInstance.use(this.config.get('openapiConfig.basePath'), this.docsRouter);
  }

  private registerPreRoutesMiddleware(): void {
    this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry }));
    this.serverInstance.use(httpLogger({ logger: this.logger, ignorePaths: ['/metrics'] }));

    if (this.config.get('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get('server.response.compression.options') as unknown as compression.CompressionFilter));
    }

    this.serverInstance.use(bodyParser.json(this.config.get('server.request.payload')));

    const ignorePathRegex = new RegExp(`^${this.config.get('openapiConfig.basePath')}/.*`, 'i');
    const apiSpecPath = this.config.get('openapiConfig.filePath');
    this.serverInstance.use(
      OpenApiMiddleware({ apiSpec: apiSpecPath, validateRequests: true, validateSecurity: false, ignorePaths: ignorePathRegex })
    );
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
  }
}
