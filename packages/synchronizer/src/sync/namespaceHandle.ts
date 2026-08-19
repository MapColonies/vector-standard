import type { Logger } from '@map-colonies/js-logger';
import type { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { DataSource } from 'typeorm';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import { createDataSourceOptions } from '@db';
import type { NamespaceConfig } from '@common/interfaces';
import { SERVICE_NAME, SOURCE_DATA_SOURCE_PROVIDER } from '@common/constants';
import type { S3Repository } from '@common/s3/s3Repository';
import type { FsRepository } from '@common/fs/fsRepository';
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

export const buildNamespaceHandle = (
  parent: DependencyContainer,
  namespaceConfig: NamespaceConfig,
  s3Repository: S3Repository,
  fsRepository: FsRepository,
  logger: Logger,
  cleanupRegistry: CleanupRegistry
): NamespaceHandle => {
  const child = parent.createChildContainer();
  const sourceDataSource = new DataSource(createDataSourceOptions(namespaceConfig.db, `${SERVICE_NAME}-${namespaceConfig.name}`));
  child.register(SOURCE_DATA_SOURCE_PROVIDER, { useValue: sourceDataSource });

  const layerSource = createLayerSourceStrategy(namespaceConfig, s3Repository, fsRepository, logger);
  const dal = child.resolve(SyncModel);

  cleanupRegistry.register({
    id: `${SOURCE_DATA_SOURCE_PROVIDER.toString()}:${namespaceConfig.name}`,
    func: async () => {
      if (sourceDataSource.isInitialized) {
        await sourceDataSource.destroy();
      }
    },
  });

  return { name: namespaceConfig.name, sourceDataSource, layerSource, layersFile: namespaceConfig.layersFile, dal };
};
