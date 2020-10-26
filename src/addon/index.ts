import bindings from 'bindings';
const addon = bindings('addon.node');

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