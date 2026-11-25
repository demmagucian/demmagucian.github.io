/* Studio section. Put this file next to index.html and add, just before </body>:  <script src="studio.js"></script>
   It fills #processPanel the first time "Studio" is opened and uses the same slides/ pictures as the home page. */
(() => {
const panel = document.getElementById('processPanel'); if (!panel) return;
const $ = s => panel.querySelector(s), clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const MODES = ['multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'luminosity'], KEYS = ['speed', 'intensity', 'lock'];
const mb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hs = (s, n) => (Math.imul(s ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n + 1, 0xc2b2ae35)) >>> 0;

/* ===== State = the code: seed + three faders + the taps (time in 0.1 s, x, y on a 100x100 grid) ===== */
const S = { seed: (Math.random() * 4294967296) >>> 0, speed: .5, intensity: .5, lock: .5, taps: [] };
const p2 = v => String(Math.round(clamp(v) * 99)).padStart(2, '0');
const encode = () => S.seed.toString(36) + '-' + KEYS.map(k => p2(S[k])).join('') + '-' + S.taps.map(t => [t.t, t.x, t.y].map(v => v.toString(36)).join('.')).join('_');
function decode(c) {
  const T = '[0-9a-z]+\\.[0-9a-z]+\\.[0-9a-z]+', m = new RegExp('^([0-9a-z]{1,7})-(\\d{6})-(' + T + '(?:_' + T + ')*)?$', 'i').exec((c || '').trim());
  if (!m) return false;
  S.seed = parseInt(m[1], 36) >>> 0; KEYS.forEach((k, i) => S[k] = +m[2].slice(i * 2, i * 2 + 2) / 99);
  S.taps = (m[3] || '').split('_').filter(Boolean).slice(0, 12).map(s => { const [t, x, y] = s.split('.').map(v => parseInt(v, 36)); return { t, x: Math.min(99, x), y: Math.min(99, y) }; }).sort((a, b) => a.t - b.t);
  return true;
}
let urlT = 0;
function sync() {
  $('#stCode').value = encode(); KEYS.forEach(k => $('#st-' + k).value = Math.round(S[k] * 100));
  clearTimeout(urlT); urlT = setTimeout(() => { try { const u = new URL(location.href); u.searchParams.set('studio', encode()); history.replaceState(null, '', u); } catch (e) {} }, 400);
}

/* ===== Engine ===== */
let built = false, cv, ctx, W = 0, H = 0, srcs = [], A, B, C, clean, idx = 0, n = 0, ph = 'hold', pt = 0, dur = 1, hold = 0, mode = 'multiply', amt = .7, vt = 0, tp = 0, layers = [], last = 0, run = false, raf = 0, rt = 0;
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
function begin() {   // draws for transition n come only from the seed, so the same code always plays the same loop
  const r = mb(hs(S.seed, n));
  dur = (9000 - S.speed * 7000) * (.75 + .5 * r()); hold = r() < .5 ? 0 : r() * 1500; mode = MODES[Math.floor(r() * MODES.length)]; amt = .5 + .5 * r();
  ph = 'hold'; pt = 0; B = fitC(srcs[(idx + 1) % srcs.length].im); blend();
}
function restart() {
  if (!built || !srcs.length || !size()) return;
  vt = 0; tp = 0; n = 0; layers = []; idx = S.seed % srcs.length; A = fitC(srcs[idx].im); begin();
}
function render(c, e) {
  const p = ph === 'dis' ? clamp(pt / dur) : 0, s = p * p * (3 - 2 * p);
  c.globalAlpha = 1; c.drawImage(A, 0, 0); if (s <= 0) return;
  c.globalAlpha = s; c.drawImage(B, 0, 0);
  const a = amt + (eff.live - amt) * e, edge = Math.min(1, s / .08, (1 - s) / .08), k = S.intensity * 1.1 * (1 + .5 * e), fl = .42 * e;
  c.globalAlpha = Math.min(1, a * (fl + (1 - fl) * Math.sin(Math.PI * s)) * edge * k); c.drawImage(C, 0, 0); c.globalAlpha = 1;
}
function step(dt) {
  vt += dt;
  while (tp < S.taps.length && S.taps[tp].t * 100 <= vt) { tap(S.taps[tp].x, S.taps[tp].y); tp++; }
  pt += dt;
  if (ph === 'hold') { if (pt >= hold) { ph = 'dis'; pt = 0; } }
  else if (pt >= dur) { idx = (idx + 1) % srcs.length; A = B; n++; begin(); }
}
function hover(now, dt) {   // hovering and pointer speed push the blend strength live; this is not part of the code
  const here = now - eff.seen < 500;
  eff.energy += ((here ? 1 : 0) - eff.energy) * (1 - Math.exp(-dt / (here ? 60 : 450)));
  eff.speed *= Math.exp(-dt / 250); eff.pulse *= Math.exp(-dt / 700);
  const ag = Math.min(1, eff.speed / 700);
  if (now >= eff.nr) { eff.tgt = .2 + Math.random() * .8; eff.nr = now + 240 / (1 + ag * 2.2); }
  eff.live += (eff.tgt - eff.live) * Math.min(.9, (.28 + ag * .25) * dt / 16);
  eff.e = Math.min(1, eff.energy * .14 + ag * .95 + eff.pulse);
}
function drawLayers() {
  layers = layers.filter(l => { const age = vt - l.b; if (age > l.h + 1500) return false; ctx.globalAlpha = age < l.h ? 1 : 1 - (age - l.h) / 1500; ctx.drawImage(l.c, 0, 0); return true; });
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
  const tol = 15 + 75 * S.lock, t2 = tol * tol, m = new Uint8Array(w * h), st = [py * w + px]; m[st[0]] = 1;
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
  layers.push({ c: lc, m, w, b: vt, h: 3000 + S.lock * 17000 });
}
function record(x, y) {
  if (S.taps.length >= 12) return;
  S.taps.push({ t: Math.floor(vt / 100), x, y }); S.taps.sort((a, b) => a.t - b.t);
  tp = S.taps.filter(q => q.t * 100 <= vt).length; tap(x, y); sync();
}

/* ===== Generate: a new seed, new fader positions, and a virtual hand that taps at moments drawn from the seed ===== */
function tween(to) {
  const from = KEYS.map(k => S[k]); KEYS.forEach(k => S[k] = to[k]); const t0 = performance.now();
  const f = now => { const u = clamp((now - t0) / 700), e = u * u * (3 - 2 * u); KEYS.forEach((k, i) => $('#st-' + k).value = Math.round((from[i] + (to[k] - from[i]) * e) * 100)); if (u < 1) requestAnimationFrame(f); else sync(); };
  requestAnimationFrame(f);
}
function generate() {
  const seed = (Math.random() * 4294967296) >>> 0, r = mb(hs(seed, 9999)), to = { speed: .2 + .6 * r(), intensity: .3 + .7 * r(), lock: .2 + .7 * r() };
  const cnt = 3 + Math.floor(r() * 4), taps = []; let t = 40 + Math.floor(r() * 60);
  for (let i = 0; i < cnt; i++) { taps.push({ t, x: Math.round(clamp((r() + i * .618) % 1, .08, .92) * 99), y: Math.round(clamp((r() + i * .382) % 1, .08, .92) * 99) }); t += 60 + Math.floor(r() * 160); }
  S.seed = seed; S.taps = taps; tween(to); restart();
}

/* ===== Panel ===== */
const CSS = `#processPanel:not([hidden]){display:block!important;height:100%;min-height:0;padding:0;background:transparent;color:var(--ink);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.st{max-width:520px;margin:0 auto;padding:var(--m) var(--m) calc(var(--m)*2);display:flex;flex-direction:column;align-items:center;gap:calc(var(--m)*1.1);font-size:var(--site-type);letter-spacing:-.025em;font-weight:500;line-height:1.35;text-shadow:var(--txt-glow)}
.st p{margin:0;align-self:stretch}
.st canvas{display:block;aspect-ratio:var(--ar,.75);width:min(100%,calc(min(50vh,480px)*var(--ar,.75)));height:auto;touch-action:none;cursor:pointer;box-shadow:var(--img-halo)}
.stf{align-self:stretch;display:flex;flex-direction:column;gap:calc(var(--m)*.6)}
.stf label{display:flex;align-items:center;gap:var(--m)}.stf span{width:5.5em}
.stf input{flex:1;-webkit-appearance:none;appearance:none;height:22px;margin:0;background:none;color:var(--ink);cursor:pointer}
.stf input::-webkit-slider-runnable-track{height:1px;background:currentColor}.stf input::-moz-range-track{height:1px;background:currentColor}
.stf input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:currentColor;border:0;margin-top:-5.5px}.stf input::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:currentColor;border:0}
.stb{display:flex;gap:calc(var(--m)*1.5)}.st button{all:unset;cursor:pointer;color:var(--ink);text-shadow:var(--txt-glow);padding:6px 0}.st button:focus-visible{outline:2px solid var(--ink);outline-offset:4px}
#stCode{align-self:stretch;background:none;border:0;border-bottom:1px solid rgba(var(--ink-rgb),.35);border-radius:0;color:var(--ink);font:inherit;font-size:.8em;letter-spacing:0;text-align:center;padding:6px 0;opacity:.75;outline:0;-webkit-user-select:text;user-select:text}#stCode.bad{border-color:#c44}`;
function build() {
  built = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  panel.innerHTML = `<div class="st"><p>Move over the image to disturb it. Tap to lock an area of similar color; tap it again to let it go. Shape the loop with the faders, or press generate and let a seed play for you.</p><canvas id="stC" role="img" aria-label="Artwork"></canvas>
<div class="stf">${KEYS.map(k => `<label><span>${k}</span><input id="st-${k}" type="range" min="0" max="100" aria-label="${k}"></label>`).join('')}</div>
<div class="stb"><button id="stGen" type="button">generate</button><button id="stCopy" type="button">copy link</button></div><input id="stCode" type="text" spellcheck="false" autocomplete="off" aria-label="Seed code"></div>`;
  cv = $('#stC'); ctx = cv.getContext('2d');
  const im = srcs[0].im; cv.style.setProperty('--ar', im.naturalWidth / im.naturalHeight);
  KEYS.forEach(k => $('#st-' + k).addEventListener('input', e => { S[k] = e.target.value / 100; $('#stCode').value = encode(); if (k === 'speed') { clearTimeout(rt); rt = setTimeout(restart, 300); } }));   // speed changes the timeline, so it replays; intensity and lock apply from now on
  $('#stGen').onclick = generate;
  $('#stCopy').onclick = async e => {
    const u = new URL(location.href); u.searchParams.set('studio', encode());
    try { await navigator.clipboard.writeText(u.href); e.target.textContent = 'copied'; } catch (x) { $('#stCode').select(); e.target.textContent = 'copy the code'; }
    setTimeout(() => e.target.textContent = 'copy link', 1600);
  };
  $('#stCode').addEventListener('change', e => { if (decode(e.target.value)) { sync(); restart(); } else { e.target.classList.add('bad'); setTimeout(() => { e.target.classList.remove('bad'); e.target.value = encode(); }, 800); } });
  let down = false, moved = false, g = { x: 0, y: 0 };
  cv.addEventListener('pointerdown', e => { down = true; moved = false; g = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} eff.seen = performance.now(); });
  cv.addEventListener('pointermove', e => {
    const now = performance.now();
    if (eff.lt) eff.speed = eff.speed * .5 + Math.hypot(e.clientX - eff.lx, e.clientY - eff.ly) / Math.max(1, now - eff.lt) * 1000 * .5;
    eff.lx = e.clientX; eff.ly = e.clientY; eff.lt = now; eff.seen = now;
    if (down && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) moved = true;
  });
  cv.addEventListener('pointerup', e => {
    if (down && !moved) { const r = cv.getBoundingClientRect(); eff.pulse = 1; record(Math.min(99, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 100))), Math.min(99, Math.max(0, Math.floor((e.clientY - r.top) / r.height * 100)))); }
    down = false;
  });
  cv.addEventListener('pointercancel', () => down = false);
  cv.addEventListener('pointerleave', () => { if (!down) { eff.seen = -1e9; eff.lt = 0; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', () => { if (!panel.hidden) size(); });
  sync();
}
function activate(on) {
  cancelAnimationFrame(raf); run = false; if (!on) return;
  if (!srcs.length && typeof slideList !== 'undefined') srcs = slideList.slice();
  if (!srcs.length) return;
  if (!built) build();
  run = true; last = performance.now(); raf = requestAnimationFrame(frame);
}
new MutationObserver(() => activate(!panel.hidden && !document.hidden)).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('visibilitychange', () => activate(!panel.hidden && !document.hidden));

/* A shared link (?studio=CODE) opens Studio by itself once the page is ready */
const q = new URLSearchParams(location.search).get('studio');
if (q && decode(q)) { const t = setInterval(() => { if (document.documentElement.classList.contains('ready')) { clearInterval(t); setTimeout(() => document.getElementById('processLink').click(), 1500); } }, 200); }
})();
