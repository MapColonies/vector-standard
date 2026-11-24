import ajvCtor from 'ajv';
import { layerEntrySource } from '@common/constants';
import type { LayerEnums } from '@common/interfaces';
import { LayersFileError } from './errors';

const ajv = new ajvCtor({ useDefaults: true });

const isLayersFile = ajv.compile<LayerEnums[]>({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      layerName: { type: 'string' },
      enums: { type: 'array', items: { type: 'string' } },
      excludeProperties: { type: 'array', items: { type: 'string' } },
      sourceKey: { type: 'string' },
      source: { type: 'string', enum: Object.values(layerEntrySource), default: layerEntrySource.lua },
      layerId: { type: 'integer' },
      alias: { type: 'string' },
    },
    required: ['layerName', 'enums'],
    if: { properties: { source: { const: layerEntrySource.logical } }, required: ['source'] },
    then: { required: ['layerId', 'alias'] },
    else: { not: { anyOf: [{ required: ['layerId'] }, { required: ['alias'] }] } },
  },
});

export const parseLayers = (raw: unknown, source: string): LayerEnums[] => {
  if (!isLayersFile(raw)) {
    throw new LayersFileError(source, ajv.errorsText(isLayersFile.errors));
  }

  return raw;
};
