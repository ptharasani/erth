// المحرك: المشهد، الكاميرا، التنقل بين الأقسام، والتقاط المجسمات بالماوس واللمس.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { STATIONS } from './content.js';
import * as ui from './ui.js';
import { makeBackground, makeDust, damp, clamp, easeOut, C, setTextureHook, fastPick } from './lib.js';
import createHero from './st-hero.js';
import createAbout from './st-about.js';
import createBody from './st-body.js';
import createTools from './st-tools.js';
import createTeam from './st-team.js';
import createPodcast from './st-podcast.js';
import createLibrary from './st-library.js';
import createPartners from './st-partners.js';
import createContact from './st-contact.js';
import { createFx, OUT, IN } from './fx.js';
import { createPost } from './post.js';

const canvas = document.getElementById('gl');
const SP = 80; // المسافة بين الأقسام
let W = innerWidth, H = innerHeight;
const mobile = () => W <= 860;
const coarse = matchMedia('(pointer: coarse)').matches;

// نقيس سرعة الشاشة (60 أو 90 أو 120 فريم) من أول لحظة، عشان نعرف كم وقت معنا لكل فريم
const probe = []; let probeLast = 0, probing = true;
requestAnimationFrame(function p(t) { if (!probing) return; if (probeLast) probe.push(t - probeLast); probeLast = t; requestAnimationFrame(p); });
const lowPct = (arr) => { const d = arr.filter((x) => x > 3 && x < 40).sort((a, b) => a - b); return d.length >= 12 ? d[Math.floor(d.length * 0.2)] / 1000 : 0; };

// ── المشهد ──
const CPR = Math.min(devicePixelRatio || 1, coarse ? 2 : 1.5); // دقة الشاشة النهائية (الكلام والحبيبات). الجوال شاشته أكثف فياخذ سقف أعلى
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(CPR); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0; // ألوان صريحة على خلفية فاتحة
renderer.shadowMap.enabled = !coarse; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffffff, 0.02); scene.fog.color.setRGB(1.06, 1.07, 1.12); // نفس لون الخلفية
const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 900);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture; scene.environmentIntensity = 0.5;

const bg = makeBackground(); scene.add(bg);
const dust = makeDust(coarse ? 500 : 1100, -30, SP * (STATIONS.length - 1) + 30), DUST = dust.material.opacity; scene.add(dust);
// إضاءة استوديو نهارية: ضوء رئيسي يرمي ظل ناعم، تعبئة قوية عشان ما في جهة سوداء، ولمسة فيروزية من الخلف
const key = new THREE.DirectionalLight(0xfff6ea, 2.3); const fill = new THREE.DirectionalLight(0xc3caff, 0.9); const rim = new THREE.DirectionalLight(C.teal, 1.1);
key.castShadow = !coarse; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 2.2;
Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 1, far: 40 });
scene.add(key, key.target, fill, fill.target, rim, rim.target, new THREE.HemisphereLight(0xffffff, 0xc4c9e6, 1.5));
function placeLights(st) { // الإضاءة ثابتة على القسم، ما تتحرك مع الكاميرا
  const x = st.home;
  key.position.set(x + 5.5, 9, 7.5); key.target.position.set(x, 2, 0);
  fill.position.set(x - 8, 3, 5); fill.target.position.set(x, 2, 0);
  rim.position.set(x - 4, 6, -9); rim.target.position.set(x, 2, 0);
}

// المشهد ينرسم في هدف واحد، ثم التوهج وتعتيم الأطراف والحبيبات في مرور أخير خفيف
const post = createPost(renderer, { samples: coarse ? 2 : 4, bloom: false, vignette: [0.9, 0.91, 0.97], grain: 0.004 }); // بدون توهج: على الأبيض ما يبان ويثقّل
let fx = null; // الانتقال بين الأقسام، ينضاف بعد تحميل الهيكل

// ── الجودة تتكيف مع الجهاز: نقيس وقت كرت الشاشة لكل فريم ونعدّل دقة المشهد عشان الحركة تبقى ناعمة ──
const PR_MIN = Math.min(CPR, 0.6);
let pr = Math.min(CPR, 1), refresh = 1 / 60, div = 1, cool = 1.2, gpuAvg = 0, gpuPrev = 0, lagT = 0, tier = 0, shadowEvery = 2, budgetK = 0.6;
const memo = [], recent = []; let prCeil = CPR, calmT = 0;
function setPR(v, force) { v = clamp(v, PR_MIN, CPR); if (!force && Math.abs(v - pr) < 0.03) return false; pr = v; post.setSize(W * pr, H * pr); return true; }
post.onSample = (ms) => { const g = Math.max(ms, gpuPrev); gpuPrev = ms; gpuAvg = gpuAvg ? gpuAvg + (g - gpuAvg) * 0.12 : g; };
function govern(raw) {
  // سرعة الشاشة: أقصر فترة تتكرر بين الفريمات
  if (div === 1) { recent.push(raw * 1000); if (recent.length >= 120) { const r = lowPct(recent); recent.length = 0; if (r && r < refresh * 0.85) refresh = Math.max(r, 1 / 165); } }
  if (!started || switching || enterT < 1.2 || raw > 0.25) return;
  lagT = raw > refresh * div * 1.45 ? lagT + raw : Math.max(0, lagT - raw * 2);
  cool -= raw; if (cool > 0) return;
  const budget = refresh * div * 1000 * budgetK;
  if (post.hasTimer && gpuAvg) {
    const k = gpuAvg / budget;
    if (k > 1.1) {
      if (pr > PR_MIN + 0.01) { const f = clamp(1 / Math.sqrt(k), 0.72, 0.94); if (setPR(pr * f)) gpuAvg *= f * f; cool = 0.5; }
      else if (tier < 1) { tier = 1; post.setSamples(2); gpuAvg *= 0.8; cool = 1; }
      // الشاشة سريعة (90 أو 120) والقسم أثقل من إنه يلحقها: نثبت على نص سرعتها بخطوات متساوية، بدل ما نخرّب الشكل
      else if (k > 1.25 && div < 2 && refresh < 1 / 75) { div = 2; tier = 0; post.setSamples(coarse ? 2 : 4); setPR(pr * 1.3, true); gpuAvg = 0; cool = 1.2; }
      else cool = 2;
    } else if (k < 0.78 && lagT < 0.1) {
      if (pr < CPR - 0.01) { const f = Math.min(1.14, Math.sqrt(0.88 / k)); if (setPR(pr * f)) gpuAvg *= f * f; cool = 1.6; }
      else if (tier > 0 && k < 0.6) { tier = 0; post.setSamples(coarse ? 2 : 4); gpuAvg *= 1.3; cool = 2; }
      else if (div > 1 && k < 0.42) { div = 1; gpuAvg = 0; cool = 2; }
      else cool = 1;
    } else if (lagT > 0.8 && budgetK > 0.36) { budgetK *= 0.88; lagT = 0; cool = 0.6; } // كرت الشاشة مشغول بأشياء ثانية: نترك له مجال أكبر
  } else if (!post.hasTimer && lagT < 0.05 && pr < prCeil - 0.02) { // الحركة ناعمة وفيه مجال: نرفع الدقة شوي شوي لين سقف الشاشة
    calmT += 1; cool = 0.5; if (calmT >= 4) { calmT = 0; setPR(Math.min(prCeil, pr * 1.1)); cool = 1.4; }
  } else if (lagT > 0.5) { // المتصفح ما يعطي قياس مباشر: نراقب تأخر الفريمات ونخفف بالتدريج
    lagT = 0; cool = 1; calmT = 0;
    if (pr > PR_MIN + 0.01) { prCeil = Math.max(PR_MIN, pr * 0.92); setPR(pr * 0.85); } // وما نرجع نطلع فوق المستوى اللي علّق عنده
    else if (tier < 3) { tier++; if (tier === 1) post.setSamples(2); else if (tier === 2) shadowEvery = 4; else post.bloom = false; }
  }
}

// ── تحميل المجسمات ──
const loadbar = document.getElementById('loadbar');
const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
const B64 = document.documentElement.hasAttribute('data-models-b64'); // نسخة المعاينة تحمّل المجسمات كنص
const loadGLB = (url, onProg) => B64
  ? fetch(url + '.txt').then((r) => r.text()).then((t) => { const bin = atob(t.trim()), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); onProg && onProg(1); return new Promise((res, rej) => gltf.parse(u.buffer, '', (g) => res(g.scene), rej)); })
  : new Promise((res, rej) => gltf.load(url, (g) => res(g.scene), (e) => onProg && e.total && onProg(e.loaded / e.total), rej));

// ── أدوات يستخدمها كل قسم ──
const _v = new THREE.Vector3();
const pointer = { x: 0, y: 0, px: -9999, py: -9999, inside: false };
const ctx = {
  THREE, scene, camera, renderer, mobile, coarse, ui, pointer, loadGLB, assets: {}, stagePx: { l: 0, r: 1, t: 0, b: 1 },
  project(world, out = {}) { _v.copy(world).project(camera); out.x = (_v.x * 0.5 + 0.5) * W; out.y = (-_v.y * 0.5 + 0.5) * H; out.behind = _v.z > 1; return out; },
  go: (id) => go(typeof id === 'number' ? id : STATIONS.findIndex((s) => s.id === id)),
  station: (id) => stations[STATIONS.findIndex((s) => s.id === id)],
  // تجهيز خامات مجموعة قبل ما تظهر، عشان ما يصير تقطيع أول مرة
  compile(group) { const v = group.visible; group.visible = true; renderer.compile(scene, camera); group.visible = v; },
};
setTextureHook((tex) => renderer.initTexture(tex));

let stations = [], current = 0, switching = false, hovered = null, started = false;
const camPos = new THREE.Vector3(0, 1.5, 14), camLook = new THREE.Vector3(), stage = { cx: 0.5, cy: 0.5, w: 0.6, h: 0.8 };
const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), dir = new THREE.Vector3();

const _stage = { cx: 0.5, cy: 0.5, w: 0.6, h: 0.8 };
function stageFor(st) { // مساحة المجسمات كنسبة من الشاشة، محسوبة من مكان عمود الكلام الفعلي
  const r = ui.stageRect(mobile(), !!st.tools); Object.assign(ctx.stagePx, r);
  _stage.cx = (r.l + r.r) / 2 / W; _stage.cy = (r.t + r.b) / 2 / H; _stage.w = Math.max(0.2, (r.r - r.l) / W); _stage.h = Math.max(0.2, (r.b - r.t) / H);
  return _stage;
}
function viewTarget(st) {
  const v = st.focus || st.view;
  const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const d = Math.max(v.fitH / 2 / Math.tan(vf / 2) / stage.h, v.fitW / 2 / Math.tan(hf / 2) / stage.w);
  tLook.set(v.look[0] + st.home, v.look[1], v.look[2]); // مكان القسم الثابت، مو مكان المجسم وهو يتحرك في الانتقال
  dir.set(v.dir[0], v.dir[1], v.dir[2]).normalize(); tPos.copy(tLook).addScaledVector(dir, d);
}

// الانتقال: مجسمات القسم الحالي تطلع من المسرح والقسم الجديد يدخل بحركة مختلفة في كل مرة.
// الخلفية ما تتغطى أبداً، والحركة بين كل قسمين لها شكلها: طلوع، ابتعاد في الضباب، لفّة، انسحاب للجنب...
const MOVES = [
  { y: 5.6, z: -5 }, { z: -44, s: 0.72 }, { x: -9.5, ry: 1.0, z: -4 }, { y: -5.6, z: -5 },
  { z: -30, ry: -1.5, s: 0.5 }, { x: -10, y: 2.2, s: 0.82 }, { y: 6, ry: 0.8, z: -10 }, { z: -44, y: -2, s: 0.72 },
];
let enterT = 9, shadowNow = true, trans = null;
// المقدمة عند أول فتح للموقع: الكاميرا تبدأ قريبة من الحوض وتطلع مع العمود وهو يتركب فقرة فقرة، بعدين تبعد ويدخل الكلام
const INTRO = 3.2; let introT = 9, introRate = 1;
if (!location.hash || location.hash === '#hero') document.body.classList.add('intro');
function endIntro() { const c = document.body.classList; if (c.contains('intro')) { c.remove('intro'); c.add('intro-done'); } }
addEventListener('pointerdown', () => { if (introT < INTRO) introRate = 3.5; }, { passive: true }); // ضغطة وقت المقدمة تسرّعها
function pose(st, mv, k, flip) { // k: 0 في مكانه، 1 برا المسرح. flip يعكس الاتجاه الرأسي واللفّة (الدخول عكس الخروج)
  const g = st.group; if (!mv || k <= 0) { g.position.set(st.home, 0, 0); g.rotation.y = 0; g.scale.setScalar(1); return; }
  g.position.set(st.home + (mv.x || 0) * k, (mv.y || 0) * k * flip, (mv.z || 0) * k); g.rotation.y = (mv.ry || 0) * k * flip; g.scale.setScalar(1 + ((mv.s || 1) - 1) * k);
}
function go(i) {
  i = clamp(i, 0, stations.length - 1); if (!started || i === current || switching) return;
  ui.closePanel(); ui.hideTip(); setHover(null); switching = true; ui.setFxLabel(i); ui.fxOn(true);
  trans = { to: i, t: 0, phase: 0, mv: MOVES[Math.min(current, i) % MOVES.length], dir: i > current ? 1 : -1 };
  fx && fx.play(i, i < current);
}
function runTrans(dt) {
  trans.t += dt; shadowNow = true;
  if (trans.phase === 0) {
    const k = Math.pow(clamp(trans.t / OUT, 0, 1), 2.2); pose(stations[current], trans.mv, k, trans.dir); dust.material.opacity = DUST * (1 - k);
    if (trans.t >= OUT) { const old = stations[current]; jump(trans.to); pose(old, null); trans.phase = 1; trans.t = 0; ui.fxOn(false); ui.fxIn(true); }
  }
  if (trans.phase === 1) {
    const st = stations[current], k = 1 - easeOut(clamp(trans.t / IN, 0, 1)); if (!st.ownIntro) pose(st, trans.mv, k, -trans.dir); dust.material.opacity = DUST * (1 - k);
    if (trans.t >= IN) { pose(st, null); dust.material.opacity = DUST; trans = null; switching = false; ui.fxIn(false); }
  }
}
function jump(i) {
  const prev = stations[current]; if (prev !== stations[i]) { prev.leave && prev.leave(); prev.group.visible = false; pose(prev, null); memo[current] = { pr, div }; }
  if (introT < INTRO) { introT = 9; endIntro(); }
  current = i; activate(); enterT = 0; shadowNow = true;
  if (memo[i]) { div = memo[i].div; if (setPR(memo[i].pr)) gpuAvg = 0; cool = 1.2; } else div = 1; // كل قسم يتذكر الدقة اللي تناسبه
  const st = stations[i]; Object.assign(stage, stageFor(st)); viewTarget(st);
  camLook.copy(tLook); camPos.copy(tPos); // الكاميرا تنتقل مباشرة، والحركة كلها من المجسمات نفسها
}
function activate() {
  const st = stations[current]; st.group.visible = true; st.prepare && st.prepare(); const nx = stations[current + 1]; nx && nx.prepare && nx.prepare();
  st.enter && st.enter(); ui.setStation(current, st.titleExtra ? (a, t) => st.titleExtra(a, t) : null); ui.setTools(st.tools || null);
}

// ── الالتقاط ──
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(px, py) {
  const st = stations[current]; if (!st.pickables || !st.pickables.length) return null;
  ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = st.fastPick && !coarse ? fastPick(ray.ray, st.pickables) : ray.intersectObjects(st.pickables, false);
  if (!hits.length) return null;
  return st.resolve ? st.resolve(hits) : { data: hits[0].object.userData.pick, hit: hits[0] };
}
function setHover(res) {
  const data = res ? res.data : null; if (data === hovered) return; hovered = data;
  const st = stations[current]; st.hover && st.hover(data, res && res.hit);
  canvas.style.cursor = data ? 'pointer' : st.drag ? 'grab' : '';
}

// ── الإدخال ──
let down = null, pickDirty = false, pickAt = 0;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false, type: e.pointerType, axis: null }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  pointer.px = e.clientX; pointer.py = e.clientY; pointer.x = (e.clientX / W) * 2 - 1; pointer.y = -(e.clientY / H) * 2 + 1; pointer.inside = true;
  if (down) {
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
    const tx = e.clientX - down.x, ty = e.clientY - down.y;
    if (!down.moved && Math.hypot(tx, ty) > 7) { down.moved = true; down.axis = Math.abs(tx) > Math.abs(ty) * 0.9 ? 'x' : 'y'; setHover(null); ui.hideTip(); }
    const st = stations[current];
    if (down.moved && st.drag && (down.type === 'mouse' || down.axis === 'x')) { st.drag(dx, dy); canvas.style.cursor = 'grabbing'; }
  } else if (e.pointerType === 'mouse') pickDirty = true;
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return; const d = down; down = null; canvas.style.cursor = '';
  const tx = e.clientX - d.x, ty = e.clientY - d.y;
  if (!d.moved) { // ضغطة
    const res = pick(e.clientX, e.clientY); const st = stations[current];
    if (res && res.data) { if (d.type !== 'mouse') { hovered = null; } st.click && st.click(res.data, res.hit); }
    else if (ui.state.panelOpen) ui.closePanel();
    else st.clickEmpty && st.clickEmpty();
  } else if (d.type !== 'mouse' && d.axis === 'y' && Math.abs(ty) > 70 && performance.now() - d.t < 700 && !ui.state.panelOpen) {
    go(current + (ty < 0 ? 1 : -1)); // سحب للأعلى = القسم التالي
  }
});
canvas.addEventListener('pointerleave', () => { pointer.inside = false; if (!down) { setHover(null); ui.hideTip(); } });
let wheelLock = 0, wheelAcc = 0;
addEventListener('wheel', (e) => {
  if ((e.target.closest && e.target.closest('#panel, #modal, #menu')) || ui.blocking()) return;
  const now = performance.now(); if (now < wheelLock) return;
  wheelAcc += e.deltaY; if (Math.abs(wheelAcc) < 60) return;
  if (ui.state.panelOpen) { ui.closePanel(); } else go(current + (wheelAcc > 0 ? 1 : -1));
  wheelAcc = 0; wheelLock = now + 900;
}, { passive: true });
addEventListener('keydown', (e) => {
  if (ui.blocking() || (e.target.closest && e.target.closest('input, textarea, select'))) return;
  if (['ArrowDown', 'PageDown', 'ArrowLeft'].includes(e.key)) go(current + 1);
  if (['ArrowUp', 'PageUp', 'ArrowRight'].includes(e.key)) go(current - 1);
});
addEventListener('hashchange', () => { const i = STATIONS.findIndex((s) => '#' + s.id === location.hash); if (i >= 0) go(i); });
addEventListener('resize', resize);
function resize() {
  W = innerWidth; H = innerHeight; camera.aspect = W / H; camera.fov = mobile() ? 44 : 38;
  renderer.setSize(W, H, false); post.setSize(W * pr, H * pr); stations.forEach((s) => s.resize && s.resize()); fx && fx.resize(W, H, camera.fov); shadowNow = true;
}

// ── الحلقة ──
let time = 0, lastNow = 0, frameNo = 0, wasBlocked = false;
let paused = false; // للفحص: نوقف الحركة ونحرك الإطارات يدوياً
const draw = () => post.render(scene, camera, fx && fx.active ? fx : null, time);
let rafNo = 0;
function frame(now) { requestAnimationFrame(frame); if (div > 1 && rafNo++ % div) return; step(now); }
function step(now) {
  // وقت الفريم من ساعة الشاشة نفسها (مو من ساعة الكود)، عشان الحركة تمشي بخطوات متساوية
  const raw = lastNow ? (now - lastNow) / 1000 : 1 / 60; lastNow = now;
  if (paused) { draw(); return; }
  if (ui.blocking()) { wasBlocked = true; return; } // القائمة أو نافذة الحجز تغطي المشهد: نوقف الرسم
  if (wasBlocked) { wasBlocked = false; tick(1 / 60); return; }
  govern(raw);
  tick(Math.min(0.05, raw));
}
function tick(dt) {
  time += dt; if (trans) runTrans(dt); const t = time, st = stations[current];
  if (enterT < 9) enterT += dt;
  const sg = stageFor(st); for (const k of ['cx', 'cy', 'w', 'h']) stage[k] = damp(stage[k], sg[k], 4, dt);
  viewTarget(st);
  if (introT < INTRO) {
    introT += dt * introRate; const u = clamp(introT / INTRO, 0, 1), k = u * u * (3 - 2 * u), r = 0.46 + 0.54 * k, drop = (1 - k) * 2.1;
    const lx = tLook.x * k; // في اللقطة القريبة الكاميرا تتوسط العمود نفسه، وترجع لمكانها مع الابتعاد
    camLook.set(lx, tLook.y - drop, tLook.z);
    camPos.set(lx + (tPos.x - tLook.x) * r + (1 - k) * 0.5, tLook.y + (tPos.y - tLook.y) * r - drop - (1 - k) * 0.9, tLook.z + (tPos.z - tLook.z) * r);
    if (u > 0.58) endIntro();
  } else {
  camPos.x = damp(camPos.x, tPos.x, 2.8, dt); camPos.y = damp(camPos.y, tPos.y, 2.8, dt); camPos.z = damp(camPos.z, tPos.z, 2.8, dt); camLook.x = damp(camLook.x, tLook.x, 3.4, dt); camLook.y = damp(camLook.y, tLook.y, 3.4, dt); camLook.z = damp(camLook.z, tLook.z, 3.4, dt);
  }
  const camD = camPos.distanceTo(camLook); scene.fog.density = Math.min(0.02, 0.2 / Math.max(camD, 1)); // الضباب يتبع بعد الكاميرا: المجسم اللي نشوفه يبقى واضح حتى لو الكاميرا بعيدة (الجوال)
  const par = coarse ? 0 : camD * 0.022;
  camera.position.set(camPos.x + pointer.x * par, camPos.y + pointer.y * par * 0.6, camPos.z); camera.lookAt(camLook);
  camera.setViewOffset(W, H, (0.5 - stage.cx) * W, (0.5 - stage.cy) * H, W, H);
  if (fx && fx.active) fx.camera.setViewOffset(W, H, (0.5 - stage.cx) * W, (0.5 - stage.cy) * H, W, H); // الفقرة في نص المسرح، مو نص الشاشة
  bg.position.copy(camera.position); bg.material.uniforms.time.value = t;
  placeLights(st);
  camera.updateMatrixWorld();
  if (pickDirty && !down && !switching && !ui.blocking()) { const now = performance.now(); if (now - pickAt > 45) { pickAt = now; pickDirty = false; setHover(pick(pointer.px, pointer.py)); } }
  st.update(dt, t, true);
  ui.update();
  fx && fx.update(dt);
  // الظل يتحدّث فريم ويرتاح فريم: الفرق ما ينشاف، والحمل ينزل للنص. والقسم الثقيل يحدّث ظله بس لما يتحرك
  if (!coarse && (shadowNow || (st.shadowDirty ? st.shadowDirty() : frameNo % shadowEvery === 0))) { renderer.shadowMap.needsUpdate = true; shadowNow = false; }
  frameNo++;
  draw();
}

// ── البداية ──
async function start() {
  ui.init({ go, next: () => go(current + 1), prev: () => go(current - 1), current: 0 });
  const bar = (v) => { loadbar.style.width = `${Math.round(v * 100)}%`; }, prog = (a, b) => (p) => bar(a + (b - a) * p);
  // المجسمات الثلاثة تتحمل مع بعض قبل ما يبدأ أي شيء، عشان ما في شيء يتجهز والحركة شغالة
  const pS = loadGLB('assets/models/skeleton.glb', prog(0.05, 0.45));
  const pM = loadGLB('assets/models/muscles.glb').catch((e) => { console.warn('muscles', e); return null; });
  const pK = loadGLB('assets/models/skin.glb').catch((e) => { console.warn('skin', e); return null; });
  ctx.assets.skeleton = await pS; bar(0.5); ctx.assets.muscles = await pM; bar(0.62); ctx.assets.skin = await pK; bar(0.68);
  try { ctx.assets.skeleton.updateMatrixWorld(true); fx = createFx({ scene, skeleton: ctx.assets.skeleton, textEl: document.getElementById('fxText') }); } catch (e) { console.warn('fx', e); fx = null; }
  await document.fonts.ready.catch(() => {});
  const makers = [createHero, createAbout, createBody, createTools, createTeam, createPodcast, createLibrary, createPartners, createContact];
  stations = makers.map((mk, i) => { const s = mk(ctx); s.home = i * SP; s.group.position.x = s.home; s.group.visible = false; scene.add(s.group); bar(0.7 + (i + 1) * 0.03); return s; });
  // كل مجسم معتم يرمي ظل ويستقبله
  scene.traverse((o) => { if (o.userData.noShadow) return; if (o.isMesh && !o.isInstancedMesh && o.material && !Array.isArray(o.material) && !o.material.transparent && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } else if (o.isMesh && (Array.isArray(o.material) || o.isInstancedMesh)) { o.castShadow = true; o.receiveShadow = true; } });
  const h = STATIONS.findIndex((s) => '#' + s.id === location.hash); current = h > 0 ? h : 0;
  const r0 = lowPct(probe); probing = false; if (r0) refresh = clamp(r0, 1 / 165, 1 / 50);
  resize(); camera.updateProjectionMatrix();
  // نجهّز كل الخامات والصور وقت التحميل، ونرسم كل قسم مرة وحدة مخفية عشان مجسماته تنرفع لكرت الشاشة الآن مو وقت التنقل
  stations.forEach((s) => { s.group.visible = true; s.prepare && s.prepare(); });
  camera.position.copy(camPos); camera.lookAt(camLook); camera.updateMatrixWorld();
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn(e); }
  const warm = new THREE.WebGLRenderTarget(64, 64);
  for (const s of stations) {
    stations.forEach((o) => { o.group.visible = o === s; }); Object.assign(stage, stageFor(s)); viewTarget(s);
    camera.position.copy(tPos); camera.lookAt(tLook); camera.updateMatrixWorld(); placeLights(s); renderer.shadowMap.needsUpdate = true;
    try { renderer.setRenderTarget(warm); renderer.render(scene, camera); } catch (e) { console.warn(e); }
  }
  stations.forEach((s) => { s.group.visible = false; });
  if (fx) { fx.resize(W, H, camera.fov); fx.showAll(true); try { await renderer.compileAsync(fx.scene, fx.camera); renderer.setRenderTarget(warm); renderer.render(fx.scene, fx.camera); } catch (e) { console.warn(e); } fx.showAll(false); }
  renderer.setRenderTarget(null); warm.dispose(); bar(0.97);
  const st = stations[current]; const sg = stageFor(st); Object.assign(stage, sg); viewTarget(st); camPos.copy(tPos).add(new THREE.Vector3(0, 1, 6)); camLook.copy(tLook);
  camera.position.copy(camPos); camera.lookAt(camLook); camera.updateMatrixWorld(); placeLights(st);
  started = true; activate();
  // نقيس كم ياخذ الفريم على هذا الجهاز ونختار دقة البداية على أساسه، بدل ما نبدأ ثقيل ونخفف قدام المستخدم
  try {
    // بدون قياس مباشر (آيفون مثلاً) نبدأ قريب من دقة الشاشة وننزل لو علّقت، بدل ما نبقى على دقة واطية للأبد
    const base = post.hasTimer ? Math.min(CPR, 1) : coarse ? CPR * 0.85 : Math.min(CPR, 1); setPR(base, true);
    if (post.hasTimer) {
      const got = []; const keep = post.onSample; post.onSample = (ms) => got.push(ms);
      for (let i = 0; i < 9; i++) { renderer.shadowMap.needsUpdate = !coarse; draw(); await new Promise((r) => setTimeout(r, 16)); }
      post.poll(); post.onSample = keep; got.splice(0, 2); got.sort((a, b) => a - b);
      if (got.length >= 3) {
        const ms = got[Math.floor(got.length / 2)], want = base * Math.sqrt(Math.max(0.15, (refresh * 1000 * budgetK * 0.92 / ms - 0.2) / 0.8)); setPR(clamp(want, PR_MIN, CPR), true);
        window.__erthBench = { ms: +ms.toFixed(1), pr: +pr.toFixed(2), hz: Math.round(1 / refresh) };
      }
    }
  } catch (e) { console.warn(e); }
  bar(1);
  window.__erth = { tick: (n = 60, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); }, go, jump, ctx, pick, stations, pause: (v = true) => { paused = v; }, setPR, step, dbg: { post, key, scene, renderer }, get stats() { return { pr: +pr.toFixed(2), hz: Math.round(1 / refresh), gpuMs: +gpuAvg.toFixed(1), tier, div, budgetK: +budgetK.toFixed(2) }; }, get fx() { return fx; }, get current() { return current; } }; // للفحص والتجربة
  requestAnimationFrame(frame);
  // الافتتاحية: تختفي شاشة التحميل، والقسم يبدأ حركته من أولها (المجسمات تدخل من تحت)
  setTimeout(() => { document.getElementById('loader').classList.add('done'); const s0 = stations[current]; s0.enter && s0.enter(); enterT = 0; if (s0.ownIntro && document.body.classList.contains('intro')) introT = 0; else endIntro(); if (!s0.ownIntro) { trans = { to: current, t: 0, phase: 1, mv: MOVES[3], dir: 1 }; switching = true; ui.fxIn(true); } }, 350);
}
start().catch((e) => { console.error(e); document.getElementById('loadtxt').textContent = 'تعذّر تحميل الجولة. حدّث الصفحة وحاول مرة ثانية.'; });
