import iconv, { DecoderStream, EncoderStream } from 'iconv-lite';
import { raise } from './utils/error';
import { CSCode } from './constants/error';

/** Represents a character encoding. */
export interface IEncoding {
  /** Obtain a decoder that converts an encoded sequence of bytes into string. */
  getDecoder(): IDecoder;
  /** Obtains an encoder that converts a sequence of Unicode characters into an encoded sequence of bytes. */
  getEncoder?(): IEncoder; // Unused for now
  /**
   * Returns the byte length of a string when encoded using this encoding
   * @param str A value to calculate the length of.
   */
  byteLength(str: string): number;
  /**
   * Decode a buffer to a string. Any incomplete characters will be replaced with substitution characters appropriate for the character encoding.
   * @param buf A buffer to decode.
   */
  decode?(buf: Buffer): string; // Unused for now
  /**
   * Encode a string to a buffer. Any incomplete characters will be replaced with substitution characters and encoded appropriate for the character encoding.
   * @param str A string to encode.
   */
  encode(str: string): Buffer;
}

/** Converts a set of characters into a sequence of bytes. */
export interface IEncoder {
  /** Check if this encoder currently has accumulated state. */
  hasState: boolean;
  /**
   * Returns an encoded buffer, ensuring that any incomplete characters at the end of the string are omitted from the returned Buffer and stored in an internal buffer for the next call to write() or end().
   * @param str A string to encode.
   */
  write(str: string): Buffer;
  /** Returns any remaining input stored in the internal buffer as a Buffer. Incomplete characters will be replaced with substitution characters and encoded appropriate for the character encoding. */
  end(): Buffer;
}

/** Converts a sequence of encoded bytes into a set of characters. */
export interface IDecoder {
  /** Check if this decoder currently has accumulated state in the internal buffer. */
  hasState: boolean;
  /**
   * Returns a decoded string, ensuring that any incomplete multibyte characters at the end of the Buffer are omitted from the returned string and stored in an internal buffer for the next call to write() or end().
   * @param buf A buffer containing the bytes to decode.
   */
  write(buf: Buffer): string;
  /** Returns any remaining input stored in the internal buffer as a string. Bytes representing incomplete characters will be replaced with substitution characters appropriate for the character encoding. */
  end(): string;
}

/**@internal */
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

/**@internal */
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

/**@internal */
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