const BACKEND_BUILD_VERSION = 'v2026-10-27-email-notif-r5';
const SS = SpreadsheetApp.getActive();
const SESSION_TTL_HOURS = 18;
const ACTIVITY_LOG_MAX_ROWS = 5000;

const SH = {
  Akun: 'Akun',
  DOCS: 'Laporan_DOCS',
  WWZ: 'Laporan_WWZ',
  GOW: 'Laporan_GOW',
  Bulanan: 'Laporan_Bulanan',
  Sessions: 'Sessions',
  Log: 'Log_Aktivitas',
  RS: 'Rumah_Sakit',
  SP_Master: 'Sparepart_Master',
  SP_Request: 'SP_Request',
  SP_RequestItems: 'SP_Request_Items',
  SP_Pengiriman: 'SP_Pengiriman',
  SP_PengirimanItems: 'SP_Pengiriman_Items',
  SP_Penerimaan: 'SP_Penerimaan',
  SP_PenerimaanItems: 'SP_Penerimaan_Items',
  SP_Pemakaian: 'SP_Pemakaian',
  SP_PemakaianItems: 'SP_Pemakaian_Items',
  SP_Penyesuaian: 'SP_Penyesuaian',
  Notif_DOCS: 'Notif_Threshold_DOCS',
  Notif_BoosterModel: 'Notif_Booster_Model',
  Notif_BoosterSpec: 'Notif_Booster_Spec',
  Notif_EmailPenerima: 'Notif_Email_Penerima',
  Notif_EmailLog: 'Notif_Email_Log',
};

const COLS = {
  Akun: ['Username', 'Password', 'Role', 'Name', 'Active', 'Created_At', 'Created_By', 'Last_Login', 'Approval_Status'],
  DOCS: ['Timestamp', 'Nama_RS', 'Daerah_RS', 'Tanggal', 'Bulan',
    'Purity_%', 'Running_Hours', 'Pressure', 'Box_Temperature',
    'XT1', 'XT2', 'XT3', 'XT4', 'RTD1', 'RTD2', 'RTD3', 'RTD4', 'VSA_SCR',
    'Submitted_By', 'Submitted_By_Name',
    'Shift', 'Jam_Lapor', 'Pertambahan_Running_Hours',
    'VSA', 'SCR', 'Purity_AE1', 'Remrun', 'Remhold', 'Remote_Mode',
    'VSA_VFD', 'Scroll_VFD', 'Heat_Exchanger', 'Flow_Avg_LPM', 'Flow_Total_M3',
    'Jumlah_Produksi_Tabung_O2', 'Catatan', 'Updated_At', 'Updated_By',
    'Catatan_Operator'],
  WWZ: ['Timestamp', 'Nama_RS', 'Tanggal', 'Bulan', 'Running_Hours',
    'Temp1', 'Temp2', 'Temp3', 'Press1', 'Press2', 'Press3', 'Press4',
    'Jumlah_Pengisian', 'Submitted_By', 'Submitted_By_Name',
    'Shift', 'Jam_Lapor', 'Pertambahan_Running_Hours', 'Riset_RH', 'Unit',
    'Updated_At', 'Updated_By',
    'Jumlah_Produksi_Tabung_O2', 'Catatan'],
  GOW: ['Timestamp', 'Nama_RS', 'Tanggal', 'Bulan', 'Running_Hours',
    'Temp1', 'Temp2', 'Temp3', 'Temp4', 'Press1', 'Press2', 'Press3', 'Press4',
    'Jumlah_Pengisian', 'Submitted_By', 'Submitted_By_Name',
    'Shift', 'Jam_Lapor', 'Pertambahan_Running_Hours', 'Press_Inlet', 'Unit',
    'Updated_At', 'Updated_By',
    'Jumlah_Produksi_Tabung_O2', 'Catatan',
    'Riset_RH'],
  Bulanan: ['Bulan', 'Nama_RS', 'Daerah_RS', 'Total_Laporan', 'Hari_Wajib_Lapor',
    'Compliance_Rate_%', 'Avg_Purity', 'Min_Purity', 'Max_Purity',
    'Laporan_WWZ', 'Laporan_GOW', 'Snapshot_At', 'Snapshot_By',
    'Avg_Running_Hours', 'Total_Pertambahan_Running_Hours', 'Total_Tabung_O2'],
  Sessions: ['Token', 'Username', 'Role', 'Name', 'Created_At', 'Expires_At'],
  Log: ['Timestamp', 'Username', 'Role', 'Action', 'Detail'],
  RS: ['Nama_RS', 'Daerah_RS', 'Operator1', 'Operator2', 'Operator3',
    'Username', 'Password', 'Active', 'Updated_At', 'Updated_By'],

  SP_Master: ['Kode_Barang', 'Nama_Barang', 'Satuan', 'Active', 'Created_At', 'Nama_RS', 'Item_Id'],
  SP_Request: ['No_Request', 'Timestamp', 'Tanggal', 'Nama_RS', 'Nama_Operator',
    'Status', 'Catatan_Operator', 'Catatan_Teknisi', 'Reviewed_By', 'Reviewed_At'],
  SP_RequestItems: ['No_Request', 'Kode_Barang', 'Nama_Barang', 'Qty'],
  SP_Pengiriman: ['No_Pengiriman', 'No_Permintaan', 'Timestamp', 'Tanggal_Kirim', 'Nama_RS',
    'Penerima_Nama', 'Penerima_HP', 'Foto_Resi_URL', 'Nama_Pengirim', 'Jabatan_Pengirim', 'Status',
    'Submitted_By', 'Catatan'],
  SP_PengirimanItems: ['No_Pengiriman', 'Kode_Barang', 'Nama_Barang', 'Qty'],
  SP_Penerimaan: ['No_Penerimaan', 'No_Pengiriman', 'Timestamp', 'Tanggal_Terima', 'Nama_RS',
    'Nama_Operator', 'Foto_Barang_URL', 'Status', 'Catatan_Teknisi', 'Reviewed_By', 'Reviewed_At'],
  SP_PenerimaanItems: ['No_Penerimaan', 'Kode_Barang', 'Nama_Barang', 'Qty'],
  SP_Pemakaian: ['No_Pemakaian', 'Timestamp', 'Tanggal', 'Nama_RS', 'Nama_Operator', 'Catatan'],
  SP_PemakaianItems: ['No_Pemakaian', 'Kode_Barang', 'Nama_Barang', 'RH_Saat_Diganti', 'Qty'],
  SP_Penyesuaian: ['No_Penyesuaian', 'Timestamp', 'Tanggal', 'Nama_RS', 'Item_Id', 'Kode_Barang',
    'Nama_Barang', 'Qty_Sebelum', 'Qty_Sesudah', 'Delta', 'Catatan', 'Submitted_By'],

  Notif_DOCS: ['Nama_RS', 'DOCS_Type',
    'RTD1_Min', 'RTD1_Max', 'RTD2_Min', 'RTD2_Max', 'RTD3_Min', 'RTD3_Max', 'RTD4_Min', 'RTD4_Max',
    'Purity_Min', 'Purity_Max', 'Pressure_Min', 'Pressure_Max',
    'Box_Temperature_Min', 'Box_Temperature_Max',
    'Flow_Avg_LPM_Min', 'Flow_Avg_LPM_Max', 'SCR_Min', 'SCR_Max', 'Catatan'],
  Notif_BoosterModel: ['Nama_RS', 'Booster1', 'Booster2', 'Catatan'],
  Notif_BoosterSpec: ['Model',
    'Press_Inlet_Min', 'Press_Inlet_Max', 'Press1_Min', 'Press1_Max', 'Press2_Min', 'Press2_Max',
    'Press3_Min', 'Press3_Max', 'Press4_Min', 'Press4_Max',
    'Temp1_Min', 'Temp1_Max', 'Temp2_Min', 'Temp2_Max', 'Temp3_Min', 'Temp3_Max', 'Temp4_Min', 'Temp4_Max',
    'Catatan'],
  Notif_EmailPenerima: ['Nama', 'Email', 'Aktif', 'Cakupan_RS', 'Catatan'],
  Notif_EmailLog: ['Timestamp', 'Nama_RS', 'Tanggal', 'Shift', 'Mesin', 'Parameter',
    'Nilai_Sebelumnya', 'Nilai_Sekarang', 'Batas', 'Penerima', 'Status'],
};

const TEXT_COLS = {
  Akun: ['Username', 'Password', 'Created_At', 'Last_Login'],
  DOCS: ['Tanggal', 'Bulan', 'Timestamp', 'Jam_Lapor', 'Updated_At', 'VSA', 'SCR'],
  WWZ: ['Tanggal', 'Bulan', 'Timestamp', 'Jam_Lapor', 'Updated_At'],
  GOW: ['Tanggal', 'Bulan', 'Timestamp', 'Jam_Lapor', 'Updated_At'],
  Bulanan: ['Bulan', 'Snapshot_At'],
  Sessions: ['Token', 'Created_At', 'Expires_At'],
  Log: ['Timestamp'],
  RS: ['Username', 'Password', 'Updated_At'],
  SP_Master: ['Kode_Barang', 'Created_At', 'Item_Id'],
  SP_Request: ['No_Request', 'Timestamp', 'Tanggal', 'Reviewed_At'],
  SP_RequestItems: ['No_Request', 'Kode_Barang'],
  SP_Pengiriman: ['No_Pengiriman', 'No_Permintaan', 'Timestamp', 'Tanggal_Kirim', 'Penerima_HP'],
  SP_PengirimanItems: ['No_Pengiriman', 'Kode_Barang'],
  SP_Penerimaan: ['No_Penerimaan', 'No_Pengiriman', 'Timestamp', 'Tanggal_Terima', 'Reviewed_At'],
  SP_PenerimaanItems: ['No_Penerimaan', 'Kode_Barang'],
  SP_Pemakaian: ['No_Pemakaian', 'Timestamp', 'Tanggal'],
  SP_PemakaianItems: ['No_Pemakaian', 'Kode_Barang'],
  SP_Penyesuaian: ['No_Penyesuaian', 'Timestamp', 'Tanggal', 'Item_Id', 'Kode_Barang'],
  Notif_EmailLog: ['Timestamp', 'Tanggal', 'Nilai_Sebelumnya', 'Nilai_Sekarang', 'Batas'],
};

function _sheet_(key) {
  const name = SH[key];
  const headers = COLS[key];
  let sh = SS.getSheetByName(name);
  if (!sh) {
    sh = SS.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  } else {
    const lastCol = sh.getLastColumn();
    const existingHeaders = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => _s_(h)) : [];
    const missing = headers.filter((h) => existingHeaders.indexOf(h) === -1);
    if (missing.length) {
      sh.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
      sh.getRange(1, 1, 1, existingHeaders.length + missing.length).setFontWeight('bold');
    }
  }
  const textCols = TEXT_COLS[key] || [];
  textCols.forEach((colName) => {
    const idx = headers.indexOf(colName) + 1;
    if (idx > 0) sh.getRange(1, idx, 5000, 1).setNumberFormat('@');
  });
  return sh;
}
function _json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function _ok_(obj) { return _json_(Object.assign({ ok: true }, obj || {})); }
function _err_(code, message, extra) {
  return _json_(Object.assign({ ok: false, code: code || 'error', message: message || 'Terjadi kesalahan.' }, extra || {}));
}
function _s_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function _now_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss'); }
function _nowPlus_(hours) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}
function _newToken_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
function _norm_(v) { return _s_(v).toLowerCase(); }

const _DATE_LIKE_FORMATS_ = {
  Jam_Lapor: 'HH:mm',
  Tanggal: 'yyyy-MM-dd',
  Bulan: 'yyyy-MM',
  Timestamp: 'yyyy-MM-dd HH:mm:ss',
  Created_At: 'yyyy-MM-dd HH:mm:ss',
  Last_Login: 'yyyy-MM-dd HH:mm:ss',
  Snapshot_At: 'yyyy-MM-dd HH:mm:ss',
  Expires_At: 'yyyy-MM-dd HH:mm:ss',
};

function _readAll_(key) {
  const sh = _sheet_(key);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => _s_(h));
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every((c) => c === '' || c === null)) continue;
    const obj = {};
    headers.forEach((h, j) => {
      let v = row[j];
      const fmt = _DATE_LIKE_FORMATS_[h];
      if (fmt && v instanceof Date) {
        v = Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Jakarta', fmt);
      }
      obj[h] = v;
    });
    obj.__row = i + 1;
    out.push(obj);
  }
  return out;
}

function _logActivity_(username, role, action, detail) {
  const sh = _sheet_('Log');
  sh.appendRow([_now_(), _s_(username), _s_(role), _s_(action), _s_(detail)]);
  const last = sh.getLastRow();
  if (last - 1 > ACTIVITY_LOG_MAX_ROWS) {
    sh.deleteRows(2, last - 1 - ACTIVITY_LOG_MAX_ROWS);
  }
}

function _requireAuth_(token, roleRequired) {
  if (!token) return { error: _err_('unauthorized', 'Sesi tidak ditemukan. Silakan login ulang.') };
  const rows = _readAll_('Sessions');
  const row = rows.find((r) => _s_(r.Token) === _s_(token));
  if (!row) return { error: _err_('unauthorized', 'Sesi tidak valid. Silakan login ulang.') };
  if (_s_(row.Expires_At) && row.Expires_At < _now_()) {
    _sheet_('Sessions').deleteRow(row.__row);
    return { error: _err_('session_expired', 'Sesi Anda sudah berakhir. Silakan login ulang.') };
  }
  if (roleRequired) {
    const allowed = Array.isArray(roleRequired) ? roleRequired : [roleRequired];
    if (allowed.indexOf(_s_(row.Role)) === -1) {
      return { error: _err_('forbidden', 'Anda tidak memiliki akses untuk aksi ini.') };
    }
  }
  return { session: { username: row.Username, role: row.Role, name: row.Name, row: row.__row } };
}

const SHIFT_OPTIONS = ['pagi', 'sore', 'malam'];
const JAM_24H_RE = /^([01]\d|2[0-3])\.[0-5]\d$/;

const FIELDS_DOCS = [
  ['purity', 'Purity', true, 'float', 0, 100],
  ['running_hours', 'Running Hours', true, 'int', 0, null],
  ['pressure', 'Pressure', true, 'float', null, null],
  ['box_temperature', 'Box Temperature', true, 'float', null, null],
  ['xt1', 'XT1', true, 'float', null, null], ['xt2', 'XT2', true, 'float', null, null],
  ['xt3', 'XT3', true, 'float', null, null], ['xt4', 'XT4', true, 'float', null, null],
  ['rtd1', 'RTD1', true, 'text', null, null], ['rtd2', 'RTD2', true, 'text', null, null],
  ['rtd3', 'RTD3', true, 'text', null, null], ['rtd4', 'RTD4', true, 'text', null, null],
  ['vsa', 'VSA', true, 'text', null, null],
  ['scr', 'SCR', true, 'text', null, null],
  ['flow_avg_lpm', 'Flow Avg (LPM)', true, 'float', 0, null],
  ['flow_total_m3', 'Flow Total (M3)', true, 'float', 0, null],
  ['catatan', 'Catatan', false, 'text', null, null],
];
const FIELDS_WWZ = [
  ['running_hours', 'Running Hours', false, 'int', 0, null],
  ['temp_disc1', '1st Stage Discharge Temperature', false, 'float', null, null],
  ['temp_disc2', '2nd Stage Discharge Temperature', false, 'float', null, null],
  ['press_inlet', 'Inlet Pressure', false, 'float', null, null],
  ['press_l1', 'Level 1 Exhaust Pressure', false, 'float', null, null],
  ['press_l2', 'Level 2 Exhaust Pressure', false, 'float', null, null],
  ['riset_rh', 'Reset RH', true, 'enum', null, null, ['Ya', 'Tidak']],
  ['unit', 'Unit Mesin', false, 'enum', null, null, ['1', '2']],
  ['jumlah_produksi_tabung_o2', 'Jumlah Produksi Tabung O2', true, 'int', 0, null],
  ['catatan', 'Catatan', false, 'text', null, null],
];
const FIELDS_GOW = [
  ['running_hours', 'Running Hours', false, 'int', 0, null],
  ['temp_ex1', '1st Exhaust Temperature', false, 'float', null, null],
  ['temp_ex2', '2nd Exhaust Temperature', false, 'float', null, null],
  ['temp_ex3', '3rd Exhaust Temperature', false, 'float', null, null],
  ['temp_ex4', '4th Exhaust Temperature', false, 'float', null, null],
  ['press_inlet', 'Inlet Pressure', false, 'float', null, null],
  ['press_ex1', '1st Stage Exhaust Pressure', false, 'float', null, null],
  ['press_ex2', '2nd Stage Exhaust Pressure', false, 'float', null, null],
  ['press_ex3', '3rd Stage Exhaust Pressure', false, 'float', null, null],
  ['press_ex4', '4th Stage Exhaust Pressure', false, 'float', null, null],
  ['unit', 'Unit Mesin', false, 'enum', null, null, ['1', '2']],
  ['jumlah_produksi_tabung_o2', 'Jumlah Produksi Tabung O2', true, 'int', 0, null],
  ['riset_rh', 'Reset RH', true, 'enum', null, null, ['Ya', 'Tidak']],
  ['catatan', 'Catatan', false, 'text', null, null],
];

const EDIT_FIELD_MAP_DOCS = {
  purity: 'Purity_%', running_hours: 'Running_Hours',
  pressure: 'Pressure', box_temperature: 'Box_Temperature',
  xt1: 'XT1', xt2: 'XT2', xt3: 'XT3', xt4: 'XT4',
  rtd1: 'RTD1', rtd2: 'RTD2', rtd3: 'RTD3', rtd4: 'RTD4',
  vsa: 'VSA', scr: 'SCR',
  flow_avg_lpm: 'Flow_Avg_LPM', flow_total_m3: 'Flow_Total_M3',
  catatan: 'Catatan',
  catatan_operator: 'Catatan_Operator',
};
const EDIT_FIELD_MAP_WWZ = {
  running_hours: 'Running_Hours',
  temp_disc1: 'Temp1', temp_disc2: 'Temp2',
  press_inlet: 'Press1', press_l1: 'Press2', press_l2: 'Press3',
  riset_rh: 'Riset_RH',
  jumlah_produksi_tabung_o2: 'Jumlah_Produksi_Tabung_O2', catatan: 'Catatan',
};
const EDIT_FIELD_MAP_GOW = {
  running_hours: 'Running_Hours',
  temp_ex1: 'Temp1', temp_ex2: 'Temp2', temp_ex3: 'Temp3', temp_ex4: 'Temp4',
  press_inlet: 'Press_Inlet', press_ex1: 'Press1', press_ex2: 'Press2', press_ex3: 'Press3', press_ex4: 'Press4',
  jumlah_produksi_tabung_o2: 'Jumlah_Produksi_Tabung_O2', riset_rh: 'Riset_RH', catatan: 'Catatan',
};

function _coerce_(raw, tipe, label, min, max, errors, key, required) {
  if (raw === undefined || raw === null || _s_(raw) === '') {
    if (required) errors[key] = label + ' wajib diisi';
    return null;
  }
  const s = _s_(raw).replace(',', '.');
  const num = parseFloat(s);
  if (!isFinite(num)) { errors[key] = label + ' harus berupa angka'; return null; }
  if (tipe === 'int' && Math.abs(num - Math.round(num)) > 1e-9) { errors[key] = label + ' harus bilangan bulat'; return null; }
  if (min !== null && num < min) { errors[key] = label + ' minimal ' + min; return null; }
  if (max !== null && num > max) { errors[key] = label + ' maksimal ' + max; return null; }
  return tipe === 'int' ? Math.round(num) : num;
}

function _coerceEnum_(raw, label, options, errors, key, required) {
  const s = _s_(raw);
  if (!s) { if (required) errors[key] = label + ' wajib dipilih'; return null; }
  const match = options.find((o) => o.toLowerCase() === s.toLowerCase());
  if (!match) { errors[key] = label + ' harus salah satu dari: ' + options.join(' / '); return null; }
  return match;
}

function _coerceText_(raw, label, errors, key, required) {
  const s = _s_(raw).trim();
  if (!s) { if (required) errors[key] = label + ' wajib diisi'; return ''; }
  return s;
}

function _validateSubmission_(payload) {
  const errors = {};
  const identitas = payload.identitas || {};
  const docsIn = payload.docs || {};
  const booster = payload.booster || {};

  const nama_rs = _s_(identitas.nama_rs);
  const daerah_rs = _s_(identitas.daerah_rs);
  const tanggal = _s_(identitas.tanggal);
  const shift = _s_(identitas.shift);
  if (!nama_rs) errors['identitas.nama_rs'] = 'Nama Rumah Sakit wajib diisi';
  if (!daerah_rs) errors['identitas.daerah_rs'] = 'Daerah Rumah Sakit wajib diisi';
  if (!tanggal) errors['identitas.tanggal'] = 'Tanggal wajib diisi';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) errors['identitas.tanggal'] = 'Format tanggal tidak valid';
  if (!shift) errors['identitas.shift'] = 'Shift wajib dipilih';
  else if (SHIFT_OPTIONS.indexOf(shift) === -1) errors['identitas.shift'] = 'Shift tidak valid';
  const jam_lapor = _s_(identitas.jam_lapor);
  if (!jam_lapor) errors['identitas.jam_lapor'] = 'Jam laporan wajib diisi';
  else if (!JAM_24H_RE.test(jam_lapor)) errors['identitas.jam_lapor'] = 'Format jam tidak valid (format 24 jam, contoh: 09.00 atau 22.00)';
  const operator_nama = _s_(identitas.operator_nama);
  if (!operator_nama) errors['identitas.operator_nama'] = 'Nama Operator wajib dipilih';
  const catatan_operator = _coerceText_(identitas.catatan_operator, 'Catatan Operator', errors, 'identitas.catatan_operator', false).slice(0, 300);

  const bulan = tanggal.slice(0, 7);
  const docsRow = { nama_rs, daerah_rs, tanggal, bulan, shift, jam_lapor, catatan_operator };
  FIELDS_DOCS.forEach(([key, label, required, tipe, min, max, options]) => {
    docsRow[key] = tipe === 'enum'
      ? _coerceEnum_(docsIn[key], label, options, errors, 'docs.' + key, required)
      : tipe === 'text'
      ? _coerceText_(docsIn[key], label, errors, 'docs.' + key, required)
      : _coerce_(docsIn[key], tipe, label, min, max, errors, 'docs.' + key, required);
  });

  let wwzRow = null, gowRow = null;
  if (booster.has) {
    if (!booster.has_wwz && !booster.has_gow) {
      errors['booster._'] = 'Pilih minimal satu mesin booster (WWZ atau GOW)';
    }
    [['wwz', FIELDS_WWZ, booster.has_wwz], ['gow', FIELDS_GOW, booster.has_gow]].forEach(([prefix, fields, on]) => {
      if (!on) return;
      const dataIn = booster[prefix] || {};
      const row = { nama_rs, tanggal, bulan, shift, jam_lapor };
      let filled = 0;
      fields.forEach(([key, label, required, tipe, min, max, options]) => {
        row[key] = tipe === 'enum'
          ? _coerceEnum_(dataIn[key], prefix.toUpperCase() + ' ' + label, options, errors, prefix + '.' + key, required)
          : tipe === 'text'
          ? _coerceText_(dataIn[key], prefix.toUpperCase() + ' ' + label, errors, prefix + '.' + key, required)
          : _coerce_(dataIn[key], tipe, prefix.toUpperCase() + ' ' + label, min, max, errors, prefix + '.' + key, required);
        if (key === 'unit') { if (!row[key]) row[key] = '1'; return; }
        if (row[key] !== null && row[key] !== '') filled++;
      });
      if (filled === 0) errors[prefix + '._'] = 'Mesin ' + prefix.toUpperCase() + ' ditandai ada, minimal satu parameter harus diisi';
      if (prefix === 'wwz') wwzRow = row; else gowRow = row;
    });
  }

  if (Object.keys(errors).length) return { errors: errors };
  return { docs: docsRow, wwz: wwzRow, gow: gowRow, meta: { nama_rs, daerah_rs, tanggal, bulan, shift, operator_nama } };
}

function _rowFor_(key, obj, extra) {
  const headers = COLS[key];
  return headers.map((h) => {
    if (extra && Object.prototype.hasOwnProperty.call(extra, h)) return extra[h];
    return obj[h] !== undefined ? obj[h] : '';
  });
}

const SP_DOC_PREFIX = {
  SP_Request: 'REQ', SP_Pengiriman: 'KRM',
  SP_Penerimaan: 'TR', SP_Pemakaian: 'PK', SP_Penyesuaian: 'ADJ',
};
function _genDocNo_(sheetKey) {
  const prefix = SP_DOC_PREFIX[sheetKey];
  const noCol = COLS[sheetKey][0];
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyyMMdd');
  const prefixStr = prefix + '-' + today + '-';
  const count = _readAll_(sheetKey).filter((r) => _s_(r[noCol]).indexOf(prefixStr) === 0).length;
  return prefixStr + String(count + 1).padStart(4, '0');
}

function _parseBarangItems_(items, namaRs) {
  if (!Array.isArray(items) || !items.length) return { error: 'Daftar barang tidak boleh kosong — tambah minimal 1 baris barang.' };
  const master = _readAll_('SP_Master').filter((r) => _norm_(r.Nama_RS) === _norm_(namaRs));
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const itemId = _s_(it.item_id);
    if (!itemId) return { error: 'Barang wajib dipilih di semua baris (baris ke-' + (i + 1) + ' kosong).' };
    const qty = Number(it.qty);
    if (!isFinite(qty) || qty <= 0) return { error: 'Jumlah barang harus berupa angka lebih dari 0 di semua baris (baris ke-' + (i + 1) + ').' };
    if (itemId === '__MANUAL__') {
      const namaManual = _s_(it.nama_barang_manual);
      if (!namaManual) return { error: 'Nama barang manual wajib diisi di baris ke-' + (i + 1) + '.' };
      out.push({ kode_barang: '', nama_barang: namaManual, qty: qty, rh: _s_(it.rh) });
      continue;
    }
    const m = master.find((r) => _s_(r.Item_Id) === itemId);
    if (!m) return { error: 'Barang di baris ke-' + (i + 1) + ' tidak ditemukan/tidak berlaku untuk Rumah Sakit ini — muat ulang halaman lalu pilih ulang.' };
    out.push({ kode_barang: _s_(m.Kode_Barang), nama_barang: _s_(m.Nama_Barang), qty: qty, rh: _s_(it.rh) });
  }
  return { items: out };
}

function _listRsPublic_(p) {
  const rows = _readAll_('RS').filter((r) => !(_s_(r.Active) === 'false' || r.Active === false))
    .map((r) => ({
      nama_rs: _s_(r.Nama_RS),
      daerah_rs: _s_(r.Daerah_RS),
      operator1: _s_(r.Operator1),
      operator2: _s_(r.Operator2),
      operator3: _s_(r.Operator3),
    }))
    .sort((a, b) => a.nama_rs.localeCompare(b.nama_rs));
  return _ok_({ rs: rows });
}

function _nextSpMasterItemId_() {
  const rows = _readAll_('SP_Master');
  let maxN = 0;
  rows.forEach((r) => {
    const m = /^SPM(\d+)$/.exec(_s_(r.Item_Id));
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  });
  return 'SPM' + String(maxN + 1).padStart(6, '0');
}
function _listSparepartMaster_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  let rows = _readAll_('SP_Master');
  if (_s_(p.nama_rs)) rows = rows.filter((r) => _norm_(r.Nama_RS) === _norm_(p.nama_rs));
  const catatanMap = _latestSparepartCatatan_();
  const out = rows.map((r) => {
    const rs = _s_(r.Nama_RS), kode = _s_(r.Kode_Barang), nama = _s_(r.Nama_Barang);
    const key = _norm_(rs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
    return {
      item_id: _s_(r.Item_Id), nama_rs: rs,
      kode_barang: kode, nama_barang: nama, satuan: _s_(r.Satuan),
      active: !(_s_(r.Active) === 'false' || r.Active === false), created_at: r.Created_At,
      catatan: catatanMap[key] || '',
    };
  }).sort((a, b) => a.nama_rs.localeCompare(b.nama_rs) || a.nama_barang.localeCompare(b.nama_barang));
  return _ok_({ items: out });
}
function _listSparepartActive_(p) {
  const namaRs = _s_(p.nama_rs);
  if (!namaRs) return _ok_({ items: [] });
  const rows = _readAll_('SP_Master').filter((r) => _norm_(r.Nama_RS) === _norm_(namaRs) && !(_s_(r.Active) === 'false' || r.Active === false))
    .map((r) => ({ item_id: _s_(r.Item_Id), kode_barang: _s_(r.Kode_Barang), nama_barang: _s_(r.Nama_Barang), satuan: _s_(r.Satuan) }))
    .sort((a, b) => a.nama_barang.localeCompare(b.nama_barang));
  return _ok_({ items: rows });
}
function _upsertSparepartMasterRow_(itemId, namaRs, kode, nama, satuan) {
  const sh = _sheet_('SP_Master');
  const rows = _readAll_('SP_Master');
  let existing = null;
  if (itemId) {
    existing = rows.find((r) => _s_(r.Item_Id) === itemId);
    if (!existing) return { error: 'Barang tidak ditemukan.' };
  } else {
    existing = rows.find((r) => _norm_(r.Nama_RS) === _norm_(namaRs) &&
      (kode ? _norm_(r.Kode_Barang) === _norm_(kode) : (!_s_(r.Kode_Barang) && _norm_(r.Nama_Barang) === _norm_(nama))));
  }
  if (existing) {
    sh.getRange(existing.__row, COLS.SP_Master.indexOf('Nama_RS') + 1).setValue(namaRs);
    sh.getRange(existing.__row, COLS.SP_Master.indexOf('Kode_Barang') + 1).setValue(kode);
    sh.getRange(existing.__row, COLS.SP_Master.indexOf('Nama_Barang') + 1).setValue(nama);
    sh.getRange(existing.__row, COLS.SP_Master.indexOf('Satuan') + 1).setValue(satuan);
    sh.getRange(existing.__row, COLS.SP_Master.indexOf('Active') + 1).setValue(true);
    return { item_id: _s_(existing.Item_Id), updated: true };
  }
  const newId = _nextSpMasterItemId_();
  sh.appendRow(_rowFor_('SP_Master', {
    Kode_Barang: kode, Nama_Barang: nama, Satuan: satuan, Active: true, Created_At: _now_(),
    Nama_RS: namaRs, Item_Id: newId,
  }));
  return { item_id: newId, updated: false };
}
function _setSparepartMaster_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const itemId = _s_(p.item_id), namaRs = _s_(p.nama_rs), kode = _s_(p.kode_barang), nama = _s_(p.nama_barang), satuan = _s_(p.satuan);
  if (!namaRs) return _err_('validation', 'Rumah Sakit wajib dipilih.');
  if (!nama) return _err_('validation', 'Nama Barang wajib diisi.');
  const res = _upsertSparepartMasterRow_(itemId, namaRs, kode, nama, satuan);
  if (res.error) return _err_('not_found', res.error);
  _logActivity_(auth.session.username, auth.session.role, 'set_sparepart_master', namaRs + ' - ' + (kode || '-') + ' - ' + nama);
  return _ok_({ message: 'Barang ' + nama + ' berhasil disimpan.', item_id: res.item_id });
}
function _setSparepartMasterActive_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const itemId = _s_(p.item_id);
  const rows = _readAll_('SP_Master');
  const row = rows.find((r) => _s_(r.Item_Id) === itemId);
  if (!row) return _err_('not_found', 'Barang tidak ditemukan.');
  _sheet_('SP_Master').getRange(row.__row, COLS.SP_Master.indexOf('Active') + 1).setValue(!!p.active);
  _logActivity_(auth.session.username, auth.session.role, p.active ? 'activate_sparepart' : 'deactivate_sparepart', _s_(row.Nama_Barang));
  return _ok_({ message: 'Status barang ' + _s_(row.Nama_Barang) + ' berhasil diperbarui.' });
}
function _deleteSparepartMaster_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const itemId = _s_(p.item_id);
  const rows = _readAll_('SP_Master');
  const row = rows.find((r) => _s_(r.Item_Id) === itemId);
  if (!row) return _err_('not_found', 'Barang tidak ditemukan.');
  const kode = _s_(row.Nama_Barang);
  _sheet_('SP_Master').deleteRow(row.__row);
  _logActivity_(auth.session.username, auth.session.role, 'delete_sparepart', kode);
  return _ok_({ message: 'Barang ' + kode + ' berhasil dihapus dari daftar. Histori transaksi yang sudah ada tidak ikut terhapus.' });
}

function _submitSparepartRequest_(p) {
  const nama_rs = _s_(p.nama_rs), nama_operator = _s_(p.nama_operator), tanggal = _s_(p.tanggal);
  if (!nama_rs) return _err_('validation', 'Nama Rumah Sakit wajib dipilih.');
  if (!nama_operator) return _err_('validation', 'Nama Operator wajib diisi.');
  if (!tanggal) return _err_('validation', 'Tanggal wajib diisi.');
  const parsed = _parseBarangItems_(p.items, nama_rs);
  if (parsed.error) return _err_('validation', parsed.error);
  const noReq = _genDocNo_('SP_Request');
  _sheet_('SP_Request').appendRow(_rowFor_('SP_Request', {
    No_Request: noReq, Timestamp: _now_(), Tanggal: tanggal, Nama_RS: nama_rs, Nama_Operator: nama_operator,
    Status: 'Menunggu', Catatan_Operator: _s_(p.catatan), Catatan_Teknisi: '', Reviewed_By: '', Reviewed_At: '',
  }));
  const itemsSh = _sheet_('SP_RequestItems');
  parsed.items.forEach((it) => itemsSh.appendRow(_rowFor_('SP_RequestItems', {
    No_Request: noReq, Kode_Barang: it.kode_barang, Nama_Barang: it.nama_barang, Qty: it.qty,
  })));
  return _ok_({ message: 'Request barang ' + noReq + ' berhasil dikirim, menunggu persetujuan Teknisi.', no_request: noReq });
}
function _listSparepartRequests_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const status = _s_(p.status);
  let rows = _readAll_('SP_Request');
  if (status) rows = rows.filter((r) => _norm_(r.Status) === _norm_(status));
  const items = _readAll_('SP_RequestItems');
  const out = rows.map((r) => ({
    no_request: _s_(r.No_Request), timestamp: r.Timestamp, tanggal: r.Tanggal, nama_rs: r.Nama_RS,
    nama_operator: r.Nama_Operator, status: r.Status, catatan_operator: r.Catatan_Operator,
    catatan_teknisi: r.Catatan_Teknisi, reviewed_by: r.Reviewed_By, reviewed_at: r.Reviewed_At,
    items: items.filter((it) => _s_(it.No_Request) === _s_(r.No_Request))
      .map((it) => ({ kode_barang: it.Kode_Barang, nama_barang: it.Nama_Barang, qty: it.Qty })),
  })).sort((a, b) => _s_(b.timestamp).localeCompare(_s_(a.timestamp)));
  return _ok_({ requests: out });
}
function _listSparepartRequestPublic_(p) {
  const nama_rs = _s_(p.nama_rs), nama_operator = _s_(p.nama_operator);
  if (!nama_rs || !nama_operator) return _ok_({ requests: [] });
  const rows = _readAll_('SP_Request').filter((r) =>
    _norm_(r.Nama_RS) === _norm_(nama_rs) && _norm_(r.Nama_Operator) === _norm_(nama_operator));
  const items = _readAll_('SP_RequestItems');
  const out = rows.map((r) => ({
    no_request: _s_(r.No_Request), tanggal: r.Tanggal, status: r.Status,
    items: items.filter((it) => _s_(it.No_Request) === _s_(r.No_Request))
      .map((it) => ({ nama_barang: it.Nama_Barang, qty: it.Qty })),
  })).sort((a, b) => _s_(b.tanggal).localeCompare(_s_(a.tanggal)));
  return _ok_({ requests: out });
}
function _reviewSparepartRequest_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const noReq = _s_(p.no_request), approve = !!p.approve;
  const rows = _readAll_('SP_Request');
  const row = rows.find((r) => _s_(r.No_Request) === noReq);
  if (!row) return _err_('not_found', 'Request tidak ditemukan.');
  const sh = _sheet_('SP_Request');
  sh.getRange(row.__row, COLS.SP_Request.indexOf('Status') + 1).setValue(approve ? 'Disetujui' : 'Ditolak');
  sh.getRange(row.__row, COLS.SP_Request.indexOf('Catatan_Teknisi') + 1).setValue(_s_(p.catatan_teknisi));
  sh.getRange(row.__row, COLS.SP_Request.indexOf('Reviewed_By') + 1).setValue(auth.session.username);
  sh.getRange(row.__row, COLS.SP_Request.indexOf('Reviewed_At') + 1).setValue(_now_());
  _logActivity_(auth.session.username, auth.session.role, approve ? 'approve_sp_request' : 'reject_sp_request', noReq);
  return _ok_({ message: 'Request ' + noReq + ' berhasil ' + (approve ? 'disetujui.' : 'ditolak.') });
}

function _submitSparepartUsage_(p) {
  const nama_rs = _s_(p.nama_rs), nama_operator = _s_(p.nama_operator), tanggal = _s_(p.tanggal);
  if (!nama_rs) return _err_('validation', 'Nama Rumah Sakit wajib dipilih.');
  if (!nama_operator) return _err_('validation', 'Nama Operator wajib diisi.');
  if (!tanggal) return _err_('validation', 'Tanggal wajib diisi.');
  const parsed = _parseBarangItems_(p.items, nama_rs);
  if (parsed.error) return _err_('validation', parsed.error);
  const noPk = _genDocNo_('SP_Pemakaian');
  _sheet_('SP_Pemakaian').appendRow(_rowFor_('SP_Pemakaian', {
    No_Pemakaian: noPk, Timestamp: _now_(), Tanggal: tanggal, Nama_RS: nama_rs, Nama_Operator: nama_operator, Catatan: _s_(p.catatan),
  }));
  const itemsSh = _sheet_('SP_PemakaianItems');
  parsed.items.forEach((it) => itemsSh.appendRow(_rowFor_('SP_PemakaianItems', {
    No_Pemakaian: noPk, Kode_Barang: it.kode_barang, Nama_Barang: it.nama_barang, RH_Saat_Diganti: it.rh, Qty: it.qty,
  })));
  return _ok_({ message: 'Pemakaian barang ' + noPk + ' berhasil dicatat.', no_pemakaian: noPk });
}
function _listSparepartPemakaian_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const rows = _readAll_('SP_Pemakaian');
  const items = _readAll_('SP_PemakaianItems');
  const out = rows.map((r) => ({
    no_pemakaian: _s_(r.No_Pemakaian), timestamp: r.Timestamp, tanggal: r.Tanggal, nama_rs: r.Nama_RS,
    nama_operator: r.Nama_Operator, catatan: r.Catatan,
    items: items.filter((it) => _s_(it.No_Pemakaian) === _s_(r.No_Pemakaian))
      .map((it) => ({ kode_barang: it.Kode_Barang, nama_barang: it.Nama_Barang, rh: it.RH_Saat_Diganti, qty: it.Qty })),
  })).sort((a, b) => _s_(b.timestamp).localeCompare(_s_(a.timestamp)));
  return _ok_({ pemakaian: out });
}

function _submitSparepartPengiriman_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi', 'logistik']); if (auth.error) return auth.error;
  const nama_rs = _s_(p.nama_rs), tanggal_kirim = _s_(p.tanggal_kirim);
  const penerima_nama = _s_(p.penerima_nama), penerima_hp = _s_(p.penerima_hp);
  const nama_pengirim = _s_(p.nama_pengirim), jabatan_pengirim = _s_(p.jabatan_pengirim);
  if (!nama_rs) return _err_('validation', 'Nama Rumah Sakit wajib dipilih.');
  if (!tanggal_kirim) return _err_('validation', 'Tanggal Pengiriman wajib diisi.');
  if (!penerima_nama) return _err_('validation', 'Nama Penerima wajib diisi.');
  if (!nama_pengirim) return _err_('validation', 'Nama Pengirim wajib diisi.');
  if (!_s_(p.foto_resi_url)) return _err_('validation', 'Foto resi wajib diisi.');
  const parsed = _parseBarangItems_(p.items, nama_rs);
  if (parsed.error) return _err_('validation', parsed.error);
  const no_permintaan = _s_(p.no_permintaan);
  const noKrm = _genDocNo_('SP_Pengiriman');
  _sheet_('SP_Pengiriman').appendRow(_rowFor_('SP_Pengiriman', {
    No_Pengiriman: noKrm, No_Permintaan: no_permintaan, Timestamp: _now_(), Tanggal_Kirim: tanggal_kirim,
    Nama_RS: nama_rs, Penerima_Nama: penerima_nama, Penerima_HP: penerima_hp,
    Foto_Resi_URL: _s_(p.foto_resi_url), Nama_Pengirim: nama_pengirim, Jabatan_Pengirim: jabatan_pengirim,
    Status: 'Dikirim', Submitted_By: auth.session.username, Catatan: _s_(p.catatan),
  }));
  const itemsSh = _sheet_('SP_PengirimanItems');
  parsed.items.forEach((it) => itemsSh.appendRow(_rowFor_('SP_PengirimanItems', {
    No_Pengiriman: noKrm, Kode_Barang: it.kode_barang, Nama_Barang: it.nama_barang, Qty: it.qty,
  })));
  _logActivity_(auth.session.username, auth.session.role, 'submit_sp_pengiriman', noKrm);
  return _ok_({ message: 'Pengiriman ' + noKrm + ' berhasil dicatat.', no_pengiriman: noKrm });
}
function _listSparepartPengiriman_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi', 'logistik']); if (auth.error) return auth.error;
  let rows = _readAll_('SP_Pengiriman');
  if (auth.session.role === 'logistik' && p.mine) {
    rows = rows.filter((r) => _norm_(r.Submitted_By) === _norm_(auth.session.username));
  }
  const items = _readAll_('SP_PengirimanItems');
  const penerimaanApprovedByKrm = {};
  _readAll_('SP_Penerimaan').forEach((pr) => {
    if (_norm_(pr.Status) !== 'disetujui') return;
    penerimaanApprovedByKrm[_s_(pr.No_Pengiriman)] = _s_(pr.Foto_Barang_URL);
  });
  const out = rows.map((r) => ({
    no_pengiriman: _s_(r.No_Pengiriman), no_permintaan: _s_(r.No_Permintaan), timestamp: r.Timestamp,
    tanggal_kirim: r.Tanggal_Kirim, nama_rs: r.Nama_RS, penerima_nama: r.Penerima_Nama, penerima_hp: r.Penerima_HP,
    foto_resi_url: r.Foto_Resi_URL, nama_pengirim: r.Nama_Pengirim, jabatan_pengirim: r.Jabatan_Pengirim, status: r.Status,
    catatan: r.Catatan,
    foto_penerimaan_url: _norm_(r.Status) === 'diterima' ? (penerimaanApprovedByKrm[_s_(r.No_Pengiriman)] || '') : '',
    items: items.filter((it) => _s_(it.No_Pengiriman) === _s_(r.No_Pengiriman))
      .map((it) => ({ kode_barang: it.Kode_Barang, nama_barang: it.Nama_Barang, qty: it.Qty })),
  })).sort((a, b) => _s_(b.timestamp).localeCompare(_s_(a.timestamp)));
  return _ok_({ pengiriman: out });
}
function _listPengirimanTerbuka_(p) {
  const nama_rs = _s_(p.nama_rs);
  if (!nama_rs) return _ok_({ pengiriman: [] });
  const rows = _readAll_('SP_Pengiriman').filter((r) => _norm_(r.Nama_RS) === _norm_(nama_rs) && _norm_(r.Status) === 'dikirim');
  const items = _readAll_('SP_PengirimanItems');
  const out = rows.map((r) => ({
    no_pengiriman: _s_(r.No_Pengiriman), tanggal_kirim: r.Tanggal_Kirim,
    items: items.filter((it) => _s_(it.No_Pengiriman) === _s_(r.No_Pengiriman))
      .map((it) => ({ kode_barang: it.Kode_Barang, nama_barang: it.Nama_Barang, qty: it.Qty })),
  })).sort((a, b) => _s_(b.tanggal_kirim).localeCompare(_s_(a.tanggal_kirim)));
  return _ok_({ pengiriman: out });
}

function _submitSparepartPenerimaan_(p) {
  const nama_rs = _s_(p.nama_rs), nama_operator = _s_(p.nama_operator);
  const tanggal = _s_(p.tanggal_terima), no_pengiriman = _s_(p.no_pengiriman);
  if (!nama_rs) return _err_('validation', 'Nama Rumah Sakit wajib dipilih.');
  if (!nama_operator) return _err_('validation', 'Nama Operator wajib diisi.');
  if (!tanggal) return _err_('validation', 'Tanggal Terima wajib diisi.');
  if (!no_pengiriman) return _err_('validation', 'No. Pengiriman wajib dipilih.');
  if (!_s_(p.foto_barang_url)) return _err_('validation', 'Foto barang wajib diupload.');
  const krmRow = _readAll_('SP_Pengiriman').find((r) => _s_(r.No_Pengiriman) === no_pengiriman);
  if (!krmRow) return _err_('not_found', 'Pengiriman ' + no_pengiriman + ' tidak ditemukan.');
  const items = _readAll_('SP_PengirimanItems').filter((it) => _s_(it.No_Pengiriman) === no_pengiriman);
  const noTr = _genDocNo_('SP_Penerimaan');
  _sheet_('SP_Penerimaan').appendRow(_rowFor_('SP_Penerimaan', {
    No_Penerimaan: noTr, No_Pengiriman: no_pengiriman, Timestamp: _now_(), Tanggal_Terima: tanggal,
    Nama_RS: nama_rs, Nama_Operator: nama_operator, Foto_Barang_URL: _s_(p.foto_barang_url),
    Status: 'Menunggu', Catatan_Teknisi: '', Reviewed_By: '', Reviewed_At: '',
  }));
  const itemsSh = _sheet_('SP_PenerimaanItems');
  items.forEach((it) => itemsSh.appendRow(_rowFor_('SP_PenerimaanItems', {
    No_Penerimaan: noTr, Kode_Barang: it.Kode_Barang, Nama_Barang: it.Nama_Barang, Qty: it.Qty,
  })));
  return _ok_({ message: 'Konfirmasi penerimaan ' + noTr + ' berhasil dikirim, menunggu persetujuan Teknisi.', no_penerimaan: noTr });
}
function _listSparepartPenerimaan_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const status = _s_(p.status);
  let rows = _readAll_('SP_Penerimaan');
  if (status) rows = rows.filter((r) => _norm_(r.Status) === _norm_(status));
  const items = _readAll_('SP_PenerimaanItems');
  const out = rows.map((r) => ({
    no_penerimaan: _s_(r.No_Penerimaan), no_pengiriman: _s_(r.No_Pengiriman), timestamp: r.Timestamp,
    tanggal_terima: r.Tanggal_Terima, nama_rs: r.Nama_RS, nama_operator: r.Nama_Operator,
    foto_barang_url: r.Foto_Barang_URL, status: r.Status, catatan_teknisi: r.Catatan_Teknisi,
    reviewed_by: r.Reviewed_By, reviewed_at: r.Reviewed_At,
    items: items.filter((it) => _s_(it.No_Penerimaan) === _s_(r.No_Penerimaan))
      .map((it) => ({ kode_barang: it.Kode_Barang, nama_barang: it.Nama_Barang, qty: it.Qty })),
  })).sort((a, b) => _s_(b.timestamp).localeCompare(_s_(a.timestamp)));
  return _ok_({ penerimaan: out });
}
function _reviewSparepartPenerimaan_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const noTr = _s_(p.no_penerimaan), approve = !!p.approve;
  const rows = _readAll_('SP_Penerimaan');
  const row = rows.find((r) => _s_(r.No_Penerimaan) === noTr);
  if (!row) return _err_('not_found', 'Penerimaan tidak ditemukan.');
  const sh = _sheet_('SP_Penerimaan');
  sh.getRange(row.__row, COLS.SP_Penerimaan.indexOf('Status') + 1).setValue(approve ? 'Disetujui' : 'Ditolak');
  sh.getRange(row.__row, COLS.SP_Penerimaan.indexOf('Catatan_Teknisi') + 1).setValue(_s_(p.catatan_teknisi));
  sh.getRange(row.__row, COLS.SP_Penerimaan.indexOf('Reviewed_By') + 1).setValue(auth.session.username);
  sh.getRange(row.__row, COLS.SP_Penerimaan.indexOf('Reviewed_At') + 1).setValue(_now_());
  if (approve && _s_(row.No_Pengiriman)) {
    const krmRows = _readAll_('SP_Pengiriman');
    const krmRow = krmRows.find((r) => _s_(r.No_Pengiriman) === _s_(row.No_Pengiriman));
    if (krmRow) {
      _sheet_('SP_Pengiriman').getRange(krmRow.__row, COLS.SP_Pengiriman.indexOf('Status') + 1).setValue('Diterima');
    }
  }
  _logActivity_(auth.session.username, auth.session.role, approve ? 'approve_sp_penerimaan' : 'reject_sp_penerimaan', noTr);
  return _ok_({ message: 'Penerimaan ' + noTr + ' berhasil ' + (approve ? 'disetujui — stok RS bertambah otomatis & status pengiriman diperbarui.' : 'ditolak.') });
}

function _computeStockSparepart_(cutoffDate) {
  const stock = {};
  const bump = (rs, kode, nama, delta) => {
    if (!rs) return;
    const key = _norm_(rs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
    if (!stock[key]) stock[key] = { nama_rs: rs, kode_barang: kode, nama_barang: nama, qty: 0 };
    stock[key].qty += delta;
  };
  const penerimaanRsOk = {};
  _readAll_('SP_Penerimaan').forEach((r) => {
    if (_norm_(r.Status) !== 'disetujui') return;
    if (cutoffDate && _s_(r.Tanggal_Terima) > cutoffDate) return;
    penerimaanRsOk[_s_(r.No_Penerimaan)] = _s_(r.Nama_RS);
  });
  _readAll_('SP_PenerimaanItems').forEach((it) => {
    const rs = penerimaanRsOk[_s_(it.No_Penerimaan)]; if (!rs) return;
    bump(rs, _s_(it.Kode_Barang), _s_(it.Nama_Barang), Number(it.Qty) || 0);
  });
  const pemakaianRs = {};
  _readAll_('SP_Pemakaian').forEach((r) => {
    if (cutoffDate && _s_(r.Tanggal) > cutoffDate) return;
    pemakaianRs[_s_(r.No_Pemakaian)] = _s_(r.Nama_RS);
  });
  _readAll_('SP_PemakaianItems').forEach((it) => {
    const rs = pemakaianRs[_s_(it.No_Pemakaian)]; if (!rs) return;
    bump(rs, _s_(it.Kode_Barang), _s_(it.Nama_Barang), -(Number(it.Qty) || 0));
  });
  _readAll_('SP_Penyesuaian').forEach((r) => {
    if (cutoffDate && _s_(r.Tanggal) > cutoffDate) return;
    bump(_s_(r.Nama_RS), _s_(r.Kode_Barang), _s_(r.Nama_Barang), Number(r.Delta) || 0);
  });
  return stock;
}

function _latestSparepartCatatan_() {
  const latest = {};
  _readAll_('SP_Penyesuaian').forEach((r) => {
    const rs = _s_(r.Nama_RS), kode = _s_(r.Kode_Barang), nama = _s_(r.Nama_Barang);
    if (!rs) return;
    const key = _norm_(rs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
    const ts = _s_(r.Timestamp);
    if (!latest[key] || ts > latest[key].ts) latest[key] = { ts: ts, catatan: _s_(r.Catatan) };
  });
  const out = {};
  Object.keys(latest).forEach((k) => { out[k] = latest[k].catatan; });
  return out;
}

function _computeSparepartUsageForMonth_(ym) {
  const usage = {};
  const bump = (rs, kode, nama, delta) => {
    if (!rs) return;
    const key = _norm_(rs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
    usage[key] = (usage[key] || 0) + delta;
  };
  const pemakaianRsInMonth = {};
  _readAll_('SP_Pemakaian').forEach((r) => {
    const tgl = _s_(r.Tanggal);
    if (!tgl || tgl.slice(0, 7) !== ym) return;
    pemakaianRsInMonth[_s_(r.No_Pemakaian)] = _s_(r.Nama_RS);
  });
  _readAll_('SP_PemakaianItems').forEach((it) => {
    const rs = pemakaianRsInMonth[_s_(it.No_Pemakaian)]; if (!rs) return;
    bump(rs, _s_(it.Kode_Barang), _s_(it.Nama_Barang), Number(it.Qty) || 0);
  });
  return usage;
}

function _computeSparepartDikirimForMonth_(ym) {
  const dikirim = {};
  const bump = (rs, kode, nama, delta) => {
    if (!rs) return;
    const key = _norm_(rs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
    dikirim[key] = (dikirim[key] || 0) + delta;
  };
  const pengirimanRsInMonth = {};
  _readAll_('SP_Pengiriman').forEach((r) => {
    if (_norm_(r.Status) !== 'diterima') return;
    const tgl = _s_(r.Tanggal_Kirim);
    if (!tgl || tgl.slice(0, 7) !== ym) return;
    pengirimanRsInMonth[_s_(r.No_Pengiriman)] = _s_(r.Nama_RS);
  });
  _readAll_('SP_PengirimanItems').forEach((it) => {
    const rs = pengirimanRsInMonth[_s_(it.No_Pengiriman)]; if (!rs) return;
    bump(rs, _s_(it.Kode_Barang), _s_(it.Nama_Barang), Number(it.Qty) || 0);
  });
  return dikirim;
}

function _getStockSparepart_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const stock = _computeStockSparepart_();
  const ymSekarang = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM');
  const usage = _computeSparepartUsageForMonth_(ymSekarang);
  const catatanMap = _latestSparepartCatatan_();
  const master = _readAll_('SP_Master').filter((r) => !(_s_(r.Active) === 'false' || r.Active === false));
  let out = master.map((m) => {
    const kode = _s_(m.Kode_Barang), nama = _s_(m.Nama_Barang), rs = _s_(m.Nama_RS);
    const key = _norm_(rs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
    return {
      item_id: _s_(m.Item_Id), nama_rs: rs, kode_barang: kode, nama_barang: nama, satuan: _s_(m.Satuan),
      qty: stock[key] ? stock[key].qty : 0, dipakai_bulan_ini: usage[key] || 0,
      catatan: catatanMap[key] || '',
    };
  });
  if (_s_(p.nama_rs)) out = out.filter((r) => _norm_(r.nama_rs) === _norm_(p.nama_rs));
  out.sort((a, b) => a.nama_rs.localeCompare(b.nama_rs) || a.nama_barang.localeCompare(b.nama_barang));
  return _ok_({ stock: out });
}

function _submitSparepartPenyesuaian_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const itemId = _s_(p.item_id);
  if (!itemId) return _err_('validation', 'Barang wajib dipilih.');
  const qtyBaru = Number(p.qty_baru);
  if (!isFinite(qtyBaru)) return _err_('validation', 'Jumlah baru harus berupa angka.');
  const m = _readAll_('SP_Master').find((r) => _s_(r.Item_Id) === itemId);
  if (!m) return _err_('not_found', 'Barang tidak ditemukan di Sparepart Master.');
  const namaRs = _s_(m.Nama_RS), kode = _s_(m.Kode_Barang), nama = _s_(m.Nama_Barang);
  const stock = _computeStockSparepart_();
  const key = _norm_(namaRs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
  const qtySebelum = stock[key] ? stock[key].qty : 0;
  const delta = qtyBaru - qtySebelum;
  const noPy = _genDocNo_('SP_Penyesuaian');
  _sheet_('SP_Penyesuaian').appendRow(_rowFor_('SP_Penyesuaian', {
    No_Penyesuaian: noPy, Timestamp: _now_(),
    Tanggal: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd'),
    Nama_RS: namaRs, Item_Id: itemId, Kode_Barang: kode, Nama_Barang: nama,
    Qty_Sebelum: qtySebelum, Qty_Sesudah: qtyBaru, Delta: delta,
    Catatan: _s_(p.catatan), Submitted_By: auth.session.username,
  }));
  _logActivity_(auth.session.username, auth.session.role, 'submit_sp_penyesuaian',
    noPy + ' — ' + nama + ' @ ' + namaRs + ': ' + qtySebelum + ' -> ' + qtyBaru);
  return _ok_({ message: 'Penyesuaian stok tersimpan — ' + nama + ' di ' + namaRs + ' sekarang ' + qtyBaru + '.', no_penyesuaian: noPy, qty_baru: qtyBaru });
}

const JUNK_SHEET_NAME_RE = /^Sheet\d+$/i;

function _scanJunkSheetsRaw_() {
  const expectedHeaders = COLS.SP_Penyesuaian;
  return SS.getSheets().filter((sh) => JUNK_SHEET_NAME_RE.test(sh.getName())).map((sh) => {
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    const headerRow = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => _s_(h)) : [];
    const matchesSchema = headerRow.length === expectedHeaders.length
      && expectedHeaders.every((h, i) => headerRow[i] === h);
    return { sheet: sh, name: sh.getName(), data_rows: Math.max(0, lastRow - 1), matches_schema: matchesSchema };
  });
}

function _adminScanJunkSheets_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const found = _scanJunkSheetsRaw_();
  return _ok_({
    sheets: found.map((f) => ({ name: f.name, data_rows: f.data_rows, unknown_schema: !f.matches_schema })),
  });
}

function _shrinkSheetGridIfOversized_(sh, neededRows, neededCols) {
  try {
    const bufferRows = 50;
    const wantRows = Math.max(neededRows + bufferRows, 2);
    const maxRows = sh.getMaxRows();
    if (maxRows > wantRows) sh.deleteRows(wantRows + 1, maxRows - wantRows);
    const maxCols = sh.getMaxColumns();
    if (maxCols > neededCols) sh.deleteColumns(neededCols + 1, maxCols - neededCols);
  } catch (e) { }
}

function _adminCleanupJunkSheets_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const found = _scanJunkSheetsRaw_();
  const toClean = found.filter((f) => f.matches_schema);
  const skipped = found.filter((f) => !f.matches_schema).map((f) => f.name);
  const emptyOnes = toClean.filter((f) => f.data_rows === 0);
  const withData = toClean.filter((f) => f.data_rows > 0);

  let deletedCount = 0, rowsMoved = 0;
  const failed = [];

  emptyOnes.forEach((f) => {
    try {
      SS.deleteSheet(f.sheet);
      deletedCount++;
    } catch (e) {
      failed.push(f.name + ' (hapus): ' + e.message);
    }
  });

  if (withData.length) {
    let target;
    try {
      target = _sheet_('SP_Penyesuaian');
      const totalNewRows = withData.reduce((sum, f) => sum + f.data_rows, 0);
      _shrinkSheetGridIfOversized_(target, target.getLastRow() + totalNewRows, COLS.SP_Penyesuaian.length);
    } catch (e) {
      const namesWithData = withData.map((f) => f.name).join(', ');
      _logActivity_(auth.session.username, auth.session.role, 'cleanup_junk_sheets',
        deletedCount + ' sheet kosong dihapus, GAGAL siapkan SP_Penyesuaian: ' + e.message);
      return _ok_({
        message: 'Sebagian selesai: ' + deletedCount + ' sheet kosong berhasil dihapus (membebaskan cell). '
          + 'TAPI masih gagal menyiapkan sheet SP_Penyesuaian untuk memindahkan data dari ' + withData.length
          + ' sheet (' + namesWithData + '): ' + e.message
          + '. Jalankan ulang — sheet kosong yang sudah terhapus tidak akan diulang, tinggal sisa ini yang perlu dibereskan.',
        deleted_count: deletedCount, rows_moved: 0, skipped_unknown_schema: skipped,
        partial_failure: true, remaining_with_data: withData.map((f) => f.name),
      });
    }
    withData.forEach((f) => {
      const sh = f.sheet;
      try {
        const lastRow = sh.getLastRow();
        if (lastRow > 1) {
          const lastCol = sh.getLastColumn();
          const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues()
            .filter((row) => row.some((c) => c !== '' && c !== null));
          if (values.length) {
            target.getRange(target.getLastRow() + 1, 1, values.length, lastCol).setValues(values);
            rowsMoved += values.length;
          }
        }
        SS.deleteSheet(sh);
        deletedCount++;
      } catch (e) {
        failed.push(f.name + ' (pindah data): ' + e.message);
      }
    });
  }

  _logActivity_(auth.session.username, auth.session.role, 'cleanup_junk_sheets',
    deletedCount + ' sheet dihapus, ' + rowsMoved + ' baris dipindah ke SP_Penyesuaian'
    + (skipped.length ? ', ' + skipped.length + ' dilewati (schema tidak dikenal)' : '')
    + (failed.length ? ', ' + failed.length + ' GAGAL: ' + failed.join(' | ') : ''));

  const messageParts = [deletedCount + ' sheet sampah dihapus, ' + rowsMoved + ' baris data dipindah ke SP_Penyesuaian.'];
  if (skipped.length) messageParts.push(skipped.length + ' sheet dilewati (schema tidak dikenal, cek manual): ' + skipped.join(', ') + '.');
  if (failed.length) messageParts.push(failed.length + ' sheet GAGAL diproses (coba jalankan ulang scriptnya): ' + failed.join(' | ') + '.');

  return _ok_({
    message: (failed.length ? 'Sebagian selesai: ' : 'Selesai: ') + messageParts.join(' '),
    deleted_count: deletedCount, rows_moved: rowsMoved, skipped_unknown_schema: skipped, failed: failed,
  });
}

function _importSparepartMasterBulk_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const rowsIn = Array.isArray(p.rows) ? p.rows : [];
  if (!rowsIn.length) return _err_('validation', 'Tidak ada baris untuk diimpor.');

  const sh = _sheet_('SP_Master');
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map((h) => _s_(h));
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  const byKode = {}, byNama = {};
  let maxItemN = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every((c) => c === '' || c === null)) continue;
    const rs = _norm_(row[col.Nama_RS]), kode = _s_(row[col.Kode_Barang]), nama = _s_(row[col.Nama_Barang]);
    if (kode) byKode[rs + '|||' + _norm_(kode)] = i; else byNama[rs + '|||' + _norm_(nama)] = i;
    const m = /^SPM(\d+)$/.exec(_s_(row[col.Item_Id]));
    if (m) maxItemN = Math.max(maxItemN, parseInt(m[1], 10));
  }

  let inserted = 0, updated = 0, skipped = 0;
  const newRows = [];
  rowsIn.forEach((r) => {
    const namaRs = _s_(r.nama_rs), nama = _s_(r.nama_barang);
    if (!namaRs || !nama) { skipped++; return; }
    const kode = _s_(r.kode_barang), satuan = _s_(r.satuan);
    const rsN = _norm_(namaRs);
    const kodeKey = kode ? (rsN + '|||' + _norm_(kode)) : null;
    const namaKey = rsN + '|||' + _norm_(nama);
    const rowIdx = kode ? byKode[kodeKey] : byNama[namaKey];
    if (rowIdx !== undefined) {
      const row = values[rowIdx];
      row[col.Nama_RS] = namaRs; row[col.Kode_Barang] = kode; row[col.Nama_Barang] = nama;
      row[col.Satuan] = satuan; row[col.Active] = true;
      updated++;
    } else {
      maxItemN++;
      const newId = 'SPM' + String(maxItemN).padStart(6, '0');
      const newRow = headers.map((h) => {
        if (h === 'Nama_RS') return namaRs;
        if (h === 'Kode_Barang') return kode;
        if (h === 'Nama_Barang') return nama;
        if (h === 'Satuan') return satuan;
        if (h === 'Active') return true;
        if (h === 'Created_At') return _now_();
        if (h === 'Item_Id') return newId;
        return '';
      });
      values.push(newRow);
      newRows.push(newRow);
      if (kode) byKode[kodeKey] = values.length - 1; else byNama[namaKey] = values.length - 1;
      inserted++;
    }
  });

  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, lastCol).setValues(values.slice(1, lastRow));
  if (newRows.length) sh.getRange(lastRow + 1, 1, newRows.length, lastCol).setValues(newRows);

  _logActivity_(auth.session.username, auth.session.role, 'import_sparepart_master', inserted + ' baru, ' + updated + ' diperbarui, ' + skipped + ' dilewati');
  return _ok_({ message: 'Import selesai: ' + inserted + ' barang baru, ' + updated + ' diperbarui' + (skipped ? ', ' + skipped + ' baris dilewati (RS/nama kosong).' : '.'), inserted: inserted, updated: updated, skipped: skipped });
}

const RECAP_BULAN_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
function _monthEndDate_(ym) {
  const parts = ym.split('-'); const y = Number(parts[0]), m = Number(parts[1]);
  const last = new Date(y, m, 0).getDate();
  return ym + '-' + String(last).padStart(2, '0');
}
function _getSparepartRecapBulanan_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const nowYm = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM');
  const ym = /^\d{4}-\d{2}$/.test(_s_(p.bulan)) ? _s_(p.bulan) : nowYm;
  const bulan = { key: ym, label: RECAP_BULAN_ABBR[Number(ym.slice(5, 7)) - 1] };
  const master = _readAll_('SP_Master').map((r) => ({
    nama_rs: _s_(r.Nama_RS), kode_barang: _s_(r.Kode_Barang), nama_barang: _s_(r.Nama_Barang), satuan: _s_(r.Satuan),
  }));
  const stock = _computeStockSparepart_(_monthEndDate_(ym));
  const penyesuaian = _computeSparepartUsageForMonth_(ym);
  const dikirim = _computeSparepartDikirimForMonth_(ym);
  const keyOf = (rs, kode, nama) => _norm_(rs) + '|||' + (kode ? _norm_(kode) : ('NONAME:' + _norm_(nama)));
  const items = master
    .sort((a, b) => a.nama_rs.localeCompare(b.nama_rs) || a.nama_barang.localeCompare(b.nama_barang))
    .map((it) => {
      const k = keyOf(it.nama_rs, it.kode_barang, it.nama_barang);
      return {
        nama_rs: it.nama_rs, kode_barang: it.kode_barang, nama_barang: it.nama_barang, satuan: it.satuan,
        qty: stock[k] ? stock[k].qty : 0, penyesuaian: penyesuaian[k] || 0, dikirim: dikirim[k] || 0,
      };
    });
  return _ok_({ bulan: bulan, items: items });
}

const SP_UPLOAD_FOLDER_NAME = 'GPI Sparepart Uploads';
function _spUploadFolder_() {
  const it = DriveApp.getFoldersByName(SP_UPLOAD_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(SP_UPLOAD_FOLDER_NAME);
}
function _uploadFotoSparepart_(p) {
  const b64raw = _s_(p.base64);
  if (!b64raw) return _err_('validation', 'Data foto kosong.');
  const b64 = b64raw.indexOf(',') !== -1 ? b64raw.split(',')[1] : b64raw;
  const filename = _s_(p.filename) || ('foto-' + Date.now() + '.jpg');
  const mime = _s_(p.mime_type) || 'image/jpeg';
  let bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { return _err_('validation', 'Data foto tidak valid (base64 gagal didekode).'); }
  const blob = Utilities.newBlob(bytes, mime, filename);
  const folder = _spUploadFolder_();
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  return _ok_({ url: url, file_id: file.getId() });
}

function _maskEmailForStatus_() {
  let email = '';
  try { email = _s_(Session.getEffectiveUser().getEmail()); } catch (err) { email = ''; }
  if (!email || email.indexOf('@') === -1) return '(cek di Terapkan → Kelola deployment → "Jalankan sebagai")';
  const parts = email.split('@');
  return parts[0].slice(0, 3) + '***@' + parts[1];
}
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'ping') return _ok_({ pong: new Date().toISOString(), version: BACKEND_BUILD_VERSION });
  if (!action) {
    const html = '<!doctype html><html><head><meta charset="utf-8">'
      + '<title>Dashboard Teknisi GPI — Status Backend</title>'
      + '<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#1a1a1a;line-height:1.5}'
      + 'code{background:#f1f1f1;padding:3px 8px;border-radius:6px;font-size:1.05em}'
      + 'h1{font-size:19px;margin-bottom:20px}.ver{font-size:24px;margin:14px 0}.hint{color:#666;font-size:13px;margin-top:28px;border-top:1px solid #e5e5e5;padding-top:16px}</style>'
      + '</head><body>'
      + '<h1>Dashboard Teknisi GPI — Backend Apps Script</h1>'
      + '<p>Versi kode yang sedang <b>AKTIF/LIVE</b> di balik URL Web App ini sekarang:</p>'
      + '<p class="ver"><code>' + BACKEND_BUILD_VERSION + '</code></p>'
      + '<p>Waktu server saat halaman ini dimuat: <code>' + new Date().toString() + '</code></p>'
      + '<p>Web App dijalankan oleh (pengirim email notifikasi): <code>' + _maskEmailForStatus_() + '</code></p>'
      + '<p class="hint">Kalau versi di atas TIDAK sesuai dengan versi terbaru yang diharapkan, redeploy belum '
      + 'berhasil kena. Cek lagi: Deploy → Manage deployments → klik ikon <b>pensil</b> pada deployment yang '
      + '<b>SUDAH ADA</b> (BUKAN tombol "New deployment") → Version: pilih "New version" → Deploy.</p>'
      + '</body></html>';
    return HtmlService.createHtmlOutput(html);
  }
  return _err_('unknown_action', 'Endpoint ini hanya menerima POST untuk sebagian besar aksi.');
}

const READ_ONLY_ACTIONS = new Set([
  'ping', 'accountsExist',
  'getReports', 'listAccounts', 'getActivityLog', 'getMonthlySnapshots',
  'listRumahSakit', 'getShiftsTaken', 'listRsPublic',
  'listSparepartMaster', 'listSparepartActive', 'getSparepartRecapBulanan',
  'listSparepartRequests', 'listSparepartRequestPublic',
  'listSparepartPengiriman', 'listPengirimanTerbuka',
  'listSparepartPenerimaan', 'listSparepartPemakaian',
  'getStockSparepart', 'adminScanJunkSheets',
]);

function doPost(e) {
  const raw = (e && e.postData && e.postData.contents) || '{}';
  let p;
  try { p = JSON.parse(raw); } catch (err) { return _err_('bad_json', 'Data yang dikirim tidak valid.'); }
  const type = p.type || '';

  if (READ_ONLY_ACTIONS.has(type)) {
    try {
      return _dispatch_(type, p);
    } catch (err) {
      return _err_('server_error', 'Terjadi kesalahan tak terduga: ' + err);
    }
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(9000);
  } catch (err) {
    return _err_('busy', 'Server sedang sibuk, coba lagi sebentar lagi.');
  }
  try {
    return _dispatch_(type, p);
  } catch (err) {
    return _err_('server_error', 'Terjadi kesalahan tak terduga: ' + err);
  } finally {
    lock.releaseLock();
  }
}

function _dispatch_(type, p) {
  switch (type) {
    case 'ping': return _ok_({ pong: new Date().toISOString(), version: BACKEND_BUILD_VERSION });
    case 'accountsExist': return _ok_({ exists: _readAll_('Akun').length > 0 });
    case 'bootstrapAdmin': return _bootstrapAdmin_(p);
    case 'login': return _login_(p);
    case 'logout': return _logout_(p);
    case 'confirmRsOperatorLogin': return _confirmRsOperatorLogin_(p);
    case 'changeOwnPassword': return _changeOwnPassword_(p);
    case 'submitReport': return _submitReport_(p);
    case 'getReports': return _getReports_(p);
    case 'getRsEquipmentInfo': return _getRsEquipmentInfo_(p);
    case 'listAccounts': return _listAccounts_(p);
    case 'createAccount': return _createAccount_(p);
    case 'setAccountActive': return _setAccountActive_(p);
    case 'setAccountApproval': return _setAccountApproval_(p);
    case 'resetPassword': return _resetPassword_(p);
    case 'getActivityLog': return _getActivityLog_(p);
    case 'snapshotBulanan': return _snapshotBulanan_(p);
    case 'getMonthlySnapshots': return _getMonthlySnapshots_(p);
    case 'listRumahSakit': return _listRumahSakit_(p);
    case 'setRumahSakitAccount': return _setRumahSakitAccount_(p);
    case 'setRumahSakitActive': return _setRumahSakitActive_(p);
    case 'deleteRumahSakit': return _deleteRumahSakit_(p);
    case 'getShiftsTaken': return _getShiftsTaken_(p);
    case 'updateReport': return _updateReport_(p);

    case 'listRsPublic': return _listRsPublic_(p);
    case 'listSparepartMaster': return _listSparepartMaster_(p);
    case 'listSparepartActive': return _listSparepartActive_(p);
    case 'setSparepartMaster': return _setSparepartMaster_(p);
    case 'setSparepartMasterActive': return _setSparepartMasterActive_(p);
    case 'deleteSparepartMaster': return _deleteSparepartMaster_(p);
    case 'importSparepartMasterBulk': return _importSparepartMasterBulk_(p);
    case 'getSparepartRecapBulanan': return _getSparepartRecapBulanan_(p);
    case 'submitSparepartRequest': return _submitSparepartRequest_(p);
    case 'submitSparepartUsage': return _submitSparepartUsage_(p);
    case 'listSparepartRequests': return _listSparepartRequests_(p);
    case 'listSparepartRequestPublic': return _listSparepartRequestPublic_(p);
    case 'reviewSparepartRequest': return _reviewSparepartRequest_(p);
    case 'submitSparepartPengiriman': return _submitSparepartPengiriman_(p);
    case 'listSparepartPengiriman': return _listSparepartPengiriman_(p);
    case 'listPengirimanTerbuka': return _listPengirimanTerbuka_(p);
    case 'submitSparepartPenerimaan': return _submitSparepartPenerimaan_(p);
    case 'listSparepartPenerimaan': return _listSparepartPenerimaan_(p);
    case 'reviewSparepartPenerimaan': return _reviewSparepartPenerimaan_(p);
    case 'listSparepartPemakaian': return _listSparepartPemakaian_(p);
    case 'getStockSparepart': return _getStockSparepart_(p);
    case 'submitSparepartPenyesuaian': return _submitSparepartPenyesuaian_(p);
    case 'uploadFotoSparepart': return _uploadFotoSparepart_(p);
    case 'adminScanJunkSheets': return _adminScanJunkSheets_(p);
    case 'adminCleanupJunkSheets': return _adminCleanupJunkSheets_(p);
    default: return _err_('unknown_type', 'Aksi tidak dikenal: ' + type);
  }
}

function _bootstrapAdmin_(p) {
  const existing = _readAll_('Akun');
  if (existing.length > 0) return _err_('already_setup', 'Sudah ada akun terdaftar. Hubungi admin untuk dibuatkan akun.');
  const username = _s_(p.username), password = _s_(p.password), name = _s_(p.name) || username;
  if (!username || !password) return _err_('validation', 'Username dan password wajib diisi.');
  if (password.length < 6) return _err_('validation', 'Password minimal 6 karakter.');
  const sh = _sheet_('Akun');
  sh.appendRow(_rowFor_('Akun', { Username: username, Password: password, Role: 'admin', Name: name, Active: true, Created_At: _now_(), Created_By: 'bootstrap', Last_Login: '', Approval_Status: 'approved' }));
  _logActivity_(username, 'admin', 'bootstrap_admin', 'Akun admin pertama dibuat');
  return _ok_({ message: 'Akun admin pertama berhasil dibuat. Silakan login.' });
}

function _login_(p) {
  const username = _s_(p.username), password = _s_(p.password);
  if (!username || !password) return _err_('validation', 'Username dan password wajib diisi.');

  const rows = _readAll_('Akun');
  const found = rows.find((r) => _norm_(r.Username) === _norm_(username));
  if (found) {
    if (_s_(found.Password) !== password) return _err_('bad_credentials', 'Username atau password salah.');
    const approval = _s_(found.Approval_Status);
    if (approval === 'pending') return _err_('pending_approval', 'Akun Anda sedang menunggu persetujuan Admin. Coba lagi nanti.');
    if (approval === 'rejected') return _err_('rejected', 'Registrasi akun Anda ditolak oleh Admin. Hubungi Admin untuk info lebih lanjut.');
    if (_s_(found.Active) === 'false' || found.Active === false) return _err_('inactive', 'Akun Anda dinonaktifkan. Hubungi admin.');

    const token = _newToken_();
    _sheet_('Sessions').appendRow(_rowFor_('Sessions', {
      Token: token, Username: found.Username, Role: found.Role, Name: found.Name,
      Created_At: _now_(), Expires_At: _nowPlus_(SESSION_TTL_HOURS),
    }));
    const akunSh = _sheet_('Akun');
    akunSh.getRange(found.__row, COLS.Akun.indexOf('Last_Login') + 1).setValue(_now_());
    _logActivity_(found.Username, found.Role, 'login', '');
    return _ok_({ token: token, role: _s_(found.Role), name: _s_(found.Name) || found.Username, username: found.Username, backend_version: BACKEND_BUILD_VERSION });
  }

  const rsRows = _readAll_('RS');
  const rsFound = rsRows.find((r) => _norm_(r.Username) === _norm_(username));
  if (!rsFound || !_s_(rsFound.Username)) return _err_('bad_credentials', 'Username atau password salah.');
  if (_s_(rsFound.Password) !== password) return _err_('bad_credentials', 'Username atau password salah.');
  if (_s_(rsFound.Active) === 'false' || rsFound.Active === false) return _err_('inactive', 'Akun rumah sakit ini dinonaktifkan. Hubungi Teknisi/Admin.');

  const token = _newToken_();
  _sheet_('Sessions').appendRow(_rowFor_('Sessions', {
    Token: token, Username: rsFound.Username, Role: 'rs', Name: rsFound.Nama_RS,
    Created_At: _now_(), Expires_At: _nowPlus_(SESSION_TTL_HOURS),
  }));
  const operators = [rsFound.Operator1, rsFound.Operator2, rsFound.Operator3].map(_s_).filter(Boolean);
  return _ok_({
    token: token, role: 'rs', name: _s_(rsFound.Nama_RS) || rsFound.Username, username: rsFound.Username,
    nama_rs: _s_(rsFound.Nama_RS), daerah_rs: _s_(rsFound.Daerah_RS), operators: operators,
    backend_version: BACKEND_BUILD_VERSION,
  });
}

function _confirmRsOperatorLogin_(p) {
  const auth = _requireAuth_(p.token, 'rs'); if (auth.error) return auth.error;
  const operatorNama = _s_(p.operator_nama);
  const detail = auth.session.name + (operatorNama ? ' · Operator: ' + operatorNama : '');
  _logActivity_(auth.session.username, 'rs', 'login', detail);
  return _ok_({});
}

function _logout_(p) {
  const auth = _requireAuth_(p.token); if (auth.error) return auth.error;
  const rows = _readAll_('Sessions');
  const row = rows.find((r) => _s_(r.Token) === _s_(p.token));
  if (row) _sheet_('Sessions').deleteRow(row.__row);
  _logActivity_(auth.session.username, auth.session.role, 'logout', '');
  return _ok_({});
}

function _changeOwnPassword_(p) {
  const auth = _requireAuth_(p.token); if (auth.error) return auth.error;
  const newPassword = _s_(p.newPassword), oldPassword = _s_(p.oldPassword);
  if (!newPassword || newPassword.length < 6) return _err_('validation', 'Password baru minimal 6 karakter.');
  const rows = _readAll_('Akun');
  const row = rows.find((r) => _norm_(r.Username) === _norm_(auth.session.username));
  if (!row) return _err_('not_found', 'Akun tidak ditemukan.');
  if (_s_(row.Password) !== oldPassword) return _err_('bad_credentials', 'Password lama salah.');
  _sheet_('Akun').getRange(row.__row, COLS.Akun.indexOf('Password') + 1).setValue(newPassword);
  _logActivity_(auth.session.username, auth.session.role, 'change_password', 'Ganti password sendiri');
  return _ok_({ message: 'Password berhasil diubah.' });
}

function _submitReport_(p) {
  const auth = _requireAuth_(p.token, 'rs'); if (auth.error) return auth.error;
  const rsRow = _readAll_('RS').find((r) => _norm_(r.Username) === _norm_(auth.session.username));
  if (!rsRow) return _err_('forbidden', 'Akun rumah sakit ini tidak ditemukan atau sudah dihapus.');

  const parsed = _validateSubmission_(p);
  if (parsed.errors) return _err_('validation', 'Beberapa field belum benar.', { errors: parsed.errors });

  const operatorOptions = [rsRow.Operator1, rsRow.Operator2, rsRow.Operator3].map(_s_).filter(Boolean);
  const opMatch = operatorOptions.find((o) => _norm_(o) === _norm_(parsed.meta.operator_nama));
  if (!opMatch) {
    return _err_('validation', 'Beberapa field belum benar.', { errors: { 'identitas.operator_nama': 'Pilih nama operator dari daftar (' + operatorOptions.join(', ') + ')' } });
  }

  const meta = Object.assign({}, parsed.meta, { nama_rs: rsRow.Nama_RS, daerah_rs: rsRow.Daerah_RS, operator_nama: opMatch });
  parsed.docs.nama_rs = rsRow.Nama_RS; parsed.docs.daerah_rs = rsRow.Daerah_RS;
  if (parsed.wwz) { parsed.wwz.nama_rs = rsRow.Nama_RS; }
  if (parsed.gow) { parsed.gow.nama_rs = rsRow.Nama_RS; }

  if (!p.confirm_duplicate) {
    const existing = _readAll_('DOCS').find((r) =>
      _norm_(r.Nama_RS) === _norm_(meta.nama_rs) && _s_(r.Tanggal) === meta.tanggal &&
      _norm_(r.Shift) === _norm_(meta.shift));
    if (existing) {
      return _err_('duplicate', 'Laporan DOCS untuk ' + meta.nama_rs + ' tanggal ' + meta.tanggal +
        ' shift ' + meta.shift +
        ' sudah pernah dikirim (pukul ' + _s_(existing.Timestamp) + ' oleh ' + _s_(existing.Submitted_By_Name || existing.Submitted_By) + '). Kirim ulang hanya jika ini koreksi data.');
    }
  }

  const ts = _now_();
  const who = { Submitted_By: auth.session.username, Submitted_By_Name: meta.operator_nama };
  const written = [];

  const docsExtra = Object.assign({
    Timestamp: ts, Nama_RS: parsed.docs.nama_rs, Daerah_RS: parsed.docs.daerah_rs,
    Tanggal: parsed.docs.tanggal, Bulan: parsed.docs.bulan, 'Purity_%': parsed.docs.purity,
    Running_Hours: parsed.docs.running_hours, Pressure: parsed.docs.pressure,
    Box_Temperature: parsed.docs.box_temperature,
    XT1: parsed.docs.xt1, XT2: parsed.docs.xt2, XT3: parsed.docs.xt3, XT4: parsed.docs.xt4,
    RTD1: parsed.docs.rtd1, RTD2: parsed.docs.rtd2, RTD3: parsed.docs.rtd3, RTD4: parsed.docs.rtd4,
    Shift: parsed.docs.shift, Jam_Lapor: parsed.docs.jam_lapor,
    VSA: parsed.docs.vsa, SCR: parsed.docs.scr,
    Flow_Avg_LPM: parsed.docs.flow_avg_lpm, Flow_Total_M3: parsed.docs.flow_total_m3,
    Catatan: parsed.docs.catatan, Catatan_Operator: parsed.docs.catatan_operator,
  }, who);
  _sheet_('DOCS').appendRow(_rowFor_('DOCS', {}, docsExtra));
  written.push('Laporan_DOCS');
  const notifEntries = [{ mesin: 'DOCS', sheetKey: 'DOCS', row: docsExtra, unit: null }];

  if (parsed.wwz) {
    const wwzExtra = Object.assign({
      Timestamp: ts, Nama_RS: parsed.wwz.nama_rs, Tanggal: parsed.wwz.tanggal, Bulan: parsed.wwz.bulan,
      Running_Hours: parsed.wwz.running_hours,
      Temp1: parsed.wwz.temp_disc1, Temp2: parsed.wwz.temp_disc2,
      Press1: parsed.wwz.press_inlet, Press2: parsed.wwz.press_l1, Press3: parsed.wwz.press_l2,
      Shift: parsed.wwz.shift, Jam_Lapor: parsed.wwz.jam_lapor,
      Riset_RH: parsed.wwz.riset_rh,
      Unit: parsed.wwz.unit || '1',
      Jumlah_Produksi_Tabung_O2: parsed.wwz.jumlah_produksi_tabung_o2,
      Catatan: parsed.wwz.catatan,
    }, who);
    _sheet_('WWZ').appendRow(_rowFor_('WWZ', {}, wwzExtra));
    written.push('Laporan_WWZ');
    notifEntries.push({ mesin: 'WWZ', sheetKey: 'WWZ', row: wwzExtra, unit: _s_(wwzExtra.Unit) || '1' });
  }
  if (parsed.gow) {
    const gowExtra = Object.assign({
      Timestamp: ts, Nama_RS: parsed.gow.nama_rs, Tanggal: parsed.gow.tanggal, Bulan: parsed.gow.bulan,
      Running_Hours: parsed.gow.running_hours,
      Temp1: parsed.gow.temp_ex1, Temp2: parsed.gow.temp_ex2, Temp3: parsed.gow.temp_ex3, Temp4: parsed.gow.temp_ex4,
      Press_Inlet: parsed.gow.press_inlet,
      Press1: parsed.gow.press_ex1, Press2: parsed.gow.press_ex2, Press3: parsed.gow.press_ex3, Press4: parsed.gow.press_ex4,
      Shift: parsed.gow.shift, Jam_Lapor: parsed.gow.jam_lapor,
      Unit: parsed.gow.unit || '1',
      Jumlah_Produksi_Tabung_O2: parsed.gow.jumlah_produksi_tabung_o2,
      Riset_RH: parsed.gow.riset_rh,
      Catatan: parsed.gow.catatan,
    }, who);
    _sheet_('GOW').appendRow(_rowFor_('GOW', {}, gowExtra));
    written.push('Laporan_GOW');
    notifEntries.push({ mesin: 'GOW', sheetKey: 'GOW', row: gowExtra, unit: _s_(gowExtra.Unit) || '1' });
  }

  try {
    _notifEmailOnSubmit_(notifEntries, meta.operator_nama);
  } catch (errNotif) {
    console.error('Email notifikasi gagal diproses: ' + (errNotif && errNotif.message ? errNotif.message : errNotif));
  }

  _logActivity_(auth.session.username, auth.session.role, 'submit_report',
    meta.nama_rs + ' · ' + meta.tanggal + (meta.operator_nama ? ' · Operator: ' + meta.operator_nama : ''));
  return _ok_({ written: written, timestamp: ts, message: 'Laporan berhasil disimpan ke ' + written.join(', ') });
}

function _getShiftsTaken_(p) {
  const auth = _requireAuth_(p.token, 'rs'); if (auth.error) return auth.error;
  const rsRow = _readAll_('RS').find((r) => _norm_(r.Username) === _norm_(auth.session.username));
  if (!rsRow) return _err_('forbidden', 'Akun rumah sakit ini tidak ditemukan atau sudah dihapus.');
  const tanggal = _s_(p.tanggal);
  if (!tanggal) return _err_('validation', 'Tanggal wajib diisi.');
  const docsHariIni = _readAll_('DOCS').filter((r) => _norm_(r.Nama_RS) === _norm_(rsRow.Nama_RS) && _s_(r.Tanggal) === tanggal);
  const taken = Array.from(new Set(docsHariIni.map((r) => _norm_(r.Shift)).filter(Boolean)));
  const operatorsTaken = Array.from(new Set(docsHariIni.map((r) => _norm_(r.Submitted_By_Name || r.Submitted_By)).filter(Boolean)));
  return _ok_({ taken: taken, operators_taken: operatorsTaken });
}

function _updateReport_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;

  const reportType = _s_(p.report_type);
  const sheetKeyByType = { docs: 'DOCS', wwz: 'WWZ', gow: 'GOW' };
  const fieldMapByType = { docs: EDIT_FIELD_MAP_DOCS, wwz: EDIT_FIELD_MAP_WWZ, gow: EDIT_FIELD_MAP_GOW };
  const fieldsDefByType = { docs: FIELDS_DOCS, wwz: FIELDS_WWZ, gow: FIELDS_GOW };
  const actionLabelByType = { docs: 'edit_laporan_docs', wwz: 'edit_laporan_booster', gow: 'edit_laporan_booster' };
  const sheetKey = sheetKeyByType[reportType];
  if (!sheetKey) return _err_('validation', 'report_type harus salah satu dari: docs, wwz, gow.');

  const nama_rs = _s_(p.nama_rs), tanggal = _s_(p.tanggal), shift = _s_(p.shift), timestamp = _s_(p.timestamp);
  const unit = _s_(p.unit) || '1';
  if (!nama_rs || !tanggal || !shift || !timestamp) {
    return _err_('validation', 'Nama RS, tanggal, shift, dan timestamp laporan wajib diisi untuk mengedit.');
  }

  const fieldMap = fieldMapByType[reportType];
  const fieldsDef = fieldsDefByType[reportType];
  const valuesIn = p.values || {};
  const errors = {};
  const coerced = {};
  fieldsDef.forEach((def) => {
    const key = def[0];
    if (!Object.prototype.hasOwnProperty.call(fieldMap, key)) return;
    if (!Object.prototype.hasOwnProperty.call(valuesIn, key)) return;
    const label = def[1], required = def[2], tipe = def[3], min = def[4], max = def[5], options = def[6];
    coerced[key] = tipe === 'enum'
      ? _coerceEnum_(valuesIn[key], label, options, errors, key, required)
      : tipe === 'text'
      ? _coerceText_(valuesIn[key], label, errors, key, required)
      : _coerce_(valuesIn[key], tipe, label, min, max, errors, key, required);
  });
  if (reportType === 'docs' && Object.prototype.hasOwnProperty.call(fieldMap, 'catatan_operator') &&
      Object.prototype.hasOwnProperty.call(valuesIn, 'catatan_operator')) {
    coerced.catatan_operator = _coerceText_(valuesIn.catatan_operator, 'Catatan Operator', errors, 'catatan_operator', false).slice(0, 300);
  }

  if (Object.keys(errors).length) return _err_('validation', 'Beberapa field belum benar.', { errors: errors });

  const rows = _readAll_(sheetKey);
  const matches = rows.filter((r) =>
    _norm_(r.Nama_RS) === _norm_(nama_rs) && _s_(r.Tanggal) === tanggal &&
    _norm_(r.Shift) === _norm_(shift) && _s_(r.Timestamp) === timestamp &&
    (sheetKey === 'DOCS' || _norm_(r.Unit || '1') === _norm_(unit)));
  if (!matches.length) return _err_('not_found', 'Laporan tidak ditemukan (mungkin sudah berubah/dihapus, muat ulang data lalu coba lagi).');
  const target = matches[matches.length - 1];

  const sh = _sheet_(sheetKey);
  const headers = COLS[sheetKey];
  const changes = [];
  Object.keys(coerced).forEach((key) => {
    const colName = fieldMap[key];
    const colIdx = headers.indexOf(colName);
    if (colIdx === -1) return;
    const oldVal = target[colName];
    const newVal = coerced[key];
    const oldStr = _s_(oldVal), newStr = _s_(newVal);
    if (oldStr === newStr) return;
    sh.getRange(target.__row, colIdx + 1).setValue(newVal);
    const label = (fieldsDef.find((d) => d[0] === key) || [])[1] || colName;
    changes.push(label + ': ' + (oldStr || '–') + ' → ' + (newStr || '–'));
  });

  const updatedAtIdx = headers.indexOf('Updated_At'), updatedByIdx = headers.indexOf('Updated_By');
  if (updatedAtIdx > -1) sh.getRange(target.__row, updatedAtIdx + 1).setValue(_now_());
  if (updatedByIdx > -1) sh.getRange(target.__row, updatedByIdx + 1).setValue(auth.session.username);

  const targetDesc = nama_rs + ' · ' + tanggal + ' · shift ' + shift + (sheetKey === 'DOCS' ? '' : ' · ' + sheetKey + ' unit ' + unit);
  const summary = changes.length ? changes.join(', ') : '(tidak ada nilai yang berubah)';
  _logActivity_(auth.session.username, auth.session.role, actionLabelByType[reportType], targetDesc + ' — ' + summary);

  return _ok_({ message: 'Perubahan tersimpan.', changes: changes, updated_at: _now_(), updated_by: auth.session.username });
}

const DOCS_FIELD_LABELS = {
  RTD1: 'RTD1', RTD2: 'RTD2', RTD3: 'RTD3', RTD4: 'RTD4',
  Purity: 'Purity', Pressure: 'Pressure', Box_Temperature: 'Box Temperature',
  Flow_Avg_LPM: 'Flow Avg (LPM)', SCR: 'SCR',
};
const DOCS_FIELD_TO_REPORT_COL = {
  RTD1: 'RTD1', RTD2: 'RTD2', RTD3: 'RTD3', RTD4: 'RTD4',
  Purity: 'Purity_%', Pressure: 'Pressure', Box_Temperature: 'Box_Temperature',
  Flow_Avg_LPM: 'Flow_Avg_LPM', SCR: 'SCR',
};
const BOOSTER_FIELD_COLS = ['Press_Inlet', 'Press1', 'Press2', 'Press3', 'Press4', 'Temp1', 'Temp2', 'Temp3', 'Temp4'];
const BOOSTER_FIELD_LABELS = {
  WWZ: {
    Press1: 'Inlet Pressure', Press2: 'Level 1 Exhaust Pressure', Press3: 'Level 2 Exhaust Pressure',
    Temp1: '1st Stage Discharge Temperature', Temp2: '2nd Stage Discharge Temperature',
  },
  GOW: {
    Press_Inlet: 'Inlet Pressure', Press1: '1st Stage Exhaust Pressure', Press2: '2nd Stage Exhaust Pressure',
    Press3: '3rd Stage Exhaust Pressure', Press4: '4th Stage Exhaust Pressure',
    Temp1: '1st Exhaust Temperature', Temp2: '2nd Exhaust Temperature',
    Temp3: '3rd Exhaust Temperature', Temp4: '4th Exhaust Temperature',
  },
};
function _notifNum_(v) {
  const s = _s_(v);
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function _notifDocsSpecFromRow_(r) {
  const spec = {};
  Object.keys(DOCS_FIELD_LABELS).forEach((sheetField) => {
    const min = _notifNum_(r[sheetField + '_Min']);
    const max = _notifNum_(r[sheetField + '_Max']);
    if (min !== null || max !== null) {
      spec[DOCS_FIELD_TO_REPORT_COL[sheetField]] = { min: min, max: max, label: DOCS_FIELD_LABELS[sheetField] };
    }
  });
  return spec;
}
function _notifBoosterSpecFromRow_(model, r) {
  const spec = {};
  const labels = BOOSTER_FIELD_LABELS[model] || {};
  BOOSTER_FIELD_COLS.forEach((col) => {
    const min = _notifNum_(r[col + '_Min']);
    const max = _notifNum_(r[col + '_Max']);
    if (min !== null || max !== null) spec[col] = { min: min, max: max, label: labels[col] || col };
  });
  return spec;
}
const NOTIF_SEED_DOCS_COMMON = {
  RTD1: [-100, 250], RTD2: [60, 110], RTD3: [100, 230], RTD4: [60, 110],
  Purity: [80, ''], Pressure: ['', 80], Box_Temperature: ['', 114],
};
const NOTIF_SEED_DOCS_GROUP = {
  A: { Flow_Avg_LPM: [-70, 210], SCR: ['', 36] },
  B: { Flow_Avg_LPM: [-40, 90], SCR: ['', 48] },
  C: { Flow_Avg_LPM: [-180, 510], SCR: ['', 38] },
};
const NOTIF_SEED_DOCS_RS = [
  ['RS Contoh 01', 'A', '200'], ['RS Contoh 02', 'A', '200'], ['RS Contoh 03', 'A', '200'],
  ['RS Contoh 04', 'A', '500'], ['RS Contoh 05', 'B', '80'], ['RS Contoh 06', 'C', '500'],
];
const NOTIF_SEED_BOOSTER_MODEL = [
  ['RS Contoh 01', 'GOW 12', ''], ['RS Contoh 02', 'GOW 12', 'WWZ 6'], ['RS Contoh 03', 'WWZ 6', ''],
  ['RS Contoh 04', 'GOW 8', ''], ['RS Contoh 05', '', ''], ['RS Contoh 06', 'WWZ 6', ''],
];
const NOTIF_SEED_BOOSTER_SPEC = {
  WWZ: { Press1: [20, 40], Press2: [180, 620], Press3: ['', 2100], Temp1: ['', 120], Temp2: ['', 120] },
  GOW: {
    Press_Inlet: [20, 60], Press1: [50, 180], Press2: [150, 350], Press3: [500, 1000], Press4: ['', 2100],
    Temp1: ['', 100], Temp2: ['', 100], Temp3: ['', 150], Temp4: ['', 150],
  },
};
function _notifSeedIfEmpty_() {
  const shDocs = _sheet_('Notif_DOCS');
  if (_readAll_('Notif_DOCS').length === 0) {
    const rows = NOTIF_SEED_DOCS_RS.map(([nama, grp, docsType]) => {
      const obj = { Nama_RS: nama, DOCS_Type: docsType || '', Catatan: '' };
      Object.keys(NOTIF_SEED_DOCS_COMMON).forEach((f) => {
        obj[f + '_Min'] = NOTIF_SEED_DOCS_COMMON[f][0];
        obj[f + '_Max'] = NOTIF_SEED_DOCS_COMMON[f][1];
      });
      Object.keys(NOTIF_SEED_DOCS_GROUP[grp]).forEach((f) => {
        obj[f + '_Min'] = NOTIF_SEED_DOCS_GROUP[grp][f][0];
        obj[f + '_Max'] = NOTIF_SEED_DOCS_GROUP[grp][f][1];
      });
      return _rowFor_('Notif_DOCS', obj);
    });
    shDocs.getRange(2, 1, rows.length, COLS.Notif_DOCS.length).setValues(rows);
  }
  const shModel = _sheet_('Notif_BoosterModel');
  if (_readAll_('Notif_BoosterModel').length === 0) {
    const rows = NOTIF_SEED_BOOSTER_MODEL.map(([nama, b1, b2]) =>
      _rowFor_('Notif_BoosterModel', { Nama_RS: nama, Booster1: b1, Booster2: b2, Catatan: '' }));
    shModel.getRange(2, 1, rows.length, COLS.Notif_BoosterModel.length).setValues(rows);
  }
  const shSpec = _sheet_('Notif_BoosterSpec');
  if (_readAll_('Notif_BoosterSpec').length === 0) {
    const rows = Object.keys(NOTIF_SEED_BOOSTER_SPEC).map((model) => {
      const obj = { Model: model };
      BOOSTER_FIELD_COLS.forEach((col) => {
        const pair = NOTIF_SEED_BOOSTER_SPEC[model][col];
        obj[col + '_Min'] = pair ? pair[0] : '';
        obj[col + '_Max'] = pair ? pair[1] : '';
      });
      obj.Catatan = model === 'WWZ' ? 'WWZ6/WWZ8 pakai spesifikasi sama' : 'GOW5/GOW12/GOW25 pakai spesifikasi sama';
      return _rowFor_('Notif_BoosterSpec', obj);
    });
    shSpec.getRange(2, 1, rows.length, COLS.Notif_BoosterSpec.length).setValues(rows);
  }
}
function _notifLoadConfig_() {
  _notifSeedIfEmpty_();
  const docsByKey = {};
  const docsTypeByKey = {};
  _readAll_('Notif_DOCS').forEach((r) => {
    const key = _notifRsKey_(r.Nama_RS);
    if (!key) return;
    docsByKey[key] = _notifDocsSpecFromRow_(r);
    docsTypeByKey[key] = _s_(r.DOCS_Type);
  });
  const modelByKey = {};
  const modelRawByKey = {};
  _readAll_('Notif_BoosterModel').forEach((r) => {
    const key = _notifRsKey_(r.Nama_RS);
    if (!key) return;
    const codes = [_s_(r.Booster1), _s_(r.Booster2)].filter(Boolean);
    const flags = {};
    codes.forEach((code) => {
      const up = code.toUpperCase();
      if (up.indexOf('WWZ') !== -1) flags.WWZ = true;
      if (up.indexOf('GOW') !== -1) flags.GOW = true;
    });
    modelByKey[key] = flags;
    modelRawByKey[key] = codes;
  });
  const specByModel = {};
  _readAll_('Notif_BoosterSpec').forEach((r) => {
    const model = _s_(r.Model).toUpperCase();
    if (model === 'WWZ' || model === 'GOW') specByModel[model] = _notifBoosterSpecFromRow_(model, r);
  });
  return {
    docsByKey: docsByKey, docsTypeByKey: docsTypeByKey,
    modelByKey: modelByKey, modelRawByKey: modelRawByKey, specByModel: specByModel,
  };
}
function _notifEquipmentForRs_(namaRs, cfg) {
  if (!namaRs) return null;
  const docsKey = _notifMatchRs_(namaRs, cfg.docsTypeByKey);
  const modelKey = _notifMatchRs_(namaRs, cfg.modelRawByKey);
  const docsType = docsKey ? cfg.docsTypeByKey[docsKey] : '';
  const booster = modelKey ? cfg.modelRawByKey[modelKey] : [];
  if (!docsType && (!booster || !booster.length)) return null;
  return { docs_type: docsType || '', booster: booster || [] };
}
function _notifRsKey_(nama) { return _s_(nama).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function _notifRsCore_(key) {
  return key.replace(/^RSUD/, '').replace(/^RSU/, '').replace(/^RS/, '');
}
function _notifMatchRs_(namaRsLaporan, table) {
  const key = _notifRsKey_(namaRsLaporan);
  if (table[key] !== undefined) return key;
  const core = _notifRsCore_(key);
  if (core.length < 4) return null;
  let found = null;
  Object.keys(table).forEach((k) => {
    if (found) return;
    const kCore = _notifRsCore_(k);
    if (kCore.length >= 4 && (kCore.indexOf(core) !== -1 || core.indexOf(kCore) !== -1)) found = k;
  });
  return found;
}
function _parseMultiNumeric_(str) {
  const s = _s_(str);
  if (!s) return [];
  if (/^-?\d+(\.\d+)?$/.test(s)) { const n = Number(s); return isFinite(n) ? [n] : []; }
  return s.split('-').map((p) => Number(p.trim())).filter((n) => isFinite(n));
}
function _checkThreshold_(rawValue, thresh) {
  if (!thresh) return [];
  const out = [];
  _parseMultiNumeric_(rawValue).forEach((n) => {
    if (thresh.min !== null && thresh.min !== undefined && n < thresh.min) out.push({ n: n, arah: 'min', batas: thresh.min });
    if (thresh.max !== null && thresh.max !== undefined && n > thresh.max) out.push({ n: n, arah: 'max', batas: thresh.max });
  });
  return out;
}
function _notifPushViolations_(notif, sheetLabel, row, spec) {
  const namaRs = _s_(row.Nama_RS), tanggal = _s_(row.Tanggal), shift = _s_(row.Shift), unit = _s_(row.Unit || '');
  Object.keys(spec).forEach((colName) => {
    const thresh = spec[colName];
    const viol = _checkThreshold_(row[colName], thresh);
    viol.forEach((v) => {
      const arahTeks = v.arah === 'min' ? 'di bawah batas minimum' : 'melebihi batas maksimum';
      notif.push({
        sheet: sheetLabel, nama_rs: namaRs, tanggal: tanggal, shift: shift, unit: unit,
        field: thresh.label, value: v.n, arah: v.arah, batas: v.batas,
        pesan: thresh.label + ' ' + v.n + ' ' + arahTeks + ' (' + v.batas + ')',
      });
    });
  });
}
function _computeNotifikasi_(docs, wwz, gow) {
  const cfg = _notifLoadConfig_();
  const notif = [];
  docs.forEach((r) => {
    const rsKey = _notifMatchRs_(r.Nama_RS, cfg.docsByKey);
    const spec = rsKey ? cfg.docsByKey[rsKey] : null;
    if (spec) _notifPushViolations_(notif, 'DOCS', r, spec);
  });
  wwz.forEach((r) => {
    const rsKey = _notifMatchRs_(r.Nama_RS, cfg.modelByKey);
    const model = rsKey ? cfg.modelByKey[rsKey] : null;
    if (!model || !model.WWZ || !cfg.specByModel.WWZ) return;
    _notifPushViolations_(notif, 'WWZ', r, cfg.specByModel.WWZ);
  });
  gow.forEach((r) => {
    const rsKey = _notifMatchRs_(r.Nama_RS, cfg.modelByKey);
    const model = rsKey ? cfg.modelByKey[rsKey] : null;
    if (!model || !model.GOW || !cfg.specByModel.GOW) return;
    _notifPushViolations_(notif, 'GOW', r, cfg.specByModel.GOW);
  });
  notif.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  return notif;
}

function _getReports_(p) {
  const auth = _requireAuth_(p.token); if (auth.error) return auth.error;
  const canSeeAll = auth.session.role === 'admin' || auth.session.role === 'teknisi';
  const bulan = _s_(p.bulan);
  const rsFilter = _s_(p.rs);
  const teknisiFilter = canSeeAll ? _s_(p.teknisi) : '';
  const selfUsername = canSeeAll ? '' : auth.session.username;

  function filterRows(rows) {
    return rows.filter((r) => {
      if (bulan && _s_(r.Tanggal).slice(0, 7) !== bulan) return false;
      if (rsFilter && _norm_(r.Nama_RS) !== _norm_(rsFilter)) return false;
      if (teknisiFilter && _norm_(r.Submitted_By_Name) !== _norm_(teknisiFilter)) return false;
      if (selfUsername && _norm_(r.Submitted_By) !== _norm_(selfUsername)) return false;
      return true;
    }).map((r) => { const o = Object.assign({}, r); delete o.__row; return o; });
  }

  const allDocs = _readAll_('DOCS');
  const docs = filterRows(allDocs);
  const wwz = filterRows(_readAll_('WWZ'));
  const gow = filterRows(_readAll_('GOW'));

  const scope = canSeeAll ? allDocs : allDocs.filter((r) => _norm_(r.Submitted_By) === _norm_(auth.session.username));
  const daftar_rs = Array.from(new Set(scope.map((r) => _s_(r.Nama_RS)).filter(Boolean))).sort();
  const bulan_tersedia = Array.from(new Set(scope.map((r) => _s_(r.Tanggal).slice(0, 7)).filter(Boolean))).sort().reverse();
  const daftar_teknisi = canSeeAll
    ? Array.from(new Set(allDocs.map((r) => _s_(r.Submitted_By_Name)).filter(Boolean)))
      .map((n) => ({ username: n, name: n }))
    : [];

  const notifikasi = canSeeAll ? _computeNotifikasi_(docs, wwz, gow) : undefined;

  return _ok_({ docs: docs, wwz: wwz, gow: gow, daftar_rs: daftar_rs, bulan_tersedia: bulan_tersedia, daftar_teknisi: daftar_teknisi, storage_mode: 'sheets', notifikasi: notifikasi });
}

function _getRsEquipmentInfo_(p) {
  const auth = _requireAuth_(p.token); if (auth.error) return auth.error;
  const namaRs = auth.session.role === 'rs' ? auth.session.name : _s_(p.nama_rs);
  if (!namaRs) return _ok_({ equipment: null });
  const cfg = _notifLoadConfig_();
  return _ok_({ equipment: _notifEquipmentForRs_(namaRs, cfg) });
}

const NOTIF_EMAIL_STREAK = 2;
const NOTIF_EMAIL_SENDER_NAME = 'GPI Monitoring Teknisi';
const NOTIF_EMAIL_FOOTER_NOREPLY = 'Email ini dikirim otomatis oleh sistem dan tidak menerima balasan. ' +
  'Untuk koordinasi tindak lanjut, hubungi admin/teknisi koordinator secara langsung.';
const NOTIF_EMAIL_FOOTER_KONTAK = 'Supaya notifikasi ini selalu masuk Kotak Masuk, simpan alamat pengirim email ini ke Kontak Anda.';
const NOTIF_EMAIL_INCLUDE_LINK = false;
const NOTIF_EMAIL_DASHBOARD_URL = 'https://technicianreportgpi.netlify.app';
const NOTIF_SHIFT_ORDER = { pagi: 1, sore: 2, malam: 3 };
const NOTIF_SHIFT_LABEL = { pagi: 'Pagi', sore: 'Sore', malam: 'Malam' };

function _notifMailSend_(opts) {
  let email = '';
  try { email = _s_(Session.getEffectiveUser().getEmail()).toLowerCase(); } catch (e) { email = ''; }
  const isConsumer = !email || /@(gmail|googlemail)\.com$/.test(email);
  const base = Object.assign({ name: NOTIF_EMAIL_SENDER_NAME }, opts);
  if (!isConsumer) {
    try { MailApp.sendEmail(Object.assign({}, base, { noReply: true })); return; } catch (e) { }
  }
  MailApp.sendEmail(base);
}
function _notifHtmlEsc_(v) {
  return _s_(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _notifShiftLabel_(shift) { return NOTIF_SHIFT_LABEL[_norm_(shift)] || _s_(shift) || '-'; }
function _notifSlotKey_(row) {
  return _s_(row.Tanggal) + '#' + (NOTIF_SHIFT_ORDER[_norm_(row.Shift)] || 0);
}
function _notifSpecFor_(mesin, namaRs, cfg) {
  if (mesin === 'DOCS') {
    const k = _notifMatchRs_(namaRs, cfg.docsByKey);
    return k ? cfg.docsByKey[k] : null;
  }
  const k = _notifMatchRs_(namaRs, cfg.modelByKey);
  const model = k ? cfg.modelByKey[k] : null;
  if (!model || !model[mesin] || !cfg.specByModel[mesin]) return null;
  return cfg.specByModel[mesin];
}
function _notifViolationMap_(row, spec) {
  const out = {};
  if (!row || !spec) return out;
  Object.keys(spec).forEach((col) => {
    _checkThreshold_(row[col], spec[col]).forEach((v) => {
      const key = col + '|' + v.arah;
      if (!out[key]) out[key] = { col: col, label: spec[col].label, arah: v.arah, batas: v.batas, nilai: _s_(row[col]) };
    });
  });
  return out;
}
function _notifHistorySlots_(sheetKey, namaRs, unit) {
  const rsKey = _notifRsKey_(namaRs);
  const bySlot = {};
  _readAll_(sheetKey).forEach((r) => {
    if (_notifRsKey_(r.Nama_RS) !== rsKey) return;
    if (unit !== null && (_s_(r.Unit) || '1') !== unit) return;
    const slot = _notifSlotKey_(r);
    if (!bySlot[slot] || r.__row > bySlot[slot].__row) bySlot[slot] = r;
  });
  return Object.keys(bySlot).sort().map((slot) => ({ slot: slot, row: bySlot[slot] }));
}
function _notifEmailEnsureSheets_() {
  const sh = _sheet_('Notif_EmailPenerima');
  if (_readAll_('Notif_EmailPenerima').length === 0) {
    sh.appendRow(_rowFor_('Notif_EmailPenerima', {
      Nama: 'Contoh Teknisi', Email: 'contoh@email.com', Aktif: 'Tidak', Cakupan_RS: '',
      Catatan: 'Contoh: ganti dgn nama & email asli, lalu ubah Aktif jadi Ya. Cakupan_RS kosong atau "semua" = semua RS.',
    }));
  }
  _sheet_('Notif_EmailLog');
}
function _notifEmailRecipients_(namaRs) {
  _notifEmailEnsureSheets_();
  const seen = {};
  const out = [];
  _readAll_('Notif_EmailPenerima').forEach((r) => {
    const email = _s_(r.Email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (['false', 'tidak', 'no', 'n', '0', 'nonaktif', 'non-aktif'].indexOf(_norm_(r.Aktif)) !== -1) return;
    const scopeRaw = _s_(r.Cakupan_RS);
    const scope = ['semua', 'semua rs', 'all', '*', '-'].indexOf(scopeRaw.toLowerCase()) !== -1 ? '' : scopeRaw;
    if (namaRs !== null && scope) {
      const table = {};
      scope.split(/[,;\n]/).map(_s_).filter(Boolean).forEach((n) => { table[_notifRsKey_(n)] = true; });
      if (_notifMatchRs_(namaRs, table) === null) return;
    }
    const k = email.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push({ email: email, nama: _s_(r.Nama) });
  });
  return out;
}
function _notifEmailList_(penerima) { return penerima.map((p) => p.email).join(', '); }
function _notifSendEach_(penerima, buildFn) {
  const sisa = MailApp.getRemainingDailyQuota();
  if (sisa < penerima.length) {
    return 'GAGAL: kuota email harian habis (sisa ' + sisa + ', butuh ' + penerima.length + ')';
  }
  const gagal = [];
  penerima.forEach((p) => {
    try {
      _notifMailSend_(Object.assign({ to: p.email }, buildFn(p)));
    } catch (e) {
      gagal.push(p.email + ' (' + (e && e.message ? e.message : e) + ')');
    }
  });
  if (!gagal.length) return 'TERKIRIM';
  const ok = penerima.length - gagal.length;
  return (ok > 0 ? 'TERKIRIM (' + ok + '/' + penerima.length + '), ' : '') + 'GAGAL: ' + gagal.join('; ');
}
function _notifSapaan_(p) { return p.nama ? 'Halo ' + p.nama + ',' : 'Halo Tim Teknisi,'; }
function _notifArahTeks_(arah) { return arah === 'min' ? 'di bawah batas minimum' : 'di atas batas maksimum'; }
function _notifBatasTeks_(f) { return (f.arah === 'min' ? 'Min ' : 'Maks ') + f.batas; }
function _notifSlotTeks_(row) { return _s_(row.Tanggal) + ' · Shift ' + _notifShiftLabel_(row.Shift); }

function _notifEmailOnSubmit_(entries, operatorNama) {
  if (!entries || !entries.length) return;
  const cfg = _notifLoadConfig_();
  const namaRs = _s_(entries[0].row.Nama_RS);
  const findings = [];

  entries.forEach((e) => {
    const spec = _notifSpecFor_(e.mesin, e.row.Nama_RS, cfg);
    if (!spec) return;
    const nowViol = _notifViolationMap_(e.row, spec);
    const keys = Object.keys(nowViol);
    if (!keys.length) return;
    const curSlot = _notifSlotKey_(e.row);
    const hist = _notifHistorySlots_(e.sheetKey, e.row.Nama_RS, e.unit).filter((h) => h.slot < curSlot);
    const mesinLabel = e.mesin + (e.unit ? ' Unit ' + e.unit : '');
    keys.forEach((k) => {
      let streak = 1;
      const prevRows = [];
      for (let i = hist.length - 1; i >= 0 && streak <= NOTIF_EMAIL_STREAK; i--) {
        if (!_notifViolationMap_(hist[i].row, spec)[k]) break;
        prevRows.unshift(hist[i].row);
        streak++;
      }
      if (streak !== NOTIF_EMAIL_STREAK) return;
      const v = nowViol[k];
      findings.push({
        mesin: mesinLabel, label: v.label, arah: v.arah, batas: v.batas,
        parameter: v.label + ' (' + _notifArahTeks_(v.arah) + ')',
        sekarang: { slot: _notifSlotTeks_(e.row), nilai: v.nilai, tanggal: _s_(e.row.Tanggal), shift: _s_(e.row.Shift) },
        sebelumnya: prevRows.map((r) => ({ slot: _notifSlotTeks_(r), nilai: _s_(r[v.col]) })),
      });
    });
  });
  if (!findings.length) return;

  _notifEmailEnsureSheets_();
  const sudahTerkirim = {};
  _readAll_('Notif_EmailLog').forEach((r) => {
    if (!/^TERKIRIM/i.test(_s_(r.Status))) return;
    sudahTerkirim[[_notifRsKey_(r.Nama_RS), _s_(r.Tanggal), _norm_(r.Shift), _s_(r.Mesin), _s_(r.Parameter)].join('|')] = true;
  });
  const baru = findings.filter((f) => !sudahTerkirim[[_notifRsKey_(namaRs), f.sekarang.tanggal, _norm_(f.sekarang.shift), f.mesin, f.parameter].join('|')]);
  if (!baru.length) return;

  const penerima = _notifEmailRecipients_(namaRs);
  let status;
  if (!penerima.length) {
    status = 'TIDAK DIKIRIM: belum ada penerima aktif di sheet Notif_Email_Penerima';
  } else {
    status = _notifEmailSend_(namaRs, operatorNama, baru, penerima);
  }

  const log = _sheet_('Notif_EmailLog');
  const ts = _now_();
  const rows = baru.map((f) => _rowFor_('Notif_EmailLog', {
    Timestamp: ts, Nama_RS: namaRs, Tanggal: f.sekarang.tanggal, Shift: _notifShiftLabel_(f.sekarang.shift),
    Mesin: f.mesin, Parameter: f.parameter,
    Nilai_Sebelumnya: f.sebelumnya.map((p) => p.nilai).join(' | '),
    Nilai_Sekarang: f.sekarang.nilai, Batas: _notifBatasTeks_(f),
    Penerima: _notifEmailList_(penerima), Status: status,
  }));
  log.getRange(log.getLastRow() + 1, 1, rows.length, COLS.Notif_EmailLog.length).setValues(rows);
}

function _notifEmailSend_(namaRs, operatorNama, findings, penerima) {
  const n = NOTIF_EMAIL_STREAK;
  const subject = findings.length === 1
    ? '[Notifikasi GPI] ' + namaRs + ': ' + findings[0].label + ' ' + _notifArahTeks_(findings[0].arah) + ' ' + n + 'x berturut-turut'
    : '[Notifikasi GPI] ' + namaRs + ': ' + findings.length + ' parameter di luar batas ' + n + 'x berturut-turut';

  const th = 'style="text-align:left;padding:8px 10px;border:1px solid #d1d5db;background:#f3f4f6;font-size:13px"';
  const td = 'style="padding:8px 10px;border:1px solid #d1d5db;font-size:13px;vertical-align:top"';
  const rowsHtml = findings.map((f) => '<tr>' +
    '<td ' + td + '>' + _notifHtmlEsc_(f.mesin) + '</td>' +
    '<td ' + td + '><b>' + _notifHtmlEsc_(f.label) + '</b><br><span style="color:#b91c1c">' + _notifHtmlEsc_(_notifArahTeks_(f.arah)) + '</span></td>' +
    '<td ' + td + '>' + _notifHtmlEsc_(_notifBatasTeks_(f)) + '</td>' +
    '<td ' + td + '>' + f.sebelumnya.map((p) => _notifHtmlEsc_(p.slot) + ': <b>' + _notifHtmlEsc_(p.nilai) + '</b>').join('<br>') + '</td>' +
    '<td ' + td + '>' + _notifHtmlEsc_(f.sekarang.slot) + ': <b>' + _notifHtmlEsc_(f.sekarang.nilai) + '</b></td>' +
    '</tr>').join('');
  const dashHtml = NOTIF_EMAIL_INCLUDE_LINK
    ? '<p><a href="' + NOTIF_EMAIL_DASHBOARD_URL + '" style="color:#1d4ed8">Buka Dashboard Teknisi</a></p>'
    : '<p>Detail lengkap bisa dicek di Dashboard Teknisi, menu Monitoring.</p>';
  const dashText = NOTIF_EMAIL_INCLUDE_LINK
    ? '\n\nDashboard: ' + NOTIF_EMAIL_DASHBOARD_URL
    : '\n\nDetail lengkap bisa dicek di Dashboard Teknisi, menu Monitoring.';
  const isiHtml =
    '<p>Laporan harian <b>' + _notifHtmlEsc_(namaRs) + '</b> menunjukkan parameter berikut berada di luar batas pada ' +
    '<b>' + n + ' laporan berturut-turut</b>. Mohon segera dicek dan ditindaklanjuti.</p>' +
    '<table style="border-collapse:collapse;margin:12px 0">' +
    '<tr><th ' + th + '>Mesin</th><th ' + th + '>Parameter</th><th ' + th + '>Batas</th><th ' + th + '>Laporan sebelumnya</th><th ' + th + '>Laporan terbaru</th></tr>' +
    rowsHtml + '</table>' +
    (operatorNama ? '<p>Operator pelapor terbaru: <b>' + _notifHtmlEsc_(operatorNama) + '</b></p>' : '') +
    dashHtml +
    '<p style="color:#6b7280;font-size:12px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:10px">' +
    '<b>Jangan membalas email ini.</b> ' + _notifHtmlEsc_(NOTIF_EMAIL_FOOTER_NOREPLY) + '<br>' +
    _notifHtmlEsc_(NOTIF_EMAIL_FOOTER_KONTAK) + '<br>' +
    'Dashboard Pelaporan Teknisi · PT Generator Pasifik Indonesia</p></div>';
  const isiText =
    'Laporan harian ' + namaRs + ' menunjukkan parameter berikut di luar batas pada ' + n + ' laporan berturut-turut:\n\n' +
    findings.map((f) => '- [' + f.mesin + '] ' + f.label + ' ' + _notifArahTeks_(f.arah) + ' (' + _notifBatasTeks_(f) + ')\n' +
      f.sebelumnya.map((p) => '    ' + p.slot + ': ' + p.nilai).join('\n') + '\n' +
      '    ' + f.sekarang.slot + ': ' + f.sekarang.nilai).join('\n') +
    (operatorNama ? '\n\nOperator pelapor terbaru: ' + operatorNama : '') +
    dashText +
    '\n\n---\nJangan membalas email ini. ' + NOTIF_EMAIL_FOOTER_NOREPLY + '\n' + NOTIF_EMAIL_FOOTER_KONTAK;
  return _notifSendEach_(penerima, (p) => ({
    subject: subject,
    body: _notifSapaan_(p) + '\n\n' + isiText,
    htmlBody: '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.5">' +
      '<p>' + _notifHtmlEsc_(_notifSapaan_(p)) + '</p>' + isiHtml,
  }));
}

function tesEmailNotifikasi() {
  const penerima = _notifEmailRecipients_(null);
  if (!penerima.length) {
    throw new Error('Belum ada penerima aktif di sheet Notif_Email_Penerima. Isi Nama & Email, ubah Aktif jadi "Ya", lalu jalankan lagi.');
  }
  const sisa = MailApp.getRemainingDailyQuota();
  const status = _notifSendEach_(penerima, (p) => ({
    subject: '[Notifikasi GPI] Tes email notifikasi Dashboard Teknisi',
    body: _notifSapaan_(p) + '\n\n' +
      'Ini email TES dari Dashboard Pelaporan Teknisi PT GPI. Kalau email ini masuk, berarti email notifikasi ' +
      '(parameter di luar batas ' + NOTIF_EMAIL_STREAK + 'x berturut-turut) sudah siap terkirim ke alamat ini.\n\n' +
      'Kalau email ini masuk folder Spam, mohon klik "Bukan spam" lalu simpan alamat pengirim ini ke Kontak, ' +
      'supaya notifikasi berikutnya selalu masuk Kotak Masuk.' +
      '\n\n---\nJangan membalas email ini. ' + NOTIF_EMAIL_FOOTER_NOREPLY,
  }));
  const msg = 'Hasil kirim email tes ke ' + penerima.length + ' penerima (' + _notifEmailList_(penerima) + '): ' + status +
    '. Sisa kuota email hari ini (sebelum kirim): ' + sisa + '.';
  Logger.log(msg);
  return msg;
}

function _listAccounts_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const rows = _readAll_('Akun').map((r) => ({
    username: r.Username, name: r.Name, role: r.Role,
    active: !(_s_(r.Active) === 'false' || r.Active === false),
    approval_status: _s_(r.Approval_Status) || 'approved',
    created_at: r.Created_At, created_by: r.Created_By, last_login: r.Last_Login,
  }));
  return _ok_({ accounts: rows });
}

function _createAccount_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const username = _s_(p.username), password = _s_(p.password), name = _s_(p.name) || username;
  const roleIn = _s_(p.role);
  let role = ['admin', 'teknisi', 'logistik'].indexOf(roleIn) !== -1 ? roleIn : 'teknisi';
  if (!username || !password) return _err_('validation', 'Username dan password wajib diisi.');
  if (password.length < 6) return _err_('validation', 'Password minimal 6 karakter.');
  const rows = _readAll_('Akun');
  if (rows.some((r) => _norm_(r.Username) === _norm_(username))) return _err_('duplicate', 'Username sudah dipakai.');

  _sheet_('Akun').appendRow(_rowFor_('Akun', {
    Username: username, Password: password, Role: role, Name: name, Active: true,
    Created_At: _now_(), Created_By: auth.session.username, Last_Login: '', Approval_Status: 'approved',
  }));
  _logActivity_(auth.session.username, auth.session.role, 'create_account', username + ' (' + role + ')');
  return _ok_({ message: 'Akun ' + username + ' berhasil dibuat.' });
}

function _listRumahSakit_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const bulanIni = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM');
  const boosterBulanIni = _readAll_('WWZ').filter((r) => _s_(r.Tanggal).slice(0, 7) === bulanIni)
    .concat(_readAll_('GOW').filter((r) => _s_(r.Tanggal).slice(0, 7) === bulanIni));
  const statByRs = {};
  boosterBulanIni.forEach((r) => {
    const key = _norm_(r.Nama_RS);
    if (!key) return;
    if (!statByRs[key]) statByRs[key] = { tabung: 0 };
    const tb = Number(r.Jumlah_Produksi_Tabung_O2);
    if (isFinite(tb)) statByRs[key].tabung += tb;
  });
  const rows = _readAll_('RS').map((r) => {
    const stat = statByRs[_norm_(r.Nama_RS)] || { tabung: 0 };
    return {
      nama_rs: _s_(r.Nama_RS), daerah_rs: _s_(r.Daerah_RS),
      operator1: _s_(r.Operator1), operator2: _s_(r.Operator2), operator3: _s_(r.Operator3),
      username: _s_(r.Username), has_password: !!_s_(r.Password),
      active: !(_s_(r.Active) === 'false' || r.Active === false),
      updated_at: r.Updated_At, updated_by: r.Updated_By,
      tabung_bulan_ini: stat.tabung,
    };
  }).sort((a, b) => a.nama_rs.localeCompare(b.nama_rs));
  return _ok_({ rs: rows });
}

function _setRumahSakitAccount_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const namaRs = _s_(p.nama_rs);
  if (!namaRs) return _err_('validation', 'Nama Rumah Sakit wajib diisi.');
  const username = _s_(p.username);
  const password = _s_(p.password);
  const op1 = _s_(p.operator1), op2 = _s_(p.operator2), op3 = _s_(p.operator3);
  if (!username) return _err_('validation', 'Username wajib diisi.');
  if (password && password.length < 6) return _err_('validation', 'Password minimal 6 karakter.');
  if (!op1 || !op2) return _err_('validation', 'Minimal nama 2 operator (Operator 1 & 2) wajib diisi. Operator 3 boleh dikosongkan kalau RS ini cuma punya 2 operator.');

  const sh = _sheet_('RS');
  const rows = _readAll_('RS');
  const dupe = rows.find((r) => _norm_(r.Username) === _norm_(username) && _norm_(r.Nama_RS) !== _norm_(namaRs));
  if (dupe) return _err_('duplicate', 'Username sudah dipakai rumah sakit lain.');

  let row = rows.find((r) => _norm_(r.Nama_RS) === _norm_(namaRs));
  const daerahRs = _s_(p.daerah_rs) || (row ? _s_(row.Daerah_RS) : '');
  const finalPassword = password || (row ? _s_(row.Password) : '');
  if (!finalPassword) return _err_('validation', 'Password wajib diisi untuk akun baru.');

  if (row) {
    sh.getRange(row.__row, COLS.RS.indexOf('Daerah_RS') + 1).setValue(daerahRs);
    sh.getRange(row.__row, COLS.RS.indexOf('Operator1') + 1, 1, 3).setValues([[op1, op2, op3]]);
    sh.getRange(row.__row, COLS.RS.indexOf('Username') + 1).setValue(username);
    sh.getRange(row.__row, COLS.RS.indexOf('Password') + 1).setValue(finalPassword);
    sh.getRange(row.__row, COLS.RS.indexOf('Active') + 1).setValue(true);
    sh.getRange(row.__row, COLS.RS.indexOf('Updated_At') + 1).setValue(_now_());
    sh.getRange(row.__row, COLS.RS.indexOf('Updated_By') + 1).setValue(auth.session.username);
  } else {
    sh.appendRow(_rowFor_('RS', {
      Nama_RS: namaRs, Daerah_RS: daerahRs, Operator1: op1, Operator2: op2, Operator3: op3,
      Username: username, Password: finalPassword, Active: true,
      Updated_At: _now_(), Updated_By: auth.session.username,
    }));
  }
  _logActivity_(auth.session.username, auth.session.role, 'set_rs_account', namaRs + ' · username: ' + username);
  return _ok_({ message: 'Akun rumah sakit ' + namaRs + ' berhasil disimpan.' });
}

function _setRumahSakitActive_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const namaRs = _s_(p.nama_rs);
  if (!namaRs) return _err_('validation', 'Nama Rumah Sakit wajib diisi.');
  const rows = _readAll_('RS');
  const row = rows.find((r) => _norm_(r.Nama_RS) === _norm_(namaRs));
  if (!row) return _err_('not_found', 'Rumah Sakit tidak ditemukan.');
  const sh = _sheet_('RS');
  sh.getRange(row.__row, COLS.RS.indexOf('Active') + 1).setValue(!!p.active);
  sh.getRange(row.__row, COLS.RS.indexOf('Updated_At') + 1).setValue(_now_());
  sh.getRange(row.__row, COLS.RS.indexOf('Updated_By') + 1).setValue(auth.session.username);
  _logActivity_(auth.session.username, auth.session.role, p.active ? 'activate_rs' : 'deactivate_rs', namaRs);
  return _ok_({ message: p.active ? ('Rumah Sakit ' + namaRs + ' diaktifkan kembali.') : ('Rumah Sakit ' + namaRs + ' dinonaktifkan.') });
}

function _deleteRumahSakit_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const namaRs = _s_(p.nama_rs);
  if (!namaRs) return _err_('validation', 'Nama Rumah Sakit wajib diisi.');
  const rows = _readAll_('RS');
  const row = rows.find((r) => _norm_(r.Nama_RS) === _norm_(namaRs));
  if (!row) return _err_('not_found', 'Rumah Sakit tidak ditemukan.');
  _sheet_('RS').deleteRow(row.__row);
  _logActivity_(auth.session.username, auth.session.role, 'delete_rs', namaRs);
  return _ok_({ message: 'Rumah Sakit ' + namaRs + ' berhasil dihapus dari daftar. Data laporan yang sudah ada tidak terhapus.' });
}

function _setAccountApproval_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const username = _s_(p.username);
  const decision = _s_(p.decision);
  if (decision !== 'approved' && decision !== 'rejected') return _err_('validation', 'Keputusan harus "approved" atau "rejected".');
  const rows = _readAll_('Akun');
  const row = rows.find((r) => _norm_(r.Username) === _norm_(username));
  if (!row) return _err_('not_found', 'Akun tidak ditemukan.');
  const sh = _sheet_('Akun');
  sh.getRange(row.__row, COLS.Akun.indexOf('Approval_Status') + 1).setValue(decision);
  sh.getRange(row.__row, COLS.Akun.indexOf('Active') + 1).setValue(decision === 'approved');
  _logActivity_(auth.session.username, auth.session.role, decision === 'approved' ? 'approve_account' : 'reject_account', username);
  return _ok_({
    message: decision === 'approved'
      ? ('Akun ' + username + ' disetujui dan sudah bisa login.')
      : ('Registrasi ' + username + ' ditolak.'),
  });
}

function _setAccountActive_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const username = _s_(p.username);
  if (_norm_(username) === _norm_(auth.session.username) && !p.active) {
    return _err_('validation', 'Anda tidak bisa menonaktifkan akun Anda sendiri.');
  }
  const rows = _readAll_('Akun');
  const row = rows.find((r) => _norm_(r.Username) === _norm_(username));
  if (!row) return _err_('not_found', 'Akun tidak ditemukan.');
  _sheet_('Akun').getRange(row.__row, COLS.Akun.indexOf('Active') + 1).setValue(!!p.active);
  _logActivity_(auth.session.username, auth.session.role, p.active ? 'activate_account' : 'deactivate_account', username);
  return _ok_({ message: 'Status akun ' + username + ' diperbarui.' });
}

function _resetPassword_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const username = _s_(p.username), newPassword = _s_(p.newPassword);
  if (!newPassword || newPassword.length < 6) return _err_('validation', 'Password baru minimal 6 karakter.');
  const rows = _readAll_('Akun');
  const row = rows.find((r) => _norm_(r.Username) === _norm_(username));
  if (!row) return _err_('not_found', 'Akun tidak ditemukan.');
  _sheet_('Akun').getRange(row.__row, COLS.Akun.indexOf('Password') + 1).setValue(newPassword);
  _logActivity_(auth.session.username, auth.session.role, 'reset_password', username);
  return _ok_({ message: 'Password ' + username + ' berhasil direset.' });
}

function _getActivityLog_(p) {
  const auth = _requireAuth_(p.token, 'admin'); if (auth.error) return auth.error;
  const limit = Number(p.limit) || 200;
  const rows = _readAll_('Log').map((r) => { const o = Object.assign({}, r); delete o.__row; return o; });
  rows.reverse();
  return _ok_({ log: rows.slice(0, limit) });
}

function _snapshotBulanan_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const bulan = _s_(p.bulan);
  if (!/^\d{4}-\d{2}$/.test(bulan)) return _err_('validation', 'Format bulan harus YYYY-MM.');

  const docs = _readAll_('DOCS').filter((r) => _s_(r.Tanggal).slice(0, 7) === bulan);
  const wwz = _readAll_('WWZ').filter((r) => _s_(r.Tanggal).slice(0, 7) === bulan);
  const gow = _readAll_('GOW').filter((r) => _s_(r.Tanggal).slice(0, 7) === bulan);

  const byRs = {};
  docs.forEach((r) => {
    const rs = _s_(r.Nama_RS); if (!rs) return;
    if (!byRs[rs]) byRs[rs] = { daerah: _s_(r.Daerah_RS), rows: [] };
    byRs[rs].rows.push(r);
  });

  const [y, m] = bulan.split('-').map(Number);
  const hariBulan = new Date(y, m, 0).getDate();
  const today = new Date();
  const isCurrentMonth = (today.getFullYear() === y && today.getMonth() + 1 === m);
  const hariWajib = isCurrentMonth ? today.getDate() : (bulan < Utilities.formatDate(today, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM') ? hariBulan : 0);

  const snapshotAt = _now_();
  const rowsOut = Object.keys(byRs).sort().map((rs) => {
    const info = byRs[rs];
    const tanggalSet = new Set(info.rows.map((r) => _s_(r.Tanggal)));
    const purities = info.rows.map((r) => Number(r['Purity_%'])).filter((v) => isFinite(v));
    const avgP = purities.length ? purities.reduce((a, b) => a + b, 0) / purities.length : '';
    const minP = purities.length ? Math.min.apply(null, purities) : '';
    const maxP = purities.length ? Math.max.apply(null, purities) : '';
    const complianceRate = hariWajib ? Math.round((tanggalSet.size / hariWajib) * 1000) / 10 : '';
    const wwzRs = wwz.filter((r) => _norm_(r.Nama_RS) === _norm_(rs));
    const gowRs = gow.filter((r) => _norm_(r.Nama_RS) === _norm_(rs));
    const wwzCount = wwzRs.length;
    const gowCount = gowRs.length;
    const tabungVals = wwzRs.concat(gowRs).map((r) => Number(r.Jumlah_Produksi_Tabung_O2)).filter((v) => isFinite(v));
    const totalTabung = tabungVals.length ? tabungVals.reduce((a, b) => a + b, 0) : 0;
    return {
      Bulan: bulan, Nama_RS: rs, Daerah_RS: info.daerah, Total_Laporan: info.rows.length,
      Hari_Wajib_Lapor: hariWajib, 'Compliance_Rate_%': complianceRate,
      Avg_Purity: avgP === '' ? '' : Math.round(avgP * 10) / 10, Min_Purity: minP, Max_Purity: maxP,
      Laporan_WWZ: wwzCount, Laporan_GOW: gowCount, Snapshot_At: snapshotAt, Snapshot_By: auth.session.username,
      Total_Tabung_O2: totalTabung,
    };
  });

  const sh = _sheet_('Bulanan');
  const existing = _readAll_('Bulanan');
  const toDelete = existing.filter((r) => _s_(r.Bulan) === bulan).map((r) => r.__row).sort((a, b) => b - a);
  toDelete.forEach((rowIdx) => sh.deleteRow(rowIdx));
  rowsOut.forEach((obj) => sh.appendRow(_rowFor_('Bulanan', {}, obj)));

  _logActivity_(auth.session.username, auth.session.role, 'snapshot_bulanan', bulan + ' (' + rowsOut.length + ' RS)');
  return _ok_({ count: rowsOut.length, bulan: bulan, message: 'Snapshot ' + bulan + ' tersimpan untuk ' + rowsOut.length + ' rumah sakit.' });
}

function _getMonthlySnapshots_(p) {
  const auth = _requireAuth_(p.token, ['admin', 'teknisi']); if (auth.error) return auth.error;
  const bulan = _s_(p.bulan);
  let rows = _readAll_('Bulanan').map((r) => { const o = Object.assign({}, r); delete o.__row; return o; });
  if (bulan) rows = rows.filter((r) => _s_(r.Bulan) === bulan);
  const bulanTersedia = Array.from(new Set(_readAll_('Bulanan').map((r) => _s_(r.Bulan)))).sort().reverse();
  return _ok_({ rows: rows, bulan_tersedia: bulanTersedia });
}
