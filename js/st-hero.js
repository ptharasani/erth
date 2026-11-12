// البداية: عمود فقري حقيقي مع الحوض يتكوّن قطعة قطعة من فوق لتحت (مثل شعار إرث)، وهو خريطة الموقع:
// كل مجموعة فقرات تمثل قسم، تضيء عند التأشير وتودّيك له عند الضغط.
import * as THREE from 'three';
import { podium, crystal, C, damp, clamp, easeOut, mergeMeshes } from './lib.js';
import { vert, STATIONS, SLOGAN } from './content.js';

// من فوق لتحت: كل مجموعة فقرات = قسم من أقسام الموقع
const GROUPS = [
  { to: 1, codes: ['c1', 'c2', 'c3'] }, { to: 2, codes: ['c4', 'c5', 'c6'] }, { to: 3, codes: ['c7', 't1', 't2'] }, { to: 4, codes: ['t3', 't4', 't5'] },
  { to: 5, codes: ['t6', 't7', 't8'] }, { to: 6, codes: ['t9', 't10', 't11'] }, { to: 7, codes: ['t12', 'l1', 'l2'] }, { to: 8, codes: ['l3', 'l4', 'l5', 'sacrum'] },
];

export default function createHero(ctx) {
  const { ui } = ctx;
  const group = new THREE.Group(), pivot = new THREE.Group(), spine = new THREE.Group();
  group.add(pivot); pivot.add(spine);
  const skel = ctx.assets.skeleton; skel.updateMatrixWorld(true);
  const pickables = [], parts = [];
  const vCol = new THREE.Color(0xd2c5a8), dCol = new THREE.Color(0x2f9c98);

  const add = (name, g, kind = 'v') => {
    const src = skel.getObjectByName(name); if (!src) return;
    // القطعة الأصلية للالتقاط بالماوس فقط (ما تنرسم). الرسم من مجسم واحد مدموج تحت
    const mesh = src.clone(); mesh.visible = false; mesh.userData.noShadow = true; mesh.userData.col = kind === 'd' ? dCol : vCol;
    const holder = new THREE.Group(); holder.add(mesh); spine.add(holder);
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const part = { holder, mesh, c, g, kind, disc: kind === 'd', e: 0, hot: 0, dirv: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize() };
    parts.push(part); mesh.userData.pick = part; pickables.push(mesh);
  };
  GROUPS.forEach((gr, gi) => gr.codes.forEach((c) => add(c === 'sacrum' ? 'sacrum' : vert(c), gi)));
  const verts = parts.slice();
  skel.traverse((o) => { if (o.isMesh && o.name.startsWith('intervertebral-disc')) add(o.name, -1, 'd'); });
  parts.forEach((p) => { if (p.disc) { let best = verts[0]; for (const q of verts) if (Math.abs(q.c.y - p.c.y) < Math.abs(best.c.y - p.c.y)) best = q; p.g = best.g; } });
  ['right-hip-bone', 'left-hip-bone', 'coccyx'].forEach((n) => add(n, GROUPS.length - 1, 'h')); // الحوض مع آخر مجموعة
  parts.sort((a, b) => a.c.y - b.c.y); const spineParts = parts.filter((p) => p.kind !== 'h');
  spineParts.forEach((p, i) => { p.rank = 1 - (i + 1) / spineParts.length; }); parts.forEach((p) => { if (p.kind === 'h') p.rank = 1.04; }); // الترتيب من فوق لتحت دايماً، والحوض آخر شي

  const box = new THREE.Box3().setFromObject(spine), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const HGT = 6.3, S = HGT / size.y, BASE = 0.45; spine.position.copy(center).multiplyScalar(-1); pivot.scale.setScalar(S); pivot.position.y = BASE + HGT / 2;
  const halfW = (size.x * S) / 2;
  // كل القطع في مجسم واحد وخامة واحدة: مكان كل قطعة وحجمها وشفافيتها وإضاءتها في جدول صغير يتحدث كل فريم
  const NP = parts.length; parts.forEach((p, i) => { p.i = i; p.mesh.userData.hi = i; });
  const pt = new Float32Array(NP * 8), ptTex = new THREE.DataTexture(pt, NP, 2, THREE.RGBAFormat, THREE.FloatType), ptU = { value: ptTex };
  const V_HEAD = 'attribute float aId; uniform sampler2D uPt; varying vec2 vFx;', V_MOVE = '{ int id = int(aId + 0.5); vec4 pa = texelFetch(uPt, ivec2(id, 0), 0); transformed = transformed * pa.w + pa.xyz; vFx = texelFetch(uPt, ivec2(id, 1), 0).xy; }';
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.0, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25, emissive: C.teal, emissiveIntensity: 1, envMapIntensity: 0.9, transparent: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPt = ptU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + V_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + V_MOVE);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFx;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFx.x; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.42, 0.40), clamp(vFx.y - 0.35, 0.0, 1.0) * 0.9);').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vFx.y * 0.12;');
  };
  mat.customProgramCacheKey = () => 'erth-hero-l';
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); // الظل يتبع نفس الحركة
  depthMat.onBeforeCompile = (sh) => { sh.uniforms.uPt = ptU; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + V_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + V_MOVE); };
  depthMat.customProgramCacheKey = () => 'erth-hero-depth';
  group.updateMatrixWorld(true);
  const merged = new THREE.Mesh(mergeMeshes(parts.map((p) => p.mesh), new THREE.Matrix4().copy(spine.matrixWorld).invert(), true), mat);
  merged.customDepthMaterial = depthMat; merged.castShadow = merged.receiveShadow = true; merged.frustumCulled = false; spine.add(merged);
  group.add(podium(Math.max(1.7, halfW + 0.5)));
  // نقاط الثاء الثلاث من الشعار تدور حول العمود
  const gems = [0, 1, 2].map((i) => { const g = crystal(0.3, i === 1 ? C.teal : C.purple); g.userData.a = (i / 3) * Math.PI * 2; group.add(g); return g; });

  // أسماء الأقسام في عمود مرتب على يسار العمود الفقري، وخط رفيع يوصل كل اسم بفقراته
  const hsRoot = document.getElementById('hotspots');
  const labels = GROUPS.map((gr, gi) => {
    const ps = parts.filter((p) => p.g === gi && p.kind === 'v'), y = ps.reduce((s, p) => s + p.c.y, 0) / ps.length;
    const elx = ui.el('button', 'hs sec', `<i></i><b><em>${String(gr.to + 1).padStart(2, '0')}</em>${STATIONS[gr.to].nav}</b>`); elx.style.display = 'none';
    elx.onclick = () => ctx.go(gr.to); elx.onpointerenter = () => { labelHover = gi; }; elx.onpointerleave = () => { if (labelHover === gi) labelHover = -1; };
    hsRoot.append(elx); return { el: elx, line: elx.querySelector('i'), bw: 0, op: -1, y: BASE + HGT / 2 + (y - center.y) * S };
  });
  // توزيع الأسماء بمسافات متساوية على طول العمود
  const yTop = labels[0].y, yBot = labels[labels.length - 1].y; labels.forEach((l, i) => { l.ly = yTop + (yBot - yTop) * (i / (labels.length - 1)); });

  let clockT = 0, meshHover = -1, labelHover = -1, active = false, tilt = 0, first = true, T = { d0: 0.25, span: 1.7, dur: 0.75, fall: 1.1, labels: 2.75 };
  const world = new THREE.Vector3(), scr = {}, scr2 = {}, setT = (e, t) => { if (e._t !== t) { e._t = t; e.style.transform = t; } };
  const st = {
    id: 'hero', group, pickables, ownIntro: true, fastPick: true,
    view: null,
    resize() { labels.forEach((l) => { l.bw = 0; }); st.view = ctx.mobile() ? { look: [-0.95, BASE + HGT / 2 - 0.35, 0], dir: [0.06, 0.03, 1], fitW: 5.4, fitH: HGT + 1.6 } : { look: [-0.75, BASE + HGT / 2 - 0.32, 0], dir: [0.14, 0.03, 1], fitW: 5.6, fitH: HGT + 1.5 }; },
    enter() { T = first ? { d0: 0.25, span: 1.7, dur: 0.75, fall: 1.1, labels: 2.75 } : { d0: 0.1, span: 0.7, dur: 0.6, fall: 0.5, labels: 1.0 }; first = false; clockT = 0; active = true; labels.forEach((l) => { l.el.style.display = ''; l.el.style.opacity = 0; l.op = 0; }); },
    leave() { active = false; meshHover = labelHover = -1; labels.forEach((l) => { l.el.style.display = 'none'; }); },
    update(dt, t, on) {
      clockT += dt; tilt = damp(tilt, ctx.pointer.inside ? ctx.pointer.x : 0, 3, dt);
      pivot.rotation.y = 0.5 + Math.sin(t * 0.22) * 0.4 + tilt * 0.3; pivot.position.y = BASE + HGT / 2 + Math.sin(t * 0.7) * 0.04;
      const hg = labelHover >= 0 ? labelHover : meshHover;
      for (const p of parts) {
        p.e = easeOut(clamp((clockT - (T.d0 + p.rank * T.span)) / T.dur, 0, 1)); p.hot = damp(p.hot, p.g === hg ? 1 : 0, 9, dt);
        const s = 1 + p.hot * (p.kind === 'h' ? 0.03 : 0.12), k = 1 - p.e;
        p.holder.scale.setScalar(s);
        const hp = p.holder.position.set(p.c.x * (1 - s) + p.dirv.x * k * 0.12, p.c.y * (1 - s) + p.dirv.y * k * 0.12 - k * T.fall / S, p.c.z * (1 - s) + p.dirv.z * k * 0.12), o = p.i * 4;
        pt[o] = hp.x; pt[o + 1] = hp.y; pt[o + 2] = hp.z; pt[o + 3] = s; pt[NP * 4 + o] = p.e; pt[NP * 4 + o + 1] = (p.disc ? 0.35 : 0) + p.hot * (p.disc ? 1.4 : p.kind === 'h' ? 0.35 : 0.75);
      }
      ptTex.needsUpdate = true;
      gems.forEach((g, i) => { const a = g.userData.a + t * 0.3; g.position.set(Math.cos(a) * (halfW + 0.55), BASE + HGT * 0.72 + Math.sin(t * 0.8 + i * 2) * 0.25 - i * 0.9, Math.sin(a) * (halfW + 0.55)); g.rotation.y = Math.sin(t * 0.8 + i * 2) * 0.55; });
      if (on && active) {
        const gx = group.position.x, gy = group.position.y;
        labels.forEach((l, gi) => {
          const show = clamp((clockT - T.labels - gi * 0.09) / 0.6, 0, 1);
          world.set(gx - halfW - 0.45, gy + l.ly, 0); const p = ctx.project(world, scr); world.set(gx - 0.3, gy + l.y, 0); const q = ctx.project(world, scr2);
          if (!l.bw) l.bw = l.el.offsetWidth || 120; // العرض ينقاس مرة وحدة، مو كل فريم
          const lx = Math.max(p.x, l.bw + 6); // ما يطلع الاسم برا الشاشة
          setT(l.el, `translate(${lx.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-100%, -50%)`);
          const op = p.behind ? 0 : Math.round(show * 50) / 50; if (op !== l.op) { l.op = op; l.el.style.opacity = op; l.el.style.pointerEvents = show > 0.9 ? '' : 'none'; }
          const dx = Math.max(10, q.x - lx - 6), dy = q.y - p.y;
          setT(l.line, `rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${(Math.max(10, Math.hypot(dx, dy)) / 100).toFixed(4)})`);
          const on = gi === hg; if (on !== l.on) { l.on = on; l.el.classList.toggle('on', on); }
        });
      }
    },
    hover(p) { meshHover = p ? p.g : -1; },
    click(p) { ctx.go(GROUPS[p.g].to); },
    titleExtra(acts) {
      acts.before(ui.el('p', 't-slogan', SLOGAN));
      acts.append(ui.button('احجز الآن', 'primary', () => ui.openBooking()), ui.button('وين الألم؟', 'line', () => ctx.go('body')));
    },
  };
  st.resize();
  return st;
}
