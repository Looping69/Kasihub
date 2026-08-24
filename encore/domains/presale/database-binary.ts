export type DatabaseBinary = Buffer | ArrayBuffer | ArrayBufferView;

/** Normalize PostgreSQL bytea values across Encore's local and cloud drivers. */
export function databaseBinaryToBuffer(value: DatabaseBinary): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}
