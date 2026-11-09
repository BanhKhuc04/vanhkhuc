const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const page = document.body.dataset.page;

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// content.json is edited from the admin page: only allow http(s)/mailto or relative links
const url = u => { u = String(u || '').trim(); return /^[a-z][\w+.-]*:/i.test(u) && !/^(https?|mailto):/i.test(u) ? '#' : esc(u); };
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const host = u => { try { return new URL(u).host; } catch { return u; } };
const projectUrl = p => `projects.html?p=${encodeURIComponent(p.slug)}`;

/* ---------- K4 logo (traced from brand artwork) ---------- */
const LOGO = `<svg class="logo" viewBox="240 265 1430 1440" aria-hidden="true" focusable="false">
<path class="lk" pathLength="1" d="M249 274H611V897L536 971V573H461V1028L539 1106L1371 274H1658L602 1330L804 1681H598L461 1358V1681H249Z"/>
<path class="l4" pathLength="1" fill-rule="evenodd" d="M662 1346L1530 479V1693H1296V1567H859L813 1612ZM1058 1369L1298 1130L1297 1369Z"/>
<path class="lb" pathLength="1" d="M1585 433L1658 362V1694H1585Z"/></svg>`;

const ICONS = {
  web: 'M6 12 H58 V52 H6 Z M6 22 H58 M22 32 L15 38 L22 44 M42 32 L49 38 L42 44 M35 29 L29 47',
  server: 'M10 8 H54 V26 H10 Z M10 38 H54 V56 H10 Z M18 17 h4 M18 47 h4 M32 26 V38',
  ai: 'M4 32 C 14 14, 50 14, 60 32 C 50 50, 14 50, 4 32 Z M32 32 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M32 32 h0.1',
  iot: 'M18 18 H46 V46 H18 Z M26 26 H38 V38 H26 Z M24 18 V8 M32 18 V8 M40 18 V8 M24 46 V56 M32 46 V56 M40 46 V56 M18 24 H8 M18 32 H8 M18 40 H8 M46 24 H56 M46 32 H56 M46 40 H56'
};
const DOODLES = `<svg class="a2-doodles" viewBox="0 0 400 500" aria-hidden="true">
<path d="M60 90 C 120 40, 180 140, 240 80 S 340 60, 350 120"/><path d="M80 260 m0 -40 a40 40 0 1 1 -2 0"/>
<path d="M260 230 L276 280 L330 282 L287 312 L302 362 L260 333 L218 362 L233 312 L190 282 L244 280 Z"/>
<path d="M50 420 L110 380 L170 420 L230 380 L290 420 L350 380"/></svg>`;
const MARK = `<svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 15 C 60 5, 120 20, 180 10 S 270 8, 296 14"/></svg>`;

$$('[data-logo]').forEach(el => el.insertAdjacentHTML('afterbegin', LOGO));
$('#year').textContent = new Date().getFullYear();

/* ---------- content ---------- */
async function loadContent() {
  if (new URLSearchParams(location.search).has('preview')) {
    try { const d = localStorage.getItem('vk-draft'); if (d) return JSON.parse(d); } catch {}
  }
  const r = await fetch('content.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('content.json ' + r.status);
  return r.json();
}

function artInner(p) {
  const t = esc(p.title);
  if (p.image) return `<img src="${url(p.image)}" alt="Ảnh chụp ${t}" loading="lazy">`;
  switch (+p.art) {
    case 2: return `${DOODLES}<span class="a2-word hand">${esc(String(p.title).split(' ')[0])}</span>`;
    case 3: return `<i></i><i></i><i></i><i></i><div class="a3">${LOGO}</div>`;
    case 4: return `<div class="a4-box">${LOGO}<span>${t}</span></div>`;
    case 5: return `<span class="a5-type">${t.split(' ').join('<br>')}</span><span class="a5-date hand">${esc(p.year)}</span>`;
    default: return `<div class="a1">${LOGO}</div>`;
  }
}
const artClass = p => p.image ? 'art--img' : `art--${[1, 2, 3, 4, 5].includes(+p.art) ? +p.art : 1}`;

const cardHTML = p => `<a class="card" href="${projectUrl(p)}" data-cursor="Xem ↗" data-cat="${esc(p.category)}">
  <div class="card__art art ${artClass(p)}">${artInner(p)}<span class="art__tag">${esc(p.category)}</span></div>
  <div class="card__meta"><h3>${esc(p.title)}</h3><span>${esc(p.year)}</span></div></a>`;

const browserHTML = (p, inner) => `<span class="browser__bar"><i></i><i></i><i></i><b class="mono">${esc(p.live ? host(p.live) : p.title)}</b></span>
  <span class="browser__view art ${artClass(p)}">${inner}</span>`;

function renderBinds(C) {
  $$('[data-bind]').forEach(el => { el.textContent = get(C, el.dataset.bind) ?? ''; });
  $$('[data-bind-src]').forEach(el => { el.src = get(C, el.dataset.bindSrc) || ''; });
  $$('[data-mailto]').forEach(el => { el.href = 'mailto:' + (C.contact?.email || ''); });
}

function renderHome(C) {
  const projects = C.projects || [];
  $('#heroTitle').innerHTML = (C.hero?.lines || []).map(l =>
    `<span class="line"><span>${esc(l).replace(/\*(.+?)\*/g, `<em class="hl">$1${MARK}</em>`)}</span></span>`).join('');

  const track = `<div class="marquee__track">${(C.stack || []).map(s => `<span>${esc(s)}</span><b>✦</b>`).join('')}</div>`;
  $('#stackMarquee').innerHTML = track + track;

  let about = esc(C.about?.text);
  const circle = esc(C.about?.circle);
  if (circle && about.includes(circle)) about = about.replace(circle,
    `<span class="circled">${circle}<svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M62 6 C 92 8, 98 42, 70 53 C 44 61, 8 54, 5 31 C 3 11, 36 3, 68 9"/></svg></span>`);
  $('#aboutText').innerHTML = about;

  $('#stats').innerHTML = (C.about?.stats || []).map(s =>
    `<div class="stat"><b data-count="${+s.value || 0}">0</b><b>${esc(s.suffix)}</b><span>${esc(s.label)}</span></div>`).join('');

  $('#skills').innerHTML = (C.skills || []).map((s, i) => `<article class="svc reveal" style="--d:${i * .1}s">
    <span class="svc__n hand">${String(i + 1).padStart(2, '0')}</span>
    <svg class="svc__icon" viewBox="0 0 64 64" aria-hidden="true"><path pathLength="1" d="${ICONS[s.icon] || ICONS.web}"/></svg>
    <h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>
    <ul>${(s.tags || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></article>`).join('');

  const featured = projects.filter(p => p.featured);
  $('#workTrack').innerHTML = featured.map(cardHTML).join('') +
    `<a class="card card--end" href="projects.html" data-cursor="Tất cả ↗">
      <div class="card__art art art--end"><span>Xem tất cả<br><em class="hand">${projects.length} dự án</em></span><b>→</b></div>
      <div class="card__meta"><h3>Mọi thứ mình đã build</h3><span>all</span></div></a>`;
  $('#workTotal').textContent = String(featured.length + 1).padStart(2, '0');

  const apps = projects.filter(p => p.hub && p.live);
  $('#hubGrid').innerHTML = apps.map((p, i) => `<article class="app reveal" style="--d:${i * .1}s">
    <a class="browser app__screen" href="${url(p.live)}" target="_blank" rel="noopener" data-cursor="Mở ↗">${browserHTML(p, artInner(p))}</a>
    <div class="app__body">
      <div><p class="app__cat mono">${esc(p.category)}</p><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p></div>
      <div class="app__actions">
        <a class="btn btn--solid magnetic" href="${url(p.live)}" target="_blank" rel="noopener">Mở web <span class="arr">↗</span></a>
        <a class="btn btn--ghost magnetic" href="${projectUrl(p)}">Chi tiết</a>
      </div>
    </div></article>`).join('') || '<p class="empty hand">Chưa có web nào được bật trong hub.</p>';

  $('#socials').innerHTML = (C.contact?.socials || []).map(s =>
    `<li><a href="${url(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');

  const term = $('#term');
  term.lines = [
    ['t-cmd', '$ whoami'], ['t-out', `${C.profile?.name} — ${C.profile?.role}`],
    ['t-cmd', '$ cat stack.txt'], ['t-out', (C.stack || []).slice(0, 6).join(' · ')],
    ['t-cmd', '$ echo $STATUS'], ['t-out', C.profile?.status || '']
  ];
}

function renderProjects(C) {
  const projects = C.projects || [];
  const slug = new URLSearchParams(location.search).get('p');
  const i = projects.findIndex(p => p.slug === slug);
  const main = $('#page');

  if (i < 0) {
    const cats = [...new Set(projects.map(p => p.category))];
    main.innerHTML = `<section class="plist wrap">
      <div class="label reveal"><span>✦</span> ${projects.length} dự án</div>
      <h1 class="h2 reveal">Mọi thứ mình<br>đã build.</h1>
      <div class="filters reveal" role="group" aria-label="Lọc theo loại">
        <button class="is-on" data-filter="">Tất cả</button>${cats.map(c => `<button data-filter="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="plist__grid">${projects.map(cardHTML).join('')}</div></section>`;
    $$('[data-filter]').forEach(b => b.addEventListener('click', () => {
      $$('[data-filter]').forEach(x => x.classList.toggle('is-on', x === b));
      $$('.plist__grid .card').forEach(c => { c.hidden = !!b.dataset.filter && c.dataset.cat !== b.dataset.filter; });
    }));
    return;
  }

  const p = projects[i], prev = projects[(i - 1 + projects.length) % projects.length], next = projects[(i + 1) % projects.length];
  document.title = `${p.title} — Khúc Việt Anh`;
  main.innerHTML = `<article class="pd">
    <header class="pd__head wrap">
      <a class="pd__back" href="projects.html">← Tất cả dự án</a>
      <p class="pd__meta mono fade">${esc(p.category)} · ${esc(p.year)} <span class="pill">${esc(p.status)}</span></p>
      <h1 class="pd__title"><span class="line"><span>${esc(p.title)}</span></span></h1>
      <p class="pd__lead fade" style="--d:.3s">${esc(p.summary)}</p>
      <div class="hero__cta fade" style="--d:.45s">
        ${p.live ? `<a class="btn btn--solid magnetic" href="${url(p.live)}" target="_blank" rel="noopener">Mở web <span class="arr">↗</span></a>` : ''}
        ${p.repo ? `<a class="btn btn--ghost magnetic" href="${url(p.repo)}" target="_blank" rel="noopener">Source code</a>` : '<span class="pd__note hand">source code để riêng tư</span>'}
      </div>
    </header>
    <div class="pd__media wrap fade" style="--d:.5s"><div class="browser">${browserHTML(p, artInner(p))}</div></div>
    <div class="pd__body wrap">
      <div class="pd__main">
        <h2 class="reveal">Về dự án</h2>
        ${String(p.description || '').split(/\n\s*\n/).filter(Boolean).map(t => `<p class="reveal">${esc(t)}</p>`).join('')}
        ${(p.features || []).length ? `<h2 class="reveal">Tính năng chính</h2>
        <ul class="checks">${p.features.map((f, k) => `<li class="reveal" style="--d:${k * .06}s"><svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M4 13 L10 18 L20 5"/></svg>${esc(f)}</li>`).join('')}</ul>` : ''}
      </div>
      <aside class="pd__side reveal">
        <h3>Công nghệ</h3>
        <ul class="chips">${(p.stack || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <dl><dt>Loại</dt><dd>${esc(p.category)}</dd><dt>Năm</dt><dd>${esc(p.year)}</dd><dt>Trạng thái</dt><dd>${esc(p.status)}</dd>
        ${p.live ? `<dt>Link</dt><dd><a href="${url(p.live)}" target="_blank" rel="noopener">${esc(host(p.live))}</a></dd>` : ''}</dl>
      </aside>
    </div>
    <nav class="pd__nav wrap" aria-label="Dự án khác">
      <a href="${projectUrl(prev)}"><small>← Dự án trước</small>${esc(prev.title)}</a>
      <a href="${projectUrl(next)}"><small>Dự án tiếp →</small>${esc(next.title)}</a>
    </nav></article>`;
}

/* ---------- loader ---------- */
const loader = $('#loader');
const content = loadContent();
function finishLoad() {
  loader?.classList.add('is-done');
  document.body.classList.remove('is-loading');
  document.body.classList.add('loaded');
  if (loader) setTimeout(() => loader.remove(), 1300);
}
const minWait = new Promise(res => {
  if (!loader || reduce) return res();
  const num = $('#loadNum'), t0 = performance.now(), dur = 1900;
  (function tick(t) {
    num.textContent = Math.round(clamp((t - t0) / dur) * 100);
    if (t - t0 < dur) requestAnimationFrame(tick);
  })(t0);
  setTimeout(res, dur + 250); // timer, not rAF: rAF pauses in background tabs
});

content.then(C => {
  renderBinds(C);
  page === 'home' ? renderHome(C) : renderProjects(C);
  initEffects();
}).catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', '<p class="load-error">Không tải được nội dung (content.json). Hãy mở trang qua web server.</p>');
}).finally(() => minWait.then(() => requestAnimationFrame(finishLoad)));

/* ---------- effects (run after content is rendered) ---------- */
function splitWords(el) {
  const nodes = [...el.childNodes];
  el.textContent = '';
  nodes.forEach(n => {
    if (n.nodeType !== 3) { n.classList.add('w'); el.append(n); return; }
    n.textContent.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) return el.append(part);
      const s = document.createElement('span');
      s.className = 'w'; s.textContent = part; el.append(s);
    });
  });
  return $$('.w', el);
}

function countUp(el) {
  const end = +el.dataset.count, t0 = performance.now(), dur = 1600;
  (function tick(t) {
    const p = clamp((t - t0) / dur);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

function typeTerm(term) {
  const code = $('#termCode', term), lines = term.lines || [];
  code.textContent = '';
  const cursor = () => code.insertAdjacentHTML('beforeend', '<span class="term__cursor"></span>');
  if (reduce) { lines.forEach(([c, t]) => code.insertAdjacentHTML('beforeend', `<span class="${c}">${esc(t)}</span>\n`)); return cursor(); }
  let li = 0, ci = 0, span;
  (function step() {
    if (li >= lines.length) return cursor();
    const [cls, text] = lines[li];
    if (ci === 0) { span = document.createElement('span'); span.className = cls; code.append(span); }
    span.textContent = text.slice(0, ++ci);
    if (ci >= text.length) { code.append('\n'); li++; ci = 0; setTimeout(step, cls === 't-cmd' ? 260 : 140); }
    else setTimeout(step, cls === 't-cmd' ? 50 : 10);
  })();
}

function initEffects() {
  const aboutEl = $('#aboutText');
  const words = aboutEl ? splitWords(aboutEl) : [];

  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    $$('[data-count]', e.target).forEach(countUp);
    if (e.target.id === 'term') typeTerm(e.target);
    io.unobserve(e.target);
  }), { threshold: .15 });
  $$('.reveal, [data-inview]').forEach(el => io.observe(el));

  const nav = $('#nav'), bar = $('.progress');
  const work = $('#work'), track = $('#workTrack'), workBar = $('#workBar'), workNum = $('#workNum');
  const cards = $$('.card');
  const proc = $('#procBody'), steps = proc ? $$('.step', proc) : [];
  let lastY = scrollY, ticking = false;

  const sizeWork = () => { if (work) work.style.height = Math.max(0, track.scrollWidth - innerWidth) + innerHeight + 'px'; };

  function onScroll() {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    bar.style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - vh))})`;
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > 500);
    lastY = y;

    if (words.length) {
      const r = aboutEl.getBoundingClientRect();
      const n = Math.round(clamp((vh * .8 - r.top) / (r.height + vh * .3)) * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }
    if (work) {
      const n = track.children.length;
      const max = work.offsetHeight - vh;
      const wp = max > 0 ? clamp(-work.getBoundingClientRect().top / max) : 0;
      track.style.transform = `translate3d(${-wp * Math.max(0, track.scrollWidth - innerWidth)}px,0,0)`;
      workBar.style.transform = `scaleX(${wp})`;
      workNum.textContent = String(Math.min(n, Math.round(wp * (n - 1)) + 1)).padStart(2, '0');
    }
    if (proc) {
      const pr = proc.getBoundingClientRect();
      const pp = clamp((vh * .65 - pr.top) / pr.height);
      proc.style.setProperty('--p', pp);
      steps.forEach(s => s.classList.toggle('on', s.offsetTop / pr.height < pp + .02));
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', () => { sizeWork(); onScroll(); });
  sizeWork(); onScroll();
  document.fonts?.ready.then(() => { sizeWork(); onScroll(); });
  $$('img', track || document).forEach(img => img.addEventListener('load', () => { sizeWork(); onScroll(); }, { once: true }));

  if (fine) {
    document.body.classList.add('has-cursor');
    const dot = $('.cursor-dot'), ring = $('.cursor-ring');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`; });
    (function loop() {
      rx += (mx - rx) * .18; ry += (my - ry) * .18;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('a, button, [data-cursor]');
      const view = !!t?.dataset.cursor;
      ring.classList.toggle('is-link', !!t && !view);
      ring.classList.toggle('is-view', view);
      ring.dataset.label = view ? t.dataset.cursor : '';
    });
  }

  if (fine && !reduce) {
    const hero = $('.hero');
    if (hero) {
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5) * 2);
        hero.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5) * 2);
      });
      hero.addEventListener('pointerleave', () => { hero.style.setProperty('--mx', 0); hero.style.setProperty('--my', 0); });
    }
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .3}px,${(e.clientY - r.top - r.height / 2) * .4}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    cards.forEach(c => {
      const a = $('.card__art', c);
      c.addEventListener('pointermove', e => {
        const r = a.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        a.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translate(-5px,-5px)`;
      });
      c.addEventListener('pointerleave', () => { a.style.transform = ''; });
    });
  }

  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch { return; }
    b.classList.add('copied');
    setTimeout(() => b.classList.remove('copied'), 1500);
  }));
}
