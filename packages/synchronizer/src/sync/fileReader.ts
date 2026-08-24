import { createHash } from 'node:crypto';
import type { JsonValue } from 'type-fest';
import { inject, injectable } from 'tsyringe';
import type { FsRepository } from '@common/fs/fsRepository';
import type { LayerEnums } from '@common/interfaces';
import { ALL_KEYS_SELECTOR, SERVICES } from '@common/constants';
import { parseTypeMap, type TypeMap } from './typeMap';
import { TypeMapError } from './errors';

type AliasesFile = Record<string, Record<string, Record<string, string>>>;

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
    try {
      const buffer = await this.fsRepository.readFile(filePath);
      const checksum = createHash('sha256').update(buffer).digest('hex');
      const layers = JSON.parse(buffer.toString()) as LayerEnums[];
      return { checksum, layers };
    } catch (err) {
      throw new Error(`Failed to read layers from ${filePath}`, { cause: err });
    }
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
    let parsed: AliasesFile;
    try {
      const content = await this.fsRepository.readFile(filePath, 'utf-8');
      parsed = JSON.parse(content.toString()) as AliasesFile;
    } catch (err) {
      throw new Error(`Failed to read aliases from ${filePath}`, { cause: err });
    }

    return new Map(
      Object.entries(parsed).map(([namespace, layers]) => [
        namespace,
        new Map(Object.entries(layers).map(([layer, props]) => [layer, new Map(Object.entries(props))])),
      ])
    );
  }
}
