// تواصل واحجز: شعار إرث كبير وأيقونات مجسمة، كل أيقونة تودّيك مباشرة للقناة.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, damp, hdr, loadTexture, textTexture, podium, crystal } from './lib.js';
import { CONTACT } from './content.js';

// رسم رمز كل قناة على نسيج
const GLYPH = {
  handset(g, s = 1) { g.lineWidth = 30 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(128 - 52 * s, 128 - 58 * s); g.quadraticCurveTo(128 - 40 * s, 128 + 40 * s, 128 + 58 * s, 128 + 52 * s); g.stroke(); g.lineWidth = 46 * s; g.beginPath(); g.moveTo(128 - 56 * s, 128 - 60 * s); g.lineTo(128 - 50 * s, 128 - 44 * s); g.moveTo(128 + 44 * s, 128 + 50 * s); g.lineTo(128 + 60 * s, 128 + 56 * s); g.stroke(); },
  whatsapp(g) { g.lineWidth = 16; g.beginPath(); g.arc(128, 122, 84, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(62, 176); g.lineTo(40, 222); g.lineTo(96, 200); g.closePath(); g.fill(); GLYPH.handset(g, 0.55); },
  phone(g) { GLYPH.handset(g, 1); },
  instagram(g) { g.lineWidth = 18; g.beginPath(); g.roundRect(44, 44, 168, 168, 46); g.stroke(); g.beginPath(); g.arc(128, 128, 42, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(178, 78, 12, 0, Math.PI * 2); g.fill(); },
  youtube(g) { g.beginPath(); g.roundRect(30, 62, 196, 132, 40); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(106, 96); g.lineTo(166, 128); g.lineTo(106, 160); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over'; },
  email(g) { g.lineWidth = 18; g.lineJoin = 'round'; g.beginPath(); g.roundRect(34, 62, 188, 132, 16); g.stroke(); g.beginPath(); g.moveTo(40, 72); g.lineTo(128, 140); g.lineTo(216, 72); g.stroke(); },
  pin(g) { g.beginPath(); g.arc(128, 102, 62, Math.PI * 0.92, Math.PI * 0.08); g.lineTo(128, 226); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(128, 102, 24, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; },
};
function glyphTexture(name) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = g.fillStyle = '#fff'; GLYPH[name](g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const CHANNELS = [
  { id: 'whatsapp', label: 'واتساب', value: CONTACT.phoneDisplay, color: 0x25d366, href: `https://wa.me/${CONTACT.whatsapp}` },
  { id: 'phone', label: 'اتصال', value: CONTACT.phoneDisplay, color: C.teal, href: CONTACT.phoneHref, self: true },
  { id: 'instagram', label: 'انستقرام', value: CONTACT.instagramHandle, color: 0xe1306c, href: CONTACT.instagram },
  { id: 'youtube', label: 'يوتيوب', value: 'بودكاست إرث', color: 0xff3b30, href: CONTACT.youtube },
  { id: 'pin', label: 'الموقع', value: 'جدة، حي النزهة', color: C.purple2, href: CONTACT.maps },
  { id: 'email', label: 'ايميل', value: CONTACT.email, color: 0xf0a23a, href: `mailto:${CONTACT.email}`, self: true },
];

export default function createContact(ctx) {
  const { ui } = ctx;
  const group = new THREE.Group(), pickables = [], items = [];
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.82), new THREE.MeshBasicMaterial({ map: loadTexture('assets/img/erth-logo.webp'), transparent: true, depthWrite: false })); group.add(logo);
  const gems = [0, 1, 2].map((i) => { const g = crystal(0.36, i === 1 ? C.teal2 : C.purple2); group.add(g); return g; });
  group.add(podium(4.2, C.teal));
  const geo = new RoundedBoxGeometry(1.2, 1.2, 0.34, 5, 0.17);
  CHANNELS.forEach((ch, i) => {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x2a3180, metalness: 0.35, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, emissive: ch.color, emissiveIntensity: 0.12, envMapIntensity: 1.6 });
    const tok = new THREE.Mesh(geo, mat), holder = new THREE.Group(); holder.add(tok);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.74), new THREE.MeshBasicMaterial({ map: glyphTexture(ch.id), transparent: true, depthWrite: false, color: hdr(0xffffff, 1.25), toneMapped: false })); gl.position.z = 0.176; tok.add(gl);
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshBasicMaterial({ map: textTexture(ch.label, { size: 70, w: 512, h: 128 }), transparent: true, depthWrite: false })); lb.position.y = -0.95; holder.add(lb);
    const it = { ch, i, holder, tok, mat, base: new THREE.Vector3(), k: 0 }; tok.userData.pick = it; gl.userData.pick = it; pickables.push(tok); group.add(holder); items.push(it);
  });
  let hover = null;
  function layout() {
    const m = ctx.mobile();
    if (m) { items.forEach((it, i) => it.base.set((i % 3 - 1) * 1.75, 3.35 - Math.floor(i / 3) * 2.0, 0.6)); logo.position.set(0, 6.05, -0.4); logo.scale.setScalar(0.92); st.view = { look: [0, 3.95, 0], dir: [0, 0.03, 1], fitW: 5.6, fitH: 8.0 }; }
    else { items.forEach((it, i) => { const th = (i - 2.5) * 0.3; it.base.set(Math.sin(th) * 6, 1.55, Math.cos(th) * 6 - 5.2); }); logo.position.set(0, 4.55, -0.9); logo.scale.setScalar(0.92); st.view = { look: [0, 3.05, 0], dir: [0, 0.05, 1], fitW: 10.4, fitH: 6.5 }; }
  }
  const st = {
    id: 'contact', group, pickables, view: null, resize: layout,
    leave() { hover = null; },
    update(dt, t) {
      for (const it of items) {
        it.k = damp(it.k, it === hover ? 1 : 0, 8, dt);
        it.holder.position.set(it.base.x, it.base.y + Math.sin(t * 1.1 + it.i) * 0.07 + it.k * 0.18, it.base.z + it.k * 0.5);
        it.tok.rotation.y = Math.sin(t * 0.6 + it.i * 0.9) * 0.22 * (1 - it.k) + it.k * Math.sin(t * 3) * 0.08; it.tok.rotation.x = Math.sin(t * 0.5 + it.i) * 0.08 * (1 - it.k);
        it.holder.scale.setScalar(1 + it.k * 0.16); it.mat.emissiveIntensity = 0.12 + it.k * 1.1;
      }
      const lp = logo.position; gems.forEach((g, i) => { const a = t * 0.4 + (i / 3) * Math.PI * 2; g.position.set(lp.x + Math.cos(a) * 2.2, lp.y + Math.sin(a * 1.3) * 0.5, lp.z + Math.sin(a) * 0.9); g.rotation.y = t + i; });
      logo.position.y += Math.sin(t * 0.8) * 0.0015;
    },
    hover(it) { hover = it; if (it) ui.showTip(it.ch.label, it.ch.value, ctx.pointer.px, ctx.pointer.py); else ui.hideTip(); },
    click(it) { ui.openLink(it.ch.href); },
    titleExtra(acts, title) {
      acts.append(ui.button('احجز الآن', 'primary', () => ui.openBooking()));
      const list = ui.el('div', 't-list', `
        <a href="${CONTACT.phoneHref}"><b>هاتف التواصل</b><span dir="ltr">${CONTACT.phoneDisplay}</span></a>
        <a href="mailto:${CONTACT.email}"><b>ايميل</b><span dir="ltr">${CONTACT.email}</span></a>
        <a href="${CONTACT.maps}" target="_blank" rel="noopener"><b>الموقع</b><span>${CONTACT.address}</span></a>
        <a class="credit" href="assets/models/ATTRIBUTION.md" target="_blank" rel="noopener">المجسمات التشريحية: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan</a>`);
      title.querySelector('#hint').before(list);
    },
  };
  layout();
  return st;
}
