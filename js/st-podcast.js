// بودكاست إرث: حلقة كبيرة في النص (صورتها وعنوانها وضيفها واضحين) وجنبها الحلقتين المجاورتين، والتنقل بالأسهم أو السحب.
// الضغط على الحلقة يشغّلها داخل الموقع. المايك مجسم القسم، والضغط عليه يفتح القناة.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, damp, metal, glow, hdr, markPick, podium, Spinner, softFloor, crispLayer } from './lib.js';
import { PODCAST, CONTACT } from './content.js';

const SW = 2.4, SH = 1.95, TWO = Math.PI * 2; // الكرت: صورة 16:9 فوق، وتحتها العنوان والضيف
const wrap = (x) => ((x + Math.PI) % TWO + TWO) % TWO - Math.PI, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// وجه احتياطي داخل المشهد: يبان بس لحظة الانتقال بين الأقسام، والوجه الواضح هو عنصر HTML فوقه
function face(ep) {
  const c = document.createElement('canvas'); c.width = 720; c.height = 585; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = (img) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 720, 585); if (img) g.drawImage(img, 0, 0, 720, 405); else { g.fillStyle = '#191c40'; g.fillRect(0, 0, 720, 405); }
    g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = '#171b45'; g.font = '800 40px Alexandria, sans-serif'; g.fillText(ep.title, 688, 470, 656);
    g.fillStyle = '#13807a'; g.font = '700 27px Alexandria, sans-serif'; g.fillText(ep.guest, 688, 534, 656); tex.needsUpdate = true;
  };
  draw(null); const im = new Image(); im.onload = () => draw(im); im.src = `assets/img/podcast/${ep.file}.webp`; return tex;
}

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
  const { ui } = ctx, crisp = crispLayer(ctx, 'pod');
  const group = new THREE.Group(), ring = new THREE.Group(), pickables = [], items = []; group.add(ring);
  const N = PODCAST.length, spin = new Spinner(TWO / N), R = 4.4;
  const mic = microphone(); group.add(mic); const micPick = { mic: true }; markPick(mic, micPick, pickables);
  const micPod = podium(1.1, C.teal); group.add(micPod);
  const geo = new RoundedBoxGeometry(SW, SH, 0.07, 3, 0.035), side = new THREE.MeshStandardMaterial({ color: 0xf2f3fa, roughness: 0.45, metalness: 0 });
  const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(SW + 0.1, SH + 0.1));
  PODCAST.forEach((ep, i) => {
    const front = new THREE.MeshBasicMaterial({ color: 0xffffff }), card = new THREE.Mesh(geo, [side, side, side, side, front, side]), slot = new THREE.Group(), a = (i / N) * TWO;
    slot.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); slot.rotation.y = a; slot.add(card); ring.add(slot);
    const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0, toneMapped: false })); frame.position.z = 0.04; card.add(frame);
    const it = { ep, i, a, slot, card, front, frame, k: 0 }; card.userData.pick = it; pickables.push(card); items.push(it);
    it.o = crisp.add(ui.el('div', 'pcard', `<div class="pc-img"><img src="assets/img/podcast/${ep.file}.webp" alt="" draggable="false" decoding="async"><i class="xc-play"></i></div><div class="pc-txt"><b>${ep.title}</b><small>${ep.guest}</small></div>`), 480, 390);
  });
  const floor = softFloor(4.2); group.add(floor);

  let hover = null, loaded = false, mk = 0, shown = null, cardY = 2.2;
  // الأسهم، وبينها عنوان الحلقة اللي في النص وضيفها
  const nav = ui.el('div', 'seg glass'), bPrev = ui.el('button', '', '› السابق'), bNext = ui.el('button', '', 'التالي ‹'), who = ui.el('button', 'who', '<b></b><small></small>');
  bPrev.onclick = () => spin.stepBy(1); bNext.onclick = () => spin.stepBy(-1); who.onclick = () => { if (shown) play(shown); }; nav.append(bPrev, who, bNext);
  function play(it) { ui.openVideo(it.ep.yt, it.ep.title, it.ep.guest); }
  function layout() {
    const m = ctx.mobile(); floor.position.set(0, 0, R); floor.scale.setScalar(m ? 0.7 : 1.1);
    // الكروت مرفوعة والمايك تحتها، عشان ما يغطي أحد منهم الثاني
    if (m) { cardY = 2.3; mic.position.set(0, 0, R + 0.5); mic.scale.setScalar(0.4); mic.rotation.y = -0.4; micPod.position.set(0, 0, R + 0.5); micPod.scale.setScalar(0.4); st.view = { look: [0, 1.78, R + 0.3], dir: [0, 0.04, 1], fitW: 2.85, fitH: 3.55 }; }
    else { cardY = 2.2; mic.position.set(-2.0, 0, R + 0.4); mic.scale.setScalar(0.5); mic.rotation.y = Math.PI * 0.85; micPod.position.set(-2.0, 0, R + 0.4); micPod.scale.setScalar(0.42); st.view = { look: [0, 1.82, R + 0.3], dir: [0, 0.04, 1], fitW: 6.6, fitH: 3.8 }; }
  }
  const st = {
    id: 'podcast', group, pickables, view: null, tools: nav, resize: layout,
    prepare() { if (loaded) return; loaded = true; items.forEach((it) => { it.front.map = face(it.ep); it.front.needsUpdate = true; ctx.renderer.initTexture(it.front.map); }); },
    enter() { ui.warmVideo(); const base = Math.round(spin.angle / spin.step) * spin.step; spin.angle = base + spin.step * 1.5; spin.vel = 0; spin.target = base; }, // الكروت تنزلق لمكانها عند الدخول
    leave() { hover = null; spin.target = null; crisp.hide(); },
    update(dt, t) {
      spin.update(dt, !!hover); ring.rotation.y = spin.angle; crisp.show(); let near = null, nd = 9;
      for (const it of items) {
        it.k = damp(it.k, it === hover ? 1 : 0, 8, dt);
        const d = Math.abs(wrap(it.a + spin.angle)) / spin.step, vis = 1 - sstep(1.3, 1.85, d), front = Math.max(0, 1 - d); if (d < nd) { nd = d; near = it; }
        it.slot.visible = vis > 0.01; it.card.scale.setScalar(Math.max(0.001, (0.8 + front * 0.3 + it.k * 0.03) * vis)); it.card.position.set(0, cardY + Math.sin(t * 0.8 + it.i * 1.3) * 0.02, front * 0.7);
        it.frame.material.opacity = front * 0.5 + it.k * 0.45; it.front.color.setScalar(0.8 + front * 0.2);
        if (vis > 0.01) crisp.place(it.o, it.card, SW / 2, SH / 2, 0.036, 0.8 + front * 0.2); else crisp.off(it.o);
      }
      if (near !== shown) { shown = near; who.firstChild.textContent = near.ep.title; who.lastChild.textContent = `${near.ep.guest} · اضغط للتشغيل`; }
      mk = damp(mk, hover === micPick ? 1 : 0, 6, dt); const { head, waves } = mic.userData; head.rotation.z = 0.35 + Math.sin(t * 0.7) * 0.03;
      waves.children.forEach((w, i) => { const f = (t * 0.45 + i / 4) % 1; w.scale.setScalar(1 + f * 2.4); w.rotation.x = Math.PI / 2; w.position.y = f * 0.25; w.material.opacity = (1 - f) * (0.35 + mk * 0.5); });
    },
    hover(it) { hover = it; if (!it) return ui.hideTip(); it.mic ? ui.showTip('#بودكاست_إرث', 'اضغط لفتح القناة على يوتيوب', ctx.pointer.px, ctx.pointer.py) : ui.showTip(it.ep.title, `${it.ep.guest} · اضغط للتشغيل`, ctx.pointer.px, ctx.pointer.py); },
    click(it) { if (it.mic) return ui.openLink(CONTACT.youtube); if (Math.abs(wrap(it.a + spin.angle)) < spin.step * 0.5) play(it); else spin.to(-it.a); }, // الحلقة الجانبية تجي للنص أول، واللي في النص تشتغل
    drag(dx) { spin.drag(dx); },
    titleExtra(acts) { const a = ui.el('a', 'btn primary', 'تابعونا على يوتيوب'); a.href = CONTACT.youtube; a.target = '_blank'; a.rel = 'noopener'; acts.append(a); },
  };
  layout();
  return st;
}
