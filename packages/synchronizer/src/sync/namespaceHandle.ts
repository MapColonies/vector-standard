import type { CleanupRegistry } from '@map-colonies/cleanup-registry';
import type { Logger } from '@map-colonies/js-logger';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import type { DataSource, Repository } from 'typeorm';
import {
  createDataSource,
  ENUMS_REPOSITORY_SYMBOL,
  type EnumValue,
  type Layer,
  LAYER_REPOSITORY_SYMBOL,
  type Property,
  PROPERTY_REPOSITORY_SYMBOL,
} from '@db';
import type { ConfigType } from '@common/config';
import { SERVICES, SERVICE_NAME, SOURCE_DATA_SOURCE_PROVIDER } from '@common/constants';
import { S3Repository } from '@common/s3/s3Repository';
import { FsRepository } from '@common/fs/fsRepository';
import { SyncModel } from './SyncModel';
import { createLayerSourceStrategy } from './layerSource';
import type { LayerSourceStrategy } from './layerSource/types';

export interface NamespaceHandle {
  name: string;
  sourceDataSource: DataSource;
  layerSource: LayerSourceStrategy;
  layersFile: string;
  dal: SyncModel;
}

export const createNamespaceHandles = (container: DependencyContainer, cleanupRegistry: CleanupRegistry): NamespaceHandle[] => {
  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  const logger = container.resolve<Logger>(SERVICES.LOGGER);
  const s3Repository = container.resolve(S3Repository);
  const fsRepository = container.resolve(FsRepository);
  const layerRepository = container.resolve<Repository<Layer>>(LAYER_REPOSITORY_SYMBOL);
  const propertyRepository = container.resolve<Repository<Property>>(PROPERTY_REPOSITORY_SYMBOL);
  const enumsRepository = container.resolve<Repository<EnumValue>>(ENUMS_REPOSITORY_SYMBOL);

  return config.get('namespaces').map((namespaceConfig) => {
    const sourceDataSource = createDataSource(namespaceConfig.db, `${SERVICE_NAME}-${namespaceConfig.name}`);

    cleanupRegistry.register({
      id: `${SOURCE_DATA_SOURCE_PROVIDER.toString()}:${namespaceConfig.name}`,
      func: async () => {
        if (sourceDataSource.isInitialized) {
          await sourceDataSource.destroy();
        }
      },
    });

    const layerSource = createLayerSourceStrategy(namespaceConfig, s3Repository, fsRepository, logger);
    const dal = new SyncModel(config, logger, sourceDataSource, layerRepository, propertyRepository, enumsRepository);

    return { name: namespaceConfig.name, sourceDataSource, layerSource, layersFile: namespaceConfig.layersFile, dal };
  });
};
