/* The picture on the home page. One sentence is shown the way a language
   model meets it: first as written, then marked off into tokens, then as
   points in a space where a repeated word lands on the same spot and words of
   one kind lie close together, then gathered into a few linked nodes that act.

   The type never moves and is always drawn as type. Word by word, in reading
   order, it dissolves into fine ink dust that drifts to its place; at the end
   of the cycle the dust drifts home and the words come back one at a time.

   The sentence follows the page's language. It borrows the shape of a line
   from The Three-Body Problem (给岁月以文明，而不是给文明以岁月): give
   language a world to act in, rather than give the world more text.
   In Chinese: 给语言以世界，而不是给世界以更多语言。 */
(function () {
  var canvas = document.getElementById('glyph');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var INK = '#1a1a19';
  var root = document.documentElement;
  var TEXT = {
    en: {
      lines: ['give language', 'a world,', 'not the world', 'more language.'],
      face: '"Roboto Slab"',
      font: '"Roboto Slab", Georgia, "Times New Roman", serif',
      pitch: 1.02,                              // line pitch, in ems
      words: /[A-Za-z]+|[^A-Za-z\s]/g,
      small: /^(a|not|the|more)$/i,
      label: 'The sentence: give language a world, not the world more language. Shown as writing, as tokens, as points in a space and as a small network'
    },
    zh: {
      lines: ['给语言', '以世界，', '而不是', '给世界', '以更多语言。'],
      face: '"Noto Serif SC"',
      font: '"Noto Serif SC", "Songti SC", "STSong", serif',
      pitch: 1.2,
      words: /语言|世界|不是|更多|\S/g,
      small: /^(给|以|而|不是|更多)$/,
      label: '一句话：给语言以世界，而不是给世界以更多语言。依次显示为文字、词元、空间中的点和一个小网络'
    }
  };
  var T = TEXT.en;
  // where each kind of token settles in the third state: the small words
  // of grammar in one place, the words that carry the meaning in another
  var HOME = { small: [.3, .32], full: [.64, .66], mark: [.82, .24] };
  // milliseconds spent resting in each state, and moving on to the next one
  var HOLD = [2400, 2200, 2600, 2600], MOVE = [1300, 3000, 2400, 3200];
  var stages = document.querySelectorAll('.stages li');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var size = 0, dpr = 1, fs = 0;
  var tokens = [], nodes = [], links = [];

  function rand(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function kindOf(word) {
    if (!/[A-Za-z一-鿿]/.test(word)) return 'mark';
    return T.small.test(word) ? 'small' : 'full';
  }

  function face(c) {
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.font = '700 ' + fs + 'px ' + T.font;
  }

  function pick() {
    T = TEXT[root.lang === 'zh' ? 'zh' : 'en'];
    canvas.setAttribute('aria-label', T.label);
  }

  function build() {
    pick();
    size = canvas.clientWidth;
    if (!size) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    var off = document.createElement('canvas');
    off.width = off.height = size;
    var o = off.getContext('2d');

    // the largest size at which the block fits the square
    var LINES = T.lines, PITCH = T.pitch;
    o.font = '700 100px ' + T.font;
    var widest = 0;
    LINES.forEach(function (l) { widest = Math.max(widest, o.measureText(l).width); });
    var first = o.measureText(LINES[0]), last = o.measureText(LINES[LINES.length - 1]);
    var up = (first.actualBoundingBoxAscent || 76) / 100, down = (last.actualBoundingBoxDescent || 0) / 100;
    var rows = (LINES.length - 1) * PITCH + up + down;
    fs = Math.min(size * .9 / widest * 100, size * .9 / rows);
    var left = (size - widest * fs / 100) / 2;
    var base0 = (size - rows * fs) / 2 + up * fs;

    // mark each line off into tokens and note where each one sits
    face(o);
    tokens = [];
    var seen = {}, spot = {}, padX = .07 * fs, padY = .03 * fs;
    LINES.forEach(function (line, li) {
      var re = new RegExp(T.words.source, 'g'), m, prev = null;
      while ((m = re.exec(line))) {
        var kind = kindOf(m[0]);
        var word = m[0].toLowerCase();
        if (!spot[word]) {                      // one place per word, near others of its kind
          var nth = seen[kind] = (seen[kind] || 0) + 1;
          var turn = 1.9 * nth + (kind === 'full' ? .8 : 0);
          spot[word] = [size * (HOME[kind][0] + .1 * Math.cos(turn)), size * (HOME[kind][1] + .1 * Math.sin(turn))];
        }
        var base = base0 + li * PITCH * fs;
        var box = o.measureText(m[0]);
        var t = {
          text: m[0], base: base,
          x0: left + o.measureText(line.slice(0, m.index)).width,
          x1: left + o.measureText(line.slice(0, m.index + m[0].length)).width,
          cx: spot[word][0], cy: spot[word][1],
          parts: []
        };
        t.y0 = base - (box.actualBoundingBoxAscent || .7 * fs);
        t.y1 = base + (box.actualBoundingBoxDescent || 0);
        // punctuation: frame the ink, not the full-width cell it sits in
        if (kind === 'mark' && box.actualBoundingBoxRight) t.x1 = Math.max(t.x0 + 2, t.x0 + box.actualBoundingBoxRight);
        // the frame drawn round it; neighbours that touch share an edge
        t.bx0 = t.x0 - padX; t.bx1 = t.x1 + padX; t.by0 = t.y0 - padY; t.by1 = t.y1 + padY;
        if (prev && t.x0 - prev.x1 < 2 * padX) prev.bx1 = t.bx0 = (prev.x1 + t.x0) / 2;
        tokens.push(t);
        prev = t;
      }
    });

    // write the sentence off screen, then scatter dust wherever there is ink
    o.fillStyle = '#000';
    tokens.forEach(function (t) { o.fillText(t.text, t.x0, t.base); });
    var data = o.getImageData(0, 0, size, size).data;
    var R = rand(7);
    var want = Math.max(1500, Math.round(5200 * size * size / (560 * 560)));
    var x0 = left - 2, x1 = left + widest * fs / 100 + 2;
    var y0 = base0 - up * fs - 2, y1 = base0 + ((LINES.length - 1) * PITCH + .3) * fs;
    var parts = [];
    for (var tries = 0; tries < want * 40 && parts.length < want; tries++) {
      var x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      if (data[(Math.floor(y) * size + Math.floor(x)) * 4 + 3] > 140) {
        parts.push({ x: x, y: y, j: R(), r: R(), q: R(), halo: R() < .1 });
      }
    }

    // a small set of nodes, each gathering the dust nearest to it
    nodes = [];
    for (var j = 0; j < 9; j++) for (var i = 0; i < 8; i++) {
      nodes.push({ x: size * (.16 + .68 * (i + (R() - .5) * .7) / 7), y: size * (.14 + .72 * (j + (R() - .5) * .7) / 8) });
    }
    links = [];
    nodes.forEach(function (a, ai) {
      var near = nodes.map(function (b, bi) { return [Math.hypot(a.x - b.x, a.y - b.y), bi]; }).sort(function (u, v) { return u[0] - v[0]; });
      for (var k = 1; k <= 3; k++) if (near[k][1] > ai || k === 1) links.push([ai, near[k][1]]);
    });

    parts.forEach(function (p) {
      // the token this grain belongs to
      var best = 0, bd = Infinity;
      tokens.forEach(function (t, ti) {
        var d = Math.max(t.x0 - p.x, 0, p.x - t.x1) + Math.max(t.y0 - p.y, 0, p.y - t.y1);
        if (d < bd) { bd = d; best = ti; }
      });
      tokens[best].parts.push(p);
      // last state: its nearest node
      best = 0; bd = Infinity;
      nodes.forEach(function (nd, ni) { var d = Math.hypot(nd.x - p.x, nd.y - p.y); if (d < bd) { bd = d; best = ni; } });
      p.ax = nodes[best].x + (p.r - .5) * 5;
      p.ay = nodes[best].y + (p.q - .5) * 5;
    });
    tokens.forEach(function (t) {
      // third state: a cloud around the word's place, with a thin halo
      t.parts.forEach(function (p) {
        var g = Math.sqrt(-2 * Math.log(p.r + 1e-6)) * Math.cos(6.2832 * p.q);
        var g2 = Math.sqrt(-2 * Math.log(p.r + 1e-6)) * Math.sin(6.2832 * p.q);
        var spread = size * .11 * Math.sqrt(t.parts.length / parts.length) * (p.halo ? 3.4 : 1);
        p.vx = t.cx + g * spread;
        p.vy = t.cy + g2 * spread;
      });
    });
    return true;
  }

  var clamp = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; };
  var ease = function (t) { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var ramp = function (t) { t = clamp(t); return t * t * (3 - 2 * t); };

  function draw(from, to, p) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    face(ctx);
    var moving = from !== to;

    // the two axes of the space
    var space = !moving ? +(from === 2) : to === 2 ? ramp((p - .35) / .5) : from === 2 ? 1 - ramp(p / .4) : 0;
    if (space > .01) {
      ctx.globalAlpha = .4 * space;
      ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(size * .07, size * .08); ctx.lineTo(size * .07, size * .93); ctx.lineTo(size * .92, size * .93);
      ctx.stroke();
    }

    // links between the nodes
    var net = !moving ? +(from === 3) : to === 3 ? ramp((p - .4) / .6) : from === 3 ? 1 - ramp(p / .35) : 0;
    if (net > .01) {
      ctx.globalAlpha = .45 * net;
      ctx.lineWidth = .7;
      ctx.beginPath();
      links.forEach(function (l) { ctx.moveTo(nodes[l[0]].x, nodes[l[0]].y); ctx.lineTo(nodes[l[1]].x, nodes[l[1]].y); });
      ctx.stroke();
    }

    var rFrom = from === 3 ? 1.15 : .85, rTo = to === 3 ? 1.15 : .85;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var order = tokens.length > 1 ? i / (tokens.length - 1) : 0;   // reading order, 0 to 1
      var type = 0, frame = 0, dust = 0, u = 0;
      if (from < 2 && to < 2) {                 // the words are on the page; only the frames change
        type = 1;
        frame = !moving ? from : ramp((p - .6 * order) / .4);
      } else if (from === 1) {                  // each word in turn lets go of the page
        u = clamp((p - .35 * order) / .65);
        type = 1 - ramp(u / .3);
        frame = 1 - ramp(u / .2);
        dust = ramp(u / .18);
      } else if (to === 0) {                    // and each in turn comes back
        u = clamp((p - .3 * order) / .7);
        type = ramp((u - .7) / .3);
        dust = 1 - ramp((u - .84) / .16);
      } else dust = 1;

      if (frame > .01) {
        ctx.globalAlpha = .7 * frame;
        ctx.lineWidth = .8;
        ctx.strokeRect(t.bx0, t.by0, t.bx1 - t.bx0, t.by1 - t.by0);
      }
      if (type > .01) {
        ctx.globalAlpha = type;
        ctx.fillText(t.text, t.x0, t.base);
      }
      if (dust > .01) {
        ctx.globalAlpha = dust;
        ctx.beginPath();
        for (var k = 0; k < t.parts.length; k++) {
          var q = t.parts[k];
          var e = !moving ? 0
            : from === 1 ? ease((u - .08 - q.j * .22) / .7)
            : from === 2 ? ease((p - q.j * .3) / .7)
            : ease((u - q.j * .2) / .66);
          var ax = from === 2 ? q.vx : from === 3 ? q.ax : q.x, ay = from === 2 ? q.vy : from === 3 ? q.ay : q.y;
          var bx = to === 2 ? q.vx : to === 3 ? q.ax : q.x, by = to === 2 ? q.vy : to === 3 ? q.ay : q.y;
          var dx = bx - ax, dy = by - ay;
          var bend = Math.sin(3.1416 * e) * .16 * (q.q - .5);      // a slight arc, never a straight slide
          var x = ax + dx * e - dy * bend, y = ay + dy * e + dx * bend;
          var r = rFrom + (rTo - rFrom) * e;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, 6.2832);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function setStage(i) {
    for (var k = 0; k < stages.length; k++) stages[k].classList.toggle('on', k === i);
  }

  var started = false;
  function begin() {
    if (started) return;
    if (!build()) return;
    started = true;

    if (reduce) { draw(0, 0, 0); setStage(0); return; }

    var whole = 0;
    for (var s = 0; s < 4; s++) whole += HOLD[s] + MOVE[s];
    var start = null, visible = true, shown = -1;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
    }
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible) return;
      if (start === null) start = now;
      var t = (now - start) % whole, k = 0;
      while (t >= HOLD[k] + MOVE[k]) { t -= HOLD[k] + MOVE[k]; k++; }
      var moving = t > HOLD[k];
      var p = moving ? (t - HOLD[k]) / MOVE[k] : 0;
      var to = moving ? (k + 1) % 4 : k;
      draw(k, to, p);
      var label = moving && p > .5 ? to : k;
      if (label !== shown) { shown = label; setStage(label); }
    }
    requestAnimationFrame(frame);
  }

  function refresh() {                         // the lettering face arrived late, or the size changed
    if (!started) { begin(); return; }
    if (build() && reduce) draw(0, 0, 0);
  }

  // the face for the sentence in the current language; Chinese faces arrive in pieces,
  // so ask for exactly the characters the sentence uses
  function loadFace() {
    pick();
    return document.fonts.load('700 80px ' + T.face, T.lines.join(''));
  }

  // wait briefly for the lettering face, then start with whatever is there
  if (document.fonts && document.fonts.load) {
    loadFace().then(refresh, begin);
    setTimeout(begin, 1200);
  } else begin();

  // the reader switched language: redraw the sentence, again once its face is in
  if ('MutationObserver' in window) {
    new MutationObserver(function () {
      if (!started) return;
      refresh();
      if (document.fonts && document.fonts.load) loadFace().then(refresh, function () {});
    }).observe(root, { attributes: true, attributeFilter: ['lang'] });
  }

  var timer = null;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (canvas.clientWidth !== size || Math.min(2, window.devicePixelRatio || 1) !== dpr) refresh();
    }, 150);
  });
})();
