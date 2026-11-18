// Builds the handwritten "Sipeng Chen" lettering.
//
// Each stroke below is a pen centerline. The script turns it into a filled
// ink shape. The pen is modelled on measurements of the lettering it imitates
// (a soft round-tipped pen, written slowly):
//
//   - a stroke never thins towards its end. Its weight drifts one way along
//     the whole length, usually from light at pen-down to heavy at pen-up,
//     by up to 1 : 2 on the long strokes, and the last bit swells a little
//     more where the pen rests before lifting;
//   - both ends are full round caps, the start slightly narrower than the body;
//   - weight follows the size of the gesture: short inner strokes are the
//     lightest, tall stems and capitals heavier, the long extended strokes
//     the heaviest of all (about 1 : 2.5 across the whole piece);
//   - the hand is slow and a little unsteady, so long lines wander.
//
// The centerline as actually written is kept as a mask so the page can
// "write" each stroke in order.
//
// Run:  node tools/build-sign.js
// Writes: assets/sign.svg (static) and the block between the sign markers in index.html.

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const VIEW = '0 0 960 420';

// w: [weight at pen-down, weight at pen-up], in viewBox units.
// sway: how far the line wanders sideways.  t: seconds the stroke takes to write.
const strokes = [
  // Sipeng
  { t: .22, w: [7.5, 12.5], sway: 1.6, d: 'M138 60 C120 34 72 38 68 78 C65 112 130 114 132 152 C134 190 82 200 50 166' },
  { t: .07, w: [6, 7.6], d: 'M166 108 C164 132 164 158 168 182' },
  { t: .04, w: [8.5, 9.5], d: 'M165 72 L171 81', kind: 'dot' },
  { t: .10, w: [6.5, 11], d: 'M204 104 C206 150 206 204 200 262' },
  { t: .11, w: [7.4, 6.4], d: 'M205 126 C222 98 262 102 262 140 C262 174 226 186 206 166' },
  { t: .12, w: [5.6, 8], d: 'M292 148 C314 148 336 138 332 118 C327 100 294 104 290 142 C287 176 322 188 346 164' },
  { t: .06, w: [6, 7.6], d: 'M374 108 C376 132 376 158 374 182' },
  { t: .10, w: [5.6, 8], d: 'M376 136 C390 106 422 100 424 132 C425 150 424 166 427 182' },
  { t: .11, w: [5.6, 7], d: 'M506 118 C486 98 452 108 452 142 C452 174 492 180 506 148' },
  { t: .40, w: [6.5, 15], sway: 2.6, d: 'M508 106 C510 160 516 215 486 236 C440 262 300 222 150 232 C90 236 46 246 16 266' },
  // Chen
  { t: .17, w: [7.5, 12], sway: 1.6, d: 'M388 270 C366 244 312 256 308 318 C305 372 350 400 394 368', gap: .08 },
  { t: .09, w: [6.5, 10.5], d: 'M420 240 C422 300 421 345 418 386' },
  { t: .10, w: [5.6, 8], d: 'M421 344 C436 312 466 306 468 338 C469 356 468 372 471 386' },
  { t: .12, w: [5.6, 8], d: 'M500 352 C522 352 544 342 540 322 C535 304 502 308 498 346 C495 380 530 392 554 368' },
  { t: .06, w: [6, 7.6], d: 'M582 312 C584 336 584 362 582 386' },
  { t: .46, w: [5.6, 16], sway: 2.6, d: 'M584 340 C598 310 630 304 632 336 C633 358 628 376 642 384 C668 398 740 372 810 370 C866 368 904 388 944 372' },
];

function parse(d) {
  const tokens = d.match(/[MCL]|-?\d+(\.\d+)?/g);
  const segs = [];
  let i = 0, cur = null;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') cur = [num(), num()];
    else if (cmd === 'L') { const p = [num(), num()]; segs.push([cur, cur, p, p]); cur = p; }
    else if (cmd === 'C') { const a = [num(), num()], b = [num(), num()], p = [num(), num()]; segs.push([cur, a, b, p]); cur = p; }
  }
  return segs;
}

function bez(s, t) {
  const m = 1 - t;
  return [0, 1].map(k => m * m * m * s[0][k] + 3 * m * m * t * s[1][k] + 3 * m * t * t * s[2][k] + t * t * t * s[3][k]);
}

// Points evenly spaced along the centerline.
function resample(segs, step) {
  const dense = [];
  segs.forEach((s, si) => {
    for (let k = si ? 1 : 0; k <= 60; k++) dense.push(bez(s, k / 60));
  });
  const out = [dense[0]];
  let carry = 0, len = 0;
  for (let i = 1; i < dense.length; i++) {
    let a = dense[i - 1];
    const b = dense[i];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    len += seg;
    while (carry + seg >= step) {
      const r = (step - carry) / seg;
      a = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
      out.push(a);
      seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      carry = 0;
    }
    carry += seg;
  }
  const last = dense[dense.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * .3) out.push(last);
  return { pts: out, len };
}

const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// Weight along one stroke: a steady drift from w0 to w1, a slightly narrow
// touch-down, a small swell where the pen rests before lifting, and the
// faint unevenness of a hand-held pen. Nothing here ever tapers to a point.
function widths(pts, len, w0, w1, phase) {
  const n = pts.length;
  const step = len / Math.max(1, n - 1);
  let w = pts.map((p, i) => {
    const from = i * step, to = len - from;
    let v = w0 + (w1 - w0) * Math.pow(from / len, .85);
    v *= .84 + .16 * smooth(from / (1.6 * w0));
    v *= 1 + .1 * (1 - smooth(to / (1.8 * w1)));
    v *= 1 + .035 * Math.sin(from / 30 + phase) + .02 * Math.sin(from / 7 + phase * 2.3);
    return v;
  });
  return w.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -1; k <= 1; k++) { const j = i + k; if (j >= 0 && j < n) { s += w[j]; c++; } }
    return s / c;
  });
}

// A slow, slightly unsteady hand: the line wanders sideways in long waves.
function shake(pts, len, amp, phase) {
  const n = pts.length;
  const step = len / Math.max(1, n - 1);
  return pts.map((p, i) => {
    if (i === 0 || i === n - 1) return p;
    const a = pts[i - 1], b = pts[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const from = i * step;
    const k = amp * smooth(from / 25) * smooth((len - from) / 25)
      * (Math.sin(from / (22 + 6 * amp) + phase * 1.9) + .5 / amp * Math.sin(from / 9.5 + phase));
    return [p[0] - (b[1] - a[1]) / l * k, p[1] + (b[0] - a[0]) / l * k];
  });
}

function outline(pts, w) {
  const n = pts.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
    left.push([pts[i][0] + nx * w[i] / 2, pts[i][1] + ny * w[i] / 2]);
    right.push([pts[i][0] - nx * w[i] / 2, pts[i][1] - ny * w[i] / 2]);
  }
  const cap = (c, from, r) => {
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    // Sweep outward around the end of the stroke, not back into it.
    return [1, 2, 3].map(k => [c[0] + Math.cos(a0 - k * Math.PI / 4) * r, c[1] + Math.sin(a0 - k * Math.PI / 4) * r]);
  };
  const ring = [
    ...left,
    ...cap(pts[n - 1], left[n - 1], w[n - 1] / 2),
    ...right.reverse(),
    ...cap(pts[0], right[right.length - 1], w[0] / 2),
  ];
  const f = (v) => (Math.round(v * 10) / 10).toString();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m = ring.length;
  const start = mid(ring[m - 1], ring[0]);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < m; i++) {
    const q = mid(ring[i], ring[(i + 1) % m]);
    d += `Q${f(ring[i][0])} ${f(ring[i][1])} ${f(q[0])} ${f(q[1])}`;
  }
  return d + 'Z';
}

const f1 = (v) => (Math.round(v * 10) / 10).toString();

let clock = .15;
const built = strokes.map((s, i) => {
  const line = resample(parse(s.d), 4);
  const len = line.len;
  const pts = s.kind === 'dot' ? line.pts : shake(line.pts, len, s.sway || 1.2, i * 1.3);
  const d = outline(pts, widths(pts, len, s.w[0], s.w[1], i * 1.7));
  // the mask follows the line as written, wander included
  const pen = pts.map((p, k) => (k ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('');
  clock += s.gap || 0;
  const delay = clock;
  clock += s.t + .015;
  return { ink: d, pen, delay, t: s.t, dot: s.kind === 'dot' };
});

const r2 = (v) => Math.round(v * 100) / 100;
const inline = [
  `<svg viewBox="${VIEW}" aria-hidden="true">`,
  '  <defs>',
  ...built.map((b, i) => b.dot ? '' :
    `    <mask id="pen${i}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="1040" height="500"><path class="pen" pathLength="1" style="--d:${r2(b.delay)}s;--t:${r2(b.t)}s" d="${b.pen}"/></mask>`).filter(Boolean),
  '  </defs>',
  '  <g transform="rotate(-3 480 210)">',
  // A dot is a single touch of the pen, so it simply appears at its turn.
  ...built.map((b, i) => b.dot
    ? `    <path class="ink dot" style="--d:${r2(b.delay)}s" d="${b.ink}"/>`
    : `    <path class="ink" mask="url(#pen${i})" d="${b.ink}"/>`),
  '  </g>',
  '</svg>',
].join('\n');

const file = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW}">`,
  '<title>Sipeng Chen</title>',
  '<g transform="rotate(-3 480 210)" fill="#1f1e1d">',
  ...built.map((b) => `<path d="${b.ink}"/>`),
  '</g>',
  '</svg>',
  '',
].join('\n');

fs.writeFileSync(path.join(root, 'assets', 'sign.svg'), file);

const page = path.join(root, 'index.html');
const html = fs.readFileSync(page, 'utf8');
const re = /(<!-- sign:start -->)[\s\S]*?(<!-- sign:end -->)/;
if (!re.test(html)) throw new Error('sign markers not found in index.html');
fs.writeFileSync(page, html.replace(re, `$1\n${inline}\n$2`));

console.log(`strokes: ${built.length}, inline: ${(inline.length / 1024).toFixed(1)} KB, writes for ${r2(clock)}s`);
