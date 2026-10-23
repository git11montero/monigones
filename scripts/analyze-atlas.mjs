/* global Image, document */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5175/');
const atlas = await page.evaluate(async () => {
  const result = {};
  const rowBands = {
    core: [0, 380, 700, 1024],
    training: [0, 375, 685, 1024],
    commerce: [0, 350, 695, 1024],
    relations: [0, 350, 690, 1024],
    culture: [0, 345, 670, 1024],
    facilities: [0, 350, 700, 1024],
    props: [0, 350, 620, 940, 1254],
  };
  for (const [name, band] of Object.entries(rowBands)) {
    const img = new Image();
    img.src = `/art/${name}-atlas.webp`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const width = img.width,
      cols = ['props', 'facilities'].includes(name) ? 4 : 5,
      step = width / cols;
    const rows = [];
    for (let row = 0; row < band.length - 1; row++) {
      const y0 = band[row],
        y1 = band[row + 1],
        counts = Array.from({ length: width }, (_, x) => {
          let n = 0;
          for (let y = y0; y < Math.min(y1, img.height); y++)
            if (data[(y * width + x) * 4 + 3] > 150) n++;
          return n;
        });
      const cuts = [0];
      for (let col = 1; col < cols; col++) {
        let best = col * step,
          bestV = Infinity;
        for (let x = Math.round(col * step - 68); x < col * step + 54; x++) {
          let v = 0;
          for (let dx = -4; dx <= 4; dx++) v += counts[x + dx] || 0;
          v += Math.abs(x - col * step) * 0.005;
          if (v < bestV) {
            bestV = v;
            best = x;
          }
        }
        cuts.push(best);
      }
      cuts.push(width);
      const cells = [];
      for (let col = 0; col < cols; col++) {
        let minx = width,
          maxx = 0,
          miny = img.height,
          maxy = 0;
        for (let x = cuts[col]; x < cuts[col + 1]; x++)
          for (let y = y0; y < Math.min(y1, img.height); y++)
            if (data[(y * width + x) * 4 + 3] > 120) {
              minx = Math.min(minx, x);
              maxx = Math.max(maxx, x);
              miny = Math.min(miny, y);
              maxy = Math.max(maxy, y);
            }
        cells.push({ x: minx, y: miny, width: maxx - minx + 1, height: maxy - miny + 1 });
      }
      rows.push(cells);
    }
    result[name] = rows;
  }
  return result;
});
await writeFile('src/lib/atlas-bounds.json', JSON.stringify(atlas, null, 2));
console.log(JSON.stringify(atlas));
await browser.close();
