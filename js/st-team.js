// الأخصائيون: كروت ثلاثية الأبعاد فيها الصورة فقط، على حلقة تدور بالسحب. الضغط يفتح المؤهلات والحجز.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, damp, loadTexture, Spinner, softFloor } from './lib.js';
import { TEAM } from './content.js';

const TWO = Math.PI * 2, wrap = (x) => ((x + Math.PI) % TWO + TWO) % TWO - Math.PI, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// تحويل مستطيل الصورة (HTML) لأربع زوايا الكرت على الشاشة، عشان الصورة تنعرض بدقة الشاشة الكاملة فوق الكرت بالضبط
const adj = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
const mm = (a, b) => { const c = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j]; return c; };
const basis = (p) => { const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1], a = adj(m), x = p[6], y = p[7], v0 = a[0] * x + a[1] * y + a[2], v1 = a[3] * x + a[4] * y + a[5], v2 = a[6] * x + a[7] * y + a[8]; return mm(m, [v0, 0, 0, 0, v1, 0, 0, 0, v2]); };

export default function createTeam(ctx) {
  const { ui } = ctx;
  // المشهد ثلاثي الأبعاد ينرسم بدقة أقل من الشاشة على الأجهزة الضعيفة والجوال، فالوجوه تطلع مغبشة.
  // الحل: نفس الصورة كعنصر HTML فوق كل كرت ظاهر، تتبع زواياه فريم بفريم وتنرسم بدقة الشاشة الكاملة.
  const layer = ui.el('div', 'team-photos'); layer.style.display = 'none'; document.body.append(layer);
  let bw = 360, bh = 450, srcInv = adj(basis([0, 0, bw, 0, 0, bh, bw, bh])), layerOn = false;
  const corner = new THREE.Vector3(), pts = new Array(8), pp = {};
  const setBase = (w) => { bw = w; bh = Math.round(w * 1.25); srcInv = adj(basis([0, 0, bw, 0, 0, bh, bw, bh])); for (const it of items) if (it.img) { it.img.style.width = bw + 'px'; it.img.style.height = bh + 'px'; } };
  function photoOff(it) { if (it.img && it.imgOn) { it.imgOn = false; it.img.style.visibility = 'hidden'; } }
  function photoAt(it, bright) {
    if (!it.img) { const im = new Image(); im.alt = ''; im.draggable = false; im.decoding = 'async'; im.style.cssText = `width:${bw}px;height:${bh}px;visibility:hidden`; im.src = `assets/img/team/${it.t.id}-photo.webp`; layer.append(im); it.img = im; it.imgOn = false; it.bright = -1; }
    if (!it.img.complete || !it.img.naturalWidth) return photoOff(it);
    it.card.updateWorldMatrix(true, false);
    for (let k = 0; k < 4; k++) { corner.set(k & 1 ? CW / 2 : -CW / 2, k & 2 ? -CH / 2 : CH / 2, 0.0352).applyMatrix4(it.card.matrixWorld); ctx.project(corner, pp); if (pp.behind) return photoOff(it); pts[k * 2] = pp.x; pts[k * 2 + 1] = pp.y; }
    const w = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
    if ((pts[2] - pts[0]) * (pts[5] - pts[1]) - (pts[3] - pts[1]) * (pts[4] - pts[0]) < 4 || w < 8) return photoOff(it); // الكرت معطي ظهره أو صغير مرة
    const t = mm(basis(pts), srcInv), q = 1 / t[8];
    it.img.style.transform = `matrix3d(${t[0] * q},${t[3] * q},0,${t[6] * q},${t[1] * q},${t[4] * q},0,${t[7] * q},0,0,1,0,${t[2] * q},${t[5] * q},0,1)`;
    const b = Math.round(bright * 50) / 50; if (b !== it.bright) { it.bright = b; it.img.style.filter = b >= 0.995 ? '' : `brightness(${b})`; }
    if (!it.imgOn) { it.imgOn = true; it.img.style.visibility = 'visible'; }
    return w;
  }
  const group = new THREE.Group(), ring = new THREE.Group(), pickables = [], items = [], spin = new Spinner((Math.PI * 2) / TEAM.length), R = 5.4, CW = 2.1, CH = 2.625;
  group.add(ring);
  const geo = new RoundedBoxGeometry(CW, CH, 0.07, 4, 0.035), side = new THREE.MeshStandardMaterial({ color: 0x3a4290, metalness: 0.2, roughness: 0.45 });
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(CW + 0.1, CH + 0.1));
  TEAM.forEach((t, i) => {
    // الوجه صورة بألوانها الأصلية (ما تتأثر بالإضاءة)، عشان الوجوه تطلع واضحة وثابتة
    const a = (i / TEAM.length) * Math.PI * 2, slot = new THREE.Group(), front = new THREE.MeshBasicMaterial({ color: 0x4953a1 });
    const card = new THREE.Mesh(geo, [side, side, side, side, front, side]); card.position.y = 1.85;
    const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0, toneMapped: false })); frame.position.z = 0.04; card.add(frame);
    slot.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); slot.rotation.y = a; slot.add(card); ring.add(slot);
    const it = { t, a, slot, card, front, frame, k: 0 }; card.userData.pick = it; pickables.push(card); items.push(it);
  });
  const floor = softFloor(4.6); floor.position.set(0, 0, R); group.add(floor);

  let hover = null, sel = null, loaded = false, shown = null; const world = new THREE.Vector3(), scr = {};
  // أسهم التنقل، وبينها اسم الأخصائي اللي في النص (الاسم برا الصورة)
  const nav = ui.el('div', 'seg glass'); const bPrev = ui.el('button', '', '› السابق'), bNext = ui.el('button', '', 'التالي ‹'), who = ui.el('button', 'who', '<b></b><small></small>');
  bPrev.onclick = () => { if (sel) ui.closePanel(); spin.stepBy(1); }; bNext.onclick = () => { if (sel) ui.closePanel(); spin.stepBy(-1); }; who.onclick = () => { if (shown) open(shown); }; nav.append(bPrev, who, bNext);

  function open(it) {
    sel = it; spin.to(-it.a);
    ui.openPanel(ui.personNodes(it.t), { onClose: (rep) => { if (!rep || sel === it) { sel = null; spin.target = null; } }, leader: () => { it.card.getWorldPosition(world); const p = ctx.project(world, scr); return p.behind ? null : p; } });
  }
  const st = {
    id: 'team', group, pickables, view: null, tools: nav,
    prepare() { if (loaded) return; loaded = true; items.forEach((it) => { const tx = loadTexture(`assets/img/team/${it.t.id}-photo.webp`, () => { it.front.map = tx; it.front.color.set(0xffffff); it.front.needsUpdate = true; }); }); },
    resize() { st.view = ctx.mobile() ? { look: [0, 1.85, R + 0.3], dir: [0, 0.05, 1], fitW: 3.3, fitH: 3.5 } : { look: [0, 1.88, R + 0.3], dir: [0, 0.05, 1], fitW: 7.3, fitH: 3.7 }; },
    enter() { const base = Math.round(spin.angle / spin.step) * spin.step; spin.angle = base + spin.step * 1.5; spin.vel = 0; spin.target = base; }, // الكروت تنزلق لمكانها عند الدخول
    leave() { hover = sel = null; spin.target = null; layerOn = false; layer.style.display = 'none'; },
    update(dt) {
      spin.update(dt, !!hover); ring.rotation.y = spin.angle;
      let near = null, nd = 9;
      for (const it of items) {
        const on = it === hover || it === sel; it.k = damp(it.k, on ? 1 : 0, 7, dt);
        const d = Math.abs(wrap(it.a + spin.angle)) / spin.step, vis = 1 - sstep(1.3, 1.85, d), front = Math.max(0, 1 - d);
        if (d < nd) { nd = d; near = it; }
        it.slot.visible = vis > 0.01;
        it.card.scale.setScalar(Math.max(0.001, (0.8 + front * 0.3 + it.k * 0.05) * vis)); it.card.position.z = it.k * 0.3 + front * 0.8; it.card.position.y = 1.85 + it.k * 0.06;
        it.frame.material.opacity = front * 0.55 + it.k * 0.45; if (it.front.map) it.front.color.setScalar(0.8 + front * 0.2);
        if (vis > 0.01) { const w = photoAt(it, 0.8 + front * 0.2); if (w && d < 0.02 && it.k < 0.02 && Math.abs(w - bw) > bw * 0.08) setBase(Math.round(w)); } else photoOff(it);
      }
      if (!layerOn) { layerOn = true; layer.style.display = ''; }
      if (near !== shown) { shown = near; who.firstChild.textContent = near.t.name; who.lastChild.textContent = near.t.role; }
    },
    hover(it) { hover = it; if (it) ui.showTip(it.t.name, it.t.role, ctx.pointer.px, ctx.pointer.py); else ui.hideTip(); },
    click(it) { open(it); },
    drag(dx) { spin.drag(dx); if (sel) ui.closePanel(); },
    titleExtra(acts) { acts.append(ui.button('احجز مع أخصائي', 'primary', () => ui.openBooking())); },
  };
  st.resize();
  return st;
}
