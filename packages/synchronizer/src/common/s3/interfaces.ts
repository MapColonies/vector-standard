import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { type vectorVectorStandardSynchronizerV1Type } from '@map-colonies/schemas';

export type BaseS3Config = vectorVectorStandardSynchronizerV1Type['dbs']['s3'];

export type S3Config = BaseS3Config & S3ClientConfig;
