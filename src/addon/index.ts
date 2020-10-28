import node_gyp_build from 'node-gyp-build';
import path from 'path';
let baseDir = path.join(__dirname, '../..');
if (path.basename(baseDir) === 'dist')
  baseDir = path.join(baseDir, '..');
const addon = node_gyp_build(baseDir);

export const getFileState = addon.GetFileState as (fd: number) => {
  canRead: boolean;
  canWrite: boolean;
  canAppend: boolean;
};

export const NativeFile = addon.File;

export const constants = addon.constants as {
  SEEK_SET: number;
  SEEK_CUR: number;
  SEEK_END: number;
};