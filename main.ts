// Tiny stack VM: a complete interpreter of make.fun's tiny stack ISA (v1).
// Runs every program in /input/<id>/ and writes its stdout and exit code to /output/<id>/.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode metadata: bit 7 = known opcode; bits 0-2 = immediate bytes; bits 3-4 = pops; bits 5-6 = pushes.
const T = new Uint8Array(256);
for (const [o, m] of [[0, 128], [1, 161], [2, 164], [3, 136], [4, 200], [5, 208], [6, 240], [7, 248], [16, 176], [17, 176], [18, 176], [19, 176], [20, 176], [21, 176], [22, 176], [23, 168], [24, 176], [25, 176], [26, 176], [27, 168], [28, 176], [29, 176], [30, 176], [32, 176], [33, 176], [34, 176], [48, 130], [49, 138], [50, 138], [51, 130], [52, 128], [64, 168], [65, 144], [80, 136], [81, 136], [82, 160], [83, 136]]) T[o] = m;

function run(p: Uint8Array, q: Uint8Array): [Uint8Array, number] {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), O = new Uint8Array(65536);
  let sp = 0, cp = 0, pc = 0, st = 0, ol = 0, ip = 0;
  const d = (c: number): [Uint8Array, number] => [O.subarray(0, ol), c];
  for (;;) {
    if (st === 1000000) return d(10);
    if (pc < 0 || pc >= n) return d(9);
    const o = p[pc], m = T[o];
    if (!m) return d(5);
    const im = m & 7, po = (m >> 3) & 3, pu = (m >> 5) & 3;
    if (pc + im >= n) return d(9);
    st++;
    const nx = pc + 1 + im;
    if (sp < po) return d(2);
    if (sp - po + pu > 256) return d(3);
    pc = nx;
    switch (o) {
      case 0: return d(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        switch (o) {
          case 16: r = (a + b) | 0; break;
          case 17: r = (a - b) | 0; break;
          case 18: r = Math.imul(a, b); break;
          case 19: if (!b) return d(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; break;
          case 20: if (!b) return d(4); r = b === -1 ? 0 : (a % b) | 0; break;
          case 21: if (!b) return d(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
          case 22: if (!b) return d(4); r = ((a >>> 0) % (b >>> 0)) | 0; break;
          case 24: r = a & b; break;
          case 25: r = a | b; break;
          case 26: r = a ^ b; break;
          case 28: r = a << (b & 31); break;
          case 29: r = a >> (b & 31); break;
          case 30: r = (a >>> (b & 31)) | 0; break;
          case 32: r = a === b ? 1 : 0; break;
          case 33: r = a < b ? 1 : 0; break;
          default: r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        }
        sp -= 2; D[sp++] = r; break;
      }
      case 23: D[sp - 1] = -D[sp - 1]; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 48: pc = nx + (((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16); break;
      case 49: case 50: {
        const v = D[--sp], rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        if ((o === 49) === (v === 0)) pc = nx + rel;
        break;
      }
      case 51: if (cp === 64) return d(7); C[cp++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
      case 52: if (!cp) return d(8); pc = C[--cp]; break;
      case 64: { const a = D[sp - 1]; if (a < 0 || a > 255) return d(6); D[sp - 1] = M[a]; break; }
      case 65: { const a = D[sp - 1], v = D[sp - 2]; if (a < 0 || a > 255) return d(6); sp -= 2; M[a] = v; break; }
      case 80: {
        const v = D[sp - 1];
        let u = v < 0 ? -v : v, n = 0, t = u;
        do { n++; t = (t / 10) | 0; } while (t);
        const len = n + (v < 0 ? 1 : 0);
        if (ol + len > 65536) return d(11);
        sp--;
        let q = ol + len;
        do { O[--q] = 48 + (u % 10); u = (u / 10) | 0; } while (u);
        if (v < 0) O[--q] = 45;
        ol += len;
        break;
      }
      case 81: if (ol + 1 > 65536) return d(11); O[ol++] = D[--sp] & 255; break;
      case 82: D[sp++] = ip < q.length ? q[ip++] : -1; break;
      case 83: return d(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const [o, c] = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), o);
  writeFileSync(join(O, id, 'exit.txt'), c + '\n');
}
