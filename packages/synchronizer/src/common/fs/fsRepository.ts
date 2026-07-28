import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { type Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { context as contextAPI } from '@opentelemetry/api';
import { startActivePromisifiedSpan } from '@common/tracing/util';
import { FsAttributes, FsSpanName } from '@common/tracing/fs';
import { SERVICES } from '@src/common/constants';

@injectable()
export class FsRepository {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public async readFile(filePath: string, encoding?: BufferEncoding): Promise<ReturnType<typeof readFile>> {
    this.logger.debug({ msg: 'read file', filePath, encoding });

    return startActivePromisifiedSpan(
      FsSpanName.FS_READ,
      { [FsAttributes.FILE_PATH]: filePath, [FsAttributes.FILE_NAME]: filePath.split('/').pop() },
      contextAPI.active(),
      async () => readFile(filePath, encoding)
    );
  }

  public async mkdir(dirPath: string): Promise<ReturnType<typeof mkdir>> {
    this.logger.debug({ msg: 'mkdir path', dirPath });

    return startActivePromisifiedSpan(FsSpanName.FS_MKDIR, { [FsAttributes.DIR_PATH]: dirPath }, contextAPI.active(), async () =>
      mkdir(dirPath, { recursive: true })
    );
  }

  public async writeFile(filePath: string, data: string | NodeJS.ArrayBufferView, encoding?: BufferEncoding): Promise<ReturnType<typeof writeFile>> {
    this.logger.debug({ msg: 'writing file', filePath });

    return startActivePromisifiedSpan(
      FsSpanName.FS_WRITE,
      { [FsAttributes.FILE_PATH]: filePath, [FsAttributes.FILE_NAME]: filePath.split('/').pop() },
      contextAPI.active(),
      async () => writeFile(filePath, data, encoding)
    );
  }
}
