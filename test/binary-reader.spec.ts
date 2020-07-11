// Please keep this order
import assert from 'assert';
import { randomFillSync } from 'crypto';
import { isEqual } from 'lodash';
import { StringDecoder } from 'string_decoder';
import mockrequire from 'mock-require';
import mockfs from 'mock-fs';
import fs from 'fs';

mockrequire('fs-ext', {
  constants: { SEEK_SET: 0, SEEK_CUR: 1 },
  seekSync: function (fd: number, offset: number, whence: number) {
    const fdo = mockfs['getDescriptorById'](fd);
    if (whence == 0) // SEEK_SET
      fdo.setPosition(offset);
    else if (whence == 1) // SEEK_CUR
      fdo.setPosition(fdo.getPosition() + offset)
    else
      throw new Error('fs-ext mock only supports SEEK_SET and SEEK_CUR.');
    return fdo.getPosition();
  }
});

import { constants, seekSync } from 'fs-ext';
const { SEEK_SET } = constants;
import { BinaryReader } from '../binary-reader';

function openEmtpyFile(flags?: string) {
  mockfs({ empty: '' });
  return fs.openSync('empty', flags);
}

function getRandom(min: number, max: number) {
  return Math.random() * (max - min) + min;
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

  it('Dispose Tests', () => {
    // Disposing multiple times should not throw an exception
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.dispose();
    binaryReader.dispose();
    binaryReader.dispose();
    binaryReader.dispose();
  });

  it('Close Tests', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.close();
    binaryReader.close();
    binaryReader.close();
    binaryReader.dispose();
  });

  it('Dispose Tests | Negative', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.dispose();
    validateDisposedExceptions(binaryReader);
    binaryReader.dispose();
  });

  it('Close Tests | Negative', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.close();
    validateDisposedExceptions(binaryReader);
    binaryReader.dispose();
  });

  it.skip('Eof Reached Early Tests | Throws Exception', () => {
    // test integer primitives

    runTest(writer => writer.write(byte.MinValue), reader => reader.readByte());
    runTest(writer => writer.write(byte.MaxValue), reader => reader.readByte());
    runTest(writer => writer.write(sbyte.MinValue), reader => reader.readSByte());
    runTest(writer => writer.write(sbyte.MaxValue), reader => reader.readSByte());
    runTest(writer => writer.write(short.MinValue), reader => reader.readInt16());
    runTest(writer => writer.write(short.MaxValue), reader => reader.readInt16());
    runTest(writer => writer.write(ushort.MinValue), reader => reader.readUInt16());
    runTest(writer => writer.write(ushort.MaxValue), reader => reader.readUInt16());
    runTest(writer => writer.write(int.MinValue), reader => reader.readInt32());
    runTest(writer => writer.write(int.MaxValue), reader => reader.readInt32());
    runTest(writer => writer.write(uint.MinValue), reader => reader.readUInt32());
    runTest(writer => writer.write(uint.MaxValue), reader => reader.readUInt32());
    runTest(writer => writer.write(long.MinValue), reader => reader.readInt64());
    runTest(writer => writer.write(long.MaxValue), reader => reader.readInt64());
    runTest(writer => writer.write(ulong.MinValue), reader => reader.readUInt64());
    runTest(writer => writer.write(ulong.MaxValue), reader => reader.readUInt64());
    runTest(writer => writer.write7BitEncodedInt(int.MinValue), reader => reader.read7BitEncodedInt());
    runTest(writer => writer.write7BitEncodedInt(int.MaxValue), reader => reader.read7BitEncodedInt());
    runTest(writer => writer.write7BitEncodedInt64(long.MinValue), reader => reader.read7BitEncodedInt64());
    runTest(writer => writer.write7BitEncodedInt64(long.MaxValue), reader => reader.read7BitEncodedInt64());

    // test non-integer numeric types

    // runTest(writer => writer.write((float)0.1234), reader => reader.readSingle());
    runTest(writer => writer.write(0.1234), reader => reader.readDouble());
    // runTest(writer => writer.write((decimal)0.1234), reader => reader.readDecimal());

    // test non-numeric primitive types

    runTest(writer => writer.write(true), reader => reader.readBoolean());
    runTest(writer => writer.write(false), reader => reader.readBoolean());
    runTest(writer => writer.write(''), reader => reader.readString());
    runTest(writer => writer.write("hello world"), reader => reader.readString());
    runTest(writer => writer.write('x'.repeat(1024 * 1024)), reader => reader.readString());

    function runTest(writeAction, readAction) {
      let encoding = 'utf8';
      let fd = openEmtpyFile();

      // First, call the write action twice

      let writer = new BinaryWriter(fd, encoding, true);
      writeAction(writer);
      writeAction(writer);
      writer.Close();

      // Make sure we populated the inner stream, then truncate it before EOF reached.

      assert.ok(fd.length > 0);
      seekSync(fd, 0, SEEK_SET);
      fd.setLength(fd.Length - 1); // truncate the last byte of the stream

      let reader = new BinaryReader(fd, encoding);
      readAction(reader); // should succeed
      assert.throws(() => readAction(reader), EndOfStreamException); // should fail
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
  });

  it('Read7BitEncodedInt | Bad Format | Throws', () => {
    // Serialized form of 0b1_00000000_00000000_00000000_00000000
    //                      |0x10|| 0x80 || 0x80 || 0x80 || 0x80|

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x10]) });
    let fd = fs.openSync('f', 'r');
    let reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt(), TypeError);

    // 5 bytes, all with the "there's more data after this" flag set

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80]) });
    fd = fs.openSync('f', 'r');
    reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt(), TypeError);
  });

  it('Read7BitEncodedInt64 | Allows Overlong Encodings', () => {
    mockfs({ 'f': Buffer.from([0x9F, 0x00 /* overlong */]), });
    const fd = fs.openSync('f', 'r');
    const reader = new BinaryReader(fd);

    const actual = reader.read7BitEncodedInt64();
    assert.equal(actual, 0x1F);
  });

  it('Read7BitEncodedInt64 | Bad Format | Throws', () => {
    // Serialized form of 0b1_00000000_00000000_00000000_00000000_00000000_00000000_00000000_00000000
    //                      | || 0x80| | 0x80|| 0x80 || 0x80 || 0x80 || 0x80 || 0x80 || 0x80 || 0x80|
    //                       `-- 0x02

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x02]) });
    let fd = fs.openSync('f', 'r');
    let reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt64(), TypeError);

    // 10 bytes, all with the "there's more data after this" flag set

    mockfs({ 'f': Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]) });
    fd = fs.openSync('f', 'r');
    reader = new BinaryReader(fd);
    assert.throws(() => reader.read7BitEncodedInt64(), TypeError);
  });

  function validateDisposedExceptions(binaryReader: BinaryReader) {
    let byteBuffer = Buffer.alloc(10);
    let charBuffer: string[] = new Array(10);

    assert.throws(() => binaryReader.peekChar(), ReferenceError);
    assert.throws(() => binaryReader.readCharCode(), ReferenceError);
    assert.throws(() => binaryReader.readIntoBufferEx(byteBuffer, 0, 1), ReferenceError);
    assert.throws(() => binaryReader.readIntoCharsEx(charBuffer, 0, 1), ReferenceError);
    assert.throws(() => binaryReader.readBoolean(), ReferenceError);
    assert.throws(() => binaryReader.readByte(), ReferenceError);
    assert.throws(() => binaryReader.readBytes(1), ReferenceError);
    assert.throws(() => binaryReader.readChar(), ReferenceError);
    assert.throws(() => binaryReader.readChars(1), ReferenceError);
    // assert.throws(() => binaryReader.readDecimal(), ReferenceError);
    assert.throws(() => binaryReader.readDouble(), ReferenceError);
    assert.throws(() => binaryReader.readInt16(), ReferenceError);
    assert.throws(() => binaryReader.readInt32(), ReferenceError);
    assert.throws(() => binaryReader.readInt64(), ReferenceError);
    assert.throws(() => binaryReader.readSByte(), ReferenceError);
    assert.throws(() => binaryReader.readSingle(), ReferenceError);
    assert.throws(() => binaryReader.readString(), ReferenceError);
    assert.throws(() => binaryReader.readUInt16(), ReferenceError);
    assert.throws(() => binaryReader.readUInt32(), ReferenceError);
    assert.throws(() => binaryReader.readUInt64(), ReferenceError);
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
    assert.throws(() => reader.readIntoCharsEx(new Array(10), 0, 10), TypeError);
    reader.dispose();

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
      let fd = openEmtpyFile('r+');
      let source: string[] = new Array(sourceSize);
      for (let i = 0; i < sourceSize; i++) {
        source[i] = String.fromCharCode(getRandom(0, 127));
      }
      fs.writeSync(fd, Buffer.from(source.join(''), 'ascii'));
      seekSync(fd, 0, SEEK_SET);

      let reader = new BinaryReader(fd, 'ascii');
      let destination: string[] = new Array(destinationSize).fill(null);
      let readCount = reader.readIntoCharsEx(destination, index, count);
      assert.equal(readCount, expectedReadLength);
      assert.ok(isEqual(source.slice(0, readCount), destination.slice(index, index + readCount)));

      // Make sure we didn't write past the end
      assert.ok(destination.slice(readCount + index).every(b => b == null));
      reader.dispose();
    }
  });

  it('Read Chars', () => {
    let testSuite = [
      [['h', 'e', 'l', 'l', 'o'], 5, ['h', 'e', 'l', 'l', 'o']],
      [['h', 'e', 'l', 'l', 'o'], 8, ['h', 'e', 'l', 'l', 'o']],
      [['h', 'e', '\0', '\0', 'o'], 5, ['h', 'e', '\0', '\0', 'o']],
      [['h', 'e', 'l', 'l', 'o'], 0, []],
    ];
    for (let [source, readLength, expected] of testSuite) {
      let fd = openEmtpyFile('r+');
      fs.writeSync(fd, Buffer.from((source as string[]).join(''), 'ascii'));
      seekSync(fd, 0, SEEK_SET);

      let reader = new BinaryReader(fd);
      let destination = reader.readChars(readLength as number);
      assert.ok(isEqual(expected, destination));
      reader.dispose();
    }
  })
  it.skip('Read Chars | Over Reads', () => {
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

      let fd = openEmtpyFile('r+');
      let writer = new BinaryWriter(fd, encoding, true);
      writer.write(data1);
      writer.writeUInt32(data2);
      writer.Dispose();

      seekSync(fd, 0, SEEK_SET);
      let reader = new BinaryReader(fd, encoding, true);
      assert.ok(isEqual(reader.readChars(data1.length), data1));
      assert.equal(reader.readUInt32(), data2);
      reader.dispose();

      fs.readSync = oldReadSync;
    }
  });
  it('Read | Byte Span', () => {
    let testSuite = [
      [100, 100, 100],
      [100, 50, 50],
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
      assert.ok(destination.subarray(expectedReadLength).every(e => e == 0));
      reader.dispose();
    }
  });
  it('Read | Byte Span | ThrowIfDisposed', () => {
    let fd = openEmtpyFile();
    let binaryReader = new BinaryReader(fd);
    binaryReader.dispose();
    assert.throws(() => binaryReader.readIntoBuffer(Buffer.alloc(0)), ReferenceError);
    binaryReader.dispose();
  });

  it('Leave Open', () => {
    let fd = openEmtpyFile();

    // Test leaveOpen.
    let br = new BinaryReader(fd, 'utf8', true);
    br.dispose();
    assert.ok(canRead(fd), "ERROR: After closing a BinaryReader with leaveOpen bool set, canRead(fd) returns false!");

    // Test not leaving open
    br = new BinaryReader(fd, 'utf8', false);
    br.dispose();
    assert.ok(!canRead(fd), "ERROR: After closing a BinaryReader with leaveOpen bool not set, canRead(fd) returns true!");

    // Test default
    fd = openEmtpyFile();
    br = new BinaryReader(fd);
    br.dispose();
    assert.ok(!canRead(fd), "ERROR: After closing a BinaryReader with the default value for leaveOpen, canRead(fd) returns true!")
  });
});
