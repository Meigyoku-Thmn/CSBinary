import assert from 'assert';
import { prepareMock, tearDownMock, reloadCriticalModules, flushCriticalModules } from './mock-prepare';
import { openEmtpyFile, getMockFileContent, openLastEmptyFile } from './utils';
import { constants, seekSync as _seekSync } from 'fs-ext';
import { BinaryReader as _BinaryReader } from '../src/binary-reader';
import { BinaryWriter as _BinaryWriter } from '../src/binary-writer';
import { vol } from 'memfs';
const { SEEK_CUR } = constants;
let BinaryWriter = _BinaryWriter;
let seekSync = _seekSync;

describe('BinaryWriter | Close Asyncs Tests', () => {
  before(() => {
    prepareMock();
    ({ BinaryWriter, seekSync } = reloadCriticalModules());
  });
  after(() => {
    tearDownMock();
    flushCriticalModules();
  });
  afterEach(() => {
    vol.reset();
  });

  it('Can Invoke Multiple Times', async () => {
    let ms = openEmtpyFile();
    let bw = new BinaryWriter(ms);
    await bw.closeAsync();
    await bw.closeAsync();
  });

  it('Can Close Async After Close', async () => {
    let ms = openEmtpyFile();
    let bw = new BinaryWriter(ms);
    bw.close();
    await bw.closeAsync();
  });

  it.skip('Flushes Stream', async () => {
    let ms = openEmtpyFile();
    let bs = 0;
    let bw = new BinaryWriter(ms);

    bw.writeInt32(42);
    // assert.equal();

    await bw.closeAsync();

    assert.throws(() => seekSync(ms, 0, SEEK_CUR), { code: "EBADF" });
    assert.equal(getMockFileContent(openLastEmptyFile()).length, 4);
  });

  it('Leave Open | True', async () => {
    let ms = openEmtpyFile();
    let bw = new BinaryWriter(ms, 'utf-8', true);

    bw.writeInt32(42);
    await bw.closeAsync();

    assert.equal(seekSync(ms, 0, SEEK_CUR), 4);
  });

  it('Derived Type | Forces Close To Be Used Unless Overridden', async () => {
    class OverrideCloseBinaryWriter extends BinaryWriter {
      disposeInvoked = false;
      close() { this.disposeInvoked = true; }
    }

    let ms = openEmtpyFile();
    let bw = new OverrideCloseBinaryWriter(ms);

    bw.writeInt32(42);

    assert.ok(!bw.disposeInvoked);
    await bw.closeAsync();
    assert.ok(bw.disposeInvoked);
  });

  it('Derived Type | CloseAsync Invoked', async () => {
    class OverrideCloseAndCloseAsyncBinaryWriter extends BinaryWriter {
      disposeInvoked = false;
      disposeAsyncInvoked = false;
      close() { this.disposeInvoked = true; }
      async closeAsync() { this.disposeAsyncInvoked = true; }
    }

    let ms = openEmtpyFile();
    let bw = new OverrideCloseAndCloseAsyncBinaryWriter(ms);

    bw.writeInt32(42);

    assert.ok(!bw.disposeInvoked);
    assert.ok(!bw.disposeAsyncInvoked);
    await bw.closeAsync();
    assert.ok(!bw.disposeInvoked);
    assert.ok(bw.disposeAsyncInvoked);
  });
});