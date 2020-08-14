import iconv, { DecoderStream, EncoderStream } from 'iconv-lite';
import { raise } from './utils/error';
import { CSCode } from './constants/error';

export interface IEncoding {
  getDecoder(): IDecoder;
  getEncoder?(): IEncoder; // Unused for now
  byteLength(str: string): number;
  decode?(buf: Buffer): string; // Unused for now
  encode(str: string): Buffer;
}

export interface IEncoder {
  hasState: boolean;
  write(str: string): Buffer;
  end(): Buffer;
}

export interface IDecoder {
  hasState: boolean;
  write(buf: Buffer): string;
  end(): string;
}

export class Encoding implements IEncoding {
  constructor(private encoding: string | BufferEncoding) {
    if (!iconv.encodingExists(encoding))
      raise(Error('Unknown character encoding.'), CSCode.InvalidCharacterEncoding)
  }
  getDecoder(): IDecoder {
    return new Decoder(this.encoding);
  }
  getEncoder(): IEncoder {
    return new Encoder(this.encoding);
  }
  byteLength(str: string): number {
    return iconv.byteLength(str, this.encoding);
  }
  decode(buf: Buffer): string {
    return iconv.decode(buf, this.encoding);
  }
  encode(str: string): Buffer {
    return iconv.encode(str, this.encoding);
  }
}

export class Encoder implements IEncoder {
  private encoder: EncoderStream;
  constructor(encoding: string) {
    this.encoder = iconv.getEncoder(encoding);
  }
  get hasState(): boolean {
    return this.encoder.hasState;
  };
  write(str: string): Buffer {
    return this.encoder.write(str);
  }
  end(): Buffer {
    return this.encoder.end();
  }
}

export class Decoder implements IDecoder {
  private decoder: DecoderStream;
  constructor(encoding: string) {
    this.decoder = iconv.getDecoder(encoding);
  }
  get hasState(): boolean {
    return this.decoder.hasState;
  };
  write(buf: Buffer): string {
    return this.decoder.write(buf);
  }
  end(): string {
    return this.decoder.end();
  }
}