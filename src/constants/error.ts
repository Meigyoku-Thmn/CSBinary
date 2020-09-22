import { enumize } from '../utils/enum';

export const CSCode = enumize(
  'FileNotReadable',
  'FileNotWritable',
  'FileIsClosed',
  'ReadBeyondEndOfFile',
  'InvalidEncodedStringLength',
  'BadEncodedIntFormat',
  'SurrogateCharHit',
  'InvalidCharacterEncoding',
);
export type CSCode = keyof typeof CSCode;