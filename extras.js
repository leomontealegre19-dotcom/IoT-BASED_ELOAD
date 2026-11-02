/* extras.js - Send SMS notification button + consumption charts.
 * Add this ONE line right before </body> in index.html (after the main script):
 *   <script src="extras.js"></script>
 * It reuses the app's own functions and variables (db, S, ROOMS, el, toast...).
 */
(function () {
  const COOL = 60000;            // 1 minute between SMS per room (SMS costs load)
  const sentAt = {};

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

  /* ---------- Charts ---------- */
  const view = document.createElement("div");
  view.id = "v-charts"; view.className = "view"; view.hidden = true;
  document.getElementById("app").append(view);

  const origShow = window.showView;
  window.showView = function (name) { origShow.apply(this, arguments); if (name === "charts") buildCharts(); };

  const origMenu = window.openMenu;
  window.openMenu = function () {
    origMenu.apply(this, arguments);
    const b = document.getElementById("menuBody");
    const it = el("button", "menuitem", "📊 Consumption charts");
    it.onclick = () => showView("charts");
    b.insertBefore(it, b.children[1] || null);
  };
  const tm = document.getElementById("topMenu");   // the ☰ button kept the old function
  tm.removeEventListener("click", origMenu); tm.addEventListener("click", () => window.openMenu());

  function bars(labels, vals, digits) {
    const NS = "http://www.w3.org/2000/svg", W = 320, H = 170, pl = 38, pb = 22, pt = 10;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.style.cssText = "width:100%;display:block";
    const add = (tag, a, t) => {
      const n = document.createElementNS(NS, tag);
      for (const k in a) n.setAttribute(k, a[k]);
      if (t !== undefined) n.textContent = t; svg.append(n); return n;
    };
    const max = Math.max(...vals, 0.001) * 1.15, bw = (W - pl - 4) / vals.length;
    for (let i = 0; i <= 3; i++) {
      const y = pt + (H - pt - pb) * (1 - i / 3);
      add("line", { x1: pl, x2: W, y1: y, y2: y, style: "stroke:currentColor;stroke-opacity:.15" });
      add("text", { x: pl - 4, y: y + 3, "text-anchor": "end", "font-size": 9, style: "fill:currentColor" }, (max * i / 3).toFixed(digits));
    }
    vals.forEach((v, i) => {
      const h = (H - pt - pb) * v / max, x = pl + i * bw + 2;
      add("rect", { x, y: H - pb - h, width: Math.max(1, bw - 4), height: h, rx: 2, style: "fill:var(--blue)" });
      if (labels[i]) add("text", { x: x + (bw - 4) / 2, y: H - 8, "text-anchor": "middle", "font-size": 9, style: "fill:currentColor" }, labels[i]);
    });
    return svg;
  }

  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name;
    document.body.append(a); a.click(); a.remove();
  }

  async function buildCharts() {
    const isL = S.role === "landlord";
    const room = isL ? (view.dataset.room || ROOMS[0]) : S.room;
    const range = view.dataset.range || "7d";
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
    [["24h", "Last 24 hours"], ["7d", "Last 7 days"]].forEach(([v, l]) => { const o = el("option", null, l); o.value = v; rs.append(o); });
    rs.value = range; rs.onchange = () => { view.dataset.range = rs.value; buildCharts(); };
    row.append(rs); card.append(row);
    view.replaceChildren(card);

    const msg = el("p", "muted", "Loading…"); card.append(msg);
    let rows;
    try {
      const snap = await db.ref("history/" + room).limitToLast(1100).once("value");
      rows = Object.values(snap.val() || {}).filter(r => num(r.ts) !== null && num(r.kwh) !== null).sort((a, b) => a.ts - b.ts);
    } catch (e) { msg.className = "error"; msg.textContent = "Cannot load history: " + errMsg(e); return; }
    if (rows.length < 2) { msg.textContent = "No history yet. The central ESP32 saves a reading every 10 minutes."; return; }
    msg.remove();

    // energy used between two consecutive readings (ignores counter resets / glitches)
    const pts = [];
    for (let i = 1; i < rows.length; i++) {
      const d = rows[i].kwh - rows[i - 1].kwh;
      if (d >= 0 && d <= 5) pts.push({ t: rows[i].ts, d, w: num(rows[i].w) || 0 });
    }

    const now = Date.now(); let labels = [], vals = [], title, stats;
    if (range === "24h") {
      const nowH = Math.floor(now / 3600000);
      vals = Array(24).fill(0);
      labels = vals.map((_, i) => { const h = new Date((nowH - 23 + i) * 3600000).getHours(); return h % 3 === 0 ? String(h).padStart(2, "0") : ""; });
      pts.forEach(p => { const i = Math.floor(p.t / 3600000) - (nowH - 23); if (i >= 0 && i < 24) vals[i] += p.d; });
      title = "kWh per hour (last 24 hours)";
      const peak = vals.indexOf(Math.max(...vals));
      stats = [["Total", vals.reduce((a, b) => a + b, 0).toFixed(3) + " kWh"], ["Peak hour", Math.max(...vals) > 0 ? labelHour(nowH - 23 + peak) : "—"]];
    } else {
      const day0 = new Date().setHours(0, 0, 0, 0), names = [];
      vals = Array(7).fill(0);
      for (let i = 0; i < 7; i++) names.push(new Date(day0 - (6 - i) * 864e5).toLocaleDateString(undefined, { weekday: "short" }));
      labels = names;
      pts.forEach(p => { const i = 6 - Math.round((day0 - new Date(p.t).setHours(0, 0, 0, 0)) / 864e5); if (i >= 0 && i < 7) vals[i] += p.d; });
      title = "kWh per day (last 7 days)";
      const tot = vals.reduce((a, b) => a + b, 0), hi = vals.indexOf(Math.max(...vals));
      stats = [["Total", tot.toFixed(3) + " kWh"], ["Daily average", (tot / 7).toFixed(3) + " kWh"], ["Highest day", Math.max(...vals) > 0 ? names[hi] + " · " + vals[hi].toFixed(3) + " kWh" : "—"]];
    }
    card.append(el("div", "muted", rname(room) + " · " + title), bars(labels, vals, Math.max(...vals) < 1 ? 3 : 2));

    const g = el("div", "grid2"); g.style.marginTop = "10px";
    stats.forEach(([l, v]) => g.append(stat(l, v))); card.append(g);

    const dl = el("button", "sec", "⬇️ Download data (CSV)");
    dl.onclick = () => download(room + "_consumption.csv",
      "time,total_kwh,power_w,balance_kwh\n" + rows.map(r => [new Date(r.ts).toLocaleString("sv-SE"), r.kwh, r.w ?? "", r.bal ?? ""].join(",")).join("\n"));
    card.append(dl, el("p", "muted", "Each bar is the energy measured by the PZEM between saved readings (one reading every 10 minutes)."));
  }
  function labelHour(h) { const d = new Date(h * 3600000); return d.toLocaleTimeString([], { hour: "numeric" }); }

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
    if (lv[r] === undefined) lv[r] = want;                       // first value: no alert, just remember
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
  window.startDashboard = function () { origStart.apply(this, arguments); if (S.role) startLow(); };

  function addLowBox() { const b = el("div"); b.id = "lowBox"; document.getElementById("v-home").prepend(b); }
  const origLand = window.initLandlord;
  window.initLandlord = function () { origLand.apply(this, arguments); addLowBox(); };
  const origTen2 = window.initTenant;                            // wraps the SMS-card version above
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

})();
