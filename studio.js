/* Studio section. Put this file next to index.html and add, just before </body>:  <script src="studio.js"></script>
   It fills #processPanel the first time "Studio" is opened and uses the same slides/ pictures as the home page. */
(() => {
const panel = document.getElementById('processPanel'); if (!panel) return;
const $ = s => panel.querySelector(s), clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const MODES = ['multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'luminosity'];
const mb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hs = (s, n) => (Math.imul(s ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n + 1, 0xc2b2ae35)) >>> 0;

/* ===== The seed: every variable is one axis of a low-discrepancy (Kronecker) sequence, so each press of "generate" lands in a
   part of the 14-dimensional space the earlier ones have not covered, instead of clustering like plain random numbers do ===== */
const D = 14; let phi = 2; for (let i = 0; i < 40; i++) phi = Math.pow(1 + phi, 1 / (D + 1));
const AL = Array.from({ length: D }, (_, j) => Math.pow(1 / phi, j + 1)), base = (Math.random() * 4294967296) >>> 0;
const S0 = (() => { const r = mb(base); return Array.from({ length: D }, r); })(), R2 = [.7548776662466927, .5698402909980532];   // R2: the same idea in 2D, spreads the simulated clicks over the whole image
let K = 0, V;
function vary() {
  const u = j => (S0[j] + K * AL[j]) % 1, seed = hs(base, K), r = mb(hs(seed, 777));
  const N = 2 + Math.floor(u(9) * 9), gap = 2500 + u(12) * 9000, taps = []; let t = 2000 + r() * 6000;   // the simulated hand: 2 to 10 clicks
  for (let i = 0; i < N; i++) {
    let x = (u(10) + i * R2[0]) % 1, y = (u(11) + i * R2[1]) % 1;
    if (i >= 2 && r() < u(13) * .5) { const p = taps[Math.floor(r() * i)]; x = (p.x + .5) / 100; y = (p.y + .5) / 100; }   // sometimes it returns to an earlier spot, which lets that lock go
    taps.push({ t: Math.round(t), x: Math.round(clamp(x, .03, .97) * 99), y: Math.round(clamp(y, .03, .97) * 99) }); t += gap * (.6 + .8 * r());
  }
  const p = Math.floor(u(8) * 6);
  return { seed, speed: u(0), intensity: u(1), amount: u(2), holdMax: u(3) * 3000, tol: 8 + 92 * u(4), lockHold: 2000 + 18000 * u(5), release: 800 + 3200 * u(6), hover: .3 + 1.2 * u(7), pal: [MODES[p], MODES[(p + 1) % 6], MODES[(p + 3) % 6]], taps };
}

/* ===== Engine ===== */
let built = false, cv, ctx, W = 0, H = 0, srcs = [], A, B, C, clean, idx = 0, n = 0, ph = 'hold', pt = 0, dur = 1, hold = 0, mode = 'multiply', amt = .7, vt = 0, tp = 0, layers = [], last = 0, run = false, raf = 0;
const eff = { energy: 0, speed: 0, pulse: 0, live: .7, tgt: .7, e: 0, seen: -1e9, lx: 0, ly: 0, lt: 0, nr: 0 };
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
function fitC(im) { const c = mk(), k = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k; c.getContext('2d').drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return c; }
function blend() { C = mk(); const c = C.getContext('2d'); c.drawImage(A, 0, 0); c.globalCompositeOperation = mode; c.drawImage(B, 0, 0); }
function size() {
  const r = cv.getBoundingClientRect(); if (!r.width) return false;
  const d = Math.min(devicePixelRatio || 1, 1100 / Math.max(r.width, r.height)), w = Math.round(r.width * d), h = Math.round(r.height * d);
  if (w === W && h === H) return true;
  W = cv.width = w; H = cv.height = h; clean = mk();
  layers.forEach(l => { const c = mk(); c.getContext('2d').drawImage(l.c, 0, 0, W, H); l.c = c; });
  if (A) { A = fitC(srcs[idx].im); B = fitC(srcs[(idx + 1) % srcs.length].im); blend(); }
  return true;
}
function begin() {   // the draws for transition n come only from the seed
  const r = mb(hs(V.seed, n));
  dur = (9000 - V.speed * 7000) * (.75 + .5 * r()); hold = r() < .5 ? 0 : r() * V.holdMax; mode = V.pal[Math.floor(r() * 3)]; amt = .3 + .7 * (V.amount * .7 + .3 * r());
  ph = 'hold'; pt = 0; B = fitC(srcs[(idx + 1) % srcs.length].im); blend();
}
function restart() {
  if (!built || !srcs.length || !size()) return;
  vt = 0; tp = 0; n = 0; layers = []; idx = V.seed % srcs.length; A = fitC(srcs[idx].im); begin();
}
function render(c, e) {
  const p = ph === 'dis' ? clamp(pt / dur) : 0, s = p * p * (3 - 2 * p);
  c.globalAlpha = 1; c.drawImage(A, 0, 0); if (s <= 0) return;
  c.globalAlpha = s; c.drawImage(B, 0, 0);
  const a = amt + (eff.live - amt) * e, edge = Math.min(1, s / .08, (1 - s) / .08), k = V.intensity * 1.1 * (1 + .5 * e), fl = .42 * e;
  c.globalAlpha = Math.min(1, a * (fl + (1 - fl) * Math.sin(Math.PI * s)) * edge * k); c.drawImage(C, 0, 0); c.globalAlpha = 1;
}
function step(dt) {
  vt += dt;
  while (tp < V.taps.length && V.taps[tp].t <= vt) { tap(V.taps[tp].x, V.taps[tp].y); eff.pulse = 1; tp++; }   // the simulated hand
  pt += dt;
  if (ph === 'hold') { if (pt >= hold) { ph = 'dis'; pt = 0; } }
  else if (pt >= dur) { idx = (idx + 1) % srcs.length; A = B; n++; begin(); }
}
function hover(now, dt) {   // the visitor's hover and pointer speed push the blend strength live
  const here = now - eff.seen < 500;
  eff.energy += ((here ? 1 : 0) - eff.energy) * (1 - Math.exp(-dt / (here ? 60 : 450)));
  eff.speed *= Math.exp(-dt / 250); eff.pulse *= Math.exp(-dt / 700);
  const ag = Math.min(1, eff.speed / 700);
  if (now >= eff.nr) { eff.tgt = .2 + Math.random() * .8; eff.nr = now + 240 / (1 + ag * 2.2); }
  eff.live += (eff.tgt - eff.live) * Math.min(.9, (.28 + ag * .25) * dt / 16);
  eff.e = clamp((eff.energy * .14 + ag * .95 + eff.pulse) * V.hover);
}
function drawLayers() {
  layers = layers.filter(l => { const age = vt - l.b; if (age > l.h + l.r) return false; ctx.globalAlpha = age < l.h ? 1 : 1 - (age - l.h) / l.r; ctx.drawImage(l.c, 0, 0); return true; });
  ctx.globalAlpha = 1;
}
function frame(now) {
  if (!run) return; raf = requestAnimationFrame(frame);
  const dt = Math.min(100, now - last); last = now;
  if (!W && !size()) return; if (!A) restart(); if (!A) return;
  step(dt); hover(now, dt); render(ctx, eff.e); drawLayers();
}

/* ===== Click: lock the connected area of similar color (a magic wand); tap a locked area to let it go ===== */
function tap(x, y) {
  if (!W) return;
  const k = 320 / Math.max(W, H), w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k)), px = Math.min(w - 1, Math.floor((x + .5) / 100 * w)), py = Math.min(h - 1, Math.floor((y + .5) / 100 * h));
  for (const l of layers) if (vt - l.b < l.h && l.w === w && l.m[py * w + px]) { l.b = vt - l.h; return; }
  render(clean.getContext('2d'), 0);
  const sm = document.createElement('canvas'); sm.width = w; sm.height = h;
  const sx = sm.getContext('2d', { willReadFrequently: true }); sx.drawImage(clean, 0, 0, w, h); const d = sx.getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const q = (clamp(py + j, 0, h - 1) * w + clamp(px + i, 0, w - 1)) * 4; r += d[q]; g += d[q + 1]; b += d[q + 2]; }
  r /= 9; g /= 9; b /= 9;
  const t2 = V.tol * V.tol, m = new Uint8Array(w * h), st = [py * w + px]; m[st[0]] = 1;
  while (st.length) {
    const i = st.pop(), x0 = i % w, y0 = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x0 + dx, Y = y0 + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const j = Y * w + X; if (m[j]) continue;
      const q = j * 4, dr = d[q] - r, dg = d[q + 1] - g, db = d[q + 2] - b;
      if (dr * dr + dg * dg + db * db <= t2) { m[j] = 1; st.push(j); }
    }
  }
  const mc = document.createElement('canvas'); mc.width = w; mc.height = h; const mx = mc.getContext('2d'), id = mx.createImageData(w, h);
  for (let i = 0; i < m.length; i++) id.data[i * 4 + 3] = m[i] ? 255 : 0;
  mx.putImageData(id, 0, 0);
  const lc = mk(), lx = lc.getContext('2d'); lx.drawImage(clean, 0, 0); lx.globalCompositeOperation = 'destination-in'; lx.imageSmoothingQuality = 'high'; lx.drawImage(mc, 0, 0, W, H);
  layers.push({ c: lc, m, w, b: vt, h: V.lockHold, r: V.release });
}

/* ===== Panel ===== */
const CSS = `#processPanel:not([hidden]){display:block!important;height:100%;min-height:0;padding:0;background:transparent;color:var(--ink);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.st{max-width:520px;margin:0 auto;padding:var(--m) var(--m) calc(var(--m)*2);display:flex;flex-direction:column;align-items:center;gap:calc(var(--m)*1.1);font-size:var(--site-type);letter-spacing:-.025em;font-weight:500;line-height:1.35;text-shadow:var(--txt-glow)}
.st p{margin:0;align-self:stretch}
.st canvas{display:block;aspect-ratio:var(--ar,.75);width:min(100%,calc(min(56vh,520px)*var(--ar,.75)));height:auto;touch-action:none;cursor:pointer;box-shadow:var(--img-halo)}
.st button{all:unset;cursor:pointer;color:var(--ink);text-shadow:var(--txt-glow);padding:6px 0}.st button:focus-visible{outline:2px solid var(--ink);outline-offset:4px}
.stl{height:100%;display:flex;align-items:center;justify-content:center;font-size:var(--site-type);letter-spacing:-.025em;font-weight:500;text-shadow:var(--txt-glow);animation:breathe 3.733s cubic-bezier(.37,0,.63,1) infinite}`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
function build() {
  built = true; V = vary();
  panel.innerHTML = '<div class="st"><p>Move over the image to disturb it. Tap to lock an area of similar color; tap it again to let it go. Press generate for a new variation.</p><canvas id="stC" role="img" aria-label="Artwork"></canvas><button id="stGen" type="button">generate</button></div>';
  cv = $('#stC'); ctx = cv.getContext('2d');
  const im = srcs[0].im; cv.style.setProperty('--ar', im.naturalWidth / im.naturalHeight);
  $('#stGen').onclick = () => { K++; V = vary(); restart(); };
  let down = false, moved = false, g = { x: 0, y: 0 };
  cv.addEventListener('pointerdown', e => { down = true; moved = false; g = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} eff.seen = performance.now(); });
  cv.addEventListener('pointermove', e => {
    const now = performance.now();
    if (eff.lt) eff.speed = eff.speed * .5 + Math.hypot(e.clientX - eff.lx, e.clientY - eff.ly) / Math.max(1, now - eff.lt) * 1000 * .5;
    eff.lx = e.clientX; eff.ly = e.clientY; eff.lt = now; eff.seen = now;
    if (down && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) moved = true;
  });
  cv.addEventListener('pointerup', e => {
    if (down && !moved) { const r = cv.getBoundingClientRect(); eff.pulse = 1; tap(Math.min(99, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 100))), Math.min(99, Math.max(0, Math.floor((e.clientY - r.top) / r.height * 100)))); }
    down = false;
  });
  cv.addEventListener('pointercancel', () => down = false);
  cv.addEventListener('pointerleave', () => { if (!down) { eff.seen = -1e9; eff.lt = 0; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', () => { if (!panel.hidden) size(); });
}
const DBG = new URLSearchParams(location.search).has('debug');
function note(msg) {   // add ?debug to the address to see this on screen
  if (!DBG) return;
  let el = document.getElementById('dbg');
  if (!el) { el = document.createElement('pre'); el.id = 'dbg'; el.style.cssText = 'position:fixed;z-index:200;left:8px;right:8px;bottom:56px;margin:0;padding:8px;font:11px/1.35 monospace;color:#7CFC9A;background:rgba(0,0,0,.8);white-space:pre-wrap;pointer-events:none'; document.body.appendChild(el); }
  el.textContent += msg + '\n';
}
addEventListener('error', e => note('studio error: ' + e.message));
const STUDIO = { dir: 'studio/', files: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'] };   // change the folder or names here
let loading = false;
function load() {
  if (loading) return; loading = true;
  panel.innerHTML = '<div class="stl">launching…</div>';   // shown from the click until the images are ready
  Promise.all(STUDIO.files.map(f => new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 2048 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.naturalWidth = c.width; c.naturalHeight = c.height; note('studio ' + im.src + ': ok ' + im.naturalWidth + 'x' + im.naturalHeight); res({ im: c });
    };
    im.onerror = () => { note('studio ' + im.src + ': FAILED (missing file or wrong name?)'); res(null); };
    im.src = STUDIO.dir + f + '?v=' + (typeof CONFIG !== 'undefined' ? CONFIG.v : 1);
  }))).then(a => {
    srcs = a.filter(Boolean);
    if (!srcs.length) { panel.innerHTML = '<div class="st"><p>Studio images not found. Expected ' + STUDIO.dir + STUDIO.files[0] + ' to ' + STUDIO.files[STUDIO.files.length - 1] + ' next to index.html.</p></div>'; return; }
    if (!panel.hidden) activate(true);
  });
}
function activate(on) {
  cancelAnimationFrame(raf); run = false; if (!on) return;
  if (!srcs.length) { load(); return; }
  if (!built) build();
  run = true; last = performance.now(); raf = requestAnimationFrame(frame);
}
new MutationObserver(() => activate(!panel.hidden && !document.hidden)).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('visibilitychange', () => activate(!panel.hidden && !document.hidden));
})();
