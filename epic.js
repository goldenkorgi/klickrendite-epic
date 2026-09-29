/* KlickRendite Film, finale Fassung.
   Ein Schwarm aus Klicks lebt durch den ganzen Film und formt jedes Bild. Scroll ist die Zeitachse.
   Jeder Weltwechsel ist ein Klick (Welle vom Klickpunkt), einmal steigen die drei Balken der Marke.
   Vanilla JS, GSAP nur als Tween-Rechner, Lenis nur fuer weiches Rad-Scrollen. */
(function () {
  'use strict';
  var win = window, doc = document, root = doc.documentElement, body = doc.body;
  var gsap = win.gsap;
  var PI = Math.PI, TAU = PI * 2;
  var qs = null; try { qs = new URLSearchParams(location.search); } catch (e) {}
  var DEBUG = !!(qs && qs.has('p'));
  var DEBUG_P = DEBUG ? Math.max(0, Math.min(1, parseFloat(qs.get('p')) || 0)) : 0;

  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(p, a, b) { return p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a); }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function eio(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eioInv(v) { return v < .5 ? Math.pow(v / 4, 1 / 3) : 1 - Math.pow(2 * (1 - v), 1 / 3) / 2; }
  function eo(t) { return 1 - Math.pow(1 - t, 3); }
  function fract(v) { return v - Math.floor(v); }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(n, seed) { var r = mulberry(seed), a = new Int32Array(n), i, j, t; for (i = 0; i < n; i++) a[i] = i; for (i = n - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function keys(p, K) { var i; if (p <= K[0][0]) return K[0][1]; for (i = 1; i < K.length; i++) { if (p <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (p - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); } return K[K.length - 1][1]; }
  function keysE(p, K) { var i; if (p <= K[0][0]) return K[0][1]; for (i = 1; i < K.length; i++) { if (p <= K[i][0]) return lerp(K[i - 1][1], K[i][1], eio((p - K[i - 1][0]) / (K[i][0] - K[i - 1][0]))); } return K[K.length - 1][1]; }

  /* Debug-Aufnahme: Fehler sichtbar machen, statt ein leeres Bild zu liefern */
  function showError(e) {
    if (!DEBUG) return;
    var d = doc.createElement('pre'); d.className = 'dbg-err';
    d.textContent = 'FEHLER: ' + (e && (e.stack || e.message) || e); body.appendChild(d);
  }
  if (DEBUG) win.addEventListener('error', function (e) { showError(e.error || e.message); });

  var cv = doc.getElementById('swarm');
  var ctx = cv && cv.getContext ? cv.getContext('2d', { alpha: false }) : null;
  var gate = doc.getElementById('gate');
  var FILM = root.classList.contains('film') && !!gsap && !!ctx;

  /* ---------- Statische Seite: ohne Film, ohne Sperre ---------- */
  if (!FILM) {
    root.classList.remove('film');
    body.classList.add('ready');
    if (gate) gate.addEventListener('click', function () { var t = doc.getElementById('k1'); if (t) { t.scrollIntoView(); try { t.focus({ preventScroll: true }); } catch (e) {} } });
    return;
  }
  win.__epic = true;

  /* ---------- Grundzustand ---------- */
  var W = 0, H = 0, M = false, dpr = 1, N = 0, maxScroll = 1, trackH = 0;
  var REM = 16, HT = 70, HB = 58, IX = 96;   // HUD-Baender und Spalte des Kapitelindex
  var LEN_D = 39.18, LEN_M = 29.72;          // Filmlaenge in Bildschirmhoehen (wie html.film .track in epic.css: 3918vh und 2972vh)
  /* Scroll und Film laufen nicht im selben Takt. Die Abbildung ist stueckweise linear: [Filmzeit 0..1, Strecke in Bildschirmhoehen].
     Start und Kapitel 1 (Film 0 bis 16,4 %) liegen auf dem ersten Stueck. Die acht Welten in Kapitel 7 (Film 72,3 bis 88,4) haben ein
     eigenes Stueck mit mehr Strecke, weil die Karten jetzt ein Angebot tragen und gelesen werden wollen: am Desktop 0,85, am Handy
     1 Bildschirm je Welt. Kapitel 2 bis 6 und der Auftakt von Kapitel 7 behalten ihr Tempo. Kapitel 8 und 9 behalten ihre Strecke (6,55 und 4,22 Bildschirme). Alle Zeiten im Code bleiben Filmzeit. */
  var K8 = 88.4;                             // Beginn von Kapitel 8 in Filmzeit
  var MAP_D = [[0, 0], [.164, 4.2], [.723, 24.79], [K8 / 100, 31.63], [1, LEN_D - 1]];
  var MAP_M = [[0, 0], [.164, 3.22], [.723, 16.45], [K8 / 100, 24.5], [1, LEN_M - 1]];
  var MAP = MAP_D;
  function s2p(s) { var h = s * MAP[MAP.length - 1][1], i; for (i = 1; i < MAP.length; i++) if (h <= MAP[i][1] || i === MAP.length - 1) return MAP[i - 1][0] + (h - MAP[i - 1][1]) * (MAP[i][0] - MAP[i - 1][0]) / (MAP[i][1] - MAP[i - 1][1]); return 1; }
  function p2s(q) { var i; for (i = 1; i < MAP.length; i++) if (q <= MAP[i][0] || i === MAP.length - 1) return (MAP[i - 1][1] + (q - MAP[i - 1][0]) * (MAP[i][1] - MAP[i - 1][1]) / (MAP[i][0] - MAP[i - 1][0])) / MAP[MAP.length - 1][1]; return 1; }
  function filmAt(y) { return DEBUG ? clamp(pBase + y / maxScroll, 0, 1) : s2p(clamp(y / maxScroll, 0, 1)); }
  function scrollFor(q) { return Math.max(0, Math.round(DEBUG ? (q - pBase) * maxScroll : p2s(clamp(q, 0, 1)) * maxScroll)); }
  var pBase = DEBUG ? DEBUG_P : 0;   // Debug: der Film beginnt an dieser Stelle, das Fenster bleibt bei Scroll 0
  var T = 20, last = 0, raf = 0;
  var pT = 0, pS = 0, pPrev = 0, vel = 0;
  var locked = true, hudK = 0, openT = -1;
  var lenis = null;
  var touch = win.matchMedia && win.matchMedia('(pointer: coarse)').matches;
  var mouse = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0, on: false };
  var G = {};
  var film = $('#film'), track = $('#track'), hint = $('#hint'), foot = $('#foot');
  var flash = doc.createElement('div'); flash.className = 'flash'; flash.setAttribute('aria-hidden', 'true'); body.appendChild(flash);

  /* Kapitel 7 traegt acht Welten und endet bei 88,4 statt 82,2: auch die letzte Welt steht so lange wie die anderen.
     Kapitel 8 und 9 ruecken nach: late() rechnet ihre Zeiten aus der alten Zaehlung (82,2 bis 100) in die neue Filmzeit
     (88,4 bis 100), KL ist der Faktor fuer Dauern. Die Strecke der beiden Kapitel bleibt gleich (MAP_D, MAP_M). */
  var KL = (100 - K8) / 17.8;
  function late(x) { return K8 + (x - 82.2) * KL; }
  /* Einige kurze Dauern in Kapitel 8 und 9 standen in der Live-Fassung (Kapitel 8 ab 84,4) ungerafft in Filmzeit: Nachlauf und Vorlauf
     des Schwarms am Wischer, die Vignette, das Einblenden (show) und der Rand der Szenen. KS haelt ihre Strecke genau wie live. */
  var KS = (100 - K8) / 15.6;
  var CH = [0, 2.6, 16.4, 26, 38.2, 45.6, 55.4, 69.1, K8, late(94.0)];
  var CHJ = [0, 3.5, 19.6, 28.2, 40.3, 48, 59.5, 71.1, late(84), 99.6];
  var CHN = ['Start', 'Die Geschichte', 'Das Problem', 'Das Wissen', 'Die Arbeit', 'Die Werkzeuge', 'Der Weg', 'Für wen', 'Das erste Gespräch', 'Kontakt'];
  var WA = [72.3, 74.3, 76.3, 78.3, 80.3, 82.3, 84.3, 86.3], WL = 2, NS = WA.length;   // die acht Welten in Kapitel 7

  /* ---------- Welten und Wischer ---------- */
  var NW = 6, NB = NW * 25;
  var WN = ['k', 'i', 'g', 'd', 'm', 'e'];
  var BG = ['#0a0b0d', '#f4f5f2', '#3DD68C', '#0d2a1e', '#d3f3e1', '#0c5f3f'];
  var FG = ['#f4f5f2', '#121417', '#0a0b0d', '#f4f5f2', '#0a0b0d', '#f4f5f2'];
  var ACC = ['#3DD68C', '#0f9d5b', '#0a0b0d', '#3DD68C', '#0c8f52', '#a8f0cd'];
  var ADD = [1, 0, 0, 1, 0, 0];    // dunkle Welten mischen additiv
  var PAL = [
    [[244, 245, 242], [61, 214, 140], [255, 90, 42], [255, 46, 46], [140, 149, 144]],
    [[18, 20, 23], [15, 157, 91], [118, 126, 121], [118, 126, 121], [118, 126, 121]],
    [[10, 11, 13], [244, 245, 242], [10, 11, 13], [10, 11, 13], [14, 96, 58]],
    [[244, 245, 242], [61, 214, 140], [150, 182, 166], [150, 182, 166], [150, 182, 166]],
    [[10, 11, 13], [12, 143, 82], [70, 96, 82], [70, 96, 82], [70, 96, 82]],
    [[244, 245, 242], [150, 245, 200], [126, 190, 160], [126, 190, 160], [126, 190, 160]]
  ];
  var LV = [.11, .24, .42, .68, 1];
  var STY = [];
  (function () { var w, r, l; for (w = 0; w < NW; w++) for (r = 0; r < 5; r++) for (l = 0; l < 5; l++) STY.push('rgba(' + PAL[w][r][0] + ',' + PAL[w][r][1] + ',' + PAL[w][r][2] + ',' + LV[l] + ')'); })();

  /* Portal: der Schlusspunkt von "Rendite." ist das Tor in die naechste Welt */
  var h1 = $('#h1'), fsEl = h1 ? $('.fs', h1) : null, probe = null;
  var PZ = { a: .35, b: 2.6, cx: 0, cy: 0, hw: 6, hh: 6, ok: false, tf: '', op: -1 };
  var mctx = doc.createElement('canvas').getContext('2d');
  if (fsEl) { probe = doc.createElement('i'); probe.className = 'bl'; probe.setAttribute('aria-hidden', 'true'); fsEl.insertBefore(probe, fsEl.firstChild); }
  function portalMeasure() {
    if (!probe) return;
    root.classList.add('measuring');
    var keepT = h1.style.transform; h1.style.transform = 'none';
    var r = probe.getBoundingClientRect(), hr = h1.getBoundingClientRect(), cs = getComputedStyle(fsEl);
    var fz = parseFloat(cs.fontSize) || 100, l, rr, as, ds, m = null;
    try { mctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; m = mctx.measureText('.'); } catch (e) {}
    if (m && m.actualBoundingBoxRight !== undefined) { l = -m.actualBoundingBoxLeft; rr = m.actualBoundingBoxRight; as = m.actualBoundingBoxAscent; ds = m.actualBoundingBoxDescent; }
    if (!(rr - l > 1) || !(as + ds > 1)) { l = fz * .06; rr = fz * .22; as = fz * .16; ds = 0; }
    PZ.cx = r.left + (l + rr) / 2; PZ.cy = r.top - (as - ds) / 2;
    PZ.hw = Math.max(2, (rr - l) / 2); PZ.hh = Math.max(2, (as + ds) / 2);
    h1.style.transformOrigin = (PZ.cx - hr.left).toFixed(2) + 'px ' + (PZ.cy - hr.top).toFixed(2) + 'px';
    h1.style.transform = keepT;
    root.classList.remove('measuring');
    PZ.ok = hr.width > 0; PZ.tf = ''; PZ.op = -1;
  }
  function portalAt(p) {
    var t = seg(p, PZ.a, PZ.b); if (t <= 0 || !PZ.ok) return null;
    var tt = Math.min(1, t * 1.3); tt = tt < .5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
    var px = lerp(PZ.cx, W / 2, tt), py = lerp(PZ.cy, H / 2, tt);
    var sEnd = Math.max((Math.max(px, W - px) + 6) / PZ.hw, (Math.max(py, H - py) + 6) / PZ.hh);
    var s = Math.pow(sEnd, Math.pow(t, 1.4)), hw = PZ.hw * s, hh = PZ.hh * s;
    return { t: t, s: s, px: px, py: py, x0: px - hw, y0: py - hh, x1: px + hw, y1: py + hh };
  }
  function portalDom(p) {
    if (!h1) return;
    var st = p > PZ.a ? portalAt(p) : null, tf = 'none', op = 1, sd;
    if (st) { sd = Math.min(st.s, 30); tf = 'translate(' + (st.px - PZ.cx).toFixed(2) + 'px,' + (st.py - PZ.cy).toFixed(2) + 'px) scale(' + sd.toFixed(4) + ')'; op = st.s < 3 ? 1 : clamp(1 - (st.s - 3) / 6, 0, 1); }
    if (tf !== PZ.tf) { h1.style.transform = tf; PZ.tf = tf; }
    if (op !== PZ.op) { h1.style.opacity = op; PZ.op = op; }
  }

  var WD = .45;   // Dauer der Welle bei den acht Weltwechseln in Kapitel 7: sie hat den Text der Karte hinter sich, bevor die Karte steht
  var WIPES = [
    { at: PZ.a, dur: PZ.b - PZ.a, to: 2, type: 'rect', o: function () { return [PZ.cx, PZ.cy]; } },
    { at: 6.0, dur: 1.0, to: 0, o: function () { return [G.cur.tx, G.cur.ty]; } },
    { at: 26.0, dur: 1.3, to: 1, o: function () { return FORM.leak.gap(1); } },
    { at: 38.2, dur: 1.3, to: 0, type: 'bars', o: function () { return [W * .5, H]; } },
    { at: 45.6, dur: 1.2, to: 2, o: function () { var I = G.icon, u = I.S / 128; return [I.cx + 24 * u, I.cy - 20 * u]; } },
    { at: 55.4, dur: 1.0, to: 0, o: function () { return G.fun.vert ? [G.fun.cc, H * .16] : [W * .1, G.fun.cc]; } },
    { at: 69.1, dur: .6, to: 2, o: function () { var K = G.fun.mk; return [K.ox + 88 * K.u, K.oy + 31 * K.u]; } },
    { at: WA[0], dur: WD, to: 0, o: function () { return G.seed(0); } },
    { at: WA[1], dur: WD, to: 1, o: function () { return picC(0); } },
    { at: WA[2], dur: WD, to: 2, o: function () { return picC(1); } },
    { at: WA[3], dur: WD, to: 4, o: function () { return picC(2); } },
    { at: WA[4], dur: WD, to: 3, o: function () { return picC(3); } },
    { at: WA[5], dur: WD, to: 5, o: function () { return picC(4); } },
    { at: WA[6], dur: WD, to: 1, o: function () { return picC(5); } },
    { at: WA[7], dur: WD, to: 0, o: function () { return picC(6); } },
    { at: K8, dur: .7 * KL, to: 1, o: function () { return [G.eye.x0, G.hor]; } },
    { at: late(94.0), dur: 1.0 * KL, to: 0, o: function () { return [(G.eye.x0 + G.eye.x1) / 2, G.hor]; } }
  ];
  /* Kapitel 7: jede Welt hat ihr eigenes Feld (fitPic). Der Klick zur naechsten Welt sitzt in der Mitte des Bildes, das gerade steht. */
  function picOf(j) { return (G.pics && G.pics[j]) || G.pic; }
  function picC(j) { var b = picOf(j); return [b.cx, b.cy]; }
  var ign = null;            // Zuendung: gruener Ring, zeitgesteuert
  var ripples = [];          // Klick-Wellen
  var AW = [];               // aktive Wischer dieses Frames
  var baseWorld = 0;

  function maxR(x, y) { var a = Math.max(x, W - x), b = Math.max(y, H - y); return Math.sqrt(a * a + b * b) * 1.04; }
  function barsTop(k) { var out = [], i; for (i = 0; i < 3; i++) out.push(H * (1 - eio(clamp(k * 1.6 - (2 - i) * .3, 0, 1)))); return out; }
  /* Scroll-Stelle, an der ein Wischer den Punkt erreicht */
  function wipeReach(wp, x, y, ox, oy, R) {
    if (wp.type === 'bars') return wp.at + wp.dur * (eioInv(clamp(1 - y / H, 0, 1)) + (x < W / 3 ? .6 : x < W * 2 / 3 ? .3 : 0)) / 1.6;
    var dx = x - ox, dy = y - oy, d = Math.sqrt(dx * dx + dy * dy) / R; if (d > 1) d = 1;
    return wp.at + wp.dur * Math.pow(d, 1 / 1.4);
  }
  function worlds(p, t) {
    var i, w, o, k, R, zs;
    AW.length = 0; baseWorld = 0;
    for (i = 0; i < WIPES.length; i++) {
      w = WIPES[i];
      if (p >= w.at + w.dur) { baseWorld = w.to; continue; }
      if (p > w.at) {
        k = (p - w.at) / w.dur;
        if (w.type === 'rect') { zs = portalAt(p); if (zs) AW.push({ rect: 1, x0: zs.x0, y0: zs.y0, x1: zs.x1, y1: zs.y1, w: w.to, k: k, r: 0 }); }
        else if (w.type === 'bars') AW.push({ bars: 1, top: barsTop(k), w: w.to, k: k, r: 0 });
        else { o = w.o(); R = maxR(o[0], o[1]); AW.push({ x: o[0], y: o[1], r: R * Math.pow(k, 1.4), w: w.to, k: k, R: R }); }
      }
      break;
    }
    if (ign) {
      var age = t - ign.t, v = ign.R / .8;
      if (age > 1.5) ign = null;
      else {
        AW.push({ x: ign.x, y: ign.y, r: Math.max(0, v * age), w: 2, k: clamp(age / .8, 0, 1), R: ign.R, ig: 1 });
        if (age > .22) AW.push({ x: ign.x, y: ign.y, r: v * (age - .22) * 1.06, w: 0, k: clamp((age - .22) / .8, 0, 1), R: ign.R, ig: 1 });
      }
    }
  }
  function inAW(a, x, y) {
    if (a.bars) return y > a.top[x < W / 3 ? 0 : x < W * 2 / 3 ? 1 : 2];
    if (a.rect) return x > a.x0 && x < a.x1 && y > a.y0 && y < a.y1;
    var dx = x - a.x, dy = y - a.y; return dx * dx + dy * dy < a.r * a.r;
  }
  function worldAt(x, y) { var w = baseWorld, i; for (i = 0; i < AW.length; i++) if (inAW(AW[i], x, y)) w = AW[i].w; return w; }

  /* ---------- Partikel ---------- */
  var R1, R2, R3, R4, Z, X, Y, VX, VY, OX, OY, OVX, OVY, DS;
  var A, B, F;
  var BK = [], BC = new Int32Array(NB), GL, GLn = 0, GE, GEn = 0;
  var impulseOn = 0;
  function mk() { return { x: new Float32Array(N), y: new Float32Array(N), s: new Float32Array(N), a: new Float32Array(N), r: new Uint8Array(N), g: new Uint8Array(N) }; }
  function initParticles() {
    var r = mulberry(20260927), i;
    R1 = new Float32Array(N); R2 = new Float32Array(N); R3 = new Float32Array(N); R4 = new Float32Array(N); Z = new Float32Array(N);
    X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N);
    OX = new Float32Array(N); OY = new Float32Array(N); OVX = new Float32Array(N); OVY = new Float32Array(N); DS = new Float32Array(N);
    for (i = 0; i < N; i++) { R1[i] = r(); R2[i] = r(); R3[i] = r(); R4[i] = r(); Z[i] = .25 + .75 * r(); X[i] = R1[i] * W; Y[i] = R2[i] * H; }
    A = mk(); B = mk(); F = mk();
    BK = []; for (i = 0; i < NB; i++) BK.push(new Int32Array(N));
    GL = new Int32Array(1400); GE = new Int32Array(900);
  }

  var FORM = {};
  var ARROW = [[62.5, 22], [62.5, 73], [76.3, 61], [85.3, 80.5], [94.9, 76.3], [85.9, 57.1], [103, 57.1]];
  var ARW = [0, 0, 0, .877, .233, .671, .384, 1, .548, .932, .397, .603, .685, .603];   // Zeiger, Hoehe 1, Spitze im Ursprung
  var BAR = [[25, 70, 18, 33], [52, 52, 18, 51], [79, 31, 18, 72]];
  function inPoly(x, y, P) { var c = false, i, j, n = P.length; for (i = 0, j = n - 1; i < n; j = i++) { if (((P[i][1] > y) !== (P[j][1] > y)) && (x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0])) c = !c; } return c; }
  function distPoly(x, y, P) { var d = 1e9, i, j, n = P.length, ax, ay, bx, by, t, dx, dy; for (i = 0, j = n - 1; i < n; j = i++) { ax = P[j][0]; ay = P[j][1]; bx = P[i][0]; by = P[i][1]; t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) * (bx - ax) + (by - ay) * (by - ay)), 0, 1); dx = x - (ax + (bx - ax) * t); dy = y - (ay + (by - ay) * t); d = Math.min(d, Math.sqrt(dx * dx + dy * dy)); } return d; }
  function monoFont(px) { ctx.font = '500 ' + px + 'px "JetBrains Mono", ui-monospace, Menlo, monospace'; }
  function label(txt, x, y, al, sp) { ctx.textAlign = al || 'left'; ctx.textBaseline = 'middle'; try { ctx.letterSpacing = (sp === undefined ? 1.4 : sp) + 'px'; } catch (e) {} ctx.fillText(txt, x, y); try { ctx.letterSpacing = '0px'; } catch (e2) {} }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')'; }

  /* 0 · Punktfeld (Hero). Um das Klick-Ziel stehen die drei Balken der Marke, der Zeiger ist der Knopf. */
  FORM.lattice = (function () {
    var lx, ly, lk, cnt;
    function bars() {
      var u = G.hero.u, gx = G.gx, gy = G.gy, j, b, out = [];
      for (j = 0; j < 3; j++) { b = BAR[j]; out.push([gx + (b[0] - 79) * u, gy + (b[1] - 50) * u, b[2] * u, b[3] * u]); }
      return out;
    }
    return {
      name: 'Punktfeld',
      init: function () {
        var g = M ? 24 : 28, cols = Math.ceil(W / g) + 1, rows = Math.ceil(H / g) + 1, i, c, j, b, x, y;
        cnt = Math.min(cols * rows, Math.floor(N * .6));
        lx = new Float32Array(N); ly = new Float32Array(N); lk = new Uint8Array(N);
        var ox = (W % g) / 2, oy = (H % g) / 2, perm = shuffle(cols * rows, 11), B_ = bars(), pts = [], q = g / 4;
        for (j = 0; j < 3; j++) { b = B_[j]; for (y = b[1] + b[3] - q / 2; y > b[1]; y -= q) for (x = b[0] + q / 2; x < b[0] + b[2]; x += q) pts.push([x, y, j + 1]); }
        var pp = shuffle(Math.max(1, pts.length), 12), np = Math.min(pts.length, N - cnt);
        for (i = 0; i < N; i++) {
          if (i < cnt) { c = perm[i]; lx[i] = ox + (c % cols) * g; ly[i] = oy + Math.floor(c / cols) * g; lk[i] = 0; }
          else if (i - cnt < np) { c = pts[pp[i - cnt]]; lx[i] = c[0]; ly[i] = c[1]; lk[i] = c[2]; }
          else { c = perm[i % (cols * rows)]; lx[i] = ox + (c % cols) * g; ly[i] = oy + Math.floor(c / cols) * g; lk[i] = 9; }
        }
        this.B = B_;
      },
      run: function (o, p, t) {
        var i, x, y, wv, a, s, r, dx, dy, d, k, pu, gx = G.gx, gy = G.gy, RR = M ? 260 : 420, kd, B_ = this.B, b, lv, base = B_[0][1] + B_[0][3];
        for (i = 0; i < N; i++) {
          x = lx[i]; y = ly[i]; r = 0; kd = lk[i];
          if (kd === 9) { o.x[i] = x; o.y[i] = y; o.s[i] = 1; o.a[i] = 0; o.r[i] = 0; continue; }
          if (kd === 0) {
            wv = Math.sin(x * .012 + t * .7) * Math.sin(y * .015 - t * .5);
            a = .27 + .12 * wv; s = 2.2;
            dx = x - gx; dy = y - gy; d = Math.sqrt(dx * dx + dy * dy);
            if (d < RR) { k = 1 - d / RR; pu = Math.sin(d * .03 - t * 2.4); if (pu < 0) pu = 0; pu *= k; a += pu * .6; s += pu * 1.6; if (pu > .16) r = 1; }
          } else {
            b = B_[kd - 1]; lv = (base - y) / (B_[2][3]);
            pu = Math.pow(Math.max(0, Math.sin(lv * 5.2 - t * 1.7 + kd * .5)), 3);
            a = .6 + .36 * pu + .04 * R3[i]; s = 2.4 + 1.1 * pu; r = 1;
          }
          o.x[i] = x; o.y[i] = y; o.s[i] = s; o.a[i] = a; o.r[i] = r;
        }
      },
      decor: function (w, p, t) {
        // Grundlinie unter den Balken, wie auf einer Blaupause
        var B_ = this.B, y = B_[0][1] + B_[0][3] + 5.5;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .3 * w; ctx.strokeStyle = FG[0]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(B_[0][0] - 18, y); ctx.lineTo(B_[2][0] + B_[2][2] + 18, y); ctx.stroke();
        ctx.setLineDash([4, 5]); ctx.globalAlpha = .34 * w;
        for (var j = 0; j < 3; j++) ctx.strokeRect(Math.round(B_[j][0]) - 4.5, Math.round(B_[j][1]) - 4.5, Math.round(B_[j][2]) + 9, Math.round(B_[j][3]) + 9);
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    };
  })();

  /* 1 · Der Klick: ein Zeiger aus Tausenden Punkten, Wellen laufen von seiner Spitze */
  FORM.cursor = (function () {
    var kd, lx, ly, gs = 1;
    return {
      name: 'Klick',
      init: function () {
        kd = new Uint8Array(N); lx = new Float32Array(N); ly = new Float32Array(N);
        var na = Math.floor(N * .62), g = Math.sqrt(1010 / na), pa = [], x, y, i, b, perm;
        for (y = 21; y < 82; y += g) for (x = 61; x < 105; x += g) { if (inPoly(x, y, ARROW)) pa.push([x, y]); }
        perm = shuffle(pa.length, 5);
        for (i = 0; i < N; i++) {
          if (i < na) { b = pa[perm[i % pa.length]]; kd[i] = 1; lx[i] = b[0] - 62.5; ly[i] = b[1] - 22; }
          else kd[i] = 0;
        }
        gs = g;
      },
      run: function (o, p, t) {
        // der Zeiger faehrt mit jedem Stueck Scroll auf seinen Klickpunkt zu und wird groesser, die Wellen laufen mit
        var C = G.cur, ap = seg(p, 2.4, 5.6), press = 1 - .05 * sstep(5.6, 6.0, p), k = C.k * lerp(.8, 1, ap) * press, i, q, rr, an, RM = Math.sqrt(W * W + H * H) * .8, fl = t * .07 + p * .5, a, sz = Math.max(1.8, gs * k * .62);
        var tx = C.tx + (1 - ap) * W * (M ? .05 : .075) + (1 - press) * 40, ty = C.ty + (1 - ap) * H * (M ? .07 : .12) + (1 - press) * 40;
        for (i = 0; i < N; i++) {
          if (kd[i]) {
            o.x[i] = tx + lx[i] * k; o.y[i] = ty + ly[i] * k;
            o.a[i] = .82 + .18 * Math.sin(t * 1.3 + ly[i] * .2 - lx[i] * .1); o.s[i] = sz; o.r[i] = 0;
          } else {
            q = (Math.floor(R1[i] * 7) + fract(fl)) / 7; rr = q * RM; an = R2[i] * TAU + q * .6;
            o.x[i] = tx + Math.cos(an) * rr; o.y[i] = ty + Math.sin(an) * rr * .92;
            a = (1 - q) * .75 * sstep(0, .04, q);
            o.a[i] = a; o.s[i] = 1.5 + 1.6 * (1 - q); o.r[i] = R4[i] > .7 ? 1 : 0;
          }
        }
      }
    };
  })();

  /* 2 · Tuerme aus Klicks. Die beiden Namen stehen als Schrift am Fuss ihres Turms (HTML). */
  FORM.towers = (function () {
    var wx, wy, wz, kind, rowsH, D = 6, RH = .95, TA = 12, TW = 6;
    var K0 = 9.7, K1 = 16.7, KA = 6.0, KB = 9.4;
    function pr(c, x, y, z) { var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), Yc = y - c.camH, Zc = z + c.camD, Z2 = Yc * sp + Zc * cp; if (Z2 < .5) Z2 = .5; return [c.cx + x * c.f / Z2, c.cy - (Yc * cp - Zc * sp) * c.f / Z2, Z2]; }
    return {
      name: 'Türme',
      per: 0,
      init: function () {
        wx = new Float32Array(N); wy = new Float32Array(N); wz = new Float32Array(N); kind = new Uint8Array(N);
        var cf = M ? 7 : 12, cs = M ? 5 : 9, per = Math.floor(N * .335), rows = Math.floor(per / (cf + cs));
        per = rows * (cf + cs); rowsH = rows * RH; this.per = per;
        var Aa = clamp(12 * (W / H) / 1.6, 4.2, 12), Wd = M ? 3.2 : 6, i = 0, Tt, idx, row, col, sg;
        TA = Aa; TW = Wd;
        for (Tt = 0; Tt < 2; Tt++) {
          sg = Tt ? 1 : -1;
          for (idx = 0; idx < per; idx++, i++) {
            row = Math.floor(idx / (cf + cs)); col = idx % (cf + cs);
            if (col < cf) { wx[i] = sg * (Aa - Wd / 2 + (col + .5) / cf * Wd); wz[i] = -D / 2; }
            else { wx[i] = sg * (Aa - Wd / 2); wz[i] = -D / 2 + ((col - cf) + .5) / cs * D; }
            wy[i] = (row + .5) * RH; kind[i] = 0;
          }
        }
        var nF = Math.floor(N * .17), gc = Math.ceil(Math.sqrt(nF * .9)), gr = Math.ceil(nF / gc), c, r;
        for (idx = 0; idx < nF && i < N; idx++, i++) { c = idx % gc; r = Math.floor(idx / gc); wx[i] = (c / (gc - 1) - .5) * 120; wz[i] = -13 + (r / (gr - 1)) * 120; wy[i] = 0; kind[i] = 1; }
        for (; i < N; i++) kind[i] = 2;
      },
      cam: function (p) {
        var k = seg(p, K0, K1);
        return {
          k: k,
          camD: lerp(60, 16.4, eo(seg(p, KA, KB))) - .9 * seg(p, KB, 13.5),
          pitch: lerp(.05, .56, eio(seg(k, 0, .72))),
          camH: 1.4 + 14 * sstep(.62, 1, k),
          f: H * .56,
          cx: W * .5,
          cy: H * lerp(.7, .58, eio(seg(k, .1, .7))),
          built: lerp(10, rowsH, eio(seg(p, 6.3, 10.8)))
        };
      },
      run: function (o, p, t) {
        var c = this.cam(p), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), f = c.f, cx = c.cx, cy = c.cy, built = c.built;
        var pulse = fract(t * .08 + p * .16) * (Math.min(built, 60) + 24) - 12;
        var i, kd, Xw, Yw, Zw, am, over, Yc, Zc, Y2, Z2, sc, fog, tw, band;
        for (i = 0; i < N; i++) {
          kd = kind[i];
          if (kd === 2) {
            tw = .6 + .4 * Math.sin(t * (.6 + R3[i]) + R4[i] * 50);
            o.x[i] = R1[i] * W; o.y[i] = R2[i] * H * .8; o.a[i] = (.05 + .2 * R3[i]) * tw; o.s[i] = .8 + 1.3 * R4[i]; o.r[i] = 0; continue;
          }
          Xw = wx[i]; Yw = wy[i]; Zw = wz[i]; am = 1;
          if (kd === 0 && Yw > built) { over = Yw - built; Yw = built + 4 + over * 1.5 + Math.sin(t * .7 + R3[i] * 20) * 1.2; Xw += (R4[i] - .5) * over * .6; am = .34 * clamp(1 - over / 80, 0, 1); }
          Yc = Yw - c.camH; Zc = Zw + c.camD;
          Y2 = Yc * cp - Zc * sp; Z2 = Yc * sp + Zc * cp;
          if (Z2 < 1.5) { o.x[i] = cx + Xw * 40; o.y[i] = H + 60; o.a[i] = 0; o.s[i] = 1; o.r[i] = 0; continue; }
          sc = f / Z2;
          o.x[i] = cx + Xw * sc; o.y[i] = cy - Y2 * sc;
          fog = clamp(1.3 - Z2 / 115, .06, 1);
          if (kd === 1) { o.s[i] = clamp(sc * .06, .8, 2.6); o.a[i] = .46 * fog; o.r[i] = 0; }
          else {
            tw = .62 + .38 * Math.sin(t * (.8 + R3[i] * 2.2) + R4[i] * 60);
            band = Math.abs(wy[i] - pulse) < 2.4;
            o.s[i] = clamp(sc * .105, 1.6, 5.2);
            o.a[i] = clamp((.42 + .58 * tw) * fog * am * (band ? 1.7 : 1), 0, 1);
            o.r[i] = (band || R4[i] < .12) ? 1 : 0;
          }
        }
      },
      decor: function (w, p, t) {
        var c = this.cam(p), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
        // Lichtsaeulen: jede Turmfront leuchtet von unten
        var sg, a, b, cc, d, g, hh = Math.min(c.built, 70), e2, j, q;
        ctx.globalCompositeOperation = 'lighter';
        for (sg = -1; sg < 2; sg += 2) {
          a = pr(c, sg * (TA - TW / 2), 0, -D / 2); b = pr(c, sg * (TA + TW / 2), 0, -D / 2);
          cc = pr(c, sg * (TA + TW / 2), hh, -D / 2); d = pr(c, sg * (TA - TW / 2), hh, -D / 2);
          g = ctx.createLinearGradient(0, a[1], 0, Math.min(cc[1], d[1]));
          g.addColorStop(0, 'rgba(61,214,140,' + (.2 * w) + ')'); g.addColorStop(.45, 'rgba(180,230,205,' + (.07 * w) + ')'); g.addColorStop(1, 'rgba(244,245,242,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
          e2 = pr(c, sg * (TA - TW / 2), 0, D / 2); b = pr(c, sg * (TA - TW / 2), hh, D / 2);
          g = ctx.createLinearGradient(0, a[1], 0, Math.min(b[1], d[1]));
          g.addColorStop(0, 'rgba(61,214,140,' + (.11 * w) + ')'); g.addColorStop(1, 'rgba(244,245,242,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e2[0], e2[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
        }
        // Schein am Fluchtpunkt
        var vp = pr(c, 0, 400, 0), rg = ctx.createRadialGradient(vp[0], Math.max(vp[1], -H * .2), 0, vp[0], Math.max(vp[1], -H * .2), H * .7);
        rg.addColorStop(0, 'rgba(61,214,140,' + (.16 * w * c.k) + ')'); rg.addColorStop(1, 'rgba(61,214,140,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        // Stockwerke am rechten Turm: die Kamera steigt, die Marken wandern
        var lw = w * sstep(8.2, 9.2, p);
        if (lw > .02 && !M) {
          monoFont(9);
          for (j = 1; j < 14; j++) {
            q = pr(c, TA - TW / 2, j * 10 * RH, -D / 2);
            if (j * 10 * RH > c.built || q[1] < HT + 14 || q[1] > H - HB - 14 || q[2] < 3 || inZone(q[0] - 50, q[1], 30)) continue;
            ctx.globalAlpha = lw * .8; ctx.strokeStyle = FG[0]; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(q[0] - 26, q[1] + .5); ctx.lineTo(q[0] - 6, q[1] + .5); ctx.stroke();
            ctx.globalAlpha = lw * .62; ctx.fillStyle = FG[0]; label('E ' + j * 10, q[0] - 32, q[1], 'right', 1.2);
          }
          ctx.globalAlpha = 1;
        }
      }
    };
  })();

  /* 4 · Glut: Klicks verbrennen, Geld verdampft */
  FORM.embers = {
    name: 'Glut',
    init: function () {},
    heat: function (p) { return 1 - .35 * sstep(21.4, 23.4, p); },
    run: function (o, p, t) {
      var heat = this.heat(p);
      var i, sp, u, fx, fy, hot, a, fl, wr, r, s, mm = M ? .5 : 1;
      for (i = 0; i < N; i++) {
        sp = .03 + .075 * R3[i];
        u = fract(R2[i] + t * sp * (.55 + .6 * heat) + p * .03);
        fx = W * (.5 + (R1[i] - .5) * 1.2) + (Math.sin(t * (.5 + R4[i]) + R1[i] * 40) * (14 + 70 * u) + Math.sin(t * .21 + R3[i] * 9) * 26) * mm;
        fy = H * (1.08 - Math.pow(u, .8) * 1.25);
        hot = (1 - u) * heat;
        fl = .7 + .3 * Math.sin(t * 9 + R4[i] * 50);
        wr = sstep(0, .03, u) * sstep(1, .92, u);
        if (hot > .42) { r = R4[i] > .93 ? 0 : (R4[i] < .5 ? 2 : 3); a = (.5 + .5 * fl) * wr; s = 1.3 + 3.2 * R3[i] * (1 - u * .6); }
        else { r = R4[i] < .3 ? 3 : 4; a = (.2 + .34 * (1 - u)) * wr; s = 1.1 + 1.8 * R3[i]; }
        o.x[i] = fx; o.y[i] = fy; o.a[i] = a; o.s[i] = s; o.r[i] = r;
      }
    },
    decor: function (w, p, t) { glow(w * this.heat(p), p, t, 1); }
  };
  /* Glut am unteren Rand und Geld, das nach oben verdampft */
  function glow(heat, p, t, euros) {
    if (heat < .01) return;
    var g = ctx.createLinearGradient(0, H, 0, H * .35);
    g.addColorStop(0, 'rgba(255,70,30,' + (.42 * heat) + ')');
    g.addColorStop(.4, 'rgba(255,46,46,' + (.14 * heat) + ')');
    g.addColorStop(1, 'rgba(255,46,46,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, H * .35, W, H * .65);
    var n = Math.round((M ? 12 : 30) * euros), i, u, x, y, a, sz, rr = mulberry(77), zi, zn;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < n; i++) {
      var a1 = rr(), a2 = rr(), a3 = rr(), a4 = rr();
      u = fract(a2 + t * (.035 + .04 * a3) + p * .03);
      x = W * (.06 + a1 * .88) + Math.sin(t * (.4 + a4) + a1 * 30) * (20 + 50 * u);
      y = H * (1.06 - u * 1.15);
      a = sstep(0, .08, u) * sstep(.95, .45, u) * heat * .85;
      for (zi = 0; zi < ZA.length; zi++) { zn = ZA[zi]; if (x > zn.x0 - 40 && x < zn.x1 + 40 && y > zn.y0 - 40 && y < zn.y1 + 40) a *= 1 - zn.k; }
      if (y < HT + 20 || y > H - HB - 20 || (!M && x < IX + 20)) a *= .25;
      if (a < .02) continue;
      sz = (M ? 14 : 18) + a3 * (M ? 16 : 30);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * .6 + a4 * 20) * .5 + (a1 - .5));
      ctx.font = '800 ' + sz + 'px Manrope, sans-serif';
      ctx.fillStyle = u < .4 ? 'rgba(255,110,50,' + a + ')' : 'rgba(255,46,46,' + (a * .8) + ')';
      ctx.fillText('€', 0, 0); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* 5 · Die Luecken: ein Funnel aus vier Stuecken, dazwischen drei kleine Luecken. Durch jede faellt ein Teil der Klicks
     und verglueht. In Kapitel 3 rastet das Bild ein: die Stuecke richten sich aus, dieselben Luecken schliessen sich. */
  FORM.leak = (function () {
    var JO = [.25, .5, .75], DY = [0, .7, -.6, .5], TI = [-.8, .9, -.7, .6], HA = [26.8, 26.45, 26.8];
    var al = 0, hj = [0, 0, 0], gp = 0;
    function state(p) {
      al = eio(seg(p, 26.3, 27.05));
      for (var j = 0; j < 3; j++) hj[j] = sstep(HA[j], HA[j] + .5, p);
      gp = (M ? 9 : 17) / (G.leak.xb - G.leak.xa);   // halbe Luecke in Streckenanteilen
    }
    function q4(s) { return s < JO[0] ? 0 : s < JO[1] ? 1 : s < JO[2] ? 2 : 3; }
    function pipeY(s) { var L = G.leak, q = q4(s), s0 = q ? JO[q - 1] : 0, s1 = q < 3 ? JO[q] : 1; return L.y + (DY[q] + TI[q] * ((s - s0) / (s1 - s0) - .5)) * L.hw * (1 - al); }
    function xAt(s) { return lerp(G.leak.xa, G.leak.xb, s); }
    /* Linie, die an jeder Stelle die Farbe ihrer Welt traegt (der Wischer laeuft mitten durch das Bild) */
    function wline(x0, y0, x1, y1, n) {
      var i, ax, ay, bx, by;
      for (i = 0; i < n; i++) {
        ax = lerp(x0, x1, i / n); ay = lerp(y0, y1, i / n); bx = lerp(x0, x1, (i + 1) / n); by = lerp(y0, y1, (i + 1) / n);
        ctx.strokeStyle = FG[worldAt((ax + bx) / 2, (ay + by) / 2)];
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
    return {
      name: 'Lücken',
      init: function () {},
      gap: function (j) { return [xAt(JO[j]), G.leak.y]; },
      run: function (o, p, t) {
        state(p);
        var L = G.leak, hw = L.hw, i, u, f, jl, tau, x, y, a, s, r, fate, fl, done = al > .98 && hj[0] > .98;
        for (i = 0; i < N; i++) {
          u = fract(R1[i] + t * (.035 + .04 * R3[i]) + p * .04);
          f = R4[i]; fate = f < .3 ? 0 : f < .58 ? 1 : f < .86 ? 2 : 3;
          jl = fate < 3 ? JO[fate] : 2;
          if (fate < 3 && hj[fate] > R2[i] * .98) jl = 2;          // die Luecke ist zu: dieser Klick bleibt im Funnel
          if (u > jl) {
            // durch die Luecke nach unten: erst weiss, dann Glut
            tau = (u - jl) / .3;
            if (tau >= 1) { o.x[i] = xAt(jl); o.y[i] = pipeY(jl) + hw + L.fall; o.a[i] = 0; o.s[i] = 1; o.r[i] = 3; continue; }
            fl = .7 + .3 * Math.sin(t * 9 + R4[i] * 50);
            x = xAt(jl) + (R3[i] - .5) * gp * (L.xb - L.xa) * 1.5 + (R2[i] - .5) * tau * (M ? 26 : 60) + Math.sin(t * (.6 + R3[i]) + R2[i] * 40) * 5 * tau;
            y = Math.max(pipeY(jl - .001), pipeY(jl + .001)) + hw * .6 + Math.pow(tau, 1.7) * L.fall * (.55 + .45 * R2[i]);
            a = Math.pow(1 - tau, .9) * (.6 + .4 * fl); s = 1.6 + 2.6 * R3[i] * (1 - tau * .4); r = tau < .16 ? 0 : tau < .55 ? 2 : 3;
          } else {
            x = xAt(u); y = pipeY(u) + (R2[i] - .5) * 1.7 * hw;
            a = (.55 + .3 * R3[i]) * sstep(0, .03, u) * sstep(1, .97, u); s = 1.5 + 1.2 * R3[i];
            r = done && u > .5 + R3[i] * .3 ? 1 : 0;
          }
          o.x[i] = x; o.y[i] = y; o.a[i] = a; o.s[i] = s; o.r[i] = r;
        }
      },
      decor: function (w, p, t) {
        state(p);
        var L = G.leak, hw = L.hw * 1.35, q, s0, s1, x0, x1, y0, y1, j, gx, gy, gw, rad, gr, fl, open, k;
        var emb = w * (1 - sstep(26.0, 26.7, p)), ck;
        if (w < .01) return;
        if (emb > .01) {
          glow(emb * .62, p, t, .4);
          ctx.globalCompositeOperation = 'lighter';
          for (j = 0; j < 3; j++) {
            gx = xAt(JO[j]); gy = Math.max(pipeY(JO[j] - .001), pipeY(JO[j] + .001)) + hw + L.fall * .3; fl = 1 + .08 * Math.sin(t * 5 + j * 2);
            rad = (M ? 80 : 170) * fl; gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
            gr.addColorStop(0, 'rgba(255,90,42,' + (.3 * emb) + ')'); gr.addColorStop(.4, 'rgba(255,46,46,' + (.11 * emb) + ')'); gr.addColorStop(1, 'rgba(255,46,46,0)');
            ctx.fillStyle = gr; ctx.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // die vier Stuecke des Funnels, an jeder Luecke offen
        ctx.lineWidth = 1.3;
        for (q = 0; q < 4; q++) {
          s0 = q ? JO[q - 1] + gp * (1 - hj[q - 1]) : 0; s1 = q < 3 ? JO[q] - gp * (1 - hj[q]) : 1;
          x0 = xAt(s0); x1 = xAt(s1); y0 = pipeY(s0 + .0005); y1 = pipeY(s1 - .0005);
          ctx.globalAlpha = .7 * w;
          wline(x0, y0 - hw, x1, y1 - hw, 10); wline(x0, y0 + hw, x1, y1 + hw, 10);
          ctx.globalAlpha = .95 * w;
          if (!q || hj[q - 1] < .99) wline(x0, y0 - hw - 6, x0, y0 + hw + 6, 2);
          if (q === 3 || hj[q] < .99) wline(x1, y1 - hw - 6, x1, y1 + hw + 6, 2);
        }
        // Luecken: offen mit Marke und Namen, geschlossen mit Haken
        monoFont(M ? 9 : 10);
        for (j = 0; j < 3; j++) {
          gx = xAt(JO[j]); gw = gp * (L.xb - L.xa) * (1 - hj[j]); open = 1 - hj[j];
          gy = Math.min(pipeY(JO[j] - .001), pipeY(JO[j] + .001)) - hw - (M ? 13 : 18);
          if (open > .02) {
            k = emb > .01 ? 1 : 0;
            ctx.globalAlpha = w * open; ctx.strokeStyle = '#ff5a2a'; ctx.fillStyle = '#ff5a2a'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(gx - gw - 4, gy + 7); ctx.lineTo(gx - gw - 4, gy); ctx.lineTo(gx + gw + 4, gy); ctx.lineTo(gx + gw + 4, gy + 7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - (M ? 8 : 12)); ctx.stroke();
            if (k) label('LÜCKE 0' + (j + 1), gx, gy - (M ? 17 : 23), 'center', 2);
          }
          ck = eo(seg(hj[j], .55, 1));
          if (ck > .02) {
            gy = L.y - hw - (M ? 16 : 22);
            ctx.globalAlpha = w * ck; ctx.strokeStyle = '#0f9d5b'; ctx.fillStyle = '#0f9d5b'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(gx, gy, 9, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(gx - 4, gy + .5); ctx.lineTo(gx - 1, gy + 3.5); ctx.lineTo(gx + 4.5, gy - 3); ctx.stroke();
            ctx.globalAlpha = w * ck * (1 - ck) * 2.4; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(gx, gy, 9 + 22 * ck, 0, TAU); ctx.stroke();
            ctx.lineCap = 'butt';
            ctx.globalAlpha = w * ck * .85; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(gx, L.y - hw - 1); ctx.lineTo(gx, L.y + hw + 1); ctx.stroke();
          }
        }
        ctx.globalAlpha = .78 * w;
        ctx.fillStyle = FG[worldAt(L.xa + 20, L.y - hw - 30)]; label('KLICK', L.xa, pipeY(.001) - hw - (M ? 18 : 26), 'left', 2);
        ctx.fillStyle = FG[worldAt(L.xb - 20, L.y - hw - 30)]; label(al > .5 ? 'KUNDE' : 'KAUF', L.xb, pipeY(.999) - hw - (M ? 18 : 26), 'right', 2);
        ctx.globalAlpha = 1;
      }
    };
  })();

  /* 6 · Raster */
  var GRID = { x: null, y: null, mj: null, cnt: 0, gs: 0, rk: null, ra: null };
  FORM.grid = {
    name: 'Raster',
    init: function () {
      var gs = Math.sqrt(W * H / (N * .6)), cols, rows, cnt;
      for (;;) { cols = Math.ceil(W / gs) + 1; rows = Math.ceil(H / gs) + 1; cnt = cols * rows; if (cnt <= N) break; gs *= 1.03; }
      var ox = (W - (cols - 1) * gs) / 2, oy = (H - (rows - 1) * gs) / 2, perm = shuffle(cnt, 29), i, c, cc, rr, rd = mulberry(5);
      GRID.x = new Float32Array(N); GRID.y = new Float32Array(N); GRID.mj = new Uint8Array(N); GRID.cnt = cnt; GRID.gs = gs;
      GRID.rk = new Uint8Array(N); GRID.ra = new Float32Array(N);
      var q, nE = N - cnt, e = 0;
      for (i = 0; i < N; i++) {
        c = i < cnt ? perm[i] : Math.floor(rd() * cnt);
        cc = c % cols; rr = Math.floor(c / cols);
        GRID.x[i] = ox + cc * gs; GRID.y[i] = oy + rr * gs; GRID.mj[i] = (cc % 8 === 0 || rr % 8 === 0) ? 1 : 0;
        if (i >= cnt) { q = e / nE; e++; GRID.rk[i] = q < .25 ? 1 : q < .42 ? 2 : q < .5 ? 3 : q < .63 ? 4 : q < .76 ? 5 : 6; GRID.ra[i] = rd(); }
      }
      var cntK = [0, 0, 0, 0, 0, 0, 0], seenK = [0, 0, 0, 0, 0, 0, 0];
      for (i = cnt; i < N; i++) cntK[GRID.rk[i]]++;
      for (i = cnt; i < N; i++) { q = GRID.rk[i]; GRID.ra[i] = (seenK[q] + .5) / cntK[q]; seenK[q]++; }
    },
    run: function (o, p, t) {
      var scan = W * (-.12 + 1.24 * seg(p, 28.7, 31.5)), i, x, y, d, a, s, r, mj, k, rk, ra, ang, rr, ti;
      var Wr = G.wire, cx = Wr.cx, cy = Wr.cy, R = Wr.h * (M ? .42 : .44), lock = eio(seg(p, 28.9, 30.5)), sc = lerp(1.5, 1, lock), rot = (1 - lock) * 1.1 + p * .05, RS = [0, 1, .66, .33];
      for (i = 0; i < N; i++) {
        if (i < GRID.cnt) {
          x = GRID.x[i]; y = GRID.y[i]; mj = GRID.mj[i];
          a = mj ? .62 : .27; s = mj ? 2.1 : 1.5; r = 0;
        } else {
          rk = GRID.rk[i]; ra = GRID.ra[i]; a = .8; s = 1.7; r = 0;
          if (rk < 4) { ang = ra * TAU + rot * (rk === 2 ? -1 : 1); rr = R * RS[rk] * (rk === 1 ? sc : rk === 2 ? lerp(sc, 1, .5) : 1); x = cx + Math.cos(ang) * rr; y = cy + Math.sin(ang) * rr; if (rk === 3) { r = 1; s = 2; } }
          else if (rk === 4) { x = cx + (ra * 2 - 1) * R * 1.32; y = cy; if (Math.abs(x - cx) < R * .08) a = 0; }
          else if (rk === 5) { x = cx; y = cy + (ra * 2 - 1) * R * 1.32; if (Math.abs(y - cy) < R * .08) a = 0; }
          else { ti = Math.floor(ra * 48); k = ra * 48 - ti; ang = ti / 48 * TAU - rot * .5; rr = R * sc * (1.05 + k * (ti % 4 === 0 ? .12 : .05)); x = cx + Math.cos(ang) * rr; y = cy + Math.sin(ang) * rr; a = .7; s = 1.4; }
        }
        d = Math.abs(x - scan);
        if (d < 46 && a > 0) { k = 1 - d / 46; r = 1; s += k * 1.8; a = Math.max(a, .35 + .65 * k); }
        o.x[i] = x; o.y[i] = y; o.a[i] = a; o.s[i] = s; o.r[i] = r;
      }
    },
    decor: function (w, p) {
      var Wr = G.wire, lock = eio(seg(p, 28.9, 30.5));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = w * lock; ctx.fillStyle = '#0f9d5b';
      ctx.beginPath(); ctx.arc(Wr.cx, Wr.cy, 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  };

  /* 7 · Landingpage als Drahtmodell. Jeder der drei Saetze zeigt auf sein Bauteil. */
  var TS3 = [32.15, 33.0, 33.85];
  FORM.wire = (function () {
    var px, py, pg, isW;
    function build() {
      var P = [];
      function line(x1, y1, x2, y2, g) { P.push({ t: 0, a: [x1, y1, x2, y2], g: g, w: Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) }); }
      function rect(x, y, w, h, g) { line(x, y, x + w, y, g); line(x + w, y, x + w, y + h, g); line(x + w, y + h, x, y + h, g); line(x, y + h, x, y, g); }
      function fill(x, y, w, h, g, d) { P.push({ t: 1, a: [x, y, w, h], g: g, w: w * h * d }); }
      function circ(cx, cy, r, g, a0, a1) { if (a0 === undefined) { a0 = 0; a1 = TAU; } P.push({ t: 2, a: [cx, cy, r, a0, a1], g: g, w: r * Math.abs(a1 - a0) }); }
      function star(cx, cy, r, g) { var i, a, b, r1, r2; for (i = 0; i < 10; i++) { a = -PI / 2 + i * PI / 5; b = a + PI / 5; r1 = i % 2 ? r * .44 : r; r2 = i % 2 ? r : r * .44; line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(b) * r2, cy + Math.sin(b) * r2, g); } }
      function check(cx, cy, r, g) { line(cx - r * .45, cy + r * .02, cx - r * .1, cy + r * .36, g); line(cx - r * .1, cy + r * .36, cx + r * .5, cy - r * .34, g); }
      var s, c, x;
      rect(0, 0, 1, 1.25, 4); line(0, .065, 1, .065, 4);
      circ(.035, .033, .009, 4); circ(.065, .033, .009, 4); circ(.095, .033, .009, 4);
      fill(.06, .105, .12, .028, 0, 34);
      line(.62, .119, .70, .119, 0); line(.74, .119, .82, .119, 0); line(.86, .119, .94, .119, 0);
      fill(.06, .215, .50, .05, 0, 30); fill(.06, .285, .36, .05, 0, 30);
      line(.06, .375, .52, .375, 0); line(.06, .405, .48, .405, 0); line(.06, .435, .34, .435, 0);
      fill(.06, .49, .27, .075, 3, 46);
      circ(.77, .335, .14, 2); circ(.77, .30, .048, 2); circ(.77, .455, .085, 2, PI + .3, TAU - .3);
      line(.06, .62, .94, .62, 4);
      for (s = 0; s < 5; s++) star(.085 + s * .058, .675, .024, 1);
      for (s = 0; s < 3; s++) { circ(.60 + s * .13, .675, .042, 1); check(.60 + s * .13, .675, .042, 1); }
      for (c = 0; c < 3; c++) { x = .06 + c * .305; rect(x, .76, .27, .19, 1); circ(x + .045, .805, .025, 1); line(x + .09, .795, x + .23, .795, 1); line(x + .09, .82, x + .19, .82, 1); line(x + .03, .87, x + .24, .87, 1); line(x + .03, .90, x + .21, .90, 1); }
      rect(.06, 1.01, .58, .075, 4); fill(.67, 1.01, .27, .075, 3, 46);
      line(.06, 1.15, .4, 1.15, 4); line(.06, 1.18, .3, 1.18, 4);
      return P;
    }
    return {
      name: 'Seite',
      init: function () {
        var Wr = G.wire, P = build(), tot = 0, i, j, n, q, pts = [], a, cols, rows, k;
        for (i = 0; i < P.length; i++) tot += P[i].w;
        var target = Math.min(Math.floor(N * .66), Math.floor(tot * Wr.s / (M ? 2.6 : 3.1)));
        for (i = 0; i < P.length; i++) {
          q = P[i]; n = Math.max(2, Math.round(target * q.w / tot)); a = q.a;
          if (q.t === 0) for (j = 0; j < n; j++) { k = (j + .5) / n; pts.push([a[0] + (a[2] - a[0]) * k, a[1] + (a[3] - a[1]) * k, q.g]); }
          else if (q.t === 2) for (j = 0; j < n; j++) { k = a[3] + (a[4] - a[3]) * (j + .5) / n; pts.push([a[0] + Math.cos(k) * a[2], a[1] + Math.sin(k) * a[2], q.g]); }
          else { cols = Math.max(2, Math.round(Math.sqrt(n * a[2] / a[3]))); rows = Math.max(2, Math.ceil(n / cols)); for (j = 0; j < cols * rows; j++) pts.push([a[0] + ((j % cols) + .5) / cols * a[2], a[1] + (Math.floor(j / cols) + .5) / rows * a[3], q.g]); }
        }
        px = new Float32Array(N); py = new Float32Array(N); pg = new Uint8Array(N); isW = new Uint8Array(N);
        var m = GRID.gs * 1.2, x0 = Wr.x0 - m, y0 = Wr.y0 - m, x1 = Wr.x0 + Wr.s + m, y1 = Wr.y0 + Wr.h + m, cand = [], out = [];
        for (i = 0; i < N; i++) { if (i >= GRID.cnt || (GRID.x[i] > x0 && GRID.x[i] < x1 && GRID.y[i] > y0 && GRID.y[i] < y1)) cand.push(i); else out.push(i); }
        var perm = shuffle(pts.length, 41), pi = 0, need = pts.length - cand.length;
        for (j = 0; j < out.length && need > 0; j += 3) { cand.push(out[j]); out[j] = -1; need--; }
        for (j = 0; j < cand.length; j++) {
          i = cand[j];
          q = pts[perm[pi % pts.length]]; pi++;
          px[i] = Wr.x0 + q[0] * Wr.s; py[i] = Wr.y0 + q[1] * Wr.s; pg[i] = q[2]; isW[i] = 1;
        }
      },
      hl: function (p) {
        var h0 = sstep(TS3[0], TS3[0] + .5, p) * (1 - sstep(TS3[1], TS3[1] + .5, p)), h1 = sstep(TS3[1], TS3[1] + .5, p) * (1 - sstep(TS3[2], TS3[2] + .5, p)), h2 = sstep(TS3[2], TS3[2] + .5, p);
        var all = sstep(35.7, 36.4, p);   // Aufloesung: die ganze Seite wird gruen, alles stimmt
        return [Math.max(h0, all), Math.max(h1, all), Math.max(h2, all), 1, all];
      },
      run: function (o, p, t) {
        var hl = this.hl(p), i, g, l;
        for (i = 0; i < N; i++) {
          if (isW[i]) { g = pg[i]; l = hl[g]; o.x[i] = px[i]; o.y[i] = py[i]; o.r[i] = l > .5 ? 1 : 0; o.a[i] = lerp(.62, 1, l); o.s[i] = lerp(1.7, 2.5, l); }
          else { o.x[i] = GRID.x[i]; o.y[i] = GRID.y[i]; o.r[i] = 0; o.a[i] = GRID.mj[i] ? .3 : .13; o.s[i] = 1.4; }
        }
      },
      decor: function (w, p) {
        if (M || !G.three || G.three.length < 3) return;
        var Wr = G.wire, AN = [[.055, .25], [.055, .675], [.625, .335]], hl = this.hl(p), out = 1 - sstep(35.0, 35.4, p), j, k, li, x1, y1, x2, y2, mx, L1, L2, L3, L, d;
        if (out <= 0) return;
        ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = 'round';
        for (j = 0; j < 3; j++) {
          k = eo(seg(p, TS3[j] - .05, TS3[j] + .55)); if (k <= 0) continue;
          li = G.three[j]; x1 = li.x; y1 = li.y; x2 = Wr.x0 + AN[j][0] * Wr.s - 10; y2 = Wr.y0 + AN[j][1] * Wr.s;
          mx = Math.min(x2 - 14, Math.max(x1 + 14, Wr.x0 - 26 - j * 12));
          L1 = mx - x1; L2 = Math.abs(y2 - y1); L3 = x2 - mx; L = L1 + L2 + L3; d = L * k;
          ctx.globalAlpha = w * out * (.45 + .55 * hl[j]); ctx.strokeStyle = '#0f9d5b'; ctx.fillStyle = '#0f9d5b'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.min(d, L1), y1);
          if (d > L1) ctx.lineTo(mx, y1 + (y2 - y1) * Math.min(1, (d - L1) / Math.max(1, L2)));
          if (d > L1 + L2) ctx.lineTo(mx + Math.min(d - L1 - L2, L3), y2);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, TAU); ctx.fill();
          if (k > .96) ctx.fillRect(x2 - 4, y2 - 4, 8, 8);
        }
        ctx.globalAlpha = 1;
      }
    };
  })();

  /* 8 · Drei Balken: bauen, optimieren, skalieren */
  var BARW = [[12, 70, 27, 33], [50.5, 52, 27, 51], [89, 31, 27, 72]];
  FORM.bars = (function () {
    var bj, bu, bv;
    return {
      name: 'Balken',
      init: function () {
        bj = new Uint8Array(N); bu = new Float32Array(N); bv = new Float32Array(N);
        var r = mulberry(91), nb = Math.floor(N * .72), ns = Math.floor(N * .17), i, q;
        for (i = 0; i < N; i++) {
          if (i < nb) { q = r() * 2808; bj[i] = q < 594 ? 0 : q < 1512 ? 1 : 2; bu[i] = r() < .3 ? (r() < .5 ? 0 : 1) : r(); bv[i] = r(); }
          else if (i < nb + ns) { bj[i] = 3; q = r() * 2808; bu[i] = (q < 594 ? 0 : q < 1512 ? 1 : 2) + r() * .999; bv[i] = r(); }
          else { bj[i] = 4; r(); r(); }
        }
      },
      run: function (o, p, t) {
        var I = G.icon, u = I.S / 128, x0 = I.cx - 64 * u, y0 = I.cy - 64 * u;
        var g1 = seg(p, 38.9, 40.3), rough = 1 - sstep(40.3, 40.9, p), g3 = sstep(41.2, 42.2, p), inflow = sstep(42.7, 43.5, p), flow = t * .16 + p * .22;
        var i, j, b, grow, hh, v, jb, uu, tx, a, tw;
        for (i = 0; i < N; i++) {
          j = bj[i];
          if (j < 3) {
            b = BARW[j]; grow = eo(seg(g1 - j * .14, 0, .7));
            hh = b[3] * grow * (1 + g3 * (2.4 + j * .7));
            v = fract(bv[i] + flow * (.35 + .5 * R3[i]));
            o.x[i] = x0 + (b[0] + bu[i] * b[2] + (R4[i] - .5) * rough * b[2] * .9) * u; o.y[i] = y0 + (103 - v * hh * (1 + (R3[i] - .5) * rough * .5)) * u;
            o.a[i] = grow > .02 ? (.5 + .5 * R4[i]) * sstep(0, .05, v) * sstep(1, .95, v) : 0;
            o.s[i] = 1.5 + 1.7 * R3[i]; o.r[i] = rough > .5 && R4[i] > .45 ? 0 : 1;
          } else if (j === 3) {
            jb = Math.floor(bu[i]); b = BARW[jb]; uu = fract(R1[i] + flow * (.5 + .5 * R3[i]));
            tx = x0 + (b[0] + (bu[i] - jb) * b[2]) * u;
            if (inflow > .01) {
              if (M) { o.x[i] = tx + (R2[i] - .5) * 60 * (1 - uu); o.y[i] = lerp(H * 1.05, y0 + 103 * u, uu); }
              else { o.x[i] = lerp(-W * .06, tx, uu); o.y[i] = y0 + 103 * u + (R2[i] - .5) * 30 * u * (1 - uu * uu) + Math.sin(uu * 9 + R4[i] * 20) * 3; }
              o.a[i] = inflow * .8 * sstep(0, .05, uu) * sstep(1, .93, uu); o.s[i] = 1.5 + R4[i] * 1.4; o.r[i] = 0;
            } else {
              tw = .6 + .4 * Math.sin(t + R4[i] * 40);
              o.x[i] = R1[i] * W; o.y[i] = R2[i] * H; o.a[i] = .1 * tw; o.s[i] = 1 + R3[i]; o.r[i] = 0;
            }
          } else {
            tw = .6 + .4 * Math.sin(t * .8 + R4[i] * 40);
            o.x[i] = R1[i] * W + Math.sin(t * .2 + R3[i] * 9) * 20; o.y[i] = fract(R2[i] - t * .01 * Z[i] - p * .02) * H;
            o.a[i] = (.06 + .16 * R3[i]) * tw; o.s[i] = .9 + 1.2 * R4[i]; o.r[i] = 0;
          }
        }
      },
      decor: function (w, p) {
        var I = G.icon, u = I.S / 128, y = Math.round(I.cy - 64 * u + 103 * u) + 1.5;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .3 * w; ctx.strokeStyle = FG[0]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(M ? 0 : IX, y); ctx.lineTo(W, y); ctx.stroke(); ctx.globalAlpha = 1;
      }
    };
  })();

  /* 9 · Tempo */
  FORM.streaks = {
    name: 'Tempo',
    init: function () {},
    run: function (o, p, t) {
      var flow = t * .5 + p * .6, i, z, sp, uu, y, q;
      for (i = 0; i < N; i++) {
        z = Z[i]; sp = .1 + .8 * z * z; uu = fract(R1[i] + flow * sp);
        q = R2[i];
        y = q < .5 ? H * (.1 + .2 * q * 2) : H * (.7 + .2 * (q - .5) * 2);
        o.x[i] = W * (1.25 - uu * 1.5); o.y[i] = y;
        o.a[i] = R3[i] < (M ? .6 : .24) ? (.35 + .65 * z) * sstep(0, .06, uu) * sstep(1, .94, uu) : 0;
        o.s[i] = 1 + 2 * z; o.r[i] = R4[i] < .12 ? 1 : 0;
      }
    }
  };

  /* 10 · Der Weg: Strom durch fuenf Stationen. Die Kamera faehrt jede Station an und zieht dann in die Totale. */
  FORM.funnel = (function () {
    var fk, fd, fo, fb, bu, bv;
    var FR = [[55.8, -.8], [58.5, 0], [59.5, .5], [60.2, 1], [61.0, 1.5], [61.7, 2], [62.5, 2.5], [63.2, 3], [64.1, 3.5], [64.8, 4], [65.5, 4.6]];
    var CAM = [[55.6, -.45], [58.5, 0], [59.5, 0], [60.2, 1], [61.0, 1], [61.7, 2], [62.5, 2], [63.2, 3], [64.1, 3], [64.8, 4]];
    var OV0 = 65.5, OV1 = 66.45;
    var C = { x0: 0, D: 1, cz: 1, c: 0, ov: 1, sc: 0, zs: 1 };
    function ringAt(k) { return G.fun.hw[k] * 1.16 + 8; }
    function ringS(s) { s = clamp(s, 0, 4); var k = Math.floor(s); if (k >= 4) return ringAt(4); return lerp(ringAt(k), ringAt(k + 1), sstep(0, 1, s - k)); }
    function hwAt(s) { var h = G.fun.hw, k; if (s < 0) return lerp(G.fun.hin, h[0], sstep(-.8, -.05, s)); if (s >= 4) return h[4]; k = Math.floor(s); return lerp(h[k], h[k + 1], sstep(.5, 1, s - k)); }
    function along(s) { return C.x0 + s * C.D; }
    function cam(p) {
      var F_ = G.fun, sc = keysE(p, CAM), ov = eio(seg(p, OV0, OV1)), Do = (F_.a4 - F_.a0) / 4, czc = clamp(F_.ring / ringS(sc), 1, F_.czMax);
      C.sc = sc; C.ov = ov; C.D = lerp(F_.Dc, Do, ov); C.cz = lerp(czc, 1, ov);
      C.x0 = lerp(F_.fc - sc * F_.Dc, F_.a0, ov); C.c = lerp(F_.cc, F_.c, ov);
      C.zs = 1 + (C.cz - 1) * .42 + (1 - ov) * .75; C.ab = 1 + (1 - ov) * .7; C.ch = G.fun.chute * Math.min(C.cz, 1.9) / C.cz;
      return C;
    }
    function put(o, i, al, cr) { if (G.fun.vert) { o.x[i] = C.c + cr * C.cz; o.y[i] = al; } else { o.x[i] = al; o.y[i] = C.c + cr * C.cz; } }
    /* Messuhr k sitzt zwischen Station k und k + 1 auf der Huelle. Dieselbe Rechnung dient dem Bild und der Schaltflaeche. */
    function gaugeAt(k, front, g) {
      var vert = G.fun.vert, rg = (vert ? G.fun.rg : 12.5) * C.zs, st = (vert ? lerp(27, 3, C.ov) : 14) * C.zs, fr = vert ? (k === 0 ? .6 : k === 3 ? .42 : .58) : .56;
      // Handy, Totale: die Uhr steht in einer eigenen Spalte zwischen Huelle und Schrift und endet ueber dem Zaehler der naechsten Station
      if (vert) fr = Math.min(fr, (C.D - 34 - rg) / C.D);
      var s = k + fr, hull = (hwAt(s) * 1.16 + 8) * C.cz;
      g.r = rg; g.v = sstep(k + .3, k + .6, front);
      if (G.fun.vert) { g.x = C.c + hull + st + rg; g.y = along(s); g.ax = C.c + hull; g.ay = g.y; g.ok = g.y - rg > HT + 8 && g.y + rg < H - HB - 8 && g.x + rg < W - 10; }
      else { g.x = along(s); g.y = C.c - hull - st - rg; g.ax = g.x; g.ay = C.c - hull; g.ok = g.x - rg > IX + 4 && g.x + rg < W - 12 && g.y - rg > HT + 8; }
      return g;
    }
    var GT = { x: 0, y: 0, r: 0, v: 0, ax: 0, ay: 0, ok: false };
    return {
      name: 'Strom',
      gauge: function (k, p, g) { cam(p); return gaugeAt(k, keys(p, FR), g); },
      /* feine Linie von der gezeigten Uhr zu ihrer Karte */
      lead: function (w, p) {
        var i = GZ.hot > -1 ? GZ.hot : GZ.pin, hk, px, py, dx, dy, d;
        if (i < 0 || !GZ.cw) return; hk = GZ.k[i]; if (hk < .05) return;
        cam(p); gaugeAt(i, keys(p, FR), GT);
        px = clamp(GT.x, GZ.cx + 10, GZ.cx + GZ.cw - 10); py = clamp(GT.y, GZ.cy, GZ.cy + GZ.ch);
        dx = px - GT.x; dy = py - GT.y; d = Math.sqrt(dx * dx + dy * dy); if (d < GT.r + 8) return;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = w * hk * .8; ctx.strokeStyle = 'rgb(61,214,140)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(GT.x + dx / d * (GT.r + 5), GT.y + dy / d * (GT.r + 5)); ctx.lineTo(px, py); ctx.stroke(); ctx.globalAlpha = 1;
      },
      init: function () {
        fk = new Uint8Array(N); fd = new Float32Array(N); fo = new Float32Array(N); fb = new Uint8Array(N); bu = new Float32Array(N); bv = new Float32Array(N);
        var r = mulberry(303), nBar = Math.floor(N * .16), nLoop = Math.floor(N * .05), i, q;
        for (i = 0; i < N; i++) {
          if (i < nBar) { fk[i] = 1; q = r() * 2808; fb[i] = q < 594 ? 0 : q < 1512 ? 1 : 2; bu[i] = r() < .22 ? (r() < .5 ? 0 : 1) : r(); bv[i] = r(); }
          else if (i < nBar + nLoop) { fk[i] = 2; }
          else {
            fk[i] = 0; q = r();
            fd[i] = q < .38 ? 1 : q < .66 ? 2 : q < .88 ? 3 : q < .91 ? 4 : 9;
            if (fd[i] < 9) fd[i] -= .04 + r() * .08;
            fo[i] = (r() + r() + r()) / 1.5 - 1;
          }
        }
      },
      front: function (p) { return keys(p, FR); },
      cam: cam, ringAt: ringAt,
      run: function (o, p, t) {
        var F_ = G.fun, vert = F_.vert, front = keys(p, FR);
        cam(p);
        var rl = sstep(65.35, 66.85, p), boom = sstep(68.8, 69.6, p), ll = sstep(66.45, 67.15, p), flow = t * .05 + p * .014, dir = vert ? -1 : 1, zs = C.zs, MK = F_.mk, lk = sstep(66.75, 67.2, p) * (1 - sstep(68.55, 68.8, p));
        var i, kd, u, s, ds, off, al, cr, a, r, sz, sg, tau, wait, hw, j, v, h, q, L, d, kst, e1, env;
        var AL = [.5, .62, .8, 1], SZ = [1.5, 1.8, 2.1, 2.9];
        var lp = F_.loop, L1 = lp.l1, L2 = lp.l2, L3 = lp.l3; L = L1 + L2 + L3;
        for (i = 0; i < N; i++) {
          kd = fk[i];
          if (kd === 0) {
            u = fract(R1[i] + flow * (.7 + .6 * R3[i]));
            s = -.8 + 5.2 * (.42 * u + .58 * u * u);
            wait = 0;
            ds = fd[i]; off = fo[i];
            q = front - R4[i] * R4[i] * .55 - off * off * .22;
            if (s > q) { s = q; wait = 1; }
            if (s <= ds) {
              al = along(s); hw = hwAt(s);
              cr = off * hw + Math.sin(t * 1.3 + R2[i] * 40 + s * 3) * hw * (wait ? .2 : .07);
              sg = s < 1 ? 0 : s < 2 ? 1 : s < 3 ? 2 : 3;
              a = AL[sg]; r = s > 3 ? 1 : 0; sz = (SZ[sg] + R3[i]) * zs;
              if (s > 4) a *= 1 - seg(s, 4, 4.3);
              if (wait) a *= .62;
              a = Math.min(1, a * C.ab);
              a *= sstep(-.8, -.62, s) * sstep(0, .02, u) * sstep(1, .985, u);
            } else {
              tau = (s - ds) / 1.05; kst = Math.round(ds + .06);
              if (tau > 1) { al = along(ds); cr = dir * (hwAt(ds) * 1.16 + 8 + C.ch); a = 0; r = 4; sz = 1; }
              else if (kst > 3) { al = along(ds + tau * .3); cr = off * hwAt(ds) + dir * tau * tau * C.ch; a = .6 * (1 - tau) * (1 - tau); r = 4; sz = (1.3 + R3[i]) * zs; }
              else {
                // Ausstieg: durch den Schacht unter der Station nach unten
                e1 = sstep(0, .2, tau); env = hwAt(ds) * 1.16 + 8;
                al = along(lerp(ds, kst - .06, e1)) + (R2[i] - .5) * 7 * zs;
                cr = lerp(off * hwAt(ds), dir * env, e1) + dir * sstep(.12, 1, tau) * C.ch;
                a = .78 * (1 - tau * tau); r = 4; sz = (1.3 + R3[i]) * zs;
              }
            }
            put(o, i, al, cr);
          } else if (kd === 1) {
            j = fb[i]; v = fract(bv[i] + t * (.16 + .2 * R3[i]) + p * .05);
            a = (rl > .01 && R3[i] < .2 + .8 * rl) ? (.6 + .4 * R4[i]) * sstep(0, .05, v) * sstep(1, .95, v) * sstep(0, .25, rl) : 0; r = 1; sz = 1.6 + 1.6 * R3[i];
            if (rl <= .01) { put(o, i, along(4), 0); }
            else {
              // die Ueberlebenden fuellen die drei Balken der Marke (Masse wie im Signet)
              q = BAR[j]; h = v * q[3] * rl;
              o.x[i] = MK.ox + (q[0] + .6 + bu[i] * (q[2] - 1.2)) * MK.u; o.y[i] = MK.oy + (103 - h * (1 + boom * (vert ? 5 : 4))) * MK.u;
              if (boom < .01 && h > q[3] - 4.5 && (bu[i] < .25 || bu[i] > .75)) { d = (bu[i] < .25 ? .25 - bu[i] : bu[i] - .75) * q[2]; e1 = h - (q[3] - 4.5); if (d * d + e1 * e1 > 20.25) a = 0; }
              a *= 1 - .45 * lk;
            }
          } else {
            q = fract(R1[i] + t * .06 + p * .02); d = q * L; r = 1; sz = 1.7;
            a = (q < ll ? .95 : 0) * sstep(0, .02, q) * sstep(1, .98, q);
            if (d < L1) { s = lp.s1; cr = lp.c0 + d; }
            else if (d < L1 + L2) { s = lp.s1 - (d - L1) / L2 * (lp.s1 - lp.s0); cr = lp.cb; }
            else { s = lp.s0; cr = lp.cb - (d - L1 - L2); }
            put(o, i, along(s), lp.side * cr);
          }
          o.a[i] = a; o.s[i] = sz; o.r[i] = r;
        }
      },
      decor: function (w, p, t) {
        var F_ = G.fun, vert = F_.vert, front = keys(p, FR), k, al, ry, open, pu, x, y, cz, c, sgn, q, e1, y1, y2, wq, vis, rg, na, j, ta, lp = F_.loop, ll = sstep(66.45, 67.15, p);
        cam(p); cz = C.cz; c = C.c;
        w *= 1 - sstep(69.1, 69.6, p); if (w < .01) return;
        function pt(s, cr) { return vert ? [c + cr * cz, along(s)] : [along(s), c + cr * cz]; }
        // Lichtkegel am Kopf des Stroms
        var hp = pt(Math.min(Math.max(front, 0), 4), 0), gl = ctx.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], Math.max(W, H) * .42 * Math.max(.5, cz * .6));
        ctx.globalCompositeOperation = 'lighter';
        gl.addColorStop(0, 'rgba(61,214,140,' + (.15 * w) + ')'); gl.addColorStop(1, 'rgba(61,214,140,0)');
        ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
        // Stromlinien: die Richtung ist immer sichtbar
        var nl = M ? 22 : 56, rr = mulberry(909), h1_, h2_, h3_, s0, s1_, of_, a0_, a1_;
        ctx.lineWidth = 1;
        for (j = 0; j < nl; j++) {
          h1_ = rr(); h2_ = rr(); h3_ = rr();
          s0 = fract(h1_ + t * (.03 + .05 * h2_) + p * .02) * 5.6 - .9; if (s0 > front - .05) continue;
          s1_ = Math.min(front, s0 + .1 + .16 * h2_); of_ = (h3_ * 2 - 1) * .86;
          a0_ = pt(s0, of_ * hwAt(s0)); a1_ = pt(s1_, of_ * hwAt(s1_));
          if (Math.max(a0_[0], a1_[0]) < 0 || Math.min(a0_[0], a1_[0]) > W) continue;
          ctx.globalAlpha = w * (.07 + .13 * h2_) * (1 - C.ov * .55) * sstep(-.9, -.6, s0);
          ctx.strokeStyle = s0 > 3 ? 'rgb(61,214,140)' : 'rgb(244,245,242)';
          ctx.beginPath(); ctx.moveTo(a0_[0], a0_[1]); ctx.lineTo(a1_[0], a1_[1]); ctx.stroke();
        }
        // Schaechte: hier steigen Leads aus
        for (k = 1; k < 4; k++) {
          vis = sstep(k - .5, k - .1, front) * w; if (vis < .02) continue;
          al = along(k - .06); e1 = hwAt(k - .06) * 1.16 + 8; wq = (vert ? 5 : 7) * C.zs;
          y1 = c + (vert ? -1 : 1) * e1 * cz; y2 = y1 + (vert ? -1 : 1) * C.ch * cz; if (!vert) { y2 = Math.min(y2, H - HB - 8); if (y1 > y2 - 20) continue; }
          ctx.globalAlpha = vis * .55; ctx.strokeStyle = 'rgb(244,245,242)'; ctx.lineWidth = 1.2;
          ctx.beginPath();
          if (vert) { ctx.moveTo(y1, al - wq); ctx.lineTo(y2, al - wq); ctx.moveTo(y1, al + wq); ctx.lineTo(y2, al + wq); }
          else { ctx.moveTo(al - wq, y1); ctx.lineTo(al - wq, y2); ctx.moveTo(al + wq, y1); ctx.lineTo(al + wq, y2); }
          ctx.stroke();
          if (!vert) {
            q = y1 + 16 * C.zs; ctx.globalAlpha = vis * .85;
            ctx.beginPath(); ctx.moveTo(al - wq - 5, q - 6); ctx.lineTo(al + wq + 5, q + 6); ctx.lineTo(al + wq + 5, q - 6); ctx.lineTo(al - wq - 5, q + 6); ctx.closePath(); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            monoFont(9); ctx.fillStyle = 'rgb(154,163,158)'; ctx.globalAlpha = vis * .9; if (k === 3 && ll > .01) label('AUSSTIEG', al - wq - 12, Math.min(y2 - 5, H - HB - 16), 'right', 1.6); else label('AUSSTIEG', al + wq + 12, Math.min(y2 - 5, H - HB - 16), 'left', 1.6);
            ctx.globalCompositeOperation = 'lighter';
          }
        }
        // Tore
        for (k = 0; k < 5; k++) {
          q = pt(k, 0); ry = ringAt(k) * cz; open = sstep(k - .05, k + .25, front);
          if (q[0] < -200 || q[0] > W + 200 || q[1] < -H || q[1] > H * 2) continue;
          pu = Math.max(0, 1 - Math.abs(front - k) * 2.2);
          ctx.strokeStyle = open > .5 ? 'rgb(61,214,140)' : 'rgb(244,245,242)';
          ctx.globalAlpha = w * (.1 + .16 * open); ctx.lineWidth = 7 * C.zs;
          ctx.beginPath(); if (vert) ctx.ellipse(q[0], q[1], ry, 8 * C.zs, 0, 0, TAU); else ctx.ellipse(q[0], q[1], 8 * C.zs, ry, 0, 0, TAU); ctx.stroke();
          ctx.globalAlpha = w * (.36 + .5 * open + .14 * pu); ctx.lineWidth = 2;
          ctx.beginPath(); if (vert) ctx.ellipse(q[0], q[1], ry, 8 * C.zs, 0, 0, TAU); else ctx.ellipse(q[0], q[1], 8 * C.zs, ry, 0, 0, TAU); ctx.stroke();
          if (pu > .02) { ctx.globalAlpha = w * pu * .6; ctx.lineWidth = 1.2; ctx.beginPath(); if (vert) ctx.ellipse(q[0], q[1], ry + 16 * pu, 13 * C.zs, 0, 0, TAU); else ctx.ellipse(q[0], q[1], 13 * C.zs, ry + 16 * pu, 0, 0, TAU); ctx.stroke(); }
        }
        // Huelle des Trichters als Blaupause
        ctx.globalAlpha = w * .34; ctx.strokeStyle = 'rgb(244,245,242)'; ctx.lineWidth = 1; ctx.setLineDash([2, 7]);
        for (sgn = -1; sgn < 2; sgn += 2) {
          ctx.beginPath();
          for (q = -.8; q <= 4.001; q += .05) { e1 = pt(q, sgn * (hwAt(q) * 1.16 + 8)); if (q === -.8) ctx.moveTo(e1[0], e1[1]); else ctx.lineTo(e1[0], e1[1]); }
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // Mittelachse
        ctx.globalAlpha = w * .12; ctx.beginPath(); e1 = pt(-1.2, 0); ctx.moveTo(e1[0], e1[1]); e1 = pt(4, 0); ctx.lineTo(e1[0], e1[1]); ctx.stroke();
        // Messuhren auf der Leitung: beim Zeigen leuchtet die Uhr gruen und der Zeiger schwingt, sonst pulsen sie reihum
        var hot, idle = GZ.hot < 0 && GZ.pin < 0, pi_ = Math.floor(t / 1.3) % 4, pe = Math.pow(Math.sin(PI * fract(t / 1.3)), 2), hk, gg;
        for (k = 0; k < 4; k++) {
          gaugeAt(k, front, GT); vis = GT.v * w; if (vis < .02) continue;
          x = GT.x; y = GT.y; rg = GT.r; hk = GZ.k[k];
          if (x < -40 || x > W + 40 || y < -40 || y > H + 40 || (!vert && y - rg < HT + 8)) continue;
          if (hk > .01 || (idle && pi_ === k && GT.ok)) {
            hot = Math.max(hk, idle && pi_ === k ? pe * .55 : 0);
            gg = ctx.createRadialGradient(x, y, rg * .4, x, y, rg * 3.2);
            gg.addColorStop(0, 'rgba(61,214,140,' + (.34 * hot * vis) + ')'); gg.addColorStop(1, 'rgba(61,214,140,0)');
            ctx.globalAlpha = 1; ctx.fillStyle = gg; ctx.fillRect(x - rg * 3.2, y - rg * 3.2, rg * 6.4, rg * 6.4);
            ctx.globalAlpha = vis * hot * (hk > .01 ? .9 : .7 * (1 - fract(t / 1.3))); ctx.strokeStyle = 'rgb(61,214,140)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(x, y, rg + 5 + (hk > .01 ? 2 * Math.sin(t * 4) : 12 * fract(t / 1.3)), 0, TAU); ctx.stroke();
          }
          ctx.globalAlpha = vis * .6; ctx.strokeStyle = 'rgb(244,245,242)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(GT.ax, GT.ay); if (vert) ctx.lineTo(x - rg, y); else ctx.lineTo(x, y + rg); ctx.stroke();
          if (hk > .01) { ctx.globalAlpha = vis * (.6 + .4 * hk); ctx.strokeStyle = 'rgb(' + Math.round(lerp(244, 61, hk)) + ',' + Math.round(lerp(245, 214, hk)) + ',' + Math.round(lerp(242, 140, hk)) + ')'; ctx.lineWidth = 1 + hk; }
          ctx.beginPath(); ctx.arc(x, y, rg, 0, TAU); ctx.stroke();
          ctx.lineWidth = 1;
          for (j = 0; j < 7; j++) { ta = -2.6 + j * .34; ctx.beginPath(); ctx.moveTo(x + Math.cos(ta) * rg * .72, y + Math.sin(ta) * rg * .72); ctx.lineTo(x + Math.cos(ta) * rg * .92, y + Math.sin(ta) * rg * .92); ctx.stroke(); }
          na = -2.4 + 1.7 * (.5 + .4 * Math.sin(t * 1.3 + k * 1.7)) * (1 - k * .16);
          if (hk > .01) na = lerp(na, -1.57 + .85 * Math.sin(t * 6.5 + k), hk);
          ctx.globalAlpha = vis; ctx.strokeStyle = 'rgb(61,214,140)'; ctx.lineWidth = 1.6 + .6 * hk;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(na) * rg * .74, y + Math.sin(na) * rg * .74); ctx.stroke();
          if (hk > .01) { ctx.globalAlpha = vis * hk; ctx.fillStyle = 'rgb(61,214,140)'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
        }
        // Rueckweg: Kaeufe zurueck an Meta
        if (ll > .01) {
          ctx.globalAlpha = w * ll * .7; ctx.strokeStyle = 'rgb(61,214,140)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 16;
          ctx.beginPath();
          e1 = pt(lp.s1, lp.side * lp.c0); ctx.moveTo(e1[0], e1[1]);
          e1 = pt(lp.s1, lp.side * lp.cb); ctx.lineTo(e1[0], e1[1]);
          e1 = pt(lp.s0, lp.side * lp.cb); ctx.lineTo(e1[0], e1[1]);
          e1 = pt(lp.s0, lp.side * (lp.cb - lp.l3)); ctx.lineTo(e1[0], e1[1]);
          ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
          // Pfeilspitze am Ziel
          ctx.globalAlpha = w * ll; ctx.beginPath();
          if (vert) { ctx.moveTo(e1[0] + 8, e1[1] - 6); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e1[0] + 8, e1[1] + 6); }
          else { ctx.moveTo(e1[0] - 6, e1[1] + 9); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e1[0] + 6, e1[1] + 9); }
          ctx.stroke();
        }
        // das Signet am Ende: drei Balken in den Massen der Marke, erst als Riss, dann gefuellt
        var rl = sstep(65.35, 66.85, p), MK = F_.mk, u = MK.u, lk = sstep(66.75, 67.2, p) * (1 - sstep(68.55, 68.8, p)), b_, bx_, by_, bh_;
        if (rl > .01) {
          ctx.globalCompositeOperation = 'source-over';
          for (j = 0; j < 3; j++) {
            b_ = BAR[j]; bx_ = MK.ox + b_[0] * u; bh_ = b_[3] * u; by_ = MK.oy + 103 * u - bh_;
            ctx.beginPath(); rrect(bx_, by_, b_[2] * u, bh_, 4.5 * u);
            ctx.globalAlpha = w * rl * (1 - lk) * .5 * (1 - sstep(68.7, 68.9, p)); ctx.strokeStyle = 'rgb(61,214,140)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
          }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      },
      top: function (w, p, t) {
        // die Marke rastet ein: die Balken stehen satt in Gruen, der Mauszeiger steht davor, wie im Signet
        var MK = G.fun.mk, u = MK.u, lk = sstep(66.75, 67.2, p) * (1 - sstep(68.55, 68.8, p)), ck = sstep(66.95, 67.35, p) * (1 - sstep(68.5, 68.75, p)), rk = seg(p, 67.2, 67.75), s0, tx, ty, j, b_;
        w *= 1 - sstep(69.1, 69.4, p); if (w < .01) return;
        if (ck < .01 && lk < .01) { this.lead(w, p); return; }
        if (lk > .01) {
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = w * lk * .84; ctx.fillStyle = '#3DD68C';
          for (j = 0; j < 3; j++) { b_ = BAR[j]; ctx.beginPath(); rrect(MK.ox + b_[0] * u, MK.oy + b_[1] * u, b_[2] * u, b_[3] * u, 4.5 * u); ctx.fill(); }
          ctx.globalAlpha = 1;
        }
        this.lead(w, p);
        if (ck < .01) return;
        tx = MK.ox + 62.5 * u; ty = MK.oy + 22 * u; s0 = lerp(1.5, 1, eo(ck));
        ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = w * ck;
        ctx.translate(tx + (1 - eo(ck)) * 26 * u, ty + (1 - eo(ck)) * 30 * u); ctx.scale(u * s0, u * s0); ctx.translate(-62.5, -22);
        ctx.beginPath(); for (var i = 0; i < ARROW.length; i++) { if (i) ctx.lineTo(ARROW[i][0], ARROW[i][1]); else ctx.moveTo(ARROW[i][0], ARROW[i][1]); } ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 3.6; ctx.strokeStyle = '#0a0b0d'; ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
        if (rk > 0 && rk < 1) { ctx.globalAlpha = w * (1 - rk) * .8; ctx.strokeStyle = 'rgb(61,214,140)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(tx, ty, 6 + rk * 46 * u, 0, TAU); ctx.stroke(); ctx.globalAlpha = w * (1 - rk) * .4; ctx.beginPath(); ctx.arc(tx, ty, 6 + rk * 30 * u, 0, TAU); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    };
  })();
  /* Zustand der Messuhren: welche gezeigt wird (Maus, Fokus), welche angeheftet ist (Tipp), weiche Blende je Uhr */
  var GZ = { hot: -1, pin: -1, pinP: 0, k: [0, 0, 0, 0], cx: 0, cy: 0, cw: 0, ch: 0 };
  function rrect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); }

  /* 11 bis 18 · Acht Welten. Jedes Bild ist eine Zeichnung, die der Schwarm formt. */
  function Pic() { this.P = []; this.X = []; }
  Pic.prototype = {
    line: function (x1, y1, x2, y2, g, r, wt) { this.P.push({ t: 0, a: [x1, y1, x2, y2], g: g || 0, r: r || 0, w: Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) * (wt || 1) }); return this; },
    poly: function (pts, g, r, close, wt) { var i, n = pts.length, m = close ? n : n - 1; for (i = 0; i < m; i++) this.line(pts[i][0], pts[i][1], pts[(i + 1) % n][0], pts[(i + 1) % n][1], g, r, wt); return this; },
    rect: function (x, y, w, h, g, r, wt) { return this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], g, r, true, wt); },
    circ: function (cx, cy, rad, g, r, a0, a1, wt) { if (a0 === undefined || a0 === null) { a0 = 0; a1 = TAU; } this.P.push({ t: 2, a: [cx, cy, rad, a0, a1], g: g || 0, r: r || 0, w: rad * Math.abs(a1 - a0) * (wt || 1) }); return this; },
    fill: function (x, y, w, h, g, r, d) { this.P.push({ t: 1, a: [x, y, w, h], g: g || 0, r: r || 0, w: w * h * (d || 30) }); return this; },
    disc: function (cx, cy, rad, g, r, d) { this.P.push({ t: 3, a: [cx, cy, rad], g: g || 0, r: r || 0, w: PI * rad * rad * (d || 30) }); return this; },
    shape: function (pts, g, r, d) { var i, n = pts.length, ar = 0; for (i = 0; i < n; i++) ar += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1]; ar = Math.abs(ar) / 2; this.P.push({ t: 4, a: pts, g: g || 0, r: r || 0, ar: ar, w: ar * (d || 30) }); return this; },
    dot: function (x, y, g, r, sz) { this.X.push([x, y, g || 0, r || 0, sz || 4]); return this; }
  };
  function samplePic(pic, target) {
    var P = pic.P, tot = 0, i, j, n, q, a, k, cols, rows, pts = [], x, y, x0, y0, x1, y1, st;
    for (i = 0; i < P.length; i++) tot += P[i].w;
    for (i = 0; i < P.length; i++) {
      q = P[i]; n = Math.max(2, Math.round(target * q.w / tot)); a = q.a;
      if (q.t === 0) for (j = 0; j < n; j++) { k = (j + .5) / n; pts.push([a[0] + (a[2] - a[0]) * k, a[1] + (a[3] - a[1]) * k, q.g, q.r, 0]); }
      else if (q.t === 2) for (j = 0; j < n; j++) { k = a[3] + (a[4] - a[3]) * (j + .5) / n; pts.push([a[0] + Math.cos(k) * a[2], a[1] + Math.sin(k) * a[2], q.g, q.r, 0]); }
      else if (q.t === 1) { cols = Math.max(2, Math.round(Math.sqrt(n * a[2] / a[3]))); rows = Math.max(2, Math.ceil(n / cols)); for (j = 0; j < cols * rows; j++) pts.push([a[0] + ((j % cols) + .5) / cols * a[2], a[1] + (Math.floor(j / cols) + .5) / rows * a[3], q.g, q.r, 0]); }
      else if (q.t === 3) { st = Math.sqrt(PI * a[2] * a[2] / n); for (y = a[1] - a[2] + st / 2; y < a[1] + a[2]; y += st) for (x = a[0] - a[2] + st / 2; x < a[0] + a[2]; x += st) if ((x - a[0]) * (x - a[0]) + (y - a[1]) * (y - a[1]) < a[2] * a[2]) pts.push([x, y, q.g, q.r, 0]); }
      else {
        x0 = y0 = 1e9; x1 = y1 = -1e9; for (j = 0; j < a.length; j++) { x0 = Math.min(x0, a[j][0]); x1 = Math.max(x1, a[j][0]); y0 = Math.min(y0, a[j][1]); y1 = Math.max(y1, a[j][1]); }
        st = Math.sqrt(Math.max(1e-7, q.ar) / n);
        for (y = y0 + st / 2; y < y1; y += st) for (x = x0 + st / 2; x < x1; x += st) if (inPoly(x, y, a)) pts.push([x, y, q.g, q.r, 0]);
      }
    }
    return pts;
  }
  /* Handy, Auftakt zu Kapitel 7: ein Keim traegt nur gut 300 Punkte. Sie gehen alle in die tragenden Linien der Zeichnung, in gleichen
     Abstaenden ueber die ganze Laenge, so bleiben die Linien geschlossen. Flaechen und Raster (Teig, Zellen, Fenster), graue Nebenlinien
     und einzelne kurze Striche bleiben weg. Eine kleine Scheibe wird ein Punkt, eine grosse ein Kreis, das Dreieck im Bildschirm ein
     Umriss. Wo zwei Linien fast aufeinander liegen (Zellen des Solarfelds), steht nur eine. */
  function outlinePts(pic, K) {
    var P = pic.P, L = new Pic(), D = [], C = [], pts = [], tot = 0, i, j, n, q, a, c, l, st, acc, d, k, x, y, r2, ok, it, want;
    for (i = 0; i < P.length; i++) {
      q = P[i]; a = q.a;
      if (q.t === 0 || q.t === 2) { if (q.r !== 4) L.P.push(q); }
      else if (q.t === 3) { if (a[2] < .03) D.push([a[0], a[1], q.g, q.r, 1]); else L.circ(a[0], a[1], a[2], q.g, q.r); }
      else if (q.t === 1) D.push([a[0] + a[2] / 2, a[1] + a[3] / 2, q.g, q.r, 1]);
      else if (a.length < 4) L.poly(a, q.g, q.r, true);
    }
    // Ketten: Strecken, die aneinander anschliessen, zaehlen als eine Linie
    for (i = 0, c = null; i < L.P.length; i++) {
      q = L.P[i]; a = q.a; l = q.t ? a[2] * Math.abs(a[4] - a[3]) : Math.sqrt((a[2] - a[0]) * (a[2] - a[0]) + (a[3] - a[1]) * (a[3] - a[1]));
      if (!q.t && c && !c.t && Math.abs(a[0] - c.x) + Math.abs(a[1] - c.y) < 1e-6) { c.q.push(q); c.l += l; }
      else { c = { t: q.t, q: [q], l: l }; C.push(c); }
      c.x = a[2]; c.y = a[3];
    }
    P = [];
    for (i = 0; i < C.length; i++) if (C[i].l >= .045) for (j = 0; j < C[i].q.length; j++) { q = C[i].q[j]; P.push({ t: q.t, a: q.a, g: q.g, r: q.r, w: q.w, c: i }); tot += q.w; }
    want = Math.max(10, K - D.length); st = tot / want;
    for (it = 0; it < 6 && tot > 0; it++) {
      pts = []; acc = st / 2; r2 = st * st * .25;
      for (i = 0; i < P.length; i++) {
        q = P[i]; a = q.a;
        for (d = acc; d < q.w; d += st) {
          k = d / q.w;
          if (q.t === 0) { x = a[0] + (a[2] - a[0]) * k; y = a[1] + (a[3] - a[1]) * k; }
          else { k = a[3] + (a[4] - a[3]) * k; x = a[0] + Math.cos(k) * a[2]; y = a[1] + Math.sin(k) * a[2]; }
          for (n = pts.length - 1, ok = true; n >= 0 && ok; n--) if (pts[n][5] !== q.c && (pts[n][0] - x) * (pts[n][0] - x) + (pts[n][1] - y) * (pts[n][1] - y) < r2) ok = false;
          if (ok) pts.push([x, y, q.g, q.r, 0, q.c]);
        }
        acc = d - q.w;
      }
      if (pts.length >= want * .97 && pts.length <= want) break;
      st *= (pts.length + 1) / (want * .985);
    }
    return pts.concat(D);
  }
  /* Rahmen einer Zeichnung im Einheitsquadrat [links, oben, rechts, unten]: so weit ragt sie ueber ihr Feld hinaus (fitPic) */
  function picBB(pic) {
    var b = [1e9, 1e9, -1e9, -1e9], P = pic.P, X = pic.X, i, j, q, a, k;
    function add(x, y) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
    for (i = 0; i < P.length; i++) {
      q = P[i]; a = q.a;
      if (q.t === 0) { add(a[0], a[1]); add(a[2], a[3]); }
      else if (q.t === 1) { add(a[0], a[1]); add(a[0] + a[2], a[1] + a[3]); }
      else if (q.t === 2) for (j = 0; j <= 24; j++) { k = a[3] + (a[4] - a[3]) * j / 24; add(a[0] + Math.cos(k) * a[2], a[1] + Math.sin(k) * a[2]); }
      else if (q.t === 3) { add(a[0] - a[2], a[1] - a[2]); add(a[0] + a[2], a[1] + a[2]); }
      else for (j = 0; j < a.length; j++) add(a[j][0], a[j][1]);
    }
    for (i = 0; i < X.length; i++) add(X[i][0], X[i][1]);
    if (!(b[2] > b[0]) || !(b[3] > b[1])) return [0, 0, 1, 1];
    return [Math.min(b[0], .1), Math.min(b[1], .1), Math.max(b[2], .9), Math.max(b[3], .9)];
  }
  var MX = 0, MY = 0, MA = 1, MR = 0, MS = 0;   // Ablage fuer Bewegungen einzelner Bildgruppen
  function rot(cx, cy, an) { var dx = MX - cx, dy = MY - cy, c = Math.cos(an), s = Math.sin(an); MX = cx + dx * c - dy * s; MY = cy + dx * s + dy * c; }
  var PICS = [];
  function picForm(idx, name, build, mods) {
    var px, py, pg, pr, ps, pk;
    var f = {
      name: name, pts: null, out: null, bb: [0, 0, 1, 1],
      init: function () {
        var pic = new Pic(); build(pic); f.bb = picBB(pic);
        var nx = Math.min(pic.X.length, N), lin = samplePic(pic, Math.max(10, Math.floor(N * .9) - nx)), base = lin.length, perm = shuffle(base, 50 + idx), nl = Math.min(base, N - nx), i, q;
        px = new Float32Array(N); py = new Float32Array(N); pg = new Uint8Array(N); pr = new Uint8Array(N); ps = new Float32Array(N); pk = new Float32Array(N);
        // feste Punkte (Fenster) zuerst, sie duerfen nie fehlen
        for (i = 0; i < N; i++) {
          if (i < nx) q = pic.X[i];
          else if (i - nx < nl) q = lin[perm[i - nx]];
          else { pg[i] = 255; continue; }
          px[i] = q[0]; py[i] = q[1]; pg[i] = q[2]; pr[i] = q[3]; ps[i] = q[4]; pk[i] = (i * .61803) % 1;
        }
        f.pts = lin.concat(pic.X);
        f.out = M ? outlinePts(pic, Math.ceil(N / NS)) : null;
      },
      run: function (o, p, t) {
        var B_ = picOf(idx), s = B_.s, x0 = B_.cx - s / 2, y0 = B_.cy - s / 2, lk = seg(p, WA[idx] + .3, WA[idx] + WL), i, g, m, dsz = M ? 1.7 : 2;
        for (i = 0; i < N; i++) {
          g = pg[i];
          if (g === 255) { o.x[i] = x0 + R1[i] * s; o.y[i] = y0 + R2[i] * s; o.a[i] = 0; o.s[i] = 1; o.r[i] = 0; continue; }
          MX = px[i]; MY = py[i]; MA = .86; MR = pr[i]; MS = ps[i] ? ps[i] * (M ? .72 : 1) : dsz;
          m = mods && mods[g]; if (m) m(t, lk, pk[i], i);
          o.x[i] = x0 + MX * s; o.y[i] = y0 + MY * s; o.a[i] = MA; o.s[i] = MS; o.r[i] = MR;
        }
      }
    };
    try { var pic0 = new Pic(); build(pic0); f.bb = picBB(pic0); } catch (e) {}
    PICS[idx] = f;
    return f;
  }

  /* Welt 1 · Kapitalanlage: Skyline bei Nacht, ein Kran, eine steigende Linie */
  FORM.w1 = picForm(0, 'Skyline', function (P) {
    var bl = [[.0, .13, .3], [.15, .15, .5], [.32, .12, .38], [.46, .18, .72], [.66, .13, .46], [.81, .19, .6]], gy = .88, i, j, b, cols, rows, c, r, sx, sy;
    P.line(-.06, gy, 1.06, gy, 0, 0, 1.2);
    for (i = 0; i < bl.length; i++) {
      b = bl[i]; P.rect(b[0], gy - b[2], b[1], b[2], 0, 0);
      cols = Math.max(2, Math.round(b[1] / .036)); rows = Math.max(2, Math.round(b[2] / .044)); sx = b[1] / cols; sy = b[2] / rows;
      for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) P.dot(b[0] + (c + .5) * sx, gy - (r + .5) * sy, 1, ((r * 7 + c * 13 + i * 5) % 5) < 2 ? 1 : 4, 4.6);
    }
    // Kran auf dem hoechsten Haus
    var tx = .55, ty = gy - .72;
    P.line(tx, ty, tx, ty - .13, 2, 0); P.line(tx - .1, ty - .13, tx + .36, ty - .13, 2, 0); P.line(tx, ty - .17, tx + .36, ty - .13, 2, 0); P.line(tx, ty - .17, tx - .1, ty - .13, 2, 0);
    P.line(tx + .24, ty - .13, tx + .24, ty - .04, 3, 0); P.fill(tx + .225, ty - .04, .03, .03, 3, 1, 90);
    // die Linie, um die es geht
    P.poly([[-.04, .74], [.22, .58], [.4, .66], [1.02, .04]], 4, 1, false, 2.4); P.disc(1.02, .04, .018, 4, 1, 200);
  }, {
    1: function (t, lk, k) { var on = k < .25 + .6 * lk; MA = MR === 1 ? (on ? .75 + .25 * Math.sin(t * (1 + k * 2) + k * 40) : .22) : .3; if (MR === 1 && !on) MR = 4; },
    3: function (t) { MX += Math.sin(t * .7) * .05; },
    4: function (t, lk, k) { MS = 2.6; MA = 1; }
  });

  /* Welt 2 · Online-Coaches: die Sendung laeuft, der Saal fuellt sich */
  FORM.w2 = picForm(1, 'Sendung', function (P) {
    var i, j, n, rw, yy, f, arc;
    P.rect(.12, .04, .76, .44, 0, 0, 1.3);
    P.circ(.5, .26, .1, 2, 1, null, null, 1.6); P.shape([[.468, .205], [.468, .315], [.56, .26]], 2, 1, 120);
    P.circ(.5, .26, .15, 3, 1); P.circ(.5, .26, .2, 3, 1);
    P.disc(.175, .095, .014, 2, 1, 200); P.line(.205, .095, .28, .095, 0, 0);
    P.line(.16, .43, .84, .43, 0, 4); P.line(.16, .43, .5, .43, 5, 1, 2);
    P.line(.4, .48, .36, .56, 0, 0); P.line(.6, .48, .64, .56, 0, 0);
    for (i = 0; i < 5; i++) {
      n = 9 + i * 2; rw = .62 + i * .1; yy = .64 + i * .075;
      for (j = 0; j < n; j++) { f = j / (n - 1); arc = Math.pow(Math.abs(f - .5) * 2, 2) * -.03; P.disc(.5 - rw / 2 + f * rw, yy + arc, .017, 10 + ((i * 17 + j * 7) % 10), 0, 60); }
    }
  }, (function () {
    var m = { 3: function (t, lk, k) { MA = .35 + .3 * Math.sin(t * 2 - k * 3); }, 5: function (t, lk) { MX = .16 + (MX - .16) * (.3 + .7 * lk) / 1; } }, q;
    function seat(th) { return function (t, lk) { if (th < .15 + lk * .85) { MR = 1; MA = 1; } else MA = .4; }; }
    for (q = 0; q < 10; q++) m[10 + q] = seat(q / 10);
    return m;
  })());

  /* Welt 3 · Personenmarken und Communities: eine Mitte, um die sich alles dreht */
  FORM.w3 = picForm(2, 'Netzwerk', function (P) {
    var R = [[.2, 7], [.34, 13], [.48, 21]], i, j, a, big;
    P.disc(.5, .5, .085, 0, 0, 40); P.circ(.5, .5, .115, 0, 0);
    for (i = 0; i < 3; i++) {
      P.circ(.5, .5, R[i][0], 1 + i, 0, null, null, .5);
      for (j = 0; j < R[i][1]; j++) {
        a = j / R[i][1] * TAU + i * .4; big = (i + j) % 3 === 0;
        P.disc(.5 + Math.cos(a) * R[i][0], .5 + Math.sin(a) * R[i][0], big ? .022 : .014, 1 + i, big ? 1 : 0, 80);
        if (i === 0) P.line(.5 + Math.cos(a) * .12, .5 + Math.sin(a) * .12, .5 + Math.cos(a) * (R[i][0] - .03), .5 + Math.sin(a) * (R[i][0] - .03), 1, 0, .6);
      }
    }
  }, {
    0: function (t, lk, k) { MA = .9; },
    1: function (t, lk) { rot(.5, .5, t * .1 + lk * .9); },
    2: function (t, lk) { rot(.5, .5, -t * .07 - lk * .7); },
    3: function (t, lk) { rot(.5, .5, t * .045 + lk * .5); }
  });

  /* Welt 4 · Handwerk: ein Haus auf dem Plan, das Geruest steht */
  FORM.w4 = picForm(3, 'Baustelle', function (P) {
    var gy = .86, i, x0 = .36, x1 = .94, wy = .5, ax = (x0 + x1) / 2, ay = .2, s0 = .06, s1 = .25, lh = .135;
    P.line(-.04, gy, 1.04, gy, 0, 0, 1.2);
    for (i = 0; i < 12; i++) P.line(-.02 + i * .09, gy + .045, .03 + i * .09, gy + .005, 0, 4, .7);
    P.poly([[x0, gy], [x0, wy], [x1, wy], [x1, gy]], 0, 0, false, 1.3);
    P.poly([[x0 - .045, wy + .02], [ax, ay], [x1 + .045, wy + .02]], 1, 1, false, 2);
    P.line(ax, wy, ax, ay, 0, 0); P.line(x0, wy, x1, wy, 0, 0);
    P.line(ax, wy, ax - .145, wy - .15, 0, 4); P.line(ax, wy, ax + .145, wy - .15, 0, 4);
    P.rect(x0 + .06, wy + .08, .13, .13, 0, 0); P.rect(x1 - .19, wy + .08, .13, .13, 0, 0);
    P.line(x0 + .125, wy + .08, x0 + .125, wy + .21, 0, 4); P.line(x1 - .125, wy + .08, x1 - .125, wy + .21, 0, 4);
    P.rect(ax - .055, gy - .22, .11, .22, 0, 0);
    // Geruest
    P.line(s0, gy, s0, gy - lh * 4 - .03, 2, 0); P.line(s1, gy, s1, gy - lh * 4 - .03, 2, 0);
    for (i = 1; i <= 4; i++) P.line(s0 - .02, gy - i * lh, s1 + .02, gy - i * lh, 2, 0);
    for (i = 0; i < 4; i++) { if (i % 2) P.line(s0, gy - i * lh, s1, gy - (i + 1) * lh, 2, 4); else P.line(s1, gy - i * lh, s0, gy - (i + 1) * lh, 2, 4); }
    P.fill(s0 + .02, gy - 2 * lh - .05, .03, .05, 3, 1, 90);
    // Masse
    P.line(x0, gy + .09, x1, gy + .09, 0, 4); P.line(x0, gy + .075, x0, gy + .105, 0, 4); P.line(x1, gy + .075, x1, gy + .105, 0, 4);
    P.line(x1 + .07, gy, x1 + .07, ay, 0, 4); P.line(x1 + .055, gy, x1 + .085, gy, 0, 4); P.line(x1 + .055, ay, x1 + .085, ay, 0, 4);
    P.disc(ax, ay, .016, 1, 1, 200);
  }, {
    0: function (t, lk) { if (.86 - MY > .08 + lk * .9) MA = 0; },
    1: function (t, lk) { MS = 2.5; MA = (.86 - MY) < .08 + lk * .9 ? 1 : 0; },
    2: function (t, lk) { if (.86 - MY > .08 + lk * .9) MA = 0; },
    3: function (t) { MX += (.5 + .5 * Math.sin(t * .5)) * .1; }
  });

  /* Welt 5 · Erneuerbare Energien: Sonne, Feld, Waermepumpe */
  FORM.w5 = picForm(4, 'Sonne', function (P) {
    var sx = .2, sy = .2, i, j, a, px = .36, py = .56, cw = .1, ch = .1, sk = .045, x, y, hx = .68, hy = .1, hs = .2;
    P.disc(sx, sy, .085, 1, 1, 46); P.circ(sx, sy, .118, 0, 0);
    for (i = 0; i < 16; i++) { a = i / 16 * TAU; P.line(sx + Math.cos(a) * .15, sy + Math.sin(a) * .15, sx + Math.cos(a) * (i % 2 ? .2 : .25), sy + Math.sin(a) * (i % 2 ? .2 : .25), 2, i % 2 ? 0 : 1); }
    for (j = 0; j < 3; j++) for (i = 0; i < 6; i++) {
      x = px + i * cw - j * sk; y = py + j * ch;
      P.poly([[x, y], [x + cw - .008, y], [x + cw - .008 - sk, y + ch - .008], [x - sk, y + ch - .008]], 0, 0, true);
      P.shape([[x + .004, y + .008], [x + cw - .016, y + .008], [x + cw - .012 - sk, y + ch - .016], [x - sk + .008, y + ch - .016]], 10 + ((i * 3 + j * 5) % 10), 1, 26);
    }
    P.line(px - 3 * sk + .04, py + 3 * ch, px - 3 * sk + .04, .93, 0, 0); P.line(px + 6 * cw - 3 * sk - .05, py + 3 * ch, px + 6 * cw - 3 * sk - .05, .93, 0, 0);
    P.line(-.04, .93, 1.04, .93, 0, 0, 1.2);
    for (i = 0; i < 4; i++) P.line(sx + .1, sy + .09 + i * .012, px + .1 + i * .15, py - .02, 3, 1, .45);
    // Waermepumpe
    P.rect(hx, hy, hs * 1.3, hs, 0, 0, 1.2); P.circ(hx + hs * .5, hy + hs * .5, hs * .36, 0, 0);
    for (i = 0; i < 3; i++) { a = i / 3 * TAU; P.line(hx + hs * .5, hy + hs * .5, hx + hs * .5 + Math.cos(a) * hs * .3, hy + hs * .5 + Math.sin(a) * hs * .3, 4, 1); }
    for (i = 0; i < 3; i++) P.line(hx + hs * 1.0, hy + hs * (.3 + i * .2), hx + hs * 1.2, hy + hs * (.3 + i * .2), 0, 4);
  }, (function () {
    var m = { 1: function (t, lk, k) { MA = .85 + .15 * Math.sin(t * 2 + k * 30); MS = 2.4; }, 2: function (t) { rot(.2, .2, t * .12); }, 3: function (t, lk, k) { MA = .3 + .4 * Math.pow(Math.max(0, Math.sin(k * 40 - t * 3)), 2); }, 4: function (t) { rot(.68 + .1, .1 + .1, t * 1.6); } }, q;
    function cell(th) { return function (t, lk) { if (th < .1 + lk * .9) MA = .9; else MA = 0; }; }
    for (q = 0; q < 10; q++) m[10 + q] = cell(q / 10);
    return m;
  })());

  /* Welt 6 · Gastgeber: eine Finca am Hang, der Pool, eine Palme, die Sonne steht tief ueber dem Meer */
  var W6 = { hy: .46, sx: .465, sy: .45, cx: .1, cy: .29 };
  FORM.w6 = picForm(5, 'Finca', function (P) {
    var hy = W6.hy, sx = W6.sx, sy = W6.sy, sr = .09, tl = .87, hb = .67, bx = .755, bw = .27, bt = .485, cx = W6.cx, cy = W6.cy, pcx = .5, pcy = .795, prx = .135, pry = .047;
    var i, j, a, r1, u, x, y, x2, y2, tx, ty, tn, l, sg, el = [], ew = [], tr = [[.035, .945], [.03, .81], [.034, .67], [.047, .53], [.07, .4], [cx, cy]];
    var FR = [[-178, .19, .17], [-150, .2, .12], [-120, .17, .07], [-88, .15, .04], [-58, .17, .07], [-30, .2, .12], [-4, .17, .16]];
    // Meer, tiefe Sonne, ihr Licht auf dem Wasser
    P.line(.075, hy, .7, hy, 0, 0, 1.2);
    P.disc(sx, sy, sr, 1, 1, 46); P.circ(sx, sy, sr + .034, 2, 0);
    for (i = 0; i < 7; i++) { a = -PI + (i + 1) * PI / 8; r1 = sr + (i % 2 ? .15 : i % 6 ? .105 : .095); P.line(sx + Math.cos(a) * (sr + .065), sy + Math.sin(a) * (sr + .065), sx + Math.cos(a) * r1, sy + Math.sin(a) * r1, 3, i % 2 ? 1 : 0); }
    for (i = 0; i < 4; i++) P.line(sx - .1 + i * .024, hy + .034 + i * .032, sx + .1 - i * .024, hy + .034 + i * .032, 4, 1, 1.1);
    // der Hang: hinten steigt er an, vorn liegen zwei Terrassen
    P.line(.7, hy, 1.06, .185, 0, 4, .8);
    P.poly([[-.06, .975], [.3, tl], [.69, tl], [.715, hb], [1.06, hb]], 0, 0, false, 1.2);
    for (i = 0; i < 3; i++) P.line(.7 + i * .006, tl - .04 - i * .05, .74 + i * .006, tl - .04 - i * .05, 0, 4, .7);
    // die Finca: flaches Dach, drei Boegen, Licht in den Fenstern
    P.poly([[bx, hb], [bx, bt], [bx + bw, bt], [bx + bw, hb]], 0, 0, false, 1.3);
    P.poly([[bx - .032, bt + .004], [bx + .05, .405], [bx + bw - .05, .405], [bx + bw + .032, bt + .004]], 0, 0, true, 1.6);
    P.poly([[bx + bw - .088, .405], [bx + bw - .088, .352], [bx + bw - .052, .352], [bx + bw - .052, .405]], 0, 0, false);
    for (i = 0; i < 3; i++) {
      x = bx + .055 + i * .08;
      P.line(x - .028, hb, x - .028, hb - .077, 0, 0); P.circ(x, hb - .077, .028, 0, 0, PI, TAU); P.line(x + .028, hb - .077, x + .028, hb, 0, 0);
      P.fill(x - .015, bt + .024, .03, .032, 10 + i * 3, 1, 110);
    }
    // der Pool auf der unteren Terrasse: rund, mit Wasser und Leiter
    for (i = 0; i < 30; i++) { a = i / 30 * TAU; el.push([pcx + Math.cos(a) * prx, pcy + Math.sin(a) * pry]); ew.push([pcx + Math.cos(a) * (prx - .013), pcy + Math.sin(a) * (pry - .009)]); }
    P.poly(el, 0, 0, true, 1.3); P.shape(ew, 6, 1, 64);
    for (i = 0; i < 2; i++) { x = pcx + .062 + i * .034; y = pcy + pry * .82 - i * .012; P.line(x - .012, y + .012, x - .012, y - .03, 0, 0, 1.2); P.circ(x, y - .03, .012, 0, 0, PI, TAU, 1.2); P.line(x + .012, y - .03, x + .012, y - .012, 0, 0, 1.2); }
    // die Palme rahmt das Bild
    P.poly(tr, 0, 0, false, 1.5);
    P.poly(tr.map(function (q, n) { return [q[0] + .024 * (1 - n / 5.4), q[1]]; }), 0, 0, false, 1.5);
    for (i = 1; i < 5; i++) P.line(tr[i][0], tr[i][1], tr[i][0] + .024 * (1 - i / 5.4), tr[i][1] - .012, 0, 4, .8);
    for (i = 0; i < FR.length; i++) {
      a = FR[i][0] * PI / 180; x = cx; y = cy; sg = Math.cos(a) < 0 ? -1 : 1;
      for (j = 1; j <= 7; j++) {
        u = j / 7; x2 = cx + Math.cos(a) * FR[i][1] * u; y2 = cy + Math.sin(a) * FR[i][1] * u + FR[i][2] * u * u;
        P.line(x, y, x2, y2, 7, 0, 1.6);
        // Fiedern: kurze Striche an der Unterseite, zur Spitze hin kuerzer
        tx = x2 - x; ty = y2 - y; tn = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tn; ty /= tn; l = .042 * (1 - .55 * u);
        if (j > 1) P.line(x2, y2, x2 + (tx * .45 - ty * sg * .9) * l, y2 + (ty * .45 + tx * sg * .9) * l, 7, 4, .8);
        x = x2; y = y2;
      }
    }
    P.disc(cx - .015, cy + .022, .012, 7, 1, 160); P.disc(cx + .014, cy + .026, .012, 7, 1, 160);
  }, (function () {
    // die Sonne sinkt mit dem Scrollen, was unter dem Horizont liegt, ist nicht zu sehen; in der Finca gehen die Lichter an
    function sink(lk) { MY += .04 * lk; if (MY > W6.hy - .007) MA = 0; }
    var m = {
      1: function (t, lk, k) { MA = .85 + .15 * Math.sin(t * 2 + k * 30); MS = 2.4; sink(lk); },
      2: function (t, lk) { sink(lk); },
      3: function (t, lk, k) { MA = .55 + .4 * Math.pow(Math.max(0, Math.sin(t * 1.2 + k * 9)), 2); sink(lk); },
      4: function (t, lk, k) { MX += Math.sin(t * 1.3 + MY * 70) * .006; MA = .5 + .45 * Math.pow(Math.sin(t * 1.7 + MY * 90 + k * 3), 2); },
      6: function (t, lk, k) { MA = .5 + .45 * Math.pow(Math.sin(MX * 38 + MY * 70 - t * 1.8), 2); MS = 2.2; },
      7: function (t) { rot(W6.cx, W6.cy, Math.sin(t * .8) * .03); }
    }, q;
    function lamp(th) { return function (t, lk) { if (th < .1 + lk * .9) { MA = 1; MS = 2.4; } else { MA = .3; MR = 4; } }; }
    for (q = 0; q < 10; q++) m[10 + q] = lamp(q / 10);
    return m;
  })());

  /* Welt 7 und Welt 8: die Zeichnungen stehen jeweils als ganzer Block zwischen START und ENDE.
     Fest bleiben die Namen FORM.w7 und FORM.w8 und die Nummern 6 und 7 in picForm(). */
  /* W7-START */
  /* Welt 7 · Baeckereien: die Brezel haengt am Ausleger, das Brett fuellt sich Laib fuer Laib, das frische Brot dampft */
  var W7 = { px: .37, py: .085, ty: .86, sa: 0, sc: 1, ss: 0, st: -1 };   // Ring, an dem die Brezel pendelt, Oberkante des Bretts, Ablage fuer den Pendelwinkel je Bild
  FORM.w7 = picForm(6, 'Backstube', function (P) {
    var hx = W7.px, hy = W7.py, ty = W7.ty, bx = hx, by = .42, a = .27, m = 6, C = [], i, j, s, u, n, p0, p1, p2, p3, x, y, dx, dy, d, sg, ok, was, ox, oy, qx, qy;
    // Stuetzpunkte der Brezel: x, y, halbe Dicke, Lage (der Arm mit der hoeheren Zahl liegt oben)
    var K = [[-.42, .6, .058, 3], [-.2, .3, .056, 3], [0, .02, .056, 3], [.2, -.3, .06, 3], [.42, -.58, .07, 1], [.7, -.66, .085, 1], [.93, -.42, .095, 1], [1, -.02, .105, 1], [.87, .4, .118, 1], [.5, .7, .135, 1], [0, .8, .145, 1]];
    for (i = 9; i >= 0; i--) K.push([-K[i][0], K[i][1], K[i][2], i < 4 ? 2 : 1]);
    function cr(a0, a1, a2, a3, t) { return .5 * (2 * a1 + (a2 - a0) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t * t + (3 * a1 - a0 - 3 * a2 + a3) * t * t * t); }
    function dome(x0, y0, w, h, e) { var pts = [], q, an, c; for (q = 0; q <= 16; q++) { an = PI + q / 16 * PI; c = Math.cos(an); pts.push([x0 + (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), e) * w / 2, y0 - Math.pow(Math.abs(Math.sin(an)), .8) * h]); } return pts; }
    function loaf(g, x0, w, h, e) { P.poly(dome(x0, ty, w, h, e), 10 + g, 0, false, 1.2); P.shape(dome(x0, ty - .013, w - .036, h - .028, e), 20 + g, 1, 24); }
    function cut(g, x0, y0, l, sl) { P.line(x0 - l * sl, y0 + l, x0 + l * sl, y0 - l, 10 + g, 0); }
    function steam(g, x0, y0, h, ph) { var pts = [], q, v; for (q = 0; q <= 14; q++) { v = q / 14; pts.push([x0 + Math.sin(v * 7 + ph) * .024 * (.3 + v), y0 - v * h]); } P.poly(pts, 30 + g, 1, false, 1.1); }

    // Wand, Ausleger mit Strebe und Schnecke
    P.line(0, -.03, 0, .3, 0, 0, 1.16); P.rect(0, .025, .022, .2, 0, 0);
    P.line(.022, .06, .7, .06, 0, 0, 1.3); P.circ(.7, .086, .026, 0, 0, -PI / 2, PI * .9);
    P.circ(.022 + .13, .06 + .13, .13, 0, 0, PI, PI * 1.5);

    // die Brezel: Mittellinie, zwei Raender, was unter einem Arm liegt, faellt weg
    for (s = 0; s < K.length - 1; s++) {
      p0 = K[Math.max(0, s - 1)]; p1 = K[s]; p2 = K[s + 1]; p3 = K[Math.min(K.length - 1, s + 2)];
      for (j = 0; j < m; j++) { u = j / m; C.push([bx + cr(p0[0], p1[0], p2[0], p3[0], u) * a, by + cr(p0[1], p1[1], p2[1], p3[1], u) * a, (p1[2] + (p2[2] - p1[2]) * u) * a, u < .5 ? p1[3] : p2[3], 0, 0]); }
    }
    p1 = K[K.length - 1]; C.push([bx + p1[0] * a, by + p1[1] * a, p1[2] * a, p1[3], 0, 0]); n = C.length;
    for (i = 0; i < n; i++) { p0 = C[Math.max(0, i - 1)]; p2 = C[Math.min(n - 1, i + 1)]; dx = p2[0] - p0[0]; dy = p2[1] - p0[1]; d = Math.sqrt(dx * dx + dy * dy) || 1; C[i][4] = -dy / d; C[i][5] = dx / d; }
    for (sg = -1; sg < 2; sg += 2) {
      was = false;
      for (i = 0; i < n; i++) {
        p1 = C[i]; qx = p1[0] + p1[4] * p1[2] * sg; qy = p1[1] + p1[5] * p1[2] * sg; ok = true;
        for (j = 0; j < n && ok; j++) { p2 = C[j]; if (p2[3] > p1[3] && Math.abs(j - i) > 2 * m && (qx - p2[0]) * (qx - p2[0]) + (qy - p2[1]) * (qy - p2[1]) < p2[2] * p2[2] * .94) ok = false; }
        if (ok && was) P.line(ox, oy, qx, qy, 1, 0, 1.6);
        ox = qx; oy = qy; was = ok;
      }
    }
    p1 = C[0]; d = Math.atan2(-p1[4], p1[5]); P.circ(p1[0], p1[1], p1[2], 1, 0, d + PI / 2, d + PI * 1.5, 1.6);
    p1 = C[n - 1]; d = Math.atan2(-p1[4], p1[5]); P.circ(p1[0], p1[1], p1[2], 1, 0, d - PI / 2, d + PI / 2, 1.6);
    // der Teig: ein Raster im Bauch und in den Schultern, die Arme bleiben frei
    u = M ? .017 : .0095;
    for (y = by - .8 * a + u / 2; y < by + a; y += u) for (x = bx - 1.15 * a + u / 2; x < bx + 1.15 * a; x += u) {
      ok = false;
      for (j = 0; j < n; j++) { p2 = C[j]; d = (x - p2[0]) * (x - p2[0]) + (y - p2[1]) * (y - p2[1]); if (p2[3] > 1) { if (d < (p2[2] + .009) * (p2[2] + .009)) { ok = false; break; } } else if (d < (p2[2] - .011) * (p2[2] - .011)) ok = true; }
      if (ok) P.dot(x, y, 5, 1, M ? 2.36 : 2);
    }
    // Salz
    for (i = 5 * m + 2, j = 0; i <= 15 * m; i += 4, j++) { p1 = C[i]; d = ((j * 7) % 5 - 2) * .26; P.dot(p1[0] + p1[4] * p1[2] * d, p1[1] + p1[5] * p1[2] * d, 3, 1, 5.8); }
    // Ring und Ketten
    P.line(hx, .06, hx, hy - .012, 0, 0); P.circ(hx, hy, .012, 2, 0);
    P.line(hx - .008, hy + .01, bx - .62 * a, by - .745 * a, 2, 0); P.line(hx + .008, hy + .01, bx + .62 * a, by - .745 * a, 2, 0);

    // das Brett mit zwei Konsolen
    P.rect(-.04, ty, 1.08, .028, 0, 0, 1.12);
    for (i = -1; i < 2; i += 2) { x = .5 + i * .4; P.line(x, ty + .028, x, ty + .12, 0, 0); P.line(x, ty + .12, x - i * .1, ty + .028, 0, 0); P.line(x + i * .016, ty + .028, x + i * .016, ty + .12, 0, 4, .7); }

    // Brot und Broetchen: Gruppe 10 + j ist der Rand, 20 + j das Innere, 30 + j der Dampf
    loaf(0, .11, .22, .125, .68); for (i = -1; i < 2; i++) cut(0, .11 + i * .045, ty - .066 + Math.abs(i) * .008, .026, .6);
    loaf(1, .285, .1, .058, .7); loaf(1, .39, .1, .058, .7); cut(1, .285, ty - .03, .014, .5); cut(1, .39, ty - .03, .014, .5);
    P.poly(dome(.3375, ty - .058, .1, .058, .7), 11, 0, true, 1.2); P.shape(dome(.3375, ty - .071, .064, .03, .7), 21, 1, 24); cut(1, .3375, ty - .088, .014, .5);
    loaf(2, .56, .23, .075, .5); for (i = -2; i < 2; i++) cut(2, .585 + i * .048, ty - .04, .018, -.7);
    loaf(3, .805, .23, .14, .68); for (i = -1; i < 2; i++) cut(3, .8 + i * .047, ty - .074 + Math.abs(i) * .008, .028, .6);
    loaf(4, .975, .1, .058, .7); cut(4, .975, ty - .03, .014, .5);
    // Dampf ueber dem frischen Brot
    steam(3, .74, ty - .15, .3, 0); steam(3, .8, ty - .17, .4, 2); steam(3, .86, ty - .15, .3, 4);
    steam(4, .975, ty - .08, .24, 1);
  }, (function () {
    // die Brezel pendelt am Ring (Winkel einmal je Bild gerechnet); die Laibe kommen mit dem Scrollen von rechts nach links, davor steht nur ihr Platz in Grau;
    // das Salz leuchtet nach und nach auf, der Dampf zieht nach oben
    function sway(t) { var dx, dy; if (t !== W7.st) { W7.st = t; W7.sa = Math.sin(t * .9) * .03; W7.sc = Math.cos(W7.sa); W7.ss = Math.sin(W7.sa); } dx = MX - W7.px; dy = MY - W7.py; MX = W7.px + dx * W7.sc - dy * W7.ss; MY = W7.py + dx * W7.ss + dy * W7.sc; }
    var m = {
      1: function (t) { sway(t); },
      2: function (t) { sway(t); },
      3: function (t, lk, k) { if (k < .3 + .7 * lk) MA = .75 + .25 * Math.sin(t * 2.2 + k * 40); else { MA = .45; MR = 4; } sway(t); },
      5: function (t) { MA = .8; sway(t); }
    }, TH = [.8, .64, .48, 0, .3], q;
    function rim(th) { return function (t, lk) { var v = (lk - th) / .07; if (v <= 0) { MA = .34; MR = 4; } else if (v < 1) { MY -= (1 - v) * (1 - v) * .05; } }; }
    function body(th) { return function (t, lk) { var v = (lk - th) / .07; if (v <= 0) MA = 0; else if (v < 1) { MY -= (1 - v) * (1 - v) * .05; MA = .86 * v; } }; }
    function mist(th) { return function (t, lk, k) { var v = (lk - th - .07) / .1, h = W7.ty - MY; if (v <= 0) { MA = 0; return; } if (v > 1) v = 1; MX += Math.sin(t * 1.1 + h * 16) * .02 * h; MA = v * (.34 + .6 * Math.pow(Math.sin(h * 15 - t * 1.6 + k), 2)) * (1 - h * 1.1); }; }
    for (q = 0; q < 5; q++) { m[10 + q] = rim(TH[q]); m[20 + q] = body(TH[q]); m[30 + q] = mist(TH[q]); }
    return m;
  })());
  /* W7-END */

  /* W8-START */
  /* Welt 8 · Strukturvertriebe: einer steht oben, darunter waechst die Struktur Ebene fuer Ebene, neue Partner leuchten gruen */
  var W8 = (function () {
    var o = {
      n: [1, 2, 4, 8],                  // Partner je Ebene
      hy: [.04, .34, .61, .855],        // Kopfmitte je Ebene
      hr: [.042, .033, .027, .022],     // Kopfradius je Ebene
      a: [-1, -.1, .2, .5],             // ab diesem lk waechst die Ebene
      sp: [0, .04, .08, .17],           // so lange dauert es, bis alle Partner einer Ebene da sind
      ox: 0, sx: 1,                     // Lage und Breite der Struktur im Bild: sie fuellt ihr Feld, den Abstand zur Karte haelt fitPic()
      rb: [], by: [], fy: [], c0: [0], c1: [0], st: []
    }, L, j, n;
    for (L = 0; L < 4; L++) {
      n = o.n[L];
      o.rb[L] = o.hr[L] * 1.75;                        // Radius der Schultern
      o.by[L] = o.hy[L] + o.hr[L] * 1.4 + o.rb[L];     // Unterkante der Figur
      o.fy[L] = o.hy[L] + o.hr[L] * 1.2;               // Mitte der Figur, aus ihr waechst sie
      if (L < 3) o.c0[L + 1] = o.by[L] + .024;         // hier beginnen die Linien zur naechsten Ebene
      if (L) o.c1[L] = o.hy[L] - o.hr[L] - .024;       // hier kommen sie an
      o.st[L] = [];                                    // Reihenfolge, in der die Partner einer Ebene dazukommen
      for (j = 0; j < n; j++) o.st[L][j] = o.a[L] + ((j * 3) % n) / n * o.sp[L];
    }
    return o;
  })();
  FORM.w8 = picForm(7, 'Struktur', function (P) {
    var L, j, n, cx, hy, hr, rb, by, i, pts;
    for (L = 0; L < 4; L++) {
      n = W8.n[L]; hr = W8.hr[L]; hy = W8.hy[L]; rb = W8.rb[L]; by = W8.by[L];
      for (j = 0; j < n; j++) {
        cx = W8.ox + W8.sx * (j + .5) / n;
        if (L) P.line(W8.ox + W8.sx * (Math.floor(j / 2) + .5) / (n / 2), W8.c0[L], cx, W8.c1[L], L, 0, 1.1);
        P.disc(cx, hy, hr, 10 + L, 1, 90);
        P.circ(cx, by, rb, 10 + L, 0, PI, TAU, 1.4); P.line(cx - rb, by, cx + rb, by, 10 + L, 0, 1.4);
        if (!L) {
          // wer oben steht, ist ausgefuellt
          pts = []; for (i = 0; i <= 14; i++) pts.push([cx - Math.cos(i / 14 * PI) * (rb - .01), by - .008 - Math.sin(i / 14 * PI) * (rb - .014)]);
          P.shape(pts, 10, 0, 64);
        }
      }
    }
  }, (function () {
    var m = {}, L;
    // Impulse laufen von oben durch die Struktur, d ist die Tiefe in Ebenen
    function wave(t, d) { var x = fract((d - t * .5) / 2.6); if (x > .5) x = 1 - x; x = 1 - x * 16; return x > 0 ? x : 0; }
    function link(L) {
      var n = W8.n[L], st = W8.st[L], y0 = W8.c0[L], dy = 1 / (W8.c1[L] - W8.c0[L]);
      return function (t, lk, k) {
        var j = Math.floor((MX - W8.ox) / W8.sx * n), u = (MY - y0) * dy, q;
        if (j < 0) j = 0; else if (j > n - 1) j = n - 1;
        if (u > (lk - st[j]) * 10) { MA = 0; return; }          // die Linie waechst vom Partner oben nach unten
        q = wave(t, L - 1 + u);
        MA = .62 + .38 * q; if (q > .3) { MR = 1; MS += (M ? .7 : 1.2) * q; }
      };
    }
    function figure(L) {
      var n = W8.n[L], st = W8.st[L], cy = W8.fy[L], a2 = L < 3 ? W8.a[L + 1] + .1 : 9, lk0 = -1, t0 = -1, nw = 0, gh = 0, qf = 0;
      return function (t, lk, k) {
        var j = Math.floor((MX - W8.ox) / W8.sx * n), cx, ap, e, head = MR === 1;
        if (j < 0) j = 0; else if (j > n - 1) j = n - 1;
        if (lk !== lk0) { lk0 = lk; nw = L ? 1 - sstep(a2, a2 + .14, lk) : 0; gh = L < 2 ? 0 : seg(lk, W8.a[L] - .1, W8.a[L] - .02); }
        if (t !== t0) { t0 = t; qf = wave(t, L); }
        ap = (lk - st[j] - .1) / .07;
        if (ap <= 0) {
          // der freie Platz: ein blasser, gestrichelter Umriss, bevor jemand kommt
          if (gh <= 0 || (!head && ((!M && k > .6) || fract((MX * 1.4 + MY) * 46) > .55))) { MA = 0; return; }
          MA = (head ? .3 : .2) * gh; MR = 4; return;
        }
        if (ap < 1) { cx = W8.ox + W8.sx * (j + .5) / n; e = (.35 + .65 * eo(ap)) * (1 + .3 * ap * (1 - ap)); MX = cx + (MX - cx) * e; MY = cy + (MY - cy) * e; } else ap = 1;
        if (k < nw) {
          // neu: ganz in Gruen, der Schein atmet
          MR = 1; MA = ap; e = (M ? .06 : .12) * nw * nw;
          if (k < e && k < e * (.62 + .38 * Math.sin(t * 1.8 + j * 1.3))) MS = 2.6;
        } else { MA = (head ? .9 : .84) * ap; if (!L) MR = 0; else if (qf > .35) MR = 1; }   // angekommen: Elfenbein, der Kopf bleibt gruen
        if (qf > 0) MS += .5 * qf;
      };
    }
    for (L = 1; L < 4; L++) m[L] = link(L);
    for (L = 0; L < 4; L++) m[10 + L] = figure(L);
    return m;
  })());
  /* W8-END */

  /* Auftakt zu Kapitel 7: acht Keime in zwei Treppen, aus jedem wird eine Welt */
  FORM.seeds = {
    name: 'Acht Welten',
    init: function () {},
    run: function (o, p, t) {
      var i, j, f, q, c, s = G.pic.seedS, n, br, ds = M ? clamp(s / 32, 1.5, 2.3) : clamp(s / 62, 1.5, 2);   // groessere Keime, kraeftigere Punkte
      var K = Math.ceil(N / NS);   // Punkte je Keim
      for (i = 0; i < N; i++) {
        // jeder Keim nimmt seine Punkte in gleichen Abstaenden aus der ganzen Zeichnung, am Handy nur aus ihren Linien (outlinePts)
        j = i % NS; f = PICS[j].out || PICS[j].pts; n = f.length; q = f[Math.min(n - 1, Math.floor((Math.floor(i / NS) + .5) * n / K))]; c = G.seed(j);
        br = .5 + .5 * Math.sin(t * 1.4 - j * .9);
        o.x[i] = c[0] + (q[0] - .5) * s; o.y[i] = c[1] + (q[1] - .5) * s + Math.sin(t * .8 + j) * 3;
        o.a[i] = .7 + .3 * br; o.s[i] = q[4] ? ds * 1.45 : ds; o.r[i] = 0;
        if (j === 5 && q[2] > 0 && q[2] < 4 && q[1] > W6.hy - .007) o.a[i] = 0;   // die Sonne steht auch im Keim auf dem Horizont
      }
    },
    decor: function (w, p, t) {
      var j, c, s = G.pic.seedS;
      ctx.globalCompositeOperation = 'source-over'; monoFont(M ? 8 : 10); ctx.fillStyle = FG[2]; ctx.strokeStyle = FG[2]; ctx.lineWidth = 1;
      for (j = 0; j < NS; j++) {
        c = G.seed(j); ctx.globalAlpha = .75 * w;
        label('0' + (j + 1), c[0] - s * .5, c[1] + s * .62 + 10, 'left', 1.6);
        ctx.globalAlpha = .4 * w; ctx.beginPath(); ctx.moveTo(c[0] - s * .5, c[1] + s * .62 - 2.5); ctx.lineTo(c[0] + s * .5, c[1] + s * .62 - 2.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };

  /* 19 · Augenhoehe: eine Linie, zwei Enden, ein Punkt, der von dir zu mir wandert */
  FORM.horizon = {
    name: 'Augenhöhe',
    init: function () {},
    run: function (o, p, t) {
      var y0 = G.hor, E = G.eye, i, x, sp, g;
      for (i = 0; i < N; i++) {
        x = E.x0 + R1[i] * (E.x1 - E.x0);
        g = (R2[i] + R3[i] + R4[i]) / 1.5 - 1;
        sp = Z[i] > .88 ? 3.5 : .6;
        o.x[i] = x + Math.sin(t * .1 + R3[i] * 20) * 3;
        o.y[i] = y0 + g * sp + Math.sin(x * .0045 + t * .22) * 2.2;
        o.a[i] = Z[i] > .88 ? .2 : .5 + .4 * R4[i]; o.s[i] = Z[i] > .88 ? 1.2 + R3[i] : 1.1 + .5 * R3[i]; o.r[i] = 0;
      }
    },
    post: function (w, p, t) {
      // zwei Punkte, einer von dir, einer von mir, treffen sich in der Mitte
      var E = G.eye, cx = (E.x0 + E.x1) / 2, k = eio(seg(p, late(83.2), late(91.2))), xa = lerp(E.x0, cx - 7, k), xb = lerp(E.x1, cx + 7, k), meet = sstep(late(91.0), late(91.8), p);
      var y = G.hor, br = 1 + .06 * Math.sin(t * .8), ly = y + (M ? 25 : 28), g;
      ctx.globalCompositeOperation = 'source-over';
      if (worldAt(cx, y) !== 1) return;
      // Endpunkte
      ctx.globalAlpha = w; ctx.strokeStyle = FG[1]; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(E.x0, y - 10); ctx.lineTo(E.x0, y + 10); ctx.moveTo(E.x1, y - 10); ctx.lineTo(E.x1, y + 10); ctx.stroke();
      ctx.fillStyle = BG[1]; ctx.beginPath(); ctx.arc(E.x0, y, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(E.x1, y, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      monoFont(M ? 9 : 10); ctx.fillStyle = FG[1]; ctx.globalAlpha = .8 * w;
      label('DU', E.x0, ly, 'left', 2); label('ICH', E.x1, ly, 'right', 2);
      label('AUGENHÖHE', cx, ly, 'center', 2);
      // die Punkte
      ctx.globalAlpha = 1;
      g = ctx.createRadialGradient(xa, y, 0, xa, y, 120 * br);
      g.addColorStop(0, 'rgba(15,157,91,' + (.2 * w) + ')'); g.addColorStop(1, 'rgba(15,157,91,0)');
      ctx.fillStyle = g; ctx.fillRect(xa - 130, y - 130, 260, 260);
      g = ctx.createRadialGradient(xb, y, 0, xb, y, 120 * br);
      g.addColorStop(0, 'rgba(15,157,91,' + (.26 * w) + ')'); g.addColorStop(1, 'rgba(15,157,91,0)');
      ctx.fillStyle = g; ctx.fillRect(xb - 130, y - 130, 260, 260);
      ctx.globalAlpha = w; ctx.fillStyle = FG[1]; ctx.beginPath(); ctx.arc(xa, y, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0f9d5b'; ctx.beginPath(); ctx.arc(xb, y, 6, 0, TAU); ctx.fill();
      if (meet > 0) { ctx.globalAlpha = w * meet * .7; ctx.strokeStyle = '#0f9d5b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, y, (M ? 11 : 12) + (M ? 5 : 7) * meet, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  };

  /* 20 · Signet */
  FORM.logo = (function () {
    var kd, lx, ly;
    return {
      name: 'Signet',
      init: function () {
        kd = new Uint8Array(N); lx = new Float32Array(N); ly = new Float32Array(N);
        var nb = Math.floor(N * .66), na = Math.floor(N * .17), i, j, b, x, y, g, pb = [], pa = [], perm;
        g = Math.sqrt(2500 / nb);
        for (j = 0; j < 3; j++) { b = BAR[j]; for (y = b[1] + g * .5; y < b[1] + b[3]; y += g) for (x = b[0] + g * .5; x < b[0] + b[2]; x += g) { if (!inPoly(x, y, ARROW) && distPoly(x, y, ARROW) > 3.2) pb.push([x, y]); } }
        g = Math.sqrt(1010 / na);
        for (y = 21; y < 82; y += g) for (x = 61; x < 105; x += g) { if (inPoly(x, y, ARROW)) pa.push([x, y]); }
        perm = shuffle(pb.length, 3);
        var pm2 = shuffle(pa.length, 4), ib = 0, ia = 0;
        for (i = 0; i < N; i++) {
          if (i < nb) { kd[i] = 1; b = pb[perm[ib % pb.length]]; ib++; lx[i] = b[0]; ly[i] = b[1]; }
          else if (i < nb + na) { kd[i] = 2; b = pa[pm2[ia % pa.length]]; ia++; lx[i] = b[0]; ly[i] = b[1]; }
          else kd[i] = 0;
        }
        this.g = Math.sqrt(2500 / nb);
      },
      run: function (o, p, t) {
        var L = G.logo, u = L.S / 128, x0 = L.cx - 64 * u, y0 = L.cy - 64 * u, i, k, tw, rise = seg(p, late(95.6), 100), gr = lerp(.55, 1, eo(rise)), hb, ht;
        for (i = 0; i < N; i++) {
          k = kd[i];
          if (k === 0) {
            tw = .6 + .4 * Math.sin(t * .7 + R4[i] * 40);
            o.x[i] = R1[i] * W + Math.sin(t * .17 + R3[i] * 9) * 24; o.y[i] = fract(R2[i] - t * .008 * Z[i] - p * .03 * Z[i]) * H;
            o.a[i] = (.06 + .2 * R3[i]) * tw; o.s[i] = .9 + 1.3 * R4[i]; o.r[i] = R4[i] > .9 ? 1 : 0;
          } else {
            tw = .75 + .25 * Math.sin(t * (1 + R3[i]) + R4[i] * 40 - ly[i] * .08 + rise * 6);
            o.x[i] = x0 + lx[i] * u; o.y[i] = y0 + ly[i] * u;
            if (k === 2) tw = 1;
            o.a[i] = (k === 1 ? .85 + .15 * R4[i] : 1) * tw; o.s[i] = Math.max(1.5, this.g * u * (k === 1 ? .8 : .86)); o.r[i] = k === 1 ? 1 : 0;
            if (k === 1 && R3[i] < .1) o.s[i] = Math.max(2.6, o.s[i]);
            if (k === 1 && gr < 1) {
              // die drei Balken wachsen mit dem letzten Stueck Scroll und stehen bei 100 % in voller Hoehe
              hb = lx[i] < 47 ? 33 : lx[i] < 74 ? 51 : 72; ht = hb * gr;
              if (103 - ly[i] > ht) { o.y[i] = y0 + (103 - ht) * u; o.a[i] = 0; }
              else o.a[i] *= sstep(ht, ht - 3, 103 - ly[i]) * .4 + .6;
            }
          }
        }
      }
    };
  })();

  /* ---------- Spielplan des Schwarms ---------- */
  var SCHED = [
    { n: 'lattice', a: 0, b: 1.0 },
    { n: 'cursor', a: 2.8, b: 5.95, st: 'rand', sw: .18 },
    { n: 'towers', a: 7.5, b: 16.4, st: 'wipe', wi: 1, wl: .5, sw: .2 },
    { n: 'embers', a: 17.6, b: 22.9, st: 'up', sw: .1 },
    { n: 'leak', a: 24.0, b: 28.55, st: 'rand', sw: .12 },
    { n: 'grid', a: 29.7, b: 30.9, st: 'rand', sw: .1 },
    { n: 'wire', a: 32.2, b: 38.15, st: 'rand', sw: 0 },
    { n: 'bars', a: 40.1, b: 45.55, st: 'wipe', wi: 3, sw: .2 },
    { n: 'streaks', a: 47.4, b: 55.35, st: 'wipe', wi: 4 },
    { n: 'funnel', a: 57.0, b: 69.05, st: 'wipe', wi: 5 },
    { n: 'seeds', a: 70.0, b: 72.28, st: 'wipe', wi: 6, wl: .3 },
    { n: 'w1', a: WA[0] + .95, b: WA[1] - .02, st: 'wipe', wi: 7, wl: .35 },
    { n: 'w2', a: WA[1] + .95, b: WA[2] - .02, st: 'wipe', wi: 8, wl: .35 },
    { n: 'w3', a: WA[2] + .95, b: WA[3] - .02, st: 'wipe', wi: 9, wl: .35 },
    { n: 'w4', a: WA[3] + .95, b: WA[4] - .02, st: 'wipe', wi: 10, wl: .35 },
    { n: 'w5', a: WA[4] + .95, b: WA[5] - .02, st: 'wipe', wi: 11, wl: .35 },
    { n: 'w6', a: WA[5] + .95, b: WA[6] - .02, st: 'wipe', wi: 12, wl: .35 },
    { n: 'w7', a: WA[6] + .95, b: WA[7] - .02, st: 'wipe', wi: 13, wl: .35 },
    { n: 'w8', a: WA[7] + .95, b: K8 - .02, st: 'wipe', wi: 14, wl: .35 },
    /* Kapitel 8 und 9: die Laufzeit des Schwarms hinter dem Wischer (wl, sonst 0,6) behaelt mit KS die Strecke der Live-Fassung */
    { n: 'horizon', a: late(83.5), b: late(93.95), st: 'wipe', wi: 15, wl: .6 * KS },
    { n: 'logo', a: late(95.6), b: 100, st: 'wipe', wi: 16, wl: .6 * KS, sw: .25 }
  ];
  var cur = { fa: null, fb: null, m: 0 };

  function evaluate(p, t) {
    var j, c, n, i;
    for (j = 0; j < SCHED.length - 1; j++) { if (p < SCHED[j + 1].a) break; }
    c = SCHED[j]; n = SCHED[j + 1];
    if (!n || p <= c.b) { F.g.fill(0); FORM[c.n].run(F, p, t); cur.fa = c; cur.fb = null; cur.m = 0; return; }
    A.g.fill(0); B.g.fill(0);
    FORM[c.n].run(A, p, t); FORM[n.n].run(B, p, t);
    var m = (p - c.b) / (n.a - c.b), S = .7, sw = n.sw || 0, mode = n.st, e, d, dx, dy, q, wx = 0, wy = 0, wR = 1, wp = null, pp, wl = n.wl || .6, wlead = n.a > K8 ? .1 * KS : .1;
    if (mode === 'wipe') { wp = WIPES[n.wi]; var oo = wp.o(); wx = oo[0]; wy = oo[1]; wR = maxR(wx, wy); }
    var Ax = A.x, Ay = A.y, Bx = B.x, By = B.y;
    for (i = 0; i < N; i++) {
      if (mode === 'wipe') { pp = wipeReach(wp, Ax[i], Ay[i], wx, wy, wR); e = seg(p, pp - wlead, pp + wl); }
      else { d = mode === 'up' ? clamp(1 - Ay[i] / H, 0, 1) * .8 + R3[i] * .2 : R3[i]; e = clamp(m * (1 + S) - S * d, 0, 1); }
      e = eio(e);
      dx = Bx[i] - Ax[i]; dy = By[i] - Ay[i];
      F.x[i] = Ax[i] + dx * e; F.y[i] = Ay[i] + dy * e;
      if (sw) { q = Math.sin(PI * e) * sw * (R4[i] - .5) * 2; F.x[i] -= dy * q; F.y[i] += dx * q; }
      F.s[i] = A.s[i] + (B.s[i] - A.s[i]) * e; F.a[i] = A.a[i] + (B.a[i] - A.a[i]) * e;
      if (e < .5) { F.r[i] = A.r[i]; F.g[i] = A.g[i]; } else { F.r[i] = B.r[i]; F.g[i] = B.g[i]; }
    }
    cur.fa = c; cur.fb = n; cur.m = m;
  }

  /* ---------- Zeichnen ---------- */
  var glowG = null, glowE = null;
  function sprite(r, g, b) {
    var c = doc.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',.55)'); gr.addColorStop(.35, 'rgba(' + r + ',' + g + ',' + b + ',.16)'); gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
  }
  function arrow(x, y, sz, fill, stroke, alpha) {
    var k = sz / 58.5, i;
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-62.5, -22);
    ctx.beginPath(); for (i = 0; i < ARROW.length; i++) { if (i) ctx.lineTo(ARROW[i][0], ARROW[i][1]); else ctx.moveTo(ARROW[i][0], ARROW[i][1]); } ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = stroke; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }

  var zones = [], ZA = [];
  function inZone(x, y, m) { for (var i = 0; i < ZA.length; i++) { var z = ZA[i]; if (x > z.x0 - m && x < z.x1 + m && y > z.y0 - m && y < z.y1 + m) return true; } return false; }
  function activeZones(p) {
    var i, z, w; ZA.length = 0;
    for (i = 0; i < zones.length; i++) { z = zones[i]; if (p <= z.a0 || p >= z.b1 || !z.w) continue; w = Math.min(seg(p, z.a0, z.a1), 1 - seg(p, z.b0, z.b1)) * z.k; if (w > .01) ZA.push({ x0: z.x, y0: z.y, x1: z.x + z.w, y1: z.y + z.h, k: w, m: z.m || 0 }); }
  }

  function draw(p, t, dt, snap) {
    var i, j, b, n, a, s, r, x, y, tx, ty, vx, vy, dx, dy, d2, d, k, w, lvl, z, zn, f, W3 = W / 3;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = BG[baseWorld]; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < AW.length; i++) {
      a = AW[i]; ctx.fillStyle = BG[a.w];
      if (a.bars) { for (j = 0; j < 3; j++) ctx.fillRect(Math.floor(j * W3), a.top[j], Math.ceil(W3) + 1, H - a.top[j] + 1); }
      else if (a.rect) ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
      else { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill(); }
    }

    var wa = cur.fb ? 1 - cur.m : 1, wb = cur.fb ? cur.m : 0, fa = FORM[cur.fa.n], fbm = cur.fb ? FORM[cur.fb.n] : null;
    if (fa.decor && wa > .01) fa.decor(wa, p, t);
    if (fbm && fbm.decor && wb > .01) fbm.decor(wb, p, t);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    for (b = 0; b < NB; b++) BC[b] = 0; GLn = 0; GEn = 0;
    var kf = snap ? 1 : 1 - Math.exp(-dt * 9.5), fr = dt > 0 ? (1 / 60) / dt : 1;
    var par = M ? 0 : 46, mxo = mouse.sx, myo = mouse.sy, mx = mouse.x, my = mouse.y, MR_ = 150, MR2 = MR_ * MR_;
    var nz = ZA.length, nw = AW.length, nr = ripples.length, imp = impulseOn > 0;
    var Fx = F.x, Fy = F.y, Fa = F.a, Fs = F.s, Fr = F.r, Fg = F.g, jump = W * W * .2;
    var dimK = 1 - .8 * hudK, yT = HT, yB = H - HB, xL = M ? -1 : IX, zmx = M ? 70 : 160, zmy = M ? 80 : 120;
    for (i = 0; i < N; i++) {
      a = Fa[i]; s = Fs[i]; r = Fr[i];
      tx = Fx[i] - mxo * (Z[i] - .45) * par; ty = Fy[i] - myo * (Z[i] - .45) * par;
      if (imp) {
        OVX[i] += (-OX[i] * 34 - OVX[i] * 5.5) * dt; OVY[i] += (-OY[i] * 34 - OVY[i] * 5.5) * dt;
        OX[i] += OVX[i] * dt; OY[i] += OVY[i] * dt; tx += OX[i]; ty += OY[i];
      }
      x = X[i]; y = Y[i];
      dx = tx - x; dy = ty - y;
      if ((a < .03 && DS[i] < .03) || snap || (a < .25 && dx * dx + dy * dy > jump)) { x = tx; y = ty; vx = 0; vy = 0; }
      else { vx = dx * kf; vy = dy * kf; x += vx; y += vy; }
      if (snap) { vx = VX[i]; vy = VY[i]; }
      X[i] = x; Y[i] = y; DS[i] = a;
      if (!snap) { VX[i] = vx * fr; VY[i] = vy * fr; vx = VX[i]; vy = VY[i]; }
      if (a < .03) continue;
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
      // Ruhezonen hinter Text: weiche Superellipse, kein Rechteck
      for (j = 0; j < nz; j++) {
        zn = ZA[j];
        if (zn.m) {
          // enge Zone (Kapitel 7): im Rahmen des Texts ruhig, nach aussen auf kurzem Weg wieder voll; die Zeichnung daneben bleibt unberuehrt
          dx = x < zn.x0 ? zn.x0 - x : x > zn.x1 ? x - zn.x1 : 0; dy = y < zn.y0 ? zn.y0 - y : y > zn.y1 ? y - zn.y1 : 0;
          if (dx < zn.m && dy < zn.m) { d = dx && dy ? Math.sqrt(dx * dx + dy * dy) : dx + dy; if (d < zn.m) a *= 1 - zn.k * (1 - sstep(0, zn.m, d)); }
          continue;
        }
        dx = (x - (zn.x0 + zn.x1) * .5) / ((zn.x1 - zn.x0) * .5 + zmx); dy = (y - (zn.y0 + zn.y1) * .5) / ((zn.y1 - zn.y0) * .5 + zmy);
        if (dx > -1 && dx < 1 && dy > -1 && dy < 1) {
          d = Math.pow(dx * dx * dx * dx + dy * dy * dy * dy, .25);
          if (d < 1) a *= 1 - zn.k * (1 - sstep(.6, 1, d));
        }
      }
      // HUD-Baender und Kapitelindex bleiben ruhig; das untere Band ist immer ruhig, dort stehen auf dem gesperrten Hero Impressum und Datenschutz
      if (y > yB) a *= .2; else if (y < yT || x < xL) a *= dimK;
      // Maus
      dx = x - mx; dy = y - my; d2 = dx * dx + dy * dy;
      if (d2 < MR2) { k = 1 - d2 / MR2; s += k * 1.8; a += k * .45; if (k > .3 && r !== 2 && r !== 3) r = 1; }
      // Welt und Stosswelle
      w = baseWorld;
      for (j = 0; j < nw; j++) {
        z = AW[j];
        if (z.bars) { if (y > z.top[x < W3 ? 0 : x < W3 * 2 ? 1 : 2]) w = z.w; continue; }
        if (z.rect) { if (x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1) w = z.w; continue; }
        dx = x - z.x; dy = y - z.y; d2 = dx * dx + dy * dy;
        if (d2 < z.r * z.r) w = z.w;
        d = Math.sqrt(d2); k = Math.abs(d - z.r);
        if (k < 70 && d > 1) { f = (1 - k / 70); f = f * f * (z.ig ? 38 : 22) * (1 - z.k * .5); x += dx / d * f; y += dy / d * f; s += f * .05; a += f * .02; }
      }
      for (j = 0; j < nr; j++) {
        z = ripples[j]; dx = x - z.x; dy = y - z.y; d = Math.sqrt(dx * dx + dy * dy); k = Math.abs(d - z.r);
        if (k < 80 && d > 1) { f = (1 - k / 80) * z.f; x += dx / d * f * 26 * z.p; y += dy / d * f * 26 * z.p; a += f * .6; s += f * 1.4; if (f > .25 && r !== 2 && r !== 3) r = 1; }
      }
      if (a < .03) continue;
      if (a > 1) a = 1;
      lvl = a < .17 ? 0 : a < .32 ? 1 : a < .54 ? 2 : a < .82 ? 3 : 4;
      b = (w * 5 + r) * 5 + lvl;
      BK[b][BC[b]++] = i;
      F.x[i] = x; F.y[i] = y; F.s[i] = s;   // Ablage fuer den Zeichendurchgang
      if (ADD[w] && lvl >= 3 && s > 2.5 && !Fg[i]) { if (r === 1 && GLn < 1400) GL[GLn++] = i; else if ((r === 2 || r === 3) && GEn < 900) GE[GEn++] = i; }
    }
    if (imp) impulseOn -= dt;

    var tr = 4 + Math.min(10, Math.abs(vel) * 9), sp2, sp, L, nx, ny, hx, hy, idx, arr, wI, q, np = 0;
    for (b = 0; b < NB; b++) {
      n = BC[b]; if (!n) continue;
      arr = BK[b]; wI = Math.floor(b / 25);
      ctx.globalCompositeOperation = ADD[wI] ? 'lighter' : 'source-over';
      ctx.fillStyle = STY[b];
      // kleine Punkte einzeln als Quadrat (schnell), alles andere in kurzen Pfaden
      ctx.beginPath(); np = 0;
      for (j = 0; j < n; j++) {
        idx = arr[j]; x = Fx[idx]; y = Fy[idx]; s = Fs[idx]; vx = VX[idx]; vy = VY[idx];
        sp2 = vx * vx + vy * vy;
        if (sp2 > 5) {
          sp = Math.sqrt(sp2); L = Math.min(sp * tr, 110); hx = vx / sp; hy = vy / sp; if (Fg[idx]) s *= .4; nx = -hy * s * .5; ny = hx * s * .5;
          ctx.moveTo(x + nx, y + ny); ctx.lineTo(x - nx, y - ny); ctx.lineTo(x - hx * L, y - hy * L); ctx.closePath(); np++;
        } else if (Fg[idx]) {
          x -= s * .34; y -= s * .5; ctx.moveTo(x, y);
          for (q = 2; q < 14; q += 2) ctx.lineTo(x + ARW[q] * s, y + ARW[q + 1] * s);
          ctx.closePath(); np++;
        } else if (s < 3.1) { ctx.fillRect(x - s * .5, y - s * .5, s, s); }
        else { ctx.moveTo(x + s * .5, y); ctx.arc(x, y, s * .5, 0, TAU); np++; }
        if (np > 160) { ctx.fill(); ctx.beginPath(); np = 0; }
      }
      if (np) ctx.fill();
    }
    if (fa.post && wa > .01) fa.post(wa, p, t);
    if (fbm && fbm.post && wb > .01) fbm.post(wb, p, t);
    if (GLn || GEn) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55;
      for (j = 0; j < GLn; j++) { idx = GL[j]; s = Fs[idx] * 4.2; ctx.drawImage(glowG, Fx[idx] - s, Fy[idx] - s, s * 2, s * 2); }
      ctx.globalAlpha = .6;
      for (j = 0; j < GEn; j++) { idx = GE[j]; s = Fs[idx] * 4.4; ctx.drawImage(glowE, Fx[idx] - s, Fy[idx] - s, s * 2, s * 2); }
      ctx.globalAlpha = 1;
    }

    // Vignette in der schwarzen Welt, weicht vor jedem Weltwechsel zurueck
    if (baseWorld === 0 && !AW.length) {
      var vg = 1, wq;
      for (i = 0; i < WIPES.length; i++) { wq = WIPES[i]; vg = Math.min(vg, Math.max(seg(wq.at - p, 0, wq.at > K8 ? .7 * KS : .7), seg(p - (wq.at + wq.dur), 0, wq.at >= K8 ? .7 * KS : .7))); }
      if (vg > .01) {
        if (!draw.vg || draw.vgW !== W || draw.vgH !== H) { draw.vg = ctx.createRadialGradient(W * .5, H * .5, Math.min(W, H) * .35, W * .5, H * .5, Math.sqrt(W * W + H * H) * .56); draw.vg.addColorStop(0, 'rgba(0,0,0,0)'); draw.vg.addColorStop(1, 'rgba(0,0,0,.62)'); draw.vgW = W; draw.vgH = H; }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = vg; ctx.fillStyle = draw.vg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      }
    }

    if (fa.top && wa > .01) fa.top(wa, p, t);
    if (fbm && fbm.top && wb > .01) fbm.top(wb, p, t);

    // Raender der Wischer + Klick-Zeiger
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < AW.length; i++) {
      a = AW[i];
      if (a.rect) continue;
      if (a.bars) {
        ctx.globalAlpha = 1; ctx.fillStyle = ACC[a.w];
        for (j = 0; j < 3; j++) if (a.top[j] > 0 && a.top[j] < H) ctx.fillRect(Math.floor(j * W3), a.top[j] - 1.5, Math.ceil(W3) + 1, 3);
        continue;
      }
      if (a.r < 2) continue;
      ctx.globalAlpha = clamp(1.2 - a.k, 0, 1) * .9; ctx.lineWidth = a.ig ? 2 : 1.5;
      ctx.strokeStyle = a.w === 2 ? '#0a0b0d' : ACC[a.w];
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = clamp(1 - a.k * 1.6, 0, 1) * .5;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r * .82, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < WIPES.length; i++) {
      w = WIPES[i];
      if (w.type || w.dur < .8 * (w.at > K8 ? KL : 1)) continue;
      var ks = w.at > K8 ? KL : 1;
      if (p > w.at - 1.1 * ks && p < w.at + .5 * ks) {
        var o = w.o(), ap = sstep(w.at - 1.1 * ks, w.at - .5 * ks, p) * (1 - sstep(w.at + .15 * ks, w.at + .5 * ks, p)), tr2 = 1 - eo(seg(p, w.at - 1.1 * ks, w.at - .1 * ks)), press = 1 - .22 * sstep(w.at - .12 * ks, w.at, p) * (1 - sstep(w.at, w.at + .25 * ks, p));
        if (i === 1) continue;   // hier klickt der grosse Zeiger selbst
        var ww = worldAt(o[0] + 90 * tr2 + 6, o[1] + 120 * tr2 + 8);
        arrow(o[0] + 90 * tr2, o[1] + 120 * tr2, (M ? 30 : 38) * press, FG[ww], BG[ww], ap);
      }
    }
  }

  /* ---------- Layout ---------- */
  function layout(keep) {
    W = win.innerWidth; H = win.innerHeight; M = W < 760 || (W < 1100 && H >= W);
    REM = parseFloat(getComputedStyle(root).fontSize) || 16;
    HT = (M ? 3.4 : 4.4) * REM; HB = (M ? 3 : 3.6) * REM; IX = M ? 0 : 6 * REM;
    dpr = Math.max(1, Math.min(win.devicePixelRatio || 1, 2, Math.sqrt(6.5e6 / (W * H))));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    MAP = M ? MAP_M : MAP_D;
    if (!keep || maxScroll < 2) maxScroll = Math.max(1, Math.round(((M ? LEN_M : LEN_D) - 1) * H));
    trackH = Math.round(H + (1 - pBase) * maxScroll);
    track.style.height = trackH + 'px';
    G.hero = { u: M ? H * .23 / 72 : H * .4 / 72 };
    G.cur = M ? { k: H * .33 / 58.5, tx: W * .5 - H * .33 / 58.5 * 17, ty: H * .1 } : { k: H * .7 / 58.5, tx: W * .63, ty: H * .13 };
    G.leak = M ? { xa: W * .1, xb: W * .92, y: H * .4, hw: 11, fall: H * .24 } : { xa: W * .13, xb: W * .9, y: H * .585, hw: H * .03, fall: H * .33 };
    G.wire = M ? { cx: W * .5, cy: H * .285, h: H * .4 } : { cx: W * .755, cy: H * .5, h: H * .7 };
    G.wire.s = G.wire.h / 1.25; G.wire.x0 = G.wire.cx - G.wire.s / 2; G.wire.y0 = G.wire.cy - G.wire.h / 2;
    G.icon = M ? { cx: W * .5, cy: H * .33, S: H * .4 } : { cx: W * .775, cy: H * .62, S: H * .7 };
    G.logo = M ? { cx: W * .5, cy: H * .2, S: H * .22 } : { cx: W * .79, cy: H * .45, S: H * .52 };
    G.hor = M ? H * .44 : H * .56;
    G.eye = M ? { x0: W * .1, x1: W * .9 } : { x0: Math.max(W * .095, 9 * REM), x1: W * .94 };
    /* Kapitel 7: Feld der Zeichnung und die acht Keime des Auftakts. Hier stehen die Grundwerte, fitPic() und fitSeeds() ruecken
       beides nach dem Messen der Texte zurecht (measure). */
    G.pic = M ? { cx: W * .5, cy: H * .3, s: Math.min(W * .78, H * .36), seedS: 60 } : { cx: W * .72, cy: H * .45, s: H * .6, seedS: 100 };
    G.cardBox = null; G.whoBox = null; G.seedP = []; G.pics = null;
    G.seed = function (j) { return G.seedP[j] || [W * .5, H * .5]; };
    fitPic(); fitSeeds();
    var F_;
    if (M) {
      var ltE = doc.getElementById('loop-t'), ltH = Math.max(86, ltE ? ltE.offsetHeight : 0);
      F_ = G.fun = { vert: true, rg: Math.min(11.5, H * .0145), c: W * .3, a0: H * .2, a4: Math.min(H * .72, H - HB - 1.75 * REM - ltH - 3.1 * REM - 8), hw: [W * .2, W * .14, W * .09, W * .05, W * .03], hin: W * .3, Dc: H * .56, fc: H * .46, cc: W * .3, ring: W * .24, czMax: 2.2, chute: W * .06 };
      // Signet unten rechts, unter dem Rueckweg, neben der Station Rendite
      var mu = Math.min((W * .31) / 78, (H * .15) / 81), mxr = W - 1.1 * REM - 8;
      F_.mk = { u: mu, ox: mxr - 103 * mu, oy: F_.a4 - H * .01 - 22 * mu };
      var cb = W - 26 - F_.c;
      // in der Totale ruecken die Stationsnamen um die Breite der Uhr nach rechts; der Rueckweg haelt Abstand zum ersten Zaehler
      F_.gsx = 2 * F_.rg - 5;
      var s0 = -Math.max(.55, Math.min(.8, 47 / ((F_.a4 - F_.a0) / 4)));
      F_.loop = { s1: 3.45, s0: s0, c0: F_.hw[3] * 1.16 + 8, cb: cb, side: 1, l1: cb - (F_.hw[3] * 1.16 + 8), l2: (3.45 - s0) * (F_.a4 - F_.a0) / 4, l3: cb - F_.hin * .9 };
    } else {
      F_ = G.fun = { vert: false, c: H * .545, a0: W * .15, a4: W * .742, hw: [H * .225, H * .148, H * .09, H * .044, H * .025], hin: H * .31, Dc: W * .62, fc: W * .6, cc: H * .585, ring: H * .3, czMax: 4.2, chute: H * .115 };
      // Signet rechts neben der Station Rendite: so gross, wie der Platz bis zum Rand erlaubt
      var ml = F_.a4 + Math.max(F_.hw[4] * 1.16 + 38, 5.4 * REM), mr = W - 1.75 * REM - 16, mu2 = clamp(Math.min((mr - ml) / 78, H * .3 / 81), 1.1, 4.2);
      F_.mk = { u: mu2, ox: (ml + mr) / 2 - 64 * mu2, oy: F_.c + H * .045 - 103 * mu2 };
      var r3 = F_.hw[3] * 1.16 + 8 + 12, r0 = F_.hw[0] * 1.16 + 8 + 14, yb = H * .345;
      F_.loop = { s1: 3.14, s0: 0, c0: r3, cb: yb, side: 1, l1: yb - r3, l2: 3.14 * (F_.a4 - F_.a0) / 4, l3: yb - r0 };
    }
  }

  var ths = [], verbW = [0, 0, 0], verbsEl = $('.verbs'), verbEls = $$('.verbs .v');
  var whoEl = $('.who-head'), cardIn = $$('.card-in');
  function measure() {
    var r, i, z, el;
    if (gate) { r = gate.getBoundingClientRect(); if (r.width) { G.gx = r.left + r.width / 2; G.gy = r.top + r.height / 2; } }
    if (G.gx === undefined) { G.gx = W * .8; G.gy = H * .45; }
    for (i = 0; i < zones.length; i++) { z = zones[i]; if (z.m) continue; el = z.el; z.x = offL(el); z.y = offT(el); z.w = el.offsetWidth; z.h = el.offsetHeight; }
    ths = $$('.th').map(function (e) { var b = e.getBoundingClientRect(); return { el: e, x: b.left + b.width / 2, y: b.top + b.height / 2, w: -1 }; });
    G.railH = H - HT - HB;
    $$('.mq').forEach(function (m) { var tEl = m.firstElementChild; m._w = tEl.scrollWidth / 2; });
    G.three = $$('.three li').map(function (li) { var tl = $('.tl', li); return { x: offL(li) + li.offsetWidth + 10, y: offT(li) + li.offsetHeight / 2 }; });
    if (verbsEl) { verbsEl.style.width = ''; verbW = verbEls.map(function (v) { var rg = doc.createRange(); rg.selectNodeContents(v); return Math.ceil(rg.getBoundingClientRect().width) + 2; }); vbS = -1; }
    G.stnH = stn.map(function (e) { return e.offsetHeight || 78; });
    /* Kapitel 7: gemessen wird der gesetzte Text, ohne die Bewegung der Zeitachse (html.measuring haelt sie an) */
    root.classList.add('measuring');
    for (i = 0; i < zones.length; i++) { z = zones[i]; if (!z.m) continue; r = textBox(z.el); z.x = r.l; z.y = r.t; z.w = r.r - r.l; z.h = r.b - r.t; }
    G.whoBox = whoEl ? textBox(whoEl) : null;
    G.cardBox = cardIn.map(textBox);
    root.classList.remove('measuring');
    fitPic(); fitSeeds();
    fitWire(); fitHero();
    brandW100 = 0; brandK = ' ';
    portalMeasure();
    kick();
  }
  /* Rahmen des gesetzten Texts in einem Element: jede Zeile zaehlt, nicht der Block */
  function textBox(el) {
    var o = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 }, tw, nd, rg, rs, i, r;
    try {
      tw = doc.createTreeWalker(el, 4, null); rg = doc.createRange();
      while ((nd = tw.nextNode())) {
        if (!/\S/.test(nd.nodeValue)) continue;
        rg.selectNodeContents(nd); rs = rg.getClientRects();
        for (i = 0; i < rs.length; i++) { r = rs[i]; if (!r.width || !r.height) continue; if (r.left < o.l) o.l = r.left; if (r.top < o.t) o.t = r.top; if (r.right > o.r) o.r = r.right; if (r.bottom > o.b) o.b = r.bottom; }
      }
    } catch (e) {}
    if (o.l > o.r) { r = el.getBoundingClientRect(); o = { l: r.left, t: r.top, r: r.right, b: r.bottom }; }
    return o;
  }
  /* Kapitel 7: Text und Zeichnung teilen sich das Bild und beruehren sich nie. Am Desktop steht die Zeichnung rechts neben dem Text
     der Karte, am Handy ueber ihm. Gerechnet wird je Welt: gemessener Text der Karte und Rahmen der Zeichnung (bb). Jede Welt hat ihr
     eigenes Feld (G.pics): eine lange Karte macht nur ihre eigene Zeichnung kleiner, nie den Text und nie die Bilder der anderen Welten.
     Wo der Platz reicht, stehen alle Felder gleich (Groesse s0, Mitte c0). Der kleinste Abstand zum Text (gap) ist groesser als der
     weiche Rand der Ruhezone der Karte, so wird kein Teil der Zeichnung gedaempft; am Desktop haelt das Feld den groesseren Abstand
     air, solange es dafuer nicht kleiner werden muss. G.pic bleibt das kleinste Feld (Debug). */
  function fitPic() {
    var B = G.cardBox || [], s0 = M ? Math.min(W * .78, H * .36) : H * .6, c0 = M ? H * .3 : W * .72, gap = 1.75 * REM, air = 3.5 * REM, P = [], j, k, s, bb, t, lo, hi, q, sm = null;
    var mr = (W < 1200 ? 2.5 : 1.75) * REM;   // Desktop: Rand rechts; auf schmalen Schirmen steht die Zeichnung ein Stueck innerhalb der Rahmenmarke
    for (j = 0; j < NS; j++) {
      bb = (PICS[j] && PICS[j].bb) || [0, 0, 1, 1]; t = B[j]; s = s0;
      // Desktop, niedriges Fenster: die Oberkante der Zeichnung bleibt 16 px unter dem Kopfband
      if (!M) s = Math.min(s, Math.max(s0 * .4, (H * .45 - HT - 16) / (.5 - bb[1])));
      for (k = 0; k < 90; k++) {
        if (M) { lo = HT + 10 + s * (.5 - bb[1]); hi = t ? t.t - 18 - s * (bb[3] - .5) : 1e9; }
        else { lo = t ? t.r + gap + s * (.5 - bb[0]) : -1e9; hi = W - mr - s * (bb[2] - .5); }
        if (lo <= hi || s < s0 * .4) break;
        s *= .985;
      }
      k = lo <= hi ? clamp(c0, lo, hi) : (lo + hi) / 2;
      // Desktop: wo rechts Platz ist, rueckt das Feld weiter vom Text ab (air), die Groesse bleibt
      if (!M && t && lo <= hi) k = clamp(Math.max(k, t.r + air + s * (.5 - bb[0])), lo, hi);
      q = M ? { cx: W * .5, cy: k, s: s } : { cx: k, cy: H * .45, s: s };
      P.push(q); if (!sm || q.s < sm.s) sm = q;
    }
    G.pics = P;
    if (sm) { G.pic.cx = sm.cx; G.pic.cy = sm.cy; G.pic.s = sm.s; }
  }
  /* Auftakt: acht Keime in zwei Treppen zu je vier Stufen, 01 bis 04 oben, 05 bis 08 darunter, so liest das Auge die Nummern der
     Reihe nach. Am Desktop rechts neben der Ueberschrift, am Handy ueber ihr. Jede Stufe traegt Zeichnung, Linie und Nummer;
     nichts beruehrt Text, Kopfband oder Fussband. */
  function fitSeeds() {
    var T_ = G.whoBox, cols = Math.ceil(NS / 2), x0, x1, y0, y1, px, s, row, dy, gr, tot, top, yl, j, P = [], st = 10;   // st: kleinste Stufe am Handy
    if (M) { x0 = 1.1 * REM + 12; x1 = W - 1.1 * REM - 6; y0 = HT + 8; y1 = (T_ ? T_.t : H * .5) - 10; }
    else { x0 = Math.max(W * .5, (T_ ? T_.r : 0) + 2.2 * REM); x1 = W - 1.75 * REM - 6; y0 = HT + 1.5 * REM; y1 = H - HB - 1.5 * REM; }
    px = (x1 - x0) / cols;
    // Hoehe einer Stufe: Zeichnung (mit Ueberstand) 1,18 s, dazu Linie und Nummer 16 px. Beide Treppen muessen in die Hoehe passen.
    s = Math.min(px * (M ? .84 : .77), M ? H * .13 : H * .16, M ? (y1 - y0 - 36 - st * (cols - 1)) / 2.36 : (y1 - y0 - 32) / (2.36 + .3 * cols));
    // Handy: der Keim wird nicht kleiner als 40 px, solange beide Treppen dann noch zwischen Kopfband und Ueberschrift passen (die Stufen werden dafuer flacher)
    s = Math.max(24, M ? Math.max(s, Math.min(40, (y1 - y0 - 36) / 2.36)) : s);
    gr = M ? 4 : s * .3;
    row = 1.18 * s + 16;
    dy = M ? clamp((y1 - y0 - 2 * row - gr) / (cols - 1), 0, s * .24) : s * .3;
    tot = 2 * row + gr + (cols - 1) * dy;
    top = M ? y0 + (y1 - y0 - tot) / 2 : Math.max(y0, H * .485 - tot / 2);
    yl = top + tot - (.62 * s + 16);   // Mitte der ersten Stufe der unteren Treppe
    for (j = 0; j < NS; j++) P.push([x0 + px * ((j % cols) + .5), yl - (j % cols) * dy - (j < cols ? 1 : 0) * (row + gr)]);
    G.seedP = P; G.pic.seedS = s;
  }
  /* Handy: das Drahtmodell der Landingpage endet ueber der Liste "Daraus wissen wir", auch auf niedrigen Schirmen */
  var wireK = '';
  function fitWire() {
    if (!M) { wireK = ''; return; }
    var tw = $('.three-w'), top = tw ? offT(tw) : H, y0 = Math.max(HT + 12, H * .085), h = clamp(top - 18 - y0, H * .2, H * .4), k = Math.round(h) + '|' + Math.round(y0);
    G.wire = { cx: W * .5, cy: y0 + h / 2, h: h }; G.wire.s = h / 1.25; G.wire.x0 = G.wire.cx - G.wire.s / 2; G.wire.y0 = y0;
    if (wireK && wireK !== k && FORM.grid && GRID.x) { FORM.grid.init(); FORM.wire.init(); }
    wireK = k;
  }
  /* Desktop: die drei Balken am Klick-Ziel stehen rechts neben der ersten Zeile der Ueberschrift und ueber der zweiten, nie in ihr */
  function fitHero() {
    if (M || !h1 || G.gx === undefined) return;
    var l1 = $('.l1 > span', h1), l2 = $('.l2 > span', h1), u0 = H * .4 / 72, u = u0, r1, r2, fs, keepT;
    if (!l1 || !l2) return;
    root.classList.add('measuring'); keepT = h1.style.transform; h1.style.transform = 'none';
    r1 = l1.getBoundingClientRect(); r2 = l2.getBoundingClientRect(); fs = parseFloat(getComputedStyle(h1).fontSize) || 100;
    h1.style.transform = keepT; root.classList.remove('measuring');
    if (r1.width && G.gy + 53 * u0 > r1.top + fs * .1) u = Math.min(u, (G.gx - r1.right - 22) / 54);
    if (r2.width && r2.right > G.gx - 54 * u - 12) u = Math.min(u, (r2.top + fs * .1 - 13 - G.gy) / 53);
    G.hero.u = clamp(u, u0 * .6, u0);
  }
  /* Nach jeder Groessenaenderung die HUD-Ebene neu malen lassen (manche Browser lassen den neuen Rand sonst leer) */
  var hudEl = $('.hud'), kickN = 0;
  function kick() { if (!hudEl) return; kickN++; hudEl.style.transform = kickN % 2 ? 'translateZ(0)' : 'translate(0,0)'; }
  function offL(el) { var x = 0; while (el && el !== film) { x += el.offsetLeft; el = el.offsetParent; } return x; }
  function offT(el) { var y = 0; while (el && el !== film) { y += el.offsetTop; el = el.offsetParent; } return y; }

  /* Stationen, Rueckweg, Messuhren und Wortmarke folgen der Kamera */
  var stn = $$('.stn'), stnK = [], loopL = $('#loop-l'), loopK = '', loopT = $('#loop-t'), loopTK = '', brandW = $('#brand-w'), brandK = '', brandW100 = 0;
  var gzB = $$('.gz'), gzT = $$('.gz-tip'), gzK = ['', '', '', ''], gzOn = false, gzG = [{}, {}, {}, {}], tipK = '', tipI = -1;
  function hideEl(el) { if (el && el.style.visibility !== 'hidden') { el.style.visibility = 'hidden'; el.style.opacity = 0; } }
  function funnelOff() {
    var i;
    if (gzOn) { gzOn = false; for (i = 0; i < gzB.length; i++) { gzB[i].style.visibility = 'hidden'; gzK[i] = ''; } }
    if (GZ.pin > -1 || GZ.hot > -1) { GZ.pin = -1; GZ.hot = -1; }
    tip(-1);
    if (loopTK) { loopTK = ''; hideEl(loopT); }
    if (brandK) { brandK = ''; hideEl(brandW); }
  }
  function stations(p) {
    if (p < 55.3 || p > 69.5) { funnelOff(); return; }
    var F_ = G.fun, C = FORM.funnel.cam(p), front = FORM.funnel.front(p), i, x, y, o, sc = lerp(M ? 1.12 : 1.4, 1, C.ov), tf, key, el, close, ring, fade = 1 - sstep(68.9, 69.1, p), g, sz;
    for (i = 0; i < 5; i++) {
      el = stn[i]; ring = FORM.funnel.ringAt(i) * C.cz;
      close = clamp(1.6 - Math.abs(C.sc - i) * 2.6, 0, 1) * sstep(58.2, 58.6, p);
      o = Math.max(C.ov, close) * sstep(i - .3, i - .1, front + .0001) * fade;
      // waehrend die Kamera in die Totale zieht, wandern die Namen ins Bild: im Kopfband, im Fussband und ueber dem Kapitelindex bleiben sie unsichtbar
      if (F_.vert) { y = C.x0 + i * C.D - 30; g = (G.stnH[i] || 78) * (sc - 1) / 2; o *= sstep(HT - 2, HT + 16, y - g) * sstep(H - HB + 2, H - HB - 16, y + (G.stnH[i] || 78) + g); }
      else o *= sstep(IX + 30, IX + 60, C.x0 + i * C.D);
      o = Math.round(o * 100) / 100;
      if (F_.vert) { x = C.c + ring + 14 + C.ov * F_.gsx; y = C.x0 + i * C.D - 30; tf = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')'; }
      else { x = C.x0 + i * C.D; y = C.c - ring - 16; tf = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-100%) scale(' + sc.toFixed(3) + ')'; }
      key = tf + o;
      if (stnK[i] !== key) { stnK[i] = key; el.style.transformOrigin = F_.vert ? '0 50%' : '50% 100%'; el.style.transform = tf; el.style.opacity = o; }
    }
    var lp = F_.loop, Do = (F_.a4 - F_.a0) / 4, lo;
    if (loopL) {
      lo = Math.round(sstep(66.65, 66.95, p) * fade * 100) / 100;
      if (F_.vert) tf = 'translate3d(' + (W - 22).toFixed(1) + 'px,' + (F_.a0 + lp.s0 * Do).toFixed(1) + 'px,0) translate(-100%,-50%)';
      else tf = 'translate3d(' + (F_.a0 + (lp.s0 + lp.s1) / 2 * Do).toFixed(1) + 'px,' + (F_.c + lp.cb).toFixed(1) + 'px,0) translate(-50%,-50%)';
      key = tf + lo;
      if (key !== loopK) { loopK = key; loopL.style.transform = tf; loopL.style.opacity = lo; }
    }
    // der Satz zum Rueckweg erscheint, waehrend die Linie gezeichnet wird
    if (loopT) {
      lo = Math.round(sstep(66.6, 67.0, p) * (1 - sstep(68.75, 69.0, p)) * 100) / 100;
      if (F_.vert) tf = 'translate3d(' + (2.1 * REM).toFixed(1) + 'px,' + (F_.a4 + 3.1 * REM + (1 - lo) * 14).toFixed(1) + 'px,0)';
      else tf = 'translate3d(' + (F_.a0 + lp.s1 * Do + 1.9 * REM).toFixed(1) + 'px,' + (F_.c + lp.cb - (1 - lo) * -14).toFixed(1) + 'px,0) translate(0,-100%)';
      key = tf + lo;
      if (key !== loopTK) { loopTK = key; loopT.style.transform = tf; loopT.style.opacity = lo; loopT.style.visibility = lo > 0 ? 'visible' : 'hidden'; }
    }
    // die Wortmarke steht mittig unter dem Signet
    if (brandW) {
      var K = F_.mk, fs;
      if (!brandW100) { brandW.style.fontSize = '100px'; brandW100 = brandW.offsetWidth || 630; }
      fs = 78 * K.u * 100 / brandW100;
      lo = Math.round(sstep(67.0, 67.4, p) * (1 - sstep(68.5, 68.75, p)) * 100) / 100;
      tf = 'translate3d(' + (K.ox + 64 * K.u).toFixed(1) + 'px,' + (K.oy + 103 * K.u + 7.5 * K.u + (1 - lo) * 10).toFixed(1) + 'px,0) translate(-50%,0)';
      key = tf + lo + '|' + fs.toFixed(1);
      if (key !== brandK) { brandK = key; brandW.style.fontSize = fs.toFixed(1) + 'px'; brandW.style.transform = tf; brandW.style.opacity = lo; brandW.style.visibility = lo > 0 ? 'visible' : 'hidden'; }
    }
    // Schaltflaechen genau ueber den Messuhren
    for (i = 0; i < gzB.length; i++) {
      g = FORM.funnel.gauge(i, p, gzG[i]); el = gzB[i];
      if (g.ok && g.v > .6 && fade > .6 && !locked) {
        sz = Math.max(44, Math.round(g.r * 2 + 16));
        key = g.x.toFixed(1) + ',' + g.y.toFixed(1) + ',' + sz;
        if (gzK[i] !== key) { gzK[i] = key; el.style.width = sz + 'px'; el.style.height = sz + 'px'; el.style.margin = (-sz / 2) + 'px 0 0 ' + (-sz / 2) + 'px'; el.style.transform = 'translate3d(' + g.x.toFixed(1) + 'px,' + g.y.toFixed(1) + 'px,0)'; el.style.visibility = 'visible'; gzOn = true; }
      } else if (gzK[i] !== '') { gzK[i] = ''; el.style.visibility = 'hidden'; if (GZ.hot === i) GZ.hot = -1; if (GZ.pin === i) GZ.pin = -1; if (doc.activeElement === el) { try { el.blur(); } catch (e) {} } }
    }
    if (GZ.pin > -1 && Math.abs(p - GZ.pinP) > .7) GZ.pin = -1;
    i = GZ.hot > -1 ? GZ.hot : GZ.pin;
    tip(i > -1 && gzK[i] !== '' ? i : -1);
  }
  /* Hinweiskarte neben der Uhr: sie verdeckt nie einen Stationsnamen und bleibt im Bild */
  function textRect(el) { var rg = doc.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); }
  function tip(i) {
    var j, el, g, tw, th, R = [], x0, y0, x1, y1, key, r, q, x, y, best = null, bc = 1e9, c, nx, ny, d, hit, gm, m = 8, note = $('#fnote');
    if (i !== tipI) { for (j = 0; j < gzT.length; j++) gzT[j].classList.toggle('on', j === i); for (j = 0; j < gzB.length; j++) gzB[j].setAttribute('aria-expanded', j === i ? 'true' : 'false'); tipI = i; tipK = ''; }
    if (i < 0) return;
    el = gzT[i]; g = gzG[i];
    var F_ = G.fun, C = FORM.funnel.cam(pS * 100), mw = '';
    // schmale Geraete: die Karte wird so schmal, dass sie links neben den Stationsnamen Platz findet
    if (F_.vert) mw = Math.round(clamp(C.c + FORM.funnel.ringAt(Math.min(4, i + 1)) * C.cz + 14 + C.ov * F_.gsx - 8 - 12, 112, 168)) + 'px';
    if (el.style.maxWidth !== mw) el.style.maxWidth = mw;
    tw = el.offsetWidth; th = el.offsetHeight;
    key = g.x.toFixed(0) + ',' + g.y.toFixed(0) + ',' + tw + ',' + th; if (key === tipK) return; tipK = key;
    // was die Karte nie verdecken darf: Stationsnamen, Zaehler, Beschriftungen, Signet und die anderen Uhren
    for (j = 0; j < stn.length; j++) { if (parseFloat(stn[j].style.opacity || 0) < .05) continue; $$('b, .sub, .cnt', stn[j]).forEach(function (e) { R.push(textRect(e)); }); }
    [loopL, loopT, brandW, note].forEach(function (e) { if (e && e === note ? getComputedStyle(e).visibility === 'visible' : (e && parseFloat(e.style.opacity || 0) > .05)) R.push(e.getBoundingClientRect()); });
    var K = G.fun.mk; if (brandK && brandW && parseFloat(brandW.style.opacity || 0) > .05) R.push({ left: K.ox + 22 * K.u, top: K.oy + 18 * K.u, right: K.ox + 106 * K.u, bottom: K.oy + 106 * K.u });
    for (j = 0; j < gzG.length; j++) { q = gzG[j]; if (gzK[j] !== '') R.push({ left: q.x - q.r - (j === i ? 6 : 0), top: q.y - q.r - (j === i ? 6 : 0), right: q.x + q.r + (j === i ? 6 : 0), bottom: q.y + q.r + (j === i ? 6 : 0) }); }
    // quer liegender Funnel: auch die Tore der Stationen bleiben frei
    if (!F_.vert) for (j = 0; j < 5; j++) { q = C.x0 + j * C.D; r = FORM.funnel.ringAt(j) * C.cz; if (q > -60 && q < W + 60) R.push({ left: q - 10 * C.zs, top: C.c - r, right: q + 10 * C.zs, bottom: C.c + r }); }
    x0 = (M ? 0 : IX) + 10; y0 = HT + 8; x1 = W - (M ? 12 : 1.75 * REM) - tw; y1 = H - HB - 8 - th;
    gm = g.r + 10; if (F_.vert) m = 6;
    // der naechste freie Platz zur Uhr gewinnt, bevorzugt ueber ihr; eine feine Linie verbindet Karte und Uhr
    for (y = Math.max(y0, g.y - 330); y <= Math.min(y1, g.y + 330); y += 6) {
      for (x = Math.max(x0, g.x - 340 - tw); x <= Math.min(x1, g.x + 340); x += 6) {
        nx = clamp(g.x, x, x + tw) - g.x; ny = clamp(g.y, y, y + th) - g.y; d = Math.sqrt(nx * nx + ny * ny);
        if (d < gm) continue;
        c = d + (y + th / 2 > g.y ? (F_.vert ? 16 : 44) : 0) + Math.abs(x + tw / 2 - g.x) * .04 + (x + 24 < g.x && x + tw - 24 > g.x && y + th <= g.y ? -6 : 0);
        if (c >= bc) continue;
        hit = false;
        for (j = 0; j < R.length; j++) { r = R[j]; if (x < r.right + m && x + tw > r.left - m && y < r.bottom + m - 2 && y + th > r.top - m + 2) { hit = true; break; } }
        if (!hit) { bc = c; best = [x, y]; }
      }
    }
    if (!best) best = [clamp(g.x - tw / 2, x0, Math.max(x0, x1)), clamp(g.y + gm, y0, Math.max(y0, y1))];
    el.style.transform = 'translate3d(' + Math.round(best[0]) + 'px,' + Math.round(best[1]) + 'px,0)';
    GZ.cx = Math.round(best[0]); GZ.cy = Math.round(best[1]); GZ.cw = tw; GZ.ch = th;
  }
  gzB.forEach(function (b, i) {
    b.addEventListener('mouseenter', function () { if (!touch) GZ.hot = i; });
    b.addEventListener('mouseleave', function () { if (GZ.hot === i && doc.activeElement !== b) GZ.hot = -1; });
    b.addEventListener('focus', function () { var fv = true; try { fv = b.matches(':focus-visible'); } catch (e) {} if (fv) GZ.hot = i; });
    b.addEventListener('blur', function () { if (GZ.hot === i) GZ.hot = -1; });
    b.addEventListener('click', function (e) { e.stopPropagation(); if (GZ.pin === i) { GZ.pin = -1; if (touch) GZ.hot = -1; } else { GZ.pin = i; GZ.pinP = pS * 100; } });
  });
  doc.addEventListener('pointerdown', function (e) { if (GZ.pin > -1 && !(e.target && e.target.closest && e.target.closest('.gz'))) GZ.pin = -1; });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && (GZ.pin > -1 || GZ.hot > -1)) { GZ.pin = -1; GZ.hot = -1; } });
  function gaugeEase(dt) { var i, to, kf = 1 - Math.exp(-dt * 12); for (i = 0; i < 4; i++) { to = (GZ.hot === i || GZ.pin === i) ? 1 : 0; GZ.k[i] += (to - GZ.k[i]) * (dt > 0 ? kf : 1); if (Math.abs(to - GZ.k[i]) < .004) GZ.k[i] = to; } }

  /* ---------- Text: Wortmasken, Buchstaben, Zeitachse ---------- */
  function split(el) {
    function wrap(node) {
      if (node.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var w = doc.createElement('span'); w.className = 'w'; var inner = doc.createElement('span'); inner.textContent = part; w.appendChild(inner); frag.appendChild(w);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1 && !node.classList.contains('w')) { Array.prototype.slice.call(node.childNodes).forEach(wrap); }
    }
    Array.prototype.slice.call(el.childNodes).forEach(wrap);
  }
  function splitChars(el) {
    var out = [], txt = el.textContent.replace(/\s+/g, ' ').trim();
    (function walk(node) {
      if (node.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var wd = doc.createElement('span'); wd.className = 'wd'; wd.setAttribute('aria-hidden', 'true');
          Array.prototype.forEach.call(part, function (c) { var s = doc.createElement('span'); s.className = 'ch'; s.textContent = c; wd.appendChild(s); out.push(s); });
          frag.appendChild(wd);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1) { Array.prototype.slice.call(node.childNodes).forEach(walk); }
    })(el);
    if (el.tagName === 'EM' || el.tagName === 'SPAN') { el.setAttribute('role', 'text'); }
    el.setAttribute('aria-label', txt);
    return out;
  }
  var CHARS = {};
  $$('[data-chars]').forEach(function (el) { CHARS[el.classList.contains('burn') ? 'burn' : 'snap'] = splitChars(el); });
  $$('[data-split]').forEach(split);

  var TL = null, seen = null, touched = [], ranges = [];
  function ft(target, a, b, from, to, ease) {
    var els = typeof target === 'string' ? $$(target) : (target.nodeType ? [target] : Array.prototype.slice.call(target));
    els.forEach(function (el) {
      var first = !seen.has(el), vars = {}, k; seen.add(el); touched.push(el);
      for (k in to) vars[k] = to[k];
      vars.duration = Math.max(.001, b - a); vars.ease = ease || 'power3.out'; vars.immediateRender = first; vars.overwrite = false;
      TL.fromTo(el, from, vars, a);
    });
  }
  function show(el, a) { ft(el, a, a + .02 * (a >= K8 ? KS : 1), { autoAlpha: 0 }, { autoAlpha: 1 }, 'none'); }
  function mark(el, a, b) { var s = (typeof el === 'string' ? $(el) : el).closest('.scene'), i; for (i = 0; i < ranges.length; i++) if (ranges[i].el === s) { ranges[i].a = Math.min(ranges[i].a, a); ranges[i].b = Math.max(ranges[i].b, b); return; } ranges.push({ el: s, a: a, b: b, on: null }); }
  /* m > 0: enge Zone, gemessen am gesetzten Text statt am Block, m Pixel weicher Rand */
  function calm(el, a, din, b, dout, k, m) { zones.push({ el: el, a0: a, a1: a + din * .7, b0: b, b1: b + dout, k: k === undefined ? .9 : k, m: m || 0, x: 0, y: 0, w: 0, h: 0 }); }
  function beat(sel, o) {
    var el = $(sel); if (!el) return;
    var a = o.a, din = o.din || .5, b = o.b, dout = o.dout || .4, ws, n, per, gap;
    mark(el, a, b + dout);
    switch (o.i || 'mask') {
      case 'mask':
        show(el, a); ws = $$('.w > span', el); n = ws.length; per = din * .6; gap = n > 1 ? (din - per) / (n - 1) : 0;
        ws.forEach(function (w, i) { ft(w, a + i * gap, a + i * gap + per, { yPercent: 118 }, { yPercent: 0 }, 'power3.out'); });
        break;
      case 'l': ft(el, a, a + din, { autoAlpha: 0, x: -W * .5 }, { autoAlpha: 1, x: 0 }, 'power3.out'); break;
      case 'r': ft(el, a, a + din, { autoAlpha: 0, x: W * .5 }, { autoAlpha: 1, x: 0 }, 'power3.out'); break;
      case 'up': ft(el, a, a + din, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0 }, 'power3.out'); break;
      case 'zoom': ft(el, a, a + din, { autoAlpha: 0, scale: 1.7 }, { autoAlpha: 1, scale: 1 }, 'power3.out'); break;
      default: ft(el, a, a + din, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none');
    }
    switch (o.o || 'fade') {
      case 'l': ft(el, b, b + dout, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .32 }, 'power2.in'); break;
      case 'r': ft(el, b, b + dout, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: W * .32 }, 'power2.in'); break;
      case 'up': ft(el, b, b + dout, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -H * .16 }, 'power2.in'); break;
      case 'zoom': ft(el, b, b + dout, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.45 }, 'power2.in'); break;
      default: ft(el, b, b + dout, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    }
    if (o.calm !== 0) calm(el, a, din, b, dout, o.calm);
  }

  var VB = [40.35, 40.65, 41.2, 41.5];   // Wechsel der Verben
  function buildTimeline() {
    if (TL) TL.kill();
    if (touched.length) gsap.set(touched, { clearProps: 'transform,opacity,visibility' });
    touched = []; seen = new Set(); zones = []; ranges = [];
    TL = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    TL.to({}, { duration: 100 }, 0);
    var rnd = mulberry(7);

    /* K0: der Flug durch den Punkt laeuft ausserhalb der Zeitachse (portalDom) */
    mark('.b0', 0, 2.9);
    ft('#cue', .12, .7, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 30 }, 'power1.in');
    calm($('.l1 > span'), -1, .1, .4, .9, .85); calm($('.l2 > span'), -1, .1, .4, .9, .85);

    /* K1 */
    beat('.b1a h2', { a: 2.5, din: .45, b: 5.5, dout: .45, o: 'l', calm: .95 });
    ft('.b1a', 2.5, 5.5, { y: H * .035 }, { y: -H * .035 }, 'none');
    /* die Namen stehen am Fuss ihres Turms: sie fahren von links und rechts ein, waehrend die Tuerme wachsen */
    mark('.giants', 7.3, 11.0); show('.giants', 7.3);
    ft('.g1', 7.4, 8.2, { autoAlpha: 0, x: -W * .6 }, { autoAlpha: 1, x: 0 });
    ft('.g2', 7.8, 8.6, { autoAlpha: 0, x: W * .6 }, { autoAlpha: 1, x: 0 });
    ft('.g1', 8.2, 10.2, { x: 0, scale: 1 }, { x: -W * .012, scale: 1.05 }, 'none');
    ft('.g2', 8.6, 10.2, { x: 0, scale: 1 }, { x: W * .012, scale: 1.04 }, 'none');
    ft('.g1', 10.2, 10.9, { autoAlpha: 1, x: -W * .012, scale: 1.05 }, { autoAlpha: 0, x: -W * .25, scale: 1.22 }, 'power2.in');
    ft('.g2', 10.2, 10.9, { autoAlpha: 1, x: W * .012, scale: 1.04 }, { autoAlpha: 0, x: W * .25, scale: 1.22 }, 'power2.in');
    calm($('.g1'), 7.6, .8, 10.2, .7, .5); calm($('.g2'), 8.0, .8, 10.2, .7, .5);
    beat('.b1c p', { a: 11.0, din: .55, b: 13.0, dout: .45, o: 'up', calm: .94 });
    beat('.b1d p', { a: 13.5, din: .55, b: 16.15, dout: .45, o: 'zoom', calm: .94 });

    /* K2 */
    beat('.b2a h2', { a: 17.2, din: .6, b: 20.6, dout: .45, i: 'zoom', o: 'up', calm: .6 });
    (CHARS.burn || []).forEach(function (c, i, all) { var a = 18.1 + i / all.length * 1.2; ft(c, a, a + .7, { '--b': -.2 }, { '--b': 1 }, 'power1.inOut'); });
    beat('.b2b p', { a: 21.1, din: .45, b: 23.1, dout: .4, i: 'l', o: 'l', calm: .9 });
    beat('.b2c p', { a: 23.6, din: .5, b: 25.7, dout: .3, o: 'fade', calm: .96 });

    /* K3: die Buchstaben liegen verstreut und rasten ein */
    var snap = $('.b3a h2'), sc = CHARS.snap || [];
    mark(snap, 26.2, 29.2); show(snap, 26.2);
    /* die Streuung haengt an der Schriftgroesse, nicht an der Zahl der Zeichen: jede Laenge rastet sauber ein */
    var fz = snap ? parseFloat(getComputedStyle(snap).fontSize) || 60 : 60, nsc = Math.max(1, sc.length);
    sc.forEach(function (c, i) {
      var a = 26.5 + i / nsc * .62, rx = (rnd() - .5) * fz * (M ? 2.6 : 4.2), ry = (rnd() - .5) * fz * (M ? 3.2 : 3.4), ro = (rnd() - .5) * 200, s0 = .6 + rnd() * .9;
      ft(c, 26.2, a, { x: rx * 1.25, y: ry * 1.25, rotation: ro * 1.3, scale: s0 }, { x: rx, y: ry, rotation: ro, scale: s0 }, 'none');
      ft(c, a, a + .34, { x: rx, y: ry, rotation: ro, scale: s0 }, { x: 0, y: 0, rotation: 0, scale: 1 }, 'back.out(1.5)');
    });
    ft(snap, 28.75, 29.15, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .32 }, 'power2.in');
    calm(snap, 26.4, .8, 28.75, .4, .95);
    beat('.b3b p', { a: 29.2, din: .45, b: 31.0, dout: .35, o: 'up', calm: .95 });
    var three = $('.three-w'), lis = $$('.three li');
    mark(three, 31.4, 35.7); show(three, 31.4);
    ft('.three-h', 31.45, 31.85, { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0 });
    lis.forEach(function (li, j) {
      var a = TS3[j] - .1;
      ft(li, a, a + .45, { autoAlpha: 0, x: -60 }, { autoAlpha: 1, x: 0 });
      if (j < 2) ft(li, a + .9, a + 1.25, { autoAlpha: 1 }, { autoAlpha: .5 }, 'none');
    });
    ft(three, 35.2, 35.6, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .3 }, 'power2.in');
    calm(three, 31.6, .6, 35.2, .4, .7);
    beat('.b3d p', { a: 35.7, din: .45, b: 37.9, dout: .4, calm: .7 });

    /* K4 */
    var work = $('.work');
    mark(work, 39.2, 43.1);
    ft(work, 39.2, 39.75, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0 });
    ft('.v2', VB[0], VB[1], { yPercent: 120 }, { yPercent: 0 }, 'power3.inOut');
    ft('.v3', VB[2], VB[3], { yPercent: 120 }, { yPercent: 0 }, 'power3.inOut');
    ft('.v1', VB[0], VB[1], { yPercent: 0 }, { yPercent: -120 }, 'power3.inOut');
    ft('.v2', VB[2], VB[3], { yPercent: 0 }, { yPercent: -120 }, 'power3.inOut');
    ft(work, 42.5, 42.85, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -H * .16 }, 'power2.in');
    calm(work, 39.2, .6, 42.5, .4, .88);
    /* zwei Zeilen fahren gegeneinander ein, gross und schnell, und kommen zur Ruhe (Bewegung in inout()) */
    var io = $('.inout'); mark(io, 42.85, 45.6); show(io, 42.85);
    ft(io, 45.0, 45.5, { autoAlpha: 1 }, { autoAlpha: 0 }, 'power2.in');
    calm(io, 43.1, .5, 45.0, .5, .88);

    /* K5 */
    mark('.tools', 46.4, 55.5); show('.tools', 46.4);
    ft('.mq', 46.5, 47.0, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none');
    ft('.mq', 55.0, 55.35, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    [[46.7, 49.75], [50.1, 52.4], [52.75, 55.0]].forEach(function (r, j) {
      var t = $('.t' + (j + 1));
      ft(t, r[0], r[0] + .5, { autoAlpha: 0, x: W * .45 }, { autoAlpha: 1, x: 0 });
      ft($('h3', t), r[0], r[0] + .55, { x: W * .22 }, { x: 0 });
      ft($('p', t), r[0] + .05, r[0] + .6, { x: W * .12, autoAlpha: 0 }, { x: 0, autoAlpha: 1 });
      ft($('.num', t), r[0], r[1] + .4, { x: W * .1 }, { x: W * .02 }, 'none');
      ft(t, r[1], r[1] + .35, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .45 }, 'power2.in');
    });
    calm($('.tools'), 46.6, .6, 55.0, .4, .9);

    /* K6: Stationen und Rueckweg folgen der Kamera (stations()) */
    beat('.b6a h2', { a: 56.0, din: .4, b: 57.85, dout: .3, o: 'up', calm: .92 });
    mark('.stations', 55.9, 69.2); show('.stations', 55.9); ft('.stations', 69.1, 69.15, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    ft('#fnote', 57.8, 58.2, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none'); ft('#fnote', 68.9, 69.1, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    ft('#loop-l', 66.55, 66.57, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none'); ft('#loop-l', 69.1, 69.15, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    /* der Satz zum Rueckweg und die Wortmarke unter dem Signet: Ort und Deckkraft setzt stations() */
    ft('#loop-t', 66.5, 66.52, { visibility: 'hidden' }, { visibility: 'inherit' }, 'none'); ft('#loop-t', 69.1, 69.12, { visibility: 'inherit' }, { visibility: 'hidden' }, 'none');
    ft('#brand-w', 66.7, 66.72, { visibility: 'hidden' }, { visibility: 'inherit' }, 'none'); ft('#brand-w', 69.1, 69.12, { visibility: 'inherit' }, { visibility: 'hidden' }, 'none');

    /* K7 */
    var wh = $('.who-head'), whw = $$('.b7a h2 .w > span');
    mark(wh, 69.4, 72.4); show(wh, 69.4);
    whw.forEach(function (w, i) { var g = whw.length > 1 ? .16 / (whw.length - 1) : 0; ft(w, 69.4 + i * g, 69.64 + i * g, { yPercent: 118 }, { yPercent: 0 }, 'power3.out'); });
    ft('.who-note', 69.7, 70.1, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0 });
    ft(wh, 72.1, 72.38, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .32 }, 'power2.in');
    calm(wh, 69.4, .4, 72.1, .3, .92, M ? 20 : 30);
    $$('.card').forEach(function (c, j) {
      var a = WA[j], inn = $('.card-in', c), dir = j % 2 ? -1 : 1, b = a + WL - .15;
      mark(c, a + .25, a + WL + .1);
      ft(c, a + .28, a + .3, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none');
      ft(inn, a + .3, a + .68, { opacity: 0, rotationY: dir * 70, x: dir * W * .06, transformPerspective: 1300, transformOrigin: (dir > 0 ? '0% 50%' : '100% 50%') }, { opacity: 1, rotationY: 0, x: 0 }, 'power3.out');
      ft(inn, b, b + .22, { opacity: 1, rotationY: 0, x: 0 }, { opacity: 0, rotationY: -dir * 80, x: -dir * W * .05 }, 'power2.in');
      ft(c, b + .22, b + .24, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
      calm(inn, a + .3, .4, b, .2, .92, M ? 16 : 26);
    });

    /* K8: die Saetze stehen abwechselnd ueber und unter der Linie und loesen sich ueberlappend ab */
    beat('.b8a h2', { a: late(82.65), din: .35 * KL, b: late(84.6), dout: .4 * KL, calm: 0 });
    calm($('.b8a h2'), late(82.6), .2 * KL, late(83.5), .5 * KL, .9);
    /* drei Schlaege unter der Linie: jeder kommt fuer sich und bleibt stehen */
    var q3 = $('.q3'); mark(q3, late(84.7), late(88.1)); show(q3, late(84.7));
    $$('.q3 > span').forEach(function (s, j) { ft(s, late(84.75 + j * .85), late(85.15 + j * .85), { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0 }); });
    ft(q3, late(87.7), late(88.05), { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    beat('.b8c p', { a: late(87.8), din: .45 * KL, b: late(89.7), dout: .35 * KL, calm: 0 });
    beat('.b8d p', { a: late(89.75), din: .45 * KL, b: late(91.6), dout: .35 * KL, calm: 0 });
    beat('.b8e p', { a: late(91.65), din: .45 * KL, b: late(93.7), dout: .3 * KL, calm: 0 });

    /* K9 */
    var ct = $('.contact'); mark(ct, late(94.7), 100); show(ct, late(94.7));
    ft('.s9 .eyebrow', late(94.75), late(95.15), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0 });
    $$('.name .nl > span').forEach(function (s, j) { ft(s, late(94.85 + j * .2), late(95.45 + j * .2), { yPercent: 118 }, { yPercent: 0 }); });
    ft('.s9 .lead', late(95.45), late(95.85), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0 });
    $$('.ways li').forEach(function (li, j) { ft(li, late(95.7 + j * .15), late(96.15 + j * .15), { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0 }); });
    calm(ct, late(94.8), .8 * KL, 101, 1, .9);
  }

  /* Verb-Chip: die Breite folgt dem Wort */
  var vbS = -1;
  function verbs(p) {
    if (!verbsEl || p < 38.8 || p > 43.2 || !verbW[0]) return;
    var w = Math.round(keysE(p, [[VB[0], verbW[0]], [VB[1], verbW[1]], [VB[2], verbW[1]], [VB[3], verbW[2]]]));
    if (w !== vbS) { vbS = w; verbsEl.style.width = w + 'px'; }
  }
  /* "Werbebudget rein, Rendite raus": zwei Zeilen fahren gegeneinander, Schraegung aus dem Scroll-Tempo */
  var ioE = $$('.io'), ioK = ['', ''];
  function inout(p) {
    if (p < 42.7 || p > 45.8 || ioE.length < 2) return;
    var sk = clamp(vel * 50, -12, 12), i, e, x, s, tf, dir, out = eio(seg(p, 45.0, 45.5)), dr, q = eo(seg(p, 43.5, 44.7));
    for (i = 0; i < 2; i++) {
      dir = i ? 1 : -1;
      e = eo(seg(p, 42.9 + i * .15, 43.5 + i * .15));
      // sichtbare Gegenfahrt in der Ruhe: die kurze Zeile faehrt weit, die lange nur wenig (sie bleibt frei von Kapitelindex und Balken)
      dr = i ? lerp(W * (M ? .05 : .085), 0, q) : lerp(-W * (M ? .005 : .01), 0, q);
      x = dir * W * 1.05 * (1 - e) + dr + dir * -W * .5 * out;
      s = lerp(M ? 1.35 : 1.9, 1, e) + out * .25;
      tf = 'translate3d(' + x.toFixed(1) + 'px,0,0) skewX(' + ((1 - e) * dir * -9 + sk * (i ? 1 : -1) * (e < 1 ? 1 : .6)).toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
      if (tf !== ioK[i]) { ioK[i] = tf; ioE[i].style.transform = tf; }
    }
  }

  /* ---------- HUD ---------- */
  var roC = $('#ro-c'), roN = $('#ro-n'), roXY = $('#ro-xy');
  var railFill = $('#rail-fill'), railDot = $('#rail-dot'), idxA = $$('.index a');
  var hudS = { ch: -1, foot: null, end: null, leg: null };
  (function () { var tk = $('#ticks'), i, s; if (!tk) return; for (i = 0; i < CH.length; i++) { s = doc.createElement('span'); s.style.top = CH[i] + '%'; tk.appendChild(s); } })();
  function pad(n, l) { var s = String(n); while (s.length < l) s = '0' + s; return s; }
  function dots(n) { var s = String(n), o = '', i; for (i = 0; i < s.length; i++) { if (i && (s.length - i) % 3 === 0) o += '.'; o += s.charAt(i); } return o; }
  function hud(p) {
    var ch = 0, i, e;
    for (i = 0; i < CH.length; i++) if (p >= CH[i] - .001) ch = i;
    if (ch !== hudS.ch) { hudS.ch = ch; roC.textContent = pad(ch, 2); roN.textContent = CHN[ch]; idxA.forEach(function (a, j) { if (j === ch) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); } else { a.classList.remove('on'); a.removeAttribute('aria-current'); } }); }
    railFill.style.transform = 'scaleY(' + (p / 100).toFixed(4) + ')';
    railDot.style.transform = 'translateY(' + (p / 100 * G.railH).toFixed(1) + 'px)';
    e = p > late(96.6);
    if (e !== hudS.foot) { hudS.foot = e; foot.classList.toggle('on', e); body.classList.toggle('end', e); }
    var lg = !M && p > 57.8 && p < 69.2;
    if (lg !== hudS.leg) { hudS.leg = lg; if (roXY) roXY.style.visibility = lg ? 'hidden' : ''; }
    for (i = 0; i < ths.length; i++) { var h = ths[i], w = worldAt(h.x, h.y); if (w !== h.w) { h.w = w; h.el.classList.remove('t-k', 't-i', 't-g', 't-d', 't-m', 't-e'); h.el.classList.add('t-' + WN[w]); } }
  }
  var mqs = $$('.mq');
  function marquee(p, t) {
    if (p < 46 || p > 55.6) return;
    var i, m, w, x, sk = clamp(vel * 60, -14, 14);
    for (i = 0; i < mqs.length; i++) {
      m = mqs[i]; w = m._w || 2000;
      x = ((p - 45.6) * (M ? 140 : 320) + t * 40) % w;
      m.firstElementChild.style.transform = 'translate3d(' + (i ? x - w : -x).toFixed(1) + 'px,0,0) skewX(' + (i ? sk : -sk).toFixed(2) + 'deg)';
    }
  }
  var cnts = $$('.stn .cnt'), CV = [1000, 620, 340, 120], CO = [58.5, 60.2, 61.7, 63.2], cntS = [-1, -1, -1, -1];
  function counters(p) {
    if (p < 57.5 || p > 69.5) return;
    var i, v;
    for (i = 0; i < cnts.length && i < CV.length; i++) { v = Math.round(CV[i] * eo(seg(p, CO[i] - .3, 66.85))); if (v !== cntS[i]) { cntS[i] = v; cnts[i].textContent = dots(v); } }
  }

  /* ---------- Render ---------- */
  function render(p, t, dt, snap) {
    var i, r, on, rm;
    TL.time(p, false);
    for (i = 0; i < ranges.length; i++) { r = ranges[i]; rm = .05 * (r.a >= K8 ? KS : 1); on = p >= r.a - rm && p <= r.b + rm; if (on !== r.on) { r.on = on; r.el.classList.toggle('on', on); } }
    if (openT >= 0 && hudK < 1) hudK = DEBUG ? 1 : clamp((t - openT - .4) / 1.2, 0, 1);
    portalDom(p);
    worlds(p, t);
    activeZones(p);
    gaugeEase(dt);
    for (i = ripples.length - 1; i >= 0; i--) { r = ripples[i]; r.age = t - r.t; if (r.age > 1.7) { ripples.splice(i, 1); continue; } r.r = r.age * 900 * r.p; r.f = 1 - r.age / 1.7; }
    if (snap) {
      evaluate(p, t - 1 / 60);
      for (i = 0; i < N; i++) { X[i] = F.x[i]; Y[i] = F.y[i]; }
      evaluate(p, t);
      for (i = 0; i < N; i++) { VX[i] = F.a[i] > .03 ? clamp(F.x[i] - X[i], -40, 40) : 0; VY[i] = F.a[i] > .03 ? clamp(F.y[i] - Y[i], -40, 40) : 0; if (Math.abs(F.x[i] - X[i]) > W * .3 || Math.abs(F.y[i] - Y[i]) > H * .3) { VX[i] = 0; VY[i] = 0; } }
    } else evaluate(p, t);
    draw(p, t, dt, snap);
    hud(p); marquee(p, t); counters(p); stations(p); verbs(p); inout(p);
  }

  var lastFrameAt = 0, directAt = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    lastFrameAt = performance.now();
    var dt = Math.min((now - last) / 1000, .05); if (dt <= 0) dt = .016; last = now; T += dt;
    if (lenis) lenis.raf(now);
    var y = win.pageYOffset || root.scrollTop || 0;
    pT = locked ? 0 : filmAt(y);
    var kf = 1 - Math.exp(-dt * (touch ? 9 : 15));
    pS += (pT - pS) * kf; if (Math.abs(pT - pS) < .00002) pS = pT;
    vel = lerp(vel, (pS - pPrev) / dt * 10, .15); pPrev = pS;
    mouse.sx += (mouse.nx - mouse.sx) * .06; mouse.sy += (mouse.ny - mouse.sy) * .06;
    try { render(pS * 100, T, dt, false); } catch (e) { if (DEBUG) { showError(e); stop(); } else if (win.console) console.error(e); }
  }
  /* Sicherheitsnetz: laeuft der Bild-Takt nicht (gedrosselt, angehalten), folgt der Film dem Scrollen trotzdem */
  function direct() {
    if (doc.hidden) return;
    var now = performance.now();
    if (now - lastFrameAt < 450) return;
    var y = win.pageYOffset || root.scrollTop || 0;
    T += directAt ? Math.min((now - directAt) / 1000, .5) : .05; directAt = now;
    pT = pS = pPrev = locked ? 0 : filmAt(y); vel = 0;
    try { render(pS * 100, T, 0, true); } catch (e) { if (win.console) console.error(e); }
  }
  setInterval(direct, 400);
  win.addEventListener('scroll', direct, { passive: true });
  function start() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else start(); });

  /* ---------- Sperre, Zuendung ---------- */
  var outside = $$('.scene:not(#k0), .index, .kontakt-link, .wa');
  var dlgOpen = false;
  function blockTouch(e) { if (!locked || dlgOpen) return; if (e.cancelable) e.preventDefault(); nudge(); }
  var nudgeT = 0;
  function nudge() {
    if (!locked || dlgOpen) return; var now = Date.now(); if (now - nudgeT < 600) return; nudgeT = now;
    gate.classList.remove('shake'); void gate.offsetWidth; gate.classList.add('shake');
    if (hint) hint.classList.add('show');
    ripples.push({ x: G.gx, y: G.gy, t: T, p: .7, r: 0, f: 1, age: 0 });
  }
  /* Der Flug nach der Zuendung. Er sperrt nichts: Rad, Finger und Tasten uebernehmen sofort. */
  var FLY_WAIT = 260, FLY_MS = 2200, fly = null;
  function eq(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function flyEnd(halt) {
    if (!fly) return;
    var f = fly; fly = null; clearTimeout(f.tm); clearTimeout(f.net); f.dead = true;
    if (halt && f.run && lenis) { try { lenis.reset(); } catch (e) {} }
  }
  function onVirtual(d) {
    // Rad nach unten waehrend des Flugs: der Film nimmt das Ziel des Flugs mit und laeuft von dort weiter.
    // Bei einem Sprung ueber den Kapitelindex uebernimmt das Rad an der Stelle, an der der Film gerade steht.
    if (!fly) return true;
    var e = d.event, dy = d.deltaY, f = fly;
    if (!f.idx && e && e.type && e.type.indexOf('wheel') > -1 && dy > 0 && lenis && lenis.targetScroll < f.y) {
      flyEnd(false);
      try { if (e.cancelable) e.preventDefault(); lenis.scrollTo(f.y + dy, { programmatic: false, lerp: .1, force: true }); return false; } catch (er) {}
      return true;
    }
    if (dy) flyEnd(false);
    return true;
  }
  function startLenis() {
    if (lenis || DEBUG || !win.Lenis) return;
    try { lenis = new win.Lenis({ lerp: .1, smoothWheel: true, wheelMultiplier: 1.4, virtualScroll: onVirtual }); } catch (e) { lenis = null; }
  }
  function jump(pu, immediate, ms, free, ease) {
    var y = scrollFor(clamp(pu, 0, 100) / 100);
    if (immediate) {
      if (lenis) { try { lenis.scrollTo(y, { immediate: true, force: true }); } catch (e) {} }
      root.style.scrollBehavior = 'auto'; win.scrollTo(0, y); root.style.scrollBehavior = '';
      pT = pS = pPrev = filmAt(y); vel = 0;
      render(pS * 100, T, 0, true);
      return;
    }
    ms = ms || 1800;
    var ez = ease || (free ? eq : eio), me = free ? fly : null;
    function arrive() { if (!me || me.dead || fly !== me) return; var cb = me.after; flyEnd(false); if (cb) cb(); }
    if (lenis) { try { lenis.scrollTo(y, { duration: ms / 1000, easing: ez, force: true, lock: !free, onComplete: arrive }); return; } catch (e) {} }
    var y0 = win.pageYOffset, t0 = performance.now(), done = false;
    function fin() { if (done) return; done = true; if (me && me.dead) return; win.scrollTo(0, y); arrive(); }
    (function step(now) { if (done) return; if (me && me.dead) { done = true; return; } var k = clamp((now - t0) / ms, 0, 1); win.scrollTo(0, y0 + (y - y0) * ez(k)); if (k < 1) requestAnimationFrame(step); else fin(); })(t0);
    setTimeout(fin, ms + 400);
  }
  /* Spruenge ueber den Kapitelindex, das Logo und den Kontakt-Link sperren nichts, genau wie der Flug nach der Zuendung:
     Rad, Finger und Tasten uebernehmen sofort. Wer den Sprung abbricht, behaelt auch den Fokus. */
  function glide(pu, ms, after) {
    flyEnd(true);
    var f = fly = { y: scrollFor(clamp(pu, 0, 100) / 100), run: true, dead: false, tm: 0, net: 0, idx: true, after: after || null };
    jump(pu, false, ms, true, eio);
    if (fly === f) f.net = setTimeout(function () { if (fly === f) flyEnd(false); }, ms + 600);
  }
  function impulse(x, y, power) {
    var i, dx, dy, d, f;
    for (i = 0; i < N; i++) { dx = X[i] - x; dy = Y[i] - y; d = Math.sqrt(dx * dx + dy * dy) + 30; f = power * (.4 + .6 * R3[i]) * Math.min(1, 420 / d); OVX[i] += dx / d * f; OVY[i] += dy / d * f; }
    impulseOn = 3;
  }
  function open(silent) {
    locked = false; openT = silent ? T - 5 : T;
    body.classList.remove('locked'); body.classList.add('open', 'ready');
    outside.forEach(function (el) { el.removeAttribute('inert'); });
    win.removeEventListener('touchmove', blockTouch);
    if (hint) hint.classList.remove('show');
    setTimeout(function () { body.classList.add('lit'); }, silent ? 0 : 2600);
    if (!silent) startLenis();
  }
  function ignite(x, y) {
    if (!locked) return;
    if (typeof x !== 'number' || (!x && !y)) { x = G.gx; y = G.gy; }
    open(false);
    ign = { x: x, y: y, t: T, R: maxR(x, y) };
    ripples.push({ x: x, y: y, t: T + .25, p: 1.5, r: 0, f: 1, age: 0 });
    impulse(x, y, 900);
    flash.style.setProperty('--fx', Math.round(x) + 'px'); flash.style.setProperty('--fy', Math.round(y) + 'px');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    // zweiter Schlag: die Kamera fliegt durch den Schlusspunkt in den Film. Jede Eingabe uebernimmt.
    var f = fly = { y: scrollFor(CHJ[1] / 100), run: false, dead: false, tm: 0, net: 0 };
    f.tm = setTimeout(function () { if (fly !== f) return; f.run = true; jump(CHJ[1], false, FLY_MS, true); }, FLY_WAIT);
    // Sicherheitsnetz: falls der Frame-Timer nicht laeuft, steht der Film trotzdem am ersten Bild
    f.net = setTimeout(function () { if (fly !== f) return; flyEnd(false); if ((win.pageYOffset || 0) < 4 && !locked) jump(CHJ[1], true); }, FLY_WAIT + FLY_MS + 900);
  }
  function lock() {
    locked = true; body.classList.add('locked');
    outside.forEach(function (el) { el.setAttribute('inert', ''); });
    root.style.scrollBehavior = 'auto'; win.scrollTo(0, 0); root.style.scrollBehavior = '';
    win.addEventListener('touchmove', blockTouch, { passive: false });
  }

  /* Gesperrt: ein Klick oder Tipp irgendwo auf der Seite zuendet den Film am Klickpunkt. Links bleiben Links. */
  function isLink(el) { return !!(el && el.closest && el.closest('a[href], dialog')); }
  doc.addEventListener('click', function (e) {
    if (!locked || dlgOpen || e.defaultPrevented || isLink(e.target)) return;
    if (e.button) return;
    ignite(e.clientX, e.clientY);
  });
  gate.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ignite(); } });
  win.addEventListener('wheel', function () { nudge(); if (fly && !locked && !lenis) flyEnd(false); }, { passive: true });
  var SCROLLKEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'End', 'Home', ' ', 'Spacebar'];
  win.addEventListener('keydown', function (e) {
    if (dlgOpen) return;
    if (!locked) { if (fly && !e.defaultPrevented && SCROLLKEYS.indexOf(e.key) > -1) flyEnd(true); return; }
    if (SCROLLKEYS.indexOf(e.key) > -1 && doc.activeElement !== gate) { e.preventDefault(); nudge(); }
  });
  win.addEventListener('touchstart', function () { if (fly && !locked) flyEnd(true); }, { passive: true });
  win.addEventListener('scroll', function () { if (locked && (win.pageYOffset || 0) !== 0) win.scrollTo(0, 0); }, { passive: true });
  doc.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.nx = e.clientX / W - .5; mouse.ny = e.clientY / H - .5;
    if (roXY) roXY.textContent = 'X ' + pad(Math.round(e.clientX), 4) + ' · Y ' + pad(Math.round(e.clientY), 4);
    if (locked && !M) { var dx = e.clientX - G.gx, dy = e.clientY - G.gy, d = Math.sqrt(dx * dx + dy * dy), k = clamp((190 - d) / 80, 0, 1); gate.style.translate = (dx * .25 * k).toFixed(1) + 'px ' + (dy * .25 * k).toFixed(1) + 'px'; }
  });
  doc.addEventListener('mouseleave', function () { mouse.x = -9999; mouse.y = -9999; mouse.nx = 0; mouse.ny = 0; });
  doc.addEventListener('pointerdown', function (e) { if (locked || dlgOpen || (e.target && e.target.closest && e.target.closest('dialog'))) return; ripples.push({ x: e.clientX, y: e.clientY, t: T, p: 1, r: 0, f: 1, age: 0 }); if (ripples.length > 4) ripples.shift(); });

  /* ---------- Impressum und Datenschutz: Fenster im Film ---------- */
  var dlgs = { impressum: $('#dlg-impressum'), datenschutz: $('#dlg-datenschutz') }, dlgCur = null, dlgFrom = null;
  function dlgName(a) { var m = /(?:^|\/)(impressum|datenschutz)\.html(?:$|[?#])/.exec(a.getAttribute('href') || ''); return m ? m[1] : null; }
  function dlgHash() { var m = /^#(impressum|datenschutz)$/.exec(location.hash || ''); return m ? m[1] : null; }
  function dlgShow(name, from) {
    var d = dlgs[name], inn; if (!d || typeof d.showModal !== 'function') return false;
    if (dlgCur === d && d.open) return true;
    if (from && !(from.closest && from.closest('dialog'))) dlgFrom = from;
    if (dlgCur && dlgCur.open) { try { dlgCur.close(); } catch (e) {} }
    try { d.showModal(); } catch (e2) { return false; }
    dlgCur = d; dlgOpen = true; body.classList.add('dlg-on');
    inn = $('.dlg-in', d); if (inn) inn.scrollTop = 0;
    flyEnd(true);
    if (lenis) { try { lenis.stop(); } catch (e3) {} }
    GZ.pin = -1; GZ.hot = -1;
    return true;
  }
  function dlgDone() {
    // beim Wechsel von einem Fenster ins andere bleibt der Film angehalten
    if ((dlgs.impressum && dlgs.impressum.open) || (dlgs.datenschutz && dlgs.datenschutz.open)) return;
    dlgOpen = false; dlgCur = null; body.classList.remove('dlg-on');
    if (lenis) { try { lenis.start(); } catch (e) {} }
    var f = dlgFrom; dlgFrom = null;
    if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e2) {} }
  }
  Object.keys(dlgs).forEach(function (k) {
    var d = dlgs[k]; if (!d) return;
    d.addEventListener('close', dlgDone);
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    // nichts vom Rad oder vom Finger erreicht den Film: nur der Text im Fenster rollt
    function hold(e) { if (!(e.target && e.target.closest && e.target.closest('.dlg-in')) && e.cancelable) e.preventDefault(); }
    d.addEventListener('wheel', hold, { passive: false });
    d.addEventListener('touchmove', hold, { passive: false });
  });
  doc.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null, n;
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    n = dlgName(a); if (!n) return;
    if (dlgShow(n, a)) e.preventDefault();
  });

  function hashTarget() { var h = location.hash.slice(1), m; if (!h) return null; if (h === 'kontakt') return 99.6; m = /^k(\d)$/.exec(h); return m ? CHJ[+m[1]] : null; }
  idxA.concat($$('.top a')).forEach(function (a) {
    a.addEventListener('click', function (e) {
      var m = /^#k(\d)$/.exec(a.getAttribute('href') || ''); if (!m) return;
      e.preventDefault(); if (locked) return;
      var s = doc.getElementById('k' + m[1]);
      glide(CHJ[+m[1]], 1900, function () { if (s) setTimeout(function () { try { s.focus({ preventScroll: true }); } catch (er) {} }, 100); });
    });
  });
  win.addEventListener('hashchange', function () { var n = dlgHash(), t; if (n) { dlgShow(n, $('#foot a[href^="' + n + '"]')); return; } t = hashTarget(); if (t === null) return; if (locked) open(false); jump(t, true); });

  /* ---------- Start ---------- */
  function initForms() { FORM.towers.init(); Object.keys(FORM).forEach(function (k) { FORM[k].init(); }); fitPic(); }   // die Rahmen der Zeichnungen (bb) stehen erst jetzt fest
  function boot() {
    layout();
    N = M ? 2500 : 9000;
    initParticles();
    glowG = sprite(61, 214, 140); glowE = sprite(255, 90, 42);
    buildTimeline();
    measure();
    initForms();
  }
  function reflow(keep) {
    var p = pS;
    layout(keep);
    var n = M ? 2500 : 9000; if (n !== N) { N = n; initParticles(); }
    buildTimeline(); measure();
    initForms();
    stnK = []; loopK = ''; loopTK = ' '; brandK = ' '; brandW100 = 0; gzK = ['', '', '', '']; tipK = ''; ioK = ['', ''];
    if (!locked && !keep) { root.style.scrollBehavior = 'auto'; win.scrollTo(0, scrollFor(p)); root.style.scrollBehavior = ''; }
    if (lenis && lenis.resize) lenis.resize();
    render(pS * 100, T, 0, true);
  }
  var lw = 0, lh = 0, rzT = 0;
  function onResize() {
    var w = win.innerWidth, h = win.innerHeight;
    if (w === lw && h === lh) return;
    if (h < 480) { location.reload(); return; }
    // mobile Adressleiste: Filmlaenge und Scrollposition bleiben, nur die Buehne passt sich an
    var keep = touch && w === lw && Math.abs(h - lh) < 130;
    lw = w; lh = h; reflow(keep);
  }
  win.addEventListener('resize', function () {
    clearTimeout(rzT);
    // Maus-Geraete: sofort, damit Buehne und Fenster nie auseinanderlaufen. Touch: gebuendelt (Adressleiste).
    if (!touch) onResize(); else rzT = setTimeout(onResize, 140);
  });

  try {
    boot(); lw = W; lh = H;
    var ht = hashTarget();
    if (DEBUG) { body.classList.add('still', 'settled'); open(true); hudK = 1; jump(DEBUG_P * 100, true); }
    else if (ht !== null) { open(false); jump(ht, true); }
    else { lock(); render(0, T, 0, true); }
    if (dlgHash()) dlgShow(dlgHash(), $('#foot a[href^="' + dlgHash() + '"]'));
  } catch (e) {
    // der Film kann nicht starten: die gestapelte, lesbare Seite uebernimmt
    showError(e);
    if (win.console) console.error(e);
    root.classList.remove('film'); body.classList.remove('locked'); body.classList.add('ready');
    $$('[inert]').forEach(function (el) { el.removeAttribute('inert'); });
    return;
  }

  function arm() { body.classList.add('ready'); }
  function refit() { try { measure(); FORM.lattice.init(); render(pS * 100, T, 0, true); } catch (e) { showError(e); } }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { arm(); refit(); }, arm);
  setTimeout(arm, 700);
  // nach dem Auftakt steht alles fest, unabhaengig davon, ob Uebergaenge gelaufen sind
  setTimeout(function () { arm(); body.classList.add('settled'); refit(); }, 2300);
  win.addEventListener('load', function () { arm(); refit(); });
  setTimeout(function () { if (locked && hint) hint.classList.add('show'); }, 2600);
  setTimeout(kick, 3200); setTimeout(kick, 4200);
  start();
})();
