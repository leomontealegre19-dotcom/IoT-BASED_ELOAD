/* extras.js (v2) - SMS button, consumption graph, low-balance alerts,
 * DEVICE ACTIVE fix, Graph tab, animated login screen.
 *
 * Isang line lang ang kailangan sa index.html, bago ang </body> (pagkatapos ng main script):
 *   <script src="extras.js"></script>
 * Ginagamit nito ang sariling functions/variables ng app (db, S, ROOMS, el, toast...).
 */
(function () {
  const COOL = 60000; // 1 minute between SMS per room (SMS costs load)
  const sentAt = {};

  /* =====================================================================
   *  1. DEVICE ACTIVE / INACTIVE FIX
   *  - Dating 30 s lang ang tolerance; ngayon 2 minuto.
   *  - Ginagamit ang oras ng Firebase server (hindi ng phone) kaya hindi
   *    na naaapektuhan kapag mali ang oras ng phone.
   *  - Ang timer sa index.html (kada 15 s) ang nagre-repaint, kaya kusang nag-INACTIVE kapag patay.
   * ===================================================================== */
  const ACTIVE_MS = 120000;
  let serverOffset = 0, offsetBound = false;

  function bindOffset() {
    if (offsetBound) return;
    try {
      db.ref(".info/serverTimeOffset").on("value", s => { serverOffset = Number(s.val()) || 0; });
      offsetBound = true;
    } catch (e) {}
  }

  window.pills = function (ctrl, live) {
    ctrl = ctrl || {};
    const d = el("div"), cut = ctrl.cutoff;
    const ts = num(live && live.ts), raw = firstValue(live, KEYS.st);
    const act = ts !== null ? (Date.now() + serverOffset - ts) < ACTIVE_MS : (raw === null ? null : isActive(raw));
    d.append(
      el("span", "pill " + (cut === true ? "r" : cut === false ? "g" : ""), cut === true ? "POWER OFF (Cutoff)" : cut === false ? "POWER ON" : "POWER UNKNOWN"),
      el("span", "pill " + (act === null ? "" : act ? "g" : "r"), act === null ? "DEVICE UNKNOWN" : act ? "DEVICE ACTIVE" : "DEVICE INACTIVE"));
    return d;
  };

  // (Ang index.html ay may sarili nang timer na nagre-repaint ng pills kada 15 s,
  //  kaya hindi na kailangan ng isa pa rito.)

  /* ---------- Send SMS notification (landlord: any room, tenant: own room) ---------- */
  async function sendNotify(room, btn) {
    const left = COOL - (Date.now() - (sentAt[room] || 0));
    if (left > 0) return toast("Wait " + Math.ceil(left / 1000) + " s before sending again.", true);
    if (!confirm("Send the current balance and device status by SMS to " + rname(room) + "'s registered number?")) return;
    sentAt[room] = Date.now(); btn.disabled = true;

    const ref = db.ref("commands/notify/" + room), st = ref.child("status");
    try { await ref.set({ status: "pending", ts: TS(), by: S.user.email }); }
    catch (e) { toast("Failed: " + errMsg(e), true); btn.disabled = false; return; }

    let finished = false;
    const h = st.on("value", async s => {
      const v = s.val();
      if (finished || (v !== "done" && v !== "failed")) return;
      finished = true; st.off("value", h); btn.disabled = false;
      if (v === "done") toast("📩 SMS sent to " + rname(room) + ".");
      else { const n = (await ref.child("note").once("value")).val(); toast("SMS not sent" + (n ? ": " + n : "."), true); }
    });
    setTimeout(() => {
      if (finished) return;
      finished = true; st.off("value", h); btn.disabled = false;
      toast("No reply from the central device. Check that it is powered and online.", true);
    }, 90000);
  }

  // landlord: a button on every room card
  const origRooms = window.renderRooms;
  window.renderRooms = function () {
    origRooms.apply(this, arguments);
    if (S.role !== "landlord") return;
    const box = document.getElementById("roomsBox"); if (!box) return;
    [...box.children].forEach((card, i) => {
      const r = ROOMS[i]; if (!r) return;
      const b = el("button", "sec", "📩 Send SMS notification");
      b.onclick = () => sendNotify(r, b); card.append(b);
    });
  };

  // tenant: a card on the dashboard
  const origTenant = window.initTenant;
  window.initTenant = function (room) {
    origTenant.apply(this, arguments);
    const c = el("div", "card");
    c.append(el("h3", null, "SMS Notification"),
      el("p", "muted", "Send your balance and device status to your registered mobile number. You can also text BALANCE, ON or OFF to the device."));
    const b = el("button", null, "📩 Send SMS notification");
    b.onclick = () => sendNotify(room, b); c.append(b);
    document.getElementById("v-home").append(c);
  };

  /* =====================================================================
   *  2. GRAPH TAB (pinalitan ang Profile tab; nasa Menu pa rin ang Profile)
   * ===================================================================== */
  const view = document.createElement("div");
  view.id = "v-charts"; view.className = "view"; view.hidden = true;
  document.getElementById("app").append(view);

  const origShow = window.showView;
  window.showView = function (name) { origShow.apply(this, arguments); if (name === "charts") buildCharts(); };

  (function swapTab() {
    const t = document.querySelector('#tabs button[data-tab="profile"]');
    if (!t) return;
    t.dataset.tab = "charts";
    t.innerHTML = "<span>📊</span>Graph";
  })();

  const RANGES = {
    "24h": "Last 24 hours (every 1 hour)",
    "7d": "This week (Mon – Sun)",
    "12m": "This year (Jan – Dec)"
  };
  const STEPS = { "24h": 0.5, "7d": 1, "12m": 10 };   // kWh kada guhit sa gilid
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function windowOf(range, now) {
    if (range === "24h") {
      const nowH = Math.floor(now / 3600000);
      return { start: (nowH - 23) * 3600000, end: (nowH + 1) * 3600000, n: 24 };
    }
    if (range === "7d") {
      const d = new Date(now); d.setHours(0, 0, 0, 0);
      const dow = (d.getDay() + 6) % 7;                       // Monday = 0
      const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
      return { start: new Date(y, m, day - dow).getTime(), end: new Date(y, m, day - dow + 7).getTime(), n: 7, dow };
    }
    const y = new Date(now).getFullYear();
    return { start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime(), n: 12, month: new Date(now).getMonth() };
  }

  function bucketIndex(range, w, t) {
    if (t < w.start || t >= w.end) return -1;
    if (range === "24h") return Math.floor(t / 3600000) - Math.floor(w.start / 3600000);
    if (range === "7d") return (new Date(t).getDay() + 6) % 7;
    return new Date(t).getMonth();
  }

  function hourText(h) { return new Date(h * 3600000).toLocaleTimeString([], { hour: "numeric" }); }

  // rows: [{ts, kwh}] (PZEM cumulative energy). Ang konsumo = difference ng dalawang magkasunod na reading.
  function computeBuckets(rows, range, now) {
    rows = rows.slice().sort((a, b) => a.ts - b.ts);
    const w = windowOf(range, now), vals = Array(w.n).fill(0);
    for (let i = 1; i < rows.length; i++) {
      const d = rows[i].kwh - rows[i - 1].kwh;        // ignores counter resets / glitches
      if (!(d >= 0 && d <= 5)) continue;
      const k = bucketIndex(range, w, rows[i].ts);
      if (k >= 0) vals[k] += d;
    }
    const startH = Math.floor(w.start / 3600000);
    const labels = range === "24h" ? vals.map((_, i) => String(new Date((startH + i) * 3600000).getHours()).padStart(2, "0"))
      : range === "7d" ? DAYS.slice() : MONTHS.slice();
    const total = vals.reduce((a, b) => a + b, 0), mx = Math.max(...vals), hi = vals.indexOf(mx);
    let stats;
    if (range === "24h") {
      stats = [["Average per hour", (total / 24).toFixed(3) + " kWh"],
        ["Peak hour", mx > 0 ? hourText(startH + hi) + " · " + mx.toFixed(3) + " kWh" : "—"]];
    } else if (range === "7d") {
      stats = [["Daily average", (total / (w.dow + 1)).toFixed(3) + " kWh"],
        ["Highest day", mx > 0 ? DAYS[hi] + " · " + mx.toFixed(3) + " kWh" : "—"]];
    } else {
      stats = [["Monthly average", (total / (w.month + 1)).toFixed(3) + " kWh"],
        ["Highest month", mx > 0 ? MONTHS[hi] + " · " + mx.toFixed(3) + " kWh" : "—"]];
    }
    return { w, vals, labels, total, stats, step: STEPS[range], title: { "24h": "kWh per hour", "7d": "kWh per day", "12m": "kWh per month" }[range] };
  }
  window.__eloadBuckets = computeBuckets;   // for testing

  function bars(labels, vals, step, showVals) {
    const NS = "http://www.w3.org/2000/svg", W = 340, H = 210, pl = 40, pr = 6, pb = 24, pt = 16;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.style.cssText = "width:100%;display:block";
    const add = (tag, a, t) => {
      const n = document.createElementNS(NS, tag);
      for (const k in a) n.setAttribute(k, a[k]);
      if (t !== undefined) n.textContent = t; svg.append(n); return n;
    };
    const maxV = Math.max(...vals, 0);
    const n = Math.max(Math.ceil(maxV / step - 1e-9), 2), top = n * step;   // laging may kahit 2 guhit
    const every = Math.ceil(n / 8), dec = step < 1 ? 1 : 0;
    for (let i = 0; i <= n; i++) {
      const y = pt + (H - pt - pb) * (1 - i / n);
      add("line", { x1: pl, x2: W - pr, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:.15" });
      if (i % every === 0) add("text", { x: pl - 4, y: y + 3, "text-anchor": "end", "font-size": 9, style: "fill:currentColor" }, (i * step).toFixed(dec));
    }
    const bw = (W - pl - pr) / vals.length;
    vals.forEach((v, i) => {
      const h = (H - pt - pb) * v / top, x = pl + i * bw + 2;
      add("rect", { x, y: H - pb - h, width: Math.max(1, bw - 4), height: Math.max(0, h), rx: 2, style: "fill:var(--blue)" });
      if (showVals && v > 0) add("text", { x: x + (bw - 4) / 2, y: H - pb - h - 3, "text-anchor": "middle", "font-size": 8, style: "fill:currentColor" }, v.toFixed(2));
      add("text", { x: x + (bw - 4) / 2, y: H - 8, "text-anchor": "middle", "font-size": vals.length > 12 ? 8 : 9, style: "fill:currentColor" }, labels[i]);
    });
    add("text", { x: 2, y: 9, "font-size": 9, style: "fill:currentColor;opacity:.7" }, "kWh");
    return svg;
  }

  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name;
    document.body.append(a); a.click(); a.remove();
  }

  async function fetchRows(room, from, range) {
    const ref = db.ref("history/" + room);
    let snap;
    try { snap = await ref.orderByChild("ts").startAt(from).once("value"); }
    catch (e) { snap = await ref.limitToLast(range === "12m" ? 20000 : 1500).once("value"); }
    return Object.values(snap.val() || {}).filter(r => r && num(r.ts) !== null && num(r.kwh) !== null)
      .map(r => ({ ts: Number(r.ts), kwh: Number(r.kwh), w: r.w, bal: r.bal })).sort((a, b) => a.ts - b.ts);
  }

  let buildId = 0;
  async function buildCharts() {
    const my = ++buildId;
    const isL = S.role === "landlord";
    const room = isL ? (view.dataset.room || ROOMS[0]) : S.room;
    const range = view.dataset.range || "24h";

    const card = el("div", "card");
    card.append(el("h3", null, "📊 Consumption"));
    const row = el("div", isL ? "grid2" : null);
    if (isL) {
      const sel = el("select");
      ROOMS.forEach(r => { const o = el("option", null, rname(r)); o.value = r; sel.append(o); });
      sel.value = room; sel.onchange = () => { view.dataset.room = sel.value; buildCharts(); };
      row.append(sel);
    }
    const rs = el("select");
    Object.entries(RANGES).forEach(([v, l]) => { const o = el("option", null, l); o.value = v; rs.append(o); });
    rs.value = range; rs.onchange = () => { view.dataset.range = rs.value; buildCharts(); };
    row.append(rs); card.append(row);
    view.replaceChildren(card);

    const msg = el("p", "muted", "Loading…"); card.append(msg);

    const now = Date.now(), w = windowOf(range, now);
    let rows;
    try { rows = await fetchRows(room, w.start - 6 * 3600000, range); }
    catch (e) { if (my !== buildId) return; msg.className = "error"; msg.textContent = "Cannot load history: " + errMsg(e); return; }
    if (my !== buildId) return;

    if (rows.length < 2) { msg.textContent = "No history yet. The central ESP32 saves a reading every 10 minutes."; return; }
    msg.remove();

    const r = computeBuckets(rows, range, now);

    // TOTAL CONSUMPTION sa itaas ng graph
    const top = el("div", "comp");
    top.append(el("div", "muted", "Total consumption · " + rname(room) + " · " + RANGES[range]));
    const big = el("div", "total", r.total.toFixed(3) + " kWh"); big.style.fontSize = "30px";
    top.append(big);
    if (S.rate > 0) top.append(el("div", "muted", "≈ " + peso(r.total * S.rate) + " at " + peso(S.rate) + " per kWh"));
    card.append(top);

    card.append(el("div", "muted", r.title + " · guhit tuwing " + r.step + " kWh"),
      bars(r.labels, r.vals, r.step, range !== "24h"));

    const g = el("div", "grid2"); g.style.marginTop = "10px";
    r.stats.forEach(([l, v]) => g.append(stat(l, v))); card.append(g);

    const inRange = rows.filter(x => x.ts >= w.start && x.ts < w.end);
    const dl = el("button", "sec", "⬇️ Download data (CSV)");
    dl.onclick = () => download(room + "_consumption.csv",
      "time,total_kwh,power_w,balance_kwh\n" + inRange.map(x => [new Date(x.ts).toLocaleString("sv-SE"), x.kwh, x.w ?? "", x.bal ?? ""].join(",")).join("\n"));
    card.append(dl, el("p", "muted", "Each bar is the energy measured by the PZEM between saved readings (one reading every 10 minutes)."));
  }

  /* ---------- Editable low-balance levels (SMS + in-app alerts) ---------- */
  const DEF = { warn1: 2, warn2: 1 };
  let cfg = {}, cfgReady = false, bal = {}, lv = {}, mine = [];

  function levelsOf(r) {
    const c = cfg[r] || {}, w1 = num(c.warn1), w2 = num(c.warn2);
    return (w1 !== null && w2 !== null && w2 > 0 && w1 > w2) ? { warn1: w1, warn2: w2 } : DEF;
  }

  function lowCard() {
    const list = Object.keys(lv).filter(r => lv[r] > 0 && bal[r] > ZERO_KWH);
    if (!list.length) return null;
    const c = el("div", "alert");
    c.append(el("b", null, "⚠️ Low balance"));
    list.forEach(r => c.append(el("div", null, rname(r) + ": " + bal[r].toFixed(3) + " kWh left" + (lv[r] === 2 ? " — WARNING, top up now" : ""))));
    if (S.role === "tenant") { const b = el("button", null, "➕ Request Load"); b.onclick = () => loadFlow("tenant"); c.append(b); }
    return c;
  }

  function paintLow() {
    const box = document.getElementById("lowBox");
    if (box) { const c = lowCard(); box.replaceChildren(...(c ? [c] : [])); }
    if (!document.getElementById("v-notifs").hidden) renderNotifs();
  }

  function check(r) {
    const b = bal[r]; if (!cfgReady || b === null || b === undefined) return;
    const c = levelsOf(r);
    if (b > c.warn1 + 0.05) lv[r] = 0;                          // topped up: re-arm
    else if (b > c.warn2 + 0.05 && lv[r] === 2) lv[r] = 1;
    const want = b <= c.warn2 ? 2 : b <= c.warn1 ? 1 : 0;
    if (lv[r] === undefined) lv[r] = want;                      // first value: no alert, just remember
    else if (want > lv[r]) {
      lv[r] = want;
      const t = want === 2 ? "🚨 WARNING: very low balance" : "⚠️ Low balance";
      const m = rname(r) + " has " + b.toFixed(3) + " kWh left (" + (want === 2 ? c.warn2 : c.warn1) + " kWh or less).";
      toast(t + ". " + m, true); notify(t, m, "low-" + r + "-" + want);
    }
    paintLow();
  }

  function startLow() {
    cfg = {}; cfgReady = false; bal = {}; lv = {};
    const rs = S.role === "landlord" ? ROOMS : [S.room];
    const add = (ref, cb) => { const h = s => cb(s.val()); ref.on("value", h, () => {}); mine.push([ref, h]); };
    add(db.ref("settings/sms"), v => { cfg = v || {}; cfgReady = true; rs.forEach(check); });
    rs.forEach(r => add(db.ref("rooms/" + r + "/live/balance"), v => { bal[r] = num(v); check(r); }));
  }

  const origStop = window.stopListeners;
  window.stopListeners = function () { origStop.apply(this, arguments); mine.forEach(([ref, h]) => ref.off("value", h)); mine = []; };

  const origStart = window.startDashboard;
  window.startDashboard = function () { origStart.apply(this, arguments); if (S.role) { startLow(); bindOffset(); } };

  function addLowBox() { const b = el("div"); b.id = "lowBox"; document.getElementById("v-home").prepend(b); }

  const origLand = window.initLandlord;
  window.initLandlord = function () { origLand.apply(this, arguments); addLowBox(); };

  const origTen2 = window.initTenant;   // wraps the SMS-card version above
  window.initTenant = function () { origTen2.apply(this, arguments); addLowBox(); };

  const origNotifs = window.renderNotifs;
  window.renderNotifs = function () {
    origNotifs.apply(this, arguments);
    const c = lowCard(), root = document.getElementById("v-notifs").firstChild;
    if (c && root) root.insertBefore(c, root.children[1] || null);
  };

  // Settings card: landlord edits, tenant sees own levels (read-only)
  const origSettings = window.buildSettings;
  window.buildSettings = function () {
    origSettings.apply(this, arguments);
    const isL = S.role === "landlord", rs = isL ? ROOMS : [S.room], inputs = {};
    const c = el("div", "card");
    c.append(el("h3", null, "Low-Balance Alerts"),
      el("div", "muted", "Used for BOTH the SMS to the tenant and the alert inside the app. Left box = 1st alert (kWh), right box = 2nd warning (kWh)."));
    rs.forEach(r => {
      const l = levelsOf(r), g = el("div", "grid2"), a = el("input"), b = el("input");
      [a, b].forEach((x, i) => { x.type = "number"; x.min = "0"; x.step = "0.1"; x.inputMode = "decimal"; x.value = i ? l.warn2 : l.warn1; x.disabled = !isL; });
      inputs[r] = [a, b]; g.append(a, b);
      c.append(el("b", null, rname(r)), g);
    });
    if (isL) {
      const sv = el("button", null, "Save Alert Levels");
      sv.onclick = async () => {
        const out = {};
        for (const r of ROOMS) {
          const w1 = parseFloat(inputs[r][0].value), w2 = parseFloat(inputs[r][1].value);
          if (!(w2 > 0 && w1 > w2 && w1 <= 100)) return toast(rname(r) + ": the 2nd warning must be above 0 and lower than the 1st alert.", true);
          out[r] = { warn1: w1, warn2: w2 };
        }
        sv.disabled = true;
        try { await db.ref("settings/sms").set(out); toast("Alert levels saved. The central device applies them within 1 minute."); }
        catch (e) { toast("Save failed: " + errMsg(e), true); }
        sv.disabled = false;
      };
      c.append(sv, el("p", "muted", "Example: 2 and 1 = 1st SMS at 2 kWh, 2nd WARNING at 1 kWh."));
    }
    document.getElementById("v-settings").append(c);
  };

  /* =====================================================================
   *  3. LOGIN SCREEN: nasa gitna + animated na background (circuit, bolts, bahay)
   * ===================================================================== */
  (function loginScreen() {
    const lp = document.getElementById("loginPanel");
    if (!lp) return;

    const css = `
#loginBg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:radial-gradient(130% 100% at 15% 0%,#1d74e8 0%,#0b47a8 38%,#04245f 72%,#021340 100%)}
#loginBg .lg-svg{position:absolute;inset:0;width:100%;height:100%}
#loginBg .lg-static{stroke:#4fd8ff;stroke-opacity:.16;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
#loginBg .lg-flow{stroke:#7fe6ff;stroke-opacity:.75;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:6 22;animation:lgflow 2.4s linear infinite}
@keyframes lgflow{to{stroke-dashoffset:-56}}
#loginBg .lg-node{fill:#9be8ff;animation:lgpulse 2.6s ease-in-out infinite}
@keyframes lgpulse{0%,100%{opacity:.3}50%{opacity:1}}
#loginBg .lg-win{fill:#ffd54a;animation:lgflick 5s ease-in-out infinite}
#loginBg .lg-w2{animation-delay:-1.2s}#loginBg .lg-w3{animation-delay:-2.6s}#loginBg .lg-w4{animation-delay:-3.7s}
@keyframes lgflick{0%,100%{opacity:1}45%{opacity:.3}55%{opacity:.95}70%{opacity:.5}}
#loginBg .lg-bolt{position:absolute;bottom:-40px;width:18px;height:30px;fill:#ffd54a;opacity:0;animation:lgrise 9s linear infinite;filter:drop-shadow(0 0 6px #ffd54a99)}
@keyframes lgrise{0%{transform:translateY(0) rotate(-8deg);opacity:0}10%{opacity:.85}90%{opacity:.5}100%{transform:translateY(-110vh) rotate(8deg);opacity:0}}
body.login-mode{padding-bottom:0}
body.login-mode header{background:rgba(18,59,99,.55)}
body.login-mode main{min-height:calc(100vh - 80px);display:flex;align-items:center;justify-content:center}
body.login-mode #loginPanel{width:100%;max-width:400px;margin:0;padding:24px 22px;text-align:center;color:#fff;background:rgba(4,30,90,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.2);border-radius:24px;box-shadow:0 20px 50px rgba(0,10,40,.45)}
body.login-mode #loginPanel .muted{color:#cfe3ff}
body.login-mode #loginPanel .error{color:#ffb4b4}
body.login-mode #loginPanel .success{color:#8ff0c0}
body.login-mode #loginPanel input{text-align:left}
body.login-mode #loginPanel .lg-logo{width:76px;height:76px;border-radius:19px;display:block;margin:0 auto 10px;box-shadow:0 8px 24px rgba(0,0,0,.35),0 0 0 3px rgba(255,255,255,.18)}
@media (prefers-reduced-motion:reduce){#loginBg *{animation:none!important}#loginBg .lg-bolt{display:none}}`;
    const st = document.createElement("style"); st.textContent = css; document.head.append(st);

    const bg = document.createElement("div");
    bg.id = "loginBg"; bg.setAttribute("aria-hidden", "true");
    const bolt = (left, delay) => `<svg class="lg-bolt" style="left:${left}%;animation-delay:${delay}s" viewBox="0 0 12 22"><path d="M8 0L0 12h5L3 22l9-14H7z"/></svg>`;
    bg.innerHTML = `
<svg class="lg-svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice">
<defs><g id="lgCircuit">
<path d="M-10 120H70L100 150H180L210 120H300L330 90H410"/>
<path d="M-10 260H40L70 230H150V180H230"/>
<path d="M410 300H330L300 330H240V400H170"/>
<path d="M-10 470H90L120 500H200"/>
<path d="M410 520H320L290 490H230V430"/>
<path d="M60 -10V60L90 90V150"/>
<path d="M340 -10V40L310 70V120"/>
</g></defs>
<use href="#lgCircuit" class="lg-static"/>
<use href="#lgCircuit" class="lg-flow"/>
<g>
<circle class="lg-node" cx="100" cy="150" r="3.5"/><circle class="lg-node" cx="210" cy="120" r="3.5" style="animation-delay:.5s"/>
<circle class="lg-node" cx="330" cy="90" r="3.5" style="animation-delay:1s"/><circle class="lg-node" cx="70" cy="230" r="3.5" style="animation-delay:1.5s"/>
<circle class="lg-node" cx="300" cy="330" r="3.5" style="animation-delay:.8s"/><circle class="lg-node" cx="120" cy="500" r="3.5" style="animation-delay:1.9s"/>
<circle class="lg-node" cx="290" cy="490" r="3.5" style="animation-delay:.3s"/><circle class="lg-node" cx="90" cy="90" r="3.5" style="animation-delay:1.2s"/>
</g>
<g>
<polygon points="0,700 55,655 110,700" fill="#0b4aa0"/><rect x="10" y="700" width="90" height="100" fill="#06307a"/>
<rect class="lg-win lg-w1" x="28" y="724" width="16" height="18"/><rect class="lg-win lg-w3" x="66" y="724" width="16" height="18"/>
<polygon points="110,680 175,628 240,680" fill="#0b4aa0"/><rect x="205" y="640" width="14" height="28" fill="#0b4aa0"/>
<rect x="120" y="680" width="110" height="120" fill="#06307a"/>
<rect class="lg-win lg-w2" x="138" y="704" width="18" height="20"/><rect class="lg-win lg-w4" x="194" y="704" width="18" height="20"/>
<rect class="lg-win lg-w3" x="138" y="750" width="18" height="20"/><rect class="lg-win lg-w1" x="194" y="750" width="18" height="20"/>
<polygon points="235,710 285,668 335,710" fill="#0b4aa0"/><rect x="245" y="710" width="80" height="90" fill="#06307a"/>
<rect class="lg-win lg-w4" x="262" y="734" width="16" height="18"/><rect class="lg-win lg-w2" x="298" y="734" width="16" height="18"/>
<polygon points="332,690 375,648 418,690" fill="#0b4aa0"/><rect x="340" y="690" width="70" height="110" fill="#06307a"/>
<rect class="lg-win lg-w1" x="352" y="714" width="16" height="18"/><rect class="lg-win lg-w3" x="384" y="714" width="16" height="18"/>
</g>
</svg>` + bolt(12, 0) + bolt(30, 2.2) + bolt(52, 4.6) + bolt(71, 1.4) + bolt(88, 6);
    document.body.prepend(bg);

    // logo sa itaas ng login card
    if (!lp.querySelector(".lg-logo")) {
      const im = document.createElement("img");
      im.className = "lg-logo"; im.src = "icon-192.png"; im.alt = "";
      im.onerror = () => im.remove();
      lp.prepend(im);
    }

    function sync() {
      const on = !lp.hidden;
      document.body.classList.toggle("login-mode", on);
      bg.hidden = !on;
    }
    new MutationObserver(sync).observe(lp, { attributes: true, attributeFilter: ["hidden"] });
    sync();
  })();
})();
