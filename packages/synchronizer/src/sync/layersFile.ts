import ajvCtor from 'ajv';
import type { LayerEnums } from '@common/interfaces';
import { LayersFileError } from './errors';

const ajv = new ajvCtor();

const isLayersFile = ajv.compile<LayerEnums[]>({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      layerName: { type: 'string' },
      enums: { type: 'array', items: { type: 'string' } },
      excludeProperties: { type: 'array', items: { type: 'string' } },
      sourceKey: { type: 'string' },
    },
    required: ['layerName', 'enums'],
  },
});

export const parseLayers = (raw: unknown, source: string): LayerEnums[] => {
  if (!isLayersFile(raw)) {
    throw new LayersFileError(source, ajv.errorsText(isLayersFile.errors));
  }

  return raw;
};
