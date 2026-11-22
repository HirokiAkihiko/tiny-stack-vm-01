// Compact stack VM for the make.fun tiny-stack-vm bounty: exact ISA semantics
// in few bytes, since equal scores are ranked by entry size.
import { mkdirSync as mk, readdirSync as ls, readFileSync as rf, writeFileSync as wf } from "node:fs";
import { join as J } from "node:path";

// Stack needs per opcode byte 0..83 (dot = no such opcode): P pops, Q pushes.
const P = "00011223" + ".".repeat(8) + "222222212221222.222" + ".".repeat(13) + "01100" + ".".repeat(11) + "12" + ".".repeat(14) + "1101";
const Q = "01102233" + ".".repeat(8) + "111111111111111.111" + ".".repeat(13) + "00000" + ".".repeat(11) + "10" + ".".repeat(14) + "0010";

function run(p: Uint8Array, f: Uint8Array) {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), O = new Uint8Array(65536);
  let s = 0, c = 0, o = 0, i = 0, h = 0, t = 0;
  const F = (x: number) => ({ b: O.subarray(0, o), x });
  for (;;) {
    if (t >= 1e6) return F(10);
    if (h < 0 || h >= p.length) return F(9);
    const k = p[h];
    if (k > 83 || P.charCodeAt(k) === 46) return F(5);
    const m = k === 1 ? 1 : k === 2 ? 4 : k >= 48 && k <= 51 ? 2 : 0;
    if (h + m >= p.length) return F(9);
    t++;
    if (s < P.charCodeAt(k) - 48) return F(2);
    if (s - (P.charCodeAt(k) - 48) + (Q.charCodeAt(k) - 48) > 256) return F(3);
    const n = h + 1 + m;
    h = n;
    if (k === 0) return F(0);
    else if (k === 1) { const v = p[n - 1]; D[s++] = v > 127 ? v - 256 : v; }
    else if (k === 2) D[s++] = p[n - 4] | (p[n - 3] << 8) | (p[n - 2] << 16) | (p[n - 1] << 24);
    else if (k === 3) s--;
    else if (k === 4) { D[s] = D[s - 1]; s++; }
    else if (k === 5) { const v = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = v; }
    else if (k === 6) { D[s] = D[s - 2]; s++; }
    else if (k === 7) { const v = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = v; }
    else if (k === 23) D[s - 1] = -D[s - 1];
    else if (k === 27) D[s - 1] = ~D[s - 1];
    else if (k >= 16 && k <= 34) {
      const y = D[s - 1], x = D[s - 2];
      let r = 0;
      if (k === 16) r = x + y;
      else if (k === 17) r = x - y;
      else if (k === 18) r = Math.imul(x, y);
      else if (k === 19) { if (!y) return F(4); r = Math.trunc(x / y); }
      else if (k === 20) { if (!y) return F(4); r = x % y; }
      else if (k === 21) { if (!y) return F(4); r = Math.floor((x >>> 0) / (y >>> 0)); }
      else if (k === 22) { if (!y) return F(4); r = (x >>> 0) % (y >>> 0); }
      else if (k === 24) r = x & y;
      else if (k === 25) r = x | y;
      else if (k === 26) r = x ^ y;
      else if (k === 28) r = x << (y & 31);
      else if (k === 29) r = x >> (y & 31);
      else if (k === 30) r = x >>> (y & 31);
      else if (k === 32) r = x === y ? 1 : 0;
      else if (k === 33) r = x < y ? 1 : 0;
      else r = (x >>> 0) < (y >>> 0) ? 1 : 0;
      s--;
      D[s - 1] = r;
    }
    else if (k >= 48 && k <= 50) {
      const rel = ((p[n - 2] | (p[n - 1] << 8)) << 16) >> 16;
      let j = k === 48;
      if (k !== 48) { const v = D[--s]; j = k === 49 ? v === 0 : v !== 0; }
      if (j) h = n + rel;
    }
    else if (k === 51) { if (c >= 64) return F(7); C[c++] = n; h = p[n - 2] | (p[n - 1] << 8); }
    else if (k === 52) { if (!c) return F(8); h = C[--c]; }
    else if (k === 64) { const a = D[s - 1]; if (a < 0 || a > 255) return F(6); D[s - 1] = M[a]; }
    else if (k === 65) { const a = D[s - 1]; if (a < 0 || a > 255) return F(6); M[a] = D[s - 2]; s -= 2; }
    else if (k === 80) {
      const w = String(D[s - 1]);
      if (o + w.length > 65536) return F(11);
      s--;
      for (let q = 0; q < w.length; q++) O[o++] = w.charCodeAt(q);
    }
    else if (k === 81) { if (o >= 65536) return F(11); O[o++] = D[--s] & 255; }
    else if (k === 82) D[s++] = i < f.length ? f[i++] : -1;
    else if (k === 83) return F(D[--s] & 255);
    else return F(5);
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? "/input", W = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const id of ls(I).sort()) {
  let f = new Uint8Array(0);
  try { f = new Uint8Array(rf(J(I, id, "input.bin"))); } catch { f = new Uint8Array(0); }
  const r = run(new Uint8Array(rf(J(I, id, "program.bin"))), f);
  mk(J(W, id), { recursive: true });
  wf(J(W, id, "stdout.bin"), r.b);
  wf(J(W, id, "exit.txt"), r.x + "\n");
}
