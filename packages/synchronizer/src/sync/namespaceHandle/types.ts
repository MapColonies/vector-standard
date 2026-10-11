import type { Logger } from '@map-colonies/js-logger';
import type { DataSource, Repository } from 'typeorm';
import type { EnumValue, Layer, Property } from '@db';
import type { ConfigType } from '@common/config';
import type { S3Repository } from '@common/s3/s3Repository';
import type { FsRepository } from '@common/fs/fsRepository';
import type { SyncModel } from '../SyncModel';
import type { LayerSourceStrategy } from '../layerSource/types';

export interface NamespaceHandle {
  name: string;
  sourceDataSource: DataSource;
  layerSource: LayerSourceStrategy;
  layersFile: string;
  dal: SyncModel;
}

export interface NamespaceHandleDependencies {
  config: ConfigType;
  logger: Logger;
  s3Repository: S3Repository;
  fsRepository: FsRepository;
  layerRepository: Repository<Layer>;
  propertyRepository: Repository<Property>;
  enumsRepository: Repository<EnumValue>;
}
