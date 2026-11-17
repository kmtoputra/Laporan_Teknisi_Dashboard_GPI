(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const LS_THEME = "gpi_theme";
  const LS_GAS = "gpi.teknisi.gasUrl";
  const LS_AUTH = "gpi.teknisi.auth.v2";
  const DRAFT_KEY = "gpi.teknisi.draft.v4";
  const LAST_RS_KEY = "gpi.teknisi.lastrs.v2";
  const DEFAULT_GAS_URL = "";

  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  let AUTH = null;
  let state = { reports: null, metric: "purity", bulan: "", rs: "", teknisi: "",
                showAllDocs: false, showAllBooster: false };

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const monthOf = (iso) => (iso || "").slice(0, 7);
  function monthLabel(ym) {
    if (!ym) return "—";
    const [y, m] = ym.split("-");
    return `${MONTHS[Number(m) - 1] || m} ${y}`;
  }
  function daysInMonth(ym) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }
  const num = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  function fmt(n, dec) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "–";
    return n.toLocaleString("id-ID", { minimumFractionDigits: dec || 0, maximumFractionDigits: dec === undefined ? 1 : dec });
  }
  const esc = (s) => String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ROW_LIMIT = 15;

  function isLocalTestServerOrigin() {
    try {
      const h = location.hostname;
      return (location.protocol === "http:" || location.protocol === "https:") &&
        (h === "127.0.0.1" || h === "localhost" || h === "::1");
    } catch (e) { return false; }
  }
  let _localServerProbed = false;
  let _localServerOk = false;
  async function probeLocalServer() {
    if (_localServerProbed) return _localServerOk;
    _localServerProbed = true;
    if (!isLocalTestServerOrigin()) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(location.origin + "/exec", { method: "GET", signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      _localServerOk = !!(data && data.ok === true && "pong" in data);
    } catch (e) {
      _localServerOk = false;
    }
    return _localServerOk;
  }
  function getGasUrl() {
    let stored = null;
    try { stored = localStorage.getItem(LS_GAS); } catch (e) {}
    if (stored) return stored;
    if (_localServerOk) return location.origin + "/exec";
    return DEFAULT_GAS_URL;
  }
  function setGasUrl(url) {
    try {
      if (url) localStorage.setItem(LS_GAS, url);
      else localStorage.removeItem(LS_GAS);
    } catch (e) {}
  }

  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  const GAS_RETRY_ATTEMPTS = 3;
  const GAS_RETRY_DELAY_MS = 900;

  async function gasFetchOnce(url, payload) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return { ok: false, code: "network_error", message: "Tidak dapat menghubungi server. Periksa koneksi internet Anda, atau hubungi Admin bila masalah berlanjut." };
    }
    let data;
    try { data = await res.json(); } catch (err) {
      return { ok: false, code: "bad_response", message: `Respons backend tidak valid (bukan JSON) dari ${url}. Kemungkinan backend belum di-deploy ulang, atau URL backend yang tersimpan salah.` };
    }
    return data;
  }

  async function gasFetch(payload) {
    const url = getGasUrl();
    let last;
    for (let attempt = 1; attempt <= GAS_RETRY_ATTEMPTS; attempt++) {
      last = await gasFetchOnce(url, payload);
      if (last.code !== "network_error" && last.code !== "bad_response") return last;
      if (attempt < GAS_RETRY_ATTEMPTS) await sleep(GAS_RETRY_DELAY_MS * attempt);
    }
    return last;
  }
  function authedFetch(type, extra) {
    return gasFetch(Object.assign({ type: type, token: AUTH ? AUTH.token : "" }, extra || {}));
  }

  function saveAuth(a) {
    AUTH = a;
    try { localStorage.setItem(LS_AUTH, JSON.stringify(a)); } catch (e) {}
  }
  function loadAuth() {
    try { return JSON.parse(localStorage.getItem(LS_AUTH) || "null"); } catch (e) { return null; }
  }
  function clearAuth() {
    AUTH = null;
    try { localStorage.removeItem(LS_AUTH); } catch (e) {}
  }
  function currentRole() { return AUTH ? AUTH.role : ""; }
  function isAdmin() { return currentRole() === "admin"; }
  function isTeknisi() { return currentRole() === "teknisi"; }
  function isRs() { return currentRole() === "rs"; }
  function canSeeAllReports() { return isAdmin() || isTeknisi(); }

  const ROLE_LABEL = { admin: "ADMIN", teknisi: "TEKNISI", rs: "RUMAH SAKIT", logistik: "LOGISTIK" };
  function rolePillClass(role) { return ["admin", "teknisi", "rs", "logistik"].indexOf(role) !== -1 ? role : "teknisi"; }
  function isLogistik() { return currentRole() === "logistik"; }

  function applyRoleVisibility() {
    const role = currentRole();
    const admin = isAdmin(), teknisi = isTeknisi(), staff = canSeeAllReports();
    $$(".admin-only").forEach((el) => el.classList.toggle("hidden", !admin));
    $$(".teknisi-only").forEach((el) => el.classList.toggle("hidden", !teknisi));
    $$(".rs-only").forEach((el) => el.classList.toggle("hidden", !isRs()));
    $$(".staff-only").forEach((el) => el.classList.toggle("hidden", !staff));
    $("#userName").textContent = AUTH.name || AUTH.username;
    const roleEl = $("#userRole");
    roleEl.textContent = ROLE_LABEL[role] || String(role).toUpperCase();
    roleEl.classList.remove("admin", "teknisi", "rs");
    roleEl.classList.add(role);
    $("#tabReportLabel").textContent = staff ? "Monitoring" : "Riwayat Saya";
    $("#reportPageTitle").textContent = staff ? "Monitoring Rumah Sakit" : "Riwayat Saya";
    $("#reportPageDesc").textContent = staff
      ? "Pantau seluruh laporan & kepatuhan rumah sakit."
      : "Rekap laporan yang sudah dikirim rumah sakit ini.";
    if (isRs()) {
      const sel = $("#operator_nama");
      sel.innerHTML = `<option value="">Pilih nama Anda…</option>` +
        (AUTH.operators || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
      $("#nama_rs").value = AUTH.nama_rs || "";
      $("#daerah_rs").value = AUTH.daerah_rs || "";
      $("#filterRsPlain").value = AUTH.nama_rs || "";
    }
  }

  function toast(msg, kind, opts) {
    opts = opts || {};
    const host = $("#toastHost");
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    const icon = kind === "ok" ? "✓" : kind === "err" ? "✕" : kind === "warn" ? "!" : "i";
    el.innerHTML = `<span class="ic">${icon}</span><span class="msg">${esc(msg)}</span>`;
    if (opts.actionLabel) {
      const wrap = document.createElement("span");
      wrap.className = "actions";
      const b = document.createElement("button");
      b.type = "button"; b.textContent = opts.actionLabel;
      b.onclick = () => { close(); opts.onAction && opts.onAction(); };
      wrap.appendChild(b);
      if (opts.dismissLabel) {
        const d = document.createElement("button");
        d.type = "button"; d.textContent = opts.dismissLabel; d.onclick = close;
        wrap.appendChild(d);
      }
      el.appendChild(wrap);
    }
    host.appendChild(el);
    let timer = null;
    function close() { if (timer) clearTimeout(timer); el.classList.add("out"); setTimeout(() => el.remove(), 300); }
    if (!opts.sticky) timer = setTimeout(close, opts.duration || 4200);
    return close;
  }

  function openModal(id) { $("#" + id).classList.add("show"); }
  function closeModal(id) { $("#" + id).classList.remove("show"); }

  function setBtnBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      if (btn.dataset.origHtml === undefined) btn.dataset.origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span>${esc(busyText || btn.textContent)}</span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.origHtml !== undefined) { btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; }
    }
  }

  function setReloadBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = busy;
    const icon = btn.querySelector(".reload-icon");
    if (icon) icon.classList.toggle("spin", busy);
    const label = btn.querySelector(".reload-label");
    if (label) {
      if (busy) {
        if (label.dataset.orig === undefined) label.dataset.orig = label.textContent;
        label.textContent = "Memuat…";
      } else if (label.dataset.orig !== undefined) {
        label.textContent = label.dataset.orig;
        delete label.dataset.orig;
      }
    }
  }
  const RELOAD_MIN_VISIBLE_MS = 500;
  function wireReloadBtn(id, fn) {
    const btn = $(id);
    if (!btn) return;
    btn.addEventListener("click", async () => {
      setReloadBusy(btn, true);
      const startedAt = Date.now();
      try {
        await fn();
        const elapsed = Date.now() - startedAt;
        if (elapsed < RELOAD_MIN_VISIBLE_MS) await sleep(RELOAD_MIN_VISIBLE_MS - elapsed);
        setReloadBusy(btn, false);
      } catch (err) {
        setReloadBusy(btn, false);
        throw err;
      }
    });
  }

  let _loadingRefCount = 0;
  let _loadingSafetyTimer = null;
  function _globalLoadingEl() { return document.getElementById("globalLoadingBadge"); }
  function _globalTopProgressEl() { return document.getElementById("globalTopProgress"); }
  function showLoading(_container) {
    _loadingRefCount++;
    const el = _globalLoadingEl();
    if (el) el.classList.add("show");
    const bar = _globalTopProgressEl();
    if (bar) bar.classList.add("show");
    if (_loadingSafetyTimer) clearTimeout(_loadingSafetyTimer);
    _loadingSafetyTimer = setTimeout(() => {
      _loadingRefCount = 0;
      _loadingSafetyTimer = null;
      const e = _globalLoadingEl();
      if (e) e.classList.remove("show");
      const b = _globalTopProgressEl();
      if (b) b.classList.remove("show");
    }, 20000);
  }
  function hideLoading(_container) {
    _loadingRefCount = Math.max(0, _loadingRefCount - 1);
    if (_loadingRefCount === 0) {
      if (_loadingSafetyTimer) { clearTimeout(_loadingSafetyTimer); _loadingSafetyTimer = null; }
      const el = _globalLoadingEl();
      if (el) el.classList.remove("show");
      const bar = _globalTopProgressEl();
      if (bar) bar.classList.remove("show");
    }
  }

  function showPage(id) {
    $$(".page").forEach((p) => p.classList.toggle("active", p.id === id));
    $$(".tab-btn").forEach((t) => t.classList.toggle("active", t.dataset.tab === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "page-report") loadReports();
    if (id === "page-bulanan") {
      loadSnapshots();
      if (!state.reports) loadReports();
    }
    if (id === "page-akun") loadAccounts();
    if (id === "page-rs") loadRumahSakit();
  }
  $$("#mainTabs .tab-btn").forEach((t) => t.addEventListener("click", () => showPage(t.dataset.tab)));

  function bindExpander(toggleId, expanderId) {
    const cb = $("#" + toggleId);
    const ex = $("#" + expanderId);
    const sync = () => ex.classList.toggle("open", cb.checked);
    cb.addEventListener("change", () => { sync(); saveDraft(); });
    sync();
    return cb;
  }
  const cbBooster = bindExpander("hasBooster", "boosterExpander");
  const cbWwz = bindExpander("hasWwz", "wwzExpander");
  const cbGow = bindExpander("hasGow", "gowExpander");

  const SHIFT_LABEL_FORM = { pagi: "Pagi", sore: "Sore", malam: "Malam" };
  async function refreshShiftLock() {
    if (!isRs()) return;
    const sel = $("#shift");
    const tanggal = $("#tanggal") ? $("#tanggal").value : "";
    if (!sel || !tanggal) return;
    const data = await authedFetch("getShiftsTaken", { tanggal });
    if (!data.ok) return;
    const taken = new Set((data.taken || []).map((s) => String(s).toLowerCase()));
    $$("option", sel).forEach((opt) => {
      const v = opt.value;
      if (!v) return;
      const isTaken = taken.has(v);
      opt.disabled = isTaken;
      const baseLabel = SHIFT_LABEL_FORM[v] || opt.textContent.replace(/\s*\(sudah dilaporkan\)\s*$/, "");
      opt.textContent = isTaken ? `${baseLabel} (sudah dilaporkan)` : baseLabel;
    });

  }
  $("#tanggal").addEventListener("change", () => { refreshShiftLock(); });

  const JAM_24H_RE = /^([01]\d|2[0-3])\.[0-5]\d$/;

  function collect() {
    const get = (n) => { const el = $(`[name="${n}"]`); return el ? el.value.trim() : ""; };
    const section = (prefix) => {
      const out = {};
      $$(`[name^="${prefix}."]`).forEach((el) => { out[el.name.slice(prefix.length + 1)] = el.value.trim(); });
      return out;
    };
    return {
      identitas: {
        nama_rs: get("identitas.nama_rs"), daerah_rs: get("identitas.daerah_rs"), tanggal: get("identitas.tanggal"),
        operator_nama: get("identitas.operator_nama"), shift: get("identitas.shift"), jam_lapor: get("identitas.jam_lapor"),
        catatan_operator: get("identitas.catatan_operator"),
      },
      docs: section("docs"),
      booster: {
        has: cbBooster.checked,
        has_wwz: cbBooster.checked && cbWwz.checked,
        has_gow: cbBooster.checked && cbGow.checked,
        wwz: section("wwz"),
        gow: section("gow"),
      },
    };
  }

  function clearErrors() {
    $$(".field.invalid").forEach((f) => { f.classList.remove("invalid"); const e = $(".err", f); if (e) e.textContent = ""; });
    const be = $("#boosterErr"); be.style.display = "none"; be.textContent = "";
    const se = $("#formSyncErr"); if (se) { se.style.display = "none"; se.innerHTML = ""; }
  }
  function ensureFieldVisible(key) {
    if (key.startsWith("wwz.")) { cbBooster.checked = true; cbWwz.checked = true; }
    else if (key.startsWith("gow.")) { cbBooster.checked = true; cbGow.checked = true; }
    else if (key === "booster._") { cbBooster.checked = true; }
    [["hasBooster", "boosterExpander"], ["hasWwz", "wwzExpander"], ["hasGow", "gowExpander"]]
      .forEach(([c, e]) => $("#" + e).classList.toggle("open", $("#" + c).checked));
  }
  function humanizeKey(key) {
    const last = key.split(".").pop();
    return last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function errorSummary(errors, fallbackMsg) {
    const keys = Object.keys(errors || {});
    if (!keys.length) return fallbackMsg || "Ada isian yang belum benar.";
    const names = keys.slice(0, 3).map((k) => {
      if (k.endsWith("._") || k === "_") return errors[k];
      const f = $(`.field[data-for="${k}"]`);
      const label = f ? $("label", f) : null;
      return label ? label.textContent.replace(/\s*\(.*\)\s*$/, "").trim() : humanizeKey(k);
    });
    const extra = keys.length > 3 ? ` (+${keys.length - 3} lainnya)` : "";
    return `${keys.length} isian belum benar: ${names.join(", ")}${extra}. Periksa tanda merah.`;
  }
  function showErrors(errors) {
    clearErrors();
    Object.keys(errors || {}).forEach((key) => ensureFieldVisible(key));
    let first = null;
    const orphans = [];
    Object.keys(errors || {}).forEach((key) => {
      if (key.endsWith("._") || key === "_") {
        const be = $("#boosterErr"); be.textContent = errors[key]; be.style.display = "block";
        if (!first) first = be; return;
      }
      const f = $(`.field[data-for="${key}"]`);
      if (f) {
        f.classList.add("invalid");
        const e = $(".err", f); if (e) e.textContent = errors[key];
        if (!first) first = f;
      } else {
        orphans.push([key, errors[key]]);
      }
    });
    if (orphans.length) {
      const se = $("#formSyncErr");
      if (se) {
        se.innerHTML = "<b>Ada isian yang ditolak sistem tapi tidak ditemukan di form ini:</b>" +
          orphans.map(([k, msg]) => `${esc(humanizeKey(k))} — ${esc(msg)}`).join("<br>") +
          "<br>Kemungkinan versi form belum sinkron dengan sistem. Coba muat ulang halaman (reload); kalau masih muncul, hubungi Teknisi/Admin.";
        se.style.display = "block";
        if (!first) first = se;
      }
    }
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = first.matches("input,select,textarea") ? first : $("input,select,textarea", first);
      if (focusable) focusable.focus({ preventScroll: true });
    }
  }

  function validateClient(payload) {
    const errors = {};
    if (!payload.identitas.nama_rs) errors["identitas.nama_rs"] = "Nama Rumah Sakit wajib diisi";
    if (!payload.identitas.daerah_rs) errors["identitas.daerah_rs"] = "Daerah Rumah Sakit wajib diisi";
    if (!payload.identitas.operator_nama) errors["identitas.operator_nama"] = "Nama Operator wajib dipilih";
    if (!payload.identitas.tanggal) errors["identitas.tanggal"] = "Tanggal wajib diisi";
    if (!payload.identitas.shift) errors["identitas.shift"] = "Shift wajib dipilih";
    if (!payload.identitas.jam_lapor || !JAM_24H_RE.test(payload.identitas.jam_lapor)) {
      errors["identitas.jam_lapor"] = "Jam laporan wajib diisi, format 24 jam HH.MM (contoh: 09.00 atau 22.00)";
    }

    const REQ = ["purity", "running_hours", "pressure", "box_temperature",
                 "xt1", "xt2", "xt3", "xt4",
                 "vsa", "scr", "flow_avg_lpm", "flow_total_m3"];
    REQ.forEach((k) => {
      const raw = payload.docs[k];
      const label = $(`.field[data-for="docs.${k}"] label`);
      const name = label ? label.textContent.replace(/\s*\(.*\)\s*$/, "").trim() : k;
      if (raw === "" || raw === undefined) { errors["docs." + k] = `${name} wajib diisi`; return; }
      if (num(raw) === null) errors["docs." + k] = `${name} harus berupa angka`;
    });
    ["rtd1", "rtd2", "rtd3", "rtd4"].forEach((k) => {
      const raw = payload.docs[k];
      const label = $(`.field[data-for="docs.${k}"] label`);
      const name = label ? label.textContent.replace(/\s*\(.*\)\s*$/, "").trim() : k;
      if (raw === "" || raw === undefined) errors["docs." + k] = `${name} wajib diisi`;
    });
    const p = num(payload.docs.purity);
    if (p !== null && (p < 0 || p > 100)) errors["docs.purity"] = "Purity harus di antara 0 dan 100 %";
    const rh = num(payload.docs.running_hours);
    if (rh !== null && rh < 0) errors["docs.running_hours"] = "Running Hours tidak boleh negatif";

    if (payload.booster.has) {
      if (!payload.booster.has_wwz && !payload.booster.has_gow) {
        errors["booster._"] = "Pilih minimal satu mesin booster (WWZ atau GOW)";
      }
      [["wwz", payload.booster.has_wwz], ["gow", payload.booster.has_gow]].forEach(([pre, on]) => {
        if (!on) return;
        const vals = payload.booster[pre];
        let filled = 0;
        Object.keys(vals).forEach((k) => {
          if (k === "riset_rh") return;
          if (k === "unit") return;
          if (k === "catatan") return;
          if (vals[k] === "") return;
          filled++;
          if (num(vals[k]) === null) errors[`${pre}.${k}`] = "Harus berupa angka";
        });
        if (!vals.riset_rh) errors[`${pre}.riset_rh`] = "Reset RH wajib dipilih";
        if (!vals.jumlah_produksi_tabung_o2 && vals.jumlah_produksi_tabung_o2 !== 0) {
          errors[`${pre}.jumlah_produksi_tabung_o2`] = "Jumlah Produksi Tabung O2 wajib diisi";
        }
        if (filled === 0) errors[`${pre}._`] = `Mesin ${pre.toUpperCase()} ditandai ada, minimal satu parameter harus diisi`;
      });
    }
    return errors;
  }

  let draftTimer = null;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), data: collect() }));
        $("#draftNote").textContent = "Draf tersimpan otomatis di perangkat ini";
      } catch (e) {}
    }, 400);
  }
  function applyDraft(d) {
    if (!d) return;
    const set = (n, v) => { const el = $(`[name="${n}"]`); if (el && v !== undefined && v !== null) el.value = v; };
    Object.entries(d.identitas || {}).forEach(([k, v]) => set("identitas." + k, v));
    Object.entries(d.docs || {}).forEach(([k, v]) => set("docs." + k, v));
    const b = d.booster || {};
    cbBooster.checked = !!b.has; cbWwz.checked = !!b.has_wwz; cbGow.checked = !!b.has_gow;
    Object.entries(b.wwz || {}).forEach(([k, v]) => set("wwz." + k, v));
    Object.entries(b.gow || {}).forEach(([k, v]) => set("gow." + k, v));
    [["hasBooster", "boosterExpander"], ["hasWwz", "wwzExpander"], ["hasGow", "gowExpander"]]
      .forEach(([c, e]) => $("#" + e).classList.toggle("open", $("#" + c).checked));
  }
  function resetForm(keepIdentity) {
    $("#reportForm").reset();
    clearErrors();
    $("#tanggal").value = todayISO();
    $("#nama_rs").value = AUTH ? AUTH.nama_rs || "" : "";
    $("#daerah_rs").value = AUTH ? AUTH.daerah_rs || "" : "";
    cbBooster.checked = cbWwz.checked = cbGow.checked = false;
    ["boosterExpander", "wwzExpander", "gowExpander"].forEach((e) => $("#" + e).classList.remove("open"));
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    $("#draftNote").textContent = "Draf tersimpan otomatis di perangkat ini";
    refreshShiftLock();
  }

  async function doSubmit(payload, isRetry) {
    const btn = $("#submitBtn");
    btn.disabled = true; btn.textContent = isRetry ? "Mengirim ulang…" : "Menyimpan…";
    try {
      const data = await authedFetch("submitReport", payload);
      if (data.code === "validation") {
        showErrors(data.errors || {});
        toast(errorSummary(data.errors, data.message), "err", { duration: 7000 });
        return;
      }
      if (data.code === "duplicate") {
        toast(data.message, "warn", {
          sticky: true, actionLabel: "Kirim tetap", dismissLabel: "Batal",
          onAction: () => doSubmit(Object.assign({}, payload, { confirm_duplicate: true }), true),
        });
        return;
      }
      if (data.code === "unauthorized" || data.code === "session_expired") { toast(data.message, "err"); return doLogoutLocal(); }
      if (!data.ok) { toast(data.message || "Gagal menyimpan laporan.", "err"); return; }

      clearErrors();
      toast(`Laporan tersimpan ke Google Sheets · ${(data.written || []).join(", ")}`, "ok", { duration: 5000 });
      try { localStorage.setItem(LAST_RS_KEY, JSON.stringify({ nama_rs: payload.identitas.nama_rs, daerah_rs: payload.identitas.daerah_rs })); } catch (e) {}
      resetForm(true);
      state.reports = null;
    } catch (err) {
      toast("Tidak dapat menghubungi backend. Draf Anda tetap tersimpan di perangkat ini.", "err", { duration: 7000 });
    } finally {
      btn.disabled = false; btn.textContent = "Kirim Laporan";
    }
  }

  $("#reportForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = collect();
    const errors = validateClient(payload);
    if (Object.keys(errors).length) { showErrors(errors); toast(errorSummary(errors), "err", { duration: 7000 }); return; }
    doSubmit(payload, false);
  });
  $("#reportForm").addEventListener("input", (e) => {
    const f = e.target.closest(".field");
    if (f && f.classList.contains("invalid")) { f.classList.remove("invalid"); const er = $(".err", f); if (er) er.textContent = ""; }
    saveDraft();
  });

  async function refreshStatus() {
    const dot = $("#storageDot"), txt = $("#storageText");
    dot.className = "gd"; txt.textContent = "Memeriksa…";
    try {
      const r = await gasFetch({ type: "ping" });
      if (r && r.ok) { dot.className = "gd"; $("#storageStatus").classList.remove("offline"); $("#storageStatus").classList.add("online"); txt.textContent = "Sheets: online"; }
      else throw new Error("bad ping");
    } catch (e) {
      $("#storageStatus").classList.remove("online"); $("#storageStatus").classList.add("offline");
      txt.textContent = "Sheets: offline";
    }
  }

  async function loadReports() {
    const pageEl = $("#page-report");
    showLoading(pageEl);
    try {
      const bulan = state.bulan || monthOf(todayISO());
      if (canSeeAllReports()) await ensureAllRsLoaded();
      let data;
      const primed = state.__primedReports;
      state.__primedReports = null;
      if (primed && primed.bulan === bulan && !state.rs && !state.teknisi) {
        data = primed.data;
      } else {
        data = await authedFetch("getReports", { bulan, rs: state.rs, teknisi: state.teknisi });
      }
      if (data.code === "unauthorized" || data.code === "session_expired") { toast(data.message, "err"); return doLogoutLocal(); }
      if (!data.ok) {
        $("#kpis").innerHTML = "";
        $("#trackerHost").innerHTML = `<div class="empty"><div class="big">🔌</div><p><b>Tidak dapat mengambil data.</b></p><p>${esc(data.message || "Periksa koneksi / URL backend di Pengaturan.")}</p></div>`;
        $("#chartHost").innerHTML = ""; $("#chartLegend").innerHTML = "";
        $("#tableHost").innerHTML = ""; $("#boosterTableHost").innerHTML = "";
        return;
      }
      state.reports = data;
      state.bulan = bulan;
      renderReport();
      if (isAdmin()) loadActivityLog();
    } finally { hideLoading(pageEl); }
  }

  function visibleAllRs() {
    return (state.allRs || []).filter((r) => r.active !== false);
  }

  function populateFilterTeknisi() {
    const selTek = $("#filterTeknisi");
    if (!selTek) return;
    const allRs = visibleAllRs();
    let names;
    if (state.rs) {
      const row = allRs.find((r) => r.nama_rs === state.rs);
      names = row ? [row.operator1, row.operator2, row.operator3].filter(Boolean) : [];
    } else {
      const seen = new Set();
      names = [];
      allRs.forEach((r) => {
        [r.operator1, r.operator2, r.operator3].filter(Boolean).forEach((n) => {
          if (!seen.has(n)) { seen.add(n); names.push(n); }
        });
      });
    }
    names.sort((a, b) => a.localeCompare(b));
    selTek.innerHTML = `<option value="">Semua operator (${names.length})</option>` +
      names.map((n) => `<option value="${esc(n)}"${n === state.teknisi ? " selected" : ""}>${esc(n)}</option>`).join("");
  }

  function renderReport() {
    const d = state.reports;
    const bulan = state.bulan;
    const docs = d.docs || [], wwz = d.wwz || [], gow = d.gow || [];

    $("#filterBulan").value = bulan;
    const tersedia = (d.bulan_tersedia || []).filter(Boolean).sort().reverse();
    const bulanHint = $("#filterBulanHint");
    bulanHint.textContent = tersedia.length ? `Bulan dengan data: ${tersedia.map(monthLabel).join(", ")}` : "";

    const selRs = $("#filterRs");
    const rsAll = canSeeAllReports() ? visibleAllRs().map((r) => r.nama_rs).filter(Boolean) : (d.daftar_rs || []);
    selRs.innerHTML = `<option value="">Semua rumah sakit (${rsAll.length})</option>` +
      rsAll.map((r) => `<option value="${esc(r)}"${r === state.rs ? " selected" : ""}>${esc(r)}</option>`).join("");

    if (canSeeAllReports()) populateFilterTeknisi();

    const hint = $("#sheetsHint");
    hint.style.display = "none";

    const rsScope = complianceRsScope();
    renderKpis(docs, wwz, gow, bulan, rsScope);
    renderTracker(docs, bulan, rsScope);
    renderChart(docs, bulan);
    if (canSeeAllReports()) renderPerTeknisi(docs); else $("#perTeknisiHost").innerHTML = "";
    renderDocsTable(docs, wwz, gow);
    renderBoosterTable(wwz, gow);
  }

  function complianceRsScope() {
    if (!canSeeAllReports()) return null;
    const all = visibleAllRs().map((r) => r.nama_rs).filter(Boolean);
    if (state.rs) return all.filter((n) => n === state.rs);
    return all;
  }

  function dueDays(bulan) {
    const total = daysInMonth(bulan);
    const nowM = monthOf(todayISO());
    if (bulan > nowM) return 0;
    if (bulan < nowM) return total;
    return new Date().getDate();
  }

  function renderKpis(docs, wwz, gow, bulan, rsScope) {
    const inScope = (r) => !rsScope || rsScope.some((n) => n.trim().toLowerCase() === (r.Nama_RS || "").trim().toLowerCase());
    const docsInScope = rsScope ? docs.filter(inScope) : docs;
    const rsCount = rsScope ? rsScope.length : new Set(docs.map((r) => (r.Nama_RS || "").trim()).filter(Boolean)).size;
    const purity = docs.map((r) => num(r["Purity_%"])).filter((v) => v !== null);
    const avgP = purity.length ? purity.reduce((a, b) => a + b, 0) / purity.length : null;
    const minP = purity.length ? Math.min.apply(null, purity) : null;
    const maxP = purity.length ? Math.max.apply(null, purity) : null;

    const due = dueDays(bulan);
    const uniq = new Set(docsInScope.map((r) => `${(r.Nama_RS || "").trim().toLowerCase()}|${r.Tanggal}`));
    const target = rsCount * due;
    const rate = target > 0 ? (uniq.size / target) * 100 : null;
    const rateClass = rate === null ? "" : rate >= 90 ? "accent-green" : rate >= 70 ? "accent-amber" : "accent-purple";

    const tiles = [
      { label: "Total Laporan DOCS", value: fmt(docs.length, 0), foot: `${rsCount} rumah sakit · ${monthLabel(bulan)}`, cls: "accent-blue" },
      { label: "Compliance Rate", value: rate === null ? "–" : fmt(rate, 0) + "<small>%</small>", foot: `${uniq.size} dari ${target || 0} hari-RS (s/d tgl ${due || "-"})`, cls: rateClass || "accent-green" },
      { label: "Rata-rata Purity", value: avgP === null ? "–" : fmt(avgP, 1) + "<small>%</small>", foot: purity.length ? `Rentang ${fmt(minP, 1)}% – ${fmt(maxP, 1)}%` : "Belum ada data", cls: "accent-green" },
      { label: "Laporan Booster", value: fmt(wwz.length + gow.length, 0), foot: `WWZ ${wwz.length} · GOW ${gow.length}`, cls: "accent-amber" },
    ];
    $("#kpis").innerHTML = tiles.map((t) =>
      `<div class="kpi ${t.cls}"><div class="label">${t.label}</div><div class="value">${t.value}</div><div class="foot">${esc(t.foot)}</div></div>`
    ).join("");
  }

  function renderTracker(docs, bulan, rsScope) {
    const host = $("#trackerHost");
    const byRs = {};
    docs.forEach((r) => {
      const name = (r.Nama_RS || "").trim();
      if (!name) return;
      (byRs[name] = byRs[name] || new Set()).add(Number(String(r.Tanggal || "").slice(8, 10)));
    });
    const names = rsScope ? rsScope.slice().sort() : Object.keys(byRs).sort();
    if (!names.length) {
      host.innerHTML = `<div class="empty"><div class="big">🗓️</div><p>Belum ada laporan pada ${esc(monthLabel(bulan))}.</p></div>`;
      return;
    }
    const total = daysInMonth(bulan);
    const due = dueDays(bulan);
    const [yy, mm] = bulan.split("-").map(Number);

    let head = '<tr><th class="rs">Rumah Sakit</th>';
    for (let dd = 1; dd <= total; dd++) head += `<th>${dd % 5 === 0 || dd === 1 ? dd : ""}</th>`;
    head += "<th></th></tr>";

    let body = "";
    names.forEach((n) => {
      const set = byRs[n] || new Set();
      let row = `<tr><td class="rs" title="${esc(n)}">${esc(n)}</td>`;
      for (let dd = 1; dd <= total; dd++) {
        const wd = new Date(yy, mm - 1, dd).getDay();
        const weekend = wd === 0 || wd === 6 ? " weekend" : "";
        const cls = set.has(dd) ? "filled" : dd > due ? "future" : "missing";
        row += `<td class="cell"><div class="cellbox ${cls}${weekend}" title="${esc(n)} · ${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}"></div></td>`;
      }
      const filledDue = Array.from(set).filter((x) => x <= due).length;
      const pct = due ? (filledDue / due) * 100 : 0;
      const rc = pct >= 90 ? "good" : pct >= 70 ? "mid" : "bad";
      row += `<td><span class="rate ${rc}">${fmt(pct, 0)}%</span></td></tr>`;
      body += row;
    });
    host.innerHTML = `<table class="tracker"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  const METRIC_META = {
    purity: { label: "Purity", unit: "%", dec: 1, color: "#0071e3", field: "Purity_%" },
    pressure: { label: "Pressure", unit: "psi", dec: 2, color: "#34c759", field: "Pressure" },
    box_temperature: { label: "Box Temperature", unit: "°F", dec: 1, color: "#ff9500", field: "Box_Temperature" },
    running_hours: { label: "Running Hours", unit: "jam", dec: 0, color: "#7e3af2", field: "Running_Hours" },
  };

  function renderChart(docs, bulan) {
    const host = $("#chartHost"), legend = $("#chartLegend");
    const meta = METRIC_META[state.metric];
    $("#chartDesc").textContent = state.rs ? `${meta.label} harian untuk ${state.rs}.` : `Rata-rata ${meta.label.toLowerCase()} harian pada bulan terpilih.`;

    const total = daysInMonth(bulan);
    const buckets = Array.from({ length: total + 1 }, () => []);
    docs.forEach((r) => {
      const dd = Number(String(r.Tanggal || "").slice(8, 10));
      const v = num(r[meta.field]);
      if (dd >= 1 && dd <= total && v !== null) buckets[dd].push(v);
    });
    const pts = [];
    for (let dd = 1; dd <= total; dd++) if (buckets[dd].length) pts.push({ d: dd, v: buckets[dd].reduce((a, b) => a + b, 0) / buckets[dd].length, n: buckets[dd].length });

    if (!pts.length) { host.innerHTML = `<div class="empty"><div class="big">📉</div><p>Belum ada data ${esc(meta.label)} pada bulan ini.</p></div>`; legend.innerHTML = ""; return; }

    const W = 900, H = 240, L = 52, R = 14, T = 16, B = 30;
    const iw = W - L - R, ih = H - T - B;
    const vals = pts.map((p) => p.v);
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) { const pad = Math.abs(hi) * 0.05 || 1; lo -= pad; hi += pad; } else { const pad = (hi - lo) * 0.14; lo -= pad; hi += pad; }
    if (state.metric === "purity") { lo = Math.max(0, lo); hi = Math.min(100, hi); }

    const x = (dd) => L + (total > 1 ? ((dd - 1) / (total - 1)) * iw : iw / 2);
    const y = (v) => T + ih - ((v - lo) / (hi - lo)) * ih;

    let grid = "", yl = "";
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4, yy = y(v);
      grid += `<line class="gline" x1="${L}" y1="${yy.toFixed(1)}" x2="${W - R}" y2="${yy.toFixed(1)}"/>`;
      yl += `<text class="glabel" x="${L - 8}" y="${(yy + 3.5).toFixed(1)}" text-anchor="end">${fmt(v, meta.dec)}</text>`;
    }
    let xl = "";
    for (let dd = 1; dd <= total; dd += total > 20 ? 3 : 2) xl += `<text class="glabel" x="${x(dd).toFixed(1)}" y="${H - 10}" text-anchor="middle">${dd}</text>`;

    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = `${line} L${x(pts[pts.length - 1].d).toFixed(1)},${(T + ih).toFixed(1)} L${x(pts[0].d).toFixed(1)},${(T + ih).toFixed(1)} Z`;
    const dots = pts.map((p) => `<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.4" fill="#fff" stroke="${meta.color}" stroke-width="2"><title>Tgl ${p.d} — ${fmt(p.v, meta.dec)} ${meta.unit} (${p.n} laporan)</title></circle>`).join("");

    host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren ${esc(meta.label)}">
      <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${meta.color}" stop-opacity="0.20"/><stop offset="100%" stop-color="${meta.color}" stop-opacity="0"/></linearGradient></defs>
      ${grid}${yl}${xl}
      <line class="axis" x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}"/>
      <path d="${area}" fill="url(#grad)"/>
      <path d="${line}" fill="none" stroke="${meta.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>`;

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    legend.innerHTML = `<span><i style="background:${meta.color}"></i> ${esc(meta.label)} (${esc(meta.unit)})</span>` +
      `<span>Rata-rata: <b>&nbsp;${fmt(avg, meta.dec)} ${esc(meta.unit)}</b></span>` +
      `<span>Terendah ${fmt(Math.min.apply(null, vals), meta.dec)} · Tertinggi ${fmt(Math.max.apply(null, vals), meta.dec)}</span>` +
      `<span>${pts.length} hari terdata</span>`;
  }

  function renderPerTeknisi(docs) {
    const host = $("#perTeknisiHost");
    if (!docs.length) { host.innerHTML = `<div class="empty"><p>Belum ada laporan pada bulan ini.</p></div>`; return; }
    const byOp = {};
    docs.forEach((r) => {
      const account = r.Submitted_By || "";
      const name = r.Submitted_By_Name || account || "—";
      const key = account + "|" + name;
      if (!byOp[key]) byOp[key] = { name, rs: r.Nama_RS || "–", count: 0, last: "" };
      byOp[key].count++;
      if (!byOp[key].rs) byOp[key].rs = r.Nama_RS || "–";
      if (String(r.Timestamp) > byOp[key].last) byOp[key].last = r.Timestamp;
    });
    const rows = Object.values(byOp).sort((a, b) => b.count - a.count);
    const head = `<tr><th>Operator</th><th>Rumah Sakit</th><th>Jumlah Laporan</th><th>Laporan Terakhir</th></tr>`;
    const body = rows.map((info) => `<tr>
        <td class="name">${esc(info.name)}</td>
        <td>${esc(info.rs || "–")}</td>
        <td><b>${info.count}</b></td>
        <td style="color:var(--text-sec)">${esc(info.last || "–")}</td>
      </tr>`).join("");
    host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  function moreControl(total, shown, kind) {
    if (total <= ROW_LIMIT) return `<div class="row-count">${total} baris</div>`;
    if (shown >= total) return `<div class="more-row"><button type="button" class="btn btn-ghost btn-sm" data-more="${kind}">Tampilkan lebih sedikit</button></div><div class="row-count">Menampilkan seluruh ${total} baris</div>`;
    return `<div class="more-row"><button type="button" class="btn btn-ghost btn-sm" data-more="${kind}">Tampilkan semua ${total} baris</button></div><div class="row-count">Menampilkan ${shown} dari ${total} baris terbaru</div>`;
  }
  function attachMore(host, html, kind, onToggle) {
    let box = host.nextElementSibling;
    if (!box || !box.classList.contains("more-host")) { box = document.createElement("div"); box.className = "more-host"; host.parentElement.insertBefore(box, host.nextSibling); }
    box.innerHTML = html;
    const btn = box.querySelector(`[data-more="${kind}"]`);
    if (btn) btn.addEventListener("click", onToggle);
  }

  const EDIT_FIELDS = {
    docs: [
      ["purity", "Purity", "Purity_%", "number"],
      ["running_hours", "Running Hours", "Running_Hours", "number"],
      ["pressure", "Pressure", "Pressure", "number"],
      ["box_temperature", "Box Temperature", "Box_Temperature", "number"],
      ["xt1", "XT-1", "XT1", "number"], ["xt2", "XT-2", "XT2", "number"],
      ["xt3", "XT-3", "XT3", "number"], ["xt4", "XT-4", "XT4", "number"],
      ["rtd1", "RTD-1", "RTD1", "text"], ["rtd2", "RTD-2", "RTD2", "text"],
      ["rtd3", "RTD-3", "RTD3", "text"], ["rtd4", "RTD-4", "RTD4", "text"],
      ["vsa", "VSA", "VSA", "text"], ["scr", "SCR", "SCR", "text"],
      ["flow_avg_lpm", "Flow Avg (LPM)", "Flow_Avg_LPM", "number"],
      ["flow_total_m3", "Flow Total (T)", "Flow_Total_M3", "number"],
      ["catatan", "Catatan", "Catatan", "textarea"],
      ["catatan_operator", "Catatan Operator", "Catatan_Operator", "textarea"],
    ],
    wwz: [
      ["running_hours", "Running Hours", "Running_Hours", "number"],
      ["temp_disc1", "1st Stage Discharge Temperature", "Temp1", "number"],
      ["temp_disc2", "2nd Stage Discharge Temperature", "Temp2", "number"],
      ["press_inlet", "Inlet Pressure", "Press1", "number"],
      ["press_l1", "Level 1 Exhaust Pressure", "Press2", "number"],
      ["press_l2", "Level 2 Exhaust Pressure", "Press3", "number"],
      ["riset_rh", "Reset RH", "Riset_RH", "enum", ["Ya", "Tidak"]],
      ["jumlah_produksi_tabung_o2", "Jumlah Produksi Tabung O2", "Jumlah_Produksi_Tabung_O2", "number"],
      ["catatan", "Catatan", "Catatan", "textarea"],
    ],
    gow: [
      ["running_hours", "Running Hours", "Running_Hours", "number"],
      ["temp_ex1", "1st Exhaust Temperature", "Temp1", "number"],
      ["temp_ex2", "2nd Exhaust Temperature", "Temp2", "number"],
      ["temp_ex3", "3rd Exhaust Temperature", "Temp3", "number"],
      ["temp_ex4", "4th Exhaust Temperature", "Temp4", "number"],
      ["press_inlet", "Inlet Pressure", "Press_Inlet", "number"],
      ["press_ex1", "1st Stage Exhaust Pressure", "Press1", "number"],
      ["press_ex2", "2nd Stage Exhaust Pressure", "Press2", "number"],
      ["press_ex3", "3rd Stage Exhaust Pressure", "Press3", "number"],
      ["press_ex4", "4th Stage Exhaust Pressure", "Press4", "number"],
      ["jumlah_produksi_tabung_o2", "Jumlah Produksi Tabung O2", "Jumlah_Produksi_Tabung_O2", "number"],
      ["riset_rh", "Reset RH", "Riset_RH", "enum", ["Ya", "Tidak"]],
      ["catatan", "Catatan", "Catatan", "textarea"],
    ],
  };
  const EDIT_TYPE_LABEL = { docs: "DOCS", wwz: "Booster WWZ", gow: "Booster GOW" };
  let editReportTarget = null;

  function openEditReportModal(type, row) {
    const fields = EDIT_FIELDS[type];
    if (!fields) return;
    editReportTarget = {
      type: type, nama_rs: row.Nama_RS || "", tanggal: row.Tanggal || "", shift: row.Shift || "",
      timestamp: row.Timestamp || "", unit: row.Unit || "1",
    };
    const shiftLabel = SHIFT_LABEL_FORM[row.Shift] || row.Shift || "–";
    $("#editReportModalTitle").textContent = `— ${EDIT_TYPE_LABEL[type]}`;
    $("#editReportDesc").textContent = `${row.Nama_RS || "–"} · ${row.Tanggal || "–"} · Shift ${shiftLabel}` +
      (type === "docs" ? "" : ` · Unit ${editReportTarget.unit}`);
    $("#editReportErr").style.display = "none";
    const host = $("#editReportFields");
    host.innerHTML = fields.map(([key, label, col, inputType, options]) => {
      const val = row[col] === undefined || row[col] === null ? "" : row[col];
      if (inputType === "textarea") {
        return `<div class="fld"><label>${esc(label)}</label><textarea data-editf="${key}" rows="2">${esc(val)}</textarea></div>`;
      }
      if (inputType === "enum") {
        const opts = options.map((o) => `<option value="${esc(o)}"${String(val) === o ? " selected" : ""}>${esc(o)}</option>`).join("");
        return `<div class="fld"><label>${esc(label)}</label><select data-editf="${key}">${opts}</select></div>`;
      }
      return `<div class="fld"><label>${esc(label)}</label><input type="text" inputmode="${inputType === "number" ? "decimal" : "text"}" data-editf="${key}" value="${esc(val)}" /></div>`;
    }).join("");
    openModal("editReportModal");
  }
  $("#editReportCloseBtn").addEventListener("click", () => closeModal("editReportModal"));
  $("#editReportCancelBtn").addEventListener("click", () => closeModal("editReportModal"));
  $("#editReportSaveBtn").addEventListener("click", async () => {
    if (!editReportTarget) return;
    const errEl = $("#editReportErr"); errEl.style.display = "none";
    const values = {};
    $$("[data-editf]", $("#editReportFields")).forEach((el) => { values[el.dataset.editf] = el.value; });
    const btn = $("#editReportSaveBtn");
    setBtnBusy(btn, true, "Menyimpan…");
    showLoading(document.querySelector("#editReportModal .modal-card"));
    try {
      const data = await authedFetch("updateReport", {
        report_type: editReportTarget.type, nama_rs: editReportTarget.nama_rs, tanggal: editReportTarget.tanggal,
        shift: editReportTarget.shift, timestamp: editReportTarget.timestamp, unit: editReportTarget.unit, values: values,
      });
      if (!data.ok) {
        const msgs = data.errors ? Object.values(data.errors) : [];
        errEl.textContent = msgs.length ? msgs.join(" · ") : (data.message || "Gagal menyimpan perubahan.");
        errEl.style.display = "block";
        return;
      }
      closeModal("editReportModal");
      toast(data.changes && data.changes.length ? `Perubahan tersimpan: ${data.changes.join(", ")}` : "Perubahan tersimpan (tidak ada nilai yang berbeda).", "ok", { duration: 6000 });
      loadReports();
    } finally { setBtnBusy(btn, false); hideLoading(document.querySelector("#editReportModal .modal-card")); }
  });

  function renderDocsTable(docs, wwz, gow) {
    const host = $("#tableHost");
    if (!docs.length) { host.innerHTML = `<div class="empty"><p>Belum ada data untuk ditampilkan.</p></div>`; return; }
    const key = (r) => `${(r.Nama_RS || "").trim().toLowerCase()}|${r.Tanggal}`;
    const hasW = new Set(wwz.map(key)), hasG = new Set(gow.map(key));
    const all = docs.slice().sort((a, b) => String(b.Tanggal).localeCompare(String(a.Tanggal)) || String(b.Timestamp).localeCompare(String(a.Timestamp)));
    const rows = state.showAllDocs ? all : all.slice(0, ROW_LIMIT);
    const canEdit = canSeeAllReports();
    const head = `<tr><th>Tanggal</th><th>Jam</th><th>Shift</th><th>Rumah Sakit</th><th>Daerah</th>${canSeeAllReports() ? "<th>Operator</th>" : ""}<th>Purity&nbsp;%</th><th>Run&nbsp;Hours</th><th>Press</th><th>Box&nbsp;Temp</th><th>XT 1–4</th><th>RTD 1–4</th><th>VSA&nbsp;/&nbsp;SCR</th><th>Booster</th>${canEdit ? "<th>Aksi</th>" : ""}</tr>`;
    const q = (a) => a.map((v) => (v === "" || v === undefined || v === null ? "–" : v)).join(" / ");
    const SHIFT_LABEL = { pagi: "Pagi", sore: "Sore", malam: "Malam" };
    const body = rows.map((r, i) => {
      const k = key(r);
      const pills = [];
      if (hasW.has(k)) pills.push('<span class="pill wwz">WWZ</span>');
      if (hasG.has(k)) pills.push('<span class="pill gow">GOW</span>');
      if (!pills.length) pills.push('<span class="pill none">—</span>');
      const catOp = String(r.Catatan_Operator || "").trim();
      const noteIcon = catOp ? ` <span class="note-icon" title="${esc(catOp)}">📝</span>` : "";
      return `<tr>
        <td>${esc(r.Tanggal)}</td>
        <td>${esc(safeTimeStr(r.Jam_Lapor) || "–")}</td>
        <td>${esc(SHIFT_LABEL[r.Shift] || r.Shift || "–")}${noteIcon}</td>
        <td class="name">${esc(r.Nama_RS)}</td>
        <td>${esc(r.Daerah_RS || "–")}</td>
        ${canSeeAllReports() ? `<td>${esc(r.Submitted_By_Name || r.Submitted_By || "–")}</td>` : ""}
        <td><b>${esc(r["Purity_%"])}</b></td>
        <td>${esc(r.Running_Hours)}</td>
        <td>${esc(r.Pressure)}</td>
        <td>${esc(r.Box_Temperature)}</td>
        <td>${esc(q([r.XT1, r.XT2, r.XT3, r.XT4]))}</td>
        <td>${esc(q([r.RTD1, r.RTD2, r.RTD3, r.RTD4]))}</td>
        <td>${esc(q([r.VSA, r.SCR]))}</td>
        <td>${pills.join(" ")}</td>
        ${canEdit ? `<td><button class="btn btn-ghost btn-tiny" data-edit-docs="${i}" type="button">Edit</button></td>` : ""}</tr>`;
    }).join("");
    host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    if (canEdit) $$("[data-edit-docs]", host).forEach((b) => b.addEventListener("click", () => openEditReportModal("docs", rows[Number(b.dataset.editDocs)])));
    attachMore(host, moreControl(all.length, rows.length, "docs"), "docs", () => { state.showAllDocs = !state.showAllDocs; renderDocsTable(state.reports.docs || [], state.reports.wwz || [], state.reports.gow || []); });
  }

  function renderBoosterTable(wwz, gow) {
    const host = $("#boosterTableHost");
    const all = wwz.map((r) => ({ t: "WWZ", r })).concat(gow.map((r) => ({ t: "GOW", r })));
    if (!all.length) { host.innerHTML = `<div class="empty"><p>Tidak ada laporan booster kompressor pada bulan ini.</p></div>`; return; }
    all.sort((a, b) => String(b.r.Tanggal).localeCompare(String(a.r.Tanggal)) || a.t.localeCompare(b.t));
    const shown = state.showAllBooster ? all : all.slice(0, ROW_LIMIT);
    const canEdit = canSeeAllReports();
    const head = `<tr><th>Tanggal</th><th>Jam</th><th>Mesin</th><th>Rumah Sakit</th>${canSeeAllReports() ? "<th>Operator</th>" : ""}<th>Run Hours</th><th>Temperature</th><th>Pressure</th><th>Tabung O2</th><th>Catatan</th>${canEdit ? "<th>Aksi</th>" : ""}</tr>`;
    const q = (a) => a.map((v) => (v === "" || v === undefined || v === null ? "–" : v)).join(" / ");
    const body = shown.map(({ t, r }, i) => {
      const temps = t === "WWZ" ? [r.Temp1, r.Temp2] : [r.Temp1, r.Temp2, r.Temp3, r.Temp4];
      const press = t === "WWZ" ? [r.Press1, r.Press2, r.Press3] : [r.Press_Inlet, r.Press1, r.Press2, r.Press3, r.Press4];
      const unitMark = String(r.Unit || "").trim() === "2" ? " +2" : "";
      return `<tr><td>${esc(r.Tanggal)}</td><td>${esc(safeTimeStr(r.Jam_Lapor) || "–")}</td><td><span class="pill ${t.toLowerCase()}">${t}${esc(unitMark)}</span></td><td class="name">${esc(r.Nama_RS)}</td>
        ${canSeeAllReports() ? `<td>${esc(r.Submitted_By_Name || r.Submitted_By || "–")}</td>` : ""}
        <td>${esc(r.Running_Hours || "–")}</td>
        <td>${esc(q(temps))}</td><td>${esc(q(press))}</td>
        <td>${esc(r.Jumlah_Produksi_Tabung_O2 !== undefined && r.Jumlah_Produksi_Tabung_O2 !== null && r.Jumlah_Produksi_Tabung_O2 !== "" ? r.Jumlah_Produksi_Tabung_O2 : "–")}</td>
        <td>${esc(r.Catatan || "–")}</td>
        ${canEdit ? `<td><button class="btn btn-ghost btn-tiny" data-edit-booster="${i}" type="button">Edit</button></td>` : ""}</tr>`;
    }).join("");
    host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    if (canEdit) $$("[data-edit-booster]", host).forEach((b) => b.addEventListener("click", () => {
      const item = shown[Number(b.dataset.editBooster)];
      openEditReportModal(item.t.toLowerCase(), item.r);
    }));
    attachMore(host, moreControl(all.length, shown.length, "booster"), "booster", () => { state.showAllBooster = !state.showAllBooster; renderBoosterTable(state.reports.wwz || [], state.reports.gow || []); });
  }

  const DOCS_SHEET_ROWS = [
    ["PURITY", ">90", "Purity_%"],
    ["RUNNING HOUR DOCS", "", "Running_Hours"],
    ["PRESSURE", ">55", "Pressure"],
    ["BOX TEMP", "<120 F", "Box_Temperature"],
    ["XT-1", "", "XT1"], ["XT-2", "", "XT2"], ["XT-3", "", "XT3"], ["XT-4", "", "XT4"],
    ["RTD-1", "", "RTD1"], ["RTD-2", "", "RTD2"],
    ["RTD-3", "", "RTD3"], ["RTD-4", "", "RTD4"],
    ["V S A", "40 - 60", "VSA"],
    ["S C R", "<42", "SCR"],
    ["FLOW AVG (LPM)", "", "Flow_Avg_LPM"],
    ["FLOW TOTAL (T)", "", "Flow_Total_M3"],
  ];
  const BOOSTER_SHEET_ROWS = [
    ["Running Hours Booster", "", "running_hours"],
    ["Inlet pressure", "", "inlet"],
    ["Temperature 1", "", "temp1"], ["Temperature 2", "", "temp2"],
    ["Temperature 3", "", "temp3"], ["Temperature 4", "", "temp4"],
    ["Level 1 Exhaust pressure", "", "level1"], ["Level 2 Exhaust pressure", "", "level2"],
    ["Level 3 Exhaust pressure", "", "level3"], ["Level 4 Exhaust pressure", "", "level4"],
    ["Reset RH", "", "riset_rh"],
    ["Jumlah Produksi Tabung O2", "", "tabung"],
    ["Catatan Booster", "", "catatan_booster"],
  ];
  const BOOSTER_FIELD_MAP = {
    WWZ: { running_hours: "Running_Hours", inlet: "Press1",
      temp1: "Temp1", temp2: "Temp2", temp3: null, temp4: null, level1: "Press2", level2: "Press3", level3: null, level4: null,
      riset_rh: "Riset_RH", tabung: "Jumlah_Produksi_Tabung_O2", catatan_booster: "Catatan" },
    GOW: { running_hours: "Running_Hours", inlet: "Press_Inlet",
      temp1: "Temp1", temp2: "Temp2", temp3: "Temp3", temp4: "Temp4", level1: "Press1", level2: "Press2", level3: "Press3", level4: "Press4",
      riset_rh: "Riset_RH", tabung: "Jumlah_Produksi_Tabung_O2", catatan_booster: "Catatan" },
  };
  function boosterCell(type, row, field) {
    const map = type && BOOSTER_FIELD_MAP[type];
    const col = map && map[field];
    if (!row || !col) return "";
    const v = row[col];
    return v === undefined || v === null || v === "" ? "" : v;
  }
  function matchBoosterRows(docsRow, arr) {
    return (arr || []).filter((b) => {
      if (String(b.Nama_RS || "").trim().toLowerCase() !== String(docsRow.Nama_RS || "").trim().toLowerCase()) return false;
      if (String(b.Tanggal || "") !== String(docsRow.Tanggal || "")) return false;
      if (docsRow.Jam_Lapor && b.Jam_Lapor && b.Jam_Lapor !== docsRow.Jam_Lapor) return false;
      return true;
    });
  }

  function safeTimeStr(v) {
    const str = v === undefined || v === null ? "" : String(v);
    const iso = str.match(/T(\d{2}):(\d{2})/);
    if (iso) return iso[1] + ":" + iso[2];
    return str;
  }

  function sanitizeFileNamePart(v) {
    const str = (v === undefined || v === null ? "" : String(v)).trim();
    return str.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_") || "-";
  }

  function sanitizeSheetName(name, used) {
    let clean = String(name === undefined || name === null ? "" : name).trim().replace(/[\\/?*\[\]:]/g, "-");
    if (!clean) clean = "RS";
    if (clean.length > 31) clean = clean.slice(0, 31).trim();
    if (!used) return clean;
    let candidate = clean, n = 2;
    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${n})`;
      candidate = clean.slice(0, 31 - suffix.length) + suffix;
      n++;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  }

  function exportDataSheet() {
    const docs = ((state.reports && state.reports.docs) || []).slice()
      .sort((a, b) => String(a.Tanggal).localeCompare(String(b.Tanggal)) || String(a.Jam_Lapor || "").localeCompare(String(b.Jam_Lapor || "")));
    if (!docs.length) { toast("Tidak ada data untuk diekspor.", "warn"); return; }
    if (typeof XlsxLite === "undefined") { toast("Modul Excel belum termuat. Muat ulang halaman lalu coba lagi.", "err"); return; }
    const wwz = (state.reports && state.reports.wwz) || [];
    const gow = (state.reports && state.reports.gow) || [];

    function buildDataSheetConfig(sheetName, docsForSheet, rsLabelForSubtitle) {
      const columns = [];
      docsForSheet.forEach((d) => {
        const mWwz = matchBoosterRows(d, wwz);
        const mGow = matchBoosterRows(d, gow);
        if (!mWwz.length && !mGow.length) { columns.push({ docs: d, type: null, row: null }); return; }
        mWwz.forEach((r) => columns.push({ docs: d, type: "WWZ", row: r }));
        mGow.forEach((r) => columns.push({ docs: d, type: "GOW", row: r }));
      });

      const totalCols = 2 + columns.length;
      const blank2 = ["", ""];
      const aoa = [];

      aoa.push(["PT GENERATOR PASIFIK INDONESIA — DATA SHEET LAPORAN HARIAN"]);
      const subtitleParts = [];
      if (rsLabelForSubtitle) subtitleParts.push(`Rumah Sakit: ${rsLabelForSubtitle}`);
      subtitleParts.push(`Bulan: ${monthLabel(state.bulan) || "Semua Bulan"}`);
      subtitleParts.push(`Diekspor: ${new Date().toLocaleString("id-ID")}`);
      subtitleParts.push(`${columns.length} kolom laporan`);
      aoa.push([subtitleParts.join("  ·  ")]);
      const titleRow = 0, subtitleRow = 1;
      const headerRowsStart = 2;

      aoa.push(["PARAMETER", "TARGET / RANGE"].concat(columns.map((c) => "TGL : " + (c.docs.Tanggal || ""))));
      aoa.push(blank2.concat(columns.map((c) => "WAKTU : " + (safeTimeStr(c.docs.Jam_Lapor) || "-"))));
      aoa.push(blank2.concat(columns.map((c) => "SHIFT : " + (SHIFT_LABEL_FORM[c.docs.Shift] || c.docs.Shift || "-"))));
      aoa.push(blank2.concat(columns.map((c) => "RS : " + (c.docs.Nama_RS || ""))));
      aoa.push(blank2.concat(columns.map((c) => "BOOSTER : " + (c.type || "-"))));
      const headerRowsEnd = aoa.length - 1;
      const dataStartRow = aoa.length;

      DOCS_SHEET_ROWS.forEach(([label, target, key]) => {
        aoa.push([label, target].concat(columns.map((c) => {
          const v = c.docs[key];
          return v === undefined || v === null || v === "" ? "" : v;
        })));
      });
      aoa.push(["BOOSTER KOMPRESSOR", ""].concat(columns.map(() => "")));
      BOOSTER_SHEET_ROWS.forEach(([label, target, field]) => {
        aoa.push([label, target].concat(columns.map((c) => boosterCell(c.type, c.row, field))));
      });
      aoa.push(["OPERATOR", ""].concat(columns.map((c) => c.docs.Submitted_By_Name || c.docs.Submitted_By || "")));
      aoa.push(["CATATAN OPERATOR", ""].concat(columns.map((c) => c.docs.Catatan_Operator || "")));
      aoa.push(["CATATAN", ""].concat(columns.map((c) => c.docs.Catatan || "")));

      const colWidths = [26, 14].concat(columns.map(() => 16));
      const lastColLetter = XlsxLite.colLetter(totalCols - 1);

      return {
        name: sheetName, aoa: aoa, colWidths: colWidths,
        merges: [`A${titleRow + 1}:${lastColLetter}${titleRow + 1}`, `A${subtitleRow + 1}:${lastColLetter}${subtitleRow + 1}`],
        titleRows: [titleRow], subtitleRows: [subtitleRow],
        headerRows: [headerRowsStart, headerRowsStart + 1, headerRowsStart + 2, headerRowsStart + 3, headerRowsStart + 4],
        borderFrom: headerRowsStart, bandedFrom: dataStartRow,
        freeze: [2, headerRowsEnd + 1],
      };
    }

    const rsNames = Array.from(new Set(docs.map((d) => d.Nama_RS).filter(Boolean)));
    const rsLabel = rsNames.length === 1 ? rsNames[0] : (state.rs || (rsNames.length > 1 ? "Semua Rumah Sakit" : "Rumah Sakit"));

    const fileRsLabel = rsNames.length === 1 ? rsNames[0] : (state.rs || (rsNames.length > 1 ? "Multi_RS" : "RS"));
    const fileName = `${sanitizeFileNamePart(fileRsLabel)}_${sanitizeFileNamePart(state.bulan || "Semua_Bulan")}.xlsx`;

    let sheets;
    if (rsNames.length > 1) {
      const usedNames = new Set();
      sheets = rsNames.map((rs) => {
        const docsForRs = docs.filter((d) => (d.Nama_RS || "") === rs);
        const sheetName = sanitizeSheetName(rs, usedNames);
        return buildDataSheetConfig(sheetName, docsForRs, "");
      });
    } else {
      sheets = [buildDataSheetConfig("Data Sheet", docs, rsLabel)];
    }

    XlsxLite.download(fileName, sheets);
  }

  function exportLaporanBulanan() {
    const docs = ((state.reports && state.reports.docs) || []).slice()
      .sort((a, b) => String(a.Tanggal).localeCompare(String(b.Tanggal)) || String(a.Jam_Lapor || "").localeCompare(String(b.Jam_Lapor || "")));
    if (!docs.length) { toast("Tidak ada data untuk diekspor.", "warn"); return; }
    if (typeof XlsxLite === "undefined") { toast("Modul Excel belum termuat. Muat ulang halaman lalu coba lagi.", "err"); return; }
    const wwz = (state.reports && state.reports.wwz) || [];
    const gow = (state.reports && state.reports.gow) || [];

    const header = [
      "No", "Tanggal", "Shift", "Jam Lapor", "Nama Rumah Sakit", "Daerah RS", "Operator",
      "Catatan Operator",
      "Purity DOCS (%)", "Running Hours DOCS",
      "WWZ - Running Hours", "WWZ - Reset RH", "WWZ - Jumlah Produksi Tabung O2", "WWZ - Catatan",
      "GOW - Running Hours", "GOW - Reset RH", "GOW - Jumlah Produksi Tabung O2", "GOW - Catatan",
      "Catatan",
    ];
    const NUM_COLS = [0, 8, 9, 10, 12, 14, 16];
    const val = (v) => (v === undefined || v === null || v === "" ? "" : v);
    const bulananShiftLabel = { pagi: "Pagi", sore: "Sore", malam: "Malam" };

    const rsNamesAll = Array.from(new Set(docs.map((d) => d.Nama_RS).filter(Boolean)));
    const rsLabelAll = rsNamesAll.length === 1 ? rsNamesAll[0] : (state.rs || (rsNamesAll.length > 1 ? "Semua Rumah Sakit" : "Rumah Sakit"));
    const titleText = "PT GENERATOR PASIFIK INDONESIA — LAPORAN BULANAN TEKNISI";
    const subtitleText = `Rumah Sakit: ${rsLabelAll}  ·  Bulan: ${monthLabel(state.bulan) || "Semua Bulan"}  ·  Diekspor: ${new Date().toLocaleString("id-ID")}  ·  ${docs.length} laporan`;

    const colWidths = [5, 12, 9, 10, 26, 18, 16, 24, 12, 16, 14, 12, 20, 22, 14, 12, 20, 22, 26];
    const lastCol = XlsxLite.colLetter(header.length - 1);

    function buildLaporanSheetConfig(sheetName, docsForSheet, rsLabelForSub) {
      const subtitleParts = [];
      if (rsLabelForSub) subtitleParts.push(`Rumah Sakit: ${rsLabelForSub}`);
      subtitleParts.push(`Bulan: ${monthLabel(state.bulan) || "Semua Bulan"}`);
      subtitleParts.push(`Diekspor: ${new Date().toLocaleString("id-ID")}`);
      subtitleParts.push(`${docsForSheet.length} laporan`);
      const subtitle = subtitleParts.join("  ·  ");
      const sheetAoa = [[titleText], [subtitle], header];
      docsForSheet.forEach((d, i) => {
        const w = matchBoosterRows(d, wwz)[0] || null;
        const g = matchBoosterRows(d, gow)[0] || null;
        sheetAoa.push([
          i + 1, val(d.Tanggal), val(bulananShiftLabel[d.Shift] || d.Shift), val(safeTimeStr(d.Jam_Lapor)),
          val(d.Nama_RS), val(d.Daerah_RS), val(d.Submitted_By_Name || d.Submitted_By),
          val(d.Catatan_Operator),
          val(d["Purity_%"]), val(d.Running_Hours),
          val(w && w.Running_Hours), val(w && w.Riset_RH), val(w && w.Jumlah_Produksi_Tabung_O2), val(w && w.Catatan),
          val(g && g.Running_Hours), val(g && g.Riset_RH), val(g && g.Jumlah_Produksi_Tabung_O2), val(g && g.Catatan),
          val(d.Catatan),
        ]);
      });
      return {
        name: sheetName, aoa: sheetAoa, colWidths: colWidths,
        merges: [`A1:${lastCol}1`, `A2:${lastCol}2`],
        titleRows: [0], subtitleRows: [1], headerRows: [2],
        borderFrom: 2, bandedFrom: 3, rightAlignCols: NUM_COLS,
        autofilter: `A3:${lastCol}3`, freeze: [0, 3],
      };
    }

    let laporanSheets;
    if (rsNamesAll.length > 1) {
      const usedNames = new Set();
      laporanSheets = rsNamesAll.map((rs) => {
        const docsForRs = docs.filter((d) => (d.Nama_RS || "") === rs);
        const sheetName = sanitizeSheetName(`Laporan Bulanan ${rs}`, usedNames);
        return buildLaporanSheetConfig(sheetName, docsForRs, "");
      });
    } else {
      laporanSheets = [buildLaporanSheetConfig("Laporan Bulanan", docs, rsLabelAll)];
    }

    const byRs = {};
    docs.forEach((d) => {
      const key = String(d.Nama_RS || "-").trim() || "-";
      if (!byRs[key]) byRs[key] = { nama_rs: d.Nama_RS || "-", daerah_rs: d.Daerah_RS || "", laporan: 0, runHoursSum: 0, runHoursN: 0, tabungSum: 0, puritySum: 0, purityN: 0 };
      const b = byRs[key];
      b.laporan++;
      const rh = num(d.Running_Hours); if (rh !== null) { b.runHoursSum += rh; b.runHoursN++; }
      const pu = num(d["Purity_%"]); if (pu !== null) { b.puritySum += pu; b.purityN++; }
    });
    wwz.concat(gow).forEach((r) => {
      const key = String(r.Nama_RS || "-").trim() || "-";
      if (!byRs[key]) byRs[key] = { nama_rs: r.Nama_RS || "-", daerah_rs: r.Daerah_RS || "", laporan: 0, runHoursSum: 0, runHoursN: 0, tabungSum: 0, puritySum: 0, purityN: 0 };
      const tb = num(r.Jumlah_Produksi_Tabung_O2); if (tb !== null) byRs[key].tabungSum += tb;
    });
    const round1 = (n) => Math.round(n * 10) / 10;
    const summaryHeader = ["Nama Rumah Sakit", "Daerah RS", "Jumlah Laporan", "Rata-rata Running Hours",
      "Total Jumlah Produksi Tabung O2", "Rata-rata Purity (%)"];
    const summaryRows = Object.values(byRs).sort((a, b) => a.nama_rs.localeCompare(b.nama_rs)).map((b) => [
      b.nama_rs, b.daerah_rs, b.laporan,
      b.runHoursN ? round1(b.runHoursSum / b.runHoursN) : "",
      b.tabungSum,
      b.purityN ? round1(b.puritySum / b.purityN) : "",
    ]);
    const grandTotal = Object.values(byRs).reduce((acc, b) => ({
      laporan: acc.laporan + b.laporan, tabung: acc.tabung + b.tabungSum,
    }), { laporan: 0, tabung: 0 });
    const summaryTitleText = "PT GENERATOR PASIFIK INDONESIA — RINGKASAN PER RUMAH SAKIT";
    const summaryAoa = [[summaryTitleText], [subtitleText], summaryHeader].concat(summaryRows).concat([
      ["TOTAL SEMUA RS", "", grandTotal.laporan, "", grandTotal.tabung, ""],
    ]);
    const summaryColWidths = [26, 18, 14, 20, 24, 16];
    const summaryLastCol = XlsxLite.colLetter(summaryHeader.length - 1);
    const summaryTotalRow = summaryAoa.length - 1;
    const summaryNumCols = [2, 3, 4, 5];

    XlsxLite.download(`Laporan_Bulanan_Teknisi_${state.bulan || "export"}.xlsx`, laporanSheets.concat([
      {
        name: "Ringkasan", aoa: summaryAoa, colWidths: summaryColWidths,
        merges: [`A1:${summaryLastCol}1`, `A2:${summaryLastCol}2`],
        titleRows: [0], subtitleRows: [1], headerRows: [2], boldRows: [summaryTotalRow],
        borderFrom: 2, bandedFrom: 3, rightAlignCols: summaryNumCols,
        autofilter: `A3:${summaryLastCol}3`, freeze: [0, 3],
      },
    ]));
  }

  function setBulan(newBulan) {
    if (!newBulan) return;
    state.bulan = newBulan;
    $("#filterBulan").value = newBulan;
    loadReports();
  }
  function stepBulan(delta) {
    const cur = $("#filterBulan").value || state.bulan;
    const m = /^(\d{4})-(\d{2})$/.exec(cur);
    if (!m) return;
    let y = Number(m[1]), mo = Number(m[2]) + delta;
    while (mo < 1) { mo += 12; y -= 1; }
    while (mo > 12) { mo -= 12; y += 1; }
    setBulan(String(y).padStart(4, "0") + "-" + String(mo).padStart(2, "0"));
  }
  $("#filterBulan").addEventListener("change", (e) => setBulan(e.target.value));
  $("#bulanPrevBtn").addEventListener("click", () => stepBulan(-1));
  $("#bulanNextBtn").addEventListener("click", () => stepBulan(1));
  $("#filterRs").addEventListener("change", (e) => {
    state.rs = e.target.value;
    state.teknisi = "";
    populateFilterTeknisi();
    loadReports();
  });
  $("#filterTeknisi").addEventListener("change", (e) => { state.teknisi = e.target.value; loadReports(); });
  wireReloadBtn("#refreshBtn", () => loadReports());
  wireReloadBtn("#refreshBtn2", async () => { await refreshStatus(); await loadReports(); });
  function runWithLoading(container, fn) {
    showLoading(container);
    setTimeout(() => {
      try { fn(); } finally { hideLoading(container); }
    }, 20);
  }
  $("#exportBtn").addEventListener("click", () => runWithLoading($("#page-report"), exportDataSheet));
  $("#exportBulananBtn").addEventListener("click", () => runWithLoading($("#page-bulanan"), exportLaporanBulanan));
  $$("#chartTabs .chip").forEach((c) => c.addEventListener("click", () => {
    state.metric = c.dataset.metric;
    $$("#chartTabs .chip").forEach((x) => x.classList.toggle("active", x === c));
    if (state.reports) renderChart(state.reports.docs || [], state.bulan);
  }));

  const ACTION_LABEL = {
    login: "Login", logout: "Logout", submit_report: "Kirim laporan", change_password: "Ganti password",
    create_account: "Buat akun", activate_account: "Aktifkan akun", deactivate_account: "Nonaktifkan akun",
    reset_password: "Reset password", snapshot_bulanan: "Snapshot bulanan", bootstrap_admin: "Setup awal",
    edit_laporan_docs: "Edit laporan DOCS", edit_laporan_booster: "Edit laporan booster",
  };
  async function loadActivityLog() {
    const host = $("#activityLogHost");
    if (!host) return;
    const data = await authedFetch("getActivityLog", { limit: 100 });
    if (!data.ok) { host.innerHTML = `<div class="empty"><p>${esc(data.message || "Gagal memuat aktivitas.")}</p></div>`; return; }
    const rows = data.log || [];
    if (!rows.length) { host.innerHTML = `<div class="empty"><p>Belum ada aktivitas tercatat.</p></div>`; return; }
    const head = `<tr><th>Waktu</th><th>Pengguna</th><th>Role</th><th>Aksi</th><th>Detail</th></tr>`;
    const body = rows.map((r) => `<tr>
        <td style="color:var(--text-sec)">${esc(r.Timestamp)}</td>
        <td class="name">${esc(r.Username)}</td>
        <td><span class="pill ${rolePillClass(r.Role)}">${esc(r.Role)}</span></td>
        <td>${esc(ACTION_LABEL[r.Action] || r.Action)}</td>
        <td style="white-space:normal">${esc(r.Detail || "–")}</td>
      </tr>`).join("");
    host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }
  $("#refreshLogBtn") && wireReloadBtn("#refreshLogBtn", loadActivityLog);

  async function loadSnapshots() {
    const host = $("#snapshotHost");
    showLoading($("#page-bulanan"));
    try {
    const bulan = $("#snapFilterBulan").value;
    const data = await authedFetch("getMonthlySnapshots", { bulan });
    if (!data.ok) { host.innerHTML = `<div class="empty"><p>${esc(data.message || "Gagal memuat snapshot.")}</p></div>`; return; }
    const sel = $("#snapFilterBulan");
    const opts = data.bulan_tersedia || [];
    sel.innerHTML = `<option value="">Semua bulan</option>` + opts.map((m) => `<option value="${m}"${m === bulan ? " selected" : ""}>${monthLabel(m)}</option>`).join("");
    const rows = data.rows || [];
    if (!rows.length) { host.innerHTML = `<div class="empty"><div class="big">🗂️</div><p>Belum ada snapshot tersimpan.</p><p>Pilih bulan di atas lalu klik "Buat / Perbarui Snapshot".</p></div>`; return; }
    rows.sort((a, b) => String(b.Bulan).localeCompare(String(a.Bulan)) || String(a.Nama_RS).localeCompare(String(b.Nama_RS)));
    const head = `<tr><th>Bulan</th><th>Rumah Sakit</th><th>Daerah</th><th>Total Laporan</th><th>Compliance</th><th>Avg Purity</th><th>Min–Maks Purity</th><th>WWZ</th><th>GOW</th><th>Disimpan</th><th>Total Tabung O2</th></tr>`;
    const numOrDash = (v) => (v === undefined || v === null || v === "" ? "–" : esc(v));
    const body = rows.map((r) => `<tr>
        <td>${esc(monthLabel(r.Bulan))}</td>
        <td class="name">${esc(r.Nama_RS)}</td>
        <td>${esc(r.Daerah_RS || "–")}</td>
        <td>${esc(r.Total_Laporan)}</td>
        <td><b>${esc(r["Compliance_Rate_%"])}%</b></td>
        <td>${esc(r.Avg_Purity)}%</td>
        <td>${esc(r.Min_Purity)}% – ${esc(r.Max_Purity)}%</td>
        <td>${esc(r.Laporan_WWZ)}</td>
        <td>${esc(r.Laporan_GOW)}</td>
        <td style="color:var(--text-sec)">${esc(r.Snapshot_At)}<br>oleh ${esc(r.Snapshot_By)}</td>
        <td>${numOrDash(r.Total_Tabung_O2)}</td>
      </tr>`).join("");
    host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    } finally { hideLoading($("#page-bulanan")); }
  }
  $("#snapBulanInput").value = monthOf(todayISO());
  $("#snapBuatBtn").addEventListener("click", async () => {
    const bulan = $("#snapBulanInput").value;
    if (!bulan) { toast("Pilih bulan terlebih dahulu.", "warn"); return; }
    const btn = $("#snapBuatBtn"); btn.disabled = true; btn.textContent = "Memproses…";
    showLoading($("#page-bulanan"));
    try {
      const data = await authedFetch("snapshotBulanan", { bulan });
      if (!data.ok) { toast(data.message || "Gagal membuat snapshot.", "err"); return; }
      toast(data.message, "ok");
      $("#snapFilterBulan").value = bulan;
      await loadSnapshots();
    } finally { btn.disabled = false; btn.textContent = "Buat / Perbarui Snapshot"; hideLoading($("#page-bulanan")); }
  });
  $("#snapFilterBulan").addEventListener("change", loadSnapshots);
  wireReloadBtn("#snapRefreshBtn", loadSnapshots);

  const APPROVAL_LABEL = { pending: "Menunggu Persetujuan", rejected: "Ditolak", approved: "Disetujui" };
  async function loadAccounts() {
    const host = $("#accountsHost");
    showLoading($("#page-akun"));
    try {
    const data = await authedFetch("listAccounts", {});
    if (!data.ok) { $("#accountsNoteHost").innerHTML = ""; host.innerHTML = `<div class="empty"><p>${esc(data.message || "Gagal memuat akun.")}</p></div>`; return; }
    const rows = (data.accounts || []).slice().sort((a, b) => {
      const pa = a.approval_status === "pending" ? 0 : 1, pb = b.approval_status === "pending" ? 0 : 1;
      return pa !== pb ? pa - pb : a.username.localeCompare(b.username);
    });
    state.allAccounts = data.accounts || [];
    if (!rows.length) { $("#accountsNoteHost").innerHTML = ""; host.innerHTML = `<div class="empty"><p>Belum ada akun.</p></div>`; return; }
    const pendingCount = rows.filter((a) => a.approval_status === "pending").length;
    $("#accountsNoteHost").innerHTML = pendingCount
      ? `<div class="hint" style="display:block;margin-bottom:14px">${pendingCount} pendaftaran menunggu persetujuan Anda — cek baris dengan pill kuning di bawah.</div>`
      : "";
    const head = `<tr><th>Username</th><th>Nama</th><th>Role</th><th>Persetujuan</th><th>Status</th><th>Dibuat</th><th>Login Terakhir</th><th>Aksi</th></tr>`;
    const body = rows.map((a) => {
      const appr = a.approval_status || "approved";
      const isPending = appr === "pending";
      const actions = isPending
        ? `<button class="btn btn-primary btn-tiny" data-approve="${esc(a.username)}" type="button">Setujui</button>
           <button class="btn btn-ghost btn-tiny" data-reject="${esc(a.username)}" type="button">Tolak</button>`
        : `<button class="btn btn-ghost btn-tiny" data-reset="${esc(a.username)}" type="button">Reset Password</button>
           <button class="btn btn-ghost btn-tiny" data-toggle="${esc(a.username)}" data-active="${a.active ? 1 : 0}" type="button">${a.active ? "Nonaktifkan" : "Aktifkan"}</button>`;
      return `<tr>
        <td class="name">${esc(a.username)}</td>
        <td>${esc(a.name || "–")}</td>
        <td><span class="pill ${rolePillClass(a.role)}">${esc(a.role)}</span></td>
        <td><span class="pill ${appr}">${esc(APPROVAL_LABEL[appr] || appr)}</span></td>
        <td><span class="pill ${a.active ? "active-yes" : "active-no"}">${a.active ? "Aktif" : "Nonaktif"}</span></td>
        <td style="color:var(--text-sec)">${esc(a.created_at || "–")}${a.created_by ? "<br>oleh " + esc(a.created_by) : ""}</td>
        <td style="color:var(--text-sec)">${esc(a.last_login || "Belum pernah")}</td>
        <td>${actions}</td>
      </tr>`;
    }).join("");
    host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    $$("[data-reset]", host).forEach((b) => b.addEventListener("click", () => openResetModal(b.dataset.reset)));
    $$("[data-toggle]", host).forEach((b) => b.addEventListener("click", () => toggleAccountActive(b.dataset.toggle, b.dataset.active !== "1")));
    $$("[data-approve]", host).forEach((b) => b.addEventListener("click", () => decideAccountApproval(b.dataset.approve, "approved")));
    $$("[data-reject]", host).forEach((b) => b.addEventListener("click", () => decideAccountApproval(b.dataset.reject, "rejected")));
    } finally { hideLoading($("#page-akun")); }
  }
  wireReloadBtn("#accRefreshBtn", loadAccounts);

  async function decideAccountApproval(username, decision) {
    const data = await authedFetch("setAccountApproval", { username, decision });
    if (!data.ok) { toast(data.message || "Gagal memproses keputusan.", "err"); return; }
    toast(data.message || "Berhasil diproses.", "ok");
    loadAccounts();
  }

  $("#accAddBtn").addEventListener("click", async () => {
    $("#accErr").style.display = "none";
    $("#accName").value = ""; $("#accUser").value = ""; $("#accPass").value = ""; $("#accRole").value = "teknisi";
    if (!state.allAccounts) await loadAccounts();
    openModal("accModal");
  });
  $("#accCloseBtn").addEventListener("click", () => closeModal("accModal"));
  $("#accCancelBtn").addEventListener("click", () => closeModal("accModal"));
  $("#accSaveBtn").addEventListener("click", async () => {
    const role = $("#accRole").value;
    const payload = { username: $("#accUser").value.trim(), password: $("#accPass").value, name: $("#accName").value.trim(), role: role };
    const errEl = $("#accErr");
    if (!payload.username || !payload.password) { errEl.textContent = "Username dan password wajib diisi."; errEl.style.display = "block"; return; }
    if (payload.password.length < 6) { errEl.textContent = "Password minimal 6 karakter."; errEl.style.display = "block"; return; }
    const btn = $("#accSaveBtn"); btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      const data = await authedFetch("createAccount", payload);
      if (!data.ok) { errEl.textContent = data.message || "Gagal membuat akun."; errEl.style.display = "block"; return; }
      closeModal("accModal");
      toast(data.message || "Akun berhasil dibuat.", "ok");
      loadAccounts();
    } finally { btn.disabled = false; btn.textContent = "Buat Akun"; }
  });

  let resetTargetUser = "";
  function openResetModal(username) {
    resetTargetUser = username;
    $("#resetUserLabel").textContent = username;
    $("#resetNewPass").value = "";
    $("#resetErr").style.display = "none";
    openModal("resetModal");
  }
  $("#resetCloseBtn").addEventListener("click", () => closeModal("resetModal"));
  $("#resetCancelBtn").addEventListener("click", () => closeModal("resetModal"));
  $("#resetSaveBtn").addEventListener("click", async () => {
    const newPassword = $("#resetNewPass").value;
    const errEl = $("#resetErr");
    if (!newPassword || newPassword.length < 6) { errEl.textContent = "Password baru minimal 6 karakter."; errEl.style.display = "block"; return; }
    const btn = $("#resetSaveBtn"); btn.disabled = true; btn.textContent = "Memproses…";
    try {
      const data = await authedFetch("resetPassword", { username: resetTargetUser, newPassword });
      if (!data.ok) { errEl.textContent = data.message || "Gagal reset password."; errEl.style.display = "block"; return; }
      closeModal("resetModal");
      toast(data.message || "Password berhasil direset.", "ok");
    } finally { btn.disabled = false; btn.textContent = "Reset Password"; }
  });

  async function toggleAccountActive(username, makeActive, onDone) {
    const data = await authedFetch("setAccountActive", { username, active: makeActive });
    if (!data.ok) { toast(data.message || "Gagal memperbarui status akun.", "err"); return; }
    toast(data.message || "Status akun diperbarui.", "ok");
    (onDone || loadAccounts)();
  }

  let rsTarget = "";

  async function fetchAllRs() {
    const data = await authedFetch("listRumahSakit", {});
    if (data.ok) state.allRs = (data.rs || []).slice().sort((a, b) => a.nama_rs.localeCompare(b.nama_rs));
    return data;
  }
  async function ensureAllRsLoaded() {
    if (state.allRs) return;
    await fetchAllRs();
  }

  async function loadRumahSakit() {
    const host = $("#rsHost");
    showLoading($("#page-rs"));
    try {
    const data = await fetchAllRs();
    if (!data.ok) { host.innerHTML = `<div class="empty"><p>${esc(data.message || "Gagal memuat daftar rumah sakit.")}</p></div>`; return; }
    const rows = state.allRs || [];
    if (!rows.length) {
      host.innerHTML = `<div class="empty"><p>Belum ada rumah sakit terdaftar. Tambahkan baris baru langsung di tab <code>Rumah_Sakit</code> pada Google Sheets (kolom Nama_RS &amp; Daerah_RS), lalu Muat Ulang di sini untuk mengatur akunnya.</p></div>`;
      return;
    }
    const head = `<tr><th>Rumah Sakit</th><th>Daerah</th><th>Username</th><th>Operator</th><th>Status Akun</th><th>Status RS</th><th>Tabung (bulan ini)</th><th>Aksi</th></tr>`;
    const body = rows.map((r) => `<tr>
        <td class="name">${esc(r.nama_rs)}</td>
        <td>${esc(r.daerah_rs || "–")}</td>
        <td>${esc(r.username || "–")}</td>
        <td style="color:var(--text-sec)">${[r.operator1, r.operator2, r.operator3].filter(Boolean).map(esc).join(", ") || "–"}</td>
        <td><span class="pill ${r.has_password ? "active-yes" : "active-no"}">${r.has_password ? "Sudah diatur" : "Belum diatur"}</span></td>
        <td><span class="pill ${r.active !== false ? "active-yes" : "active-no"}">${r.active !== false ? "Aktif" : "Nonaktif"}</span></td>
        <td>${esc(r.tabung_bulan_ini !== undefined && r.tabung_bulan_ini !== null ? r.tabung_bulan_ini : "–")}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-tiny" data-rs-setting="${esc(r.nama_rs)}" type="button">Setting</button>
          <button class="btn btn-ghost btn-tiny" data-rs-toggle="${esc(r.nama_rs)}" data-rs-active="${r.active !== false ? 1 : 0}" type="button">${r.active !== false ? "Nonaktifkan" : "Aktifkan"}</button>
          <button class="btn btn-danger btn-tiny" data-rs-delete="${esc(r.nama_rs)}" type="button">Hapus</button>
        </td>
      </tr>`).join("");
    host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    $$("[data-rs-setting]", host).forEach((b) => b.addEventListener("click", () => openRsModal(b.dataset.rsSetting)));
    $$("[data-rs-toggle]", host).forEach((b) => b.addEventListener("click", () => toggleRsActive(b.dataset.rsToggle, b.dataset.rsActive !== "1")));
    $$("[data-rs-delete]", host).forEach((b) => b.addEventListener("click", () => deleteRs(b.dataset.rsDelete)));
    } finally { hideLoading($("#page-rs")); }
  }
  wireReloadBtn("#rsRefreshBtn", loadRumahSakit);

  async function toggleRsActive(namaRs, makeActive) {
    const data = await authedFetch("setRumahSakitActive", { nama_rs: namaRs, active: makeActive });
    if (!data.ok) { toast(data.message || "Gagal memperbarui status rumah sakit.", "err"); return; }
    toast(data.message || "Status rumah sakit diperbarui.", "ok");
    loadRumahSakit();
  }

  async function deleteRs(namaRs) {
    const ok = confirm(`Apakah anda yakin ingin menghapus ${namaRs}? Data laporan yang sudah ada tidak akan terhapus, tapi RS ini tidak akan bisa login lagi dan tidak akan muncul di daftar.`);
    if (!ok) return;
    const data = await authedFetch("deleteRumahSakit", { nama_rs: namaRs });
    if (!data.ok) { toast(data.message || "Gagal menghapus rumah sakit.", "err"); return; }
    toast(data.message || "Rumah sakit berhasil dihapus.", "ok");
    loadRumahSakit();
  }

  function openRsModal(namaRs) {
    rsTarget = namaRs || "";
    const isNew = !rsTarget;
    const row = isNew ? {} : ((state.allRs || []).find((r) => r.nama_rs === namaRs) || {});
    $("#rsModalTitle").textContent = isNew ? "— Rumah Sakit Baru" : namaRs;
    $("#rsErr").style.display = "none";
    const namaInput = $("#rsNama");
    namaInput.value = isNew ? "" : namaRs;
    namaInput.readOnly = !isNew;
    namaInput.classList.toggle("readonly-field", !isNew);
    $("#rsDaerah").value = row.daerah_rs || "";
    $("#rsUser").value = row.username || "";
    $("#rsPass").value = "";
    $("#rsPassReq").textContent = row.has_password ? "" : "*";
    $("#rsOp1").value = row.operator1 || ""; $("#rsOp2").value = row.operator2 || ""; $("#rsOp3").value = row.operator3 || "";
    openModal("rsModal");
    if (isNew) namaInput.focus();
  }
  $("#rsAddBtn").addEventListener("click", () => openRsModal(""));
  $("#rsCloseBtn").addEventListener("click", () => closeModal("rsModal"));
  $("#rsCancelBtn").addEventListener("click", () => closeModal("rsModal"));
  $("#rsSaveBtn").addEventListener("click", async () => {
    const namaRsInput = $("#rsNama").value.trim();
    const payload = {
      nama_rs: rsTarget || namaRsInput, daerah_rs: $("#rsDaerah").value.trim(),
      username: $("#rsUser").value.trim(), password: $("#rsPass").value,
      operator1: $("#rsOp1").value.trim(), operator2: $("#rsOp2").value.trim(), operator3: $("#rsOp3").value.trim(),
    };
    const errEl = $("#rsErr");
    if (!payload.nama_rs) { errEl.textContent = "Nama Rumah Sakit wajib diisi."; errEl.style.display = "block"; return; }
    const normLower = (s) => String(s || "").trim().toLowerCase();
    if (!rsTarget && (state.allRs || []).some((r) => normLower(r.nama_rs) === normLower(payload.nama_rs))) {
      errEl.textContent = "Sudah ada Rumah Sakit dengan nama itu — pilih Setting di baris yang sudah ada kalau mau mengubahnya.";
      errEl.style.display = "block"; return;
    }
    if (!payload.username) { errEl.textContent = "Username wajib diisi."; errEl.style.display = "block"; return; }
    if (payload.password && payload.password.length < 6) { errEl.textContent = "Password minimal 6 karakter."; errEl.style.display = "block"; return; }
    if (!payload.operator1 || !payload.operator2) { errEl.textContent = "Minimal nama 2 operator (Operator 1 & 2) wajib diisi."; errEl.style.display = "block"; return; }
    const btn = $("#rsSaveBtn"); btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      const data = await authedFetch("setRumahSakitAccount", payload);
      if (!data.ok) { errEl.textContent = data.message || "Gagal menyimpan akun rumah sakit."; errEl.style.display = "block"; return; }
      closeModal("rsModal");
      toast(data.message || "Akun rumah sakit berhasil disimpan.", "ok");
      loadRumahSakit();
    } finally { btn.disabled = false; btn.textContent = "Simpan"; }
  });

  $("#openPwBtn").addEventListener("click", () => {
    $("#pwOld").value = ""; $("#pwNew").value = "";
    $("#pwErr").style.display = "none"; $("#pwSuc").style.display = "none";
    openModal("pwModal");
  });
  $("#pwCloseBtn").addEventListener("click", () => closeModal("pwModal"));
  $("#pwCancelBtn").addEventListener("click", () => closeModal("pwModal"));
  $("#pwSaveBtn").addEventListener("click", async () => {
    const oldPassword = $("#pwOld").value, newPassword = $("#pwNew").value;
    const errEl = $("#pwErr"), sucEl = $("#pwSuc");
    errEl.style.display = "none"; sucEl.style.display = "none";
    if (!oldPassword || !newPassword) { errEl.textContent = "Semua field wajib diisi."; errEl.style.display = "block"; return; }
    if (newPassword.length < 6) { errEl.textContent = "Password baru minimal 6 karakter."; errEl.style.display = "block"; return; }
    const btn = $("#pwSaveBtn"); btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      const data = await authedFetch("changeOwnPassword", { oldPassword, newPassword });
      if (!data.ok) { errEl.textContent = data.message || "Gagal mengubah password."; errEl.style.display = "block"; return; }
      sucEl.textContent = data.message || "Password berhasil diubah."; sucEl.style.display = "block";
      setTimeout(() => closeModal("pwModal"), 1200);
    } finally { btn.disabled = false; btn.textContent = "Simpan Password"; }
  });

  const spState = { masterByRs: {}, rsPublic: [], trOpenByRs: {} };

  function enhanceSelectDropdown(selectEl) {
    if (!selectEl || selectEl.dataset.ddEnhanced) return;
    selectEl.dataset.ddEnhanced = "1";
    selectEl.classList.add("dd-native-hidden");
    selectEl.tabIndex = -1;
    const wrap = document.createElement("div");
    wrap.className = "dd-wrap";
    selectEl.parentNode.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dd-trigger";
    wrap.appendChild(trigger);
    const list = document.createElement("div");
    list.className = "dd-list";
    wrap.appendChild(list);

    function syncTrigger() {
      const opt = selectEl.options[selectEl.selectedIndex];
      trigger.textContent = opt ? opt.textContent : "";
      trigger.classList.toggle("dd-placeholder", !selectEl.value);
      trigger.disabled = selectEl.disabled;
    }
    function buildList() {
      list.innerHTML = "";
      Array.from(selectEl.options).forEach((opt, i) => {
        const item = document.createElement("div");
        item.className = "dd-item" + (opt.disabled ? " dd-disabled" : "") + (i === selectEl.selectedIndex ? " dd-selected" : "");
        item.textContent = opt.textContent;
        if (!opt.disabled) {
          item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectEl.value = opt.value;
            selectEl.dispatchEvent(new Event("change", { bubbles: true }));
            closeList();
            syncTrigger();
          });
        }
        list.appendChild(item);
      });
    }
    function closeList() {
      list.classList.remove("open", "dd-up");
      trigger.classList.remove("open");
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    }
    function openList() {
      if (selectEl.disabled) return;
      buildList();
      list.classList.add("open");
      trigger.classList.add("open");
      const rect = trigger.getBoundingClientRect();
      const listHeight = Math.min(list.scrollHeight, 260);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < listHeight && spaceAbove > spaceBelow;
      list.classList.toggle("dd-up", openUp);
      document.addEventListener("mousedown", onDocClick, true);
      document.addEventListener("keydown", onKeyDown, true);
    }
    function onDocClick(e) { if (!wrap.contains(e.target)) closeList(); }
    function onKeyDown(e) { if (e.key === "Escape") closeList(); }
    trigger.addEventListener("click", () => { list.classList.contains("open") ? closeList() : openList(); });
    selectEl.addEventListener("change", syncTrigger);
    new MutationObserver(syncTrigger).observe(selectEl, { childList: true });
    syncTrigger();
  }
  ["pubReqRs", "pubPkRs", "pubTrRs", "pubTrPengiriman",
   "spStokRsFilter", "spPkRsFilter", "spReqStatusFilter", "spTrStatusFilter", "logKrmRs",
   "pubReqOperator", "pubPkOperator", "pubTrOperator"]
    .forEach((id) => { const el = document.getElementById(id); if (el) enhanceSelectDropdown(el); });

  function publicFetch(type, extra) { return gasFetch(Object.assign({ type: type }, extra || {})); }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error("Gagal membaca file."));
      fr.readAsDataURL(file);
    });
  }
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality || 0.72));
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.src = dataUrl;
    });
  }
  async function compressAndUploadPhoto(fileInputEl) {
    const file = fileInputEl.files && fileInputEl.files[0];
    if (!file) return "";
    const raw = await readFileAsDataURL(file);
    const compressed = await compressImageDataUrl(raw, 1280, 0.72);
    const res = await publicFetch("uploadFotoSparepart", { base64: compressed, filename: file.name || "foto.jpg", mime_type: "image/jpeg" });
    if (!res.ok) throw new Error(res.message || "Upload foto gagal.");
    return res.url;
  }
  function wirePhotoPreview(inputId, imgId) {
    const input = $("#" + inputId), img = $("#" + imgId);
    if (!input || !img) return;
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) { img.style.display = "none"; return; }
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; img.style.display = "block"; };
      reader.readAsDataURL(file);
    });
  }

  const ITEM_MANUAL = "__MANUAL__";
  function itemMasterOptionsHtml(list, allowManual) {
    const manualOpt = allowManual ? `<option value="${ITEM_MANUAL}">Barang Lainnya (tulis manual)</option>` : "";
    return `<option value="">Pilih barang…</option>` + (list || []).map((m) =>
      `<option value="${esc(m.item_id)}">${m.kode_barang ? esc(m.kode_barang) + " — " : ""}${esc(m.nama_barang)}${m.satuan ? " (" + esc(m.satuan) + ")" : ""}</option>`).join("") + manualOpt;
  }
  function itemSelectOptionsHtml(masterList, rsChosen, allowManual) {
    if (!masterList || !masterList.length) {
      if (allowManual && rsChosen) {
        return `<option value="" disabled selected>— Belum ada barang terdaftar untuk RS ini —</option>` +
          `<option value="${ITEM_MANUAL}">Barang Lainnya (tulis manual)</option>`;
      }
      const msg = rsChosen ? "— Belum ada barang terdaftar untuk RS ini —" : "— Pilih Rumah Sakit dulu —";
      return `<option value="" disabled selected>${esc(msg)}</option>`;
    }
    return itemMasterOptionsHtml(masterList, allowManual && rsChosen);
  }
  function addItemRow(containerId, masterList, opts) {
    opts = opts || {};
    const host = $("#" + containerId);
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="fld"><label>Barang</label><select class="ir-kode">${itemSelectOptionsHtml(masterList, opts.rsChosen, opts.allowManual)}</select></div>
      ${opts.withRh ? `<div class="fld"><label>RH Saat Diganti</label><input type="text" class="ir-rh" inputmode="numeric" placeholder="mis. 12480" /></div>` : ""}
      <div class="fld"><label>Jumlah</label><input type="text" class="ir-qty" inputmode="decimal" placeholder="1" /></div>
      <button type="button" class="item-row-remove" aria-label="Hapus baris">×</button>`;
    if (opts.allowManual) {
      const manualFld = document.createElement("div");
      manualFld.className = "fld ir-manual-wrap";
      manualFld.hidden = true;
      manualFld.innerHTML = `<label>Nama Barang (manual)</label><input type="text" class="ir-manual" placeholder="Ketik nama barang" />`;
      row.insertBefore(manualFld, row.querySelector(".item-row-remove"));
    }
    row.querySelector(".item-row-remove").addEventListener("click", () => row.remove());
    if (opts.allowManual) {
      row.querySelector(".ir-kode").addEventListener("change", () => {
        const wrap = row.querySelector(".ir-manual-wrap");
        if (wrap) wrap.hidden = row.querySelector(".ir-kode").value !== ITEM_MANUAL;
      });
    }
    if (opts.itemId) row.querySelector(".ir-kode").value = opts.itemId;
    if (opts.qty !== undefined && opts.qty !== null) row.querySelector(".ir-qty").value = opts.qty;
    host.appendChild(row);
    enhanceSelectDropdown(row.querySelector(".ir-kode"));
    return row;
  }
  function clearItemRows(containerId) { $("#" + containerId).innerHTML = ""; }
  function refreshItemRowOptions(containerId, masterList, rsChosen, allowManual) {
    $$(".item-row .ir-kode", $("#" + containerId)).forEach((sel) => {
      sel.innerHTML = itemSelectOptionsHtml(masterList, rsChosen, allowManual);
      const wrap = sel.closest(".item-row").querySelector(".ir-manual-wrap");
      if (wrap) wrap.hidden = true;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  function collectItemRows(containerId, withRh) {
    const rows = $$(".item-row", $("#" + containerId));
    const items = [];
    rows.forEach((r) => {
      const itemId = r.querySelector(".ir-kode").value;
      const qty = num(r.querySelector(".ir-qty").value);
      if (!itemId || qty === null) return;
      const it = { item_id: itemId, qty: qty };
      if (itemId === ITEM_MANUAL) {
        const manual = r.querySelector(".ir-manual");
        it.nama_barang_manual = manual ? manual.value.trim() : "";
        if (!it.nama_barang_manual) return;
      }
      if (withRh) { const rh = r.querySelector(".ir-rh"); it.rh = rh ? rh.value.trim() : ""; }
      items.push(it);
    });
    return items;
  }

  async function ensureMasterForRs(namaRs, force) {
    if (!namaRs) return [];
    if (spState.masterByRs[namaRs] && !force) return spState.masterByRs[namaRs];
    const res = await publicFetch("listSparepartActive", { nama_rs: namaRs });
    const list = res.ok ? (res.items || []) : [];
    spState.masterByRs[namaRs] = list;
    return list;
  }
  async function ensureRsPublicLoaded(force) {
    if (spState.rsPublic.length && !force) return spState.rsPublic;
    const res = await publicFetch("listRsPublic", {});
    spState.rsPublic = res.ok ? (res.rs || []) : [];
    return spState.rsPublic;
  }
  function rsOptionsHtml(list) {
    return `<option value="">Pilih rumah sakit…</option>` + (list || []).map((r) => `<option value="${esc(r.nama_rs)}">${esc(r.nama_rs)}</option>`).join("");
  }

  const OPERATOR_LAINNYA = "__LAINNYA__";
  function findRsPublicRow(namaRs) {
    return (spState.rsPublic || []).find((r) => r.nama_rs === namaRs);
  }
  function operatorOptionsHtml(rsRow) {
    const ops = rsRow ? [rsRow.operator1, rsRow.operator2, rsRow.operator3].filter(Boolean) : [];
    const lainnyaOpt = `<option value="${OPERATOR_LAINNYA}">Operator Lainnya (tulis manual)</option>`;
    if (!ops.length) return lainnyaOpt;
    return `<option value="" disabled selected>Pilih operator…</option>` +
      ops.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("") + lainnyaOpt;
  }
  function refreshOperatorSelect(prefix, namaRs) {
    const sel = document.getElementById(prefix + "Operator");
    const wrap = document.getElementById(prefix + "OperatorLainnyaWrap");
    const manual = document.getElementById(prefix + "OperatorLainnya");
    if (!sel) return;
    if (manual) manual.value = "";
    if (!namaRs) {
      sel.innerHTML = `<option value="" disabled selected>— Pilih Rumah Sakit dulu —</option>`;
      if (wrap) wrap.hidden = true;
      return;
    }
    sel.innerHTML = operatorOptionsHtml(findRsPublicRow(namaRs));
    if (wrap) wrap.hidden = sel.value !== OPERATOR_LAINNYA;
  }
  function wireOperatorSelect(prefix) {
    const sel = document.getElementById(prefix + "Operator");
    const wrap = document.getElementById(prefix + "OperatorLainnyaWrap");
    if (!sel) return;
    sel.addEventListener("change", () => { if (wrap) wrap.hidden = sel.value !== OPERATOR_LAINNYA; });
  }
  function getOperatorNama(prefix) {
    const sel = document.getElementById(prefix + "Operator");
    if (!sel || !sel.value) return "";
    if (sel.value === OPERATOR_LAINNYA) {
      const manual = document.getElementById(prefix + "OperatorLainnya");
      return manual ? manual.value.trim() : "";
    }
    return sel.value.trim();
  }
  ["pubReq", "pubPk", "pubTr"].forEach(wireOperatorSelect);

  $("#portalToLoginBtn").addEventListener("click", () => showOnly("loginPage"));
  $("#portalToSparepartBtn").addEventListener("click", async () => {
    showOnly("publicSparepartPage");
    await initPublicSparepartPage();
  });
  $("#pubBackBtn").addEventListener("click", () => showOnly("portalPage"));

  let _pubSparepartInited = false;
  async function initPublicSparepartPage() {
    const rsList = await ensureRsPublicLoaded(true);
    const rsHtml = rsOptionsHtml(rsList);
    $("#pubReqRs").innerHTML = rsHtml;
    $("#pubPkRs").innerHTML = rsHtml;
    $("#pubTrRs").innerHTML = rsHtml;
    refreshOperatorSelect("pubReq", "");
    refreshOperatorSelect("pubPk", "");
    refreshOperatorSelect("pubTr", "");
    if ($("#pubReqHistoryWrap")) $("#pubReqHistoryWrap").hidden = true;
    if (!_pubSparepartInited) {
      _pubSparepartInited = true;
      $("#pubReqTanggal").value = todayISO();
      $("#pubPkTanggal").value = todayISO();
      $("#pubTrTanggal").value = todayISO();
      clearItemRows("pubReqItems"); addItemRow("pubReqItems", []);
      clearItemRows("pubPkItems"); addItemRow("pubPkItems", [], { withRh: true });
      wirePhotoPreview("pubTrFoto", "pubTrFotoPreview");
    }
  }
  $$("#pubTabs .tab-btn").forEach((t) => t.addEventListener("click", () => {
    $$("#pubTabs .tab-btn").forEach((x) => x.classList.toggle("active", x === t));
    $$(".pub-page").forEach((p) => p.classList.toggle("active", p.id === t.dataset.pubtab));
  }));
  $("#pubReqRs").addEventListener("change", async () => {
    const rs = $("#pubReqRs").value;
    refreshOperatorSelect("pubReq", rs);
    const list = await ensureMasterForRs(rs);
    refreshItemRowOptions("pubReqItems", list, !!rs);
    loadPubReqHistory();
  });
  $("#pubPkRs").addEventListener("change", async () => {
    const rs = $("#pubPkRs").value;
    refreshOperatorSelect("pubPk", rs);
    const list = await ensureMasterForRs(rs);
    refreshItemRowOptions("pubPkItems", list, !!rs);
  });
  $("#pubReqAddRow").addEventListener("click", () => addItemRow("pubReqItems", spState.masterByRs[$("#pubReqRs").value] || [], { rsChosen: !!$("#pubReqRs").value }));
  $("#pubPkAddRow").addEventListener("click", () => addItemRow("pubPkItems", spState.masterByRs[$("#pubPkRs").value] || [], { withRh: true, rsChosen: !!$("#pubPkRs").value }));

  const REQ_STATUS_LABEL = { Menunggu: "Pending", Disetujui: "Disetujui", Ditolak: "Ditolak" };
  const REQ_STATUS_PILL = { Menunggu: "pending", Disetujui: "active-yes", Ditolak: "active-no" };
  async function loadPubReqHistory() {
    const rs = $("#pubReqRs").value, operator = getOperatorNama("pubReq");
    const wrap = $("#pubReqHistoryWrap"), host = $("#pubReqHistoryHost");
    if (!rs || !operator) { wrap.hidden = true; host.innerHTML = ""; return; }
    wrap.hidden = false;
    host.innerHTML = `<p class="hlp">Memuat riwayat…</p>`;
    const res = await publicFetch("listSparepartRequestPublic", { nama_rs: rs, nama_operator: operator });
    const rows = res.ok ? (res.requests || []) : [];
    if (!rows.length) { host.innerHTML = `<p class="hlp">Belum ada request tercatat untuk RS &amp; nama ini.</p>`; return; }
    host.innerHTML = rows.map((r) => `<div class="hist-item">
        <div class="hist-top"><span class="hist-no">${esc(r.no_request)}</span>
          <span class="pill ${REQ_STATUS_PILL[r.status] || "pending"}">${esc(REQ_STATUS_LABEL[r.status] || r.status)}</span></div>
        <div class="hist-date">${esc(r.tanggal)}</div>
        <div class="hist-barang">${(r.items || []).map((it) => `${esc(it.nama_barang)} × ${esc(it.qty)}`).join(", ")}</div>
      </div>`).join("");
  }
  $("#pubReqOperator").addEventListener("change", loadPubReqHistory);
  $("#pubReqOperatorLainnya").addEventListener("blur", loadPubReqHistory);

  $("#pubReqForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#pubReqErr"), sucEl = $("#pubReqSuc");
    errEl.style.display = "none"; sucEl.style.display = "none";
    const items = collectItemRows("pubReqItems");
    if (!items.length) { errEl.textContent = "Tambahkan minimal 1 barang."; errEl.style.display = "block"; return; }
    const namaOperator = getOperatorNama("pubReq");
    if (!namaOperator) { errEl.textContent = "Nama operator wajib dipilih/diisi."; errEl.style.display = "block"; return; }
    const btn = $("#pubReqSubmitBtn"); setBtnBusy(btn, true, "Mengirim…");
    try {
      const res = await publicFetch("submitSparepartRequest", {
        tanggal: $("#pubReqTanggal").value, nama_rs: $("#pubReqRs").value, nama_operator: namaOperator,
        catatan: $("#pubReqCatatan").value.trim(), items,
      });
      if (!res.ok) { errEl.textContent = res.message || "Gagal mengirim request."; errEl.style.display = "block"; return; }
      sucEl.textContent = res.message || "Request berhasil dikirim."; sucEl.style.display = "block";
      $("#pubReqForm").reset(); $("#pubReqTanggal").value = todayISO();
      refreshOperatorSelect("pubReq", "");
      loadPubReqHistory();
      clearItemRows("pubReqItems"); addItemRow("pubReqItems", []);
    } finally { setBtnBusy(btn, false); }
  });

  $("#pubPkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#pubPkErr"), sucEl = $("#pubPkSuc");
    errEl.style.display = "none"; sucEl.style.display = "none";
    const items = collectItemRows("pubPkItems", true);
    if (!items.length) { errEl.textContent = "Tambahkan minimal 1 barang."; errEl.style.display = "block"; return; }
    const namaOperator = getOperatorNama("pubPk");
    if (!namaOperator) { errEl.textContent = "Nama operator wajib dipilih/diisi."; errEl.style.display = "block"; return; }
    const btn = $("#pubPkSubmitBtn"); setBtnBusy(btn, true, "Menyimpan…");
    try {
      const res = await publicFetch("submitSparepartUsage", {
        tanggal: $("#pubPkTanggal").value, nama_rs: $("#pubPkRs").value, nama_operator: namaOperator,
        catatan: $("#pubPkCatatan").value.trim(), items,
      });
      if (!res.ok) { errEl.textContent = res.message || "Gagal mencatat pemakaian."; errEl.style.display = "block"; return; }
      sucEl.textContent = res.message || "Pemakaian berhasil dicatat."; sucEl.style.display = "block";
      $("#pubPkForm").reset(); $("#pubPkTanggal").value = todayISO();
      refreshOperatorSelect("pubPk", "");
      clearItemRows("pubPkItems"); addItemRow("pubPkItems", [], { withRh: true });
    } finally { setBtnBusy(btn, false); }
  });

  async function refreshPubTrPengirimanOptions() {
    const rs = $("#pubTrRs").value;
    const sel = $("#pubTrPengiriman");
    $("#pubTrItemsPreview").innerHTML = "";
    if (!rs) { sel.innerHTML = `<option value="">Pilih rumah sakit dulu…</option>`; return; }
    sel.innerHTML = `<option value="">Memuat…</option>`;
    const res = await publicFetch("listPengirimanTerbuka", { nama_rs: rs });
    const list = res.ok ? (res.pengiriman || []) : [];
    spState.trOpenByRs[rs] = list;
    sel.innerHTML = `<option value="">Pilih No. Pengiriman…</option>` + list.map((p) =>
      `<option value="${esc(p.no_pengiriman)}">${esc(p.no_pengiriman)} — ${esc(p.tanggal_kirim)}</option>`).join("");
    if (!list.length) sel.innerHTML = `<option value="">Tidak ada pengiriman terbuka untuk RS ini</option>`;
  }
  $("#pubTrRs").addEventListener("change", () => { refreshOperatorSelect("pubTr", $("#pubTrRs").value); refreshPubTrPengirimanOptions(); });
  $("#pubTrPengiriman").addEventListener("change", () => {
    const rs = $("#pubTrRs").value, no = $("#pubTrPengiriman").value;
    const list = spState.trOpenByRs[rs] || [];
    const found = list.find((p) => p.no_pengiriman === no);
    $("#pubTrItemsPreview").innerHTML = found
      ? `<label>Barang di pengiriman ini</label><div class="hlp">${found.items.map((it) => `${esc(it.nama_barang)}${it.kode_barang ? " (" + esc(it.kode_barang) + ")" : ""} — ${esc(it.qty)}`).join("<br>")}</div>`
      : "";
  });
  $("#pubTrForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#pubTrErr"), sucEl = $("#pubTrSuc");
    errEl.style.display = "none"; sucEl.style.display = "none";
    const fotoInput = $("#pubTrFoto");
    if (!fotoInput.files || !fotoInput.files[0]) { errEl.textContent = "Foto barang wajib diupload."; errEl.style.display = "block"; return; }
    if (!$("#pubTrPengiriman").value) { errEl.textContent = "No. Pengiriman wajib dipilih."; errEl.style.display = "block"; return; }
    const namaOperatorTr = getOperatorNama("pubTr");
    if (!namaOperatorTr) { errEl.textContent = "Nama operator wajib dipilih/diisi."; errEl.style.display = "block"; return; }
    const btn = $("#pubTrSubmitBtn"); setBtnBusy(btn, true, "Mengunggah foto…");
    try {
      const fotoUrl = await compressAndUploadPhoto(fotoInput);
      setBtnBusy(btn, true, "Mengirim…");
      const res = await publicFetch("submitSparepartPenerimaan", {
        tanggal_terima: $("#pubTrTanggal").value, nama_rs: $("#pubTrRs").value, nama_operator: namaOperatorTr,
        no_pengiriman: $("#pubTrPengiriman").value, foto_barang_url: fotoUrl,
      });
      if (!res.ok) { errEl.textContent = res.message || "Gagal mengirim konfirmasi."; errEl.style.display = "block"; return; }
      sucEl.textContent = res.message || "Konfirmasi berhasil dikirim."; sucEl.style.display = "block";
      $("#pubTrForm").reset(); $("#pubTrTanggal").value = todayISO(); $("#pubTrFotoPreview").style.display = "none";
      refreshOperatorSelect("pubTr", "");
      $("#pubTrPengiriman").innerHTML = `<option value="">Pilih rumah sakit dulu…</option>`;
    } catch (err) {
      errEl.textContent = err.message || "Gagal mengunggah foto."; errEl.style.display = "block";
    } finally { setBtnBusy(btn, false); }
  });

  function showSpPage(id) {
    $$("#spApp .page").forEach((p) => p.classList.toggle("active", p.id === id));
    $$("#spTabs .tab-btn").forEach((t) => t.classList.toggle("active", t.dataset.sptab === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "sp-stok") loadSpStock();
    if (id === "sp-request") loadSpRequests();
    if (id === "sp-penerimaan") loadSpPenerimaan();
    if (id === "sp-riwayat-kirim") loadSpPengirimanRiwayat();
    if (id === "sp-pemakaian") loadSpPemakaianList();
    if (id === "sp-master") loadSpMasterList();
  }
  $$("#spTabs .tab-btn").forEach((t) => t.addEventListener("click", () => showSpPage(t.dataset.sptab)));

  function renderRsIndexList(host, sel) {
    const list = (state.allRs || []).slice().sort((a, b) => a.nama_rs.localeCompare(b.nama_rs));
    if (!list.length) { host.innerHTML = `<div class="empty"><p>Belum ada Rumah Sakit terdaftar.</p></div>`; return; }
    host.innerHTML = `<div class="rs-index-hint">Pilih Rumah Sakit untuk melihat detail:</div>
      <div class="rs-index-grid">${list.map((r) => `<button type="button" class="rs-index-item" data-rs-pick="${esc(r.nama_rs)}">${esc(r.nama_rs)}</button>`).join("")}</div>`;
    $$("[data-rs-pick]", host).forEach((b) => b.addEventListener("click", () => {
      sel.value = b.dataset.rsPick;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }));
  }

  async function loadSpStock() {
    const host = $("#spStokHost");
    showLoading(host);
    try {
      await ensureAllRsLoaded();
      const sel = $("#spStokRsFilter");
      if (!sel.dataset.filled) {
        sel.innerHTML += (state.allRs || []).map((r) => `<option value="${esc(r.nama_rs)}">${esc(r.nama_rs)}</option>`).join("");
        sel.dataset.filled = "1";
      }
      if (!sel.value) { renderRsIndexList(host, sel); return; }
      const res = await authedFetch("getStockSparepart", { nama_rs: sel.value });
      if (!res.ok) { host.innerHTML = `<div class="empty"><p>${esc(res.message || "Gagal memuat stok.")}</p></div>`; return; }
      const rows = res.stock || [];
      spStokState.byItemId = {};
      rows.forEach((r) => { spStokState.byItemId[r.item_id] = r; });
      if (!rows.length) { host.innerHTML = `<div class="empty"><p>Belum ada barang di Sparepart Master untuk RS ini. Tambahkan lewat "Kelola Sparepart" dulu.</p></div>`; return; }
      const items = rows.slice().sort((a, b) => (a.nama_barang || "").localeCompare(b.nama_barang || ""));
      const body = items.map((it) => `<tr>
          <td class="name">${esc(it.nama_barang)}</td><td>${esc(it.kode_barang || "–")}</td>
          <td class="stock-qty${it.qty === 0 ? " zero" : ""}">${esc(it.qty)}${it.satuan ? " " + esc(it.satuan) : ""}</td>
          <td>${esc(it.dipakai_bulan_ini || 0)}</td>
          <td>${esc(it.catatan || "–")}</td>
          <td><button class="stok-adjust-btn" type="button" data-stok-adjust="${esc(it.item_id)}" title="Penyesuaian Stok Manual">✎</button></td>
        </tr>`).join("");
      host.innerHTML = `<div class="card stok-rs-card">
        <div class="stok-rs-head">${esc(sel.value)}</div>
        <table class="data"><thead><tr><th>Nama Sparepart</th><th>Kode Barang</th><th>Stock</th><th>Sudah Dipakai (bulan ini)</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>${body}</tbody></table>
      </div>`;
      $$("[data-stok-adjust]", host).forEach((b) => b.addEventListener("click", () => openStokAdjustModal(b.dataset.stokAdjust)));
    } catch (e) {
      host.innerHTML = `<div class="empty"><p>Tidak dapat memuat data. Periksa koneksi lalu coba lagi.</p></div>`;
    } finally { hideLoading(host); }
  }
  wireReloadBtn("#spStokRefreshBtn", loadSpStock);
  $("#spStokRsFilter").addEventListener("change", loadSpStock);

  const spStokState = { byItemId: {}, currentItemId: "" };
  function openStokAdjustModal(itemId) {
    const it = spStokState.byItemId[itemId];
    if (!it) return;
    spStokState.currentItemId = itemId;
    $("#spStokAdjustErr").style.display = "none";
    const label = it.kode_barang ? `${it.nama_barang} (KODE : ${it.kode_barang})` : it.nama_barang;
    $("#spStokAdjustLabel").textContent = `${label} — ${it.nama_rs}`;
    $("#spStokAdjustCurrent").value = it.qty;
    $("#spStokAdjustNew").value = it.qty;
    $("#spStokAdjustCatatan").value = "";
    openModal("spStokAdjustModal");
  }
  function closeStokAdjustModal() { closeModal("spStokAdjustModal"); }
  $("#spStokAdjustCloseBtn").addEventListener("click", closeStokAdjustModal);
  $("#spStokAdjustCancelBtn").addEventListener("click", closeStokAdjustModal);
  $("#spStokAdjustSaveBtn").addEventListener("click", async () => {
    const errEl = $("#spStokAdjustErr"); errEl.style.display = "none";
    const qtyBaru = num($("#spStokAdjustNew").value);
    if (qtyBaru === null) { errEl.textContent = "Jumlah stok baru harus berupa angka."; errEl.style.display = "block"; return; }
    const btn = $("#spStokAdjustSaveBtn"); setBtnBusy(btn, true, "Menyimpan…");
    showLoading($("#spStokAdjustModal .modal-card"));
    try {
      const res = await authedFetch("submitSparepartPenyesuaian", {
        item_id: spStokState.currentItemId, qty_baru: qtyBaru, catatan: $("#spStokAdjustCatatan").value.trim(),
      });
      if (!res.ok) { errEl.textContent = res.message || "Gagal menyimpan penyesuaian."; errEl.style.display = "block"; return; }
      toast(res.message || "Penyesuaian stok tersimpan.", "ok");
      closeStokAdjustModal();
      loadSpStock();
    } finally { setBtnBusy(btn, false); hideLoading($("#spStokAdjustModal .modal-card")); }
  });

  let spReqViewMode = "antrian";
  $$("#spReqViewTabs button").forEach((b) => b.addEventListener("click", () => {
    spReqViewMode = b.dataset.spreqview;
    $$("#spReqViewTabs button").forEach((x) => x.classList.toggle("active", x === b));
    loadSpRequests();
  }));
  async function loadSpRequests() {
    const host = $("#spReqHost");
    showLoading(host);
    try {
      const res = await authedFetch("listSparepartRequests", { status: "" });
      if (!res.ok) { host.innerHTML = `<div class="empty"><p>${esc(res.message || "Gagal memuat request.")}</p></div>`; return; }
      const all = res.requests || [];
      const counts = { pending: 0, proses: 0, selesai: 0, batal: 0 };
      all.forEach((r) => {
        if (r.status === "Menunggu") counts.pending++;
        else if (r.status === "Disetujui") counts.selesai++;
        else if (r.status === "Ditolak") counts.batal++;
      });
      $("#spReqStatTiles").innerHTML = `
        <div class="stat-tile st-pending"><div class="stat-num">${counts.pending}</div><div class="stat-label">Pending</div><div class="stat-sub">Belum diproses</div></div>
        <div class="stat-tile st-proses"><div class="stat-num">${counts.proses}</div><div class="stat-label">Diproses</div><div class="stat-sub">Diteruskan ke Logistik</div></div>
        <div class="stat-tile st-selesai"><div class="stat-num">${counts.selesai}</div><div class="stat-label">Selesai</div><div class="stat-sub">Disetujui Teknisi</div></div>
        <div class="stat-tile st-batal"><div class="stat-num">${counts.batal}</div><div class="stat-label">Dibatalkan</div><div class="stat-sub">Ditolak Teknisi</div></div>`;
      const rows = spReqViewMode === "antrian" ? all.filter((r) => r.status === "Menunggu") : all.filter((r) => r.status !== "Menunggu");
      if (!rows.length) { host.innerHTML = `<div class="empty"><p>${spReqViewMode === "antrian" ? "Tidak ada request yang menunggu." : "Belum ada riwayat request."}</p></div>`; return; }
      host.innerHTML = `<div class="req-cards">` + rows.map((r) => {
        const statusLabel = r.status === "Disetujui" ? "Selesai" : r.status === "Ditolak" ? "Dibatalkan" : "Pending";
        const statusPill = r.status === "Disetujui" ? "active-yes" : r.status === "Ditolak" ? "active-no" : "pending";
        const barangHtml = (r.items || []).map((it) => `${esc(it.nama_barang)} × ${esc(it.qty)}`).join(", ");
        return `<div class="req-card">
          <div class="req-card-top">
            <span class="req-badge">PERMINTAAN TEKNISI</span>
            <span class="req-no">${esc(r.no_request)}</span>
            <span class="req-via">via form publik</span>
            <span class="req-date">${esc(r.tanggal)}</span>
          </div>
          <div class="req-body">
            <div><b>${esc(r.nama_operator)}</b> · Operator RS</div>
            <div>Att/Lokasi: ${esc(r.nama_rs)}</div>
            <div>Subjek: Request Barang${r.catatan_operator ? " — " + esc(r.catatan_operator) : ""}</div>
            <div>Barang: ${barangHtml || "–"}</div>
          </div>
          <div class="req-card-foot">
            <span class="pill ${statusPill}">${esc(statusLabel)}</span>
            <div class="req-actions">${r.status === "Menunggu"
              ? `<button class="btn btn-primary btn-tiny" data-sp-req-approve="${esc(r.no_request)}" type="button">Setujui</button>
                 <button class="btn btn-ghost btn-tiny" data-sp-req-reject="${esc(r.no_request)}" type="button">Tolak</button>`
              : (r.catatan_teknisi ? `<span class="hlp">${esc(r.catatan_teknisi)}</span>` : "")}</div>
          </div>
        </div>`;
      }).join("") + `</div>`;
      $$("[data-sp-req-approve]", host).forEach((b) => b.addEventListener("click", () => reviewSpRequest(b.dataset.spReqApprove, true)));
      $$("[data-sp-req-reject]", host).forEach((b) => b.addEventListener("click", () => reviewSpRequest(b.dataset.spReqReject, false)));
    } finally { hideLoading(host); }
  }
  wireReloadBtn("#spReqRefreshBtn", loadSpRequests);
  async function reviewSpRequest(noRequest, approve) {
    const catatan = approve ? "" : (prompt("Catatan penolakan (opsional):") || "");
    const res = await authedFetch("reviewSparepartRequest", { no_request: noRequest, approve, catatan_teknisi: catatan });
    if (!res.ok) { toast(res.message || "Gagal memproses request.", "err"); return; }
    toast(res.message || "Berhasil.", "ok");
    loadSpRequests();
  }

  async function loadSpPenerimaan() {
    const host = $("#spTrHost");
    showLoading(host);
    try {
      const status = $("#spTrStatusFilter").value;
      const res = await authedFetch("listSparepartPenerimaan", { status });
      if (!res.ok) { host.innerHTML = `<div class="empty"><p>${esc(res.message || "Gagal memuat data.")}</p></div>`; return; }
      const rows = res.penerimaan || [];
      if (!rows.length) { host.innerHTML = `<div class="empty"><p>Tidak ada data.</p></div>`; return; }
      const head = `<tr><th>No. Penerimaan</th><th>No. Pengiriman</th><th>Tanggal</th><th>Rumah Sakit</th><th>Operator</th><th>Barang</th><th>Foto</th><th>Status</th><th>Aksi</th></tr>`;
      const body = rows.map((r) => `<tr>
          <td class="name">${esc(r.no_penerimaan)}</td><td>${esc(r.no_pengiriman)}</td><td>${esc(r.tanggal_terima)}</td>
          <td>${esc(r.nama_rs)}</td><td>${esc(r.nama_operator)}</td>
          <td>${(r.items || []).map((it) => `${esc(it.nama_barang)} × ${esc(it.qty)}`).join("<br>")}</td>
          <td>${r.foto_barang_url ? `<a class="photo-link" href="${esc(r.foto_barang_url)}" target="_blank" rel="noopener">Lihat foto</a>` : "–"}</td>
          <td><span class="pill ${r.status === "Disetujui" ? "active-yes" : r.status === "Ditolak" ? "active-no" : "pending"}">${esc(r.status)}</span></td>
          <td class="actions-cell">${r.status === "Menunggu"
            ? `<button class="btn btn-primary btn-tiny" data-sp-tr-approve="${esc(r.no_penerimaan)}" type="button">Setujui</button>
               <button class="btn btn-ghost btn-tiny" data-sp-tr-reject="${esc(r.no_penerimaan)}" type="button">Tolak</button>`
            : (r.catatan_teknisi ? esc(r.catatan_teknisi) : "–")}</td>
        </tr>`).join("");
      host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
      $$("[data-sp-tr-approve]", host).forEach((b) => b.addEventListener("click", () => reviewSpPenerimaan(b.dataset.spTrApprove, true)));
      $$("[data-sp-tr-reject]", host).forEach((b) => b.addEventListener("click", () => reviewSpPenerimaan(b.dataset.spTrReject, false)));
    } finally { hideLoading(host); }
  }
  wireReloadBtn("#spTrRefreshBtn", loadSpPenerimaan);
  $("#spTrStatusFilter").addEventListener("change", loadSpPenerimaan);
  async function reviewSpPenerimaan(noPenerimaan, approve) {
    const catatan = approve ? "" : (prompt("Catatan penolakan (opsional):") || "");
    const res = await authedFetch("reviewSparepartPenerimaan", { no_penerimaan: noPenerimaan, approve, catatan_teknisi: catatan });
    if (!res.ok) { toast(res.message || "Gagal memproses.", "err"); return; }
    toast(res.message || "Berhasil — stok diperbarui otomatis bila disetujui.", "ok");
    loadSpPenerimaan();
  }

  function renderPengirimanTable(rows) {
    const head = `<tr><th>No. Pengiriman</th><th>No. Request Barang</th><th>Tanggal Kirim</th><th>Rumah Sakit</th><th>Barang</th><th>Penerima</th><th>Resi</th><th>Barang Diterima</th><th>Status</th><th>Catatan</th></tr>`;
    const body = rows.map((r) => `<tr>
        <td class="name">${esc(r.no_pengiriman)}</td><td>${esc(r.no_permintaan || "–")}</td><td>${esc(r.tanggal_kirim)}</td><td>${esc(r.nama_rs)}</td>
        <td>${(r.items || []).map((it) => `${esc(it.nama_barang)} × ${esc(it.qty)}`).join("<br>")}</td>
        <td>${esc(r.penerima_nama)}${r.penerima_hp ? "<br>" + esc(r.penerima_hp) : ""}</td>
        <td>${r.foto_resi_url ? `<a class="photo-link" href="${esc(r.foto_resi_url)}" target="_blank" rel="noopener">Lihat foto</a>` : "–"}</td>
        <td>${r.foto_penerimaan_url ? `<a class="photo-link" href="${esc(r.foto_penerimaan_url)}" target="_blank" rel="noopener">Lihat foto</a>` : "–"}</td>
        <td><span class="pill ${r.status === "Diterima" ? "active-yes" : "pending"}">${esc(r.status === "Dikirim" ? "Dalam Perjalanan" : r.status)}</span></td>
        <td>${esc(r.catatan || "–")}</td>
      </tr>`).join("");
    return `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }
  async function loadSpPengirimanRiwayat() {
    const host = $("#spKrmHost");
    showLoading(host);
    try {
      const res = await authedFetch("listSparepartPengiriman", {});
      if (!res.ok) { host.innerHTML = `<div class="empty"><p>${esc(res.message || "Gagal memuat.")}</p></div>`; return; }
      const rows = res.pengiriman || [];
      host.innerHTML = rows.length ? renderPengirimanTable(rows) : `<div class="empty"><p>Belum ada pengiriman.</p></div>`;
    } finally { hideLoading(host); }
  }
  wireReloadBtn("#spKrmRefreshBtn", loadSpPengirimanRiwayat);

  async function loadSpPemakaianList() {
    const host = $("#spPkHost");
    showLoading(host);
    try {
      await ensureAllRsLoaded();
      const sel = $("#spPkRsFilter");
      if (!sel.dataset.filled) {
        sel.innerHTML += (state.allRs || []).map((r) => `<option value="${esc(r.nama_rs)}">${esc(r.nama_rs)}</option>`).join("");
        sel.dataset.filled = "1";
      }
      if (!sel.value) { renderRsIndexList(host, sel); return; }
      const res = await authedFetch("listSparepartPemakaian", {});
      if (!res.ok) { host.innerHTML = `<div class="empty"><p>${esc(res.message || "Gagal memuat.")}</p></div>`; return; }
      const rows = (res.pemakaian || []).filter((r) => (r.nama_rs || "").trim().toLowerCase() === sel.value.trim().toLowerCase());
      if (!rows.length) { host.innerHTML = `<div class="empty"><p>Belum ada data pemakaian untuk RS ini.</p></div>`; return; }
      const head = `<tr><th>No. Pemakaian</th><th>Tanggal</th><th>Operator</th><th>Barang</th><th>Catatan</th></tr>`;
      const body = rows.map((r) => `<tr><td class="name">${esc(r.no_pemakaian)}</td><td>${esc(r.tanggal)}</td><td>${esc(r.nama_operator)}</td>
        <td>${(r.items || []).map((it) => `${esc(it.nama_barang)} × ${esc(it.qty)}${it.rh ? " (RH " + esc(it.rh) + ")" : ""}`).join("<br>")}</td>
        <td>${esc(r.catatan || "–")}</td></tr>`).join("");
      host.innerHTML = `<div class="card stok-rs-card">
        <div class="stok-rs-head">${esc(sel.value)}</div>
        <table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>
      </div>`;
    } catch (e) {
      host.innerHTML = `<div class="empty"><p>Tidak dapat memuat data. Periksa koneksi lalu coba lagi.</p></div>`;
    } finally { hideLoading(host); }
  }
  wireReloadBtn("#spPkRefreshBtn", loadSpPemakaianList);
  $("#spPkRsFilter").addEventListener("change", loadSpPemakaianList);

  let spMasterTarget = "";
  async function loadSpMasterList() {
    const host = $("#spMasterHost");
    showLoading(host);
    try {
      await ensureAllRsLoaded();
      const sel = $("#spMasterRsFilter");
      if (!sel.dataset.filled) {
        sel.innerHTML += (state.allRs || []).map((r) => `<option value="${esc(r.nama_rs)}">${esc(r.nama_rs)}</option>`).join("");
        sel.dataset.filled = "1";
      }
      if (!sel.value) { renderRsIndexList(host, sel); return; }
      const res = await authedFetch("listSparepartMaster", { nama_rs: sel.value });
      if (!res.ok) { host.innerHTML = `<div class="empty"><p>${esc(res.message || "Gagal memuat.")}</p></div>`; return; }
      const rows = res.items || [];
      state.allSpMaster = rows;
      if (!rows.length) { host.innerHTML = `<div class="empty"><p>Belum ada barang terdaftar untuk RS ini.</p></div>`; return; }
      const head = `<tr><th>Nama Sparepart</th><th>Kode Barang</th><th>Catatan</th><th>Aksi</th></tr>`;
      const body = rows.map((r) => `<tr${r.active ? "" : ' style="opacity:.55"'}>
          <td class="name">${esc(r.nama_barang)}</td><td>${esc(r.kode_barang || "–")}</td>
          <td>${esc(r.catatan || "–")}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-tiny" data-sp-master-edit="${esc(r.item_id)}" type="button">Edit</button>
            <button class="btn btn-ghost btn-tiny" data-sp-master-toggle="${esc(r.item_id)}" data-active="${r.active ? 1 : 0}" type="button">${r.active ? "Nonaktifkan" : "Aktifkan"}</button>
            <button class="btn btn-danger btn-tiny" data-sp-master-delete="${esc(r.item_id)}" type="button">Hapus</button>
          </td>
        </tr>`).join("");
      host.innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
      $$("[data-sp-master-edit]", host).forEach((b) => b.addEventListener("click", () => openSpMasterModal(b.dataset.spMasterEdit)));
      $$("[data-sp-master-toggle]", host).forEach((b) => b.addEventListener("click", () => toggleSpMasterActive(b.dataset.spMasterToggle, b.dataset.active !== "1")));
      $$("[data-sp-master-delete]", host).forEach((b) => b.addEventListener("click", () => deleteSpMaster(b.dataset.spMasterDelete)));
    } catch (e) {
      host.innerHTML = `<div class="empty"><p>Tidak dapat memuat data. Periksa koneksi lalu coba lagi.</p></div>`;
    } finally { hideLoading(host); }
  }
  wireReloadBtn("#spMasterRefreshBtn", loadSpMasterList);
  $("#spMasterRsFilter").addEventListener("change", loadSpMasterList);
  async function toggleSpMasterActive(itemId, makeActive) {
    const res = await authedFetch("setSparepartMasterActive", { item_id: itemId, active: makeActive });
    if (!res.ok) { toast(res.message || "Gagal memperbarui status.", "err"); return; }
    toast(res.message || "Status diperbarui.", "ok");
    loadSpMasterList();
  }
  async function deleteSpMaster(itemId) {
    const row = (state.allSpMaster || []).find((r) => r.item_id === itemId);
    const label = row ? row.nama_barang : itemId;
    const ok = confirm(`Hapus barang ${label}? Histori transaksi yang sudah ada tidak akan terhapus, tapi barang ini tidak akan muncul lagi di daftar pilihan.`);
    if (!ok) return;
    const res = await authedFetch("deleteSparepartMaster", { item_id: itemId });
    if (!res.ok) { toast(res.message || "Gagal menghapus barang.", "err"); return; }
    toast(res.message || "Barang berhasil dihapus.", "ok");
    loadSpMasterList();
  }
  async function openSpMasterModal(itemId) {
    spMasterTarget = itemId || "";
    const isNew = !spMasterTarget;
    const row = isNew ? {} : ((state.allSpMaster || []).find((r) => r.item_id === itemId) || {});
    $("#spMasterModalTitle").textContent = isNew ? "Tambah Barang" : "Edit " + (row.nama_barang || "");
    $("#spMasterErr").style.display = "none";
    await ensureAllRsLoaded();
    const rsSel = $("#spMasterRs");
    rsSel.innerHTML = `<option value="">Pilih rumah sakit…</option>` + (state.allRs || []).map((r) => `<option value="${esc(r.nama_rs)}">${esc(r.nama_rs)}</option>`).join("");
    rsSel.value = isNew ? ($("#spMasterRsFilter").value || "") : (row.nama_rs || "");
    $("#spMasterKode").value = row.kode_barang || "";
    $("#spMasterNama").value = row.nama_barang || "";
    $("#spMasterSatuan").value = row.satuan || "";
    openModal("spMasterModal");
  }
  $("#spMasterAddBtn").addEventListener("click", () => openSpMasterModal(""));
  $("#spMasterCloseBtn").addEventListener("click", () => closeModal("spMasterModal"));
  $("#spMasterCancelBtn").addEventListener("click", () => closeModal("spMasterModal"));
  $("#spMasterSaveBtn").addEventListener("click", async () => {
    const namaRs = $("#spMasterRs").value, kode = ($("#spMasterKode").value || "").trim(),
      nama = $("#spMasterNama").value.trim(), satuan = $("#spMasterSatuan").value.trim();
    const errEl = $("#spMasterErr");
    if (!namaRs) { errEl.textContent = "Rumah Sakit wajib dipilih."; errEl.style.display = "block"; return; }
    if (!nama) { errEl.textContent = "Nama Barang wajib diisi."; errEl.style.display = "block"; return; }
    const btn = $("#spMasterSaveBtn"); btn.disabled = true; btn.textContent = "Menyimpan…";
    showLoading($("#spMasterModal .modal-card"));
    try {
      const res = await authedFetch("setSparepartMaster", { item_id: spMasterTarget, nama_rs: namaRs, kode_barang: kode, nama_barang: nama, satuan });
      if (!res.ok) { errEl.textContent = res.message || "Gagal menyimpan barang."; errEl.style.display = "block"; return; }
      closeModal("spMasterModal");
      toast(res.message || "Barang berhasil disimpan.", "ok");
      spState.masterByRs = {};
      loadSpMasterList();
    } finally { btn.disabled = false; btn.textContent = "Simpan"; hideLoading($("#spMasterModal .modal-card")); }
  });

  async function exportSparepartRecapBulanan() {
    if (typeof XlsxLite === "undefined") { toast("Modul Excel belum termuat. Muat ulang halaman lalu coba lagi.", "err"); return; }
    const btn = $("#spMasterRecapBtn"); setBtnBusy(btn, true, "Menyiapkan…");
    try {
      const res = await authedFetch("getSparepartRecapBulanan", {});
      if (!res.ok) { toast(res.message || "Gagal mengambil data rekap.", "err"); return; }
      const bulan = res.bulan || { label: "" }, items = res.items || [];
      if (!items.length) { toast("Belum ada barang terdaftar untuk direkap.", "warn"); return; }
      const header = ["RUMAH SAKIT", "SPAREPART", bulan.label, "PENYESUAIAN", "DIKIRIM"];
      const aoa = [];
      aoa.push(["PT GENERATOR PASIFIK INDONESIA — RECAP BULANAN SPAREPART"]);
      aoa.push([`Diekspor: ${new Date().toLocaleString("id-ID")}  ·  ${items.length} barang`]);
      aoa.push(header);
      const dataStartRow = aoa.length;
      const byRs = {};
      const rsOrder = [];
      items.forEach((it) => {
        if (!byRs[it.nama_rs]) { byRs[it.nama_rs] = []; rsOrder.push(it.nama_rs); }
        byRs[it.nama_rs].push(it);
      });
      rsOrder.sort();
      const merges = [`A1:E1`, `A2:E2`];
      rsOrder.forEach((rs) => {
        const groupStartRow = aoa.length;
        byRs[rs].forEach((it) => {
          const sparepartLabel = it.kode_barang ? `${it.nama_barang} (KODE : ${it.kode_barang})` : it.nama_barang;
          aoa.push([rs, sparepartLabel, it.qty || 0, it.penyesuaian || 0, it.dikirim || 0]);
        });
        const groupEndRow = aoa.length - 1;
        if (groupEndRow > groupStartRow) merges.push(`A${groupStartRow + 1}:A${groupEndRow + 1}`);
      });
      const colWidths = [22, 40, 12, 14, 12];
      const lastCol = "E";
      XlsxLite.download(`Recap_Bulanan_Sparepart_${todayISO()}.xlsx`, [{
        name: "Recap Bulanan", aoa: aoa, colWidths: colWidths,
        merges: merges,
        titleRows: [0], subtitleRows: [1], headerRows: [2],
        borderFrom: 2, bandedFrom: dataStartRow, rightAlignCols: [2, 3, 4],
        autofilter: `A3:${lastCol}3`, freeze: [2, dataStartRow],
      }]);
      toast("Recap Bulanan berhasil diunduh.", "ok");
    } finally { setBtnBusy(btn, false); }
  }
  $("#spMasterRecapBtn").addEventListener("click", exportSparepartRecapBulanan);

  async function enterSparepartApp() {
    showOnly("spApp");
    $("#spUserName").textContent = AUTH.name || AUTH.username;
    const roleEl = $("#spUserRole");
    roleEl.textContent = ROLE_LABEL[AUTH.role] || String(AUTH.role).toUpperCase();
    roleEl.classList.remove("admin", "teknisi"); roleEl.classList.add(AUTH.role);
    showSpPage("sp-stok");
  }
  $("#spBackToChoiceBtn").addEventListener("click", () => showRoleChoice());
  $("#spLogoutBtn").addEventListener("click", async () => {
    const btn = $("#spLogoutBtn"); setBtnBusy(btn, true, "Keluar…");
    try { await authedFetch("logout", {}); } catch (e) {}
    doLogoutLocal();
    setBtnBusy(btn, false);
  });

  function showLogPage(id) {
    $$("#logistikApp .page").forEach((p) => p.classList.toggle("active", p.id === id));
    $$("#logTabs .tab-btn").forEach((t) => t.classList.toggle("active", t.dataset.logtab === id));
    if (id === "log-riwayat") loadLogRiwayat();
  }
  $$("#logTabs .tab-btn").forEach((t) => t.addEventListener("click", () => showLogPage(t.dataset.logtab)));
  $("#logLogoutBtn").addEventListener("click", async () => {
    const btn = $("#logLogoutBtn"); setBtnBusy(btn, true, "Keluar…");
    try { await authedFetch("logout", {}); } catch (e) {}
    doLogoutLocal();
    setBtnBusy(btn, false);
  });
  $("#logKrmAddRow").addEventListener("click", () => addItemRow("logKrmItems", spState.masterByRs[$("#logKrmRs").value] || [], { rsChosen: !!$("#logKrmRs").value, allowManual: true }));
  $("#logKrmRs").addEventListener("change", async () => {
    const rs = $("#logKrmRs").value;
    const list = await ensureMasterForRs(rs);
    refreshItemRowOptions("logKrmItems", list, !!rs, true);
  });

  $("#logKrmForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const items = collectItemRows("logKrmItems");
    if (!items.length) { toast("Tambahkan minimal 1 barang.", "err"); return; }
    if (!$("#logKrmRs").value) { toast("Pilih rumah sakit.", "err"); return; }
    if (!$("#logKrmPenerimaNama").value.trim()) { toast("Nama Penerima wajib diisi.", "err"); return; }
    if (!$("#logKrmPengirimNama").value.trim()) { toast("Nama Pengirim wajib diisi.", "err"); return; }
    const fotoInputChk = $("#logKrmFotoResi");
    if (!fotoInputChk.files || !fotoInputChk.files[0]) { toast("Foto resi wajib diisi.", "err"); return; }
    const btn = $("#logKrmSubmitBtn"); setBtnBusy(btn, true, "Menyimpan…");
    try {
      let fotoUrl = "";
      const fotoInput = $("#logKrmFotoResi");
      if (fotoInput.files && fotoInput.files[0]) {
        setBtnBusy(btn, true, "Mengunggah foto…");
        fotoUrl = await compressAndUploadPhoto(fotoInput);
        setBtnBusy(btn, true, "Menyimpan…");
      }
      const res = await authedFetch("submitSparepartPengiriman", {
        no_permintaan: $("#logKrmPermintaan").value.trim(), nama_rs: $("#logKrmRs").value, tanggal_kirim: $("#logKrmTanggal").value,
        penerima_nama: $("#logKrmPenerimaNama").value.trim(), penerima_hp: $("#logKrmPenerimaHp").value.trim(),
        foto_resi_url: fotoUrl, items,
        nama_pengirim: $("#logKrmPengirimNama").value.trim(), jabatan_pengirim: $("#logKrmPengirimJabatan").value.trim(),
        catatan: $("#logKrmCatatan").value.trim(),
      });
      if (!res.ok) { toast(res.message || "Gagal mencatat pengiriman.", "err"); return; }
      toast(res.message || "Pengiriman berhasil dicatat.", "ok");
      $("#logKrmForm").reset(); $("#logKrmTanggal").value = todayISO(); $("#logKrmFotoPreview").style.display = "none";
      clearItemRows("logKrmItems"); addItemRow("logKrmItems", [], { allowManual: true });
    } catch (err) {
      toast(err.message || "Gagal mengunggah foto.", "err");
    } finally { setBtnBusy(btn, false); }
  });
  async function loadLogRiwayat() {
    const host = $("#logRiwayatHost");
    showLoading(host);
    try {
      const res = await authedFetch("listSparepartPengiriman", { mine: true });
      if (!res.ok) { host.innerHTML = `<div class="empty"><p>${esc(res.message || "Gagal memuat.")}</p></div>`; return; }
      const rows = res.pengiriman || [];
      host.innerHTML = rows.length ? renderPengirimanTable(rows) : `<div class="empty"><p>Belum ada pengiriman yang Anda catat.</p></div>`;
    } finally { hideLoading(host); }
  }
  wireReloadBtn("#logRiwayatRefreshBtn", loadLogRiwayat);

  async function enterLogistikApp() {
    showOnly("logistikApp");
    await ensureRsPublicLoaded(true);
    $("#logKrmRs").innerHTML = rsOptionsHtml(spState.rsPublic);
    $("#logKrmTanggal").value = todayISO();
    wirePhotoPreview("logKrmFotoResi", "logKrmFotoPreview");
    clearItemRows("logKrmItems"); addItemRow("logKrmItems", [], { allowManual: true });
    showLogPage("log-kirim");
  }

  function showRoleChoice() {
    $("#roleChoiceUserLabel").textContent = (AUTH.name || AUTH.username) + " (" + (ROLE_LABEL[AUTH.role] || AUTH.role) + ")";
    showOnly("roleChoicePage");
  }
  $("#choiceLaporanBtn").addEventListener("click", () => enterApp());
  $("#choiceSparepartBtn").addEventListener("click", () => enterSparepartApp());
  $("#appBackToChoiceBtn").addEventListener("click", () => showRoleChoice());
  $("#roleChoiceLogoutBtn").addEventListener("click", async () => {
    const btn = $("#roleChoiceLogoutBtn"); setBtnBusy(btn, true, "Keluar…");
    try { await authedFetch("logout", {}); } catch (e) {}
    doLogoutLocal();
    setBtnBusy(btn, false);
  });
  async function routeAfterLogin() {
    if (isRs()) { await enterApp(); return; }
    if (isLogistik()) { await enterLogistikApp(); return; }
    showRoleChoice();
  }

  function showOnly(pageEl) {
    ["bootCheck", "loginPage", "bootstrapPage", "portalPage", "publicSparepartPage", "roleChoicePage", "app", "spApp", "logistikApp"]
      .forEach((id) => $("#" + id).classList.toggle("hidden", id !== pageEl));
  }

  function pickOperatorName(operators) {
    if (!operators || !operators.length) return Promise.resolve("");
    return new Promise((resolve) => {
      const modal = $("#opPickModal"), list = $("#opPickList"), other = $("#opPickOther"), btn = $("#opPickOtherBtn");
      list.innerHTML = operators.map((o) =>
        `<button class="btn btn-secondary" type="button" style="display:block;width:100%;margin-bottom:8px" data-op="${esc(o)}">${esc(o)}</button>`
      ).join("");
      other.value = "";
      const finish = (name) => {
        modal.classList.remove("show");
        list.removeEventListener("click", onListClick);
        btn.removeEventListener("click", onOtherClick);
        resolve(name);
      };
      const onListClick = (e) => {
        const b = e.target.closest("[data-op]");
        if (!b) return;
        finish(b.dataset.op);
      };
      const onOtherClick = () => finish(other.value.trim());
      list.addEventListener("click", onListClick);
      btn.addEventListener("click", onOtherClick);
      modal.classList.add("show");
    });
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#lgUser").value.trim(), password = $("#lgPass").value;
    const errEl = $("#loginErr"); errEl.style.display = "none";
    const btn = $("#loginBtn"); setBtnBusy(btn, true, "Memeriksa…");
    try {
      const data = await gasFetch({ type: "login", username, password });
      if (!data.ok) { errEl.textContent = data.message || "Login gagal."; errEl.style.display = "block"; return; }
      saveAuth({
        token: data.token, role: data.role, name: data.name, username: data.username,
        nama_rs: data.nama_rs || "", daerah_rs: data.daerah_rs || "", operators: data.operators || [],
      });
      if (data.role === "rs") {
        const operatorNama = await pickOperatorName(data.operators || []);
        try { await authedFetch("confirmRsOperatorLogin", { operator_nama: operatorNama }); } catch (e2) {}
      }
      await routeAfterLogin();
    } catch (err) {
      errEl.textContent = "Tidak dapat menghubungi backend."; errEl.style.display = "block";
    } finally { setBtnBusy(btn, false); }
  });

  $("#bootForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#bsUser").value.trim(), password = $("#bsPass").value, name = $("#bsName").value.trim();
    const errEl = $("#bootErr"), sucEl = $("#bootSuc");
    errEl.style.display = "none"; sucEl.style.display = "none";
    const btn = $("#bootBtn"); btn.disabled = true; btn.textContent = "Membuat akun…";
    try {
      const data = await gasFetch({ type: "bootstrapAdmin", username, password, name });
      if (!data.ok) { errEl.textContent = data.message || "Gagal membuat akun."; errEl.style.display = "block"; return; }
      sucEl.textContent = "Akun admin berhasil dibuat. Silakan login."; sucEl.style.display = "block";
      setTimeout(() => { showOnly("loginPage"); $("#lgUser").value = username; }, 1000);
    } catch (err) {
      errEl.textContent = "Tidak dapat menghubungi backend."; errEl.style.display = "block";
    } finally { btn.disabled = false; btn.textContent = "Buat Akun Admin"; }
  });

  function doLogoutLocal() {
    clearAuth();
    showOnly("portalPage");
  }
  $("#logoutBtn").addEventListener("click", async () => {
    const btn = $("#logoutBtn"); setBtnBusy(btn, true, "Keluar…");
    try { await authedFetch("logout", {}); } catch (e) {}
    doLogoutLocal();
    setBtnBusy(btn, false);
    toast("Anda telah keluar.", "ok");
  });

  async function enterApp() {
    showOnly("app");
    applyRoleVisibility();
    showPage(isRs() ? "page-input" : "page-report");
    refreshStatus();

    $("#tanggal").value = todayISO();
    const d = new Date();
    $("#todayLabel").textContent = `${["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · isi parameter mesin hari ini`;
    state.bulan = monthOf(todayISO());

    if (isRs()) {
      let draftRestored = false, draftAt = null;
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.data) {
            applyDraft(saved.data);
            if (!$("#tanggal").value) $("#tanggal").value = todayISO();
            $("#draftNote").textContent = "Draf sebelumnya dipulihkan";
            draftRestored = true; draftAt = saved.at;
          }
        }
      } catch (e) {}
      $("#nama_rs").value = AUTH.nama_rs || "";
      $("#daerah_rs").value = AUTH.daerah_rs || "";
      if (draftRestored) {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: draftAt || Date.now(), data: collect() })); } catch (e2) {}
      }
      refreshShiftLock();
    }

    if (isRs()) loadReports();
  }

  function getTheme() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") return attr;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(LS_THEME, theme); } catch (e) {}
    const meta = document.getElementById("metaThemeColor");
    if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#f5f5f7");
    $$(".theme-toggle-input").forEach((el) => { el.checked = theme === "dark"; });
  }
  function initTheme() {
    applyTheme(getTheme());
    $$(".theme-toggle-input").forEach((el) => {
      el.addEventListener("change", () => applyTheme(el.checked ? "dark" : "light"));
    });
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => { let saved = null; try { saved = localStorage.getItem(LS_THEME); } catch (e) {} if (!saved) applyTheme(mq.matches ? "dark" : "light"); };
      if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
    }
  }
  initTheme();

  function initSplash() {
    const el = $("#splashIntro");
    if (!el) return;
    let done = false;
    const remove = () => {
      if (done) return;
      done = true;
      el.remove();
    };
    el.addEventListener("animationend", (e) => { if (e.target === el) remove(); });
    el.addEventListener("click", () => el.classList.add("splash-skip"));
    setTimeout(remove, 2600);
  }
  initSplash();

  $$(".table-scroll").forEach((el) => {
    new MutationObserver(() => { el.scrollLeft = 0; }).observe(el, { childList: true });
  });

  async function boot() {
    showOnly("bootCheck");
    let stored = null;
    try { stored = localStorage.getItem(LS_GAS); } catch (e) {}
    if (!stored) await probeLocalServer();
    const cached = loadAuth();
    const exist = await gasFetch({ type: "accountsExist" });
    if (!exist.ok) {
      showOnly("loginPage");
      $("#loginErr").textContent = exist.message || "Tidak dapat menghubungi server. Coba lagi beberapa saat, atau hubungi Admin.";
      $("#loginErr").style.display = "block";
      return;
    }
    if (!exist.exists) { showOnly("bootstrapPage"); return; }

    if (cached && cached.token) {
      AUTH = cached;
      const bulanNow = monthOf(todayISO());
      const check = await authedFetch("getReports", { bulan: bulanNow });
      if (check.ok) { state.__primedReports = { bulan: bulanNow, data: check }; await routeAfterLogin(); return; }
      clearAuth();
    }
    showOnly("portalPage");
  }

  boot();
})();
