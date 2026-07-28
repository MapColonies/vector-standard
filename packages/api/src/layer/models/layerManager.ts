import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { Layer, LayerSpec, LAYER_REPOSITORY_SYMBOL } from '@db';
import type { LayerSummary } from '@db';
import { SERVICES } from '@common/constants';
import { NotFoundError } from '@src/common/error';
import { mapProperty } from '@src/common/helpers';

@injectable()
export class LayerManager {
  public constructor(
    @inject(LAYER_REPOSITORY_SYMBOL) private readonly repository: Repository<Layer>,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {}

  public async getLayers(): Promise<LayerSummary[]> {
    this.logger.debug({ msg: 'getting layers' });
    const layers = await this.repository.find({ select: { layerName: true, alias: true } });
    return layers.map(({ layerName, alias }) => ({ layerName, alias }));
  }

  public async getLayerSpecByName(name: string): Promise<LayerSpec> {
    this.logger.debug({ msg: 'getting layer spec by name', name });
    const layer = await this.repository.findOne({
      where: { layerName: name },
      relations: { properties: { possibleValues: true } },
    });
    if (!layer) {
      throw new NotFoundError(`Layer doesn't exist`);
    }

    const { layerName, alias, properties } = layer;
    return {
      layerName,
      alias,
      properties: properties.map((prop) => mapProperty(prop)),
    };
  }
}
