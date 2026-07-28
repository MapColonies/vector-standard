/* eslint-disable @typescript-eslint/naming-convention */
export const S3SpanName = {
  S3_GET_OBJECT: 's3.getObject',
  S3_DOWNLOAD_FILE: 's3.downloadFile',
} as const;

export type S3SpanName = (typeof S3SpanName)[keyof typeof S3SpanName];

export const S3Attributes = {
  BUCKET: 's3.bucket',
  KEY: 's3.key',
  FILE_NAME: 's3.file.name',
} as const;

export type S3Attributes = (typeof S3Attributes)[keyof typeof S3Attributes];
