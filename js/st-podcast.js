// بودكاست إرث: مايك استوديو ثلاثي الأبعاد وشاشات الحلقات، والضغط يفتح الحلقة على يوتيوب.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, damp, metal, plastic, glow, hdr, loadTexture, markPick, podium } from './lib.js';
import { PODCAST, CONTACT } from './content.js';

function microphone() {
  const g = new THREE.Group(), dark = metal(0x1a1c2c, 0.35), gold = metal(0xd9b36a, 0.25);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 48), dark, 0, 0.04, 0);
  add(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 16), dark, 0, 0.8, 0);
  const arm = add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 16), dark, 0.36, 1.78, 0); arm.rotation.z = -0.9;
  add(new THREE.SphereGeometry(0.06, 16, 12), gold, 0, 1.55, 0);
  const head = new THREE.Group(); head.position.set(0.86, 2.1, 0); head.rotation.z = 0.35; g.add(head);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 36), dark); body.position.y = -0.2; head.add(body);
  const grille = new THREE.Mesh(new THREE.CapsuleGeometry(0.215, 0.3, 10, 36), new THREE.MeshStandardMaterial({ color: 0x3a3d52, metalness: 1, roughness: 0.42 })); grille.position.y = 0.34; head.add(grille);
  const wire = new THREE.Mesh(new THREE.CapsuleGeometry(0.219, 0.3, 6, 22), new THREE.MeshBasicMaterial({ color: 0x0c0d18, wireframe: true })); wire.position.y = 0.34; head.add(wire);
  [0.12, -0.5].forEach((y) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.022, 10, 48), gold); r.rotation.x = Math.PI / 2; r.position.y = y; head.add(r); });
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.012, 8, 48), glow(C.teal, 3)); led.rotation.x = Math.PI / 2; led.position.y = -0.28; head.add(led);
  const mount = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 48), dark); mount.rotation.x = Math.PI / 2; mount.position.y = -0.2; head.add(mount);
  const waves = new THREE.Group(); waves.position.y = 0.4; head.add(waves);
  for (let i = 0; i < 4; i++) waves.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.008, 6, 64), new THREE.MeshBasicMaterial({ color: hdr(C.teal2, 2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false })));
  g.userData = { head, waves };
  return g;
}

export default function createPodcast(ctx) {
  const { ui } = ctx;
  const group = new THREE.Group(), pickables = [], items = [];
  const mic = microphone(); group.add(mic); const micPick = { mic: true }; markPick(mic, micPick, pickables);
  const micPod = podium(1.1, C.teal); group.add(micPod);
  const SW = 2.4, SH = 1.35, geo = new RoundedBoxGeometry(SW, SH, 0.07, 3, 0.03), side = new THREE.MeshStandardMaterial({ color: 0x10122c, metalness: 0.85, roughness: 0.3 });
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(SW + 0.1, SH + 0.1));
  PODCAST.forEach((ep, i) => {
    const front = new THREE.MeshBasicMaterial({ color: 0x191c40 }), scr = new THREE.Mesh(geo, [side, side, side, side, front, side]);
    const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: hdr(C.teal, 1.6), transparent: true, opacity: 0.3, toneMapped: false })); frame.position.z = 0.04; scr.add(frame);
    const it = { ep, i, scr, front, frame, base: new THREE.Vector3(), ry: 0, k: 0 }; scr.userData.pick = it; pickables.push(scr); group.add(scr); items.push(it);
  });
  let hover = null, loaded = false, mk = 0;
  function layout() {
    const m = ctx.mobile(), cols = m ? 2 : 3, rows = m ? 4 : 3, RAD = 9, stepA = (SW + 0.3) / RAD;
    // على الشاشات الكبيرة: شبكة 3×3 والمايك في النص. على الجوال: عمودين والمايك تحت
    items.forEach((it, i) => { const cell = m ? i : i < 4 ? i : i + 1, c = cell % cols, r = Math.floor(cell / cols), th = (c - (cols - 1) / 2) * stepA; it.base.set(Math.sin(th) * RAD, (m ? 2.75 : 0.95) + (rows - 1 - r) * (SH + 0.28), RAD - Math.cos(th) * RAD); it.ry = -th; });
    if (m) { mic.position.set(0, 0, 1.2); mic.scale.setScalar(0.78); mic.rotation.y = -0.4; micPod.position.set(0, 0, 1.2); micPod.scale.setScalar(0.8); st.view = { look: [0, 4.3, 0.6], dir: [0, 0.05, 1], fitW: 5.4, fitH: 8.9 }; }
    else { mic.position.set(-0.35, 1.6, 0.7); mic.scale.setScalar(0.72); mic.rotation.y = 0.35; micPod.position.set(0, 1.58, 0.7); micPod.scale.setScalar(0.6); st.view = { look: [0, 2.55, 0.3], dir: [0, 0.04, 1], fitW: 8.6, fitH: 5.2 }; }
  }
  const st = {
    id: 'podcast', group, pickables, view: null, resize: layout,
    prepare() { if (loaded) return; loaded = true; items.forEach((it) => { const tx = loadTexture(`assets/img/podcast/${it.ep.file}.webp`, () => { it.front.map = tx; it.front.color.set(0xd8d8d8); it.front.needsUpdate = true; }); }); },
    leave() { hover = null; },
    update(dt, t) {
      for (const it of items) {
        it.k = damp(it.k, it === hover ? 1 : 0, 8, dt);
        it.scr.position.set(it.base.x, it.base.y + Math.sin(t * 0.8 + it.i * 1.3) * 0.035, it.base.z + it.k * 0.55); it.scr.rotation.y = it.ry * (1 - it.k * 0.6); it.scr.scale.setScalar(1 + it.k * 0.12);
        it.frame.material.opacity = 0.3 + it.k * 0.7;
      }
      mk = damp(mk, hover === micPick ? 1 : 0, 6, dt); const { head, waves } = mic.userData; head.rotation.z = 0.35 + Math.sin(t * 0.7) * 0.03;
      waves.children.forEach((w, i) => { const f = (t * 0.45 + i / 4) % 1; w.scale.setScalar(1 + f * 2.4); w.rotation.x = Math.PI / 2; w.position.y = f * 0.25; w.material.opacity = (1 - f) * (0.35 + mk * 0.5); });
    },
    hover(it) { hover = it; if (!it) return ui.hideTip(); it.mic ? ui.showTip('#بودكاست_إرث', 'اضغط لفتح القناة على يوتيوب', ctx.pointer.px, ctx.pointer.py) : ui.showTip(it.ep.title, `${it.ep.guest} · اضغط للمشاهدة`, ctx.pointer.px, ctx.pointer.py); },
    click(it) { ui.openLink(it.mic ? CONTACT.youtube : `https://www.youtube.com/watch?v=${it.ep.yt}`); },
    titleExtra(acts) { const a = ui.el('a', 'btn primary', 'تابعونا على يوتيوب'); a.href = CONTACT.youtube; a.target = '_blank'; a.rel = 'noopener'; acts.append(a); },
  };
  layout();
  return st;
}
