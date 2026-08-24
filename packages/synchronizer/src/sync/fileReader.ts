import { createHash } from 'node:crypto';
import ajvCtor from 'ajv';
import type { JsonValue } from 'type-fest';
import { inject, injectable } from 'tsyringe';
import type { FsRepository } from '@common/fs/fsRepository';
import type { LayerEnums } from '@common/interfaces';
import { ALL_KEYS_SELECTOR, SERVICES } from '@common/constants';
import { parseTypeMap, type TypeMap } from './typeMap';
import { AliasesFileError, LayersFileError, TypeMapError } from './errors';

type AliasesFile = Record<string, Record<string, Record<string, string>>>;

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

const isAliasesFile = ajv.compile<AliasesFile>({
  type: 'object',
  additionalProperties: {
    type: 'object',
    additionalProperties: { type: 'object', additionalProperties: { type: 'string' } },
  },
});

export type FileAliases = Map<string, Map<string, Map<string, string>>>;

export const resolveFileAliases = (fileAliases: FileAliases, namespace: string, layerName: string): Map<string, string> => {
  const tiers = [
    fileAliases.get(ALL_KEYS_SELECTOR)?.get(ALL_KEYS_SELECTOR),
    fileAliases.get(ALL_KEYS_SELECTOR)?.get(layerName),
    fileAliases.get(namespace)?.get(ALL_KEYS_SELECTOR),
    fileAliases.get(namespace)?.get(layerName),
  ];
  return new Map(tiers.filter((tier): tier is Map<string, string> => tier !== undefined).flatMap((tier) => [...tier]));
};

@injectable()
export class FileReader {
  public constructor(@inject(SERVICES.FS_REPOSITORY) private readonly fsRepository: FsRepository) {}

  public async readLayersWithChecksum(filePath: string): Promise<{ checksum: string; layers: LayerEnums[] }> {
    let checksum: string;
    let parsed: unknown;
    try {
      const buffer = await this.fsRepository.readFile(filePath);
      checksum = createHash('sha256').update(buffer).digest('hex');
      parsed = JSON.parse(buffer.toString());
    } catch (err) {
      throw new LayersFileError(filePath, 'failed to read or parse the file', err);
    }

    if (!isLayersFile(parsed)) {
      throw new LayersFileError(filePath, ajv.errorsText(isLayersFile.errors));
    }

    return { checksum, layers: parsed };
  }

  public async readTypeMap(filePath: string): Promise<TypeMap> {
    try {
      const content = await this.fsRepository.readFile(filePath, 'utf-8');
      return parseTypeMap(JSON.parse(content.toString()) as JsonValue, filePath);
    } catch (err) {
      if (err instanceof TypeMapError) {
        throw err;
      }
      throw new TypeMapError(filePath, 'failed to read or parse the file', err);
    }
  }

  public async readAliases(filePath: string): Promise<FileAliases> {
    let parsed: unknown;
    try {
      const content = await this.fsRepository.readFile(filePath, 'utf-8');
      parsed = JSON.parse(content.toString());
    } catch (err) {
      throw new AliasesFileError(filePath, 'failed to read or parse the file', err);
    }

    if (!isAliasesFile(parsed)) {
      throw new AliasesFileError(filePath, ajv.errorsText(isAliasesFile.errors));
    }

    return new Map(
      Object.entries(parsed).map(([namespace, layers]) => [
        namespace,
        new Map(Object.entries(layers).map(([layer, props]) => [layer, new Map(Object.entries(props))])),
      ])
    );
  }
}
