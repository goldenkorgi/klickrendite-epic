/* KlickRendite Film, Variante A "Partikel-Universum".
   Ein Schwarm aus Klicks lebt durch den ganzen Film. Scroll ist die Zeitachse.
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
  function eo(t) { return 1 - Math.pow(1 - t, 3); }
  function fract(v) { return v - Math.floor(v); }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(n, seed) { var r = mulberry(seed), a = new Int32Array(n), i, j, t; for (i = 0; i < n; i++) a[i] = i; for (i = n - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function keys(p, K) { var i; if (p <= K[0][0]) return K[0][1]; for (i = 1; i < K.length; i++) { if (p <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (p - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); } return K[K.length - 1][1]; }

  /* Debug-Aufnahmen am Handy: Headless-Chrome kann kein Fenster schmaler als 500 px.
     Mit ?p=..&w=375 (oder automatisch im Headless-Fall) rahmt sich die Seite selbst in 375 px Breite. */
  if (DEBUG && win.top === win) {
    var fw = parseInt(qs.get('w'), 10) || 0;
    if (!fw && /HeadlessChrome/.test(navigator.userAgent) && win.innerWidth === 500) fw = 375;
    if (fw && fw < win.innerWidth) {
      win.__epic = true;
      root.classList.remove('film');
      body.innerHTML = '';
      body.style.cssText = 'margin:0;background:#000;overflow:hidden';
      var fr = doc.createElement('iframe');
      fr.src = location.pathname.split('/').pop() + '?p=' + DEBUG_P;
      fr.title = 'Vorschau';
      fr.style.cssText = 'display:block;border:0;width:' + fw + 'px;height:100vh';
      body.appendChild(fr);
      return;
    }
  }

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
  var pBase = DEBUG ? DEBUG_P : 0;   // Debug: der Film beginnt an dieser Stelle, das Fenster bleibt bei Scroll 0
  var T = 20, last = 0, raf = 0;
  var pT = 0, pS = 0, pPrev = 0, vel = 0;
  var locked = true, clicks = 0;
  var lenis = null;
  var touch = win.matchMedia && win.matchMedia('(pointer: coarse)').matches;
  var mouse = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0, on: false };
  var G = {};
  var film = $('#film'), track = $('#track'), hint = $('#hint'), foot = $('#foot');
  var scenes = $$('.scene');
  var flash = doc.createElement('div'); flash.className = 'flash'; flash.setAttribute('aria-hidden', 'true'); body.appendChild(flash);

  var CH = [0, 4, 16, 26, 38, 46, 57, 72, 82, 93];
  var CHJ = [0, 5, 19, 28.2, 40.4, 48.6, 60, 73.2, 84, 99];
  var CHN = ['Start', 'Die Geschichte', 'Das Problem', 'Das Wissen', 'Die Arbeit', 'Die Werkzeuge', 'Der Weg', 'Für wen', 'Das erste Gespräch', 'Kontakt'];

  /* ---------- Welten und Wischer (jeder Weltwechsel ist ein Klick) ---------- */
  var WI = { k: 0, i: 1, g: 2 }, WN = ['k', 'i', 'g'];
  var BG = ['#0a0b0d', '#f4f5f2', '#3DD68C'];
  var FG = ['#f4f5f2', '#121417', '#0a0b0d'];
  var PAL = [
    [[244, 245, 242], [61, 214, 140], [255, 90, 42], [255, 46, 46], [140, 149, 144]],
    [[18, 20, 23], [15, 157, 91], [255, 90, 42], [255, 46, 46], [118, 126, 121]],
    [[10, 11, 13], [244, 245, 242], [10, 11, 13], [10, 11, 13], [14, 96, 58]]
  ];
  var LV = [.11, .24, .42, .68, 1];
  var STY = [];
  (function () { var w, r, l; for (w = 0; w < 3; w++) for (r = 0; r < 5; r++) for (l = 0; l < 5; l++) STY.push('rgba(' + PAL[w][r][0] + ',' + PAL[w][r][1] + ',' + PAL[w][r][2] + ',' + LV[l] + ')'); })();
  var WIPES = [
    { at: 26.0, dur: 1.3, to: 1, o: function () { return [W * .5, H * .55]; } },
    { at: 38.4, dur: 1.2, to: 0, o: function () { var w = G.wire; return [w.x0 + .195 * w.s, w.y0 + .527 * w.s]; } },
    { at: 46.0, dur: 1.2, to: 2, o: function () { var I = G.icon, u = I.S / 128; return [I.cx + 24 * u, I.cy - 20 * u]; } },
    { at: 56.8, dur: 1.2, to: 0, o: function () { return G.fun.vert ? [G.fun.c, G.fun.a0] : [G.fun.a0, G.fun.c]; } },
    { at: 81.6, dur: 1.2, to: 1, o: function () { return [W * .5, G.hor]; } },
    { at: 93.2, dur: 1.2, to: 0, o: function () { return [G.logo.cx, G.logo.cy]; } }
  ];
  var ign = null;            // Zuendung: gruener Ring, zeitgesteuert
  var ripples = [];          // Klick-Wellen
  var AW = [];               // aktive Wischer dieses Frames: {x,y,r,r2,w}
  var baseWorld = 0;

  function maxR(x, y) { var a = Math.max(x, W - x), b = Math.max(y, H - y); return Math.sqrt(a * a + b * b) * 1.04; }
  function worlds(p, t) {
    var i, w, o, k, R;
    AW.length = 0; baseWorld = 0;
    for (i = 0; i < WIPES.length; i++) {
      w = WIPES[i];
      if (p >= w.at + w.dur) { baseWorld = w.to; continue; }
      if (p > w.at) { o = w.o(); R = maxR(o[0], o[1]); k = (p - w.at) / w.dur; AW.push({ x: o[0], y: o[1], r: R * Math.pow(k, 1.4), w: w.to, k: k, R: R }); }
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
  function worldAt(x, y) { var w = baseWorld, i, a, dx, dy; for (i = 0; i < AW.length; i++) { a = AW[i]; dx = x - a.x; dy = y - a.y; if (dx * dx + dy * dy < a.r * a.r) w = a.w; } return w; }

  /* ---------- Partikel ---------- */
  var R1, R2, R3, R4, Z, X, Y, VX, VY, OX, OY, OVX, OVY, DS;
  var A, B, F;
  var BK = [], BC = new Int32Array(75), GL, GLn = 0, GE, GEn = 0;
  var impulseOn = 0;
  function mk() { return { x: new Float32Array(N), y: new Float32Array(N), s: new Float32Array(N), a: new Float32Array(N), r: new Uint8Array(N) }; }
  function initParticles() {
    var r = mulberry(20260927), i;
    R1 = new Float32Array(N); R2 = new Float32Array(N); R3 = new Float32Array(N); R4 = new Float32Array(N); Z = new Float32Array(N);
    X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N);
    OX = new Float32Array(N); OY = new Float32Array(N); OVX = new Float32Array(N); OVY = new Float32Array(N); DS = new Float32Array(N);
    for (i = 0; i < N; i++) { R1[i] = r(); R2[i] = r(); R3[i] = r(); R4[i] = r(); Z[i] = .25 + .75 * r(); X[i] = R1[i] * W; Y[i] = R2[i] * H; }
    A = mk(); B = mk(); F = mk();
    BK = []; for (i = 0; i < 75; i++) BK.push(new Int32Array(N));
    GL = new Int32Array(1400); GE = new Int32Array(900);
  }

  var FORM = {};
  var ARROW = [[62.5, 22], [62.5, 73], [76.3, 61], [85.3, 80.5], [94.9, 76.3], [85.9, 57.1], [103, 57.1]];
  var BAR = [[25, 70, 18, 33], [52, 52, 18, 51], [79, 31, 18, 72]];
  function inPoly(x, y, P) { var c = false, i, j, n = P.length; for (i = 0, j = n - 1; i < n; j = i++) { if (((P[i][1] > y) !== (P[j][1] > y)) && (x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0])) c = !c; } return c; }
  function distPoly(x, y, P) { var d = 1e9, i, j, n = P.length, ax, ay, bx, by, t, dx, dy; for (i = 0, j = n - 1; i < n; j = i++) { ax = P[j][0]; ay = P[j][1]; bx = P[i][0]; by = P[i][1]; t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) * (bx - ax) + (by - ay) * (by - ay)), 0, 1); dx = x - (ax + (bx - ax) * t); dy = y - (ay + (by - ay) * t); d = Math.min(d, Math.sqrt(dx * dx + dy * dy)); } return d; }

  /* 0 · Punktfeld (Hero) */
  FORM.lattice = (function () {
    var lx, ly, cnt;
    return {
      name: 'Punktfeld',
      init: function () {
        var g = M ? 24 : 28, cols = Math.ceil(W / g) + 1, rows = Math.ceil(H / g) + 1, i, c;
        cnt = Math.min(cols * rows, Math.floor(N * .72));
        lx = new Float32Array(N); ly = new Float32Array(N);
        var ox = (W % g) / 2, oy = (H % g) / 2, perm = shuffle(cols * rows, 11);
        for (i = 0; i < N; i++) {
          if (i < cnt) { c = perm[i]; lx[i] = ox + (c % cols) * g; ly[i] = oy + Math.floor(c / cols) * g; }
          else { lx[i] = R1[i] * W; ly[i] = R2[i] * H; }
        }
      },
      run: function (o, p, t) {
        var i, x, y, wv, a, s, r, dx, dy, d, k, pu, gx = G.gx, gy = G.gy, RR = M ? 260 : 420;
        for (i = 0; i < N; i++) {
          x = lx[i]; y = ly[i]; r = 0;
          if (i < cnt) {
            wv = Math.sin(x * .012 + t * .7) * Math.sin(y * .015 - t * .5);
            a = .27 + .12 * wv; s = 2.2;
            dx = x - gx; dy = y - gy; d = Math.sqrt(dx * dx + dy * dy);
            if (d < RR) { k = 1 - d / RR; pu = Math.sin(d * .03 - t * 2.4); if (pu < 0) pu = 0; pu *= k; a += pu * .85; s += pu * 2.2; if (pu > .16) r = 1; }
          } else {
            x += Math.sin(t * .15 + R3[i] * TAU) * 18; y += Math.cos(t * .12 + R4[i] * TAU) * 18;
            a = .04 + .09 * R4[i]; s = .9 + R3[i] * 1.2;
          }
          o.x[i] = x; o.y[i] = y; o.s[i] = s; o.a[i] = a; o.r[i] = r;
        }
      }
    };
  })();

  /* 1 · Tuerme aus Klicks */
  FORM.towers = (function () {
    var wx, wy, wz, kind, rowsH, D = 6, RH = .95, TA = 12, TW = 6;
    function pr(c, x, y, z) { var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), Yc = y - c.camH, Zc = z + c.camD, Z2 = Yc * sp + Zc * cp; if (Z2 < .5) Z2 = .5; return [c.cx + x * c.f / Z2, c.cy - (Yc * cp - Zc * sp) * c.f / Z2]; }
    return {
      name: 'Türme',
      init: function () {
        wx = new Float32Array(N); wy = new Float32Array(N); wz = new Float32Array(N); kind = new Uint8Array(N);
        var cf = M ? 7 : 12, cs = M ? 5 : 9, per = Math.floor(N * .335), rows = Math.floor(per / (cf + cs));
        per = rows * (cf + cs); rowsH = rows * RH;
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
        var k = seg(p, 2.5, 16.2);
        return {
          k: k,
          camD: lerp(80, 15.5, eo(seg(k, 0, .6))),
          pitch: lerp(.05, .56, eio(seg(k, .14, .8))),
          camH: 1.4 + 14 * sstep(.62, 1, k),
          f: H * .56,
          cx: W * lerp(M ? .5 : .745, .5, eio(seg(k, .1, .5))),
          cy: H * lerp(.7, .58, eio(seg(k, .1, .7))),
          built: lerp(14, rowsH, eio(seg(k, 0, .42)))
        };
      },
      run: function (o, p, t) {
        var c = this.cam(p), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), f = c.f, cx = c.cx, cy = c.cy, built = c.built;
        var pulse = fract(t * .08 + p * .11) * (built + 24) - 12;
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
        var sg, a, b, cc, d, g, hh = Math.min(c.built, 70), e2;
        ctx.globalCompositeOperation = 'lighter';
        for (sg = -1; sg < 2; sg += 2) {
          a = pr(c, sg * (TA - TW / 2), 0, -D / 2); b = pr(c, sg * (TA + TW / 2), 0, -D / 2);
          cc = pr(c, sg * (TA + TW / 2), hh, -D / 2); d = pr(c, sg * (TA - TW / 2), hh, -D / 2);
          g = ctx.createLinearGradient(0, a[1], 0, Math.min(cc[1], d[1]));
          g.addColorStop(0, 'rgba(61,214,140,' + (.2 * w) + ')'); g.addColorStop(.45, 'rgba(180,230,205,' + (.07 * w) + ')'); g.addColorStop(1, 'rgba(244,245,242,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
          // Innenseite
          e2 = pr(c, sg * (TA - TW / 2), 0, D / 2); b = pr(c, sg * (TA - TW / 2), hh, D / 2);
          g = ctx.createLinearGradient(0, a[1], 0, Math.min(b[1], d[1]));
          g.addColorStop(0, 'rgba(61,214,140,' + (.11 * w) + ')'); g.addColorStop(1, 'rgba(244,245,242,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e2[0], e2[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
        }
        // Schein am Fluchtpunkt
        var vp = pr(c, 0, 400, 0), rg = ctx.createRadialGradient(vp[0], Math.max(vp[1], -H * .2), 0, vp[0], Math.max(vp[1], -H * .2), H * .7);
        rg.addColorStop(0, 'rgba(61,214,140,' + (.16 * w * c.k) + ')'); rg.addColorStop(1, 'rgba(61,214,140,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        // winziger Betrachter: ein Mauszeiger am Fuss der Tuerme
        var Yc = 0 - c.camH, Zc = -6.5 + c.camD, Y2 = Yc * cp - Zc * sp, Z2 = Yc * sp + Zc * cp;
        if (Z2 < 2) return;
        var sc = c.f / Z2, x = c.cx, y = c.cy - Y2 * sc, sz = clamp(sc * .42, 6, 26);
        if (y > H + 30) return;
        arrow(x - sz * .2, y - sz, sz, FG[0], BG[0], w * .95);
      }
    };
  })();

  /* 2 · Glut und Asche */
  FORM.embers = {
    name: 'Glut',
    init: function () {},
    run: function (o, p, t) {
      var k = seg(p, 18.4, 25.8), chaos = sstep(.7, 1, k), heat = 1 - sstep(.45, .95, k);
      var i, sp, u, fx, fy, cxp, cyp, hot, a, fl, wr, r, s, mm = M ? .5 : 1;
      for (i = 0; i < N; i++) {
        sp = .03 + .075 * R3[i];
        u = fract(R2[i] + t * sp * (.55 + .6 * heat) + p * .03);
        fx = W * (.5 + (R1[i] - .5) * 1.2) + (Math.sin(t * (.5 + R4[i]) + R1[i] * 40) * (14 + 70 * u) + Math.sin(t * .21 + R3[i] * 9) * 26) * mm;
        fy = H * (1.08 - Math.pow(u, .8) * 1.25);
        hot = (1 - u) * heat;
        fl = .7 + .3 * Math.sin(t * 9 + R4[i] * 50);
        wr = sstep(0, .03, u) * sstep(1, .92, u);
        if (hot > .42) { r = R4[i] > .93 ? 0 : (R4[i] < .5 ? 2 : 3); a = (.5 + .5 * fl) * wr; s = 1.3 + 3.2 * R3[i] * (1 - u * .6); }
        else { r = 4; a = (.2 + .34 * (1 - u)) * wr; s = 1.1 + 1.8 * R3[i]; }
        if (chaos > 0) {
          cxp = W * R1[i] + Math.sin(t * .4 + R3[i] * 30) * 46 + Math.cos(t * .27 + R4[i] * 12) * 34;
          cyp = H * R4[i] + Math.cos(t * .35 + R2[i] * 30) * 46 + Math.sin(t * .31 + R1[i] * 17) * 34;
          fx = lerp(fx, cxp, chaos); fy = lerp(fy, cyp, chaos);
          a = lerp(a, .3 + .35 * R3[i], chaos); s = lerp(s, 1.3 + 1.7 * R3[i], chaos);
          if (chaos > .5) r = 4;
        }
        o.x[i] = fx; o.y[i] = fy; o.a[i] = a; o.s[i] = s; o.r[i] = r;
      }
    },
    decor: function (w, p, t) {
      var k = seg(p, 18.4, 25.8), heat = (1 - sstep(.45, .95, k)) * w;
      if (heat < .01) return;
      var g = ctx.createLinearGradient(0, H, 0, H * .35);
      g.addColorStop(0, 'rgba(255,70,30,' + (.42 * heat) + ')');
      g.addColorStop(.4, 'rgba(255,46,46,' + (.14 * heat) + ')');
      g.addColorStop(1, 'rgba(255,46,46,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, H * .35, W, H * .65);
      // Geld, das nach oben verdampft
      var n = M ? 12 : 30, i, u, x, y, a, sz, rr = mulberry(77);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (i = 0; i < n; i++) {
        var a1 = rr(), a2 = rr(), a3 = rr(), a4 = rr();
        u = fract(a2 + t * (.035 + .04 * a3) + p * .03);
        x = W * (.06 + a1 * .88) + Math.sin(t * (.4 + a4) + a1 * 30) * (20 + 50 * u);
        y = H * (1.06 - u * 1.15);
        a = sstep(0, .08, u) * sstep(.95, .45, u) * heat * .85;
        for (var zi = 0; zi < ZA.length; zi++) { var zn = ZA[zi]; if (x > zn.x0 - 40 && x < zn.x1 + 40 && y > zn.y0 - 40 && y < zn.y1 + 40) a *= 1 - zn.k; }
        if (a < .02) continue;
        sz = (M ? 14 : 18) + a3 * (M ? 16 : 30);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * .6 + a4 * 20) * .5 + (a1 - .5));
        ctx.font = '800 ' + sz + 'px Manrope, sans-serif';
        ctx.fillStyle = u < .4 ? 'rgba(255,110,50,' + a + ')' : 'rgba(255,46,46,' + (a * .8) + ')';
        ctx.fillText('€', 0, 0); ctx.restore();
      }
    }
  };

  /* 3 · Raster */
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
      // gleichmaessig auf den Figuren verteilen
      var cntK = [0, 0, 0, 0, 0, 0, 0], seenK = [0, 0, 0, 0, 0, 0, 0];
      for (i = cnt; i < N; i++) cntK[GRID.rk[i]]++;
      for (i = cnt; i < N; i++) { q = GRID.rk[i]; GRID.ra[i] = (seenK[q] + .5) / cntK[q]; seenK[q]++; }
    },
    run: function (o, p, t) {
      var scan = W * (-.12 + 1.24 * seg(p, 26.6, 32.2)), i, x, y, d, a, s, r, mj, k, rk, ra, ang, rr, ti;
      var Wr = G.wire, cx = Wr.cx, cy = Wr.cy, R = Wr.h * (M ? .42 : .44), lock = eio(seg(p, 27.2, 30.2)), sc = lerp(1.5, 1, lock), rot = (1 - lock) * 1.1 + p * .05, RS = [0, 1, .66, .33];
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
    }
  };

  FORM.grid.decor = function (w, p) {
    var Wr = G.wire, lock = eio(seg(p, 27.2, 30.2));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = w * lock; ctx.fillStyle = '#0f9d5b';
    ctx.beginPath(); ctx.arc(Wr.cx, Wr.cy, 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  };

  /* 4 · Landingpage als Drahtmodell */
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
      rect(0, 0, 1, 1.25, 0); line(0, .065, 1, .065, 0);
      circ(.035, .033, .009, 0); circ(.065, .033, .009, 0); circ(.095, .033, .009, 0);
      fill(.06, .105, .12, .028, 0, 34);
      line(.62, .119, .70, .119, 0); line(.74, .119, .82, .119, 0); line(.86, .119, .94, .119, 0);
      fill(.06, .215, .50, .05, 0, 30); fill(.06, .285, .36, .05, 0, 30);
      line(.06, .375, .52, .375, 0); line(.06, .405, .48, .405, 0); line(.06, .435, .34, .435, 0);
      fill(.06, .49, .27, .075, 3, 46);
      circ(.77, .335, .14, 2); circ(.77, .30, .048, 2); circ(.77, .455, .085, 2, PI + .3, TAU - .3);
      line(.06, .62, .94, .62, 0);
      for (s = 0; s < 5; s++) star(.085 + s * .058, .675, .024, 1);
      for (s = 0; s < 3; s++) { circ(.60 + s * .13, .675, .042, 1); check(.60 + s * .13, .675, .042, 1); }
      for (c = 0; c < 3; c++) { x = .06 + c * .305; rect(x, .76, .27, .19, 1); circ(x + .045, .805, .025, 1); line(x + .09, .795, x + .23, .795, 1); line(x + .09, .82, x + .19, .82, 1); line(x + .03, .87, x + .24, .87, 1); line(x + .03, .90, x + .21, .90, 1); }
      rect(.06, 1.01, .58, .075, 0); fill(.67, 1.01, .27, .075, 3, 46);
      line(.06, 1.15, .4, 1.15, 0); line(.06, 1.18, .3, 1.18, 0);
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
        // wer im Seitenfenster liegt oder ueberzaehlig ist, wird Draht
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
      run: function (o, p, t) {
        var h0 = sstep(32.6, 33.2, p) * (1 - sstep(33.5, 34.1, p)), h1 = sstep(33.5, 34.1, p) * (1 - sstep(34.4, 35, p)), h2 = sstep(34.4, 35, p);
        var hl = [h0, h1, h2, 1], i, g, l;
        for (i = 0; i < N; i++) {
          if (isW[i]) { g = pg[i]; l = hl[g]; o.x[i] = px[i]; o.y[i] = py[i]; o.r[i] = l > .5 ? 1 : 0; o.a[i] = lerp(.62, 1, l); o.s[i] = lerp(1.7, 2.5, l); }
          else { o.x[i] = GRID.x[i]; o.y[i] = GRID.y[i]; o.r[i] = 0; o.a[i] = GRID.mj[i] ? .3 : .13; o.s[i] = 1.4; }
        }
      }
    };
  })();

  /* 5 · Drei Balken */
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
        var g1 = seg(p, 38.8, 41.2), g3 = sstep(41.6, 42.8, p), inflow = sstep(42.9, 43.9, p), flow = t * .16 + p * .22;
        var i, j, b, grow, hh, v, jb, uu, tx, a, tw;
        for (i = 0; i < N; i++) {
          j = bj[i];
          if (j < 3) {
            b = BAR[j]; grow = eo(seg(g1 - j * .14, 0, .7));
            hh = b[3] * grow * (1 + g3 * (2.4 + j * .7));
            v = fract(bv[i] + flow * (.35 + .5 * R3[i]));
            o.x[i] = x0 + (b[0] + bu[i] * b[2]) * u; o.y[i] = y0 + (103 - v * hh) * u;
            o.a[i] = grow > .02 ? (.5 + .5 * R4[i]) * sstep(0, .05, v) * sstep(1, .95, v) : 0;
            o.s[i] = 1.5 + 1.7 * R3[i]; o.r[i] = 1;
          } else if (j === 3) {
            jb = Math.floor(bu[i]); b = BAR[jb]; uu = fract(R1[i] + flow * (.5 + .5 * R3[i]));
            tx = x0 + (b[0] + (bu[i] - jb) * b[2]) * u;
            if (inflow > .01) {
              if (M) { o.x[i] = tx + (R2[i] - .5) * 60 * (1 - uu); o.y[i] = lerp(H * 1.05, y0 + 103 * u, uu); }
              else { o.x[i] = lerp(-W * .06, tx, uu); o.y[i] = y0 + 103 * u + (R2[i] - .5) * 26 * u * (1 - uu * uu) + Math.sin(uu * 9 + R4[i] * 20) * 3; }
              o.a[i] = inflow * .75 * sstep(0, .05, uu) * sstep(1, .93, uu); o.s[i] = 1.4 + R4[i] * 1.2; o.r[i] = 0;
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
        var I = G.icon, u = I.S / 128, y = I.cy - 64 * u + 103 * u + 1.5;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .22 * w; ctx.strokeStyle = FG[0]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.globalAlpha = 1;
      }
    };
  })();

  /* 6 · Tempo */
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

  /* 7 · Strom durch fuenf Stationen */
  FORM.funnel = (function () {
    var fk, fd, fo, fb, bu, bv;
    var FR = [[58.2, -.8], [59.6, 0], [61.9, .02], [63, 1], [63.4, 1.02], [64.5, 2], [64.9, 2.02], [66, 3], [66.4, 3.02], [67.2, 4], [67.8, 4.6]];
    var AE0 = 0, AE4 = 1;
    function along(s) { return AE0 + (AE4 - AE0) * s / 4; }
    function hwAt(s) { var h = G.fun.hw, k; if (s < 0) return lerp(G.fun.hin, h[0], sstep(-.8, -.05, s)); if (s >= 4) return h[4]; k = Math.floor(s); return lerp(h[k], h[k + 1], sstep(.5, 1, s - k)); }
    return {
      name: 'Strom',
      init: function () {
        fk = new Uint8Array(N); fd = new Float32Array(N); fo = new Float32Array(N); fb = new Uint8Array(N); bu = new Float32Array(N); bv = new Float32Array(N);
        var r = mulberry(303), nBar = Math.floor(N * .11), nLoop = Math.floor(N * .045), i, q;
        for (i = 0; i < N; i++) {
          if (i < nBar) { fk[i] = 1; q = r() * 2808; fb[i] = q < 594 ? 0 : q < 1512 ? 1 : 2; bu[i] = r() < .22 ? (r() < .5 ? 0 : 1) : r(); bv[i] = r(); }
          else if (i < nBar + nLoop) { fk[i] = 2; }
          else {
            fk[i] = 0; q = r();
            fd[i] = q < .38 ? 1 : q < .66 ? 2 : q < .88 ? 3 : q < .91 ? 4 : 9;
            if (fd[i] < 9) fd[i] -= r() * .1;
            fo[i] = (r() + r() + r()) / 1.5 - 1;
          }
        }
      },
      front: function (p) { return keys(p, FR); },
      geo: function (p) {
        var F_ = G.fun, e = eio(seg(p, 60.7, 62.1));
        AE0 = F_.vert ? lerp(H * .13, F_.a0, e) : F_.a0; AE4 = F_.vert ? lerp(H * .52, F_.a4, e) : F_.a4;
        return { e: e, cz: F_.vert ? 1 : lerp(.6, 1, e), c: F_.vert ? F_.c : lerp(H * .74, F_.c, e), dim: F_.vert ? lerp(.5, 1, e) : 1 };
      },
      along: along, hwAt: hwAt,
      run: function (o, p, t) {
        var F_ = G.fun, vert = F_.vert, g = this.geo(p), cz = g.cz, c = g.c, dim = g.dim, front = keys(p, FR);
        var rl = sstep(67.1, 68.7, p), boom = sstep(70.2, 71.3, p), ll = sstep(68.3, 69.6, p), flow = t * .05 + p * .014, dir = vert ? -1 : 1;
        var i, kd, u, s, ds, off, al, cr, a, r, sz, sg, tau, wait, hw, j, v, h, q, L, d, P0;
        var AL = [.4, .52, .7, 1], SZ = [1.4, 1.7, 2, 2.8];
        var lp = F_.loop, L1 = lp.l1, L2 = lp.l2, L3 = lp.l3; L = L1 + L2 + L3;
        for (i = 0; i < N; i++) {
          kd = fk[i];
          if (kd === 0) {
            u = fract(R1[i] + flow * (.7 + .6 * R3[i]));
            s = -.8 + 5.2 * (.42 * u + .58 * u * u);
            wait = 0;
            if (s > front - R4[i] * R4[i] * .55) { s = front - R4[i] * R4[i] * .55; wait = 1; }
            ds = fd[i]; off = fo[i];
            if (s <= ds) {
              al = along(s); hw = hwAt(s);
              cr = off * hw + Math.sin(t * 1.3 + R2[i] * 40 + s * 3) * hw * (wait ? .2 : .07);
              sg = s < 1 ? 0 : s < 2 ? 1 : s < 3 ? 2 : 3;
              a = AL[sg]; r = s > 3 ? 1 : 0; sz = SZ[sg] + R3[i];
              if (s > 4) a *= 1 - seg(s, 4, 4.3);
              if (wait) a *= .62;
              a *= sstep(-.8, -.62, s) * sstep(0, .02, u) * sstep(1, .985, u);
            } else {
              tau = (s - ds) / 1.05;
              if (tau > 1) { al = along(ds); cr = off * hwAt(ds); a = 0; r = 4; sz = 1; }
              else { al = along(ds + tau * .34); cr = off * hwAt(ds) + dir * (tau * tau * F_.fall + Math.abs(off) * tau * 22) ; a = .7 * (1 - tau) * (1 - tau); r = 4; sz = 1.3 + R3[i]; }
            }
            a *= dim;
          } else if (kd === 1) {
            j = fb[i]; v = fract(bv[i] + t * (.16 + .2 * R3[i]) + p * .05);
            h = F_.bh[j] * rl * (1 + boom * 4.5);
            al = F_.bx[j] + bu[i] * F_.bw; cr = -v * h;
            a = (rl > .01 && R3[i] < .2 + .8 * rl) ? (.6 + .4 * R4[i]) * sstep(0, .05, v) * sstep(1, .95, v) * sstep(0, .25, rl) : 0; r = 1; sz = 1.5 + 1.5 * R3[i];
            if (rl <= .01) { al = along(4); cr = 0; }
            else if (vert) { o.x[i] = F_.mb.x[j] + bu[i] * F_.mb.w; o.y[i] = F_.mb.base - v * F_.mb.h[j] * rl * (1 + boom * 6); o.a[i] = a; o.s[i] = sz; o.r[i] = r; continue; }
          } else {
            q = fract(R1[i] + t * .06 + p * .02); d = q * L; r = 1; sz = 1.5;
            a = (q < ll ? .85 : 0) * sstep(0, .02, q) * sstep(1, .98, q);
            P0 = lp.p;
            if (d < L1) { al = P0[0]; cr = P0[1] + dir * d; }
            else if (d < L1 + L2) { al = P0[0] - (d - L1); cr = P0[1] + dir * L1; }
            else { al = P0[0] - L2; cr = P0[1] + dir * (L1 - (d - L1 - L2)); }
          }
          if (vert) { o.x[i] = c + cr; o.y[i] = al; } else { o.x[i] = al; o.y[i] = c + cr * cz; }
          o.a[i] = a; o.s[i] = sz; o.r[i] = r;
        }
      },
      decor: function (w, p, t) {
        var F_ = G.fun, vert = F_.vert, g = this.geo(p), front = keys(p, FR), k, al, ry, open, pu, x, y;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
        for (k = 0; k < 5; k++) {
          al = along(k); ry = (F_.hw[k] * 1.16 + 8) * g.cz; open = sstep(k - .05, k + .25, front);
          pu = Math.max(0, 1 - Math.abs(front - k) * 2.2);
          ctx.globalAlpha = w * (.16 + .5 * open + .3 * pu) * g.dim;
          ctx.strokeStyle = open > .5 ? 'rgb(61,214,140)' : 'rgb(244,245,242)';
          ctx.beginPath();
          if (vert) ctx.ellipse(g.c, al, ry, 7, 0, 0, TAU); else ctx.ellipse(al, g.c, 7, ry, 0, 0, TAU);
          ctx.stroke();
          if (pu > .02) { ctx.globalAlpha = w * pu * .5; ctx.beginPath(); if (vert) ctx.ellipse(g.c, al, ry + 14 * pu, 11, 0, 0, TAU); else ctx.ellipse(al, g.c, 11, ry + 14 * pu, 0, 0, TAU); ctx.stroke(); }
        }
        // Huelle des Trichters als Blaupause
        ctx.globalAlpha = w * .2 * g.dim; ctx.strokeStyle = 'rgb(244,245,242)'; ctx.setLineDash([2, 7]);
        var sgn, q, e1;
        for (sgn = -1; sgn < 2; sgn += 2) {
          ctx.beginPath();
          for (q = -.8; q <= 4.001; q += .05) { al = along(q); e1 = sgn * (hwAt(q) * 1.16 + 8) * g.cz; if (vert) { x = g.c + e1; y = al; } else { x = al; y = g.c + e1; } if (q === -.8) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // Mittelachse
        ctx.globalAlpha = w * .1 * g.dim; ctx.strokeStyle = 'rgb(244,245,242)'; ctx.beginPath();
        if (vert) { ctx.moveTo(g.c, 0); ctx.lineTo(g.c, along(4)); } else { ctx.moveTo(0, g.c); ctx.lineTo(along(4), g.c); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
    };
  })();

  /* 8 · Fuenf Sternbilder */
  var CON = (function () {
    var C = [], i, a, n, e;
    C.push({ n: [[-.7, .85], [.7, .85], [.7, -.05], [0, -.75], [-.7, -.05], [-.15, .85], [-.15, .3], [.22, .3], [.22, .85]], e: [[0, 5], [5, 8], [8, 1], [1, 2], [2, 3], [3, 4], [4, 0], [5, 6], [6, 7], [7, 8]] });
    C.push({ n: [[-.9, -.6], [.9, -.6], [.9, .45], [-.9, .45], [-.22, -.38], [.38, -.08], [-.22, .22], [0, .45], [0, .82], [-.42, .82], [.42, .82]], e: [[0, 1], [1, 2], [2, 7], [7, 3], [3, 0], [4, 5], [5, 6], [6, 4], [7, 8], [9, 8], [8, 10]] });
    n = []; e = [];
    for (i = 0; i < 6; i++) { a = -PI / 2 + i * TAU / 6; n.push([Math.cos(a) * .3, -.48 + Math.sin(a) * .3]); e.push([i, (i + 1) % 6]); }
    n.push([-.78, .85], [-.5, .2], [0, .04], [.5, .2], [.78, .85]); e.push([6, 7], [7, 8], [8, 9], [9, 10]);
    C.push({ n: n, e: e });
    C.push({ n: [[-.7, .85], [.137, -.134], [.738, -.07], [.518, .19], [-.244, -.458], [-.024, -.718]], e: [[0, 1], [2, 3], [3, 1], [1, 4], [4, 5], [5, 2]] });
    n = []; e = [];
    for (i = 0; i < 8; i++) { a = i * TAU / 8; n.push([Math.cos(a) * .34, Math.sin(a) * .34]); e.push([i, (i + 1) % 8]); }
    for (i = 0; i < 8; i++) { a = i * TAU / 8 + TAU / 16; n.push([Math.cos(a) * .56, Math.sin(a) * .56]); n.push([Math.cos(a) * .95, Math.sin(a) * .95]); e.push([8 + i * 2, 9 + i * 2]); }
    C.push({ n: n, e: e });
    return C;
  })();
  var FS = [75.6, 77.0, 78.4, 79.8];
  function focusAt(p) { var f = 0, i; for (i = 0; i < FS.length; i++) f += eio(seg(p, FS[i] - .3, FS[i] + .2)); return f; }
  FORM.stars = (function () {
    var kd, cj, lx, ly, edges = [];
    return {
      name: 'Sternbilder',
      init: function () {
        kd = new Uint8Array(N); cj = new Uint8Array(N); lx = new Float32Array(N); ly = new Float32Array(N); edges = [];
        var i = 0, j, c, q, m, base, nd = M ? 9 : 20, a, b, k;
        for (j = 0; j < 5; j++) {
          c = CON[j]; base = i;
          for (q = 0; q < c.n.length; q++, i++) { kd[i] = 1; cj[i] = j; lx[i] = c.n[q][0]; ly[i] = c.n[q][1]; }
          for (q = 0; q < c.e.length; q++) {
            a = c.n[c.e[q][0]]; b = c.n[c.e[q][1]];
            edges.push([base + c.e[q][0], base + c.e[q][1], j]);
            for (m = 0; m < nd; m++, i++) { k = (m + 1) / (nd + 1); kd[i] = 2; cj[i] = j; lx[i] = a[0] + (b[0] - a[0]) * k; ly[i] = a[1] + (b[1] - a[1]) * k; }
          }
        }
        for (; i < N; i++) kd[i] = 0;
        this.edges = edges;
      },
      place: function (p) {
        var f = focusAt(p), intro = sstep(73.5, 74.5, p), j, out = [], ox, oy, fx, fy, Ro, Rf, SP;
        for (j = 0; j < 5; j++) {
          if (M) { ox = W * (.16 + .17 * j); oy = H * (.2 + .05 * (j % 2)); Ro = H * .045; fx = W * .5 + (j - f) * W * .95; fy = H * .27; Rf = H * .135; }
          else { ox = W * (.56 + .095 * j); oy = H * (.74 - .125 * j); Ro = H * .07; SP = H * .78; fx = W * .73; fy = H * .5 + (j - f) * SP; Rf = H * .21; }
          out.push({ x: lerp(ox, fx, intro), y: lerp(oy, fy, intro), R: lerp(Ro, Rf, intro), act: clamp(1 - Math.abs(j - f), 0, 1) * intro });
        }
        out.f = f; out.intro = intro;
        return out;
      },
      run: function (o, p, t) {
        var P = this.place(p), i, k, c, tw, act, yy, span = H * 1.3;
        this.P = P;
        for (i = 0; i < N; i++) {
          k = kd[i];
          if (k === 0) {
            tw = .55 + .45 * Math.sin(t * (.5 + R3[i] * 1.6) + R4[i] * 70);
            yy = fract((R2[i] * span - (M ? 0 : P.f * H * .34 * Z[i]) - p * 5 * Z[i]) / span) * span - H * .15;
            o.x[i] = M ? fract(R1[i] - P.f * .3 * Z[i]) * W : R1[i] * W; o.y[i] = yy;
            o.a[i] = (.1 + .5 * R3[i] * R3[i]) * tw * sstep(-H * .15, -H * .08, yy) * sstep(span - H * .15, span - H * .25, yy); o.s[i] = .8 + 1.9 * Z[i] * R4[i]; o.r[i] = R4[i] > .965 ? 1 : 0;
            continue;
          }
          c = P[cj[i]]; act = c.act;
          o.x[i] = c.x + lx[i] * c.R; o.y[i] = c.y + ly[i] * c.R;
          if (k === 1) { tw = .8 + .2 * Math.sin(t * 1.4 + R4[i] * 30); o.s[i] = 3.4 + 2.4 * act; o.a[i] = (.7 + .3 * act) * tw; }
          else { o.s[i] = 1.2 + .7 * act; o.a[i] = .22 + .5 * act; }
          o.r[i] = act > .5 ? 1 : 0;
        }
      },
      decor: function (w, p) {
        var P = this.P, E = this.edges, i, e, act; if (!P || !E) return;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
        for (i = 0; i < E.length; i++) {
          e = E[i]; act = P[e[2]].act;
          ctx.globalAlpha = w * (.2 + .45 * act);
          ctx.strokeStyle = act > .5 ? 'rgb(61,214,140)' : 'rgb(244,245,242)';
          ctx.beginPath(); ctx.moveTo(X[e[0]], Y[e[0]]); ctx.lineTo(X[e[1]], Y[e[1]]); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    };
  })();

  /* 9 · Horizont */
  FORM.horizon = {
    name: 'Horizont',
    init: function () {},
    run: function (o, p, t) {
      var y0 = G.hor, i, x, sp, g;
      for (i = 0; i < N; i++) {
        x = -W * .04 + R1[i] * W * 1.08;
        g = (R2[i] + R3[i] + R4[i]) / 1.5 - 1;
        sp = Z[i] > .88 ? 10 : .7;
        o.x[i] = x + Math.sin(t * .1 + R3[i] * 20) * 3;
        o.y[i] = y0 + g * sp + Math.sin(x * .0045 + t * .22) * 2.2;
        o.a[i] = Z[i] > .88 ? .34 : .5 + .4 * R4[i]; o.s[i] = Z[i] > .88 ? 1.2 + R3[i] : 1.1 + .5 * R3[i]; o.r[i] = 0;
      }
    },
    decor: function (w, p, t) {
      var k = seg(p, 82.6, 93.2), x = W * lerp(.12, .9, k), y = G.hor, br = 1 + .06 * Math.sin(t * .8);
      ctx.globalCompositeOperation = 'source-over';
      var g = ctx.createRadialGradient(x, y, 0, x, y, 120 * br);
      g.addColorStop(0, 'rgba(15,157,91,' + (.26 * w) + ')'); g.addColorStop(1, 'rgba(15,157,91,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 130, y - 130, 260, 260);
      ctx.globalAlpha = w; ctx.fillStyle = '#0f9d5b'; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  };

  /* 10 · Signet */
  FORM.logo = (function () {
    var kd, lx, ly;
    return {
      name: 'Signet',
      init: function () {
        kd = new Uint8Array(N); lx = new Float32Array(N); ly = new Float32Array(N);
        var nb = Math.floor(N * .66), na = Math.floor(N * .17), i, j, b, x, y, g, pb = [], pa = [], perm;
        // Punktmatrix: Balken und Zeiger liegen auf einem exakten Raster
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
        var L = G.logo, u = L.S / 128, x0 = L.cx - 64 * u, y0 = L.cy - 64 * u, i, k, tw, rise = seg(p, 95, 100);
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
          }
        }
      }
    };
  })();

  var SCHED = [
    { n: 'lattice', a: 0, b: 2.5 },
    { n: 'towers', a: 5.5, b: 16.2, st: 'rand', sw: .22 },
    { n: 'embers', a: 18.4, b: 25.8, st: 'up', sw: .1 },
    { n: 'grid', a: 27.9, b: 31.6, st: 'wipe', wi: 0 },
    { n: 'wire', a: 33.2, b: 38.3, st: 'rand', sw: 0 },
    { n: 'bars', a: 40.2, b: 45.9, st: 'wipe', wi: 1, sw: .2 },
    { n: 'streaks', a: 47.8, b: 56.6, st: 'wipe', wi: 2 },
    { n: 'funnel', a: 58.6, b: 71, st: 'wipe', wi: 3 },
    { n: 'stars', a: 73, b: 81.5, st: 'rand', sw: .3 },
    { n: 'horizon', a: 83.6, b: 93.1, st: 'wipe', wi: 4 },
    { n: 'logo', a: 95.6, b: 100, st: 'wipe', wi: 5, sw: .25 }
  ];
  var cur = { fa: null, fb: null, m: 0 };

  function evaluate(p, t) {
    var j, c, n;
    for (j = 0; j < SCHED.length - 1; j++) { if (p < SCHED[j + 1].a) break; }
    c = SCHED[j]; n = SCHED[j + 1];
    if (!n || p <= c.b) { FORM[c.n].run(F, p, t); cur.fa = c; cur.fb = null; cur.m = 0; return; }
    FORM[c.n].run(A, p, t); FORM[n.n].run(B, p, t);
    var m = (p - c.b) / (n.a - c.b), S = .7, sw = n.sw || 0, mode = n.st, i, e, d, dx, dy, q, wx = 0, wy = 0, wR = 1, wp = null, pp;
    if (mode === 'wipe') { wp = WIPES[n.wi]; var oo = wp.o(); wx = oo[0]; wy = oo[1]; wR = maxR(wx, wy); }
    var Ax = A.x, Ay = A.y, Bx = B.x, By = B.y;
    for (i = 0; i < N; i++) {
      if (mode === 'wipe') { dx = Ax[i] - wx; dy = Ay[i] - wy; d = Math.sqrt(dx * dx + dy * dy) / wR; if (d > 1) d = 1; pp = wp.at + wp.dur * Math.pow(d, 1 / 1.4); e = seg(p, pp - .1, pp + .6); }
      else { d = mode === 'up' ? clamp(1 - Ay[i] / H, 0, 1) * .8 + R3[i] * .2 : R3[i]; e = clamp(m * (1 + S) - S * d, 0, 1); }
      e = eio(e);
      dx = Bx[i] - Ax[i]; dy = By[i] - Ay[i];
      F.x[i] = Ax[i] + dx * e; F.y[i] = Ay[i] + dy * e;
      if (sw) { q = Math.sin(PI * e) * sw * (R4[i] - .5) * 2; F.x[i] -= dy * q; F.y[i] += dx * q; }
      F.s[i] = A.s[i] + (B.s[i] - A.s[i]) * e; F.a[i] = A.a[i] + (B.a[i] - A.a[i]) * e; F.r[i] = e < .5 ? A.r[i] : B.r[i];
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
  function activeZones(p) {
    var i, z, w; ZA.length = 0;
    for (i = 0; i < zones.length; i++) { z = zones[i]; if (p <= z.a0 || p >= z.b1 || !z.w) continue; w = Math.min(seg(p, z.a0, z.a1), 1 - seg(p, z.b0, z.b1)) * z.k; if (w > .01) ZA.push({ x0: z.x, y0: z.y, x1: z.x + z.w, y1: z.y + z.h, k: w }); }
  }

  function draw(p, t, dt, snap) {
    var i, j, b, n, a, s, r, x, y, tx, ty, vx, vy, dx, dy, d2, d, k, w, lvl, z, zn, f;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = BG[baseWorld]; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < AW.length; i++) { a = AW[i]; ctx.fillStyle = BG[a.w]; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill(); }

    var wa = cur.fb ? 1 - cur.m : 1, wb = cur.fb ? cur.m : 0, fa = FORM[cur.fa.n], fbm = cur.fb ? FORM[cur.fb.n] : null;
    if (fa.decor && wa > .01) fa.decor(wa, p, t);
    if (fbm && fbm.decor && wb > .01) fbm.decor(wb, p, t);

    for (b = 0; b < 75; b++) BC[b] = 0; GLn = 0; GEn = 0;
    var kf = snap ? 1 : 1 - Math.exp(-dt * 9.5), fr = dt > 0 ? (1 / 60) / dt : 1;
    var par = M ? 0 : 46, mxo = mouse.sx, myo = mouse.sy, mx = mouse.x, my = mouse.y, MR = 150, MR2 = MR * MR;
    var nz = ZA.length, nw = AW.length, nr = ripples.length, imp = impulseOn > 0;
    var Fx = F.x, Fy = F.y, Fa = F.a, Fs = F.s, Fr = F.r, jump = W * W * .2;
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
      // Ruhezonen hinter Text
      for (j = 0; j < nz; j++) {
        zn = ZA[j];
        if (x > zn.x0 - 50 && x < zn.x1 + 50 && y > zn.y0 - 40 && y < zn.y1 + 40) {
          f = 1;
          if (x < zn.x0) f *= 1 - (zn.x0 - x) / 50; else if (x > zn.x1) f *= 1 - (x - zn.x1) / 50;
          if (y < zn.y0) f *= 1 - (zn.y0 - y) / 40; else if (y > zn.y1) f *= 1 - (y - zn.y1) / 40;
          a *= 1 - zn.k * f;
        }
      }
      // Maus
      dx = x - mx; dy = y - my; d2 = dx * dx + dy * dy;
      if (d2 < MR2) { k = 1 - d2 / MR2; s += k * 1.8; a += k * .45; if (k > .3 && r !== 2 && r !== 3) r = 1; }
      // Welt und Stosswelle
      w = baseWorld;
      for (j = 0; j < nw; j++) {
        z = AW[j]; dx = x - z.x; dy = y - z.y; d2 = dx * dx + dy * dy;
        if (d2 < z.r * z.r) w = z.w;
        d = Math.sqrt(d2); k = Math.abs(d - z.r);
        if (k < 70 && d > 1) { f = (1 - k / 70); f = f * f * (z.ig ? 38 : 22) * (1 - z.k * .5); x += dx / d * f; y += dy / d * f; s += f * .05; a += f * .02; }
      }
      for (j = 0; j < nr; j++) {
        z = ripples[j]; dx = x - z.x; dy = y - z.y; d = Math.sqrt(dx * dx + dy * dy); k = Math.abs(d - z.r);
        if (k < 80 && d > 1) { f = (1 - k / 80) * z.f; x += dx / d * f * 26 * z.p; y += dy / d * f * 26 * z.p; a += f * .6; s += f * 1.4; if (f > .25 && r !== 2 && r !== 3) r = 1; }
      }
      if (a > 1) a = 1;
      lvl = a < .17 ? 0 : a < .32 ? 1 : a < .54 ? 2 : a < .82 ? 3 : 4;
      b = (w * 5 + r) * 5 + lvl;
      BK[b][BC[b]++] = i;
      F.x[i] = x; F.y[i] = y; F.s[i] = s;   // Ablage fuer den Zeichendurchgang
      if (w === 0 && lvl >= 3 && s > 2.5) { if (r === 1 && GLn < 1400) GL[GLn++] = i; else if ((r === 2 || r === 3) && GEn < 900) GE[GEn++] = i; }
    }
    if (imp) impulseOn -= dt;

    var tr = 4 + Math.min(10, Math.abs(vel) * 9), sp2, sp, L, nx, ny, hx, hy, idx, arr, wI;
    for (b = 0; b < 75; b++) {
      n = BC[b]; if (!n) continue;
      arr = BK[b]; wI = Math.floor(b / 25);
      ctx.globalCompositeOperation = wI === 0 ? 'lighter' : 'source-over';
      ctx.fillStyle = STY[b];
      ctx.beginPath();
      for (j = 0; j < n; j++) {
        idx = arr[j]; x = Fx[idx]; y = Fy[idx]; s = Fs[idx]; vx = VX[idx]; vy = VY[idx];
        sp2 = vx * vx + vy * vy;
        if (sp2 > 5) {
          sp = Math.sqrt(sp2); L = Math.min(sp * tr, 110); hx = vx / sp; hy = vy / sp; nx = -hy * s * .5; ny = hx * s * .5;
          ctx.moveTo(x + nx, y + ny); ctx.lineTo(x - nx, y - ny); ctx.lineTo(x - hx * L, y - hy * L); ctx.closePath();
        } else if (s < 2.3) { ctx.rect(x - s * .5, y - s * .5, s, s); }
        else { ctx.moveTo(x + s * .5, y); ctx.arc(x, y, s * .5, 0, TAU); }
      }
      ctx.fill();
    }
    if (GLn || GEn) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55;
      for (j = 0; j < GLn; j++) { idx = GL[j]; s = Fs[idx] * 4.2; ctx.drawImage(glowG, Fx[idx] - s, Fy[idx] - s, s * 2, s * 2); }
      ctx.globalAlpha = .6;
      for (j = 0; j < GEn; j++) { idx = GE[j]; s = Fs[idx] * 4.4; ctx.drawImage(glowE, Fx[idx] - s, Fy[idx] - s, s * 2, s * 2); }
      ctx.globalAlpha = 1;
    }

    // Vignette in den dunklen Welten, weicht vor jedem Weltwechsel zurueck
    if (baseWorld === 0 && !AW.length) {
      var vg = 1, wq;
      for (i = 0; i < WIPES.length; i++) { wq = WIPES[i]; vg = Math.min(vg, Math.max(seg(wq.at - p, 0, .7), seg(p - (wq.at + wq.dur), 0, .7))); }
      if (vg > .01) {
        if (!draw.vg || draw.vgW !== W || draw.vgH !== H) { draw.vg = ctx.createRadialGradient(W * .5, H * .5, Math.min(W, H) * .35, W * .5, H * .5, Math.sqrt(W * W + H * H) * .56); draw.vg.addColorStop(0, 'rgba(0,0,0,0)'); draw.vg.addColorStop(1, 'rgba(0,0,0,.62)'); draw.vgW = W; draw.vgH = H; }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = vg; ctx.fillStyle = draw.vg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      }
    }

    // Raender der Wischer + Klick-Zeiger
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < AW.length; i++) {
      a = AW[i]; if (a.r < 2) continue;
      ctx.globalAlpha = clamp(1.2 - a.k, 0, 1) * .9; ctx.lineWidth = a.ig ? 2 : 1.5;
      ctx.strokeStyle = a.w === 1 ? '#0f9d5b' : a.w === 2 ? '#0a0b0d' : '#3DD68C';
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = clamp(1 - a.k * 1.6, 0, 1) * .5;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r * .82, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < WIPES.length; i++) {
      w = WIPES[i];
      if (p > w.at - 1.1 && p < w.at + .5) {
        var o = w.o(), ap = sstep(w.at - 1.1, w.at - .5, p) * (1 - sstep(w.at + .15, w.at + .5, p)), tr2 = 1 - eo(seg(p, w.at - 1.1, w.at - .1)), press = 1 - .22 * sstep(w.at - .12, w.at, p) * (1 - sstep(w.at, w.at + .25, p));
        var ww = worldAt(o[0] + 90 * tr2 + 6, o[1] + 120 * tr2 + 8);
        arrow(o[0] + 90 * tr2, o[1] + 120 * tr2, (M ? 30 : 38) * press, FG[ww], BG[ww], ap);
      }
    }
  }

  /* ---------- Layout ---------- */
  function layout(keep) {
    W = win.innerWidth; H = win.innerHeight; M = W < 760;
    dpr = Math.min(win.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (!keep || maxScroll < 2) maxScroll = Math.max(1, Math.round(((M ? 24 : 36) - 1) * H));
    trackH = Math.round(H + (1 - pBase) * maxScroll);
    track.style.height = trackH + 'px';
    G.wire = M ? { cx: W * .5, cy: H * .285, h: H * .4 } : { cx: W * .725, cy: H * .5, h: H * .7 };
    G.wire.s = G.wire.h / 1.25; G.wire.x0 = G.wire.cx - G.wire.s / 2; G.wire.y0 = G.wire.cy - G.wire.h / 2;
    G.icon = M ? { cx: W * .5, cy: H * .3, S: H * .36 } : { cx: W * .775, cy: H * .5, S: H * .62 };
    G.logo = M ? { cx: W * .5, cy: H * .2, S: H * .22 } : { cx: W * .79, cy: H * .45, S: H * .52 };
    G.hor = M ? H * .44 : H * .56;
    if (M) {
      G.fun = { vert: true, c: W * .3, a0: H * .2, a4: H * .78, hw: [W * .2, W * .14, W * .09, W * .05, W * .03], hin: W * .3, fall: W * .16 };
      G.fun.bw = W * .045; G.fun.bx = [H * .80, H * .83, H * .86]; G.fun.bh = [W * .1, W * .16, W * .23];
      G.fun.loop = { p: [H * .635, 0], l1: 0, l2: 0, l3: 0 };
    } else {
      G.fun = { vert: false, c: H * .56, a0: W * .135, a4: W * .835, hw: [H * .19, H * .125, H * .075, H * .036, H * .02], hin: H * .27, fall: H * .4 };
      G.fun.bw = W * .017; G.fun.bx = [W * .862, W * .887, W * .912]; G.fun.bh = [H * .12, H * .185, H * .262];
      var x3 = G.fun.a0 + (G.fun.a4 - G.fun.a0) * .75, yb = H * .3;
      G.fun.loop = { p: [x3, H * .05], l1: yb - H * .05, l2: x3 - G.fun.a0, l3: yb - G.fun.hw[0] * 1.16 - 14 };
    }
  }
  // Mobil: Balken am Ende des Stroms stehen quer zur Achse, daher eigene Abbildung
  function funnelMobileBars() {
    if (!G.fun.vert) return;
    // im Hochformat wachsen die Balken nach oben aus der letzten Station
    var F_ = G.fun;
    F_.mb = { x: [W * .185, W * .27, W * .355], w: W * .06, base: H * .915, h: [H * .04, H * .065, H * .09] };
  }

  var ths = [];
  function measure() {
    var r, i, z, el;
    if (gate) { r = gate.getBoundingClientRect(); if (r.width) { G.gx = r.left + r.width / 2; G.gy = r.top + r.height / 2; } }
    if (G.gx === undefined) { G.gx = W * .8; G.gy = H * .45; }
    for (i = 0; i < zones.length; i++) { z = zones[i]; el = z.el; z.x = offL(el); z.y = offT(el); z.w = el.offsetWidth; z.h = el.offsetHeight; }
    ths = $$('.th').map(function (e) { var b = e.getBoundingClientRect(); return { el: e, x: b.left + b.width / 2, y: b.top + b.height / 2, w: -1 }; });
    G.railH = H - (M ? 6.4 : 8) * 16;
    $$('.mq').forEach(function (m) { var tEl = m.firstElementChild; m._w = tEl.scrollWidth / 2; });
    placeStations();
  }
  function offL(el) { var x = 0; while (el && el !== film) { x += el.offsetLeft; el = el.offsetParent; } return x; }
  function offT(el) { var y = 0; while (el && el !== film) { y += el.offsetTop; el = el.offsetParent; } return y; }
  function placeStations() {
    var F_ = G.fun, st = $$('.stn'), i, al, top, h;
    st.forEach(function (el, k) {
      al = F_.a0 + (F_.a4 - F_.a0) * k / 4;
      if (F_.vert) { el.style.left = Math.round(F_.c + F_.hw[0] * 1.16 + 22) + 'px'; el.style.top = Math.round(al - 30) + 'px'; }
      else {
        top = H * .15; h = el.offsetHeight || 78;
        el.style.left = Math.round(al) + 'px'; el.style.top = Math.round(top) + 'px';
        el.style.setProperty('--stem', Math.max(8, Math.round(F_.c - (F_.hw[k] * 1.16 + 8) - (top + h) - 18)) + 'px');
      }
    });
    var ll = $('#loop-l');
    if (ll && !F_.vert) { ll.style.left = Math.round(F_.loop.p[0] - F_.loop.l2 / 2) + 'px'; ll.style.top = Math.round(F_.c + F_.loop.p[1] + F_.loop.l1 + 12) + 'px'; }
  }

  /* ---------- Text: Wortmasken + Zeitachse ---------- */
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
  function show(el, a) { ft(el, a, a + .02, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none'); }
  function mark(el, a, b) { var s = (typeof el === 'string' ? $(el) : el).closest('.scene'), i; for (i = 0; i < ranges.length; i++) if (ranges[i].el === s) { ranges[i].a = Math.min(ranges[i].a, a); ranges[i].b = Math.max(ranges[i].b, b); return; } ranges.push({ el: s, a: a, b: b, on: null }); }
  function calm(el, a, din, b, dout, k) { zones.push({ el: el, a0: a, a1: a + din * .7, b0: b, b1: b + dout, k: k === undefined ? .9 : k, x: 0, y: 0, w: 0, h: 0 }); }
  function beat(sel, o) {
    var el = $(sel); if (!el) return;
    var a = o.a, din = o.din || .8, b = o.b, dout = o.dout || .6, ws, n, per, gap;
    mark(el, a, b + dout);
    switch (o.i || 'mask') {
      case 'mask':
        show(el, a); ws = $$('.w > span', el); n = ws.length; per = din * .5; gap = n > 1 ? (din - per) / (n - 1) : 0;
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

  function buildTimeline() {
    if (TL) TL.kill();
    if (touched.length) gsap.set(touched, { clearProps: 'transform,opacity,visibility' });
    touched = []; seen = new Set(); zones = []; ranges = [];
    TL = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    TL.to({}, { duration: 100 }, 0);
    var i;

    /* K0 */
    mark('.b0', 0, 4.2);
    ft('.mega .l1', 1, 3.9, { x: 0, autoAlpha: 1 }, { x: -W * .7, autoAlpha: 0 }, 'power2.in');
    ft('.mega .l2', 1, 3.9, { x: 0, autoAlpha: 1 }, { x: W * .7, autoAlpha: 0 }, 'power2.in');
    ft('#cue', .15, 1.2, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 30 }, 'power1.in');
    calm($('#h1'), -1, .1, 1.4, 2.2, .8);

    /* K1 */
    beat('.b1a h2', { a: 3.6, din: 1, b: 7, dout: .7, o: 'l' });
    mark('.giants', 7.6, 11.2); show('.giants', 7.6);
    ft('.g1', 7.7, 8.8, { autoAlpha: 0, x: -W * .6 }, { autoAlpha: 1, x: 0 });
    ft('.g2', 8.15, 9.25, { autoAlpha: 0, x: W * .6 }, { autoAlpha: 1, x: 0 });
    ft('.g1', 10.2, 11, { autoAlpha: 1, x: 0, scale: 1 }, { autoAlpha: 0, x: -W * .25, scale: 1.2 }, 'power2.in');
    ft('.g2', 10.2, 11, { autoAlpha: 1, x: 0, scale: 1 }, { autoAlpha: 0, x: W * .25, scale: 1.2 }, 'power2.in');
    calm($('.g1'), 7.9, .9, 10.2, .8, .93); calm($('.g2'), 8.3, .9, 10.2, .8, .93);
    beat('.b1c p', { a: 10.9, din: .8, b: 13.4, dout: .6, o: 'up', calm: .94 });
    beat('.b1d p', { a: 13.9, din: .8, b: 15.9, dout: .7, o: 'zoom', calm: .94 });

    /* K2 */
    beat('.b2a h2', { a: 17, din: 1, b: 21, dout: .7, i: 'zoom', o: 'up', calm: .8 });
    beat('.b2b p', { a: 21.5, din: .8, b: 23.4, dout: .6, i: 'l', o: 'l', calm: .85 });
    beat('.b2c p', { a: 23.9, din: .8, b: 25.4, dout: .6, i: 'r', o: 'fade', calm: .85 });

    /* K3 */
    beat('.b3a h2', { a: 26.9, din: .8, b: 29.6, dout: .6, o: 'l', calm: .95 });
    beat('.b3b p', { a: 30.1, din: .8, b: 32, dout: .6, o: 'up', calm: .95 });
    var three = $('.three'), lis = $$('.three li');
    mark(three, 32.5, 36.8); show(three, 32.5);
    lis.forEach(function (li, j) {
      var a = 32.6 + j * .9;
      ft(li, a, a + .6, { autoAlpha: 0, x: -60 }, { autoAlpha: 1, x: 0 });
      if (j < 2) ft(li, a + .9, a + 1.3, { autoAlpha: 1 }, { autoAlpha: .46 }, 'none');
    });
    ft(three, 36.2, 36.7, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .3 }, 'power2.in');
    calm(three, 32.5, .6, 36.2, .5, .7);
    beat('.b3d p', { a: 36.6, din: .7, b: 38, dout: .5, calm: .7 });

    /* K4 */
    var work = $('.work');
    mark(work, 39.2, 43.4);
    ft(work, 39.2, 39.9, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0 });
    ft('.v2', 40.5, 40.9, { yPercent: 120 }, { yPercent: 0 }, 'power3.inOut');
    ft('.v3', 41.6, 42, { yPercent: 120 }, { yPercent: 0 }, 'power3.inOut');
    ft('.v1', 40.5, 40.9, { yPercent: 0 }, { yPercent: -120 }, 'power3.inOut');
    ft('.v2', 41.6, 42, { yPercent: 0 }, { yPercent: -120 }, 'power3.inOut');
    ft(work, 42.7, 43.1, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -H * .16 }, 'power2.in');
    calm(work, 39.2, .7, 42.7, .4, .85);
    var io = $('.inout'); mark(io, 43.15, 46.3); show(io, 43.15);
    ft('.io1', 43.15, 43.75, { autoAlpha: 0, x: -W * .6 }, { autoAlpha: 1, x: 0 });
    ft('.io2', 43.3, 43.9, { autoAlpha: 0, x: W * .6 }, { autoAlpha: 1, x: 0 });
    ft(io, 45.4, 46, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.3 }, 'power2.in');
    calm(io, 43.2, .6, 45.4, .6, .85);

    /* K5 */
    mark('.tools', 46.9, 56.9); show('.tools', 46.9);
    ft('.mq', 47, 47.6, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none');
    ft('.mq', 56.5, 57, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    [[47.3, 49.9], [50.2, 53], [53.3, 56.3]].forEach(function (r, j) {
      var t = $('.t' + (j + 1));
      ft(t, r[0], r[0] + .8, { autoAlpha: 0, x: W * .45 }, { autoAlpha: 1, x: 0 });
      ft($('h3', t), r[0], r[0] + .9, { x: W * .22 }, { x: 0 });
      ft($('p', t), r[0] + .1, r[0] + 1, { x: W * .12, autoAlpha: 0 }, { x: 0, autoAlpha: 1 });
      ft(t, r[1], r[1] + .5, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .45 }, 'power2.in');
    });
    calm($('.tools'), 47, .6, 56.3, .6, .9);

    /* K6 */
    beat('.b6a h2', { a: 57.9, din: .8, b: 60.8, dout: .6, o: 'up', calm: .9 });
    var stn = $$('.stn'), ts = [61.5, 63, 64.5, 66, 67.2];
    mark('.stations', 61.3, 71.4); show('.stations', 61.3);
    stn.forEach(function (el, j) {
      ft(el, ts[j], ts[j] + .5, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0 });
      ft(el, 70.5 + j * .05, 71.1 + j * .05, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30 }, 'power2.in');
    });
    ft('#fnote', 61.5, 62, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none'); ft('#fnote', 70.6, 71.1, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    ft('#loop-l', 69, 69.5, { autoAlpha: 0 }, { autoAlpha: 1 }, 'none'); ft('#loop-l', 70.6, 71.1, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');

    /* K7 */
    beat('.b7a h2', { a: 72, din: .8, b: 73.6, dout: .5, o: 'l', calm: .9 });
    var who = $('#who'), wl = $$('#who li'), fs = [74.8, 75.6, 77, 78.4, 79.8, 81.3];
    mark(who, 74.05, 81.9); show(who, 74.05);
    wl.forEach(function (li, j) {
      ft(li, 74.05 + j * .07, 74.5 + j * .07, { autoAlpha: 0, x: -50, '--on': 0 }, { autoAlpha: .44, x: 0, '--on': 0 });
      ft(li, fs[j] - .3, fs[j] + .1, { autoAlpha: .44, x: 0, '--on': 0 }, { autoAlpha: 1, x: M ? 6 : 14, '--on': 1 }, 'power2.out');
      if (j < 4) ft(li, fs[j + 1] - .3, fs[j + 1] + .1, { autoAlpha: 1, x: M ? 6 : 14, '--on': 1 }, { autoAlpha: .44, x: 0, '--on': 0 }, 'power2.out');
    });
    ft(who, 81.2, 81.7, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -W * .3 }, 'power2.in');
    calm(who, 74.05, .6, 81.2, .5, .9);

    /* K8 */
    beat('.b8a h2', { a: 82.8, din: .8, b: 85.1, dout: .6, calm: 0 });
    var q3 = $('.q3'); mark(q3, 85.6, 88.3); show(q3, 85.6);
    $$('.q3 span').forEach(function (s, j) { ft(s, 85.7 + j * .6, 86.2 + j * .6, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0 }); });
    ft(q3, 87.7, 88.2, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');
    beat('.b8c p', { a: 88.2, din: .7, b: 89.4, dout: .5, calm: 0 });
    beat('.b8d p', { a: 89.9, din: .7, b: 90.9, dout: .45, calm: 0 });
    var pre = $('.pre'); mark(pre, 91.3, 93.4); show(pre, 91.3);
    ft('.pre-k', 91.3, 91.6, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0 });
    var pw = $$('.pre-t .w > span');
    pw.forEach(function (w, j) { var g = pw.length > 1 ? .3 / (pw.length - 1) : 0; ft(w, 91.35 + j * g, 91.6 + j * g, { yPercent: 118 }, { yPercent: 0 }); });
    ft(pre, 92.9, 93.3, { autoAlpha: 1 }, { autoAlpha: 0 }, 'none');

    /* K9 */
    var ct = $('.contact'); mark(ct, 94.3, 100); show(ct, 94.3);
    ft('.s9 .eyebrow', 94.4, 95, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0 });
    $$('.name .nl > span').forEach(function (s, j) { ft(s, 94.6 + j * .3, 95.4 + j * .3, { yPercent: 118 }, { yPercent: 0 }); });
    ft('.s9 .lead', 95.4, 96, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0 });
    $$('.ways li').forEach(function (li, j) { ft(li, 95.8 + j * .25, 96.4 + j * .25, { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0 }); });
    calm(ct, 94.4, .8, 101, 1, .9);
  }

  /* ---------- HUD ---------- */
  var roP = $('#ro-p'), roK = $('#ro-k'), roC = $('#ro-c'), roN = $('#ro-n'), roF = $('#ro-f'), roXY = $('#ro-xy');
  var railFill = $('#rail-fill'), railDot = $('#rail-dot'), idxA = $$('.index a');
  var hudS = { pc: -1, kl: -1, ch: -1, fn: '', foot: null, end: null };
  (function () { var tk = $('#ticks'), i, s; if (!tk) return; for (i = 0; i < CH.length; i++) { s = doc.createElement('span'); s.style.top = CH[i] + '%'; tk.appendChild(s); } })();
  function pad(n, l) { var s = String(n); while (s.length < l) s = '0' + s; return s; }
  function dots(n) { var s = String(n), o = '', i; for (i = 0; i < s.length; i++) { if (i && (s.length - i) % 3 === 0) o += '.'; o += s.charAt(i); } return o; }
  function hud(p) {
    var pc = Math.round(p), kl = Math.floor(p * 1284.4) + clicks, ch = 0, i, fn, e;
    if (pc !== hudS.pc) { hudS.pc = pc; roP.textContent = pad(pc, 3); }
    if (kl !== hudS.kl) { hudS.kl = kl; roK.textContent = dots(kl); }
    for (i = 0; i < CH.length; i++) if (p >= CH[i] - .001) ch = i;
    if (ch !== hudS.ch) { hudS.ch = ch; roC.textContent = pad(ch, 2); roN.textContent = CHN[ch]; idxA.forEach(function (a, j) { if (j === ch) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); } else { a.classList.remove('on'); a.removeAttribute('aria-current'); } }); }
    fn = FORM[(cur.fb && cur.m > .5 ? cur.fb : cur.fa).n].name;
    if (fn !== hudS.fn) { hudS.fn = fn; roF.textContent = fn; }
    railFill.style.transform = 'scaleY(' + (p / 100).toFixed(4) + ')';
    railDot.style.transform = 'translateY(' + (p / 100 * G.railH).toFixed(1) + 'px)';
    e = p > 96.8;
    if (e !== hudS.foot) { hudS.foot = e; foot.classList.toggle('on', e); body.classList.toggle('end', e); }
    for (i = 0; i < ths.length; i++) { var h = ths[i], w = worldAt(h.x, h.y); if (w !== h.w) { h.w = w; h.el.classList.remove('t-k', 't-i', 't-g'); h.el.classList.add('t-' + WN[w]); } }
  }
  var mqs = $$('.mq');
  function marquee(p, t) {
    if (p < 46.5 || p > 57) return;
    var i, m, w, x, sk = clamp(vel * 60, -14, 14);
    for (i = 0; i < mqs.length; i++) {
      m = mqs[i]; w = m._w || 2000;
      x = ((p - 46) * (M ? 60 : 130) + t * 26) % w;
      m.firstElementChild.style.transform = 'translate3d(' + (i ? x - w : -x).toFixed(1) + 'px,0,0) skewX(' + (i ? sk : -sk).toFixed(2) + 'deg)';
    }
  }
  var cnts = $$('.stn .cnt'), CV = [1000, 620, 340, 120, 90], CO = [61.9, 63.4, 64.9, 66.4, 67.6], cntS = [-1, -1, -1, -1, -1];
  function counters(p) {
    if (p < 61 || p > 72) return;
    var i, v;
    for (i = 0; i < 5; i++) { v = Math.round(CV[i] * eo(seg(p, CO[i] - .4, 70.4))); if (v !== cntS[i]) { cntS[i] = v; cnts[i].textContent = dots(v); } }
  }

  /* ---------- Render ---------- */
  function render(p, t, dt, snap) {
    var i, r, on;
    TL.time(p, false);
    for (i = 0; i < ranges.length; i++) { r = ranges[i]; on = p >= r.a - .05 && p <= r.b + .05; if (on !== r.on) { r.on = on; r.el.classList.toggle('on', on); } }
    worlds(p, t);
    activeZones(p);
    for (i = ripples.length - 1; i >= 0; i--) { r = ripples[i]; r.age = t - r.t; if (r.age > 1.7) { ripples.splice(i, 1); continue; } r.r = r.age * 900 * r.p; r.f = 1 - r.age / 1.7; }
    if (snap) {
      evaluate(p, t - 1 / 60);
      for (i = 0; i < N; i++) { X[i] = F.x[i]; Y[i] = F.y[i]; }
      evaluate(p, t);
      for (i = 0; i < N; i++) { VX[i] = F.a[i] > .03 ? clamp(F.x[i] - X[i], -40, 40) : 0; VY[i] = F.a[i] > .03 ? clamp(F.y[i] - Y[i], -40, 40) : 0; if (Math.abs(F.x[i] - X[i]) > W * .3 || Math.abs(F.y[i] - Y[i]) > H * .3) { VX[i] = 0; VY[i] = 0; } }
    } else evaluate(p, t);
    draw(p, t, dt, snap);
    hud(p); marquee(p, t); counters(p);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, .05); if (dt <= 0) dt = .016; last = now; T += dt;
    if (lenis) lenis.raf(now);
    var y = win.pageYOffset || root.scrollTop || 0;
    pT = locked ? 0 : clamp(pBase + y / maxScroll, 0, 1);
    var kf = 1 - Math.exp(-dt * (touch ? 9 : 15));
    pS += (pT - pS) * kf; if (Math.abs(pT - pS) < .00002) pS = pT;
    vel = lerp(vel, (pS - pPrev) / dt * 10, .15); pPrev = pS;
    mouse.sx += (mouse.nx - mouse.sx) * .06; mouse.sy += (mouse.ny - mouse.sy) * .06;
    render(pS * 100, T, dt, false);
  }
  function start() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else start(); });

  /* ---------- Sperre, Zuendung ---------- */
  var outside = $$('.scene:not(#k0), .index, .foot, .kontakt-link');
  function blockTouch(e) { if (!locked) return; if (e.cancelable) e.preventDefault(); nudge(); }
  var nudgeT = 0;
  function nudge() {
    if (!locked) return; var now = Date.now(); if (now - nudgeT < 600) return; nudgeT = now;
    gate.classList.remove('shake'); void gate.offsetWidth; gate.classList.add('shake');
    if (hint) hint.classList.add('show');
    ripples.push({ x: G.gx, y: G.gy, t: T, p: .7, r: 0, f: 1, age: 0 });
  }
  function startLenis() {
    if (lenis || DEBUG || !win.Lenis) return;
    try { lenis = new win.Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: 1 }); } catch (e) { lenis = null; }
  }
  function jump(pu, immediate, ms) {
    var y = Math.max(0, Math.round((clamp(pu, 0, 100) / 100 - pBase) * maxScroll));
    if (immediate) {
      if (lenis) { try { lenis.scrollTo(y, { immediate: true, force: true }); } catch (e) {} }
      root.style.scrollBehavior = 'auto'; win.scrollTo(0, y); root.style.scrollBehavior = '';
      pT = pS = pPrev = clamp(pBase + y / maxScroll, 0, 1); vel = 0;
      render(pS * 100, T, 0, true);
      return;
    }
    ms = ms || 1800;
    if (lenis) { try { lenis.scrollTo(y, { duration: ms / 1000, easing: eio, force: true, lock: true }); return; } catch (e) {} }
    var y0 = win.pageYOffset, t0 = performance.now(), done = false;
    function fin() { if (done) return; done = true; win.scrollTo(0, y); }
    (function step(now) { if (done) return; var k = clamp((now - t0) / ms, 0, 1); win.scrollTo(0, y0 + (y - y0) * eio(k)); if (k < 1) requestAnimationFrame(step); else fin(); })(t0);
    setTimeout(fin, ms + 400);
  }
  function impulse(x, y, power) {
    var i, dx, dy, d, f;
    for (i = 0; i < N; i++) { dx = X[i] - x; dy = Y[i] - y; d = Math.sqrt(dx * dx + dy * dy) + 30; f = power * (.4 + .6 * R3[i]) * Math.min(1, 420 / d); OVX[i] += dx / d * f; OVY[i] += dy / d * f; }
    impulseOn = 3;
  }
  function open(silent) {
    locked = false;
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
    clicks++;
    ign = { x: x, y: y, t: T, R: maxR(x, y) };
    ripples.push({ x: x, y: y, t: T + .25, p: 1.5, r: 0, f: 1, age: 0 });
    impulse(x, y, 900);
    flash.style.setProperty('--fx', Math.round(x) + 'px'); flash.style.setProperty('--fy', Math.round(y) + 'px');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    setTimeout(function () { jump(4.9, false, 3000); }, 700);
    // Sicherheitsnetz: falls der Frame-Timer nicht laeuft, steht der Film trotzdem am ersten Bild
    setTimeout(function () { if ((win.pageYOffset || 0) < 4 && !locked) jump(4.9, true); }, 4400);
  }
  function lock() {
    locked = true; body.classList.add('locked');
    outside.forEach(function (el) { el.setAttribute('inert', ''); });
    root.style.scrollBehavior = 'auto'; win.scrollTo(0, 0); root.style.scrollBehavior = '';
    win.addEventListener('touchmove', blockTouch, { passive: false });
  }

  $('#k0').addEventListener('click', function (e) { if (locked) ignite(e.clientX, e.clientY); });
  gate.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ignite(); } });
  win.addEventListener('wheel', function () { nudge(); }, { passive: true });
  win.addEventListener('keydown', function (e) { if (!locked) return; if (['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'].indexOf(e.key) > -1 && doc.activeElement !== gate) { e.preventDefault(); nudge(); } });
  win.addEventListener('scroll', function () { if (locked && (win.pageYOffset || 0) !== 0) win.scrollTo(0, 0); }, { passive: true });
  doc.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.nx = e.clientX / W - .5; mouse.ny = e.clientY / H - .5;
    if (roXY) roXY.textContent = 'X ' + pad(Math.round(e.clientX), 4) + ' · Y ' + pad(Math.round(e.clientY), 4);
    if (locked && !M) { var dx = e.clientX - G.gx, dy = e.clientY - G.gy, d = Math.sqrt(dx * dx + dy * dy), k = clamp((190 - d) / 80, 0, 1); gate.style.translate = (dx * .25 * k).toFixed(1) + 'px ' + (dy * .25 * k).toFixed(1) + 'px'; }
  });
  doc.addEventListener('mouseleave', function () { mouse.x = -9999; mouse.y = -9999; mouse.nx = 0; mouse.ny = 0; });
  doc.addEventListener('pointerdown', function (e) { if (locked) return; clicks++; ripples.push({ x: e.clientX, y: e.clientY, t: T, p: 1, r: 0, f: 1, age: 0 }); if (ripples.length > 4) ripples.shift(); });

  function hashTarget() { var h = location.hash.slice(1), m; if (!h) return null; if (h === 'kontakt') return 99; m = /^k(\d)$/.exec(h); return m ? CHJ[+m[1]] : null; }
  idxA.concat($$('.top a')).forEach(function (a) {
    a.addEventListener('click', function (e) {
      var m = /^#k(\d)$/.exec(a.getAttribute('href') || ''); if (!m) return;
      e.preventDefault(); if (locked) return;
      jump(CHJ[+m[1]], false, 1900);
      var s = doc.getElementById('k' + m[1]); if (s) setTimeout(function () { try { s.focus({ preventScroll: true }); } catch (er) {} }, 2000);
    });
  });
  win.addEventListener('hashchange', function () { var t = hashTarget(); if (t === null) return; if (locked) open(false); jump(t, true); });

  /* ---------- Start ---------- */
  function boot() {
    layout(); funnelMobileBars();
    N = M ? 2500 : 9000;
    initParticles();
    glowG = sprite(61, 214, 140); glowE = sprite(255, 90, 42);
    buildTimeline();
    measure();
    Object.keys(FORM).forEach(function (k) { FORM[k].init(); });
  }
  function reflow(keep) {
    var p = pS;
    layout(keep); funnelMobileBars();
    var n = M ? 2500 : 9000; if (n !== N) { N = n; initParticles(); }
    buildTimeline(); measure();
    Object.keys(FORM).forEach(function (k) { FORM[k].init(); });
    if (!locked && !keep) { root.style.scrollBehavior = 'auto'; win.scrollTo(0, Math.max(0, Math.round((p - pBase) * maxScroll))); root.style.scrollBehavior = ''; }
    if (lenis && lenis.resize) lenis.resize();
    render(pS * 100, T, 0, true);
  }
  var lw = 0, lh = 0, rzT = 0;
  function onResize() {
    var w = win.innerWidth, h = win.innerHeight;
    if (w === lw && h === lh) return;
    // mobile Adressleiste: Filmlaenge und Scrollposition bleiben, nur die Buehne passt sich an
    var keep = touch && w === lw && Math.abs(h - lh) < 130;
    lw = w; lh = h; reflow(keep);
  }
  win.addEventListener('resize', function () {
    clearTimeout(rzT);
    // Maus-Geraete: sofort, damit Buehne und Fenster nie auseinanderlaufen. Touch: gebuendelt (Adressleiste).
    if (!touch) onResize(); else rzT = setTimeout(onResize, 140);
  });

  boot(); lw = W; lh = H;
  var ht = hashTarget();
  if (DEBUG) { body.classList.add('still', 'settled'); open(true); jump(DEBUG_P * 100, true); }
  else if (ht !== null) { open(false); jump(ht, true); }
  else { lock(); render(0, T, 0, true); }

  function arm() { body.classList.add('ready'); }
  function refit() { measure(); FORM.lattice.init(); render(pS * 100, T, 0, true); }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { arm(); refit(); }, arm);
  setTimeout(arm, 700);
  // nach dem Auftakt steht alles fest, unabhaengig davon, ob Uebergaenge gelaufen sind
  setTimeout(function () { arm(); body.classList.add('settled'); }, 2300);
  win.addEventListener('load', function () { arm(); refit(); });
  setTimeout(function () { if (locked && hint) hint.classList.add('show'); }, 2600);
  start();
})();
