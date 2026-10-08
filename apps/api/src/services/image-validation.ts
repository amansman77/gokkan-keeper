// Structural validation of bounded PNG/JPEG/WebP uploads. This is not a malware
// scanner or a full image decoder; never render uploaded files as active content.
const MAX_PIXELS = 25_000_000;
const dimensions = (width: number, height: number) => width > 0 && height > 0 && width <= 10000 && height <= 10000 && width * height <= MAX_PIXELS;
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

export function isValidImage(bytes: Uint8Array, mime: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png') {
    if (bytes.length < 57 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return false;
    let offset = 8, header = false, image = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset), type = text(bytes.subarray(offset + 4, offset + 8));
      if (length > bytes.length - offset - 12) return false;
      if (view.getUint32(offset + 8 + length) !== crc32(bytes.subarray(offset + 4, offset + 8 + length))) return false;
      if (!header) {
        if (type !== 'IHDR' || length !== 13 || !dimensions(view.getUint32(offset + 8), view.getUint32(offset + 12))) return false;
        header = true;
      } else if (type === 'IHDR') return false;
      if (type === 'acTL') return false; // Screenshots must be static.
      if (type === 'IDAT' && length) image = true;
      offset += length + 12;
      if (type === 'IEND') return length === 0 && image && offset === bytes.length;
    }
    return false;
  }
  if (mime === 'image/jpeg') {
    if (bytes.length < 20 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return false;
    let offset = 2, frame = false;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) return false;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (offset + 2 > bytes.length) return false;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return false;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || !dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3))) return false;
        frame = true;
      }
      if (marker === 0xda) return frame && offset + length < bytes.length - 2;
      offset += length;
    }
    return false;
  }
  if (mime === 'image/webp') {
    if (bytes.length < 26 || text(bytes.subarray(0, 4)) !== 'RIFF' || text(bytes.subarray(8, 12)) !== 'WEBP' || view.getUint32(4, true) !== bytes.length - 8) return false;
    let offset = 12, image = false;
    while (offset + 8 <= bytes.length) {
      const type = text(bytes.subarray(offset, offset + 4)), length = view.getUint32(offset + 4, true), start = offset + 8;
      if (length > bytes.length - start) return false;
      if (type === 'ANIM' || type === 'ANMF') return false;
      if (type === 'VP8 ') {
        if (length < 10 || text(bytes.subarray(start + 3, start + 6)) !== '\x9d\x01\x2a' || !dimensions(view.getUint16(start + 6, true) & 16383, view.getUint16(start + 8, true) & 16383)) return false;
        image = true;
      }
      if (type === 'VP8L') {
        if (length < 5 || bytes[start] !== 0x2f) return false;
        const bits = view.getUint32(start + 1, true);
        if (!dimensions((bits & 16383) + 1, ((bits >>> 14) & 16383) + 1)) return false;
        image = true;
      }
      offset = start + length + (length % 2);
    }
    return image && offset === bytes.length;
  }
  return false;
}
