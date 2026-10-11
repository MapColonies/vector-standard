import type { Logger } from '@map-colonies/js-logger';
import { injectable, inject } from 'tsyringe';
import { Repository } from 'typeorm';
import { Layer, LAYER_REPOSITORY_SYMBOL } from '@db';
import type { NamespaceSummary } from '@db';
import { SERVICES } from '@common/constants';

@injectable()
export class NamespaceManager {
  public constructor(
    @inject(LAYER_REPOSITORY_SYMBOL) private readonly repository: Repository<Layer>,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {}

  public async getNamespaces(): Promise<NamespaceSummary[]> {
    this.logger.debug({ msg: 'getting namespaces' });
    return this.repository
      .createQueryBuilder('layer')
      .select('layer.namespace', 'name')
      .distinct(true)
      .orderBy('name', 'ASC')
      .getRawMany<NamespaceSummary>();
  }
}
