// الأدوات والأجهزة: كلها مجسمات مبنية بالكود على منصة دوّارة.
// التأشير على الأداة يقرّبها ويفرد أشكالها، والضغط يفتح تفاصيلها.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, damp, metal, plastic, rubber, glow, hdr, markPick, Spinner, radialTexture, softFloor } from './lib.js';
import { TOOLS, TOOL_IMAGES } from './content.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

// جزء يتحرك بين وضع الراحة ووضع الفرد
function part(list, obj, to) {
  list.push({ obj, p0: obj.position.clone(), r0: obj.rotation.clone(), s0: obj.scale.clone(), p1: to.p || obj.position.clone(), r1: to.r || obj.rotation.clone(), s1: to.s != null ? V3(to.s, to.s, to.s) : obj.scale.clone() });
  return obj;
}
function screenTex(title, value, color = '#7fe3df') {
  const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d');
  g.fillStyle = '#060a22'; g.fillRect(0, 0, 320, 200);
  g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 320; x += 4) { const y = 150 + Math.sin(x * 0.09) * 18 * Math.sin(x * 0.012); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.fillStyle = color; g.font = '700 26px Alexandria, sans-serif'; g.fillText(title, 18, 42); g.fillStyle = '#fff'; g.font = '800 62px Alexandria, sans-serif'; g.fillText(value, 18, 112);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function consoleBox(title, value, accent) {
  const g = new THREE.Group(), white = plastic(0xeef0f8, 0.38);
  g.add(mesh(new RoundedBoxGeometry(1.05, 0.62, 0.52, 4, 0.06), white, 0, 0.5, 0));
  g.add(mesh(new THREE.BoxGeometry(1.06, 0.035, 0.53), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, emissive: accent, emissiveIntensity: 0.5 }), 0, 0.26, 0));
  g.add(mesh(new THREE.PlaneGeometry(0.6, 0.36), new THREE.MeshBasicMaterial({ map: screenTex(title, value), toneMapped: false }), -0.14, 0.56, 0.262));
  const knob = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 28), metal(0xcfd4e2, 0.25), 0.34, 0.6, 0.27); knob.rotation.x = Math.PI / 2; g.add(knob);
  g.add(mesh(new THREE.SphereGeometry(0.022, 12, 8), glow(accent, 3), 0.34, 0.42, 0.265));
  g.position.y = 0.12; return g;
}
// سلك يتبع القطعة المتحركة
function cable(from, color = 0x1a1d33) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), rubber(color, 0.6)); const a = V3(), b = V3(), c = V3();
  m.userData.update = (to) => { a.copy(from); c.copy(to); b.addVectors(a, c).multiplyScalar(0.5); b.y -= 0.28; b.z += 0.12; m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, b, c), 14, 0.013, 6); };
  return m;
}
function rings(n, r, color) { // موجات تنتشر من رأس الجهاز
  const g = new THREE.Group(); for (let i = 0; i < n; i++) { const t = mesh(new THREE.TorusGeometry(r, 0.006, 6, 40), new THREE.MeshBasicMaterial({ color: hdr(color, 2.2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); g.add(t); } return g;
}
const animRings = (g, t, k, grow = 1.6) => g.children.forEach((r, i) => { const f = (t * 0.9 + i / g.children.length) % 1; r.scale.setScalar(0.4 + f * grow); r.material.opacity = k * (1 - f) * 0.9; r.position.z = f * 0.25; });

const BUILD = {
  bands() {
    const g = new THREE.Group(), parts = [], cols = [0xf2c230, 0xe5483b, 0x3fae5a, 0x2f6fd6, 0x23242e];
    cols.forEach((c, i) => { const b = mesh(new THREE.TorusGeometry(0.3, 0.011, 8, 72), rubber(c, 0.5), (i - 2) * 0.012, 0.85, (i - 2) * 0.05); b.scale.set(1, 1.5, 6); b.rotation.y = (i - 2) * 0.06; g.add(b); part(parts, b, { p: V3((i - 2) * 0.27, 0.9 + Math.abs(i - 2) * -0.04, 0.25), r: new THREE.Euler(0, (i - 2) * 0.5, (i - 2) * -0.1) }); });
    const hook = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24, Math.PI), metal(), 0, 1.36, 0); g.add(hook);
    return { g, parts };
  },
  roller() {
    const g = new THREE.Group(), parts = [], mat = rubber(0x3a43a0, 0.7);
    const main = new THREE.Group(); const cyl = mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.1, 40), mat); main.add(cyl);
    const bump = new THREE.InstancedMesh(new RoundedBoxGeometry(0.085, 0.07, 0.085, 2, 0.02), rubber(0x4953a1, 0.6), 14 * 9), d = new THREE.Object3D(); let n = 0;
    for (let a = 0; a < 14; a++) for (let j = 0; j < 9; j++) { const an = (a / 14) * Math.PI * 2 + (j % 2) * 0.22; d.position.set(Math.cos(an) * 0.25, -0.44 + j * 0.11, Math.sin(an) * 0.25); d.rotation.set(0, -an + Math.PI / 2, 0); d.updateMatrix(); bump.setMatrixAt(n++, d.matrix); }
    main.add(bump); [-0.555, 0.555].forEach((y) => main.add(mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 40), rubber(C.teal, 0.5), 0, y, 0).rotateX(Math.PI / 2)));
    main.rotation.z = Math.PI / 2; main.position.y = 0.52; g.add(main); part(parts, main, { p: V3(0, 0.62, 0.15) });
    const long = mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.35, 32), rubber(C.teal, 0.65), 0, 0.5, -0.1); long.rotation.z = Math.PI / 2; long.scale.setScalar(0.3); g.add(long); part(parts, long, { p: V3(0, 1.22, -0.1), s: 1 });
    const small = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.42, 32), rubber(0xf0a23a, 0.65), 0, 0.5, 0); small.rotation.z = Math.PI / 2; small.scale.setScalar(0.3); g.add(small); part(parts, small, { p: V3(0.62, 1.62, 0.1), r: new THREE.Euler(0, 0.5, Math.PI / 2), s: 1 });
    return { g, parts };
  },
  graston() {
    const g = new THREE.Group(), parts = [], steel = metal(0xe3e7f0, 0.14), S = () => new THREE.Shape();
    const a = S(); a.moveTo(-0.62, 0); a.quadraticCurveTo(0, 0.34, 0.62, 0); a.quadraticCurveTo(0, 0.13, -0.62, 0);
    const b = S(); b.moveTo(0, -0.27); b.bezierCurveTo(0.27, -0.27, 0.28, 0.1, 0, 0.32); b.bezierCurveTo(-0.28, 0.1, -0.27, -0.27, 0, -0.27);
    const c = S(); c.moveTo(-0.42, -0.2); c.quadraticCurveTo(0, 0.5, 0.42, -0.2); c.quadraticCurveTo(0.3, -0.27, 0.22, -0.13); c.quadraticCurveTo(0, 0.2, -0.22, -0.13); c.quadraticCurveTo(-0.3, -0.27, -0.42, -0.2);
    const d = S(); d.absellipse(0, 0, 0.44, 0.085, 0, Math.PI * 2);
    const e = S(); e.moveTo(-0.2, -0.3); e.lineTo(0.14, -0.3); e.quadraticCurveTo(0.3, -0.3, 0.26, -0.1); e.lineTo(0.16, 0.26); e.quadraticCurveTo(0.1, 0.36, -0.02, 0.3); e.lineTo(-0.26, -0.16); e.quadraticCurveTo(-0.32, -0.3, -0.2, -0.3);
    [a, b, c, d, e].forEach((sh, i) => {
      const m = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 28 }), steel, 0, 0.95, (i - 2) * 0.05);
      m.rotation.z = i * 1.25; g.add(m); part(parts, m, { p: V3((i - 2) * 0.52, 0.95 + (i % 2) * 0.42 - 0.1, 0.2), r: new THREE.Euler(0, (i - 2) * 0.3, [0.2, 0, 0, 0.5, 0][i]) });
    });
    return { g, parts };
  },
  gun() {
    const g = new THREE.Group(), parts = [], dark = plastic(0x23263d, 0.32), gun = new THREE.Group();
    const bodyM = mesh(new THREE.CapsuleGeometry(0.17, 0.46, 8, 28), dark); bodyM.rotation.z = Math.PI / 2; gun.add(bodyM);
    const handle = mesh(new THREE.CapsuleGeometry(0.095, 0.48, 8, 20), rubber(0x15172a, 0.8), -0.16, -0.42, 0); handle.rotation.z = 0.22; gun.add(handle);
    const ring = mesh(new THREE.TorusGeometry(0.15, 0.014, 8, 40), glow(C.teal, 2.6), -0.4, 0, 0); ring.rotation.y = Math.PI / 2; gun.add(ring);
    const neck = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 20), metal(0xbfc5d6, 0.2), 0.5, 0, 0); neck.rotation.z = Math.PI / 2; gun.add(neck);
    const ball = mesh(new THREE.SphereGeometry(0.115, 24, 16), rubber(0x2b2e46, 0.85), 0.7, 0, 0); gun.add(ball);
    gun.position.set(0, 1.0, 0); gun.rotation.y = -0.5; g.add(gun); part(parts, gun, { p: V3(-0.25, 1.1, 0.1), r: new THREE.Euler(0, -0.2, 0.1) });
    const heads = [mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 24), rubber(0x2b2e46, 0.85)), mesh(new THREE.ConeGeometry(0.075, 0.22, 24), rubber(0x2b2e46, 0.85)), (() => { const f = new THREE.Group(); f.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), rubber(0x2b2e46, 0.85), 0, 0, -0.07), mesh(new THREE.SphereGeometry(0.06, 16, 12), rubber(0x2b2e46, 0.85), 0, 0, 0.07), mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12), metal(), 0, -0.07, 0)); return f; })()];
    heads.forEach((h, i) => { h.position.set(0.5, 1.0, 0); h.rotation.z = -Math.PI / 2; h.scale.setScalar(0.01); g.add(h); part(parts, h, { p: V3(0.82, 1.42 - i * 0.38, 0.3), s: 1.15 }); });
    return { g, parts, anim: (t, k) => { ball.position.x = 0.7 + Math.sin(t * 70) * 0.012 * k; } };
  },
  needles() {
    const g = new THREE.Group(), parts = [];
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 32), plastic(0xeef0f8, 0.35), 0, 0.36, 0));
    for (let i = 0; i < 9; i++) {
      const n = new THREE.Group(); n.add(mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.62, 6), metal(0xe8ebf2, 0.15), 0, 0.31, 0), mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.17, 10), plastic(i % 2 ? C.teal : C.purple2, 0.4), 0, 0.7, 0));
      n.position.set(Math.cos(i * 0.7) * 0.05, 0.44, Math.sin(i * 0.7) * 0.05); n.rotation.z = (i - 4) * 0.02; g.add(n);
      part(parts, n, { p: V3((i - 4) * 0.05, 0.5, 0.12), r: new THREE.Euler(0.12, 0, (i - 4) * -0.2), s: 1.35 });
    }
    return { g, parts };
  },
  shockwave() {
    const g = new THREE.Group(), parts = []; g.add(consoleBox('SHOCKWAVE', '2.5 bar', C.teal));
    const ap = new THREE.Group(); ap.add(mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.44, 24), plastic(0x2a2e4a, 0.35)), mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.1, 20), metal(0xd8dce8, 0.18), 0, 0.27, 0), mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 30), glow(C.teal, 2.4), 0, 0.12, 0).rotateX(Math.PI / 2));
    const w = rings(3, 0.12, C.teal2); w.position.y = 0.34; w.rotation.x = -Math.PI / 2; ap.add(w);
    ap.position.set(0.72, 0.42, 0.1); ap.rotation.z = -0.25; g.add(ap); part(parts, ap, { p: V3(0.5, 1.25, 0.55), r: new THREE.Euler(Math.PI / 2 - 0.3, 0, -0.3), s: 1.2 });
    const cb = cable(V3(0.3, 0.3, -0.2)); g.add(cb);
    return { g, parts, anim: (t, k) => { animRings(w, t, k); cb.userData.update(V3(ap.position.x, ap.position.y - 0.2, ap.position.z - 0.05)); } };
  },
  laser() {
    const g = new THREE.Group(), parts = []; g.add(consoleBox('LASER', '12 W', 0xe5483b));
    const pen = new THREE.Group(); pen.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.46, 20), plastic(0xeef0f8, 0.3)), mesh(new THREE.ConeGeometry(0.04, 0.1, 20), metal(0xbfc5d6, 0.2), 0, 0.28, 0), mesh(new THREE.SphereGeometry(0.017, 12, 8), glow(0xff3b30, 4), 0, 0.335, 0));
    const beam = mesh(new THREE.CylinderGeometry(0.05, 0.008, 0.9, 16, 1, true), new THREE.MeshBasicMaterial({ color: hdr(0xff3b30, 1), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), 0, 0.8, 0); pen.add(beam);
    pen.position.set(0.72, 0.42, 0.1); pen.rotation.z = -0.2; g.add(pen); part(parts, pen, { p: V3(0.55, 1.2, 0.45), r: new THREE.Euler(Math.PI / 2 - 0.45, 0, -0.35), s: 1.25 });
    const cb = cable(V3(0.3, 0.3, -0.2)); g.add(cb);
    return { g, parts, anim: (t, k) => { beam.material.opacity = k * (0.35 + Math.sin(t * 9) * 0.08); cb.userData.update(V3(pen.position.x, pen.position.y - 0.22, pen.position.z - 0.05)); } };
  },
  tecar() {
    const g = new THREE.Group(), parts = []; g.add(consoleBox('TECAR', '500 kHz', 0xf0a23a));
    const el = new THREE.Group(); el.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 18), plastic(0x2a2e4a, 0.35), 0, 0.2, 0), mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.035, 36), metal(0xe3e7f0, 0.12)));
    const heat = mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: radialTexture(), color: hdr(0xff7a2a, 1), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), 0, -0.03, 0); heat.rotation.x = Math.PI / 2; el.add(heat);
    el.position.set(0.74, 0.16, 0.12); g.add(el); part(parts, el, { p: V3(0.55, 1.2, 0.5), r: new THREE.Euler(-Math.PI / 2 + 0.35, 0, 0.2), s: 1.25 });
    const plate = mesh(new RoundedBoxGeometry(0.44, 0.02, 0.3, 2, 0.01), metal(0xd8dce8, 0.2), -0.82, 0.14, 0.15); g.add(plate); part(parts, plate, { p: V3(-0.75, 1.0, 0.45), r: new THREE.Euler(1.1, 0.3, 0) });
    const cb = cable(V3(0.3, 0.3, -0.2)); g.add(cb);
    return { g, parts, anim: (t, k) => { heat.material.opacity = k * (0.5 + Math.sin(t * 3) * 0.15); cb.userData.update(V3(el.position.x, el.position.y + 0.3 * (1 - k), el.position.z - 0.1)); } };
  },
  ultrasound() {
    const g = new THREE.Group(), parts = []; g.add(consoleBox('ULTRASOUND', '1 MHz', C.purple2));
    const pr = new THREE.Group(); pr.add(mesh(new THREE.CapsuleGeometry(0.05, 0.32, 8, 20), plastic(0xeef0f8, 0.3), 0, 0.26, 0), mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.07, 30), metal(0xcfd4e2, 0.15)), mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 30), glow(C.purple2, 2.6), 0, 0.12, 0).rotateX(Math.PI / 2));
    const w = rings(3, 0.1, C.purple2); w.rotation.x = Math.PI / 2; w.position.y = -0.05; pr.add(w);
    pr.position.set(0.74, 0.17, 0.12); g.add(pr); part(parts, pr, { p: V3(0.55, 1.2, 0.5), r: new THREE.Euler(-Math.PI / 2 + 0.4, 0, 0.25), s: 1.25 });
    const cb = cable(V3(0.3, 0.3, -0.2)); g.add(cb);
    return { g, parts, anim: (t, k) => { animRings(w, t, k, 1.8); cb.userData.update(V3(pr.position.x, pr.position.y + 0.4 * (1 - k), pr.position.z - 0.1)); } };
  },
  tens() {
    const g = new THREE.Group(), parts = [], unit = new THREE.Group();
    unit.add(mesh(new RoundedBoxGeometry(0.46, 0.74, 0.13, 4, 0.05), plastic(0xeef0f8, 0.35)), mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ map: screenTex('TENS', '80 Hz'), toneMapped: false }), 0, 0.16, 0.067));
    [-0.11, 0, 0.11].forEach((x, i) => unit.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), plastic([C.teal, C.purple, C.teal][i], 0.4), x, -0.16, 0.07).rotateX(Math.PI / 2)));
    unit.position.set(0, 0.95, 0); unit.rotation.x = -0.2; g.add(unit); part(parts, unit, { p: V3(0, 1.05, 0.1) });
    const pads = [], wires = [];
    [[-0.72, 1.5], [0.72, 1.5], [-0.72, 0.55], [0.72, 0.55]].forEach(([x, y], i) => {
      const p = mesh(new RoundedBoxGeometry(0.3, 0.3, 0.025, 2, 0.012), rubber(0xdfe3ee, 0.6), (i - 1.5) * 0.02, 0.3 + i * 0.03, 0); p.rotation.x = Math.PI / 2; g.add(p); pads.push(p);
      part(parts, p, { p: V3(x, y, 0.3), r: new THREE.Euler(0, x < 0 ? 0.35 : -0.35, 0) });
      const wr = cable(V3(0, 0.6, 0), i % 2 ? 0xe5483b : 0x23242e); g.add(wr); wires.push(wr);
    });
    return { g, parts, anim: () => wires.forEach((wr, i) => wr.userData.update(pads[i].position)) };
  },
};

const TWO = Math.PI * 2, wrap = (x) => ((x + Math.PI) % TWO + TWO) % TWO - Math.PI, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default function createTools(ctx) {
  const { ui } = ctx, { P } = ui;
  const group = new THREE.Group(), ring = new THREE.Group(), pickables = [], items = [], spin = new Spinner((Math.PI * 2) / TOOLS.length), R = 4.3;
  group.add(ring);
  const floor = softFloor(4.4); floor.position.set(0, 0, R); group.add(floor);

  TOOLS.forEach((tool, i) => {
    const a = (i / TOOLS.length) * Math.PI * 2, built = BUILD[tool.id](), slot = new THREE.Group(), lift = new THREE.Group();
    slot.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); slot.rotation.y = a; ring.add(slot); slot.add(lift); lift.add(built.g); built.g.scale.setScalar(1.25);
    const ped = mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.1, 48), new THREE.MeshLambertMaterial({ color: 0xe9ebf7 }), 0, 0.05, 0); ped.receiveShadow = true; slot.add(ped);
    const pr = mesh(new THREE.TorusGeometry(0.92, 0.01, 6, 80), glow(C.teal, 1.2), 0, 0.102, 0); pr.rotation.x = Math.PI / 2; slot.add(pr);
    const it = { tool, a, slot, lift, built, k: 0, ring: pr }; markPick(built.g, it, pickables); ped.userData.pick = it; pickables.push(ped); items.push(it);
    built.anim && built.anim(0, 0);
  });

  let hover = null, sel = null; const world = new THREE.Vector3(), scr = {}, e = new THREE.Euler(), _pur = new THREE.Color(C.purple);
  // أسهم التنقل بين العناصر
  const nav = ui.el('div', 'seg glass'); const bPrev = ui.el('button', '', '› السابق'), bNext = ui.el('button', '', 'التالي ‹');
  bPrev.onclick = () => { if (sel) ui.closePanel(); spin.stepBy(1); }; bNext.onclick = () => { if (sel) ui.closePanel(); spin.stepBy(-1); }; nav.append(bPrev, bNext);

  function open(it) {
    sel = it; spin.to(-it.a);
    const t = it.tool;
    ui.openPanel([P.tag(t.tag), P.title(t.name), P.lead(t.about), P.h('طريقة التطبيق'), P.apply(t.id, t.apply, TOOL_IMAGES.includes(t.id)), P.h('متى نستخدمها؟'), P.list(t.uses, 'wide'),
      P.note('اختيار الأداة أو الجهاز يكون حسب تقييم الأخصائي لحالتك، وضمن خطة علاجية مخصصة.'),
      P.cta(ui.button('احجز تقييمك', 'primary', () => ui.openBooking()))],
    { onClose: (rep) => { if (!rep || sel === it) { sel = null; spin.target = null; } }, leader: () => { it.lift.getWorldPosition(world); world.y += 0.9; const p = ctx.project(world, scr); return p.behind ? null : p; } });
  }
  const st = {
    id: 'tools', group, pickables, tools: nav,
    view: { look: [0, 1.25, R - 0.9], dir: [0, 0.2, 1], fitW: 8.6, fitH: 4.4 },
    resize() { st.view = ctx.mobile() ? { look: [0, 1.15, R + 0.2], dir: [0, 0.16, 1], fitW: 3.3, fitH: 3.5 } : { look: [0, 1.2, R + 0.2], dir: [0, 0.13, 1], fitW: 6.6, fitH: 3.6 }; },
    enter() { const base = Math.round(spin.angle / spin.step) * spin.step; spin.angle = base + spin.step * 1.5; spin.vel = 0; spin.target = base; }, // المنصة تدور لمكانها عند الدخول
    leave() { hover = sel = null; spin.target = null; },
    update(dt, t) {
      spin.update(dt, !!hover); ring.rotation.y = spin.angle;
      for (const it of items) {
        const d = Math.abs(wrap(it.a + spin.angle)) / spin.step, vis = 1 - sstep(1.3, 1.85, d), front = Math.max(0, 1 - d);
        it.slot.visible = vis > 0.01; it.slot.scale.setScalar(Math.max(0.001, vis));
        // الأداة اللي في النص تنفرد لحالها، والباقي تنفرد عند التأشير
        const on = it === hover || it === sel || (front > 0.93 && !hover && !sel); it.k = damp(it.k, on ? 1 : 0, 5, dt); const k = it.k;
        it.lift.position.y = k * 0.16 + Math.sin(t * 1.1 + it.a * 3) * 0.02; it.lift.position.z = front * 0.5; it.lift.scale.setScalar((0.78 + front * 0.42) * (1 + k * 0.06)); it.lift.rotation.y = Math.sin(t * 0.6 + it.a) * 0.12 * (1 - k);
        it.ring.material.color.set(C.teal).lerp(_pur, k);
        if (k > 0.001 || it.dirty) {
          for (const p of it.built.parts) { p.obj.position.lerpVectors(p.p0, p.p1, k); p.obj.scale.lerpVectors(p.s0, p.s1, k); e.set(p.r0.x + (p.r1.x - p.r0.x) * k, p.r0.y + (p.r1.y - p.r0.y) * k, p.r0.z + (p.r1.z - p.r0.z) * k); p.obj.rotation.copy(e); }
          it.built.anim && it.built.anim(t, k); it.dirty = k > 0.001;
        }
      }
    },
    hover(it) { hover = it; if (it) ui.showTip(it.tool.name, it.tool.tag, ctx.pointer.px, ctx.pointer.py); else ui.hideTip(); },
    click(it) { open(it); },
    drag(dx) { spin.drag(dx); if (sel) ui.closePanel(); },
  };
  st.resize();
  return st;
}
