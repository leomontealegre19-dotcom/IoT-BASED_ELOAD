/* landlord.js - bagong layout ng LANDLORD dashboard (tenant ay walang pagbabago)
 * Ilagay sa index.html pagkatapos ng extras.js:
 *   <script src="extras.js"></script>
 *   <script src="landlord.js"></script>
 */
(function () {
  const VIS = { "24h": 12, "7d": 7, "12m": 6 };   // ilang bars ang kita bago mag-swipe (palitan kung gusto)
  const GH = 240;                                   // taas ng graph sa px (palakihin kung gusto)
  const RN = { "24h": "Last 24 hours", "7d": "This week", "12m": "This year" };
  const NICE = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  let panels = {}, PH = {}, phL = [], cur = "home";

  /* ---------------- CSS ---------------- */
  const css = `
:root{--hh:56px;--tb:58px}
#hdrBtns{display:flex;gap:6px;align-items:center}
#llBell{display:none;position:relative;width:44px;height:44px;margin:0;padding:0;font-size:21px;background:#ffffff22}
#llBell.on,#topMenu.on{background:#ffffff44}
#llBell .badge{top:2px;left:auto;right:0}
#llNav{display:none}
body.ll{padding:0;height:100dvh;overflow:hidden}
body.ll #llBell{display:block}
body.ll header{position:fixed;top:0;left:0;right:0;height:var(--hh);padding:0 12px;z-index:6}
body.ll header h2{font-size:16px}
body.ll header small{display:none}
body.ll #tabs{display:none!important}
body.ll #llNav{display:grid;position:fixed;bottom:0;left:0;right:0;height:var(--tb);grid-template-columns:repeat(4,1fr);background:var(--card);border-top:1px solid var(--line2);z-index:5}
#llNav button{background:none;color:var(--mut);margin:0;border:0;border-radius:0;padding:6px 2px;font-size:11px}
#llNav button.on{color:var(--blue)}
#llNav span{display:block;font-size:20px}
body.ll main{position:fixed;top:var(--hh);bottom:var(--tb);left:0;right:0;max-width:none;margin:0;padding:0}
body.ll #app{display:flex;flex-direction:column;height:100%}
body.ll #statusMessage{display:none}
body.ll #notifPrompt{padding:10px 12px 0}
body.ll .view{flex:1;min-height:0;overflow-y:auto;padding:12px;width:100%;max-width:720px;margin:0 auto}
body.ll #v-home{padding:0;overflow:hidden;max-width:none}
body.ll .overlay{top:var(--hh);bottom:var(--tb);align-items:stretch;background:var(--bg)}
body.ll .sheet{max-width:none;max-height:none;height:100%;border-radius:0;padding:16px}
.llWrap{display:flex;flex-direction:column;height:100%}
.llDots{display:flex;justify-content:center;align-items:center;height:22px;flex:none}
.llDots .llDot{width:9px;height:9px;padding:0;margin:0 5px;border-radius:50%;background:var(--line2)}
.llDots .llDot.on{background:var(--blue);width:22px;border-radius:5px}
.llPager{flex:1;min-height:0;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.llPager::-webkit-scrollbar{display:none}
.llPanel{flex:0 0 100%;min-width:0;scroll-snap-align:center;scroll-snap-stop:always;overflow-y:auto;padding:4px 12px 14px;display:flex;flex-direction:column;gap:10px}
.llPanel>*{flex:none}
.llHead{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px}
.llHead b{font-size:18px}
.llHead .pill{font-size:10px;padding:3px 8px;margin:0 0 0 4px}
.llTop{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.llGaugeBox{background:var(--card);border-radius:14px;padding:8px 6px 6px;box-shadow:0 2px 8px #0000000c;text-align:center}
.llSide{display:flex;flex-direction:column;gap:10px}
.llBox{flex:1;background:var(--card);border-radius:14px;padding:10px 12px;box-shadow:0 2px 8px #0000000c;display:flex;flex-direction:column;justify-content:center}
.llBox .l{font-size:12px;color:var(--mut)}
.llBox .v{font-size:17px;font-weight:bold;overflow-wrap:anywhere}
.llG{background:var(--card);border-radius:14px;padding:12px;box-shadow:0 2px 8px #0000000c}
.llGH{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.llGH select{width:auto;margin:0;padding:6px 8px;font-size:13px}
.llGV{font-size:26px;font-weight:bold;color:var(--accent)}
.llChart{display:flex;margin-top:8px}
.llAxis{flex:none;color:var(--text)}
.llScroll{flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;color:var(--text)}
.llScroll::-webkit-scrollbar{display:none}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);

  /* ---------------- Header (alert + menu) at bottom nav ---------------- */
  const hdr = document.querySelector("header");
  const old = $("topMenu"), tm = old.cloneNode(true); old.replaceWith(tm);   // tanggalin ang lumang click handler
  const hb = document.createElement("div"); hb.id = "hdrBtns";
  const bell = document.createElement("button");
  bell.id = "llBell"; bell.setAttribute("aria-label", "Alerts"); bell.innerHTML = '🔔<i class="badge" id="llBadge" hidden>0</i>';
  hb.append(bell, tm); hdr.append(hb);

  tm.addEventListener("click", () => { if (!$("menuSheet").hidden) { $("menuSheet").hidden = true; return; } openMenu(); });
  bell.onclick = () => { closeModal(); showView("notifs"); };

  const nav = document.createElement("nav"); nav.id = "llNav";
  [["home", "🏠", "Dashboard"], ["topup", "⚡", "Top up"], ["history", "🧾", "History"], ["profile", "👤", "Profile"]].forEach(([k, i, l]) => {
    const b = document.createElement("button"); b.dataset.k = k; b.innerHTML = `<span>${i}</span>${l}`;
    b.onclick = () => go(k); nav.append(b);
  });
  document.body.append(nav);

  function mark(name) {
    nav.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === name));
    bell.classList.toggle("on", name === "notifs");
  }
  function go(k) {
    closeModal(); $("menuSheet").hidden = true;
    if (k === "topup") { loadFlow("landlord"); mark($("modal").hidden ? cur : "topup"); }
    else showView(k);
  }

  /* ---------------- Wrappers ---------------- */
  const oShow = window.showView;
  window.showView = function (name) {
    oShow.apply(this, arguments); cur = name;
    if (S.role === "landlord") {
      mark(name);
      if (name === "home") requestAnimationFrame(() => ROOMS.forEach(r => panels[r] && draw(panels[r], false)));
    }
  };
  const oClose = window.closeModal;
  window.closeModal = function () { oClose.apply(this, arguments); if (S.role === "landlord") mark(cur); };

  const oUB = window.updateBadge;
  window.updateBadge = function () {
    oUB.apply(this, arguments);
    const a = $("notifBadge"), b = $("llBadge"); if (a && b) { b.textContent = a.textContent; b.hidden = a.hidden; }
  };

  const oRR = window.renderRooms;
  window.renderRooms = function () { oRR.apply(this, arguments); if (S.role === "landlord" && Object.keys(panels).length) paintAll(); };

  const oLand = window.initLandlord;
  window.initLandlord = function () { oLand.apply(this, arguments); buildPager(); };

  const oStart = window.startDashboard;
  window.startDashboard = function () {
    oStart.apply(this, arguments);
    document.body.classList.toggle("ll", S.role === "landlord");
    if (S.role === "landlord") { startPhones(); mark(cur); }
  };
  const oStop = window.stopListeners;
  window.stopListeners = function () { oStop.apply(this, arguments); stopPhones(); };

  new MutationObserver(() => { if (!$("loginPanel").hidden) { document.body.classList.remove("ll"); panels = {}; } })
    .observe($("loginPanel"), { attributes: true, attributeFilter: ["hidden"] });

  // Mobile number ng tenant (galing sa Settings > SMS Phone Number)
  function startPhones() {
    stopPhones();
    ROOMS.forEach(r => {
      const ref = db.ref("phones/" + r), h = s => { PH[r] = s.val() || ""; paintAll(); };
      ref.on("value", h, () => {}); phL.push([ref, h]);
    });
  }
  function stopPhones() { phL.forEach(([ref, h]) => ref.off("value", h)); phL = []; PH = {}; }

  // i-refresh ang graphs kada 5 minuto (nagse-save ang central ESP32 kada 10 min)
  setInterval(() => { if (S.role === "landlord" && !$("v-home").hidden) ROOMS.forEach(loadRoom); }, 300000);

  /* ---------------- Pager (Room 1 / 2 / 3) ---------------- */
  function box(l) {
    const n = el("div", "llBox"), v = el("div", "v", "—"), s = el("div", "muted"); s.style.fontSize = "11px";
    n.append(el("div", "l", l), v, s); return { n, v, s };
  }
  function gauge() {
    const n = el("div", "llGaugeBox");
    n.innerHTML = '<div class="muted" style="font-size:10px">AVAILABLE / TOTAL LOADED</div>' +
      '<svg viewBox="0 0 320 175" style="width:100%;display:block">' +
      '<path d="M 40 150 A 120 120 0 0 1 280 150" fill="none" style="stroke:var(--track)" stroke-width="22" stroke-linecap="round"/>' +
      '<path class="ga" d="M 40 150 A 120 120 0 0 1 280 150" fill="none" stroke="#159a72" stroke-width="22" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100" style="transition:stroke-dasharray .4s"/>' +
      '<text class="gr" x="160" y="108" text-anchor="middle" font-size="22" font-weight="bold" fill="currentColor">— / —</text>' +
      '<text x="160" y="136" text-anchor="middle" font-size="16" fill="currentColor">kWh</text></svg>';
    const arc = n.querySelector(".ga"), gr = n.querySelector(".gr");
    return {
      n, set(b, l) {
        if (b === null || b < 0 || l === null || l <= 0) { gr.textContent = "— / —"; arc.setAttribute("stroke-dasharray", "0 100"); return; }
        const s = Math.min(b, l), p = s / l * 100;
        gr.textContent = s.toFixed(3) + " / " + l.toFixed(3);
        arc.setAttribute("stroke-dasharray", p + " 100"); arc.setAttribute("stroke", p <= 20 ? "#dc2626" : "#159a72");
      }
    };
  }
  function makePanel(r) {
    const p = { r, range: "24h", rows: null, id: 0, drawn: false, needReset: false };
    const root = el("section", "llPanel"), head = el("div", "llHead");
    p.pl = el("div"); head.append(el("b", null, rname(r)), p.pl);
    p.g = gauge(); p.phone = box("Tenant mobile number"); p.phone.v.style.fontSize = "15px"; p.tot = box("Total consumption");
    const side = el("div", "llSide"); side.append(p.phone.n, p.tot.n);
    const top = el("div", "llTop"); top.append(p.g.n, side);

    const gc = el("div", "llG"), gh = el("div", "llGH"), left = el("div");
    p.cl = el("div", "muted"); p.cv = el("div", "llGV", "—"); p.cs = el("div", "muted"); p.cs.style.fontSize = "12px";
    left.append(p.cl, p.cv, p.cs);
    const sel = el("select");
    Object.entries(RN).forEach(([k, l]) => { const o = el("option", null, l); o.value = k; sel.append(o); });
    sel.onchange = () => { p.range = sel.value; p.rows = null; p.drawn = false; loadRoom(r); };
    gh.append(left, sel);
    p.axis = el("div", "llAxis"); p.scroll = el("div", "llScroll");
    p.chart = el("div", "llChart"); p.chart.append(p.axis, p.scroll);
    p.msg = el("p", "muted", "Loading…");
    gc.append(gh, p.msg, p.chart, el("p", "muted", "Swipe the graph left or right to see more."));
    root.append(head, top, gc);
    new ResizeObserver(() => draw(p, false)).observe(p.scroll);
    p.root = root; return p;
  }
  function buildPager() {
    panels = {};
    const wrap = el("div", "llWrap"), dots = el("div", "llDots"), pager = el("div", "llPager");
    ROOMS.forEach((r, i) => {
      panels[r] = makePanel(r); pager.append(panels[r].root);
      const d = el("button", "llDot"); d.setAttribute("aria-label", rname(r));
      d.onclick = () => pager.scrollTo({ left: i * pager.clientWidth, behavior: "smooth" });
      dots.append(d);
    });
    const sync = () => { const i = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)); [...dots.children].forEach((d, j) => d.classList.toggle("on", j === i)); };
    pager.addEventListener("scroll", sync, { passive: true });
    wrap.append(dots, pager); $("v-home").replaceChildren(wrap); sync();
    ROOMS.forEach(loadRoom); paintAll();
  }
  function paintAll() {
    ROOMS.forEach(r => {
      const p = panels[r]; if (!p) return;
      const rm = S.rooms[r] || {}, ctrl = rm.ctrl || {}, live = rm.live || {};
      const bal = num(firstValue(live, KEYS.bal)), loaded = num(ctrl.loaded);
      p.g.set(bal, loaded);
      p.pl.replaceChildren(pills(ctrl, live));
      p.phone.v.textContent = PH[r] || "Not set";
      const tc = num(live.totalConsumed);
      const used = tc !== null ? tc : (bal !== null && loaded !== null ? Math.max(0, loaded - bal) : null);
      p.tot.v.textContent = used === null ? "— kWh" : used.toFixed(3) + " kWh";
      p.tot.s.textContent = used !== null && S.rate > 0 ? "≈ " + peso(used * S.rate) : "";
    });
  }

  /* ---------------- Graph ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  function sv(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("width", w); s.setAttribute("height", h); s.style.display = "block"; return s; }
  function add(s, t, a, x) { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (x !== undefined) n.textContent = x; s.append(n); return n; }

  async function loadRoom(r) {
    const p = panels[r]; if (!p) return;
    const id = ++p.id, now = Date.now(), range = p.range;
    if (!p.rows) { p.msg.hidden = false; p.msg.className = "muted"; p.msg.textContent = "Loading…"; }
    const from = range === "24h" ? now - 30 * 36e5 : range === "7d" ? now - 9 * 864e5 : new Date(new Date(now).getFullYear(), 0, 1).getTime() - 6 * 36e5;
    try {
      const ref = db.ref("history/" + r); let snap;
      try { snap = await ref.orderByChild("ts").startAt(from).once("value"); }
      catch (e) { snap = await ref.limitToLast(range === "12m" ? 20000 : 1500).once("value"); }
      if (id !== p.id) return;
      p.rows = Object.values(snap.val() || {}).filter(x => x && num(x.ts) !== null && num(x.kwh) !== null)
        .map(x => ({ ts: Number(x.ts), kwh: Number(x.kwh) })).sort((a, b) => a.ts - b.ts);
      draw(p, !p.drawn); p.drawn = true;
    } catch (e) { if (id !== p.id) return; p.msg.hidden = false; p.msg.className = "error"; p.msg.textContent = "Cannot load history: " + errMsg(e); }
  }

  function draw(p, force) {
    if (!p.rows) return;
    if (p.rows.length < 2) {
      p.cl.textContent = "Consumption · " + RN[p.range]; p.cv.textContent = "0.000 kWh"; p.cs.textContent = "";
      p.chart.hidden = true; p.msg.hidden = false; p.msg.className = "muted";
      p.msg.textContent = "No history yet. The central ESP32 saves a reading every 10 minutes."; return;
    }
    p.chart.hidden = false; p.msg.hidden = true;
    const vw = p.scroll.clientWidth;
    if (vw <= 0) { if (force) p.needReset = true; return; }     // nakatago pa ang tab; ulitin pag lumabas
    const reset = force || p.needReset; p.needReset = false;

    const R = window.__eloadBuckets(p.rows, p.range, Date.now()), vals = R.vals, n = vals.length;
    p.cl.textContent = "Consumption · " + RN[p.range];
    p.cv.textContent = R.total.toFixed(3) + " kWh";
    p.cs.textContent = (S.rate > 0 ? "≈ " + peso(R.total * S.rate) + " · " : "") + R.stats[1][0] + ": " + R.stats[1][1];

    // taas ng y-axis ay depende sa peak usage
    const peak = Math.max(...vals, 0);
    const step = NICE.find(s => peak / s <= 5) || 1000, k = Math.max(Math.ceil(peak / step - 1e-9), 1), top = k * step;
    const dec = step >= 1 ? 0 : (Math.round(step * 10) / 10 === step ? 1 : 2);
    const pt = 22, pb = 22, ph = GH - pt - pb, yOf = v => pt + ph * (1 - v / top);
    const bw = vw / Math.min(VIS[p.range], n), W = Math.ceil(bw * n);
    const ax = sv(36, GH), cs = sv(W, GH);
    for (let i = 0; i <= k; i++) {
      const y = yOf(i * step);
      add(cs, "line", { x1: 0, x2: W, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:.15" });
      add(ax, "text", { x: 32, y: y + 3, "text-anchor": "end", "font-size": 10, style: "fill:currentColor" }, (i * step).toFixed(dec));
    }
    add(ax, "text", { x: 0, y: 10, "font-size": 9, style: "fill:currentColor;opacity:.7" }, "kWh");
    const nowI = R.w.dow !== undefined ? R.w.dow : R.w.month !== undefined ? R.w.month : n - 1;
    vals.forEach((v, i) => {
      const h = ph * v / top, x = i * bw + bw * .15, w = bw * .7, cx = i * bw + bw / 2;
      add(cs, "rect", { x, y: pt + ph - h, width: w, height: Math.max(0, h), rx: 3, style: "fill:" + (i === nowI ? "var(--green)" : "var(--blue)") });
      if (v > 0) add(cs, "text", { x: cx, y: pt + ph - h - 4, "text-anchor": "middle", "font-size": 10, "font-weight": "bold", style: "fill:currentColor" }, v.toFixed(v >= 10 ? 1 : 2));
      add(cs, "text", { x: cx, y: GH - 6, "text-anchor": "middle", "font-size": 10, style: "fill:currentColor;opacity:.8" }, R.labels[i]);
    });
    const keep = p.scroll.scrollLeft;
    p.axis.replaceChildren(ax); p.scroll.replaceChildren(cs);
    p.scroll.scrollLeft = reset ? (p.range === "24h" ? W : p.range === "12m" ? Math.max(0, (R.w.month + 1) * bw - vw) : 0) : keep;
  }
})();
