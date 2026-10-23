import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="108" fill="#102540"/><path d="M90 106L256 62 422 106V282Q422 384 256 452Q90 384 90 282Z" fill="#efc875"/><path d="M115 125L256 89 397 125V280Q397 365 256 422Q115 365 115 280Z" fill="#264360"/><path d="M151 168H196L256 250 316 168H361V345H314V247L256 321 198 247V345H151Z" fill="#ffe3a1"/><path d="M165 140L256 116 347 140" stroke="#9eafc5" stroke-width="6" fill="none"/><path d="M224 370L256 352 288 370 256 395Z" fill="#efc875"/></svg>';
writeFileSync('public/assets/monigones.svg', svg);
const crc32 = (b) => {
  let c = -1;
  for (const byte of b) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const t = Buffer.from(type),
    head = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([head, t, data, crc]);
}
const polygons = [
    [
      [90, 106],
      [256, 62],
      [422, 106],
      [422, 282],
      [400, 345],
      [340, 406],
      [256, 452],
      [172, 406],
      [112, 345],
      [90, 282],
    ],
    [
      [115, 125],
      [256, 89],
      [397, 125],
      [397, 280],
      [375, 335],
      [325, 380],
      [256, 422],
      [187, 380],
      [137, 335],
      [115, 280],
    ],
    [
      [151, 168],
      [196, 168],
      [256, 250],
      [316, 168],
      [361, 168],
      [361, 345],
      [314, 345],
      [314, 247],
      [256, 321],
      [198, 247],
      [198, 345],
      [151, 345],
    ],
    [
      [224, 370],
      [256, 352],
      [288, 370],
      [256, 395],
    ],
  ],
  colors = [
    [239, 200, 117],
    [38, 67, 96],
    [255, 227, 161],
    [239, 200, 117],
  ];
function inside(x, y, p) {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (
      p[i][1] > y !== p[j][1] > y &&
      x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]
    )
      yes = !yes;
  return yes;
}
for (const size of [192, 512]) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let c = [16, 37, 64];
      for (let i = 0; i < polygons.length; i++)
        if (inside(((x + 0.5) / size) * 512, ((y + 0.5) / size) * 512, polygons[i])) c = colors[i];
      const pos = y * (size * 4 + 1) + 1 + x * 4;
      pixels[pos] = c[0];
      pixels[pos + 1] = c[1];
      pixels[pos + 2] = c[2];
      pixels[pos + 3] = 255;
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(pixels)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
console.log('Marca MONIGONES original · SVG + iconos PNG generados.');
