import type { LayerSpec } from '@db';
import type { Logger } from '@map-colonies/js-logger';
import { injectable, inject } from 'tsyringe';
import { RequestHandler } from 'express';
import { SERVICES } from '@common/constants';
import { LayerManager } from '../models/layerManager';
import { GetLayerByNameParam, GetLayersResponse } from '../types/layerTypes';

type GetLayersHandler = RequestHandler<undefined, GetLayersResponse>;
type GetLayerByNameHandler = RequestHandler<GetLayerByNameParam, LayerSpec>;

@injectable()
export class LayerController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LayerManager) private readonly manager: LayerManager
  ) {}

  public getLayers: GetLayersHandler = async (req, res, next) => {
    try {
      const layers = await this.manager.getLayers();
      this.logger.debug({ msg: `got ${layers.length} layers` });
      return res.json({ layers });
    } catch (error) {
      this.logger.error({ msg: 'failed to get layers', err: error });
      next(error);
    }
  };

  public getLayerByName: GetLayerByNameHandler = async (req, res, next) => {
    const { layerName } = req.params;
    try {
      const layer = await this.manager.getLayerSpecByName(layerName);
      this.logger.debug({ msg: `got layer: ${layerName}` });
      return res.json(layer);
    } catch (error) {
      this.logger.error({ msg: 'failed to get layer by name', layerName, err: error });
      next(error);
    }
  };
}
