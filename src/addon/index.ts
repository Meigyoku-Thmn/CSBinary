import node_gyp_build from 'node-gyp-build';
const addon = node_gyp_build();

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