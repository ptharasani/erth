// الجسم التفاعلي: هيكل عظمي وعضلات حقيقية (BodyParts3D) مع جسم زجاجي.
// كل مفصل وفقرة وعضلة تضيء عند التأشير، وتفتح لوحتها عند الضغط.
import * as THREE from 'three';
import { podium, rimMaterial, radialTexture, hdr, C, damp, clamp, mergeMeshes } from './lib.js';
import { REGIONS } from './content.js';

const GROUPS = [['muscle', 'العضلات'], ['joint', 'المفاصل'], ['spine', 'العمود الفقري']];
const RIB = /-rib$|costal-cartilage|sternum|xiphoid/;
const COVERED = /vertebra|atlas|axis|intervertebral|-rib$|costal|femur|hyoid/; // عظام تغطيها العضلات بالكامل

// ── خامة العضلات: ألياف تمشي مع اتجاه العضلة، أوتار بيضاء عند الأطراف، ولمعة رطبة ──
const M_HEAD = `
varying vec3 vBP; varying vec3 vAxis; varying vec3 vCenter; varying vec3 vMisc; varying vec3 vMCol; varying float vHot;
#define uAxis vAxis
#define uCenter vCenter
#define uHalf vMisc.x
#define uSeed vMisc.y
#define uTendon vMisc.z
float mFib = 0.5; float mTen = 0.0;
float mhash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float mnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mhash(i), mhash(i + vec3(1,0,0)), f.x), mix(mhash(i + vec3(0,1,0)), mhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mhash(i + vec3(0,0,1)), mhash(i + vec3(1,0,1)), f.x), mix(mhash(i + vec3(0,1,1)), mhash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
const M_COLOR = `
{ diffuseColor.rgb = vMCol; float sx = vBP.x < 0.0 ? -1.0 : 1.0;
  vec3 ax = normalize(vec3(uAxis.x * sx, uAxis.y, uAxis.z)); vec3 rel = vBP - vec3(uCenter.x * sx, uCenter.y, uCenter.z);
  float tl = dot(rel, ax); vec3 pp = rel - ax * tl;
  vec3 up = abs(ax.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0); vec3 e1 = normalize(cross(ax, up)); vec3 e2 = cross(ax, e1);
  vec2 q = vec2(dot(pp, e1), dot(pp, e2)); float fw = length(fwidth(q));
  float coarse = mnoise(vec3(q * 58.0, tl * 2.4) + uSeed); float fine = mnoise(vec3(q * 200.0, tl * 5.0) + uSeed * 1.7);
  float cW = 1.0 - smoothstep(0.007, 0.022, fw), fW = 1.0 - smoothstep(0.0016, 0.006, fw);
  mFib = mix(0.5, coarse, cW) * 0.6 + mix(0.5, fine, fW) * 0.4;
  float tn = clamp(abs(tl) / max(uHalf, 0.001), 0.0, 1.0);
  mTen = max(uTendon, smoothstep(0.76, 0.97, tn + (coarse - 0.5) * 0.14));
  vec3 meat = diffuseColor.rgb * (0.92 + 0.16 * mFib);
  vec3 tend = vec3(0.86, 0.82, 0.74) * (0.96 + 0.08 * mFib);
  diffuseColor.rgb = mix(meat, tend, mTen);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.42, 0.40), clamp(vHot, 0.0, 1.0) * 0.78); }`;
const M_NORMAL = `
{ vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float hx = dFdx(mFib), hy = dFdy(mFib);
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
  normal = normalize(abs(det) * normal - 0.0022 * sign(det) * (hx * r1 + hy * r2)); }`;
const M_RIM = `outgoingLight += pow(1.0 - saturate(dot(normal, geometryViewDir)), 3.0) * mix(vec3(0.42, 0.26, 0.24), vec3(0.34, 0.32, 0.3), mTen) * 0.3;`;
// خامة واحدة لكل العضلات: قيم كل عضلة (اتجاه الألياف، اللون، الإضاءة) تنقرا من جدول صغير حسب رقمها،
// فالعضلات كلها تنرسم في أمر واحد بدل مئات الأوامر
const V_IDS = 'attribute float aId; uniform sampler2D uHot; varying float vHot;';
function muscleMaterial(emissive, hotU, parU) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, envMapIntensity: 0.45, emissive, emissiveIntensity: 1, transparent: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHot = hotU; sh.uniforms.uPar = parU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + V_IDS + ' uniform sampler2D uPar; varying vec3 vBP; varying vec3 vAxis; varying vec3 vCenter; varying vec3 vMisc; varying vec3 vMCol;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = transformed; { int id = int(aId + 0.5); vHot = texelFetch(uHot, ivec2(id, 0), 0).r; vec4 p0 = texelFetch(uPar, ivec2(id, 0), 0), p1 = texelFetch(uPar, ivec2(id, 1), 0), p2 = texelFetch(uPar, ivec2(id, 2), 0); vAxis = p0.xyz; vCenter = p1.xyz; vMisc = vec3(p0.w, p1.w, p2.w); vMCol = p2.rgb; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + M_HEAD).replace('#include <color_fragment>', '#include <color_fragment>\n' + M_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.66, 0.52, mTen);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vHot * 0.08;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + M_NORMAL).replace('#include <opaque_fragment>', M_RIM + '\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'erth-muscle3';
  return m;
}
function boneMaterial(emissive, hotU) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0, envMapIntensity: 0.75, emissive, emissiveIntensity: 1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHot = hotU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + V_IDS).replace('#include <begin_vertex>', '#include <begin_vertex>\nvHot = texelFetch(uHot, ivec2(int(aId + 0.5), 0), 0).r;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHot;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.42, 0.40), clamp(vHot, 0.0, 1.0) * 0.85);').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vHot * 0.1;');
  };
  m.customProgramCacheKey = () => 'erth-bone-l';
  return m;
}
const TENDON = /tendon|linea-alba|aponeurosis/;

export default function createBody(ctx) {
  const { ui } = ctx, { P } = ui;
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body); body.position.y = 2.12;
  group.add(podium(1.6));
  // المجسمات الأصلية (مئات القطع) تبقى للالتقاط بالماوس وحساب الأماكن فقط، وما تنرسم. اللي ينرسم نسخ مدموجة
  const skel = ctx.assets.skeleton; body.add(skel); skel.visible = false;
  const bones = new Map(), muscles = new Map(), all = [];
  const teal = new THREE.Color(0x19b3aa);
  const halos = [0, 1].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: hdr(C.teal, 1.0), transparent: true, opacity: 0, depthWrite: false, depthTest: false })); s.renderOrder = 8; body.add(s); return s; });
  let haloA = 0;

  skel.traverse((o) => {
    if (!o.isMesh) return;
    const disc = o.name.startsWith('intervertebral-disc'), cart = o.name.includes('cartilage');
    o.userData.col = disc ? new THREE.Color(0x8fded9) : cart ? new THREE.Color(0xcdd6e6) : new THREE.Color(0xd6ccb8).lerp(o.material.color, 0.2);
    o.userData.tgt = 0; o.userData.hi = all.length; bones.set(o.name, o); all.push(o);
  });
  const musclesRoot = ctx.assets.muscles || null;
  if (musclesRoot) {
    // نفس مصدر الهيكل لكن بمقياس مختلف، فنرجّعه لنفس الإحداثيات
    musclesRoot.scale.setScalar(0.625); musclesRoot.position.set(0.0000275, -0.00038, -0.03184); body.add(musclesRoot); musclesRoot.visible = false;
    musclesRoot.traverse((o) => { if (!o.isMesh) return; o.userData.tgt = 0; o.userData.hi = all.length; muscles.set(o.name, o); all.push(o); });
  }
  // جدول الإضاءة (يتغير مع التأشير) وجدول قيم العضلات (ثابت)
  const NH = all.length, hot = new Float32Array(NH), hotTex = new THREE.DataTexture(hot, NH, 1, THREE.RedFormat, THREE.FloatType); hotTex.needsUpdate = true;
  const par = new Float32Array(NH * 3 * 4), parTex = new THREE.DataTexture(par, NH, 3, THREE.RGBAFormat, THREE.FloatType);
  const hotU = { value: hotTex }, parU = { value: parTex };
  let boneMesh = null, coveredMesh = null, muscleMesh = null, muscleMat = null;

  // ── حساب أماكن النقاط من المجسمات نفسها ──
  const v = new THREE.Vector3(), inv = new THREE.Matrix4();
  function eachVertex(mesh, fn) {
    const pos = mesh.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 500));
    for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv); fn(v); }
  }
  function boxOf(meshes) { const b = new THREE.Box3(); meshes.forEach((m) => m && eachVertex(m, (p) => b.expandByPoint(p))); return b; }
  function centroid(meshes, test) { const s = new THREE.Vector3(); let n = 0; meshes.forEach((m) => m && eachVertex(m, (p) => { if (test(p)) { s.add(p); n++; } })); return n ? s.multiplyScalar(1 / n) : null; }

  let skin = null, skinMat = null, skinMesh = null, ready = false;
  function buildSkin(root) {
    // الجسم الزجاجي: حواف مضيئة فقط. نسطّح منطقة الحوض الأمامية في الشيدر عشان يبقى الشكل محايد
    skinMat = new THREE.ShaderMaterial({
      uniforms: { cA: { value: new THREE.Color(C.purple) }, cB: { value: new THREE.Color(C.teal) }, power: { value: 2.4 }, alpha: { value: 0 }, boost: { value: 1.5 }, uToBody: { value: new THREE.Matrix4() }, uFromBody: { value: body.matrixWorld }, uClamp: { value: new THREE.Vector4(0.11, -1, -1, 10) } },
      vertexShader: `uniform mat4 uToBody; uniform mat4 uFromBody; uniform vec4 uClamp; varying vec3 vN; varying vec3 vV;
        void main(){ vec3 bp = (uToBody * vec4(position, 1.0)).xyz;
          float w = (1.0 - smoothstep(uClamp.x * 0.55, uClamp.x, abs(bp.x))) * smoothstep(uClamp.y, uClamp.y + 0.06, bp.y) * (1.0 - smoothstep(uClamp.z - 0.06, uClamp.z, bp.y));
          bp.z = mix(bp.z, min(bp.z, uClamp.w), w);
          vec4 mv = viewMatrix * uFromBody * vec4(bp, 1.0); vN = normalize(normalMatrix * normal); vN = normalize(mix(vN, vec3(0.0, 0.0, 1.0), w * 0.7)); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 cA; uniform vec3 cB; uniform float power; uniform float alpha; uniform float boost; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), power); gl_FragColor = vec4(mix(cA, cB, f), f * alpha * boost); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    root.traverse((o) => { if (o.isMesh) { o.material = skinMat; o.renderOrder = 5; o.frustumCulled = false; skinMesh = o; } }); body.add(root); skin = root;
    group.updateMatrixWorld(true); inv.copy(body.matrixWorld).invert(); skinMat.uniforms.uToBody.value.copy(inv).multiply(skinMesh.matrixWorld);
    const hips = [bones.get('right-hip-bone'), bones.get('left-hip-bone')], hb = boxOf(hips); let zp = -1e9; hips.forEach((m) => m && eachVertex(m, (p) => { if (Math.abs(p.x) < 0.07) zp = Math.max(zp, p.z); }));
    if (!hb.isEmpty() && zp > -1e8) skinMat.uniforms.uClamp.value.set(0.12, hb.min.y - 0.2, hb.min.y + 0.3, zp + 0.055);
  }

  let hsEls = [], rightSign = 1;
  const hsRoot = document.getElementById('hotspots');
  const lines = ui.el('div'); lines.id = 'hsLines'; lines.style.display = 'none'; hsRoot.append(lines);
  const setT = (e, t) => { if (e._t !== t) { e._t = t; e.style.transform = t; } };
  // توزيع الأسماء في العمود بمسافة ثابتة بينها، من غير ما تطلع برا المسرح
  function spread(list, gap, top, bottom) {
    list.sort((a, b) => a.ay - b.ay); const n = list.length; if (!n) return;
    for (let i = 0; i < n; i++) list[i].ty = i ? Math.max(list[i].ay, list[i - 1].ty + gap) : Math.max(top, list[i].ay);
    if (list[n - 1].ty > bottom) { list[n - 1].ty = bottom; for (let i = n - 2; i >= 0; i--) list[i].ty = Math.min(list[i].ty, list[i + 1].ty - gap); }
  }
  function build() {
    group.updateMatrixWorld(true); inv.copy(body.matrixWorld).invert();
    rightSign = Math.sign(boxOf([bones.get('right-humerus')]).getCenter(new THREE.Vector3()).x) || 1;
    // اتجاه ألياف كل عضلة: المحور الرئيسي لنقاطها (بعد طيّ الجهتين على بعض)
    muscles.forEach((m) => {
      const pts = []; eachVertex(m, (p) => pts.push(Math.abs(p.x), p.y, p.z)); const n = pts.length / 3; if (!n) return;
      const c = [0, 0, 0]; for (let i = 0; i < pts.length; i++) c[i % 3] += pts[i] / n;
      const C = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < pts.length; i += 3) { const x = pts[i] - c[0], y = pts[i + 1] - c[1], z = pts[i + 2] - c[2]; C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z; }
      let a = [0.3, 1, 0.2]; for (let k = 0; k < 30; k++) { const x = C[0] * a[0] + C[1] * a[1] + C[2] * a[2], y = C[1] * a[0] + C[3] * a[1] + C[4] * a[2], z = C[2] * a[0] + C[4] * a[1] + C[5] * a[2], l = Math.hypot(x, y, z) || 1; a = [x / l, y / l, z / l]; }
      let half = 0; for (let i = 0; i < pts.length; i += 3) half = Math.max(half, Math.abs((pts[i] - c[0]) * a[0] + (pts[i + 1] - c[1]) * a[1] + (pts[i + 2] - c[2]) * a[2]));
      const k = m.userData.hi * 4, col = new THREE.Color().setHSL(0.012 + Math.random() * 0.012, 0.56, 0.34 + Math.random() * 0.05);
      par[k] = a[0]; par[k + 1] = a[1]; par[k + 2] = a[2]; par[k + 3] = half;
      par[NH * 4 + k] = c[0]; par[NH * 4 + k + 1] = c[1]; par[NH * 4 + k + 2] = c[2]; par[NH * 4 + k + 3] = Math.random() * 40;
      par[NH * 8 + k] = col.r; par[NH * 8 + k + 1] = col.g; par[NH * 8 + k + 2] = col.b; par[NH * 8 + k + 3] = TENDON.test(m.name) ? 1 : 0;
    });
    parTex.needsUpdate = true;
    // المجسمات المدموجة: عظام ظاهرة، عظام تغطيها العضلات، والعضلات. ثلاث أوامر رسم بدل أكثر من 300
    const mk = (list, mat) => { if (!list.length) return null; const mesh = new THREE.Mesh(mergeMeshes(list, inv, mat.vertexColors), mat); mesh.castShadow = mesh.receiveShadow = true; body.add(mesh); return mesh; };
    const bm = boneMaterial(teal, hotU), bl = [...bones.values()];
    boneMesh = mk(bl.filter((m) => !COVERED.test(m.name)), bm); coveredMesh = mk(bl.filter((m) => COVERED.test(m.name)), bm);
    if (muscles.size) { muscleMat = muscleMaterial(teal, hotU, parU); muscleMesh = mk([...muscles.values()], muscleMat); }
    for (const r of REGIONS) {
      const set = new Set(r.bones || []); (r.muscles || []).forEach((m) => set.add(m));
      if (r.bonesRe) bones.forEach((_, n) => { if (r.bonesRe.test(n)) set.add(n); });
      r.set = set; const a = r.anchor, sx = a.side ? (a.side === 'right' ? rightSign : -rightSign) : 0, side = (p) => !sx || Math.sign(p.x) === sx;
      let c = null;
      if (a.end) { const m = bones.get(a.end[0]), b = boxOf([m]), cut = a.end[1] === 'top' ? b.max.y - (b.max.y - b.min.y) * a.end[2] : b.min.y + (b.max.y - b.min.y) * a.end[2]; c = centroid([m], (p) => side(p) && (a.end[1] === 'top' ? p.y > cut : p.y < cut)); }
      else if (a.muscles) { const ms = a.muscles.map((n) => muscles.get(n)).filter(Boolean); if (ms.length) { const b = new THREE.Box3(); ms.forEach((m) => eachVertex(m, (p) => { if (side(p)) b.expandByPoint(p); })); const cut = a.top ? b.max.y - (b.max.y - b.min.y) * a.top : -1e9; c = centroid(ms, (p) => side(p) && p.y > cut); } }
      else if (a.bones) { const b = boxOf(a.bones.map((n) => bones.get(n))); if (!b.isEmpty()) c = b.getCenter(new THREE.Vector3()); }
      if (c && a.offset) c.add(new THREE.Vector3(a.offset[0] * rightSign, a.offset[1], a.offset[2]));
      r.pos = c; r.mirror = c && Math.abs(c.x) > 0.08 ? new THREE.Vector3(-c.x, c.y, c.z) : null;
    }
    hsEls.forEach((h) => { h.el.remove(); h.g.remove(); }); hsEls = [];
    for (const r of REGIONS) {
      if (!r.pos) continue;
      const elx = ui.el('button', 'hs tag', `<b>${r.name}</b>`); elx.style.display = 'none';
      const g = ui.el('div'), s1 = ui.el('i', 'ln'), s2 = ui.el('i', 'ln h'), dot = ui.el('i', 'dt'); g.append(s1, s2, dot); g.style.display = 'none'; lines.append(g);
      elx.onclick = () => select(r); elx.onpointerenter = () => { hsHover = r; refresh(); }; elx.onpointerleave = () => { if (hsHover === r) { hsHover = null; refresh(); } };
      hsRoot.append(elx); hsEls.push({ r, el: elx, g, s1, s2, dot, bw: 0, n: hsEls.filter((x) => x.r.group === r.group).length });
    }
    ready = true;
  }

  // ── الحالة ──
  let mode = 'muscle', hover = null, hsHover = null, sel = null, active = false, pending = null, vw = innerWidth;
  let rot = 0, rotT = 0, muscleFade = 1, muscleT = 1, skinA = 0, skinT = 0, hideCovered = false, coveredOn = true;
  const views = {
    muscle: { look: [0, 2.14, 0], dir: [0, 0.03, 1], fitW: 4.3, fitH: 4.5 },
    joint: { look: [0, 2.14, 0], dir: [0, 0.03, 1], fitW: 4.3, fitH: 4.5 },
    spine: { look: [0, 2.9, 0], dir: [0, 0.03, 1], fitW: 2.9, fitH: 2.4 },
  };
  const pickables = [];
  function setGroup(g, force) {
    if (g === mode && !force) return; mode = g; hover = null;
    muscleT = g === 'muscle' ? 1 : 0; skinT = g === 'muscle' ? 0 : 0.5; rotT = nearest(g === 'spine' ? Math.PI : 0);
    pickables.length = 0; (g === 'muscle' ? muscles : bones).forEach((m) => pickables.push(m));
    st.view = views[g]; hideCovered = g === 'muscle';
    hsEls.forEach((h) => { const v = active && h.r.group === g; h.el.style.display = h.g.style.display = v ? '' : 'none'; h.x = h.y = undefined; h.gone = h.cls = undefined; }); lines.style.display = active ? '' : 'none';
    seg.querySelectorAll('button[data-g]').forEach((b) => b.classList.toggle('on', b.dataset.g === g)); refresh();
  }
  const nearest = (a) => { const two = Math.PI * 2; let d = (a - rotT) % two; if (d > Math.PI) d -= two; if (d < -Math.PI) d += two; return rotT + d; };
  function refresh() { // أي المجسمات تضيء
    const r = hsHover || hover || sel; const set = r ? r.set : null; const also = sel && r !== sel ? sel.set : null;
    const k = r && r.group === 'joint' ? 0.4 : 1;
    for (const m of all) m.userData.tgt = set && set.has(m.name) ? k : also && also.has(m.name) ? 0.5 * k : 0;
  }
  function select(r) {
    if (!r || !r.pos) return; if (!ready) { pending = r.id; return; }
    setGroup(r.group); sel = r; refresh();
    rotT = nearest(r.back ? Math.PI - Math.sign(r.pos.x) * 0.25 : -Math.sign(r.pos.x) * 0.45);
    focusSize = r.id === 'jaw' ? 1.05 : r.group === 'muscle' || r.id === 'thoracic' ? 2.2 : r.id === 'sij' ? 1.25 : 1.55;
    ui.openPanel([P.tag(r.tag), P.title(r.name), P.lead(r.about),
      ...(r.parts ? [P.h('ممّ تتكون'), P.list(r.parts, 'wide')] : []),
      P.h('أشهر المشاكل والإصابات'), P.list(r.issues, Array.isArray(r.issues[0]) ? 'wide' : ''),
      ...(r.signs ? [P.h('علامات تحتاج تقييم'), P.chips(r.signs)] : []),
      r.alert ? P.alert(r.alert) : null,
      P.h('كيف نتعامل معها في إرث'), P.list(r.care, 'care'),
      P.note('المعلومات هنا للتثقيف، والتشخيص يكون بعد التقييم عند الأخصائي.'),
      P.cta(ui.button('احجز تقييمك', 'primary', () => ui.openBooking({ problem: `مشكلة في ${r.name}` })))],
    { onClose: (replaced) => { if (!replaced || sel === r) { sel = null; st.focus = null; refresh(); } }, leader: () => { const p = ctx.project(worldOf(r.pos), scr); return p.behind ? null : p; } });
  }
  let focusSize = 1.5; const sh = { r: 9, y: 9, f: -1, c: null, flip: true };
  const w = new THREE.Vector3(), scr = {}, scr2 = {}, camDir = new THREE.Vector3(), camRight = new THREE.Vector3();
  const worldOf = (p) => w.copy(p).applyMatrix4(body.matrixWorld);

  // ── أزرار القسم ──
  const seg = ui.el('div', 'seg glass');
  GROUPS.forEach(([g, label]) => { const b = ui.el('button', '', label); b.dataset.g = g; b.onclick = () => { ui.closePanel(); setGroup(g); }; seg.append(b); });
  const turn = ui.el('button', '', 'لفّ الجسم ↻'); turn.onclick = () => { rotT += Math.PI; }; seg.append(turn);

  const st = {
    id: 'body', group, pickables, fastPick: true, view: views.muscle, focus: null, tools: seg,
    resize() { vw = innerWidth; hsEls.forEach((h) => { h.bw = 0; }); },
    // ظل الجسم (مئات آلاف المثلثات) ينعاد رسمه بس لما الجسم يلف أو يتغير، مو كل فريم
    shadowDirty() {
      const r = body.rotation.y, y = group.position.y; if (Math.abs(r - sh.r) < 0.008 && y === sh.y && muscleFade === sh.f && coveredOn === sh.c) return false;
      if ((sh.flip = !sh.flip)) return false; sh.r = r; sh.y = y; sh.f = muscleFade; sh.c = coveredOn; return true;
    },
    selectLater(id) { pending = id; },
    select: (id) => select(REGIONS.find((x) => x.id === id)),
    enter() { active = true; setGroup(mode, true); if (pending && ready) { const id = pending; pending = null; setTimeout(() => select(REGIONS.find((x) => x.id === id)), 1700); } },
    leave() { active = false; hover = hsHover = sel = null; st.focus = null; refresh(); hsEls.forEach((h) => { h.el.style.display = h.g.style.display = 'none'; }); lines.style.display = 'none'; },
    resolve(hits) { // من المجسم اللي تحت المؤشر نعرف أي منطقة
      for (let i = 0; i < Math.min(hits.length, 4); i++) {
        const h = hits[i], name = h.object.name; w.copy(h.point).applyMatrix4(inv.copy(body.matrixWorld).invert());
        let best = null, bd = 1e9;
        for (const r of REGIONS) {
          if (r.group !== mode || !r.pos) continue; if (!(r.set.has(name) || (r.id === 'thoracic' && RIB.test(name)))) continue;
          const d = Math.min(w.distanceTo(r.pos), r.mirror ? w.distanceTo(r.mirror) : 1e9); if (d < bd) { bd = d; best = r; }
        }
        if (best) return { data: best, hit: h };
      }
      return null;
    },
    hover(r) { hover = r; refresh(); if (r) ui.showTip(r.name, r.tag, ctx.pointer.px, ctx.pointer.py); else ui.hideTip(); },
    click(r) { select(r); },
    drag(dx) { rotT += dx * 0.009; },
    update(dt, t, on) {
      rot = damp(rot, rotT, 5, dt); body.rotation.y = rot + Math.sin(t * 0.4) * 0.03; body.updateMatrixWorld(true);
      // إضاءة المناطق
      const pulse = 0.75 + Math.sin(t * 4) * 0.2;
      let dirty = false; for (let i = 0; i < NH; i++) { const e = hot[i], g = all[i].userData.tgt * pulse; if (Math.abs(e - g) > 0.002) { hot[i] = damp(e, g, 10, dt); dirty = true; } } if (dirty) hotTex.needsUpdate = true;
      const hr = hsHover || hover || sel; haloA = damp(haloA, hr && hr.pos ? 1 : 0, 8, dt);
      if (hr && hr.pos) { const sz = (hr.group === 'muscle' ? 0.9 : hr.group === 'spine' ? 0.5 : 0.62) * (1 + Math.sin(t * 4) * 0.08); halos[0].position.copy(hr.pos); halos[0].scale.setScalar(sz); halos[1].visible = !!hr.mirror; if (hr.mirror) { halos[1].position.copy(hr.mirror); halos[1].scale.setScalar(sz); } }
      halos[0].material.opacity = halos[1].material.opacity = haloA * 0.34;
      // ظهور واختفاء العضلات والجسم الزجاجي
      if (muscleMesh && Math.abs(muscleFade - muscleT) > 0.002) {
        muscleFade = damp(muscleFade, muscleT, 6, dt); if (Math.abs(muscleFade - muscleT) < 0.01) muscleFade = muscleT;
        muscleMesh.visible = muscleFade > 0; muscleMat.opacity = muscleFade;
      }
      const show = !(hideCovered && muscleMesh && muscleFade >= 1); if (show !== coveredOn) { coveredOn = show; if (coveredMesh) coveredMesh.visible = show; }
      if (skinMat) { skinA = damp(skinA, skinT, 4, dt); skinMat.uniforms.alpha.value = skinA; skin.visible = skinA > 0.01; }
      // تقريب الكاميرا على المنطقة المختارة
      if (sel) { worldOf(sel.pos); st.focus = { look: [w.x - group.position.x, w.y - group.position.y, w.z - group.position.z], dir: [0, 0.08, 1], fitW: focusSize * 0.9, fitH: focusSize }; }
      // نقاط المناطق
      if (on && active && ready) {
        camDir.copy(ctx.camera.position).sub(group.position); camDir.y = 0; camDir.normalize();
        const cur = hsHover || hover || sel, sp = ctx.stagePx, hide = ui.state.panelOpen, small = ctx.mobile();
        // كم بكسل يساوي المتر عند الجسم، ومنه نعرف وين نحط عمودي الأسماء
        camRight.setFromMatrixColumn(ctx.camera.matrixWorld, 0); w.copy(group.position); w.y += 2.2; const c0 = ctx.project(w, scr); w.addScaledVector(camRight, 1); const c1 = ctx.project(w, scr2);
        const ppu = Math.abs(c1.x - c0.x), cxp = c0.x, half = (mode === 'spine' ? 0.42 : 0.72) * ppu + (small ? 8 : 26);
        const L = [], R = [];
        for (const h of hsEls) {
          if (h.r.group !== mode) continue; const r = h.r;
          worldOf(r.pos); const p = ctx.project(w, scr); h.ax = p.x; h.ay = p.y; h.behind = p.behind;
          w.sub(group.position); w.y = 0; h.far = (w.length() > 0.06 ? w.normalize().dot(camDir) : 1) < -0.45 && r !== cur;
          if (mode === 'spine') h.right = !!(h.n % 2); else if (h.right === undefined || Math.abs(p.x - cxp) > 16) h.right = p.x > cxp;
          (h.right ? R : L).push(h);
        }
        const gap = small ? 30 : 42; spread(L, gap, sp.t + 26, sp.b - 22); spread(R, gap, sp.t + 26, sp.b - 22);
        for (const h of hsEls) {
          if (h.r.group !== mode) continue;
          if (!h.bw) h.bw = h.el.offsetWidth || 110; // العرض ينقاس مرة وحدة، مو كل فريم
          let tx = h.right ? cxp + half : cxp - half; tx = h.right ? Math.min(tx, vw - h.bw - 6) : Math.max(tx, h.bw + 6);
          h.x = h.x === undefined ? tx : damp(h.x, tx, 12, dt); h.y = h.y === undefined ? h.ty : damp(h.y, h.ty, 12, dt);
          const lx = Math.round(h.x * 2) / 2, ly = Math.round(h.y * 2) / 2;
          setT(h.el, `translate(${lx}px, ${ly}px) translate(${h.right ? '0' : '-100%'}, -50%)`);
          const gone = h.behind || hide; if (gone !== h.gone) { h.gone = gone; h.el.style.opacity = gone ? 0 : ''; h.el.style.pointerEvents = gone ? 'none' : ''; h.g.style.opacity = gone ? 0 : 1; }
          const cls = h.r === cur ? 'on' : h.far ? 'far' : ''; if (cls !== h.cls) { h.cls = cls; h.el.classList.toggle('far', cls === 'far'); h.el.classList.toggle('on', cls === 'on'); h.g.className = cls; }
          // الخط: من مكان المنطقة على الجسم إلى ركبة صغيرة ثم أفقي إلى الاسم. يتحرك بالتحويل فقط
          const ex = lx + (h.right ? -5 : 5), kx = ex + (h.right ? -17 : 17), dx = kx - h.ax, dy = ly - h.ay;
          setT(h.s1, `translate(${h.ax.toFixed(1)}px, ${h.ay.toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${(Math.hypot(dx, dy) / 100).toFixed(4)})`);
          setT(h.s2, `translate(${Math.min(kx, ex).toFixed(1)}px, ${ly}px)`); setT(h.dot, `translate(${h.ax.toFixed(1)}px, ${h.ay.toFixed(1)}px)`);
        }
      }
    },
    titleExtra(acts) {
      acts.append(ui.button('خدماتنا العلاجية', 'primary', () => ui.openPanel(ui.serviceNodes((id) => st.select(id)))), ui.button('احجز تقييمك', 'line', () => ui.openBooking()));
    },
  };
  if (ctx.assets.skin) { try { buildSkin(ctx.assets.skin); } catch (e) { console.warn('skin', e); } }
  build(); setGroup(mode, true);
  return st;
}
