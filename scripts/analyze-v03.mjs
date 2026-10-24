/* global Image,document */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const b = await chromium.launch(),
  p = await b.newPage();
await p.goto('http://127.0.0.1:5175');
const all = await p.evaluate(async () => {
  const result = {};
  for (const name of ['core', 'training', 'commerce', 'relations', 'culture']) {
    const image = new Image();
    image.src = `/art/v03/${name}.webp`;
    await image.decode();
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data,
      alpha = (x, y) => pixels[(y * c.width + x) * 4 + 3];
    const rowCuts = [0];
    for (let row = 1; row < 3; row++) {
      let cut = 0,
        best = Infinity;
      for (let y = Math.floor((row * c.height) / 3 - 80); y < (row * c.height) / 3 + 100; y++) {
        let score = 0;
        for (let x = 0; x < c.width; x++) if (alpha(x, y) > 150) score++;
        score += Math.abs(y - (row * c.height) / 3) * 0.01;
        if (score < best) {
          best = score;
          cut = y;
        }
      }
      rowCuts.push(cut);
    }
    rowCuts.push(c.height);
    const rows = [];
    for (let row = 0; row < 3; row++) {
      const y0 = rowCuts[row],
        y1 = rowCuts[row + 1],
        runs = [];
      let start = -1;
      for (let x = 0; x <= c.width; x++) {
        let count = 0;
        for (let y = y0; y < y1; y++) if (alpha(x, y) > 150) count++;
        if (count >= 3 && start < 0) start = x;
        if ((count < 3 || x === c.width) && start >= 0) {
          runs.push([start, x]);
          start = -1;
        }
      }
      while (runs.length > 5) {
        let index = 0,
          min = Infinity;
        for (let i = 0; i < runs.length - 1; i++) {
          const gap = runs[i + 1][0] - runs[i][1];
          if (gap < min) {
            min = gap;
            index = i;
          }
        }
        runs.splice(index, 2, [runs[index][0], runs[index + 1][1]]);
      }
      if (runs.length !== 5) {
        const cuts = [0];
        for (const fraction of [0.166, 0.342, 0.535, 0.752]) {
          let cut = 0,
            best = Infinity;
          for (let x = Math.round(fraction * c.width - 35); x < fraction * c.width + 35; x++) {
            let count = 0;
            for (let y = y0; y < y1; y++) if (alpha(x, y) > 150) count++;
            const score = count + Math.abs(x - fraction * c.width) * 0.04;
            if (score < best) {
              cut = x;
              best = score;
            }
          }
          cuts.push(cut);
        }
        cuts.push(c.width);
        runs.splice(0, runs.length, ...cuts.slice(0, -1).map((x, i) => [x, cuts[i + 1]]));
      }
      const cells = runs.map(([left, right]) => {
        let minX = c.width,
          minY = c.height,
          maxX = 0,
          maxY = 0;
        for (let x = left; x < right; x++)
          for (let y = y0; y < y1; y++)
            if (alpha(x, y) > 100) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
        return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      });
      rows.push(cells);
    }
    result[name] = rows;
  }
  return result;
});
await writeFile('src/lib/v03-atlas-bounds.json', JSON.stringify(all, null, 2));
console.log(JSON.stringify(all));
await b.close();
