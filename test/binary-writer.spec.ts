import assert from 'assert';
import { SHORT_MAX, INT_MIN, INT_MAX } from '../src/constants/number';
import { CSCode } from '../src/constants/error';
import { openTruncated, installHookToFile, removeHookFromFile, openTruncatedToRead, getFileContent } from './utils';
import { BinaryReader } from '../src/binary-reader';
import { BinaryWriter } from '../src/binary-writer';
import fs from 'fs';
import { SeekOrigin } from '../src/constants/mode';
import { IFile } from '../src/addon/file';
import { Encoding } from '../src/encoding';

describe('BinaryWriter Tests', () => {
  let fileArr: IFile[] = [];
  before(() => {
    installHookToFile(fileArr) as any;
  });
  afterEach(() => {
    fileArr.forEach(e => e.close());
    fileArr.length = 0;
  });
  after(() => {
    removeHookFromFile();
  });

  it('Ctor And Write Tests', () => {
    // [] Smoke test to ensure that we can write with the constructed writer
    let file = openTruncated();
    let dw2 = new BinaryWriter(file, 'utf8', true);
    let dr2 = new BinaryReader(file);
    dw2.writeBoolean(true);
    dw2.flush();
    file.seek(0, SeekOrigin.Begin);

    assert.ok(dr2.readBoolean());
    dw2.close();
    dr2.close();
  });

  it('Ctor And Write Tests | Negative', () => {
    // [] Should throw TypeError
    assert.throws(() => new BinaryWriter(null), TypeError);

    // [] Can't construct a BinaryWriter on a readonly file
    assert.throws(() => new BinaryWriter(openTruncatedToRead()), { code: CSCode.FileNotWritable });

    // [] Can't construct a BinaryWriter with a closed file
    let file = openTruncated();
    file.close();
    assert.throws(() => new BinaryWriter(file), { code: CSCode.FileNotWritable });
  });

  it('Encoding Ctor And Write Tests', () => {
    let testSuite = [
      ['utf8', "This is UTF8\u00FF"],
      ['utf16be', "This is BigEndianUnicode\u00FF"],
      ['utf16le', "This is Unicode\u00FF"],
    ];
    for (let [encoding, testString] of testSuite) {
      let file = openTruncated();
      let writer = new BinaryWriter(file, encoding as BufferEncoding);
      let reader = new BinaryReader(file, encoding as BufferEncoding);
      let _encoding = new Encoding(encoding);
      let nullLen = _encoding.encode('\0').length;

      writer.writeString(testString);
      writer.writeCString(testString);
      writer.writeRawString(testString);
      writer.flush();
      file.seek(0, SeekOrigin.Begin);

      assert.equal(reader.readString(), testString);      
      assert.equal(reader.readRawString(_encoding.encode(testString).length + nullLen).replace(/\0*$/g, ''), testString);
      assert.equal(reader.readRawString(_encoding.encode(testString).length), testString);
      writer.close();
    }
  });

  it('Encoding Ctor And Write Tests | Negative', () => {
    // [] Check for ArgumentNullException on null stream
    assert.throws(() => new BinaryWriter(null, 'utf-8'), TypeError);
    // [] Check for ArgumentNullException on null encoding
    assert.throws(() => new BinaryWriter(openTruncated(), null), TypeError);
  });

  it('Seek Tests', () => {
    let iArrLargeValues = [
      10000, 100000, Math.floor(INT_MAX / 200), Math.floor(INT_MAX / 1000), SHORT_MAX,
      INT_MAX, INT_MAX - 1, Math.floor(INT_MAX / 2), Math.floor(INT_MAX / 10), Math.floor(INT_MAX / 100)
    ];

    let dw2: BinaryWriter;
    let mstr: IFile;
    let bArr: Buffer;
    let sb = '';
    let lReturn = 0;

    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("Hello, this is my string".split(''));
    for (let iLoop = 0; iLoop < iArrLargeValues.length; iLoop++) {
      dw2.file.seek(iArrLargeValues[iLoop], SeekOrigin.Begin);
      lReturn = dw2.file.tell();

      assert.equal(lReturn, iArrLargeValues[iLoop]);
    }
    dw2.close();

    // [] Seek from start of stream
    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    dw2.file.seek(0, SeekOrigin.Begin);
    lReturn = dw2.file.tell();

    assert.equal(lReturn, 0);

    dw2.writeChars("lki".split(''));
    dw2.flush();
    bArr = getFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "lki3456789");

    dw2.close();

    // [] Seek into stream from start
    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);

    dw2.writeChars("0123456789".split(''));
    dw2.file.seek(3, SeekOrigin.Begin);
    lReturn = dw2.file.tell();

    assert.equal(lReturn, 3);

    dw2.writeChars("lk".split(''));
    dw2.flush();
    bArr = getFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "012lk56789");

    dw2.close();

    // [] Seek from end of stream
    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    dw2.file.seek(-3, SeekOrigin.End);
    lReturn = dw2.file.tell();

    assert.equal(lReturn, 7);

    dw2.writeChars("ll".split(''));
    dw2.flush();
    bArr = getFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "0123456ll9");

    dw2.close();

    // [] Seeking from current position
    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    dw2.file.seek(2, SeekOrigin.Begin);
    dw2.file.seek(2, SeekOrigin.Current);
    lReturn = dw2.file.tell();

    assert.equal(lReturn, 4);

    dw2.writeChars("ll".split(''));
    dw2.flush();
    bArr = getFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "0123ll6789");

    dw2.close();

    // [] Seeking past the end from middle
    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    dw2.file.seek(4, SeekOrigin.End);  //This won't throw any exception now.
    lReturn = dw2.file.tell();

    assert.equal(lReturn, 14);

    dw2.close();

    // [] Seek past the end from beginning
    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars("0123456789".split(''));
    dw2.file.seek(11, SeekOrigin.Begin); //This won't throw any exception now.
    lReturn = dw2.file.tell();

    assert.equal(lReturn, 11);

    dw2.close();

    // [] Seek to the end
    mstr = openTruncated();
    dw2 = new BinaryWriter(mstr);
    dw2.writeChars('0123456789'.split(''));
    dw2.file.seek(10, SeekOrigin.Begin);
    lReturn = dw2.file.tell();

    assert.equal(lReturn, 10);

    dw2.writeChars("ll".split(''));
    bArr = getFileContent(mstr);
    sb = bArr.reduce((acc, e) => acc + String.fromCharCode(e), '');

    assert.equal(sb, "0123456789ll");

    dw2.close();
  });

  it('Seek Tests | Negative Offset', () => {
    let testSuite = [-1, -2, -10000, INT_MIN];
    for (let invalidValue of testSuite) {
      // [] IOException if offset is negative
      let memStream = openTruncated();
      let writer = new BinaryWriter(memStream);
      writer.writeChars('Hello, this is my string'.split(''));
      assert.throws(() => writer.file.seek(invalidValue, SeekOrigin.Begin), { code: "EINVAL" })
      writer.close();
    }
  });

  it('Seek Tests | Invalid SeekOrigin', () => {
    // [] ArgumentException for invalid seekOrigin
    let memStream = openTruncated();
    let writer = new BinaryWriter(memStream);
    writer.writeChars("0123456789".split(''));
    assert.throws(() => writer.file.seek(3, null), TypeError);
    writer.close();
  });

  it('BaseStream Tests', () => {
    // [] Get the base stream for MemoryStream
    let ms2 = openTruncated();
    let sr2 = new BinaryWriter(ms2);
    assert.strictEqual(sr2.file, ms2);
    sr2.close();
  });

  it('Flush Tests', () => {
    // [] Check that flush updates the underlying stream
    let memstr2 = openTruncated();
    let bw2 = new BinaryWriter(memstr2);
    let str = "HelloWorld";
    let expectedLength = str.length + 1; // 1 for 7-bit encoded length
    bw2.writeString(str);
    assert.equal(fs.fstatSync(memstr2.fd).size, 0);
    bw2.flush();
    assert.equal(fs.fstatSync(memstr2.fd).size, expectedLength);
    bw2.close();

    // [] Flushing a closed writer may throw an exception
    memstr2 = openTruncated();
    bw2 = new BinaryWriter(memstr2);
    bw2.close();
    assert.throws(() => bw2.flush(), { code: CSCode.FileIsClosed });
  });

  it('Close Tests', () => {
    // Closing multiple times should not throw an exception
    let memStream = openTruncated();
    let binaryWriter = new BinaryWriter(memStream);
    binaryWriter.close();
    binaryWriter.close();
    binaryWriter.close();
  });

  it('Close Tests | Negative', () => {
    let memStream = openTruncated();
    let binaryWriter = new BinaryWriter(memStream);
    binaryWriter.close();
    validateDisposedExceptions(binaryWriter);
  });

  function validateDisposedExceptions(binaryWriter: BinaryWriter) {
    assert.throws(() => binaryWriter.file.seek(1, SeekOrigin.Begin), { code: CSCode.FileIsClosed });
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
    assert.throws(() => binaryWriter.writeCString("Hello"), { code: CSCode.FileIsClosed });
    assert.throws(() => binaryWriter.writeRawString("Bye"), { code: CSCode.FileIsClosed });
  }

  it('OutStream', () => {
    class BinaryWriterOutStream extends BinaryWriter {
      get getOutFd(): IFile { return this._file; }
    }
    let stream = openTruncated();
    let bw = new BinaryWriterOutStream(stream);
    assert.equal(bw.getOutFd, stream);
  });

  it('Leave Open', () => {
    let file = openTruncated();
    assert.ok(file.canWrite, "ERROR: Before testing, file.canWrite property was false! What?");

    // Test leaveOpen
    let bw = new BinaryWriter(file, 'utf8', true);
    bw.close();
    assert.ok(file.canWrite, "ERROR: After closing a BinaryWriter with leaveOpen bool set, file.canWrite property was false!");

    // Test not leaving open
    bw = new BinaryWriter(file, 'utf8', false);
    bw.close();
    assert.ok(!file.canWrite, "ERROR: After closing a BinaryWriter with leaveOpen bool not set, file.canWrite property was true!");

    // Test default
    file = openTruncated();
    bw = new BinaryWriter(file);
    bw.close();
    assert.ok(!file.canWrite, "ERROR: After closing a BinaryWriter with the default value for leaveOpen, file.canWrite property was true!");
  });
});