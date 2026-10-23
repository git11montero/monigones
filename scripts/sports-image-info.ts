/** Lectura de cabeceras; el navegador comprueba además la decodificación completa. */
export function imageDimensions(b: Buffer): { width: number; height: number } {
  if (b.length < 30) throw Error('Imagen incompleta.');
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 255 && b[1] === 216) {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i++] !== 255) continue;
      let marker = b[i++];
      while (marker === 255) marker = b[i++];
      if (marker === 217 || marker === 218) break;
      const length = b.readUInt16BE(i);
      if (length < 2 || i + length > b.length) throw Error('JPEG incompleto.');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker))
        return { height: b.readUInt16BE(i + 3), width: b.readUInt16BE(i + 5) };
      i += length;
    }
    throw Error('JPEG sin dimensiones.');
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const type = b.toString('ascii', 12, 16);
    if (type === 'VP8X') return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
    if (type === 'VP8L')
      return {
        width: 1 + (b[21] | ((b[22] & 63) << 8)),
        height: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 15) << 10)),
      };
    if (type === 'VP8 ')
      return { width: b.readUInt16LE(26) & 16383, height: b.readUInt16LE(28) & 16383 };
  }
  throw Error('Cabecera de imagen no compatible.');
}
