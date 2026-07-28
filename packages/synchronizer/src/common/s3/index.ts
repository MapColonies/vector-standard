import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import type { Logger } from '@map-colonies/js-logger';
import type { DependencyContainer, FactoryFunction } from 'tsyringe';
import { s3ConfigPath, SERVICES } from '../constants';
import type { ConfigType } from '../config';
import type { S3Config } from './interfaces';

const createConnectionOptions = (clientOptions: S3Config): S3ClientConfig => {
  const { accessKeyId, secretAccessKey, ...rest } = clientOptions;

  return {
    ...rest,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
};

const initS3Client = (clientOptions: S3Config): S3Client => {
  const client = new S3Client(createConnectionOptions(clientOptions));
  return client;
};

export const s3ClientFactory: FactoryFunction<S3Client> = (container: DependencyContainer): S3Client => {
  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  const logger = container.resolve<Logger>(SERVICES.LOGGER);

  const s3Config = config.get(s3ConfigPath);

  const client = initS3Client(s3Config);
  logger.debug(`S3 Client is configured`);

  return client;
};
