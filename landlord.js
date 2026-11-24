/* landlord.js (v2) - bagong layout para sa LANDLORD at TENANT
 * Nasa index.html pagkatapos ng extras.js:
 *   <script src="extras.js"></script>
 *   <script src="landlord.js"></script>
 */
(function () {
  const VIS = { "24h": 12, "7d": 7, "12m": 6, test: 7 };   // ilang bars ang kita bago mag-swipe
  const GH = 240;                                           // taas ng graph (px)
  const MAXKW = 4;                                          // pinakamataas na posibleng load (kW); lampas dito = glitch
  const TEST_START = new Date(2026, 9, 1);                  // simula ng testing: October 1, 2026
  const RN = { "24h": "Last 24 hours", "7d": "This week", "12m": "This year", test: "Since Oct (testing)" };
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const NICE = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  const MET = [["w", "Power", "W", 0], ["v", "Voltage", "V", 1], ["i", "Current", "A", 3], ["pf", "Power factor", "", 2]];
  let panels = {}, PH = {}, TD = { ctrl: {}, live: {} }, LL = [], cur = "home";

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
body.ll #modal{align-items:center}
body.ll #modal .sheet{height:auto;max-height:100%;width:calc(100% - 24px);max-width:440px;border-radius:18px;box-shadow:0 8px 30px #0003}
.llWrap{display:flex;flex-direction:column;height:100%}
.llDots{display:flex;justify-content:center;align-items:center;height:22px;flex:none}
.llDots .llDot{width:9px;height:9px;padding:0;margin:0 5px;border-radius:50%;background:var(--line2)}
.llDots .llDot.on{background:var(--blue);width:22px;border-radius:5px}
.llPager{flex:1;min-height:0;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.llPager::-webkit-scrollbar{display:none}
.llPanel{flex:0 0 100%;min-width:0;scroll-snap-align:center;scroll-snap-stop:always;overflow-y:auto;padding:4px 12px 14px;display:flex;flex-direction:column;gap:10px}
.llPanel>*{flex:none}
.llPanel>div:empty{display:none}
.llPanel>.card{margin:0}
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
  const old = $("topMenu"), tm = old.cloneNode(true); old.replaceWith(tm);
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
    if (k === "topup") { loadFlow(S.role); mark($("modal").hidden ? cur : "topup"); }
    else showView(k);
  }

  /* ---------------- Wrappers ---------------- */
  const oShow = window.showView;
  window.showView = function (name) {
    oShow.apply(this, arguments); cur = name;
    if (S.role) {
      mark(name);
      if (name === "home") requestAnimationFrame(() => Object.values(panels).forEach(p => draw(p, false)));
    }
  };
  const oClose = window.closeModal;
  window.closeModal = function () { oClose.apply(this, arguments); if (S.role) mark(cur); };
  const oUB = window.updateBadge;
  window.updateBadge = function () {
    oUB.apply(this, arguments);
    const a = $("notifBadge"), b = $("llBadge"); if (a && b) { b.textContent = a.textContent; b.hidden = a.hidden; }
  };
  const oRR = window.renderRooms;
  window.renderRooms = function () { oRR.apply(this, arguments); if (S.role === "landlord" && Object.keys(panels).length) paintAll(); };
  const oLand = window.initLandlord;
  window.initLandlord = function () { oLand.apply(this, arguments); buildPager(); };
  const oTen = window.initTenant;
  window.initTenant = function () { oTen.apply(this, arguments); buildTenant(); };
  const oStart = window.startDashboard;
  window.startDashboard = function () {
    oStart.apply(this, arguments);
    document.body.classList.toggle("ll", !!S.role);
    if (S.role) { startData(); mark(cur); }
  };
  const oStop = window.stopListeners;
  window.stopListeners = function () { oStop.apply(this, arguments); stopLL(); };
  new MutationObserver(() => { if (!$("loginPanel").hidden) { document.body.classList.remove("ll"); panels = {}; } })
    .observe($("loginPanel"), { attributes: true, attributeFilter: ["hidden"] });

  function startData() {
    stopLL();
    const rs = S.role === "landlord" ? ROOMS : [S.room];
    rs.forEach(r => { const ref = db.ref("phones/" + r), h = s => { PH[r] = s.val() || ""; paintAll(); }; ref.on("value", h, () => {}); LL.push([ref, h]); });
    if (S.role === "tenant") ["ctrl", "live"].forEach(k => {
      const ref = db.ref("rooms/" + S.room + "/" + k), h = s => { TD[k] = s.val() || {}; paintAll(); }; ref.on("value", h, () => {}); LL.push([ref, h]);
    });
  }
  function stopLL() { LL.forEach(([ref, h]) => ref.off("value", h)); LL = []; PH = {}; TD = { ctrl: {}, live: {} }; }
  setInterval(() => { if (S.role && Object.keys(panels).length) paintAll(); }, 15000);
  setInterval(() => { if (S.role && !$("v-home").hidden) Object.keys(panels).forEach(loadRoom); }, 300000);

  /* ---------------- Panel (gauge, number, graph, readings) ---------------- */
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
    const p = { r, range: "24h", rows: null, id: 0, drawn: false, needReset: false, used: null, lastUsed: undefined };
    const root = el("section", "llPanel"), head = el("div", "llHead");
    p.pl = el("div"); head.append(el("b", null, rname(r)), p.pl);
    p.g = gauge();
    if (S.role === "landlord") {
      const rb = el("button", "danger", "Reset unused load"); rb.style.cssText = "font-size:12px;padding:8px;margin:4px 0 0";
      rb.onclick = () => resetLoad(r); p.g.n.append(rb);
    }
    p.phone = box("Tenant mobile number"); p.phone.v.style.fontSize = "15px"; p.tot = box("Total consumption");
    const side = el("div", "llSide"); side.append(p.phone.n, p.tot.n);
    const top = el("div", "llTop"); top.append(p.g.n, side);

    const gc = el("div", "llG"), gh = el("div", "llGH"), left = el("div");
    p.cl = el("div", "muted"); p.cv = el("div", "llGV", "—"); p.cs = el("div", "muted"); p.cs.style.fontSize = "12px";
    p.cn = el("div", "muted"); p.cn.style.fontSize = "11px";
    left.append(p.cl, p.cv, p.cs, p.cn);
    const sel = el("select");
    Object.entries(RN).forEach(([k, l]) => { const o = el("option", null, l); o.value = k; sel.append(o); });
    sel.onchange = () => { p.range = sel.value; p.rows = null; p.drawn = false; loadRoom(r); };
    gh.append(left, sel);
    p.axis = el("div", "llAxis"); p.scroll = el("div", "llScroll");
    p.chart = el("div", "llChart"); p.chart.append(p.axis, p.scroll);
    p.msg = el("p", "muted", "Loading…");
    gc.append(gh, p.msg, p.chart, el("p", "muted", "Swipe the graph left or right to see more."));

    const rd = el("div", "llG"), rt = el("div", "muted", "Tap to see the sensor graph"); rt.style.fontSize = "12px";
    p.rdb = el("div"); rd.append(el("h3", null, "⚡ Electrical Readings"), rt, p.rdb);
    rd.style.cursor = "pointer"; rd.onclick = () => sensorGraph(r);

    root.append(head, top, gc, rd);
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
    Object.keys(panels).forEach(loadRoom); paintAll();
  }
  // Tenant: parehong layout, isang room lang. Ang mga lumang card ay itinatago (kailangan pa rin ng lumang code ang mga element).
  function buildTenant() {
    const hv = $("v-home"), room = S.room;
    panels = {}; const p = makePanel(room); panels[room] = p;
    const low = $("lowBox"), al = $("tAlert");
    const oldG = $("gArc").closest(".card"), oldR = $("tReadings").closest(".card"), pw = $("btnOn").closest(".card");
    const sms = [...hv.children].find(c => c.classList && c.classList.contains("card") && c.querySelector("h3") && c.querySelector("h3").textContent === "SMS Notification");
    oldG.hidden = true; oldR.hidden = true;
    p.root.prepend(...[low, al].filter(Boolean)); p.root.append(pw); if (sms) p.root.append(sms);
    const wrap = el("div", "llWrap"); wrap.append(p.root);
    hv.replaceChildren(wrap, oldG, oldR);
    loadRoom(room); paintAll();
  }
  function paintAll() {
    Object.keys(panels).forEach(r => {
      const p = panels[r];
      const rm = S.role === "landlord" ? (S.rooms[r] || {}) : TD, ctrl = rm.ctrl || {}, live = rm.live || {};
      const bal = num(firstValue(live, KEYS.bal)), loaded = num(ctrl.loaded);
      p.g.set(bal, loaded);
      p.pl.replaceChildren(pills(ctrl, live));
      p.phone.v.textContent = PH[r] || "Not set";
      const tc = num(live.totalConsumed);
      const used = tc !== null ? tc : (bal !== null && loaded !== null ? Math.max(0, loaded - bal) : null);
      p.used = used;
      p.tot.v.textContent = used === null ? "— kWh" : used.toFixed(3) + " kWh";
      p.tot.s.textContent = used !== null && S.rate > 0 ? "≈ " + peso(used * S.rate) : "";
      p.rdb.replaceChildren(readings(live));
      if (p.rows && p.lastUsed !== used) { p.lastUsed = used; draw(p, false); }
    });
  }

  /* ---------------- Reset unused load (landlord) ---------------- */
  async function resetLoad(r) {
    const rm = S.rooms[r] || {}, loaded = num((rm.ctrl || {}).loaded), tc = num((rm.live || {}).totalConsumed);
    if (loaded === null || tc === null) return toast("Device data is not available yet.", true);
    const unused = loaded - tc;
    if (unused <= ZERO_KWH) return toast(rname(r) + " has no unused load to reset.");
    if (!confirm("Reset " + rname(r) + "?\n\nThe unused balance (" + unused.toFixed(3) + " kWh) will be removed and the power will be cut.\nTotal consumption and the graph are NOT changed.")) return;
    try {
      const res = await db.ref("rooms/" + r + "/ctrl/loaded").transaction(() => {
        const t = num(((S.rooms[r] || {}).live || {}).totalConsumed);
        return t === null ? undefined : Math.round(t * 1000) / 1000;
      });
      if (!res.committed) throw new Error("Reset not committed. Check Firebase Rules.");
      toast(rname(r) + ": " + unused.toFixed(3) + " kWh unused load removed.");
      try { await db.ref("resets/" + r).push({ kwh: Math.round(unused * 1000) / 1000, ts: TS(), by: S.user.email }); } catch (e) {}
    } catch (e) { toast("Reset failed: " + errMsg(e), true); }
  }

  /* ---------------- History: hiwalay kada room (landlord) ---------------- */
  const oRH = window.renderHistory;
  window.renderHistory = function () {
    if (S.role !== "landlord") return oRH.apply(this, arguments);
    const root = el("div");
    ROOMS.forEach(r => {
      const list = S.receipts.filter(x => x.room === r).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const c = el("div", "card"); c.append(el("h3", null, rname(r) + " · " + list.length + " transaction" + (list.length === 1 ? "" : "s")));
      if (!list.length) c.append(el("p", "muted", "No transactions yet."));
      else c.append(el("div", "muted", "Total loaded: " + list.reduce((a, x) => a + (Number(x.kwh) || 0), 0).toFixed(3) + " kWh · " + peso(list.reduce((a, x) => a + (Number(x.amount) || 0), 0))));
      list.forEach(x => {
        const it = el("div", "item");
        it.append(el("b", null, x.kwh + " kWh · " + peso(x.amount)), el("div", "muted", fdate(x.ts) + " · " + (x.method === "online" ? "Online" : "Manual")));
        it.onclick = () => showReceipt(x); c.append(it);
      });
      root.append(c);
    });
    $("v-history").replaceChildren(root);
  };

  /* ---------------- Data: windows, consumption ---------------- */
  function win(range, now) {
    const d = new Date(now), y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), b = [];
    let cur, labels;
    if (range === "24h") {
      const h = Math.floor(now / 36e5) * 36e5;
      for (let i = 0; i <= 24; i++) b.push(h - 23 * 36e5 + i * 36e5);
      cur = 23; labels = b.slice(0, 24).map(t => String(new Date(t).getHours()).padStart(2, "0"));
    } else if (range === "7d") {
      const dow = (d.getDay() + 6) % 7;
      for (let i = 0; i <= 7; i++) b.push(new Date(y, m, day - dow + i).getTime());
      cur = dow; labels = DAYS.slice();
    } else if (range === "12m") {
      for (let i = 0; i <= 12; i++) b.push(new Date(y, i, 1).getTime());
      cur = m; labels = MONTHS.slice();
    } else {
      const s = TEST_START, nd = Math.max(1, Math.round((new Date(y, m, day + 1) - s) / 864e5));
      for (let i = 0; i <= nd; i++) b.push(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i).getTime());
      cur = nd - 1;
      labels = b.slice(0, nd).map((t, i) => { const x = new Date(t); return (i === 0 || x.getDate() === 1) ? MONTHS[x.getMonth()] + " " + x.getDate() : String(x.getDate()); });
    }
    return { b, cur, labels, n: b.length - 1 };
  }
  // konsumo = diperensya ng 2 magkasunod na reading; ang malaking pagitan (offline) ay hinahati ayon sa oras
  function consume(rows, W) {
    const vals = Array(W.n).fill(0);
    for (let i = 1; i < rows.length; i++) {
      const t0 = rows[i - 1].ts, t1 = rows[i].ts, dt = (t1 - t0) / 36e5; if (!(dt > 0)) continue;
      let d = rows[i].kwh - rows[i - 1].kwh; if (d < 0) d = rows[i].kwh;     // nag-reset ang counter: bilangin mula 0
      if (!(d >= 0 && d <= MAXKW * dt + 0.05)) continue;                      // glitch
      for (let k = 0; k < W.n; k++) { const a = Math.max(t0, W.b[k]), z = Math.min(t1, W.b[k + 1]); if (z > a) vals[k] += d * (z - a) / (t1 - t0); }
    }
    return vals;
  }
  async function fetchRows(r, range) {
    const from = win(range, Date.now()).b[0] - 6 * 36e5, ref = db.ref("history/" + r); let snap;
    try { snap = await ref.orderByChild("ts").startAt(from).once("value"); }
    catch (e) { snap = await ref.limitToLast(range === "24h" || range === "7d" ? 1500 : 20000).once("value"); }
    return Object.values(snap.val() || {}).filter(x => x && num(x.ts) !== null && num(x.kwh) !== null)
      .map(x => ({ ts: Number(x.ts), kwh: Number(x.kwh), w: num(x.w ?? x.power), v: num(x.v ?? x.voltage), i: num(x.i ?? x.current), pf: num(x.pf) }))
      .sort((a, b) => a.ts - b.ts);
  }
  async function loadRoom(r) {
    const p = panels[r]; if (!p) return;
    const id = ++p.id, range = p.range;
    if (!p.rows) { p.msg.hidden = false; p.msg.className = "muted"; p.msg.textContent = "Loading…"; }
    try {
      const rows = await fetchRows(r, range);
      if (id !== p.id) return;
      p.rows = rows; p.W = win(range, Date.now()); p.vals = consume(rows, p.W);
      draw(p, !p.drawn); p.drawn = true;
    } catch (e) { if (id !== p.id) return; p.msg.hidden = false; p.msg.className = "error"; p.msg.textContent = "Cannot load history: " + errMsg(e); }
  }

  /* ---------------- Bar graph ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  function sv(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("width", w); s.setAttribute("height", h); s.style.display = "block"; return s; }
  function add(s, t, a, x) { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (x !== undefined) n.textContent = x; s.append(n); return n; }

  function draw(p, force) {
    if (!p.rows || !p.vals) return;
    p.cl.textContent = "Consumption · " + RN[p.range];
    if (p.rows.length < 2) {
      p.cv.textContent = "0.000 kWh"; p.cs.textContent = ""; p.cn.textContent = ""; p.chart.hidden = true;
      p.msg.hidden = false; p.msg.className = "muted"; p.msg.textContent = "No history yet. The central ESP32 saves a reading every 10 minutes."; return;
    }
    p.chart.hidden = false; p.msg.hidden = true;
    const vw = p.scroll.clientWidth;
    if (vw <= 0) { if (force) p.needReset = true; return; }
    const reset = force || p.needReset; p.needReset = false;

    let vals = p.vals.slice(), labels = p.W.labels.slice(), nowI = p.W.cur, gray = -1;
    const hist = vals.reduce((a, b) => a + b, 0), miss = p.used != null ? p.used - hist : 0;
    let note = "History since " + new Date(p.rows[0].ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " · " + p.rows.length + " readings";
    if (miss > 0.05) {
      if (p.range === "test") { vals.unshift(miss); labels.unshift("No log"); gray = 0; nowI++; note += " · gray bar = " + miss.toFixed(3) + " kWh with no history log"; }
      else if (p.range === "12m") note += " · not in history: " + miss.toFixed(3) + " kWh";
    }
    const n = vals.length, total = vals.reduce((a, b) => a + b, 0), mx = Math.max(...vals, 0), hi = vals.indexOf(mx);
    p.cv.textContent = total.toFixed(3) + " kWh";
    p.cs.textContent = (S.rate > 0 ? "≈ " + peso(total * S.rate) + " · " : "") + (mx > 0 ? "Highest: " + labels[hi] + (p.range === "24h" ? ":00" : "") + " · " + mx.toFixed(3) + " kWh" : "No usage yet");
    p.cn.textContent = note;

    const peak = mx, step = NICE.find(s => peak / s <= 5) || 1000, k = Math.max(Math.ceil(peak / step - 1e-9), 1), top = k * step;
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
    vals.forEach((v, i) => {
      const h = ph * v / top, x = i * bw + bw * .15, w = bw * .7, cx = i * bw + bw / 2;
      add(cs, "rect", { x, y: pt + ph - h, width: w, height: Math.max(0, h), rx: 3, style: "fill:" + (i === gray ? "var(--mut)" : i === nowI ? "var(--green)" : "var(--blue)") });
      if (v > 0) add(cs, "text", { x: cx, y: pt + ph - h - 4, "text-anchor": "middle", "font-size": 10, "font-weight": "bold", style: "fill:currentColor" }, v.toFixed(v >= 10 ? 1 : 2));
      add(cs, "text", { x: cx, y: GH - 6, "text-anchor": "middle", "font-size": 10, style: "fill:currentColor;opacity:.8" }, labels[i]);
    });
    const keep = p.scroll.scrollLeft;
    p.axis.replaceChildren(ax); p.scroll.replaceChildren(cs);
    p.scroll.scrollLeft = reset ? (p.range === "12m" ? Math.max(0, (nowI + 1) * bw - vw) : p.range === "7d" ? 0 : W) : keep;
  }

  /* ---------------- Sensor line graph (pindutin ang Electrical Readings) ---------------- */
  function sensorGraph(r) {
    const p = panels[r]; let range = p ? p.range : "24h", metric = "w", rows = [];
    const w = el("div"), body = el("div"), chips = el("div", "seg"), sel = el("select");
    Object.entries(RN).forEach(([k, l]) => { const o = el("option", null, l); o.value = k; sel.append(o); }); sel.value = range;
    const cl = el("button", "sec", "Close"); cl.onclick = closeModal;
    w.append(el("h3", null, "📈 Sensor graph · " + rname(r)), sel, chips, body, cl); openModal(w);

    async function load() {
      body.replaceChildren(el("p", "muted", "Loading…"));
      try { rows = await fetchRows(r, range); } catch (e) { body.replaceChildren(el("p", "error", "Cannot load history: " + errMsg(e))); return; }
      show();
    }
    function show() {
      const have = MET.filter(m => rows.some(x => x[m[0]] != null));
      if (!have.length) { chips.replaceChildren(); body.replaceChildren(el("p", "muted", "No sensor data saved in history yet.")); return; }
      if (!have.some(m => m[0] === metric)) metric = have[0][0];
      chips.replaceChildren(...have.map(m => { const b = el("button", m[0] === metric ? "on-b" : "", m[1]); b.type = "button"; b.onclick = () => { metric = m[0]; show(); }; return b; }));
      const m = have.find(x => x[0] === metric), W = win(range, Date.now());
      const sum = Array(W.n).fill(0), cnt = Array(W.n).fill(0);
      rows.forEach(x => { const v = x[metric]; if (v == null) return; for (let k = 0; k < W.n; k++) if (x.ts >= W.b[k] && x.ts < W.b[k + 1]) { sum[k] += v; cnt[k]++; break; } });
      const pts = sum.map((s, k) => cnt[k] ? s / cnt[k] : null), vs = pts.filter(v => v != null);
      if (!vs.length) { body.replaceChildren(el("p", "muted", "No data in this range.")); return; }
      const mn = Math.min(...vs), mx = Math.max(...vs), zero = metric === "w" || metric === "i";
      let lo, hi;
      if (zero) { lo = 0; hi = (mx || 1) * 1.15; } else { const pad = (mx - mn) * .25 || 1; lo = mn - pad; hi = mx + pad; }
      const Wd = 340, H = 200, pl = 46, pr = 8, pt = 12, pb = 24, n = W.n;
      const X = k => pl + (k + .5) * (Wd - pl - pr) / n, Y = v => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
      const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 " + Wd + " " + H); s.style.cssText = "width:100%;display:block;color:var(--text);margin-top:8px";
      for (let i = 0; i <= 4; i++) {
        const v = lo + (hi - lo) * i / 4, y = Y(v);
        add(s, "line", { x1: pl, x2: Wd - pr, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:.15" });
        add(s, "text", { x: pl - 4, y: y + 3, "text-anchor": "end", "font-size": 9, style: "fill:currentColor" }, v.toFixed(m[3]));
      }
      const every = Math.ceil(n / 8);
      W.labels.forEach((l, k) => { if (k % every === 0) add(s, "text", { x: X(k), y: H - 8, "text-anchor": "middle", "font-size": 9, style: "fill:currentColor;opacity:.8" }, l); });
      let d = "", pen = false;
      pts.forEach((v, k) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + X(k).toFixed(1) + " " + Y(v).toFixed(1); pen = true; });
      add(s, "path", { d, fill: "none", "stroke-width": 2, "stroke-linejoin": "round", style: "stroke:var(--blue)" });
      if (n <= 24) pts.forEach((v, k) => { if (v != null) add(s, "circle", { cx: X(k), cy: Y(v), r: 2.5, style: "fill:var(--blue)" }); });
      add(s, "text", { x: 2, y: 9, "font-size": 9, style: "fill:currentColor;opacity:.7" }, m[2]);
      const g = el("div", "grid2"); g.style.marginTop = "8px";
      const u = " " + m[2], avg = vs.reduce((a, b) => a + b, 0) / vs.length;
      g.append(stat("Average", avg.toFixed(m[3]) + u), stat("Highest", mx.toFixed(m[3]) + u), stat("Lowest", mn.toFixed(m[3]) + u), stat("Points", String(vs.length)));
      body.replaceChildren(el("div", "muted", m[1] + " · average per " + (range === "24h" ? "hour" : range === "12m" ? "month" : "day")), s, g);
    }
    sel.onchange = () => { range = sel.value; load(); };
    load();
  }
})();
