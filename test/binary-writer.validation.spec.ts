import assert from 'assert';
import { openTruncated, installHookToFile, removeHookFromFile, openTruncatedToRead } from './utils';
import { BinaryWriter } from '../src/binary-writer';
import { IFile } from '../src/addon/file';
import { INT_MIN, INT_MAX, LONG_MIN, LONG_MAX } from '../src/constants/number';
import { CSCode } from '../src/constants/error';

describe('BinaryWriter | Arguments Validation Test', () => {
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
    new BinaryWriter(openTruncated());
    new BinaryWriter(openTruncated(), 'utf8');
    new BinaryWriter(openTruncated(), 'utf8', true);
  });

  it('Constructor | Negative', () => {
    const file = openTruncated();
    assert.throws(() => new BinaryWriter(null), TypeError);
    assert.throws(() => new BinaryWriter(2 as never), TypeError);
    assert.throws(() => new BinaryWriter(file, null), TypeError);
    assert.throws(() => new BinaryWriter(file, 'haha'), { message: 'Unknown character encoding.' });
    assert.throws(() => new BinaryWriter(file, 'utf8', 2 as never), TypeError);
    assert.throws(() => new BinaryWriter(openTruncatedToRead()), { code: CSCode.FileNotWritable });
  });

  it('Can get back File instance', () => {
    const file = openTruncated();
    const br = new BinaryWriter(file);
    assert.ok(file == br.file);
  });

  it('WriteBoolean | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeBoolean(null), TypeError);
    assert.throws(() => bw.writeBoolean(2 as never), TypeError);
  });

  it('WriteByte | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeByte(null), TypeError);
    assert.throws(() => bw.writeByte(Number.MIN_SAFE_INTEGER - 2), TypeError);
  });

  it('writeSByte | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeSByte(null), TypeError);
    assert.throws(() => bw.writeSByte(Number.MIN_SAFE_INTEGER - 2), TypeError);
    assert.throws(() => bw.writeSByte(-129), RangeError);
    assert.throws(() => bw.writeSByte(999), RangeError);
  });

  it('WriteBuffer | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeBuffer(null), TypeError);
    assert.throws(() => bw.writeBuffer(2 as never), TypeError);
  });

  it('WriteBufferEx | Negative', () => {
    const bw = BinaryWriter.null;
    const buffer = Buffer.alloc(0);
    assert.throws(() => bw.writeBufferEx(null, 0, 0), TypeError);
    assert.throws(() => bw.writeBufferEx(2 as never, 0, 0), TypeError);
    assert.throws(() => bw.writeBufferEx(null, null, 0), TypeError);
    assert.throws(() => bw.writeBufferEx(null, 0, null), TypeError);
    assert.throws(() => bw.writeBufferEx(buffer, Number.MIN_SAFE_INTEGER - 2, 0), TypeError);
    assert.throws(() => bw.writeBufferEx(buffer, 0, Number.MIN_SAFE_INTEGER - 2), TypeError);
  });

  it('WriteChar | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeChar(null), TypeError);
    assert.throws(() => bw.writeChar(2 as never), TypeError);
    assert.throws(() => bw.writeChar('null'), TypeError);
    assert.throws(() => bw.writeChar('\uD83D'), RangeError);
  });

  it('WriteChars', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeChars(null), TypeError);
    assert.throws(() => bw.writeChars(2 as never), TypeError);
    assert.throws(() => bw.writeChars(['s', 'null']), RangeError);
  });

  it('WriteCharsEx | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeCharsEx(null, 0, 0), TypeError);
    assert.throws(() => bw.writeCharsEx(2 as never, 0, 0), TypeError);
    assert.throws(() => bw.writeCharsEx(null, null, 0), TypeError);
    assert.throws(() => bw.writeCharsEx(null, 0, null), TypeError);
    assert.throws(() => bw.writeCharsEx([], Number.MIN_SAFE_INTEGER - 2, 0), TypeError);
    assert.throws(() => bw.writeCharsEx([], 0, Number.MIN_SAFE_INTEGER - 2), TypeError);
    assert.throws(() => bw.writeCharsEx(['s', '1'], -1, 0), RangeError);
    assert.throws(() => bw.writeCharsEx(['s', '1'], 0, -1), RangeError);
    assert.throws(() => bw.writeCharsEx(['s', '1'], 0, 3), RangeError);
    assert.throws(() => bw.writeCharsEx(['s', '111'], 0, 2), RangeError);
  });

  it('WriteDouble | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeDouble(null), TypeError);
    assert.throws(() => bw.writeDouble([] as never), TypeError);
  });

  it('WriteInt16 | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeInt16(null), TypeError);
    assert.throws(() => bw.writeInt16(Number.MIN_SAFE_INTEGER - 2), TypeError);
  });

  it('WriteUInt16 | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeUInt16(null), TypeError);
    assert.throws(() => bw.writeUInt16(Number.MIN_SAFE_INTEGER - 2), TypeError);
  });

  it('WriteInt32 | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeInt32(null), TypeError);
    assert.throws(() => bw.writeInt32(Number.MIN_SAFE_INTEGER - 2), TypeError);
  });

  it('WriteUInt32 | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeUInt32(null), TypeError);
    assert.throws(() => bw.writeUInt32(Number.MIN_SAFE_INTEGER - 2), TypeError);
  });

  it('WriteInt64 | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeInt64(null), TypeError);
    assert.throws(() => bw.writeInt64([] as never), TypeError);
  });

  it('WriteUInt64 | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeUInt64(null), TypeError);
    assert.throws(() => bw.writeUInt64([] as never), TypeError);
  });

  it('WriteSingle | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeSingle(null), TypeError);
    assert.throws(() => bw.writeSingle([] as never), TypeError);
  });

  it('WriteString | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.writeString(null), TypeError);
    assert.throws(() => bw.writeString([] as never), TypeError);
  });

  it('Write7BitEncodedInt | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.write7BitEncodedInt(null), TypeError);
    assert.throws(() => bw.write7BitEncodedInt([] as never), TypeError);
    assert.throws(() => bw.write7BitEncodedInt(Number.MIN_SAFE_INTEGER - 2), TypeError);
    assert.throws(() => bw.write7BitEncodedInt(INT_MIN - 1), RangeError);
    assert.throws(() => bw.write7BitEncodedInt(INT_MAX + 1), RangeError);
  });

  it('Write7BitEncodedInt64 | Negative', () => {
    const bw = BinaryWriter.null;
    assert.throws(() => bw.write7BitEncodedInt64(null), TypeError);
    assert.throws(() => bw.write7BitEncodedInt64([] as never), TypeError);
    assert.throws(() => bw.write7BitEncodedInt64(LONG_MIN - BigInt(1)), RangeError);
    assert.throws(() => bw.write7BitEncodedInt64(LONG_MAX + BigInt(1)), RangeError);
  });
});
