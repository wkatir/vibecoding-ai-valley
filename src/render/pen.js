import { makeCanvas } from './platform.js';

export const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Pixel pen: every call draws whole pixels on a small canvas.
export class Pen {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = makeCanvas(w, h);
    this.g = this.canvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
  }

  px(x, y, c) {
    this.g.fillStyle = c;
    this.g.fillRect(Math.round(x), Math.round(y), 1, 1);
    return this;
  }

  rect(x, y, w, h, c) {
    this.g.fillStyle = c;
    this.g.fillRect(Math.round(x), Math.round(y), w, h);
    return this;
  }

  hline(x, y, w, c) {
    return this.rect(x, y, w, 1, c);
  }

  vline(x, y, h, c) {
    return this.rect(x, y, 1, h, c);
  }

  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y + 0.6 * r));
      this.rect(cx - half, cy + y, half * 2 + 1, 1, c);
    }
    return this;
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))) + 0.5);
      this.rect(cx - half, cy + y, half * 2 + 1, 1, c);
    }
    return this;
  }

  // Stamp ASCII art. '.' is transparent, other chars index into pal.
  stamp(x, y, rows, pal) {
    rows.forEach((row, r) => {
      for (let col = 0; col < row.length; col++) {
        const ch = row[col];
        if (ch !== '.' && ch !== ' ' && pal[ch]) this.px(x + col, y + r, pal[ch]);
      }
    });
    return this;
  }

  // Draws a bitmap (array of strings) in one color.
  bitmap(x, y, rows, c) {
    rows.forEach((row, r) => {
      for (let col = 0; col < row.length; col++) if (row[col] === '#') this.px(x + col, y + r, c);
    });
    return this;
  }

  // One pixel outline around everything opaque.
  outline(color) {
    const { w, h } = this;
    const img = this.g.getImageData(0, 0, w, h);
    const d = img.data;
    const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
    const [r, g, b] = hexToRgb(color);
    const marks = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (alpha(x, y) > 0) continue;
        if (alpha(x - 1, y) > 128 || alpha(x + 1, y) > 128 || alpha(x, y - 1) > 128 || alpha(x, y + 1) > 128) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) {
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
    this.g.putImageData(img, 0, 0);
    return this;
  }
}
