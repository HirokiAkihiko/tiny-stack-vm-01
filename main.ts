// Tiny stack VM for make.fun: exact ISA semantics, golfed for size.
import { mkdirSync as a, readdirSync as b, readFileSync as c, writeFileSync as d } from "node:fs";
import { join as e } from "node:path";
const P = "00011223" + ".".repeat(8) + "222222212221222.222" + ".".repeat(13) + "01100" + ".".repeat(11) + "12" + ".".repeat(14) + "1101", Q = "01102233" + ".".repeat(8) + "111111111111111.111" + ".".repeat(13) + "00000" + ".".repeat(11) + "10" + ".".repeat(14) + "0010", B = [(x, y) => x + y, (x, y) => x - y, Math.imul, (x, y) => x / y | 0, (x, y) => x % y, (x, y) => (x >>> 0) / (y >>> 0) | 0, (x, y) => (x >>> 0) % (y >>> 0), 0, (x, y) => x & y, (x, y) => x | y, (x, y) => x ^ y, 0, (x, y) => x << y, (x, y) => x >> y, (x, y) => x >>> y, 0, (x, y) => x == y ? 1 : 0, (x, y) => x < y ? 1 : 0, (x, y) => (x >>> 0) < (y >>> 0) ? 1 : 0];
function run(p, f) {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), O = new Uint8Array(65536);
  let s = 0, g = 0, o = 0, i = 0, h = 0, t = 0;
  const F = x => ({ b: O.subarray(0, o), x });
  try {
    for (;;) {
      if (t >= 1e6) throw 10;
      if (h < 0 || h >= p.length) throw 9;
      const k = p[h];
      if (k > 83 || P.charCodeAt(k) == 46) throw 5;
      const m = k == 1 ? 1 : k == 2 ? 4 : k >= 48 && k <= 51 ? 2 : 0;
      if (h + m >= p.length) throw 9;
      t++;
      const u = P.charCodeAt(k) - 48, v = Q.charCodeAt(k) - 48;
      if (s < u) throw 2;
      if (s - u + v > 256) throw 3;
      const n = h + 1 + m; h = n;
      if (k == 0) return F(0);
      if (k == 1) { const w = p[n - 1]; D[s++] = w > 127 ? w - 256 : w; }
      if (k == 2) D[s++] = p[n - 4] | p[n - 3] << 8 | p[n - 2] << 16 | p[n - 1] << 24;
      if (k == 3) s--;
      if (k == 4) { D[s] = D[s - 1]; s++; }
      if (k == 5) { const w = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = w; }
      if (k == 6) { D[s] = D[s - 2]; s++; }
      if (k == 7) { const w = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = w; }
      if (k == 23) D[s - 1] = -D[s - 1];
      if (k == 27) D[s - 1] = ~D[s - 1];
      if (k >= 16 && k <= 34 && k != 23 && k != 27) { const y = D[s - 1]; if (k >= 19 && k <= 22 && !y) throw 4; D[s - 2] = B[k - 16](D[s - 2], y); s--; }
      if (k >= 48 && k <= 50) { const r = ((p[n - 2] | p[n - 1] << 8) << 16) >> 16; let j = k == 48; if (k != 48) { const w = D[--s]; j = k == 49 ? w == 0 : w != 0; } if (j) h = n + r; }
      if (k == 51) { if (g >= 64) throw 7; C[g++] = n; h = p[n - 2] | p[n - 1] << 8; }
      if (k == 52) { if (!g) throw 8; h = C[--g]; }
      if (k == 64) { const w = D[s - 1]; if (w < 0 || w > 255) throw 6; D[s - 1] = M[w]; }
      if (k == 65) { const w = D[s - 1]; if (w < 0 || w > 255) throw 6; M[w] = D[s - 2]; s -= 2; }
      if (k == 80) { const w = String(D[s - 1]); if (o + w.length > 65536) throw 11; s--; for (let q = 0; q < w.length;) O[o++] = w.charCodeAt(q++); }
      if (k == 81) { if (o >= 65536) throw 11; O[o++] = D[--s] & 255; }
      if (k == 82) D[s++] = i < f.length ? f[i++] : -1;
      if (k == 83) return F(D[--s] & 255);
    }
  } catch (x) { return F(x); }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? "/input", W = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const id of b(I).sort()) {
  let f = new Uint8Array(0);
  try { f = new Uint8Array(c(e(I, id, "input.bin"))); } catch { f = new Uint8Array(0); }
  const r = run(new Uint8Array(c(e(I, id, "program.bin"))), f);
  a(e(W, id), { recursive: true });
  d(e(W, id, "stdout.bin"), r.b);
  d(e(W, id, "exit.txt"), r.x + "\n");
}
