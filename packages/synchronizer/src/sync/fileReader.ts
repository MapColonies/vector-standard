import { createHash } from 'node:crypto';
import type { JsonValue } from 'type-fest';
import { injectable } from 'tsyringe';
import { FsRepository } from '@common/fs/fsRepository';
import type { LayerEnums } from '@common/interfaces';
import { parseTypeMap, type TypeMap } from './typeMap';
import { TypeMapError } from './errors';

type AliasesFile = Record<string, Record<string, string>>;

export type FileAliases = Map<string, Map<string, string>>;

@injectable()
export class FileReader {
  public constructor(private readonly fsRepository: FsRepository) {}

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
    try {
      const content = await this.fsRepository.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content.toString()) as AliasesFile;
      return new Map(Object.entries(parsed).map(([layer, props]) => [layer, new Map(Object.entries(props))]));
    } catch (err) {
      throw new Error(`Failed to read aliases from ${filePath}`, { cause: err });
    }
  }
}
