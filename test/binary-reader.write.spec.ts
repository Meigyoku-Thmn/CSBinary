import assert from 'assert';
import { SHORT_MAX, INT_MIN, INT_MAX, SINGLE_MIN, SINGLE_MAX, SINGLE_EPSILON, DOUBLE_EPSILON, DOUBLE_MIN, DOUBLE_MAX, SHORT_MIN, LONG_MIN, LONG_MAX, USHORT_MIN, USHORT_MAX, UINT_MIN, UINT_MAX, ULONG_MIN, ULONG_MAX } from '../src/constants/number';
import { CSCode } from '../src/constants/error';
import { prepareMock, tearDownMock, reloadCriticalModules, flushCriticalModules } from './mock-prepare';
import { openEmtpyFile } from './utils';
import { constants, seekSync as _seekSync } from 'fs-ext';
import { BinaryReader as _BinaryReader } from '../src/binary-reader';
import { BinaryWriter as _BinaryWriter } from '../src/binary-writer';
import { vol } from 'memfs';
const { SEEK_SET } = constants;
let BinaryReader = _BinaryReader;
let BinaryWriter = _BinaryWriter;
let seekSync = _seekSync;

describe('BinaryReader | Write Tests', () => {
  before(() => {
    prepareMock();
    ({ BinaryReader, BinaryWriter, seekSync } = reloadCriticalModules());
  });
  after(() => {
    tearDownMock();
    flushCriticalModules();
  });
  afterEach(() => {
    vol.reset();
  });

  it('Write Boolean', async () => {
    // [] Write a series of booleans to a stream
    let mstr = openEmtpyFile();
    let dw2 = new BinaryWriter(mstr, 'utf8', true);
    let dr2 = new BinaryReader(mstr);

    dw2.writeBoolean(false);
    dw2.writeBoolean(false);
    dw2.writeBoolean(true);
    dw2.writeBoolean(false);
    dw2.writeBoolean(true);
    dw2.writeInt32(5);
    dw2.writeInt32(0);

    dw2.flush();
    seekSync(mstr, 0, SEEK_SET);

    assert.ok(!dr2.readBoolean());
    assert.ok(!dr2.readBoolean());
    assert.ok(dr2.readBoolean());
    assert.ok(!dr2.readBoolean());
    assert.ok(dr2.readBoolean());
    assert.equal(dr2.readInt32(), 5);
    assert.equal(dr2.readInt32(), 0);

    dw2.close();
    dr2.close();
  });

  it('Write Single', () => {
    let sglArr = [
      SINGLE_MIN, SINGLE_MAX, SINGLE_EPSILON, Infinity, -Infinity, 0,
      0, Math.fround(-1E20), Math.fround(-3.5E-20), Math.fround(1.4E-10), Math.fround(10000.2), Math.fround(2.3E30),
    ];

    writeTest(sglArr, (bw, s) => bw.writeSingle(s), br => br.readSingle());
  });

  it('Write Double', () => {
    let dblArr = [
      -Infinity, Infinity, DOUBLE_EPSILON, DOUBLE_MIN, DOUBLE_MAX,
      -3E59, -1000.5, -1E-40, 3.4E-37, 0.45, 5.55, 3.4899E233,
    ];

    writeTest(dblArr, (bw, s) => bw.writeDouble(s), br => br.readDouble());
  });

  it('Write Int16', () => {
    let i16Arr = [SHORT_MIN, SHORT_MAX, 0, -10000, 10000, -50, 50];

    writeTest(i16Arr, (bw, s) => bw.writeInt16(s), br => br.readInt16());
  });

  it('Write Int32', () => {
    let i32Arr = [INT_MIN, INT_MAX, 0, -10000, 10000, -50, 50];

    writeTest(i32Arr, (bw, s) => bw.writeInt32(s), br => br.readInt32());
  });

  it('Write 7 Bit Encoded Int', () => {
    let i32Arr = [
      INT_MIN, INT_MAX, 0, -10000, 10000, -50, 50,
      0, -1, -101
    ];

    writeTest(i32Arr, (bw, s) => bw.write7BitEncodedInt(s), br => br.read7BitEncodedInt());
  });

  it('Write Int64', () => {
    let i64Arr = [
      LONG_MIN, LONG_MAX, 0, -10000, 10000, -50, 50
    ].map(e => BigInt(e));

    writeTest(i64Arr, (bw, s) => bw.writeInt64(s), br => br.readInt64());
  });

  it.skip('Write 7 Bit Encoded Int64', () => {
    let i64Arr = [
      LONG_MIN, LONG_MAX, 0, -10000, 10000, -50, 50,
      0, -1, -101,
    ].map(e => BigInt(e));

    writeTest(i64Arr, (bw, s) => bw.write7BitEncodedInt64(s), br => br.read7BitEncodedInt64());
  });

  it('Write UInt16', () => {
    let ui16Arr = [
      USHORT_MIN, USHORT_MAX, 0, 100, 1000, 10000, USHORT_MAX - 100
    ];

    writeTest(ui16Arr, (bw, s) => bw.writeUInt16(s), br => br.readUInt16());
  });

  it('Write UInt32', () => {
    let ui32Arr = [
      UINT_MIN, UINT_MAX, 0, 100, 1000, 10000, UINT_MAX - 100
    ];

    writeTest(ui32Arr, (bw, s) => bw.writeUInt32(s), br => br.readUInt32());
  });

  it('Write UInt64', () => {
    let ui64Arr = [
      ULONG_MIN, ULONG_MAX, 0, 100, 1000, 10000, ULONG_MAX - BigInt(100)
    ].map(e => BigInt(e));

    writeTest(ui64Arr, (bw, s) => bw.writeUInt64(s), br => br.readUInt64());
  });

  it('Write String', () => {
    let sb = 'abc'.repeat(5);
    let strArr = [
      "ABC", "\t\t\n\n\n\0\r\r\v\v\t\0\rHello", "This is a normal string", "12345667789!@#$%^&&())_+_)@#",
      "ABSDAFJPIRUETROPEWTGRUOGHJDOLJHLDHWEROTYIETYWsdifhsiudyoweurscnkjhdfusiyugjlskdjfoiwueriye", "     ",
      "\0\0\0\t\t\tHey\"\"", "\u0022\u0011", sb, ''
    ];

    writeTest(strArr, (bw, s) => bw.writeString(s), br => br.readString());
  });

  it('Write String | Null', () => {
    let memStream = openEmtpyFile();
    let dw2 = new BinaryWriter(memStream);
    assert.throws(() => dw2.writeString(null), TypeError);
    dw2.close();
  });

  function writeTest<T>(testElements: T[], write: (w: _BinaryWriter, s: T) => void, read: (r: _BinaryReader) => T) {
    let memStream = openEmtpyFile();
    let writer = new BinaryWriter(memStream, 'utf8', true);
    let reader = new BinaryReader(memStream);

    for (let i = 0; i < testElements.length; i++) {
      write(writer, testElements[i]);
    }

    writer.flush();
    seekSync(memStream, 0, SEEK_SET);

    for (let i = 0; i < testElements.length; i++) {
      assert.strictEqual(read(reader).toString(), testElements[i].toString());
    }

    // We've reached the end of the stream.  Check for expected EndOfStreamException
    assert.throws(() => read(reader), { code: CSCode.ReadBeyondEndOfFile })

    writer.close();
    reader.close();
  }
});