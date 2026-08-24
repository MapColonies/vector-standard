import type { Logger } from '@map-colonies/js-logger';
import { injectable, inject } from 'tsyringe';
import { RequestHandler } from 'express';
import { SERVICES } from '@common/constants';
import { NamespaceManager } from '../models/namespaceManager';
import { GetNamespacesResponse } from '../types/namespaceTypes';

type GetNamespacesHandler = RequestHandler<undefined, GetNamespacesResponse>;

@injectable()
export class NamespaceController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(NamespaceManager) private readonly manager: NamespaceManager
  ) {}

  public getNamespaces: GetNamespacesHandler = async (req, res, next) => {
    try {
      const namespaces = await this.manager.getNamespaces();
      this.logger.debug({ msg: `got ${namespaces.length} namespaces` });
      return res.json({ namespaces });
    } catch (error) {
      this.logger.error({ msg: 'failed to get namespaces', err: error });
      next(error);
    }
  };
}
