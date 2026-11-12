// مسار رسم خفيف: المشهد ينرسم مرة واحدة في هدف واحد (مع تنعيم الحواف)، التوهج على دقة صغيرة،
// ثم مرور واحد أخير للشاشة يجمع التوهج وتعتيم الأطراف والحبيبات. دقة المشهد تتغير لحالها حسب سرعة الجهاز.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const TAPS = 'vec2 o = px; vec3 a = texture2D(tex, vUv + vec2(-o.x, -o.y)).rgb, b = texture2D(tex, vUv + vec2(o.x, -o.y)).rgb, c = texture2D(tex, vUv + vec2(-o.x, o.y)).rgb, d = texture2D(tex, vUv + vec2(o.x, o.y)).rgb;';
const mat = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

export function createPost(renderer, { samples = 4, strength = 0.16, threshold = 1.0, bloom = true, vignette = [0.42, 0.42, 0.42], grain = 0.012 } = {}) {
  const gl = renderer.getContext(), quad = new FullScreenQuad(null);
  const rt = (s = 0, depth = false) => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: s, depthBuffer: depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  let sceneRT = rt(samples, true); const L = [0, 1, 2, 3, 4, 5].map(() => rt()); let levels = L.length, sw = 4, sh = 4;

  // السطوع: ناخذ بس اللي أقوى من الحد (الأجزاء المضيئة)، ونصغّر للنص
  const pre = mat(`uniform sampler2D tex; uniform vec2 px; uniform float thr; varying vec2 vUv;
    vec3 hi(vec3 c){ return c * smoothstep(thr, thr + 0.1, dot(c, vec3(0.2126, 0.7152, 0.0722))); }
    void main(){ ${TAPS} gl_FragColor = vec4(min((hi(a) + hi(b) + hi(c) + hi(d)) * 0.25, vec3(16.0)), 1.0); }`, { tex: { value: null }, px: { value: new THREE.Vector2() }, thr: { value: threshold } });
  const down = mat(`uniform sampler2D tex; uniform vec2 px; varying vec2 vUv; void main(){ ${TAPS} gl_FragColor = vec4((a + b + c + d) * 0.25, 1.0); }`, { tex: { value: null }, px: { value: new THREE.Vector2() } });
  const up = mat(`uniform sampler2D tex; uniform vec2 px; varying vec2 vUv;
    void main(){ vec3 s = texture2D(tex, vUv).rgb * 4.0;
      s += (texture2D(tex, vUv + vec2(px.x, 0.0)).rgb + texture2D(tex, vUv - vec2(px.x, 0.0)).rgb + texture2D(tex, vUv + vec2(0.0, px.y)).rgb + texture2D(tex, vUv - vec2(0.0, px.y)).rgb) * 2.0;
      s += texture2D(tex, vUv + px).rgb + texture2D(tex, vUv - px).rgb + texture2D(tex, vUv + vec2(px.x, -px.y)).rgb + texture2D(tex, vUv + vec2(-px.x, px.y)).rgb;
      gl_FragColor = vec4(s / 16.0, 1.0); }`, { tex: { value: null }, px: { value: new THREE.Vector2() } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });
  // المرور الأخير: يجمع المشهد والتوهج، يعتّم الأطراف، يضيف حبيبات خفيفة، ثم يحوّل الألوان للشاشة
  const fin = mat(`uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float time; uniform vec3 uVig; uniform float uGrain; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
      vec2 d = vUv - 0.5; c *= mix(uVig, vec3(1.0), smoothstep(0.95, 0.3, length(d * vec2(1.0, 1.2))));
      float n = fract(sin(dot(gl_FragCoord.xy + time * 61.0, vec2(12.9898, 78.233))) * 43758.5453); c += (n - 0.5) * uGrain;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: strength }, time: { value: 0 }, uVig: { value: new THREE.Vector3(...vignette) }, uGrain: { value: grain } }, { toneMapped: true });

  // قياس وقت كرت الشاشة الفعلي لكل فريم (لو المتصفح يدعمه)
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), pending = []; let cur = null;
  const api = {
    bloom, gpuMs: 0, hasTimer: !!ext, onSample: null,
    get width() { return sw; }, get height() { return sh; }, get samples() { return samples; }, fin,
    setSize(w, h) {
      w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h)); if (w === sw && h === sh) return; sw = w; sh = h; sceneRT.setSize(w, h);
      levels = 0; for (let i = 0; i < L.length; i++) { const lw = w >> (i + 1), lh = h >> (i + 1); if (Math.min(lw, lh) < 6 && i > 1) break; L[i].setSize(Math.max(2, lw), Math.max(2, lh)); levels++; }
    },
    setSamples(n) { if (n === samples) return; samples = n; sceneRT.dispose(); sceneRT = rt(n, true); sceneRT.setSize(sw, sh); },
    poll() {
      while (pending.length) {
        const q = pending[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { api.gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; api.onSample && api.onSample(api.gpuMs); }
        gl.deleteQuery(q);
      }
    },
    render(scene, camera, over, time) {
      if (ext) { api.poll(); if (pending.length < 4) { cur = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, cur); } }
      renderer.autoClear = true; renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
      renderer.autoClear = false;
      if (over) { renderer.clearDepth(); renderer.render(over.scene, over.camera); }
      if (api.bloom && levels > 1) {
        quad.material = pre; pre.uniforms.tex.value = sceneRT.texture; pre.uniforms.px.value.set(1 / sw, 1 / sh); renderer.setRenderTarget(L[0]); quad.render(renderer);
        quad.material = down;
        for (let i = 1; i < levels; i++) { down.uniforms.tex.value = L[i - 1].texture; down.uniforms.px.value.set(1 / L[i - 1].width, 1 / L[i - 1].height); renderer.setRenderTarget(L[i]); quad.render(renderer); }
        quad.material = up;
        for (let i = levels - 2; i >= 0; i--) { up.uniforms.tex.value = L[i + 1].texture; up.uniforms.px.value.set(1 / L[i + 1].width, 1 / L[i + 1].height); renderer.setRenderTarget(L[i]); quad.render(renderer); }
      }
      quad.material = fin; fin.uniforms.tScene.value = sceneRT.texture; fin.uniforms.tBloom.value = L[0].texture; fin.uniforms.uBloom.value = api.bloom && levels > 1 ? strength : 0; fin.uniforms.time.value = time;
      renderer.setRenderTarget(null); quad.render(renderer);
      renderer.autoClear = true;
      if (cur) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(cur); cur = null; }
    },
  };
  return api;
}
