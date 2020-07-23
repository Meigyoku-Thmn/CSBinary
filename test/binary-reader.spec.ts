// Please keep this order
import assert from 'assert';
import { randomFillSync } from 'crypto';
import { isEqual } from 'lodash';
import { StringDecoder } from 'string_decoder';
import {
  BYTE_MIN, BYTE_MAX, SBYTE_MIN, SBYTE_MAX, SHORT_MIN, SHORT_MAX, USHORT_MIN, USHORT_MAX, INT_MIN, INT_MAX, UINT_MIN, UINT_MAX, LONG_MIN, LONG_MAX, ULONG_MIN, ULONG_MAX
} from '../src/constants/number';
import mockrequire from 'mock-require';
import mockfs from 'mock-fs';
import fs from 'fs';

mockrequire('fs-ext', {
  constants: { SEEK_SET: 0, SEEK_CUR: 1 },
  seekSync(fd: number, offset: number, whence: number) {
    const fdo = mockfs['getDescriptorById'](fd);
    if (whence == this.constants.SEEK_SET)
      fdo.setPosition(offset);
    else if (whence == this.constants.SEEK_CUR)
      fdo.setPosition(fdo.getPosition() + offset)
    else
      throw Error('fs-ext mock only supports SEEK_SET and SEEK_CUR.');
    return fdo.getPosition();
  }
});

import { constants, seekSync } from 'fs-ext';
import { BinaryReader } from '../src/binary-reader';
import { BinaryWriter } from '../src/binary-writer';
import { CSCode } from '../src/constants/error';
const { SEEK_SET } = constants;

function openEmtpyFile(flags: string = 'r+') {
  mockfs({ empty: '' });
  return fs.openSync('empty', flags);
}

/**
 * The maximum is exclusive and the minimum is inclusive
 */
function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function canRead(fd: number) {
  try {
    fs.readSync(fd, Buffer.alloc(1));
    return true;
  } catch (err) {
    if (err.code == 'EBADF')
      return false;
    throw err;
  }
}

describe('BinaryReader Tests', () => {

  afterEach(() => {
    mockfs.restore();
  });

  it('Close Tests', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.close();
    binaryReader.close();
    binaryReader.close();
  });

  it('Close Tests | Negative', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.close();
    validateDisposedExceptions(binaryReader);
  });

  it('Eof Reached Early Tests | Throws Exception', () => {
    // test integer primitives

    runTest(writer => writer.writeByte(BYTE_MIN), reader => reader.readByte());
    runTest(writer => writer.writeByte(BYTE_MAX), reader => reader.readByte());
    runTest(writer => writer.writeSByte(SBYTE_MIN), reader => reader.readSByte());
    runTest(writer => writer.writeSByte(SBYTE_MAX), reader => reader.readSByte());
    runTest(writer => writer.writeInt16(SHORT_MIN), reader => reader.readInt16());
    runTest(writer => writer.writeInt16(SHORT_MAX), reader => reader.readInt16());
    runTest(writer => writer.writeUInt16(USHORT_MIN), reader => reader.readUInt16());
    runTest(writer => writer.writeUInt16(USHORT_MAX), reader => reader.readUInt16());
    runTest(writer => writer.writeInt32(INT_MIN), reader => reader.readInt32());
    runTest(writer => writer.writeInt32(INT_MAX), reader => reader.readInt32());
    runTest(writer => writer.writeUInt32(UINT_MIN), reader => reader.readUInt32());
    runTest(writer => writer.writeUInt32(UINT_MAX), reader => reader.readUInt32());
    runTest(writer => writer.writeInt64(LONG_MIN), reader => reader.readInt64());
    runTest(writer => writer.writeInt64(LONG_MAX), reader => reader.readInt64());
    runTest(writer => writer.writeUInt64(ULONG_MIN), reader => reader.readUInt64());
    runTest(writer => writer.writeUInt64(ULONG_MAX), reader => reader.readUInt64());
    runTest(writer => writer.write7BitEncodedInt(INT_MIN), reader => reader.read7BitEncodedInt());
    runTest(writer => writer.write7BitEncodedInt(INT_MAX), reader => reader.read7BitEncodedInt());
    runTest(writer => writer.write7BitEncodedInt64(LONG_MIN), reader => reader.read7BitEncodedInt64());
    runTest(writer => writer.write7BitEncodedInt64(LONG_MAX), reader => reader.read7BitEncodedInt64());

    // test non-integer numeric types

    runTest(writer => writer.writeSingle(0.1234), reader => reader.readSingle());
    runTest(writer => writer.writeDouble(0.1234), reader => reader.readDouble());
    // runTest(writer => writer.write((decimal)0.1234), reader => reader.readDecimal());

    // test non-numeric primitive types

    runTest(writer => writer.writeBoolean(true), reader => reader.readBoolean());
    runTest(writer => writer.writeBoolean(false), reader => reader.readBoolean());
    runTest(writer => writer.writeString(''), reader => reader.readString());
    runTest(writer => writer.writeString("hello world"), reader => reader.readString());
    runTest(writer => writer.writeString('x'.repeat(1024 * 1024)), reader => reader.readString());

    function runTest(writeAction: (w: BinaryWriter) => void, readAction: (r: BinaryReader) => void) {
      let encoding: BufferEncoding = 'utf8';
      let fd = openEmtpyFile();

      // First, call the write action twice

      let writer = new BinaryWriter(fd, encoding, true);
      writeAction(writer);
      writeAction(writer);
      writer.close();

      // Make sure we populated the inner file, then truncate it before EOF reached.

      let fdLen = fs.fstatSync(fd).size;
      assert.ok(fdLen > 0);
      seekSync(fd, 0, SEEK_SET); // reset read pointer
      fs.ftruncateSync(fd, fdLen - 1) // truncate the last byte of the file

      let reader = new BinaryReader(fd, encoding);
      readAction(reader); // should succeed
      assert.throws(() => readAction(reader), { code: CSCode.ReadBeyondEndOfFile }); // should fail
    }
  });

  /*
  * Other tests for Read7BitEncodedInt[64] are in BinaryWriter's tests.
  */

  it('Read7BitEncodedInt | Allows Overlong Encodings', () => {
    mockfs({ 'f': Buffer.from([0x9F, 0x00 /* overlong */]) });
    const fd = fs.openSync('f', 'r');
    const reader = new BinaryReader(fd);

    const actual = reader.read7BitEncodedInt();
    assert.equal(actual, 0x1F);
    reader.close();
  });

  it('Read7BitEncodedInt | Bad Format | Throws', () => {
    // Serialized form of 0b1_00000000_00000000_00000000_00000000
    //                      |0x10|| 0x80 || 0x80 || 0x80 || 0x80|

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x10]) });
    let fd = fs.openSync('f', 'r');
    let reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt(), { code: CSCode.BadEncodedIntFormat });
    reader.close();

    // 5 bytes, all with the "there's more data after this" flag set

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80]) });
    fd = fs.openSync('f', 'r');
    reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt(), { code: CSCode.BadEncodedIntFormat });
    reader.close();
  });

  it('Read7BitEncodedInt64 | Allows Overlong Encodings', () => {
    mockfs({ 'f': Buffer.from([0x9F, 0x00 /* overlong */]), });
    const fd = fs.openSync('f', 'r');
    const reader = new BinaryReader(fd);

    const actual = reader.read7BitEncodedInt64();
    assert.equal(actual, 0x1F);
    reader.close();
  });

  it('Read7BitEncodedInt64 | Bad Format | Throws', () => {
    // Serialized form of 0b1_00000000_00000000_00000000_00000000_00000000_00000000_00000000_00000000
    //                      | || 0x80| | 0x80|| 0x80 || 0x80 || 0x80 || 0x80 || 0x80 || 0x80 || 0x80|
    //                       `-- 0x02

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x02]) });
    let fd = fs.openSync('f', 'r');
    let reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt64(), { code: CSCode.BadEncodedIntFormat });
    reader.close();

    // 10 bytes, all with the "there's more data after this" flag set

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]) });
    fd = fs.openSync('f', 'r');
    reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt64(), { code: CSCode.BadEncodedIntFormat });
    reader.close();
  });

  function validateDisposedExceptions(binaryReader: BinaryReader) {
    let byteBuffer = Buffer.alloc(10);
    let charBuffer: string[] = new Array<string>(10);

    assert.throws(() => binaryReader.peekChar(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readCharCode(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readIntoBufferEx(byteBuffer, 0, 1), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readIntoCharsEx(charBuffer, 0, 1), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readBoolean(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readByte(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readBytes(1), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readChar(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readChars(1), { code: CSCode.FileIsClosed });
    // assert.throws(() => binaryReader.readDecimal(), ReferenceError);
    assert.throws(() => binaryReader.readDouble(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readInt16(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readInt32(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readInt64(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readSByte(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readSingle(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readString(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readUInt16(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readUInt32(), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryReader.readUInt64(), { code: CSCode.FileIsClosed });
  }

  it('Read | Invalid Encoding', () => {
    const oldWrite = StringDecoder.prototype.write;
    // simulate a buggy decoder, no encoder should return null like this
    StringDecoder.prototype.write = function (buffer) {
      return null;
    };

    mockfs({ 'f': randomFillSync(Buffer.alloc(100), 0, 100) });
    let fd = fs.openSync('f', 'r');
    let reader = new BinaryReader(fd);
    assert.throws(() => reader.readIntoCharsEx(new Array<string>(10), 0, 10), TypeError);
    reader.close();

    StringDecoder.prototype.write = oldWrite;
  });

  it('Read | Char Array', () => {
    let testSuite = [
      [100, 0, 100, 100, 100],
      [100, 25, 50, 100, 50],
      [50, 0, 100, 100, 50],
      [0, 0, 10, 10, 0]
    ];
    for (let [sourceSize, index, count, destinationSize, expectedReadLength] of testSuite) {
      let fd = openEmtpyFile();
      let source = new Array<string>(sourceSize);
      for (let i = 0; i < sourceSize; i++) {
        source[i] = String.fromCharCode(getRandomInt(0, 127));
      }
      fs.writeSync(fd, Buffer.from(source.join(''), 'ascii'));
      seekSync(fd, 0, SEEK_SET);

      let reader = new BinaryReader(fd, 'ascii');
      let destination = new Array<string>(destinationSize).fill(null);
      let readCount = reader.readIntoCharsEx(destination, index, count);
      assert.equal(readCount, expectedReadLength);
      assert.ok(isEqual(source.slice(0, readCount), destination.slice(index, index + readCount)));

      // Make sure we didn't write past the end
      assert.ok(destination.slice(readCount + index).every(b => b == null));
      reader.close();
    }
  });

  it('Read Chars', () => {
    let testSuite = [
      [['h', 'e', 'l', 'l', 'o'], 5, ['h', 'e', 'l', 'l', 'o']],
      [['h', 'e', 'l', 'l', 'o'], 8, ['h', 'e', 'l', 'l', 'o']],
      [['h', 'e', '\0', '\0', 'o'], 5, ['h', 'e', '\0', '\0', 'o']],
      [['h', 'e', 'l', 'l', 'o'], 0, []],
      [[], 5, []],
    ];
    for (let [source, readLength, expected] of testSuite) {
      let fd = openEmtpyFile();
      fs.writeSync(fd, Buffer.from((source as string[]).join(''), 'ascii'));
      seekSync(fd, 0, SEEK_SET);

      let reader = new BinaryReader(fd);
      let destination = reader.readChars(readLength as number);
      assert.ok(isEqual(expected, destination));
      reader.close();
    }
  })

  it('Read Chars | Over Reads', () => {
    let testSuite: BufferEncoding[] = ['utf16le', 'utf8'];
    for (let encoding of testSuite) {
      // ChunkingStream returns less than requested (simulated because there is no "Stream" in NodeJS)
      let oldReadSync = fs.readSync;
      fs.readSync = function (fd: number, buffer: Buffer, offset: number, length: number, position: number) {
        if (offset == null || length == null) {
          offset = 0;
          length = buffer.length;
        }
        if (length > 10) length -= 3;
        return oldReadSync.bind(fs)(fd, buffer, offset, length, position) as number;
      } as typeof fs.readSync;

      let data1 = "hello world \ud83d\ude03!".split(''); // 14 code points, 15 chars in UTF-16, 17 bytes in UTF-8
      let data2 = 0xABCDEF01;

      let fd = openEmtpyFile();
      let writer = new BinaryWriter(fd, encoding, true);
      writer.writeChars(data1);
      writer.writeUInt32(data2);
      writer.close();

      seekSync(fd, 0, SEEK_SET);
      let reader = new BinaryReader(fd, encoding, true);
      let test = reader.readChars(data1.length); seekSync(fd, 0, SEEK_SET);
      assert.ok(isEqual(reader.readChars(data1.length), data1));
      assert.equal(reader.readUInt32(), data2);
      reader.close();

      fs.readSync = oldReadSync;
    }
  });

  it('Read | Byte Span', () => {
    let testSuite = [
      [100, 100, 100],
      [100, 50, 50],
      [50, 100, 50],
      [10, 0, 0],
      [0, 10, 0]
    ];
    for (let [sourceSize, destinationSize, expectedReadLength] of testSuite) {
      let source = randomFillSync(Buffer.alloc(sourceSize), 0, sourceSize);
      mockfs({ 'f': source });
      let fd = fs.openSync('f', 'r');
      let reader = new BinaryReader(fd);
      let destination = Buffer.alloc(destinationSize);
      let readCount = reader.readIntoBuffer(destination);
      assert.ok(isEqual(expectedReadLength, readCount));
      assert.ok(isEqual(source.subarray(0, expectedReadLength), destination.subarray(0, expectedReadLength)));

      // Make sure we didn't write past the end
      assert.ok(destination.subarray(expectedReadLength).every(e => e == 0));
      reader.close();
    }
  });

  it('Read | Byte Span | ThrowIfDisposed', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.close();
    assert.throws(() => binaryReader.readIntoBuffer(Buffer.alloc(0)), { code: CSCode.FileIsClosed });
  });

  it('Read | Char Span', () => {
    let testSuite = [
      [100, 100, 100],
      [100, 50, 50],
      [50, 100, 50],
      [10, 0, 0],
      [0, 10, 0],
    ];
    for (let [sourceSize, destinationSize, expectedReadLength] of testSuite) {
      let fd = openEmtpyFile();
      let source = new Array<string>(sourceSize);
      for (let i = 0; i < sourceSize; i++) {
        source[i] = String.fromCharCode(getRandomInt(0, 127));
      }
      fs.writeSync(fd, Buffer.from(source.join(''), 'ascii'));
      seekSync(fd, 0, SEEK_SET);

      let reader = new BinaryReader(fd, 'ascii');
      let destination = new Array<string>(destinationSize).fill(null);
      let readCount = reader.readIntoChars(destination);
      assert.equal(readCount, expectedReadLength);
      assert.ok(isEqual(source.slice(0, expectedReadLength), destination.slice(0, expectedReadLength)));

      // Make sure we didn't write past the end
      assert.ok(destination.slice(expectedReadLength).every(b => b == null));
      reader.close();
    }
  });

  it('Read | Char Span | ThrowIfDisposed', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.close();
    assert.throws(() => binaryReader.readIntoChars([]), { code: CSCode.FileIsClosed });
  });

  it('Leave Open', () => {
    let fd = openEmtpyFile();

    // Test leaveOpen.
    let br = new BinaryReader(fd, 'utf8', true);
    br.close();
    assert.ok(canRead(fd), "ERROR: After closing a BinaryReader with leaveOpen bool set, canRead(fd) returns false!");

    // Test not leaving open
    br = new BinaryReader(fd, 'utf8', false);
    br.close();
    assert.ok(!canRead(fd), "ERROR: After closing a BinaryReader with leaveOpen bool not set, canRead(fd) returns true!");

    // Test default
    fd = openEmtpyFile();
    br = new BinaryReader(fd);
    br.close();
    assert.ok(!canRead(fd), "ERROR: After closing a BinaryReader with the default value for leaveOpen, canRead(fd) returns true!")
  });

  it.skip('Argument Type and Value Checking', () => {

  });
});
