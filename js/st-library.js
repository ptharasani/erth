// مكتبة التمارين: كروت التمارين واقفة على رفّين زجاجيين (مكتبة فعلاً). الضغط يفتح التمرين على يوتيوب،
// والتمارين اللي عليها علامة التشغيل تشتغل داخل الموقع مباشرة. على الجوال: كرت كبير في النص والتنقل بالأسهم.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, damp, clamp, easeOut, Spinner, softFloor, crispLayer } from './lib.js';
import { EXERCISES, LIBRARY } from './content.js';

const CW = 1.5, CH = 1.875, TEX_W = 600, TEX_H = 750, IMG_H = 430, PER = 5, GAPX = 0.22; // PER: عدد الكروت في كل رف
const TWO = Math.PI * 2, wrap = (x) => ((x + Math.PI) % TWO + TWO) % TWO - Math.PI, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// غلاف التمرين: مساحة الصورة فوق (تدرج بألوان إرث ورقم التمرين لين تجهز الصورة)، والاسم والمنطقة تحت
function cover(ex, i) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H; const g = c.getContext('2d');
  const F = (w, s) => `${w} ${s}px Alexandria, sans-serif`;
  function draw(img) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, TEX_W, TEX_H);
    if (img) { const s = Math.max(TEX_W / img.width, IMG_H / img.height), w = img.width * s, h = img.height * s; g.save(); g.beginPath(); g.rect(0, 0, TEX_W, IMG_H); g.clip(); g.drawImage(img, (TEX_W - w) / 2, (IMG_H - h) / 2, w, h); g.restore(); }
    else {
      const gr = g.createLinearGradient(0, 0, TEX_W, IMG_H); gr.addColorStop(0, i % 2 ? '#5a64b8' : '#4953A1'); gr.addColorStop(1, i % 2 ? '#40B6B2' : '#3aa7a4'); g.fillStyle = gr; g.fillRect(0, 0, TEX_W, IMG_H);
      const rg = g.createRadialGradient(TEX_W * 0.75, IMG_H * 0.2, 0, TEX_W * 0.75, IMG_H * 0.2, 380); rg.addColorStop(0, 'rgba(255,255,255,.3)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, TEX_W, IMG_H);
      g.direction = 'ltr'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = F(900, 210); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.55)'; g.strokeText(String(i + 1).padStart(2, '0'), 34, IMG_H - 44);
    }
    // شريط المنطقة
    g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.font = F(700, 27);
    const tw = g.measureText(ex.area).width + 44; g.fillStyle = 'rgba(255,255,255,.94)'; g.beginPath(); g.roundRect(TEX_W - 28 - tw, 26, tw, 54, 27); g.fill(); g.fillStyle = '#13807a'; g.fillText(ex.area, TEX_W - 50, 54);
    // علامة التشغيل للتمارين اللي تشتغل داخل الموقع
    if (ex.inline) { g.fillStyle = '#40B6B2'; g.beginPath(); g.arc(78, IMG_H, 46, 0, TWO); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, IMG_H - 22); g.lineTo(100, IMG_H); g.lineTo(64, IMG_H + 22); g.closePath(); g.fill(); }
    // الاسم (سطرين كحد أقصى) ثم الاسم الإنجليزي
    g.fillStyle = '#171b45'; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; let size = 50; const maxW = TEX_W - 68, words = ex.name.split(' '); let lines;
    for (;;) { g.font = F(800, size); lines = ['']; for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (g.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); } if (lines.length <= 2 || size <= 36) break; size -= 4; }
    const lh = size * 1.42, y0 = IMG_H + 78 + (lines.length === 1 ? lh * 0.42 : 0); lines.slice(0, 2).forEach((l, k) => g.fillText(l, TEX_W - 34, y0 + k * lh));
    g.direction = 'ltr'; g.textAlign = 'left'; g.font = F(500, 25); g.fillStyle = '#555b88'; let en = ex.en; while (g.measureText(en).width > maxW && en.length > 8) en = en.slice(0, -2); g.fillText(en === ex.en ? en : en + '…', 34, TEX_H - 86);
    g.direction = 'rtl'; g.textAlign = 'right'; g.font = F(700, 25); g.fillStyle = ex.inline ? '#13807a' : '#4953A1'; g.fillText(ex.inline ? 'يشتغل هنا مباشرة' : 'شاهده على يوتيوب', TEX_W - 34, TEX_H - 36);
    g.fillStyle = 'rgba(73,83,161,.16)'; g.fillRect(34, TEX_H - 72, TEX_W - 68, 2);
    tex.needsUpdate = true;
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; draw(null);
  if (ex.img) { const im = new Image(); im.onload = () => draw(im); im.src = `assets/img/exercises/${ex.id}.webp`; }
  return tex;
}

export default function createLibrary(ctx) {
  const { ui } = ctx, crisp = crispLayer(ctx, 'lib'); // وجه كل كرت ينرسم كعنصر HTML فوق الكرت: الصورة والكلام بدقة الشاشة الكاملة
  const group = new THREE.Group(), ring = new THREE.Group(), shelves = new THREE.Group(), pickables = [], items = []; group.add(ring, shelves);
  const N = EXERCISES.length, spin = new Spinner(TWO / N), R = 3.6;
  const geo = new RoundedBoxGeometry(CW, CH, 0.06, 4, 0.03), side = new THREE.MeshStandardMaterial({ color: 0xf2f3fa, roughness: 0.45, metalness: 0 });
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(CW + 0.08, CH + 0.08));
  EXERCISES.forEach((ex, i) => {
    const front = new THREE.MeshBasicMaterial({ color: 0xffffff }), card = new THREE.Mesh(geo, [side, side, side, side, front, side]), slot = new THREE.Group(); slot.add(card); ring.add(slot);
    const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0, toneMapped: false })); frame.position.z = 0.035; card.add(frame);
    const it = { ex, i, slot, card, front, frame, k: 0, a: (i / N) * TWO, col: 0, row: 0, base: new THREE.Vector3() }; card.userData.pick = it; pickables.push(card); items.push(it);
    it.o = crisp.add(ui.el('div', 'xcard', `<div class="xc-img">${ex.img ? `<img src="assets/img/exercises/${ex.id}.webp" alt="" draggable="false" decoding="async">` : ''}<span class="xc-area">${ex.area}</span></div><i class="xc-play"></i><div class="xc-txt"><b>${ex.name}</b><small dir="ltr">${ex.en}</small><em>اضغط للتشغيل هنا</em></div>`), 320, 400);
  });
  // الرفّين
  const plankMat = new THREE.MeshStandardMaterial({ color: 0xe3e6f6, roughness: 0.35, metalness: 0, envMapIntensity: 0.8 }), lipMat = new THREE.MeshBasicMaterial({ color: C.teal, toneMapped: false });
  const ROW_Y = [2.72, 0.42], ROW_W = PER * CW + (PER - 1) * GAPX + 0.6;
  ROW_Y.forEach((y) => { const p = new THREE.Mesh(new RoundedBoxGeometry(ROW_W, 0.07, 0.8, 3, 0.03), plankMat); p.position.set(0, y - 0.035, 0.12); p.castShadow = p.receiveShadow = true; const lip = new THREE.Mesh(new THREE.BoxGeometry(ROW_W - 0.1, 0.012, 0.012), lipMat); lip.position.set(0, y - 0.035, 0.525); shelves.add(p, lip); });
  const floor = softFloor(4.6); group.add(floor);

  let hover = null, loaded = false, inT = 9, carousel = false, shown = null;
  const nav = ui.el('div', 'seg glass'), bPrev = ui.el('button', '', '› السابق'), bNext = ui.el('button', '', 'التالي ‹'), who = ui.el('button', 'who', '<b></b><small></small>');
  bPrev.onclick = () => spin.stepBy(1); bNext.onclick = () => spin.stepBy(-1); who.onclick = () => { if (shown) play(shown); }; nav.append(bPrev, who, bNext);
  function play(it) { const ex = it.ex; ui.openVideo(ex.yt, ex.name, ex.area, LIBRARY.list); } // كل التمارين تشتغل داخل الموقع، ومعها رابط يوتيوب
  function layout() {
    carousel = ctx.mobile(); shelves.visible = !carousel; st.tools = carousel ? nav : null; st.drag = carousel ? (dx) => spin.drag(dx) : null;
    items.forEach((it) => {
      it.col = it.i % PER; it.row = Math.floor(it.i / PER);
      if (carousel) { it.slot.position.set(Math.sin(it.a) * R, 0, Math.cos(it.a) * R); it.slot.rotation.y = it.a; }
      else { it.slot.position.set(0, 0, 0); it.slot.rotation.y = 0; it.base.set(((PER - 1) / 2 - it.col) * (CW + GAPX), ROW_Y[it.row] + CH / 2 + 0.015, 0.1); } // من اليمين لليسار
    });
    ring.rotation.y = 0; floor.position.set(0, 0, carousel ? R : 0.5); floor.scale.setScalar(carousel ? 0.7 : 1.1);
    st.view = carousel ? { look: [0, 1.5, R + 0.3], dir: [0, 0.05, 1], fitW: 2.0, fitH: 2.45 } : { look: [0, 2.42, 0], dir: [0.09, 0.05, 1], fitW: ROW_W + 0.6, fitH: 5.4 };
  }
  const st = {
    id: 'library', group, pickables, view: null, tools: null, drag: null, resize: layout,
    prepare() { if (loaded) return; loaded = true; items.forEach((it) => { it.front.map = cover(it.ex, it.i); it.front.needsUpdate = true; ctx.renderer.initTexture(it.front.map); }); },
    enter() { inT = 0; ui.warmVideo(); if (carousel) { const base = Math.round(spin.angle / spin.step) * spin.step; spin.angle = base + spin.step * 1.5; spin.vel = 0; spin.target = base; } },
    leave() { hover = null; spin.target = null; crisp.hide(); },
    update(dt, t) {
      inT += dt; crisp.show();
      if (carousel) {
        spin.update(dt, !!hover); ring.rotation.y = spin.angle; let near = null, nd = 9;
        for (const it of items) {
          it.k = damp(it.k, it === hover ? 1 : 0, 8, dt);
          const d = Math.abs(wrap(it.a + spin.angle)) / spin.step, vis = 1 - sstep(1.3, 1.85, d), front = Math.max(0, 1 - d); if (d < nd) { nd = d; near = it; }
          it.slot.visible = vis > 0.01; it.card.scale.setScalar(Math.max(0.001, (0.8 + front * 0.3) * vis)); it.card.position.set(0, 1.5, front * 0.6); it.card.rotation.set(0, 0, 0);
          it.frame.material.opacity = front * 0.5; it.front.color.setScalar(0.82 + front * 0.18);
          if (vis > 0.01) crisp.place(it.o, it.card, CW / 2, CH / 2, 0.031, 0.82 + front * 0.18); else crisp.off(it.o);
        }
        if (near !== shown) { shown = near; who.firstChild.textContent = near.ex.name; who.lastChild.textContent = near.ex.inline ? 'اضغط للتشغيل هنا' : 'اضغط لفتحه على يوتيوب'; }
        return;
      }
      for (const it of items) {
        it.k = damp(it.k, it === hover ? 1 : 0, 9, dt); it.slot.visible = true;
        const e = easeOut(clamp((inT - 0.1 - (it.row * 0.16 + it.col * 0.06)) / 0.55, 0, 1)); // الكروت تنزل على الرف واحد ورا واحد
        it.card.position.set(it.base.x, it.base.y + (1 - e) * 1.1 + it.k * 0.12, it.base.z + it.k * 0.4 + Math.sin(t * 0.8 + it.i) * 0.006);
        it.card.rotation.set(-0.07 * (1 - it.k), 0, (1 - e) * (it.col % 2 ? 0.12 : -0.12)); it.card.scale.setScalar(Math.max(0.001, (0.75 + 0.25 * e) * (1 + it.k * 0.06)));
        it.frame.material.opacity = it.k * 0.95; it.front.color.setScalar(1); crisp.place(it.o, it.card, CW / 2, CH / 2, 0.031, 1);
      }
    },
    hover(it) { hover = it; if (it) ui.showTip(it.ex.name, it.ex.inline ? 'اضغط للتشغيل هنا' : 'اضغط لفتحه على يوتيوب', ctx.pointer.px, ctx.pointer.py); else ui.hideTip(); },
    click(it) { play(it); },
    titleExtra(acts) { const a = ui.el('a', 'btn primary', 'تصفح المكتبة كاملة'); a.href = LIBRARY.playlist; a.target = '_blank'; a.rel = 'noopener'; acts.append(a); },
  };
  layout();
  return st;
}
