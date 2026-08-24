import { createHash } from 'node:crypto';
import type { JsonValue } from 'type-fest';
import { inject, injectable } from 'tsyringe';
import type { FsRepository } from '@common/fs/fsRepository';
import type { LayerEnums } from '@common/interfaces';
import { SERVICES } from '@common/constants';
import { parseTypeMap, type TypeMap } from './typeMap';
import { parseLayers } from './layersFile';
import { parseAliases, type FileAliases } from './aliasesFile';
import { AliasesFileError, LayersFileError, TypeMapError } from './errors';

@injectable()
export class FileReader {
  public constructor(@inject(SERVICES.FS_REPOSITORY) private readonly fsRepository: FsRepository) {}

  public async readLayersWithChecksum(filePath: string): Promise<{ checksum: string; layers: LayerEnums[] }> {
    try {
      const buffer = await this.fsRepository.readFile(filePath);
      const checksum = createHash('sha256').update(buffer).digest('hex');
      return { checksum, layers: parseLayers(JSON.parse(buffer.toString()), filePath) };
    } catch (err) {
      if (err instanceof LayersFileError) {
        throw err;
      }
      throw new LayersFileError(filePath, 'failed to read or parse the file', err);
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
      return parseAliases(JSON.parse(content.toString()), filePath);
    } catch (err) {
      if (err instanceof AliasesFileError) {
        throw err;
      }
      throw new AliasesFileError(filePath, 'failed to read or parse the file', err);
    }
  }
}
