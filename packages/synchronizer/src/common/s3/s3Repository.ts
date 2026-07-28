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
import { SERVICES, s3ConfigPath } from '@common/constants';
import type { ConfigType } from '../config';
import { FsRepository } from '../fs/fsRepository';

@injectable()
@singleton()
export class S3Repository {
  public constructor(
    @inject(SERVICES.S3_CLIENT) private readonly s3Client: S3Client,
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
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

  public async downloadFile(): Promise<string> {
    const { bucket, fileName } = this.config.get(s3ConfigPath);

    return startActivePromisifiedSpan(
      S3SpanName.S3_DOWNLOAD_FILE,
      { [S3Attributes.BUCKET]: bucket, [S3Attributes.FILE_NAME]: fileName },
      contextAPI.active(),
      async () => {
        try {
          this.logger.info(`Downloading ${fileName} file from S3`);

          const body = await this.getObjectWrapper(bucket, fileName);

          const filePath = path.join(__dirname, 'downloads', fileName);
          await this.fsRepository.mkdir(path.dirname(filePath));
          await this.fsRepository.writeFile(filePath, await buffer(body));

          this.logger.info(`${fileName} file was downloaded successfully`);

          return filePath;
        } catch (err) {
          this.logger.error({ msg: `Failed to download ${fileName} file from S3 bucket ${bucket}`, err });
          throw new Error(`Failed to download ${fileName} file from S3`, { cause: err });
        }
      }
    );
  }
}
