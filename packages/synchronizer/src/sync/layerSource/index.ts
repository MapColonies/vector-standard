import type { Logger } from '@map-colonies/js-logger';
import type { NamespaceConfig } from '@common/interfaces';
import type { S3Repository } from '@common/s3/s3Repository';
import type { FsRepository } from '@common/fs/fsRepository';
import { SharedLuaSource } from './sharedLuaSource';
import { PerLayerJsonSource } from './perLayerJsonSource';
import type { LayerSourceStrategy } from './types';

export const createLayerSourceStrategy = (
  namespaceConfig: NamespaceConfig,
  s3Repository: S3Repository,
  fsRepository: FsRepository,
  logger: Logger
): LayerSourceStrategy => {
  const { layerSource, bucket } = namespaceConfig;
  if (layerSource.type === 'sharedLua') {
    return new SharedLuaSource(s3Repository, fsRepository, logger, bucket, layerSource);
  }
  return new PerLayerJsonSource(s3Repository, fsRepository, logger, bucket, layerSource);
};
