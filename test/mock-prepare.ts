import mockrequire from 'mock-require';
import { vol, fs as memfs } from 'memfs'
import { constants } from 'fs-ext';
import { raise } from '../src/utils/error';
const { SEEK_SET, SEEK_CUR, SEEK_END } = constants;

export function prepareMock() {
  mockrequire('fs', memfs);
  mockrequire('fs-ext', {
    ...require('fs-ext'),
    seekSync(fd: number, offset: number, whence: number) {
      const file = vol.fds[fd];
      if (file == null)
        raise(Error(`Bad file descriptor.`), 'EBADF');
      const size = file.getSize();
      const currentOffset = file.position;
      if (whence == SEEK_CUR)
        offset = currentOffset + offset;
      else if (whence == SEEK_END)
        offset = size + offset;
      else if (whence == SEEK_SET)
        0;
      else
        throw RangeError('Invalid "whence".');
      if (offset < 0)
        raise(Error(`Invalid seek (target offset = ${offset}). `), 'EINVAL');
      file.seekTo(offset);
      return offset;
    }
  });
  delete require.cache[require.resolve('../src/utils/file')];
  mockrequire('../src/utils/file', {
    ...require('../src/utils/file'),
    canWrite(fd: number): boolean {
      if (vol.fds[fd] == null)
        raise(Error(`Bad file descriptor.`), 'EBADF');
      const flags = vol.fds[fd].flags;
      const { O_WRONLY, O_RDWR } = memfs.constants;
      return (flags & O_WRONLY) == O_WRONLY || (flags & O_RDWR) == O_RDWR;
    },
    canSeek(fd: number): boolean {
      if (vol.fds[fd] == null)
        raise(Error(`Bad file descriptor.`), 'EBADF');
      return true;
    },
    tell(fd: number): number {
      if (vol.fds[fd] == null)
        raise(Error(`Bad file descriptor.`), 'EBADF');
      return vol.fds[fd].position;
    }
  });
}

export function tearDownMock() {
  mockrequire.stopAll();
}

export function reloadCriticalModules() {
  flushCriticalModules();
  return {
    BinaryReader: require('../src/binary-reader').BinaryReader,
    BinaryWriter: require('../src/binary-writer').BinaryWriter,
    seekSync: require('fs-ext').seekSync,
    fs: require('fs'),
  }
}

export function flushCriticalModules() {
  delete require.cache[require.resolve('../src/binary-reader')];
  delete require.cache[require.resolve('../src/binary-writer')];
  delete require.cache[require.resolve('../src/utils/file')];
  delete require.cache[require.resolve('fs-ext')];
}