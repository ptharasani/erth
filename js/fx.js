// الانتقال بين الأقسام: المجسمات نفسها تطلع وتدخل (في main.js)، وهنا فقرة حقيقية من العمود الفقري
// تمر في نص المسرح ومعها رقم القسم واسمه. ما في أي غطاء على الشاشة: الخلفية تبقى ظاهرة طول الوقت.
import * as THREE from 'three';
import { C, hdr, clamp, easeOut, radialTexture } from './lib.js';
import { vert } from './content.js';

const ORDER = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 'l1', 'l2', 'l3', 'l4', 'l5'];
const PICK = ['c3', 'c5', 'c7', 't3', 't6', 't9', 't12', 'l2', 'l4']; // فقرة لكل قسم
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const OUT = 0.46, IN = 0.8; // ثواني: خروج القسم الحالي، ودخول القسم الجديد

// نلقى فتحة الفقرة: نسقط كل مثلثاتها على مستوى عمودي على اتجاه العمود، والفراغ المحاط بالعظم هو القناة
function analyse(mesh, T) {
  const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index, n = pos.count, v = new THREE.Vector3(), c = new THREE.Vector3();
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; c.add(v); }
  c.multiplyScalar(1 / n);
  const U = new THREE.Vector3().crossVectors(T, new THREE.Vector3(0, 0, 1)).normalize(), V = new THREE.Vector3().crossVectors(U, T).normalize(), Wv = new THREE.Vector3().crossVectors(U, V);
  const a = new Float32Array(n), b = new Float32Array(n); let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (let i = 0; i < n; i++) { const x = P[i * 3] - c.x, y = P[i * 3 + 1] - c.y, z = P[i * 3 + 2] - c.z; a[i] = x * U.x + y * U.y + z * U.z; b[i] = x * V.x + y * V.y + z * V.z; a0 = Math.min(a0, a[i]); a1 = Math.max(a1, a[i]); b0 = Math.min(b0, b[i]); b1 = Math.max(b1, b[i]); }
  const N = 84, cell = Math.max(a1 - a0, b1 - b0) / (N - 4), ox = a0 - cell * 2, oy = b0 - cell * 2, g = new Uint8Array(N * N);
  const tri = idx ? idx.count / 3 : n / 3, I = (k) => (idx ? idx.getX(k) : k);
  for (let t = 0; t < tri; t++) {
    const i0 = I(t * 3), i1 = I(t * 3 + 1), i2 = I(t * 3 + 2), x0 = a[i0], y0 = b[i0], x1 = a[i1], y1 = b[i1], x2 = a[i2], y2 = b[i2];
    const cx0 = Math.max(0, Math.floor((Math.min(x0, x1, x2) - ox) / cell)), cx1 = Math.min(N - 1, Math.floor((Math.max(x0, x1, x2) - ox) / cell));
    const cy0 = Math.max(0, Math.floor((Math.min(y0, y1, y2) - oy) / cell)), cy1 = Math.min(N - 1, Math.floor((Math.max(y0, y1, y2) - oy) / cell));
    const d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(d) < 1e-14) { for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) g[y * N + x] = 1; continue; }
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      if (g[y * N + x]) continue; const px = ox + (x + 0.5) * cell, py = oy + (y + 0.5) * cell;
      const w1 = ((px - x0) * (y2 - y0) - (x2 - x0) * (py - y0)) / d, w2 = ((x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)) / d;
      if (w1 >= -0.08 && w2 >= -0.08 && w1 + w2 <= 1.08) g[y * N + x] = 1;
    }
  }
  // الفراغ الخارجي
  const stack = []; const push = (x, y) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const k = y * N + x; if (g[k]) return; g[k] = 2; stack.push(k); };
  for (let i = 0; i < N; i++) { push(i, 0); push(i, N - 1); push(0, i); push(N - 1, i); }
  while (stack.length) { const k = stack.pop(), x = k % N, y = (k - x) / N; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  // أكبر فراغ محاط = القناة
  let best = null;
  for (let k0 = 0; k0 < N * N; k0++) {
    if (g[k0]) continue; const comp = []; g[k0] = 3; const st2 = [k0];
    while (st2.length) { const k = st2.pop(), x = k % N, y = (k - x) / N; comp.push(k); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const q = ny * N + nx; if (!g[q]) { g[q] = 3; st2.push(q); } } }
    if (!best || comp.length > best.length) best = comp;
  }
  if (!best || best.length < 10) return null;
  // النقطة الأبعد عن العظم داخل الفراغ (مركز أكبر دائرة)
  const occ = []; for (let k = 0; k < N * N; k++) if (g[k] === 1) occ.push(k);
  let hu = 0, hv = 0, r = 0;
  for (const k of best) { const x = k % N, y = (k - x) / N; let m = 1e9; for (const q of occ) { const qx = q % N, qy = (q - qx) / N, dd = (qx - x) * (qx - x) + (qy - y) * (qy - y); if (dd < m) m = dd; } if (m > r) { r = m; hu = x; hv = y; } }
  r = (Math.sqrt(r) - 0.75) * cell; if (r <= 0) return null;
  const ua = ox + (hu + 0.5) * cell, vb = oy + (hv + 0.5) * cell; let outer = 0;
  for (let i = 0; i < n; i++) outer = Math.max(outer, Math.hypot(a[i] - ua, b[i] - vb));
  return { center: c.clone().addScaledVector(U, ua).addScaledVector(V, vb), U, V, W: Wv, r, outer: outer / r };
}

export function createFx({ skeleton, scene, textEl }) {
  const fxScene = new THREE.Scene(); fxScene.environment = scene.environment; fxScene.environmentIntensity = 0.5;
  const cam = new THREE.PerspectiveCamera(38, 1, 0.03, 400);
  const key = new THREE.DirectionalLight(0xfff6ea, 2.0); key.position.set(4, 5, 5);
  const rim = new THREE.DirectionalLight(C.teal, 1.2); rim.position.set(-4, 1, -6);
  fxScene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xc4c9e6, 1.4));

  // الفقرات: كل قسم له فقرته
  const boneMat = new THREE.MeshPhysicalMaterial({ color: 0xd2c6ad, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, transparent: true });
  const centers = ORDER.map((code) => { const m = skeleton.getObjectByName(vert(code)); return m ? new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position).applyMatrix4(m.matrix).getCenter(new THREE.Vector3()) : null; });
  const objs = PICK.map((code) => {
    const k = ORDER.indexOf(code), src = skeleton.getObjectByName(vert(code)), up = centers[Math.max(0, k - 1)], dn = centers[Math.min(ORDER.length - 1, k + 1)];
    if (!src || !up || !dn) return null;
    let info = null; try { info = analyse(src, new THREE.Vector3().subVectors(up, dn).normalize()); } catch (e) { console.warn('fx', e); }
    if (!info) return null;
    const mesh = src.clone(); mesh.material = boneMat; mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = 3; mesh.frustumCulled = false;
    const inner = new THREE.Group(); inner.matrixAutoUpdate = false;
    inner.matrix.makeScale(1 / info.r, 1 / info.r, 1 / info.r).multiply(new THREE.Matrix4().makeBasis(info.U, info.V, info.W).transpose()).multiply(new THREE.Matrix4().makeTranslation(-info.center.x, -info.center.y, -info.center.z));
    inner.add(mesh);
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: hdr(C.teal, 1), transparent: true, opacity: 0, depthWrite: false, depthTest: false })); glowS.position.z = -4; glowS.renderOrder = 2;
    const obj = new THREE.Group(); obj.add(inner, glowS); obj.userData = { outer: Math.min(info.outer, 9), glow: glowS }; glowS.scale.setScalar(obj.userData.outer * 3.2); obj.visible = false; fxScene.add(obj); return obj;
  });
  const fallback = objs.find(Boolean) || null;

  let W = 1, H = 1, tanH = 0.34, t = 0, active = false, obj = null, dir = 1; const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, T = OUT + IN;
  const setText = (o, sc) => { if (!textEl) return; textEl.style.opacity = o; textEl.style.transform = `scale(${sc})`; };
  const api = {
    scene: fxScene, camera: cam,
    get active() { return active; },
    showAll(v) { objs.forEach((o) => { if (o) o.visible = v; }); },
    resize(w, h, fov) { W = w; H = h; cam.aspect = w / h; cam.fov = fov; cam.updateProjectionMatrix(); tanH = Math.tan(THREE.MathUtils.degToRad(fov) / 2); },
    play(i, isBack) { obj = reduced ? null : objs[i] || fallback; dir = isBack ? -1 : 1; t = 0; active = true; api.update(0); },
    update(dt) {
      if (!active) return; t += dt; const p = clamp(t / T, 0, 1);
      // الرقم والاسم يظهروا والقسم القديم يطلع، ويختفوا والجديد يدخل
      setText(smoothstep(0.12, 0.36, p) * (1 - smoothstep(0.58, 0.8, p)), 0.94 + 0.06 * p);
      if (obj) {
        const u = obj.userData, zFit = u.outer / (tanH * Math.min(W / H, 1)), a = easeOut(clamp(p / 0.42, 0, 1)), b = smoothstep(0.55, 1, p);
        const z = -zFit * (5.2 - 1.9 * a + 2.4 * b), op = smoothstep(0, 0.16, p) * (1 - smoothstep(0.66, 0.98, p));
        // تجي من الجهة اللي جاي منها القسم، توقف فوق الاسم لحظة وهي تلف، ثم تكمل طريقها
        obj.position.set(dir * (1 - a) * -0.5 * tanH * (W / H) * Math.abs(z) + dir * b * 0.45 * tanH * (W / H) * Math.abs(z), 0.2 * tanH * Math.abs(z), z);
        obj.rotation.set(0.5 - 0.25 * a, dir * (-1.1 * (1 - a) + 1.3 * b) + (p - 0.5) * 0.5, dir * 0.3 * (1 - a));
        obj.visible = op > 0.004; boneMat.opacity = op; u.glow.material.opacity = op * 0.16;
      }
      if (t >= T) { active = false; if (obj) obj.visible = false; setText(0, 1); }
    },
  };
  return api;
}
