// this import must be called before the first import of tsyringe
import 'reflect-metadata';
import { createServer } from 'node:http';
import { type Logger } from '@map-colonies/js-logger';
import type { DependencyContainer } from 'tsyringe';
import { createTerminus } from '@godaddy/terminus';
import { HEALTHCHECK, ON_SIGNAL, SERVICES } from '@common/constants';
import { type ConfigType } from '@common/config';
import { getApp } from './app';

let depContainer: DependencyContainer | undefined;

void getApp()
  .then(([app, depContainer]) => {
    const logger = depContainer.resolve<Logger>(SERVICES.LOGGER);
    const config = depContainer.resolve<ConfigType>(SERVICES.CONFIG);
    const port = config.get('server.port');

    const server = createTerminus(createServer(app), {
      healthChecks: { '/liveness': depContainer.resolve(HEALTHCHECK) },
      onSignal: depContainer.resolve(ON_SIGNAL),
    });

    server.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });
  })
  .catch(async (error: Error) => {
    console.error('😢 - failed initializing the server');
    console.error(error);

    if (depContainer?.isRegistered(ON_SIGNAL) == true) {
      const shutDown: () => Promise<void> = depContainer.resolve(ON_SIGNAL);
      await shutDown();
    }

    process.exit(1);
  });
