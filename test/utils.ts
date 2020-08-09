import { vol, fs } from 'memfs';

export function openEmtpyFile(flags = 'r+') {
  vol.fromJSON({ empty: '' });
  return fs.openSync('empty', flags);
}

export function createFile(fileName: string, content: Buffer) {
  vol.fromJSON({ [fileName]: '' });
  fs.writeFileSync(fileName, content, { flag: 'w' });
}

export function openLastEmptyFile(flags = 'r+') {
  return fs.openSync('empty', flags);
}

export function getMockFileContent(fd: number): Buffer {
  return vol.fds[fd].getBuffer();
}

/**
 * The maximum is exclusive and the minimum is inclusive
 */
export function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}