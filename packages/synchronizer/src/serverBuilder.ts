import express from 'express';
import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import { httpLogger } from '@map-colonies/express-access-log-middleware';
import { collectMetricsExpressMiddleware } from '@map-colonies/prometheus';
import { Registry } from 'prom-client';
import { SERVICES } from '@common/constants';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METRICS) private readonly metricsRegistry: Registry
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private registerPreRoutesMiddleware(): void {
    this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry }));
    this.serverInstance.use(httpLogger({ logger: this.logger, ignorePaths: ['/metrics'] }));
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
  }
}
