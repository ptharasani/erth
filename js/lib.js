// أدوات مشتركة: خامات، خلفية، منصات، حركة.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  night: 0xeef1f8, purple: 0x4953a1, purple2: 0x5f69bd, teal: 0x40b6b2, teal2: 0x2a9d98, ivory: 0xe9e2d2, white: 0xffffff, ink: 0x1b1f4b,
};
// على الخلفية الفاتحة اللون الأقوى من 1 يبهت ويضيع، فنثبته على لونه الصريح
export const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(Math.min(k, 1));

export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// خامة حافة ملونة (شكل زجاجي): على الفاتح تنرسم بلونها فوق الخلفية بدل ما تنضاف كضوء
export function rimMaterial({ a = C.purple2, b = C.teal2, power = 2.2, alpha = 0.9, boost = 1.4 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { cA: { value: new THREE.Color(a) }, cB: { value: new THREE.Color(b) }, power: { value: power }, alpha: { value: alpha }, boost: { value: boost } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 cA; uniform vec3 cB; uniform float power; uniform float alpha; uniform float boost; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), power); vec3 c = mix(cA, cB, f); gl_FragColor = vec4(c, f * alpha); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function glassMaterial(color = C.purple2, opacity = 0.5) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 0.05, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity, envMapIntensity: 1.1, side: THREE.DoubleSide, depthWrite: false, flatShading: true });
}

export const metal = (color = 0xdfe3ee, roughness = 0.2) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, envMapIntensity: 1.4 });
export const plastic = (color = 0xeef0f8, roughness = 0.4) => new THREE.MeshStandardMaterial({ color, metalness: 0.02, roughness, envMapIntensity: 0.9 });
export const rubber = (color = 0x15172a, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness, envMapIntensity: 0.5 });
export const glow = (color = C.teal, k = 1) => new THREE.MeshBasicMaterial({ color: hdr(color, k), toneMapped: false });

let _radial;
export function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  _radial = new THREE.CanvasTexture(c); return _radial;
}
let _diamond;
export function diamondTexture() {
  if (_diamond) return _diamond;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.translate(32, 32); g.rotate(Math.PI / 4); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.fillRect(-13, -13, 26, 26);
  _diamond = new THREE.CanvasTexture(c); return _diamond;
}

// أرضية ناعمة: بقعة فاتحة تذوب في الخلفية وتستقبل ظل المجسم
let _floor;
function floorTexture() {
  if (_floor) return _floor;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.8)'); gr.addColorStop(0.8, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); _floor = new THREE.CanvasTexture(c); _floor.colorSpace = THREE.SRGBColorSpace; return _floor;
}
export function softFloor(r = 3, color = 0xf3f4fb, opacity = 0.9) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 72), new THREE.MeshLambertMaterial({ color, map: floorTexture(), transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.renderOrder = -2; return m;
}
// منصة تحت كل مجسم: أرضية ناعمة وحلقة مضيئة رفيعة
export function podium(r = 2, color = C.teal) {
  const g = new THREE.Group();
  g.add(softFloor(r * 1.9));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.013, 8, 128), glow(color, 1)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012; g.add(ring);
  g.userData.ring = ring;
  return g;
}

// خلفية: كرة كبيرة بيضاء زجاجية، عليها هالات خفيفة بألوان إرث (بنفسجي وفيروزي) تتحرك ببطء
export function makeBackground() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float time; varying vec3 vP;
      float blob(vec3 d, vec3 c, float s){ return pow(max(dot(d, normalize(c)), 0.0), s); }
      void main(){ vec3 d = normalize(vP);
        vec3 col = mix(vec3(1.04,1.05,1.10), vec3(1.12,1.13,1.16), smoothstep(-0.6, 0.9, d.y));
        float t = time * 0.05;
        col = mix(col, vec3(0.70,0.74,1.10), 0.50 * blob(d, vec3(-0.8 + sin(t)*0.2, 0.25, -0.6), 5.0));
        col = mix(col, vec3(0.58,1.02,0.99), 0.46 * blob(d, vec3(0.85, -0.15 + cos(t*1.3)*0.15, -0.5), 6.0));
        col = mix(col, vec3(0.82,0.80,1.10), 0.30 * blob(d, vec3(0.1, 0.9, 0.4), 4.0));
        col = mix(col, vec3(0.74,1.02,1.02), 0.30 * blob(d, vec3(-0.3, -0.8, 0.5), 3.0));
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat); m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// غبار معيّنات (نقاط الثاء من شعار إرث) يطفو في كل العالم
export function makeDust(count, xMin, xMax) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const a = new THREE.Color(C.teal), b = new THREE.Color(C.purple2), t = new THREE.Color(), wh = new THREE.Color(0xffffff);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = xMin + Math.random() * (xMax - xMin); pos[i * 3 + 1] = -6 + Math.random() * 16; pos[i * 3 + 2] = -22 + Math.random() * 34;
    t.copy(a).lerp(b, Math.random()).lerp(wh, Math.random() * 0.35); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 0.11, map: diamondTexture(), vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, sizeAttenuation: true });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}

// نسيج من صورة مع تجهيز الألوان
const texLoader = new THREE.TextureLoader(); let texHook = null;
export function setTextureHook(fn) { texHook = fn; } // يرفع الصورة لكرت الشاشة أول ما تتحمل
export function loadTexture(url, onLoad) {
  const t = texLoader.load(url, (x) => { onLoad && onLoad(x); texHook && texHook(x); }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// رسم نص عربي على نسيج
export function textTexture(text, { size = 64, weight = 800, color = '#1b1f4b', w = 512, h = 128, bg = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = `${weight} ${size}px Alexandria, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + size * 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// نقطة الثاء من شعار إرث: معيّن مسطّح بحواف ناعمة وبألوان الهوية الصريحة (بدل البلّورات الزجاجية)
export function crystal(size = 1, tint = C.purple) {
  const g = new THREE.Group(), s = size * 0.9, flip = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.9, transparent: true, opacity: 1 });
  const tile = new THREE.Mesh(new RoundedBoxGeometry(s, s, size * 0.2, 4, size * 0.075), mat); tile.rotation.z = Math.PI / 4; tile.userData.noShadow = true;
  flip.add(tile); g.add(flip);
  g.userData = { flip, tile, mat, size, open: 0 };
  return g;
}
export function setCrystalOpen(g, v) { g.userData.flip.rotation.y = v * Math.PI; g.userData.open = v; } // v من 0 إلى 1: النقطة تلف نص لفة

// ── طبقة واضحة: عنصر HTML يركب فوق سطح ثلاثي الأبعاد ويتحرك معه، وينرسم بدقة الشاشة الكاملة ──
// (دقة المشهد ثلاثي الأبعاد تنزل على الأجهزة الضعيفة، فالصور والكلام داخل المشهد يتغبشوا. هنا ما يتأثروا)
const _adj = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
const _mm = (a, b) => { const c = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j]; return c; };
const _basis = (p) => { const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1], a = _adj(m), x = p[6], y = p[7], v0 = a[0] * x + a[1] * y + a[2], v1 = a[3] * x + a[4] * y + a[5], v2 = a[6] * x + a[7] * y + a[8]; return _mm(m, [v0, 0, 0, 0, v1, 0, 0, 0, v2]); };
export function crispLayer(ctx, cls = '') {
  const layer = document.createElement('div'); layer.className = 'crisp ' + cls; layer.style.display = 'none'; document.body.append(layer);
  const corner = new THREE.Vector3(), pts = new Array(8), pp = {}; let on = false;
  const api = {
    layer,
    add(el, w, h) { el.style.width = w + 'px'; el.style.height = h + 'px'; el.style.visibility = 'hidden'; layer.append(el); return { el, w, h, inv: _adj(_basis([0, 0, w, 0, 0, h, w, h])), on: false, bright: -1, z: -1 }; },
    off(o) { if (o.on) { o.on = false; o.el.style.visibility = 'hidden'; } return 0; },
    // يركّب العنصر على مستطيل نصف عرضه hw ونصف ارتفاعه hh في إحداثيات المجسم mesh، ويرجع عرضه على الشاشة
    place(o, mesh, hw, hh, z = 0, bright = 1) {
      mesh.updateWorldMatrix(true, false);
      for (let k = 0; k < 4; k++) { corner.set(k & 1 ? hw : -hw, k & 2 ? -hh : hh, z).applyMatrix4(mesh.matrixWorld); ctx.project(corner, pp); if (pp.behind) return api.off(o); pts[k * 2] = pp.x; pts[k * 2 + 1] = pp.y; }
      const w = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
      if ((pts[2] - pts[0]) * (pts[5] - pts[1]) - (pts[3] - pts[1]) * (pts[4] - pts[0]) < 4 || w < 8) return api.off(o); // معطي ظهره أو صغير مرة
      const t = _mm(_basis(pts), o.inv), q = 1 / t[8];
      o.el.style.transform = `matrix3d(${t[0] * q},${t[3] * q},0,${t[6] * q},${t[1] * q},${t[4] * q},0,${t[7] * q},0,0,1,0,${t[2] * q},${t[5] * q},0,1)`;
      const b = Math.round(bright * 50) / 50; if (b !== o.bright) { o.bright = b; o.el.style.filter = b >= 0.995 ? '' : `brightness(${b})`; }
      const zi = Math.round(w / 6); if (zi !== o.z) { o.z = zi; o.el.style.zIndex = zi; } // الأقرب فوق
      if (!o.on) { o.on = true; o.el.style.visibility = 'visible'; }
      return w;
    },
    show() { if (!on) { on = true; layer.style.display = ''; } },
    hide() { if (on) { on = false; layer.style.display = 'none'; } },
  };
  return api;
}
export function markPick(root, data, list) {
  root.traverse((o) => { if (o.isMesh) { o.userData.pick = data; list.push(o); } });
}

// دمج مجموعة مجسمات في مجسم واحد (بإحداثيات المجموعة الأم)، وكل رأس يحمل رقم مجسمه الأصلي userData.hi.
// مئات القطع تنرسم بأمر واحد، وقيم كل قطعة (إضاءة، حركة) تنقرا في الشيدر من جدول صغير حسب رقمها
export function mergeMeshes(list, inv, colors) {
  let nv = 0, ni = 0; for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const Pp = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), Id = new Float32Array(nv), Cc = colors ? new Float32Array(nv * 3) : null, I = new Uint32Array(ni);
  const mt = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(); let vo = 0, io = 0, hasN = true;
  for (const m of list) {
    const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal, idx = g.index, n = pos.count, c = m.userData.col;
    mt.copy(inv).multiply(m.matrixWorld); nm.getNormalMatrix(mt); const flip = mt.determinant() < 0; if (!nor) hasN = false;
    for (let i = 0; i < n; i++) {
      const o = (vo + i) * 3; v.fromBufferAttribute(pos, i).applyMatrix4(mt); Pp[o] = v.x; Pp[o + 1] = v.y; Pp[o + 2] = v.z;
      if (nor) { v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); Nn[o] = v.x; Nn[o + 1] = v.y; Nn[o + 2] = v.z; }
      Id[vo + i] = m.userData.hi; if (Cc) { Cc[o] = c.r; Cc[o + 1] = c.g; Cc[o + 2] = c.b; }
    }
    const cnt = idx ? idx.count : n;
    for (let k = 0; k < cnt; k += 3) { const a = idx ? idx.getX(k) : k, b = idx ? idx.getX(k + 1) : k + 1, d = idx ? idx.getX(k + 2) : k + 2; I[io + k] = vo + a; I[io + k + 1] = vo + (flip ? d : b); I[io + k + 2] = vo + (flip ? b : d); }
    vo += n; io += cnt;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); geo.setAttribute('aId', new THREE.BufferAttribute(Id, 1)); if (Cc) geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  geo.setIndex(new THREE.BufferAttribute(I, 1)); if (hasN) geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); else geo.computeVertexNormals();
  geo.computeBoundingSphere(); geo.computeBoundingBox(); return geo;
}

// التقاط سريع بالماوس للمجسمات الكبيرة: مثلثات كل مجسم في مصفوفة مسطحة تتجهز مرة واحدة، والاختبار بدون إنشاء كائنات.
// يرجّع أقرب نقطة لكل مجسم، مرتبة من الأقرب. (أسرع بمرات من الالتقاط العادي على مئات آلاف المثلثات)
const _inv = new THREE.Matrix4(), _sph = new THREE.Sphere(), _o = new THREE.Vector3();
function soup(mesh) {
  let s = mesh.userData.soup; if (s) return s;
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count; s = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { const i = idx ? idx.getX(k) : k; s[k * 3] = pos.getX(i); s[k * 3 + 1] = pos.getY(i); s[k * 3 + 2] = pos.getZ(i); }
  return (mesh.userData.soup = s);
}
export function fastPick(ray, meshes) {
  const hits = [], D = ray.direction, O = ray.origin;
  for (const m of meshes) {
    const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    _sph.copy(g.boundingSphere).applyMatrix4(m.matrixWorld); if (!ray.intersectsSphere(_sph)) continue;
    const e = _inv.copy(m.matrixWorld).invert().elements; _o.copy(O).applyMatrix4(_inv);
    const lx = e[0] * D.x + e[4] * D.y + e[8] * D.z, ly = e[1] * D.x + e[5] * D.y + e[9] * D.z, lz = e[2] * D.x + e[6] * D.y + e[10] * D.z, ox = _o.x, oy = _o.y, oz = _o.z;
    const s = soup(m), n = s.length; let best = Infinity;
    for (let k = 0; k < n; k += 9) {
      const ax = s[k], ay = s[k + 1], az = s[k + 2], e1x = s[k + 3] - ax, e1y = s[k + 4] - ay, e1z = s[k + 5] - az, e2x = s[k + 6] - ax, e2y = s[k + 7] - ay, e2z = s[k + 8] - az;
      const px = ly * e2z - lz * e2y, py = lz * e2x - lx * e2z, pz = lx * e2y - ly * e2x, det = e1x * px + e1y * py + e1z * pz; if (det > -1e-14 && det < 1e-14) continue;
      const f = 1 / det, tx = ox - ax, ty = oy - ay, tz = oz - az, u = (tx * px + ty * py + tz * pz) * f; if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (lx * qx + ly * qy + lz * qz) * f; if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * f; if (t > 1e-4 && t < best) best = t;
    }
    if (best < Infinity) hits.push({ object: m, distance: best, point: new THREE.Vector3().copy(O).addScaledVector(D, best) });
  }
  return hits.sort((a, b) => a.distance - b.distance);
}

// حلقة تتحرك بالسحب مع قصور ذاتي، وتوقف على أقرب عنصر. ما تدور لحالها إلا لو انطلب (idle)
export class Spinner {
  constructor(step = 0, idle = 0) { this.angle = 0; this.vel = 0; this.target = null; this.step = step; this.idle = idle; this.since = 9; }
  drag(dx) { const d = dx * 0.0042; this.angle += d; this.vel = d; this.target = null; this.since = 0; }
  to(a) { const two = Math.PI * 2; let d = (a - this.angle) % two; if (d > Math.PI) d -= two; if (d < -Math.PI) d += two; this.target = this.angle + d; }
  stepBy(n) { const base = this.target !== null ? this.target : Math.round(this.angle / this.step) * this.step; this.target = base + n * this.step; }
  update(dt, paused = false) {
    this.since += dt;
    if (this.target !== null) { this.angle = damp(this.angle, this.target, 5, dt); return; }
    if (this.since < 0.08) return; // لسه يسحب
    if (Math.abs(this.vel) > 0.0006) { this.angle += this.vel * Math.min(1.5, dt * 60); this.vel *= Math.exp(-dt * 4.2); }
    else if (this.step) this.target = Math.round(this.angle / this.step) * this.step;
    else if (!paused) this.angle += this.idle * dt;
  }
}
