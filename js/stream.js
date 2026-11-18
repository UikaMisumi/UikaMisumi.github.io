/* Token-by-token entrance for [data-stream] blocks.
   The text is already in the HTML; this only reveals it in small chunks,
   so layout never shifts and the page reads fine without JavaScript.

   Blocks do not wait in line. Each one starts as soon as it comes into view,
   so everything on screen streams at once. Arriving at a section link
   (index.html#news, say) starts that section straight away, together with
   everything above it, so scrolling back up finds the page already written. */
(function () {
  var root = document.documentElement;
  var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-stream]'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Smooth scrolling only once the page has landed, so a link like
  // index.html#news jumps straight to News instead of gliding down from the top.
  if (!reduce) {
    window.addEventListener('load', function () {
      setTimeout(function () { root.classList.add('glide'); }, 150);
    });
  }

  if (reduce || !blocks.length || !('IntersectionObserver' in window)) {
    root.classList.remove('will-stream');
    return;
  }

  var CJK = /[　-〿㐀-鿿＀-￯]/;
  var TOKENS_PER_SEC = 380;
  var MIN_SEC = 0.225;
  var MAX_SEC = 0.9;
  var STAGGER = 70;          // ms between blocks that come into view together

  // Split text the way a tokenizer roughly would: word pieces of 2-5 letters
  // (trailing space attached), one or two characters at a time for CJK.
  function pieces(text) {
    var out = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      var j = i + 1;
      if (/\s/.test(ch)) {
        while (j < text.length && /\s/.test(text[j])) j++;
        if (out.length) out[out.length - 1] += text.slice(i, j);
        else out.push(text.slice(i, j));
      } else if (CJK.test(ch)) {
        if (j < text.length && CJK.test(text[j]) && Math.random() < 0.5) j++;
        out.push(text.slice(i, j));
      } else {
        var len = 2 + Math.floor(Math.random() * 4);
        while (j < text.length && j - i < len && !/\s/.test(text[j]) && !CJK.test(text[j])) j++;
        out.push(text.slice(i, j));
      }
      i = j;
    }
    return out;
  }

  function tokenize(block) {
    var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }
    var tokens = [];
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      pieces(node.nodeValue).forEach(function (piece) {
        var span = document.createElement('span');
        span.className = 'tk';
        span.textContent = piece;
        frag.appendChild(span);
        tokens.push(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return tokens;
  }

  // Uneven arrival times, with a short breath after sentence ends,
  // scaled so the whole block lands inside the time budget.
  function schedule(tokens) {
    var times = [];
    var t = 0;
    tokens.forEach(function (tok) {
      t += 0.35 + Math.random() * 1.3;
      if (/[.!?。！？:：]\s*$/.test(tok.textContent)) t += 2.5;
      times.push(t);
    });
    var total = Math.min(MAX_SEC, Math.max(MIN_SEC, tokens.length / TOKENS_PER_SEC));
    var scale = t ? (total * 1000) / t : 0;
    return times.map(function (x) { return x * scale; });
  }

  var skipped = false;
  var active = [];           // blocks streaming right now; the first one carries the caret

  var jobs = blocks.map(function (block, index) {
    var tokens = tokenize(block);
    var caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    block.classList.add('ready');
    return { block: block, index: index, prio: 1, tokens: tokens, times: schedule(tokens), caret: caret, shown: 0, started: false, done: false };
  });

  function byTurn(a, b) { return a.prio - b.prio || a.index - b.index; }

  function finish(job) {
    if (job.done) return;
    job.done = true;
    for (var i = job.shown; i < job.tokens.length; i++) job.tokens[i].classList.add('on');
    job.shown = job.tokens.length;
    if (job.caret.parentNode) job.caret.parentNode.removeChild(job.caret);
    var k = active.indexOf(job);
    if (k >= 0) active.splice(k, 1);
  }

  function run(job) {
    if (job.done) return;
    if (skipped) { finish(job); return; }
    active.push(job);
    active.sort(byTurn);
    var begin = performance.now();
    (function frame(now) {
      if (job.done) return;
      var elapsed = now - begin;
      var moved = false;
      while (job.shown < job.tokens.length && job.times[job.shown] <= elapsed) {
        job.tokens[job.shown].classList.add('on');
        job.shown++;
        moved = true;
      }
      if (moved && job.shown && active[0] === job) {
        job.tokens[job.shown - 1].insertAdjacentElement('afterend', job.caret);
      }
      if (job.shown < job.tokens.length) requestAnimationFrame(frame);
      else setTimeout(function () { finish(job); }, 90);
    })(begin);
  }

  var observer;

  function start(job, delay) {
    if (job.started) return;
    job.started = true;
    if (observer) observer.unobserve(job.block);
    if (delay) setTimeout(function () { run(job); }, delay);
    else run(job);
  }

  observer = new IntersectionObserver(function (entries) {
    entries.filter(function (e) { return e.isIntersecting; })
      .map(function (e) { return jobs[blocks.indexOf(e.target)]; })
      .filter(function (job) { return job && !job.started; })
      .sort(byTurn)
      .forEach(function (job, n) { start(job, n * STAGGER); });
  }, { threshold: 0.12 });

  // A section link: that section first, and everything above it at the same time.
  function arrive(hash) {
    var id = hash && decodeURIComponent(hash.slice(1));
    var target = id && document.getElementById(id);
    if (!target) return;
    jobs.forEach(function (job) {
      if (target.contains(job.block) || job.block.contains(target)) job.prio = 0;
    });
    jobs.filter(function (job) {
      return job.prio === 0 || (job.block.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
    }).sort(byTurn).forEach(function (job) { start(job, 0); });
  }

  arrive(location.hash);
  jobs.forEach(function (job) { if (!job.started) observer.observe(job.block); });
  window.addEventListener('hashchange', function () { arrive(location.hash); });

  // A click or key press shows everything at once.
  function skip() {
    skipped = true;
    jobs.forEach(function (job) {
      job.started = true;
      observer.unobserve(job.block);
      finish(job);
    });
  }
  window.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip);
})();
