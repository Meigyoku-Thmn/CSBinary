import { IFile } from "./addon/file";
import { BinaryReader } from "./binary-reader";
import { BinaryWriter } from "./binary-writer";

export function createBinaryReader(target: string | number | IFile, encoding: any, leaveOpen: any): BinaryReader {
  throw Error('Not implemented.');
}

export function createBinaryWriter(target: string | number | IFile, encoding: any, leaveOpen: any): BinaryWriter {
  throw Error('Not implemented.');
}