import assert from 'assert';
import fs from 'fs';
import { openTruncated, installHookToFile, removeHookFromFile, openToReadWithContent, openWithContent, TmpFilePath } from './utils';
import { SeekOrigin } from '../src/constants/mode';
import { openNullDevice } from '../src/utils/file';
import { IFile } from '../src/addon/file';

describe('File | Arguments Validation Test', () => {
  const fileArr: IFile[] = [];
  let File: new (fd: number) => IFile;
  before(() => {
    File = installHookToFile(fileArr);
  });
  afterEach(() => {
    fileArr.forEach(e => e.close());
    fileArr.length = 0;
  });
  after(() => {
    removeHookFromFile();
  });

  it('Open from file descriptor', () => {
    openTruncated();
    openWithContent(Buffer.from('Hello World'));
  });

  it('Open from file descriptor | Negative', () => {
    assert.throws(() => new File(99999), { code: 'EBADF' });
    assert.throws(() => new File(Number.MAX_SAFE_INTEGER), TypeError);
    assert.throws(() => new File('kdjkf' as never), TypeError);
    assert.throws(() => new File(99.99), TypeError);
  });

  it('Can get back file descriptor from File', () => {
    const fd = fs.openSync(TmpFilePath, 'w+');
    const file = new File(fd);
    assert.ok(fd == file.fd);
  });

  it('The original file descriptor is invalid after closing File', () => {
    const file = openTruncated();
    const fd = file.fd;
    file.close();
    assert.throws(() => fs.fstatSync(fd), { code: 'EBADF' });
  });

  it('Write', () => {
    const file = openNullDevice();
    file.write(Buffer.alloc(3));
    file.write(Buffer.alloc(7), 0, 5);
  });

  it('Write | Negative', () => {
    const file = openNullDevice();

    assert.throws(() => file.write(null), TypeError);
    assert.throws(() => file.write(Buffer.alloc(1), '2' as never, -1), TypeError);
    assert.throws(() => file.write(Buffer.alloc(1), 0, '2' as never), TypeError);
    assert.throws(() => file.write(Buffer.alloc(1), 99.99, 2 as never), TypeError);
    assert.throws(() => file.write(Buffer.alloc(1), 2, 99.99 as never), TypeError);

    assert.throws(() => file.write(Buffer.alloc(1), -1), RangeError);
    assert.throws(() => file.write(Buffer.alloc(1), 2), RangeError);
    assert.throws(() => file.write(Buffer.alloc(1), 0, -1), RangeError);
    assert.throws(() => file.write(Buffer.alloc(1), 0, 2), RangeError);
    assert.throws(() => file.write(Buffer.alloc(1), 0, Number.MAX_SAFE_INTEGER), RangeError);
    assert.throws(() => file.write(Buffer.alloc(1), 0, Number.MIN_SAFE_INTEGER), RangeError);
    assert.throws(() => file.write(Buffer.alloc(1), Number.MAX_SAFE_INTEGER, 0), RangeError);
    assert.throws(() => file.write(Buffer.alloc(1), Number.MAX_SAFE_INTEGER, 0), RangeError);
  });

  it('Read', () => {
    const originalRead = File.prototype.read;
    File.prototype.read = function (bytes: NodeJS.ArrayBufferView, offset?: number, count?: number) {
      const rs = originalRead.bind(this)(bytes, offset, count);
      this.seek(0, SeekOrigin.Begin);
      return rs;
    };

    const file = openToReadWithContent(Buffer.alloc(1));
    file.read(Buffer.alloc(1));
    file.read(Buffer.alloc(1), 0, 0);

    File.prototype.read = originalRead;
  });

  it('Read | Negative', () => {
    const originalRead = File.prototype.read;
    File.prototype.read = function (bytes: NodeJS.ArrayBufferView, offset?: number, count?: number) {
      const rs = originalRead.bind(this)(bytes, offset, count);
      this.seek(0, SeekOrigin.Begin);
      return rs;
    };

    const file = openToReadWithContent(Buffer.alloc(1));

    assert.throws(() => file.read(null), TypeError);
    assert.throws(() => file.read(Buffer.alloc(1), '2' as never, -1), TypeError);
    assert.throws(() => file.read(Buffer.alloc(1), 0, '2' as never), TypeError);
    assert.throws(() => file.read(Buffer.alloc(1), 9.9, '2' as never), TypeError);
    assert.throws(() => file.read(Buffer.alloc(1), 0, 9.9 as never), TypeError);

    assert.throws(() => file.read(Buffer.alloc(1), -1), RangeError);
    assert.throws(() => file.read(Buffer.alloc(1), 2), RangeError);
    assert.throws(() => file.read(Buffer.alloc(1), 0, -1), RangeError);
    assert.throws(() => file.read(Buffer.alloc(1), 0, 2), RangeError);
    assert.throws(() => file.read(Buffer.alloc(1), 0, Number.MAX_SAFE_INTEGER), RangeError);
    assert.throws(() => file.read(Buffer.alloc(1), 0, Number.MIN_SAFE_INTEGER), RangeError);
    assert.throws(() => file.read(Buffer.alloc(1), Number.MAX_SAFE_INTEGER, 0), RangeError);
    assert.throws(() => file.read(Buffer.alloc(1), Number.MAX_SAFE_INTEGER, 0), RangeError);

    File.prototype.read = originalRead;
  });

  it('Seek', () => {
    const file = openToReadWithContent(Buffer.alloc(10));
    file.seek(1, SeekOrigin.Begin);
    file.seek(1, SeekOrigin.Current);
    file.seek(-2, SeekOrigin.End);
    file.seek(11, SeekOrigin.Begin);
  });

  it('Seek | Negative', () => {
    const file = openToReadWithContent(Buffer.alloc(10));
    assert.throws(() => file.seek(-1, SeekOrigin.Begin), { code: 'EINVAL' });
    assert.throws(() => file.seek(-1, 'i' as never), TypeError);
    assert.throws(() => file.seek(null, SeekOrigin.Begin), TypeError);
    assert.throws(() => file.seek(9.3, SeekOrigin.Begin), TypeError);
  });

  it('SetBufSize', () => {
    const file = openToReadWithContent(Buffer.alloc(10));
    file.setBufSize(128);
    file.setBufSize(0);
  });

  it('SetBufSize | Negative', () => {
    const file = openToReadWithContent(Buffer.alloc(10));
    assert.throws(() => file.setBufSize(null), TypeError);
    assert.throws(() => file.setBufSize(9.5), TypeError);
    assert.throws(() => file.setBufSize(-1), RangeError);
  });

  it('File mode', () => {
    let fd = fs.openSync(TmpFilePath, 'w+');
    let file = new File(fd);
    assert.ok(file.canRead == true);
    assert.ok(file.canWrite == true);
    assert.ok(file.canAppend == false);
    file.close();

    fd = fs.openSync(TmpFilePath, 'a');
    file = new File(fd);
    assert.ok(file.canRead == false);
    assert.ok(file.canWrite == true);
    assert.ok(file.canAppend == true);
    file.close();

    fd = fs.openSync(TmpFilePath, 'a+');
    file = new File(fd);
    assert.ok(file.canRead == true);
    assert.ok(file.canWrite == true);
    assert.ok(file.canAppend == true);
    file.close();

    fd = fs.openSync(TmpFilePath, 'w');
    file = new File(fd);
    assert.ok(file.canRead == false);
    assert.ok(file.canWrite == true);
    assert.ok(file.canAppend == false);
    file.close();

    fd = fs.openSync(TmpFilePath, 'r');
    file = new File(fd);
    assert.ok(file.canRead == true);
    assert.ok(file.canWrite == false);
    assert.ok(file.canAppend == false);
    file.close();

    fd = fs.openSync(TmpFilePath, 'r+');
    file = new File(fd);
    assert.ok(file.canRead == true);
    assert.ok(file.canWrite == true);
    assert.ok(file.canAppend == false);
    file.close();
  });
});
