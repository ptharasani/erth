// شركاؤنا: جدار شعارات مرتب. كل شعار على بلاطة بيضاء واضحة فوق لوح زجاجي، يقترب عند التأشير ويظهر اسمه.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, damp, clamp, easeOut, softFloor } from './lib.js';
import { PARTNERS } from './content.js';

const TW = 2.2, TH = 1.0, GAP = 0.26, TEX_W = 660, TEX_H = 300;

// الشعار ينرسم في نص بلاطة بيضاء (نسيج واحد)، فما يبان له إطار أو حد حول الصورة
function tileTexture(url, onReady) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, TEX_W, TEX_H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const img = new Image();
  img.onload = () => { const s = Math.min((TEX_W * 0.74) / img.width, (TEX_H * 0.56) / img.height), w = img.width * s, h = img.height * s; g.imageSmoothingQuality = 'high'; g.drawImage(img, (TEX_W - w) / 2, (TEX_H - h) / 2, w, h); t.needsUpdate = true; onReady && onReady(t); };
  img.src = url; return t;
}

export default function createPartners(ctx) {
  const { ui } = ctx;
  const group = new THREE.Group(), wall = new THREE.Group(), pickables = [], items = []; group.add(wall);
  // اللوح الخلفي: زجاج فاتح بلون بنفسجي خفيف، البلاطات ترمي عليه ظل ناعم
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xdfe3f6, roughness: 0.5, metalness: 0, envMapIntensity: 0.6 });
  let slab = null;
  const tileGeo = new RoundedBoxGeometry(TW, TH, 0.09, 4, 0.045), sideMat = new THREE.MeshStandardMaterial({ color: 0xf4f5fb, roughness: 0.4, metalness: 0 });
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(TW + 0.08, TH + 0.08));
  PARTNERS.forEach(([file, name], i) => {
    const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.16 });
    const tile = new THREE.Mesh(tileGeo, [sideMat, sideMat, sideMat, sideMat, front, sideMat]);
    const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0, toneMapped: false })); frame.position.z = 0.05; tile.add(frame);
    const it = { file, name, i, tile, front, frame, base: new THREE.Vector3(), k: 0, col: 0, row: 0 }; tile.userData.pick = it; pickables.push(tile); wall.add(tile); items.push(it);
  });
  const floor = softFloor(4.4); group.add(floor);

  let hover = null, loaded = false, inT = 9, yaw = 0, yawT = 0, tx = 0, ty = 0, cy = 3;
  function layout() {
    const m = ctx.mobile(), cols = m ? 2 : 3, rows = Math.ceil(items.length / cols);
    const w = cols * TW + (cols - 1) * GAP, h = rows * TH + (rows - 1) * GAP, pad = 0.42; cy = h / 2 + pad + 0.3;
    const lastN = items.length - (rows - 1) * cols; // الصف الأخير لو ناقص يتوسّط اللوح
    items.forEach((it) => { it.col = it.i % cols; it.row = Math.floor(it.i / cols); const n = it.row === rows - 1 ? lastN : cols; it.base.set((n - 1) / 2 * (TW + GAP) - it.col * (TW + GAP), h / 2 - TH / 2 - it.row * (TH + GAP), 0.13); }); // من اليمين لليسار
    if (slab) { wall.remove(slab); slab.geometry.dispose(); }
    slab = new THREE.Mesh(new RoundedBoxGeometry(w + pad * 2, h + pad * 2, 0.1, 4, 0.05), slabMat); slab.castShadow = slab.receiveShadow = true; wall.add(slab);
    wall.position.y = cy; floor.position.set(0, 0, 0.4); floor.scale.setScalar(m ? 0.8 : 1.15);
    st.view = m ? { look: [0, cy, 0], dir: [0, 0.03, 1], fitW: w + 1.3, fitH: h + 1.5 } : { look: [0, cy - 0.05, 0], dir: [0.1, 0.04, 1], fitW: w + 1.9, fitH: h + 1.6 };
  }
  const st = {
    id: 'partners', group, pickables, view: null, resize: layout,
    prepare() { if (loaded) return; loaded = true; items.forEach((it) => { const t = tileTexture(`assets/img/partners/${it.file}.webp`, (x) => { ctx.renderer.initTexture(x); }); it.front.map = it.front.emissiveMap = t; it.front.needsUpdate = true; }); },
    enter() { inT = 0; },
    leave() { hover = null; },
    update(dt, t) {
      inT += dt; yawT = damp(yawT, 0, 2.2, dt); yaw = damp(yaw, yawT, 6, dt);
      tx = damp(tx, ctx.pointer.inside ? ctx.pointer.x : 0, 3, dt); ty = damp(ty, ctx.pointer.inside ? ctx.pointer.y : 0, 3, dt);
      wall.rotation.y = yaw + tx * 0.1; wall.rotation.x = -ty * 0.05;
      for (const it of items) {
        it.k = damp(it.k, it === hover ? 1 : 0, 9, dt);
        const e = easeOut(clamp((inT - 0.12 - (it.row * 0.07 + it.col * 0.05)) / 0.6, 0, 1)); // تدخل البلاطات صف ورا صف
        it.tile.position.set(it.base.x, it.base.y, it.base.z + (1 - e) * 1.4 + Math.sin(t * 0.9 + it.col * 0.9 + it.row * 0.7) * 0.025 + it.k * 0.42);
        it.tile.scale.setScalar(Math.max(0.001, (0.7 + 0.3 * e) * (1 + it.k * 0.07))); it.tile.rotation.y = (1 - e) * 0.5;
        it.frame.material.opacity = it.k * 0.95; it.front.emissiveIntensity = 0.16 + it.k * 0.1;
      }
    },
    hover(it) { hover = it; if (it) ui.showTip(it.name, 'من شركاء مركز إرث', ctx.pointer.px, ctx.pointer.py); else ui.hideTip(); },
    click(it) { hover = it; ui.showTip(it.name, 'من شركاء مركز إرث', ctx.pointer.px, ctx.pointer.py); },
    drag(dx) { yawT = clamp(yawT + dx * 0.003, -0.5, 0.5); },
  };
  layout();
  return st;
}
