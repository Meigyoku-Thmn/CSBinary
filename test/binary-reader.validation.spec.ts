import assert from 'assert';
import { openTruncated, installHookToFile, removeHookFromFile, openToReadWithContent } from './utils';
import { BinaryReader } from '../src/binary-reader';
import { IFile } from '../src/addon/file';
import { openNullDevice } from '../src/utils/file';
import { CSCode } from '../src/constants/error';

describe('BinaryReader | Arguments Validation Test', () => {
  const fileArr: IFile[] = [];
  before(() => {
    installHookToFile(fileArr);
  });
  afterEach(() => {
    fileArr.forEach(e => e.close());
    fileArr.length = 0;
  });
  after(() => {
    removeHookFromFile();
  });

  it('Constructor', () => {
    new BinaryReader(openTruncated());
    new BinaryReader(openTruncated(), 'utf8');
    new BinaryReader(openTruncated(), 'utf8', true);
  });

  it('Constructor | Negative', () => {
    const file = openTruncated();
    assert.throws(() => new BinaryReader(null), TypeError);
    assert.throws(() => new BinaryReader(2 as never), TypeError);
    assert.throws(() => new BinaryReader(file, null), TypeError);
    assert.throws(() => new BinaryReader(file, 'haha'), { message: 'Unknown character encoding.' });
    assert.throws(() => new BinaryReader(file, 'utf8', 2 as never), TypeError);
    assert.throws(() => new BinaryReader(openNullDevice()), { code: CSCode.FileNotReadable });
  });

  it('Can get back File instance', () => {
    const file = openTruncated();
    const br = new BinaryReader(file);
    assert.ok(file == br.file);
  });

  it('ReadIntoCharsEx | Negative', () => {
    const br = new BinaryReader(openTruncated());
    assert.throws(() => br.readIntoCharsEx(null, 0, 0), TypeError);
    assert.throws(() => br.readIntoCharsEx(2 as never, 0, 0), TypeError);
    assert.throws(() => br.readIntoCharsEx(null, null, 0), TypeError);
    assert.throws(() => br.readIntoCharsEx(null, 0, null), TypeError);
    assert.throws(() => br.readIntoCharsEx([], Number.MIN_SAFE_INTEGER - 2, 0), TypeError);
    assert.throws(() => br.readIntoCharsEx([], 0, Number.MIN_SAFE_INTEGER - 2), TypeError);
    assert.throws(() => br.readIntoCharsEx([], -1, 0), RangeError);
    assert.throws(() => br.readIntoCharsEx([], 0, -1), RangeError);
    assert.throws(() => br.readIntoCharsEx([], 0, 3), RangeError);
  });

  it('ReadIntoChars | Negative', () => {
    const br = new BinaryReader(openTruncated());
    assert.throws(() => br.readIntoChars(null), TypeError);
    assert.throws(() => br.readIntoChars(3 as never), TypeError);
  });

  it('ReadChars | Negative', () => {
    const br = new BinaryReader(openTruncated());
    assert.throws(() => br.readChars(null), TypeError);
    assert.throws(() => br.readChars(Number.MIN_SAFE_INTEGER - 2), TypeError);
    assert.throws(() => br.readChars(-1), RangeError);
  });

  it('ReadIntoBufferEx | Negative', () => {
    const br = new BinaryReader(openTruncated());
    const buffer = Buffer.alloc(0);
    assert.throws(() => br.readIntoBufferEx(null, 0, 0), TypeError);
    assert.throws(() => br.readIntoBufferEx(4 as never, 0, 0), TypeError);
    assert.throws(() => br.readIntoBufferEx(null, null, 0), TypeError);
    assert.throws(() => br.readIntoBufferEx(null, 0, null), TypeError);
    assert.throws(() => br.readIntoBufferEx(buffer, Number.MIN_SAFE_INTEGER - 2, 0), TypeError);
    assert.throws(() => br.readIntoBufferEx(buffer, 0, Number.MIN_SAFE_INTEGER - 2), TypeError);
    assert.throws(() => br.readIntoBufferEx(buffer, -1, 0), RangeError);
    assert.throws(() => br.readIntoBufferEx(buffer, 0, -1), RangeError);
    assert.throws(() => br.readIntoBufferEx(buffer, 0, 3), RangeError);
  });

  it('ReadIntoBuffer | Negative', () => {
    const br = new BinaryReader(openTruncated());
    assert.throws(() => br.readIntoBuffer(null), TypeError);
    assert.throws(() => br.readIntoBuffer(54 as never), TypeError);
  });

  it('ReadBytes', () => {
    const br = new BinaryReader(openToReadWithContent(Buffer.alloc(2)));
    br.readBytes(0);
    br.readBytes(1);
  });

  it('ReadBytes | Negative', () => {
    const br = new BinaryReader(openTruncated());
    assert.throws(() => br.readBytes(null), TypeError);
    assert.throws(() => br.readBytes(Number.MIN_SAFE_INTEGER - 2), TypeError);
    assert.throws(() => br.readBytes(-1), RangeError);
  });
});
