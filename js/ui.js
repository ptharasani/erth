// واجهة الموقع: العناوين، اللوحة، التلميح، القائمة، ونافذة الحجز عبر واتساب.
import { STATIONS, TEAM, CONTACT, SERVICES, REGIONS } from './content.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const body = document.body;
const title = $('#title'), tip = $('#tip'), panel = $('#panel'), panelBody = $('#panelBody'), modal = $('#modal'), modalBody = $('#modalBody');
const leader = $('#leader'), leaderPath = $('#leaderPath'), leaderDot = $('#leaderDot');
let nav = { go() {}, next() {}, prev() {}, current: 0 };
let panelOnClose = null, leaderFn = null;
export const state = { panelOpen: false, modalOpen: false, menuOpen: false };
export const blocking = () => state.modalOpen || state.menuOpen;

// ── بناء القائمة والنقاط ──
export function init(navApi) {
  nav = navApi;
  STATIONS.forEach((s, i) => {
    const li = el('li'); const b = el('button', '', esc(s.nav)); b.onclick = () => { toggleMenu(false); nav.go(i); }; li.append(b); li.style.transitionDelay = `${i * 45}ms`; $('#menuList').append(li);
    const d = el('li'); const db = el('button', '', `<i></i><span><em>${pad(i + 1)}</em>${esc(s.nav)}</span>`); db.setAttribute('aria-label', s.nav); db.onclick = () => nav.go(i); d.append(db); $('#dots').append(d);
  });
  $('#cOf').textContent = $('#wipeOf').textContent = '/ ' + pad(STATIONS.length);
  $('#menuBtn').onclick = () => toggleMenu();
  $('#prevBtn').onclick = () => nav.prev();
  $('#nextBtn').onclick = () => nav.next();
  $('#bookBtn').onclick = () => openBooking();
  $('#panelClose').onclick = () => closePanel();
  $('#modalClose').onclick = () => closeModal();
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeModal(); });
  document.querySelector('.brand').onclick = (e) => { e.preventDefault(); nav.go(0); };
}
const pad = (n) => String(n).padStart(2, '0');
export function toggleMenu(v = !state.menuOpen) { state.menuOpen = v; body.classList.toggle('menu-open', v); $('#menu').setAttribute('aria-hidden', String(!v)); }

// ── عنوان القسم ──
let titleTimer;
export function setStation(i, extra) {
  const s = STATIONS[i];
  document.querySelectorAll('#dots button').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('seen', k < i); });
  $('#cNum').textContent = pad(i + 1); $('#cName').textContent = s.nav;
  document.querySelectorAll('#menuList button').forEach((b, k) => b.classList.toggle('on', k === i));
  $('#prevBtn').disabled = i === 0; $('#nextBtn').disabled = i === STATIONS.length - 1;
  title.classList.add('swap'); clearTimeout(titleTimer);
  titleTimer = setTimeout(() => {
    $('#tKicker').textContent = s.kicker; $('#tTitle').textContent = s.title; $('#tTitle').classList.toggle('long', s.title.length > 24); $('#tSub').textContent = s.sub; $('#tSub').style.display = s.sub ? '' : 'none';
    const acts = $('#tActions'); acts.innerHTML = ''; title.querySelectorAll('.t-list, .t-slogan').forEach((n) => n.remove());
    if (extra) extra(acts, title);
    $('#hint').textContent = matchMedia('(pointer: coarse)').matches && s.touch ? s.touch : s.hint;
    title.classList.remove('swap'); stageDirty();
  }, 120);
  stageDirty();
  history.replaceState(null, '', '#' + s.id);
}
// فتح رابط خارجي بطريقة تشتغل في كل المتصفحات
export function openLink(url) { const a = document.createElement('a'); a.href = url; if (/^https?:/.test(url)) { a.target = '_blank'; a.rel = 'noopener'; } document.body.append(a); a.click(); a.remove(); }
export function button(label, cls, fn) { const b = el('button', 'btn ' + cls, esc(label)); b.onclick = fn; return b; }
export function setTools(node) { const t = $('#stationTools'); t.innerHTML = ''; if (node) t.append(node); body.classList.toggle('has-tools', !!node); stageDirty(); }

// ── رقم القسم واسمه أثناء الانتقال ──
export function setFxLabel(i) { $('#wipeNum').textContent = pad(i + 1); $('#wipeName').textContent = STATIONS[i].nav; }
export const fxOn = (v) => body.classList.toggle('fx-on', v);
export const fxIn = (v) => body.classList.toggle('fx-in', v); // القسم الجديد لسه يدخل: الأسماء فوق المجسمات تنتظر

// ── المسرح: المساحة المخصصة للمجسمات بالبكسل. عمود الكلام واللوحة برّاها، فما يتراكبوا أبداً ──
// قراءة أماكن العناصر من الصفحة مكلفة لو صارت كل فريم، فنقراها بس لما يتغير شيء (تغيير قسم، لوحة، حجم الشاشة)
let stageCx = -1, stageCy = -1, stageCache = null, stageKey = '', stageUntil = 0, stageNext = 0, panelRect = null;
export function stageDirty(ms = 1500) { stageUntil = performance.now() + ms; stageNext = 0; panelRect = null; }
addEventListener('resize', () => stageDirty());
export function stageRect(mobile, hasTools) {
  const now = performance.now(), key = `${mobile}|${hasTools}|${state.panelOpen}`;
  if (stageCache && key === stageKey && (now < stageNext || now > stageUntil + 120)) return stageCache;
  if (key !== stageKey) { stageKey = key; stageUntil = Math.max(stageUntil, now + 1500); }
  stageNext = now + 90;
  const W = innerWidth, H = innerHeight; let r;
  if (mobile) {
    const tb = title.getBoundingClientRect();
    r = state.panelOpen ? { l: 0, r: W, t: 62, b: H * 0.335 } : { l: 6, r: W - 6, t: Math.min(tb.bottom + 8, H * 0.42), b: H - (hasTools ? 150 : 118) };
  } else {
    const edge = (state.panelOpen ? panel : title).getBoundingClientRect().left;
    r = { l: 58, r: Math.max(360, edge - 34), t: 92, b: H - (hasTools ? 96 : 34) };
  }
  const cx = Math.round((r.l + r.r) / 2), cy = Math.round((r.t + r.b) / 2); if (cx !== stageCx || cy !== stageCy) { stageCx = cx; stageCy = cy; const ds = document.documentElement.style; ds.setProperty('--stage-cx', cx + 'px'); ds.setProperty('--stage-cy', cy + 'px'); }
  return (stageCache = r);
}

// ── التلميح ──
export function showTip(name, sub, x, y) {
  tip.innerHTML = `<b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; tip.classList.add('on'); moveTip(x, y);
}
export function moveTip(x, y) {
  const w = tip.offsetWidth, h = tip.offsetHeight; let tx = x + 22, ty = y + 22;
  if (tx + w > innerWidth - 10) tx = x - w - 22; if (ty + h > innerHeight - 10) ty = y - h - 22;
  tip.style.transform = `translate(${Math.max(8, tx)}px, ${Math.max(8, ty)}px)`;
}
export function hideTip() { tip.classList.remove('on'); }

// ── اللوحة ──
export function openPanel(nodes, { onClose = null, leader: lf = null } = {}) {
  if (state.panelOpen && panelOnClose && panelOnClose !== onClose) { const f = panelOnClose; panelOnClose = null; f(true); }
  panelBody.innerHTML = ''; nodes.filter(Boolean).forEach((n, i) => { n.style.setProperty('--i', i); panelBody.append(n); });
  panelBody.scrollTop = 0; panelOnClose = onClose; leaderFn = lf; leader.classList.toggle('on', !!lf);
  if (!state.panelOpen) { state.panelOpen = true; void panel.offsetWidth; body.classList.add('panel-open'); }
  panel.setAttribute('aria-hidden', 'false'); hideTip(); stageDirty(); leaderD = '';
}
export function closePanel() {
  if (!state.panelOpen) return; state.panelOpen = false; body.classList.remove('panel-open'); panel.setAttribute('aria-hidden', 'true'); leaderFn = null; stageDirty();
  const f = panelOnClose; panelOnClose = null; if (f) f(false);
}
export function update() { // خط الربط بين المجسم واللوحة
  if (!state.panelOpen || !leaderFn) return; const p = leaderFn(); if (!p) { leaderPath.setAttribute('d', ''); leaderDot.setAttribute('opacity', 0); return; }
  const now = performance.now(); if (!panelRect || now < stageUntil) { if (!panelRect || now > leaderNext) { panelRect = panel.getBoundingClientRect(); leaderNext = now + 90; } }
  const r = panelRect, px = Math.round(p.x * 2) / 2, py = Math.round(p.y * 2) / 2, tx = px < r.left ? r.left : r.right, ty = Math.min(r.bottom - 60, Math.max(r.top + 60, py));
  const mx = (px + tx) / 2, d = `M${px},${py} C${mx},${py} ${mx},${ty} ${tx},${ty}`; if (d === leaderD) return; leaderD = d;
  leaderPath.setAttribute('d', d); leaderDot.setAttribute('opacity', 1); leaderDot.setAttribute('transform', `translate(${px},${py - 8.5}) rotate(45)`);
}
let leaderNext = 0, leaderD = '';

// قطع جاهزة لمحتوى اللوحة
export const P = {
  tag: (t) => el('span', 'p-tag', esc(t)),
  title: (t) => el('h2', 'p-title', esc(t)),
  lead: (t) => el('p', 'p-lead', esc(t)),
  text: (t) => el('p', 'p-text', esc(t)),
  quote: (t) => el('p', 'p-quote', esc(t)),
  h: (t) => el('h3', 'p-h', esc(t)),
  list: (items, cls = '') => el('ul', 'p-list ' + cls + (items.length < 3 || items.some((i) => String(Array.isArray(i) ? i[0] : i).length > 34) ? ' wide' : ''), items.map((i) => Array.isArray(i) ? `<li>${esc(i[0])}${i[1] ? `<small>${esc(i[1])}</small>` : ''}</li>` : `<li>${esc(i)}</li>`).join('')),
  chips: (items) => el('div', 'p-chips', items.map((i) => `<span>${esc(i)}</span>`).join('')),
  img: (src, alt = '') => { const i = el('img', 'p-img'); i.src = src; i.alt = alt; i.loading = 'lazy'; return i; },
  note: (t) => el('p', 'p-note', esc(t)),
  alert: (t) => el('p', 'p-alert', esc(t)),
  // ثلاث بطاقات لطريقة التطبيق: صورة مصغرة (لو موجودة) + عنوان + شرح قصير
  apply: (id, items, hasImg) => { const g = el('div', 'p-apply'); items.forEach(([t, d], k) => { const c = el('figure', hasImg ? 'has' : '', `<div class="ph">${hasImg ? `<img src="assets/img/tools/${id}-${k + 1}.webp" alt="${esc(t)}" loading="lazy">` : `<span>${k + 1}</span>`}</div><figcaption><b>${esc(t)}</b><small>${esc(d)}</small></figcaption>`); g.append(c); }); return g; },
  cta: (...btns) => { const d = el('div', 'p-cta' + (btns.length === 2 ? ' two' : '')); d.append(...btns); return d; },
};

// ── الحجز عبر واتساب ──
const book = { step: 1, who: null, name: '', phone: '', problem: '', time: 'أي وقت' };
export function openBooking({ who = null, problem = '' } = {}) {
  book.step = who ? 2 : 1; if (who) book.who = who; if (problem) book.problem = problem;
  state.modalOpen = true; modal.classList.add('on'); modal.setAttribute('aria-hidden', 'false'); renderBooking();
}
export function closeModal() { state.modalOpen = false; vidToken++; modal.classList.remove('on', 'video'); modal.setAttribute('aria-hidden', 'true'); if (modalBody.querySelector('.m-video')) modalBody.innerHTML = ''; }
// تشغيل فيديو يوتيوب داخل الموقع. على الجوال وسفاري المتصفح ما يسمح بالتشغيل التلقائي للإطار العادي،
// فنستخدم مشغل يوتيوب الرسمي ونأمره بالتشغيل أول ما يجهز (نفس ضغطة المستخدم).
const needsApi = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.vendor || '').includes('Apple') || matchMedia('(pointer: coarse)').matches;
let ytApi = null, vidToken = 0;
function loadYT() {
  if (!ytApi) ytApi = new Promise((res) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true; document.head.append(sc);
  });
  return ytApi;
}
export function warmVideo() { if (needsApi) loadYT(); } // نحمّل المشغل من أول ما يدخل الزائر قسم فيه فيديوهات، عشان الضغطة تشغّل فوراً
export function openVideo(yt, name, sub = '', list = '') {
  state.modalOpen = true; modal.classList.add('on', 'video'); modal.setAttribute('aria-hidden', 'false'); modalBody.innerHTML = ''; modalBody.scrollTop = 0;
  const wrap = el('div', 'm-video'), token = ++vidToken;
  if (needsApi) {
    const holder = document.createElement('div'); wrap.append(holder);
    loadYT().then((YT) => { if (token !== vidToken || !holder.isConnected) return; new YT.Player(holder, { width: '100%', height: '100%', videoId: yt, playerVars: { autoplay: 1, playsinline: 1, rel: 0 }, events: { onReady: (e) => { try { e.target.playVideo(); } catch (err) { /* يبقى زر التشغيل ظاهر */ } } } }); });
  } else {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`; f.title = name; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
    wrap.append(f);
  }
  const act = el('div', 'm-actions'), a = el('a', 'btn ghost', 'افتح على يوتيوب'); a.href = `https://www.youtube.com/watch?v=${yt}${list ? '&list=' + list : ''}`; a.target = '_blank'; a.rel = 'noopener'; act.append(a);
  modalBody.append(el('h2', 'm-title', esc(name))); modalBody.lastChild.id = 'mTitle'; if (sub) modalBody.append(el('p', 'm-sub', esc(sub))); modalBody.append(wrap, act);
}

function message() {
  const lines = ['السلام عليكم، أبغى أحجز موعد في مركز إرث الرعاية الطبية.', '', `الاسم: ${book.name}`];
  if (book.phone) lines.push(`الجوال: ${book.phone}`);
  lines.push(`الأخصائي: ${book.who || 'ما عندي تفضيل'}`, `المشكلة: ${book.problem}`, `الوقت المناسب: ${book.time}`);
  return lines.join('\n');
}
function renderBooking() {
  const steps = `<div class="m-steps">${[1, 2, 3].map((n) => `<i class="${n <= book.step ? 'on' : ''}"></i>`).join('')}</div>`;
  modalBody.innerHTML = ''; modalBody.scrollTop = 0;
  if (book.step === 1) {
    modalBody.append(el('div', '', `${steps}<h2 class="m-title" id="mTitle">اختر الأخصائي</h2><p class="m-sub">اختر الأخصائي اللي تبغى تحجز عنده، أو خلّنا نرشح لك الأنسب لحالتك.</p>`));
    const grid = el('div', 'm-grid');
    const any = el('button', 'm-card' + (book.who === null ? ' on' : ''), `<span class="any"></span><b>ما عندي تفضيل</b><small>رشحوا لي الأنسب</small>`);
    any.onclick = () => { book.who = null; book.step = 2; renderBooking(); }; grid.append(any);
    TEAM.filter((t) => !t.noBook).forEach((t) => {
      const c = el('button', 'm-card' + (book.who === t.name ? ' on' : ''), `<img src="assets/img/team/${t.id}.webp" alt="" loading="lazy"><b>${esc(t.name)}</b><small>${esc(t.role)}</small>`);
      c.onclick = () => { book.who = t.name; book.step = 2; renderBooking(); }; grid.append(c);
    });
    modalBody.append(grid);
  } else if (book.step === 2) {
    modalBody.append(el('div', '', `${steps}<h2 class="m-title" id="mTitle">بياناتك</h2><p class="m-sub">الحجز مع: <b>${esc(book.who || 'الأخصائي الأنسب لحالتك')}</b></p>`));
    const f = el('form', 'm-form', `
      <div class="m-row">
        <label>الاسم<input name="name" autocomplete="name" value="${esc(book.name)}" placeholder="اكتب اسمك"></label>
        <label>رقم الجوال <small>(اختياري)</small><input name="phone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" value="${esc(book.phone)}" placeholder="05xxxxxxxx"></label>
      </div>
      <label>إيش المشكلة اللي تعاني منها؟<textarea name="problem" placeholder="مثال: ألم أسفل الظهر من شهرين ينزل للرجل اليمين">${esc(book.problem)}</textarea></label>
      <label>الوقت المناسب لك<select name="time">${['أي وقت', 'الصباح', 'الظهر', 'العصر', 'المساء'].map((t) => `<option${t === book.time ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`);
    const act = el('div', 'm-actions');
    const back = button('رجوع', 'ghost', () => { save(); book.step = 1; renderBooking(); }); back.type = 'button';
    const next = button('جهّز الرسالة', 'primary', null); next.type = 'submit';
    act.append(next, back); f.append(act);
    const save = () => { const d = new FormData(f); book.name = d.get('name').trim(); book.phone = d.get('phone').trim(); book.problem = d.get('problem').trim(); book.time = d.get('time'); };
    f.onsubmit = (e) => {
      e.preventDefault(); save(); let ok = true;
      for (const k of ['name', 'problem']) { const i = f.elements[k]; const bad = !book[k]; i.classList.toggle('err', bad); if (bad && ok) { i.focus(); ok = false; } }
      if (ok) { book.step = 3; renderBooking(); }
    };
    modalBody.append(f);
  } else {
    modalBody.append(el('div', '', `${steps}<h2 class="m-title" id="mTitle">رسالتك جاهزة</h2><p class="m-sub">راجع الرسالة، وبضغطة وحدة تنفتح محادثة واتساب المركز والرسالة مكتوبة، وما يبقى عليك إلا تضغط إرسال.</p>`));
    modalBody.append(el('div', 'm-msg', esc(message())));
    const act = el('div', 'm-actions');
    const send = el('a', 'btn wa', 'إرسال عبر واتساب'); send.href = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message())}`; send.target = '_blank'; send.rel = 'noopener';
    act.append(send, button('تعديل', 'ghost', () => { book.step = 2; renderBooking(); })); modalBody.append(act);
  }
}

// ── لوحات جاهزة تستخدمها الأقسام ──
export function serviceNodes(pick) {
  const nodes = [P.tag('خدماتنا العلاجية'), P.title('في مركز إرث، نقدم رعاية علاجية مخصصة للحالات التالية:')];
  SERVICES.forEach((s, k) => {
    const d = el('div', 'p-service', `<h3><em>${pad(k + 1)}</em>${esc(s.title)}</h3>${s.desc ? `<p>${esc(s.desc)}</p>` : ''}`);
    const chips = el('div', 'p-chips');
    s.regions.forEach((id) => { const r = REGIONS.find((x) => x.id === id); if (!r) return; const b = el('button', '', esc(r.name)); b.onclick = () => pick(id); chips.append(b); });
    d.append(chips); nodes.push(d);
  });
  nodes.push(P.cta(button('احجز تقييمك', 'primary', () => openBooking())));
  return nodes;
}
export function personNodes(t) {
  const head = el('div', 'p-person', `<img src="assets/img/team/${t.id}.webp" alt="${esc(t.name)}"><div><span class="p-tag">${esc(t.role)}</span><h2 class="p-title">${esc(t.name)}</h2></div>`);
  const nodes = [head, P.h('المؤهلات'), P.list(t.quals, 'wide'), P.h('العلاج'), P.chips(t.treats)];
  if (!t.noBook) nodes.push(P.cta(button(`احجز مع ${t.name}`, 'primary', () => openBooking({ who: t.name }))));
  return nodes;
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (state.modalOpen) closeModal(); else if (state.menuOpen) toggleMenu(false); else closePanel(); }
});
