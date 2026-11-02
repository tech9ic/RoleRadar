// Standalone pure JavaScript DEFLATE (RFC 1951) & zlib (RFC 1950) Inflator
// Compatible with all browsers and Node.js environments without external dependencies.

const CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const LEN_LN = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const DST_LN = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];

function bit_swap_8(n: number): number {
  const t = (((n << 1) | (n << 11)) & 0x22110) | (((n << 5) | (n << 15)) & 0x88440);
  return (((t >> 16) | (t >> 8) | t) & 0xff);
}

const bitswap8 = new Uint8Array(256);
for (let q = 0; q < 256; ++q) bitswap8[q] = bit_swap_8(q);

function bit_swap_n(n: number, b: number): number {
  const rev = bitswap8[n & 0xff];
  if (b <= 8) return rev >>> (8 - b);
  const rev16 = (rev << 8) | bitswap8[(n >> 8) & 0xff];
  if (b <= 16) return rev16 >>> (16 - b);
  const rev24 = (rev16 << 8) | bitswap8[(n >> 16) & 0xff];
  return rev24 >>> (24 - b);
}

function read_bits_2(buf: Uint8Array, bl: number): number {
  const w = bl & 7, h = bl >>> 3;
  return ((buf[h] | (w <= 6 ? 0 : buf[h + 1] << 8)) >>> w) & 0x03;
}
function read_bits_3(buf: Uint8Array, bl: number): number {
  const w = bl & 7, h = bl >>> 3;
  return ((buf[h] | (w <= 5 ? 0 : buf[h + 1] << 8)) >>> w) & 0x07;
}
function read_bits_4(buf: Uint8Array, bl: number): number {
  const w = bl & 7, h = bl >>> 3;
  return ((buf[h] | (w <= 4 ? 0 : buf[h + 1] << 8)) >>> w) & 0x0f;
}
function read_bits_5(buf: Uint8Array, bl: number): number {
  const w = bl & 7, h = bl >>> 3;
  return ((buf[h] | (w <= 3 ? 0 : buf[h + 1] << 8)) >>> w) & 0x1f;
}
function read_bits_7(buf: Uint8Array, bl: number): number {
  const w = bl & 7, h = bl >>> 3;
  return ((buf[h] | (w <= 1 ? 0 : buf[h + 1] << 8)) >>> w) & 0x7f;
}
function read_bits_n(buf: Uint8Array, bl: number, n: number): number {
  const w = bl & 7, h = bl >>> 3, f = (1 << n) - 1;
  let v = buf[h] >>> w;
  if (n < 8 - w) return v & f;
  v |= buf[h + 1] << (8 - w);
  if (n < 16 - w) return v & f;
  v |= buf[h + 2] << (16 - w);
  if (n < 24 - w) return v & f;
  v |= (buf[h + 3] || 0) << (24 - w);
  return v & f;
}

function realloc(b: Uint8Array, sz: number): Uint8Array {
  const L = b.length;
  if (L >= sz) return b;
  const M = 2 * L > sz ? 2 * L : sz + 5;
  const a = new Uint8Array(M);
  a.set(b);
  return a;
}

function build_tree(clens: Uint8Array | number[], cmap: Uint16Array, MAX: number): number {
  let maxlen = 1, w = 0, ccode = 0;
  const L = clens.length;
  const bl_count = new Uint16Array(32);
  const ctree = new Uint16Array(MAX > L ? MAX : L);

  for (let i = 0; i < L; ++i) {
    bl_count[(w = clens[i])]++;
    if (maxlen < w) maxlen = w;
  }
  bl_count[0] = 0;
  for (let i = 1; i <= maxlen; ++i) bl_count[i + 16] = (ccode = (ccode + bl_count[i - 1]) << 1);
  for (let i = 0; i < L; ++i) {
    ccode = clens[i];
    if (ccode !== 0) ctree[i] = bl_count[ccode + 16]++;
  }

  for (let i = 0; i < L; ++i) {
    const cleni = clens[i];
    if (cleni !== 0) {
      ccode = bit_swap_n(ctree[i], maxlen) >> (maxlen - cleni);
      for (let j = (1 << (maxlen + 4 - cleni)) - 1; j >= 0; --j) {
        cmap[ccode | (j << cleni)] = (cleni & 15) | (i << 4);
      }
    }
  }
  return maxlen;
}

const fix_lmap = new Uint16Array(512);
const fix_dmap = new Uint16Array(32);
(() => {
  const dlens: number[] = [];
  for (let i = 0; i < 32; i++) dlens.push(5);
  build_tree(dlens, fix_dmap, 32);

  const clens: number[] = [];
  for (let i = 0; i <= 143; i++) clens.push(8);
  for (let i = 144; i <= 255; i++) clens.push(9);
  for (let i = 256; i <= 279; i++) clens.push(7);
  for (let i = 280; i <= 287; i++) clens.push(8);
  build_tree(clens, fix_lmap, 288);
})();

const dyn_lmap = new Uint16Array(32768);
const dyn_dmap = new Uint16Array(32768);
const dyn_cmap = new Uint16Array(128);
let dyn_len_1 = 1, dyn_len_2 = 1;

function dyn(data: Uint8Array, boff: number): number {
  const _HLIT = read_bits_5(data, boff) + 257; boff += 5;
  const _HDIST = read_bits_5(data, boff) + 1; boff += 5;
  const _HCLEN = read_bits_4(data, boff) + 4; boff += 4;
  let w = 0;

  const clens = new Uint8Array(19);
  const ctree = new Uint16Array(19);
  let maxlen = 1;
  const bl_count = new Uint8Array(8);
  const next_code = new Uint8Array(8);

  for (let i = 0; i < _HCLEN; ++i) {
    clens[CLEN_ORDER[i]] = w = read_bits_3(data, boff);
    if (maxlen < w) maxlen = w;
    bl_count[w]++;
    boff += 3;
  }

  let ccode = 0;
  bl_count[0] = 0;
  for (let i = 1; i <= maxlen; ++i) next_code[i] = ccode = (ccode + bl_count[i - 1]) << 1;
  for (let i = 0; i < 19; ++i) if ((ccode = clens[i]) !== 0) ctree[i] = next_code[ccode]++;

  for (let i = 0; i < 19; ++i) {
    const cleni = clens[i];
    if (cleni !== 0) {
      ccode = bitswap8[ctree[i]] >> (8 - cleni);
      for (let j = (1 << (7 - cleni)) - 1; j >= 0; --j) dyn_cmap[ccode | (j << cleni)] = (cleni & 7) | (i << 3);
    }
  }

  const hcodes: number[] = [];
  maxlen = 1;
  while (hcodes.length < _HLIT + _HDIST) {
    ccode = dyn_cmap[read_bits_7(data, boff)];
    boff += ccode & 7;
    switch ((ccode >>>= 3)) {
      case 16:
        w = 3 + read_bits_2(data, boff); boff += 2;
        ccode = hcodes[hcodes.length - 1];
        while (w-- > 0) hcodes.push(ccode);
        break;
      case 17:
        w = 3 + read_bits_3(data, boff); boff += 3;
        while (w-- > 0) hcodes.push(0);
        break;
      case 18:
        w = 11 + read_bits_7(data, boff); boff += 7;
        while (w-- > 0) hcodes.push(0);
        break;
      default:
        hcodes.push(ccode);
        if (maxlen < ccode) maxlen = ccode;
        break;
    }
  }

  const h1 = hcodes.slice(0, _HLIT);
  const h2 = hcodes.slice(_HLIT);
  dyn_len_1 = build_tree(h1, dyn_lmap, 286);
  dyn_len_2 = build_tree(h2, dyn_dmap, 30);
  return boff;
}

export function inflateRaw(data: Uint8Array, initialCapacity = 65536): Uint8Array {
  if (data.length === 0) return new Uint8Array(0);
  if (data[0] === 3 && !(data[1] & 0x03)) return new Uint8Array(0);

  let boff = 0;
  let header = 0;
  let outbuf = new Uint8Array(initialCapacity);
  let woff = 0;
  let OL = outbuf.length >>> 0;
  let max_len_1 = 0, max_len_2 = 0;

  while ((header & 1) === 0) {
    header = read_bits_3(data, boff); boff += 3;
    const type = header >>> 1;
    if (type === 0) {
      /* Stored / uncompressed block */
      boff = (boff + 7) & ~7;
      const len = read_bits_n(data, boff, 16); boff += 16;
      boff += 16; // skip nlen
      const byteStart = boff >>> 3;
      if (OL < woff + len) { outbuf = realloc(outbuf, woff + len + 32768); OL = outbuf.length; }
      outbuf.set(data.subarray(byteStart, byteStart + len), woff);
      woff += len;
      boff += len << 3;
      continue;
    } else if (type === 1) {
      max_len_1 = 9; max_len_2 = 5;
    } else if (type === 2) {
      boff = dyn(data, boff);
      max_len_1 = dyn_len_1; max_len_2 = dyn_len_2;
    } else {
      break;
    }

    for (;;) {
      if (OL < woff + 32767) { outbuf = realloc(outbuf, woff + 32767); OL = outbuf.length; }
      const bits = read_bits_n(data, boff, max_len_1);
      const codeData = (type === 1) ? fix_lmap[bits] : dyn_lmap[bits];
      boff += codeData & 15;
      let code = codeData >>> 4;

      if (((code >>> 8) & 0xff) === 0) {
        outbuf[woff++] = code;
      } else if (code === 256) {
        break;
      } else {
        code -= 257;
        let len_eb = (code < 8) ? 0 : ((code - 4) >> 2);
        if (len_eb > 5) len_eb = 0;
        let tgt = woff + LEN_LN[code];
        if (len_eb > 0) {
          tgt += read_bits_n(data, boff, len_eb);
          boff += len_eb;
        }

        const distBits = read_bits_n(data, boff, max_len_2);
        const distData = (type === 1) ? fix_dmap[distBits] : dyn_dmap[distBits];
        boff += distData & 15;
        const distCode = distData >>> 4;
        const dst_eb = (distCode < 4 ? 0 : (distCode - 2) >> 1);
        let dst = DST_LN[distCode];
        if (dst_eb > 0) {
          dst += read_bits_n(data, boff, dst_eb);
          boff += dst_eb;
        }

        if (OL < tgt) { outbuf = realloc(outbuf, tgt + 1024); OL = outbuf.length; }
        while (woff < tgt) {
          outbuf[woff] = outbuf[woff - dst];
          woff++;
        }
      }
    }
  }

  return outbuf.slice(0, woff);
}

