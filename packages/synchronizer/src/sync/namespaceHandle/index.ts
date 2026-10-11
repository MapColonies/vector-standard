import { createDataSource } from '@db';
import { SERVICE_NAME } from '@common/constants';
import { SyncModel } from '../SyncModel';
import { createLayerSourceStrategy } from '../layerSource';
import type { NamespaceHandle, NamespaceHandleDependencies } from './types';

export const createNamespaceHandles = (dependencies: NamespaceHandleDependencies): NamespaceHandle[] => {
  const { config, logger, s3Repository, fsRepository, layerRepository, propertyRepository, enumsRepository } = dependencies;

  return config.get('namespaces').map((namespaceConfig) => {
    const sourceDataSource = createDataSource(namespaceConfig.db, `${SERVICE_NAME}-${namespaceConfig.name}`);
    const layerSource = createLayerSourceStrategy(namespaceConfig, s3Repository, fsRepository, logger);
    const dal = new SyncModel(config, logger, sourceDataSource, layerRepository, propertyRepository, enumsRepository);

    return { name: namespaceConfig.name, sourceDataSource, layerSource, layersFile: namespaceConfig.layersFile, dal };
  });
};
