import type { LayerSpec } from '@db';
import type { Logger } from '@map-colonies/js-logger';
import { injectable, inject } from 'tsyringe';
import { RequestHandler } from 'express';
import { SERVICES } from '@common/constants';
import { LayerManager } from '../models/layerManager';
import { GetLayerByNameParam, GetLayersParam, GetLayersResponse } from '../types/layerTypes';

type GetLayersHandler = RequestHandler<GetLayersParam, GetLayersResponse>;
type GetLayerByNameHandler = RequestHandler<GetLayerByNameParam, LayerSpec>;

@injectable()
export class LayerController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LayerManager) private readonly manager: LayerManager
  ) {}

  public getLayers: GetLayersHandler = async (req, res, next) => {
    const { namespace } = req.params;
    try {
      const layers = await this.manager.getLayers(namespace);
      this.logger.debug({ msg: `got ${layers.length} layers`, namespace });
      return res.json({ layers });
    } catch (error) {
      this.logger.error({ msg: 'failed to get layers', namespace, err: error });
      next(error);
    }
  };

  public getLayerByName: GetLayerByNameHandler = async (req, res, next) => {
    const { namespace, layerName } = req.params;
    try {
      const layer = await this.manager.getLayerSpecByName(namespace, layerName);
      this.logger.debug({ msg: `got layer: ${layerName}`, namespace });
      return res.json(layer);
    } catch (error) {
      this.logger.error({ msg: 'failed to get layer by name', namespace, layerName, err: error });
      next(error);
    }
  };
}
