import path from 'node:path';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable, singleton } from 'tsyringe';
import type { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { context as contextAPI } from '@opentelemetry/api';
import { startActivePromisifiedSpan } from '@common/tracing/util';
import { S3Attributes, S3SpanName } from '@common/tracing/s3';
import { SERVICES } from '@common/constants';
import { FsRepository } from '../fs/fsRepository';

@injectable()
@singleton()
export class S3Repository {
  public constructor(
    @inject(SERVICES.S3_CLIENT) private readonly s3Client: S3Client,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly fsRepository: FsRepository
  ) {}

  public async getObjectWrapper(bucket: string, key: string): Promise<Readable> {
    return startActivePromisifiedSpan(
      S3SpanName.S3_GET_OBJECT,
      { [S3Attributes.BUCKET]: bucket, [S3Attributes.KEY]: key },
      contextAPI.active(),
      async () => {
        this.logger.debug({ msg: 'getting object from s3', bucket, key });

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { Body } = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

        if (!(Body instanceof Readable)) {
          throw new Error(`S3 object ${key} did not return a readable stream`);
        }

        return Body;
      }
    );
  }

  public async downloadFile(bucket: string, key: string): Promise<string> {
    return startActivePromisifiedSpan(
      S3SpanName.S3_DOWNLOAD_FILE,
      { [S3Attributes.BUCKET]: bucket, [S3Attributes.FILE_NAME]: key },
      contextAPI.active(),
      async () => {
        try {
          this.logger.info(`Downloading ${key} file from S3 bucket ${bucket}`);

          const body = await this.getObjectWrapper(bucket, key);

          const filePath = path.join(__dirname, 'downloads', bucket, key);
          await this.fsRepository.mkdir(path.dirname(filePath));
          await this.fsRepository.writeFile(filePath, await buffer(body));

          this.logger.info(`${key} file was downloaded successfully`);

          return filePath;
        } catch (err) {
          this.logger.error({ msg: `Failed to download ${key} file from S3 bucket ${bucket}`, err });
          throw new Error(`Failed to download ${key} file from S3`, { cause: err });
        }
      }
    );
  }
}
