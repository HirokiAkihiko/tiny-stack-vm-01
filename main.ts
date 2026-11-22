// Tiny stack machine interpreter written for the make.fun tiny-stack-vm bounty.
// It walks each case folder, executes the bytecode program held there against
// its input bytes, and records the produced bytes plus the final exit code.
// Arithmetic wraps to signed 32 bits, division and remainder follow the ISA's
// signed and unsigned variants, and every fault ends the run with its own
// trap code while keeping whatever output was already produced.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Shape of one opcode entry: how many immediate bytes follow it, how many
// values it consumes from the data pile, and how many it leaves behind.
type Shape = [number, number, number];
const SHAPES = new Map<number, Shape>([
  [0, [0, 0, 0]], [1, [1, 0, 1]], [2, [4, 0, 1]], [3, [0, 1, 0]],
  [4, [0, 1, 2]], [5, [0, 2, 2]], [6, [0, 2, 3]], [7, [0, 3, 3]],
  [16, [0, 2, 1]], [17, [0, 2, 1]], [18, [0, 2, 1]], [19, [0, 2, 1]],
  [20, [0, 2, 1]], [21, [0, 2, 1]], [22, [0, 2, 1]], [23, [0, 1, 1]],
  [24, [0, 2, 1]], [25, [0, 2, 1]], [26, [0, 2, 1]], [27, [0, 1, 1]],
  [28, [0, 2, 1]], [29, [0, 2, 1]], [30, [0, 2, 1]],
  [32, [0, 2, 1]], [33, [0, 2, 1]], [34, [0, 2, 1]],
  [48, [2, 0, 0]], [49, [2, 1, 0]], [50, [2, 1, 0]],
  [51, [2, 0, 0]], [52, [0, 0, 0]],
  [64, [0, 1, 1]], [65, [0, 2, 0]],
  [80, [0, 1, 0]], [81, [0, 1, 0]], [82, [0, 0, 1]], [83, [0, 1, 0]],
]);

const PILE_CAP = 256;
const CALL_CAP = 64;
const RAM_WORDS = 256;
const TICK_CAP = 1000000;
const SINK_CAP = 65536;

function execute(code: Uint8Array, feed: Uint8Array): { bytes: Uint8Array; code: number } {
  const pile = new Int32Array(PILE_CAP);
  let top = 0;
  const rets = new Int32Array(CALL_CAP);
  let depth = 0;
  const ram = new Int32Array(RAM_WORDS);
  const sink = new Uint8Array(SINK_CAP);
  let filled = 0;
  let cursor = 0;
  let head = 0;
  let ticks = 0;
  const finish = (status: number) => ({ bytes: sink.subarray(0, filled), code: status });

  while (true) {
    if (ticks >= TICK_CAP) return finish(10);
    if (head < 0 || head >= code.length) return finish(9);
    const op = code[head];
    const shape = SHAPES.get(op);
    if (shape === undefined) return finish(5);
    const [immLen, need, leave] = shape;
    if (head + immLen >= code.length) return finish(9);
    ticks += 1;
    if (top < need) return finish(2);
    if (top - need + leave > PILE_CAP) return finish(3);
    const after = head + 1 + immLen;
    head = after;

    if (op === 0) return finish(0);
    if (op === 1) {
      const raw = code[after - 1];
      pile[top++] = raw > 127 ? raw - 256 : raw;
      continue;
    }
    if (op === 2) {
      let word = 0;
      for (let k = 0; k < 4; k++) word |= code[after - 4 + k] << (8 * k);
      pile[top++] = word | 0;
      continue;
    }
    if (op === 3) { top -= 1; continue; }
    if (op === 4) { pile[top] = pile[top - 1]; top += 1; continue; }
    if (op === 5) {
      const upper = pile[top - 1];
      pile[top - 1] = pile[top - 2];
      pile[top - 2] = upper;
      continue;
    }
    if (op === 6) { pile[top] = pile[top - 2]; top += 1; continue; }
    if (op === 7) {
      const first = pile[top - 3];
      pile[top - 3] = pile[top - 2];
      pile[top - 2] = pile[top - 1];
      pile[top - 1] = first;
      continue;
    }
    if (op === 23) { pile[top - 1] = (-pile[top - 1]) | 0; continue; }
    if (op === 27) { pile[top - 1] = ~pile[top - 1]; continue; }

    if (op >= 16 && op <= 34 && op !== 23 && op !== 27) {
      const rhs = pile[top - 1];
      const lhs = pile[top - 2];
      let value: number;
      if (op === 16) value = (lhs + rhs) | 0;
      else if (op === 17) value = (lhs - rhs) | 0;
      else if (op === 18) value = Math.imul(lhs, rhs);
      else if (op === 19) {
        if (rhs === 0) return finish(4);
        value = lhs === -2147483648 && rhs === -1 ? lhs : Math.trunc(lhs / rhs) | 0;
      } else if (op === 20) {
        if (rhs === 0) return finish(4);
        value = rhs === -1 ? 0 : (lhs % rhs) | 0;
      } else if (op === 21) {
        if (rhs === 0) return finish(4);
        value = Math.floor((lhs >>> 0) / (rhs >>> 0)) | 0;
      } else if (op === 22) {
        if (rhs === 0) return finish(4);
        value = ((lhs >>> 0) % (rhs >>> 0)) | 0;
      } else if (op === 24) value = lhs & rhs;
      else if (op === 25) value = lhs | rhs;
      else if (op === 26) value = lhs ^ rhs;
      else if (op === 28) value = lhs << (rhs & 31);
      else if (op === 29) value = lhs >> (rhs & 31);
      else if (op === 30) value = (lhs >>> (rhs & 31)) | 0;
      else if (op === 32) value = lhs === rhs ? 1 : 0;
      else if (op === 33) value = lhs < rhs ? 1 : 0;
      else value = (lhs >>> 0) < (rhs >>> 0) ? 1 : 0;
      top -= 1;
      pile[top - 1] = value;
      continue;
    }

    if (op === 48 || op === 49 || op === 50) {
      const rel = ((code[after - 2] | (code[after - 1] << 8)) << 16) >> 16;
      let jump = op === 48;
      if (op !== 48) {
        const flag = pile[--top];
        jump = op === 49 ? flag === 0 : flag !== 0;
      }
      if (jump) head = after + rel;
      continue;
    }
    if (op === 51) {
      if (depth >= CALL_CAP) return finish(7);
      rets[depth++] = after;
      head = code[after - 2] | (code[after - 1] << 8);
      continue;
    }
    if (op === 52) {
      if (depth === 0) return finish(8);
      head = rets[--depth];
      continue;
    }
    if (op === 64) {
      const addr = pile[top - 1];
      if (addr < 0 || addr >= RAM_WORDS) return finish(6);
      pile[top - 1] = ram[addr];
      continue;
    }
    if (op === 65) {
      const addr = pile[top - 1];
      const stored = pile[top - 2];
      if (addr < 0 || addr >= RAM_WORDS) return finish(6);
      top -= 2;
      ram[addr] = stored;
      continue;
    }
    if (op === 80) {
      const text = String(pile[top - 1]);
      if (filled + text.length > SINK_CAP) return finish(11);
      top -= 1;
      for (let k = 0; k < text.length; k++) sink[filled++] = text.charCodeAt(k);
      continue;
    }
    if (op === 81) {
      if (filled + 1 > SINK_CAP) return finish(11);
      sink[filled++] = pile[--top] & 255;
      continue;
    }
    if (op === 82) {
      pile[top++] = cursor < feed.length ? feed[cursor++] : -1;
      continue;
    }
    if (op === 83) return finish(pile[--top] & 255);
    return finish(5);
  }
}

const inputRoot = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const id of readdirSync(inputRoot).sort()) {
  const prog = new Uint8Array(readFileSync(join(inputRoot, id, "program.bin")));
  let feed = new Uint8Array(0);
  try {
    feed = new Uint8Array(readFileSync(join(inputRoot, id, "input.bin")));
  } catch {
    feed = new Uint8Array(0);
  }
  const result = execute(prog, feed);
  mkdirSync(join(outputRoot, id), { recursive: true });
  writeFileSync(join(outputRoot, id, "stdout.bin"), result.bytes);
  writeFileSync(join(outputRoot, id, "exit.txt"), `${result.code}\n`);
}
