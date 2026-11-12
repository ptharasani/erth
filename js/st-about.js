// من نحن: سبع بلّورات (نقطة الثاء من الشعار بشكل ثلاثي الأبعاد)، كل بلّورة تنفتح على جزء من هوية إرث.
import * as THREE from 'three';
import { crystal, setCrystalOpen, markPick, C, damp, clamp, easeBack, loadTexture } from './lib.js';
import { ABOUT } from './content.js';

export default function createAbout(ctx) {
  const { ui } = ctx, { P } = ui;
  const group = new THREE.Group(), pickables = [], items = [];
  const hsRoot = document.getElementById('hotspots');
  ABOUT.forEach((a, i) => {
    const g = crystal(1.15, i % 2 ? C.teal2 : C.purple2); g.userData.mat = g.userData.mat.clone(); g.userData.top.material = g.userData.bot.material = g.userData.mat;
    const it = { a, i, g, base: new THREE.Vector3(), hot: 0, open: 0, label: ui.el('div', 'hs crystal', `<b>${a.title}</b>`) };
    it.label.style.display = 'none'; hsRoot.append(it.label);
    markPick(g, it, pickables); group.add(g); items.push(it);
  });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.97), new THREE.MeshBasicMaterial({ map: loadTexture('assets/img/erth-mark.webp'), transparent: true, opacity: 0.09, depthWrite: false }));
  mark.position.set(0, 3.3, -3.2); group.add(mark);

  let hover = null, sel = null, active = false, cs = 1, inT = 9;
  const world = new THREE.Vector3(), scr = {};
  function layout() {
    const m = ctx.mobile(); cs = m ? 0.8 : 1;
    const rows = m ? [[-1.25, 1.25], [-2.3, 0, 2.3], [-1.25, 1.25]] : [[-4.5, -1.5, 1.5, 4.5], [-3.0, 0, 3.0]];
    const ys = m ? [6.3, 3.75, 1.2] : [4.75, 1.65]; let k = 0;
    rows.forEach((r, ri) => r.forEach((x) => { items[k].base.set(x, ys[ri], (k % 2) * -0.5); k++; }));
    st.view = m ? { look: [0, 3.55, 0], dir: [0, 0.03, 1], fitW: 6.6, fitH: 8.4 } : { look: [0, 2.85, 0], dir: [0.08, 0.03, 1], fitW: 12.0, fitH: 6.6 };
  }
  function open(it) {
    sel = it;
    const a = it.a, nodes = [P.tag('هوية إرث'), P.title(a.title)];
    if (a.img) nodes.push(P.img(a.img, 'من داخل مركز إرث'));
    if (a.lead) nodes.push(P.lead(a.lead));
    if (a.steps) nodes.push(ui.el('div', 'p-steps', a.steps.map((s) => `<span>${s}</span>`).join('')));
    (a.paras || []).forEach((p) => nodes.push(P.text(p)));
    if (a.values) nodes.push(ui.el('div', 'p-values', a.values.map(([b, t]) => `<div><b>${b}</b><span>${t}</span></div>`).join('')));
    if (a.quote) nodes.push(P.quote(a.quote));
    const nxt = items[(it.i + 1) % items.length];
    nodes.push(P.cta(ui.button(`التالي: ${nxt.a.title}`, 'ghost', () => open(nxt)), ui.button('احجز تقييمك', 'primary', () => ui.openBooking())));
    ui.openPanel(nodes, { onClose: (replaced) => { if (!replaced || sel === it) sel = null; }, leader: () => { it.g.getWorldPosition(world); const p = ctx.project(world, scr); return p.behind ? null : p; } });
  }
  const st = {
    id: 'about', group, pickables, view: null, resize: layout,
    enter() { active = true; inT = 0; items.forEach((it) => { it.label.style.display = ''; }); },
    leave() { active = false; sel = null; hover = null; items.forEach((it) => { it.label.style.display = 'none'; }); },
    update(dt, t, on) {
      inT += dt;
      for (const it of items) {
        const isSel = it === sel, dim = sel && !isSel, a0 = clamp((inT - 0.15 - it.i * 0.09) / 0.7, 0, 1), pop = a0 <= 0 ? 0.001 : easeBack(a0);
        it.hot = damp(it.hot, it === hover || isSel ? 1 : 0, 7, dt); it.open = damp(it.open, isSel ? 1 : 0, 5, dt);
        const g = it.g; g.position.set(it.base.x, it.base.y + Math.sin(t * 0.9 + it.i * 1.7) * 0.12, it.base.z + it.hot * 0.8);
        g.rotation.y += dt * (0.35 + it.hot * 1.6); g.scale.setScalar(cs * (1 + it.hot * 0.22) * (dim ? 0.82 : 1) * pop);
        setCrystalOpen(g, it.open); g.userData.mat.opacity = damp(g.userData.mat.opacity, dim ? 0.2 : 0.5 + it.hot * 0.2, 6, dt);
        g.userData.core.scale.setScalar(1 + it.hot * 0.5 + it.open * 0.8 + Math.sin(t * 2.4 + it.i) * 0.06); g.userData.core.scale.y *= 1.5;
        if (on && active) {
          world.set(g.position.x, g.position.y - 1.2 * g.scale.y - 0.12, g.position.z).add(group.position); const p = ctx.project(world, scr);
          it.label.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, 0)`; it.label.style.opacity = p.behind || ui.state.panelOpen && !isSel ? 0 : (dim ? 0.4 : 1) * a0;
          it.label.classList.toggle('on', it === hover || isSel);
        }
      }
    },
    hover(it) { hover = it; },
    click(it) { open(it); },
  };
  layout();
  return st;
}
