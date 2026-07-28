/* eslint-disable @typescript-eslint/naming-convention */
export const FsSpanName = {
  FS_MKDIR: 'fs.mkdir',
  FS_WRITE: 'fs.write',
  FS_APPEND: 'fs.append',
  FS_READ: 'fs.read',
  FS_READ_DIR: 'fs.readdir',
  FS_RENAME: 'fs.rename',
  FS_UNLINK: 'fs.unlink',
} as const;

export type FsSpanName = (typeof FsSpanName)[keyof typeof FsSpanName];

export const FsAttributes = {
  FILE_PATH: 'file.path',
  FILE_NAME: 'file.name',
  DIR_PATH: 'dir.path',
  DIR_MK_COUNT: 'dir.mk.count',
} as const;

export type FsAttributes = (typeof FsAttributes)[keyof typeof FsAttributes];
