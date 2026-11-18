/* English / Chinese. Both languages are in the page; the root element's lang
   decides which one shows (see the [lang] rules in site.css). The choice is
   remembered in this browser; the head of each page applies it before the
   first paint, so there is no flash of the other language. */
(function () {
  var root = document.documentElement;
  var button = document.querySelector('.nav .lang');
  var title = document.querySelector('title');
  var titles = { en: title.textContent, zh: title.getAttribute('data-zh') || title.textContent };

  function show(lang) {
    root.lang = lang;
    document.title = titles[lang];
    if (button) button.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
  }

  show(root.lang === 'zh' ? 'zh' : 'en');

  if (button) {
    button.addEventListener('click', function () {
      var next = root.lang === 'zh' ? 'en' : 'zh';
      show(next);
      try { localStorage.setItem('lang', next); } catch (e) {}
    });
  }
})();
