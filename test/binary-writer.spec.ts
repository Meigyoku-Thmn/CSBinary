import assert from 'assert';
import { SHORT_MAX, INT_MIN, INT_MAX } from '../src/constants/number';
import { CSCode } from '../src/constants/error';
import { prepareMock, tearDownMock, reloadCriticalModules, flushCriticalModules } from './mock-prepare';
import { openEmtpyFile, getMockFileContent } from './utils';
import { constants, seekSync as _seekSync } from 'fs-ext';
import { BinaryReader as _BinaryReader } from '../src/binary-reader';
import { BinaryWriter as _BinaryWriter } from '../src/binary-writer';
import { vol } from 'memfs';
import _fs from 'fs';
const { SEEK_SET, SEEK_CUR, SEEK_END } = constants;
let BinaryReader = _BinaryReader;
let BinaryWriter = _BinaryWriter;
let seekSync = _seekSync;
let fs = _fs;

describe('BinaryWriter Tests', () => {
  before(() => {
    prepareMock();
    ({ BinaryReader, BinaryWriter, seekSync, fs } = reloadCriticalModules());
  });
  after(() => {
    tearDownMock();
    flushCriticalModules();
  });
  afterEach(() => {
    vol.reset();
  });

  it('Ctor And Write Tests', () => {
    // [] Smoke test to ensure that we can write with the constructed writer
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr);
    let dr2 = new BinaryReader(mstr);
    dw2.writeBoolean(true);
    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);

    assert.ok(dr2.readBoolean());
  });

  it('Ctor And Write Tests | Negative', () => {
    // [] Should throw TypeError
    assert.throws(() => new BinaryWriter(null), TypeError);

    // [] Can't construct a BinaryWriter on a readonly file
    assert.throws(() => new BinaryWriter(openEmtpyFile('r')), { code: CSCode.FileNotWritable });

    // [] Can't construct a BinaryWriter with a closed file
    let memStream = openEmtpyFile();
    fs.closeSync(memStream);
    assert.throws(() => new BinaryWriter(memStream), { code: 'EBADF' });
  });

  it('Encoding Ctor And Write Tests', () => {
    let testSuite = [
      ['utf8', "This is UTF8\u00FF"],
      ['utf16be', "This is BigEndianUnicode\u00FF"],
      ['utf16le', "This is Unicode\u00FF"],
    ];
    for (let [encoding, testString] of testSuite) {
      let memStream = openEmtpyFile();
      let writer = new BinaryWriter(memStream, encoding as BufferEncoding);
      let reader = new BinaryReader(memStream, encoding as BufferEncoding);

      writer.writeString(testString);
      writer.flush();
      seekSync(memStream, 0, SEEK_SET);

      assert.equal(reader.readString(), testString);
    }
  });

  it('Encoding Ctor And Write Tests | Negative', () => {
    // [] Check for ArgumentNullException on null stream
    assert.throws(() => new BinaryWriter(null, 'utf-8'), TypeError);
    // [] Check for ArgumentNullException on null encoding
    assert.throws(() => new BinaryWriter(openEmtpyFile(), null), TypeError);
  });

  it('Seek Tests', () => {
    let iArrLargeValues = [
      10000, 100000, Math.floor(INT_MAX / 200), Math.floor(INT_MAX / 1000), SHORT_MAX,
      INT_MAX, INT_MAX - 1, Math.floor(INT_MAX / 2), Math.floor(INT_MAX / 10), Math.floor(INT_MAX / 100)
    ];

    let dw2: _BinaryWriter;
    let mstr: number;
    let bArr: Buffer;
    let sb = '';
    let lReturn = 0;

    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("Hello, this is my string".split(''));
    for (let iLoop = 0; iLoop < iArrLargeValues.length; iLoop++) {
      lReturn = dw2.seek(iArrLargeValues[iLoop], SEEK_SET);

      assert.equal(lReturn, iArrLargeValues[iLoop]);
    }
    dw2.close();

    // [] Seek from start of stream
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    lReturn = dw2.seek(0, SEEK_SET);

    assert.equal(lReturn, 0);

    dw2.writeChars("lki".split(''));
    dw2.flush();
    bArr = getMockFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "lki3456789");

    dw2.close();

    // [] Seek into stream from start
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);

    dw2.writeChars("0123456789".split(''));
    lReturn = dw2.seek(3, SEEK_SET);

    assert.equal(lReturn, 3);

    dw2.writeChars("lk".split(''));
    dw2.flush();
    bArr = getMockFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "012lk56789");

    dw2.close();

    // [] Seek from end of stream
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    lReturn = dw2.seek(-3, SEEK_END);

    assert.equal(lReturn, 7);

    dw2.writeChars("ll".split(''));
    dw2.flush();
    bArr = getMockFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "0123456ll9");

    dw2.close();

    // [] Seeking from current position
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    seekSync(mstr, 2, SEEK_SET);
    lReturn = dw2.seek(2, SEEK_CUR);

    assert.equal(lReturn, 4);

    dw2.writeChars("ll".split(''));
    dw2.flush();
    bArr = getMockFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "0123ll6789");

    dw2.close();

    // [] Seeking past the end from middle
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    lReturn = dw2.seek(4, SEEK_END);  //This won't throw any exception now.

    assert.equal(seekSync(mstr, 0, SEEK_CUR), 14);

    dw2.close();

    // [] Seek past the end from beginning
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    lReturn = dw2.seek(11, SEEK_SET); //This won't throw any exception now.

    assert.equal(seekSync(mstr, 0, SEEK_CUR), 11);

    dw2.close();

    // [] Seek to the end
    mstr = openEmtpyFile();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars('0123456789'.split(''));
    lReturn = dw2.seek(10, SEEK_SET);

    assert.equal(lReturn, 10);

    dw2.writeChars("ll".split(''));
    bArr = getMockFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "0123456789ll");

    dw2.close();
  });

  it('Seek Tests | Negative Offset', () => {
    let testSuite = [-1, -2, -10000, INT_MIN];
    for (let invalidValue of testSuite) {
      // [] IOException if offset is negative
      let memStream = openEmtpyFile();
      let writer = new BinaryWriter(memStream);
      writer.writeChars('Hello, this is my string'.split(''));
      assert.throws(() => writer.seek(invalidValue, SEEK_SET), { code: "EINVAL" })
      writer.close();
    }
  });

  it('Seek Tests | Invalid SeekOrigin', () => {
    // [] ArgumentException for invalid seekOrigin
    let memStream = openEmtpyFile();
    let writer = new BinaryWriter(memStream);
    writer.writeChars("0123456789".split(''));
    assert.throws(() => writer.seek(3, null), RangeError);
    writer.close();
  });

  it('BaseStream Tests', () => {
    // [] Get the base stream for MemoryStream
    let ms2 = openEmtpyFile();
    let sr2 = new BinaryWriter(ms2);
    assert.strictEqual(sr2.baseFd, ms2);
    sr2.close();
  });

  it.skip('Flush Tests', () => {
    // [] Check that flush updates the underlying stream
    let memstr2 = openEmtpyFile();
    // they are missing a buffered stream here
    let bw2 = new BinaryWriter(memstr2);
    let str = "HelloWorld";
    let expectedLength = str.length + 1; // 1 for 7-bit encoded length
    bw2.writeString(str);
    assert.equal(fs.fstatSync(memstr2).size, expectedLength); // weird test from Microsoft?
    bw2.flush();
    assert.equal(fs.fstatSync(memstr2).size, expectedLength);
    bw2.close();

    // [] Flushing a closed writer may throw an exception
    memstr2 = openEmtpyFile();
    bw2 = new BinaryWriter(memstr2);
    bw2.close();
    assert.throws(() => bw2.flush(), { code: CSCode.FileIsClosed });
  });

  it('Close Tests', () => {
    // Closing multiple times should not throw an exception
    let memStream = openEmtpyFile();
    let binaryWriter = new BinaryWriter(memStream);
    binaryWriter.close();
    binaryWriter.close();
    binaryWriter.close();
  });

  it('Close Tests | Negative', () => {
    let memStream = openEmtpyFile();
    let binaryWriter = new BinaryWriter(memStream);
    binaryWriter.close();
    validateDisposedExceptions(binaryWriter);
  });

  function validateDisposedExceptions(binaryWriter: _BinaryWriter) {
    assert.throws(() => binaryWriter.seek(1, SEEK_SET), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeBufferEx(Buffer.alloc(2), 0, 2), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeCharsEx(['2', '2'], 0, 2), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeBoolean(true), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeByte(4), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeBuffer(Buffer.from([1, 2])), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeChar('a'), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeChars('ab'.split('')), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeDouble(5.3), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeInt16(3), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeInt32(33), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeInt64(BigInt(42)), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeSByte(4), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeString("Hello There"), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeSingle(4.3), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeUInt16(3), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeUInt32(4), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeUInt64(BigInt(5)), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeString("Bah"), { code: CSCode.FileIsClosed });
  }

  it('OutStream', () => {
    class BinaryWriterOutStream extends BinaryWriter {
      get getOutFd(): number { return this._fd; }
    }
    let stream = openEmtpyFile();
    let bw = new BinaryWriterOutStream(stream);
    assert.equal(bw.getOutFd, stream);
  });

  it.skip('Argument Type and Value Checking', () => {

  });
});