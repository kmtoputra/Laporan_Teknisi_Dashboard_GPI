#!/usr/bin/env python3
from __future__ import annotations

import argparse
import calendar
import json
import os
import re
import sys
import threading
import uuid
import webbrowser
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "mock_data.json"
SESSION_TTL_HOURS = 18
ACTIVITY_LOG_MAX_ROWS = 5000

COLS = {
    "Akun": ["Username", "Password", "Role", "Name", "Active", "Created_At", "Created_By", "Last_Login", "Approval_Status"],
    "Laporan_DOCS": ["Timestamp", "Nama_RS", "Daerah_RS", "Tanggal", "Bulan",
                     "Purity_%", "Running_Hours", "Pressure", "Box_Temperature",
                     "XT1", "XT2", "XT3", "XT4", "RTD1", "RTD2", "RTD3", "RTD4", "VSA_SCR",
                     "Submitted_By", "Submitted_By_Name",
                     "Shift", "Jam_Lapor", "Pertambahan_Running_Hours",
                     "VSA", "SCR", "Purity_AE1", "Remrun", "Remhold", "Remote_Mode",
                     "VSA_VFD", "Scroll_VFD", "Heat_Exchanger", "Flow_Avg_LPM", "Flow_Total_M3",
                     "Jumlah_Produksi_Tabung_O2", "Catatan", "Updated_At", "Updated_By",
                     "Catatan_Operator"],
    "Laporan_WWZ": ["Timestamp", "Nama_RS", "Tanggal", "Bulan", "Running_Hours",
                    "Temp1", "Temp2", "Temp3", "Press1", "Press2", "Press3", "Press4",
                    "Jumlah_Pengisian", "Submitted_By", "Submitted_By_Name",
                    "Shift", "Jam_Lapor", "Pertambahan_Running_Hours", "Riset_RH", "Unit",
                    "Updated_At", "Updated_By",
                    "Jumlah_Produksi_Tabung_O2", "Catatan"],
    "Laporan_GOW": ["Timestamp", "Nama_RS", "Tanggal", "Bulan", "Running_Hours",
                    "Temp1", "Temp2", "Temp3", "Temp4", "Press1", "Press2", "Press3", "Press4",
                    "Jumlah_Pengisian", "Submitted_By", "Submitted_By_Name",
                    "Shift", "Jam_Lapor", "Pertambahan_Running_Hours", "Press_Inlet", "Unit",
                    "Updated_At", "Updated_By",
                    "Jumlah_Produksi_Tabung_O2", "Catatan",
                    "Riset_RH"],
    "Laporan_Bulanan": ["Bulan", "Nama_RS", "Daerah_RS", "Total_Laporan", "Hari_Wajib_Lapor",
                        "Compliance_Rate_%", "Avg_Purity", "Min_Purity", "Max_Purity",
                        "Laporan_WWZ", "Laporan_GOW", "Snapshot_At", "Snapshot_By",
                        "Avg_Running_Hours", "Total_Pertambahan_Running_Hours", "Total_Tabung_O2"],
    "Sessions": ["Token", "Username", "Role", "Name", "Created_At", "Expires_At"],
    "Log_Aktivitas": ["Timestamp", "Username", "Role", "Action", "Detail"],
    "Rumah_Sakit": ["Nama_RS", "Daerah_RS", "Operator1", "Operator2", "Operator3",
                    "Username", "Password", "Active", "Updated_At", "Updated_By"],
    "SP_Master": ["Kode_Barang", "Nama_Barang", "Satuan", "Active", "Created_At", "Nama_RS", "Item_Id"],
    "SP_Request": ["No_Request", "Timestamp", "Tanggal", "Nama_RS", "Nama_Operator",
                   "Status", "Catatan_Operator", "Catatan_Teknisi", "Reviewed_By", "Reviewed_At"],
    "SP_Request_Items": ["No_Request", "Kode_Barang", "Nama_Barang", "Qty"],
    "SP_Pengiriman": ["No_Pengiriman", "No_Permintaan", "Timestamp", "Tanggal_Kirim", "Nama_RS",
                      "Penerima_Nama", "Penerima_HP", "Foto_Resi_URL", "Nama_Pengirim",
                      "Jabatan_Pengirim", "Status", "Submitted_By", "Catatan"],
    "SP_Pengiriman_Items": ["No_Pengiriman", "Kode_Barang", "Nama_Barang", "Qty"],
    "SP_Penerimaan": ["No_Penerimaan", "No_Pengiriman", "Timestamp", "Tanggal_Terima", "Nama_RS",
                      "Nama_Operator", "Foto_Barang_URL", "Status", "Catatan_Teknisi",
                      "Reviewed_By", "Reviewed_At"],
    "SP_Penerimaan_Items": ["No_Penerimaan", "Kode_Barang", "Nama_Barang", "Qty"],
    "SP_Pemakaian": ["No_Pemakaian", "Timestamp", "Tanggal", "Nama_RS", "Nama_Operator", "Catatan"],
    "SP_Pemakaian_Items": ["No_Pemakaian", "Kode_Barang", "Nama_Barang", "RH_Saat_Diganti", "Qty"],
    "SP_Penyesuaian": ["No_Penyesuaian", "Timestamp", "Tanggal", "Nama_RS", "Item_Id", "Kode_Barang",
                        "Nama_Barang", "Qty_Sebelum", "Qty_Sesudah", "Delta", "Catatan", "Submitted_By"],
}

SHIFT_OPTIONS = ["pagi", "sore", "malam"]
JAM_24H_RE = re.compile(r"^([01]\d|2[0-3])\.[0-5]\d$")

FIELDS_DOCS = [
    ("purity", "Purity", True, "float", 0, 100),
    ("running_hours", "Running Hours", True, "int", 0, None),
    ("pressure", "Pressure", True, "float", None, None),
    ("box_temperature", "Box Temperature", True, "float", None, None),
    ("xt1", "XT1", True, "float", None, None), ("xt2", "XT2", True, "float", None, None),
    ("xt3", "XT3", True, "float", None, None), ("xt4", "XT4", True, "float", None, None),
    ("rtd1", "RTD1", True, "text", None, None), ("rtd2", "RTD2", True, "text", None, None),
    ("rtd3", "RTD3", True, "text", None, None), ("rtd4", "RTD4", True, "text", None, None),
    ("vsa", "VSA", True, "float", None, None),
    ("scr", "SCR", True, "float", None, None),
    ("flow_avg_lpm", "Flow Avg (LPM)", True, "float", 0, None),
    ("flow_total_m3", "Flow Total (M3)", True, "float", 0, None),
    ("catatan", "Catatan", False, "text", None, None),
]
FIELDS_WWZ = [
    ("running_hours", "Running Hours", False, "int", 0, None),
    ("temp_disc1", "1st Stage Discharge Temperature", False, "float", None, None),
    ("temp_disc2", "2nd Stage Discharge Temperature", False, "float", None, None),
    ("press_inlet", "Inlet Pressure", False, "float", None, None),
    ("press_l1", "Level 1 Exhaust Pressure", False, "float", None, None),
    ("press_l2", "Level 2 Exhaust Pressure", False, "float", None, None),
    ("riset_rh", "Reset RH", True, "enum", None, None, ["Ya", "Tidak"]),
    ("unit", "Unit Mesin", False, "enum", None, None, ["1", "2"]),
    ("jumlah_produksi_tabung_o2", "Jumlah Produksi Tabung O2", True, "int", 0, None),
    ("catatan", "Catatan", False, "text", None, None),
]
FIELDS_GOW = [
    ("running_hours", "Running Hours", False, "int", 0, None),
    ("temp_ex1", "1st Exhaust Temperature", False, "float", None, None),
    ("temp_ex2", "2nd Exhaust Temperature", False, "float", None, None),
    ("temp_ex3", "3rd Exhaust Temperature", False, "float", None, None),
    ("temp_ex4", "4th Exhaust Temperature", False, "float", None, None),
    ("press_inlet", "Inlet Pressure", False, "float", None, None),
    ("press_ex1", "1st Stage Exhaust Pressure", False, "float", None, None),
    ("press_ex2", "2nd Stage Exhaust Pressure", False, "float", None, None),
    ("press_ex3", "3rd Stage Exhaust Pressure", False, "float", None, None),
    ("press_ex4", "4th Stage Exhaust Pressure", False, "float", None, None),
    ("unit", "Unit Mesin", False, "enum", None, None, ["1", "2"]),
    ("jumlah_produksi_tabung_o2", "Jumlah Produksi Tabung O2", True, "int", 0, None),
    ("riset_rh", "Reset RH", True, "enum", None, None, ["Ya", "Tidak"]),
    ("catatan", "Catatan", False, "text", None, None),
]

EDIT_FIELD_MAP_DOCS = {
    "purity": "Purity_%", "running_hours": "Running_Hours",
    "pressure": "Pressure", "box_temperature": "Box_Temperature",
    "xt1": "XT1", "xt2": "XT2", "xt3": "XT3", "xt4": "XT4",
    "rtd1": "RTD1", "rtd2": "RTD2", "rtd3": "RTD3", "rtd4": "RTD4",
    "vsa": "VSA", "scr": "SCR",
    "flow_avg_lpm": "Flow_Avg_LPM", "flow_total_m3": "Flow_Total_M3",
    "catatan": "Catatan",
    "catatan_operator": "Catatan_Operator",
}
EDIT_FIELD_MAP_WWZ = {
    "running_hours": "Running_Hours",
    "temp_disc1": "Temp1", "temp_disc2": "Temp2",
    "press_inlet": "Press1", "press_l1": "Press2", "press_l2": "Press3",
    "riset_rh": "Riset_RH",
    "jumlah_produksi_tabung_o2": "Jumlah_Produksi_Tabung_O2", "catatan": "Catatan",
}
EDIT_FIELD_MAP_GOW = {
    "running_hours": "Running_Hours",
    "temp_ex1": "Temp1", "temp_ex2": "Temp2", "temp_ex3": "Temp3", "temp_ex4": "Temp4",
    "press_inlet": "Press_Inlet", "press_ex1": "Press1", "press_ex2": "Press2", "press_ex3": "Press3", "press_ex4": "Press4",
    "jumlah_produksi_tabung_o2": "Jumlah_Produksi_Tabung_O2", "riset_rh": "Riset_RH", "catatan": "Catatan",
}


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def now_plus(hours: float) -> str:
    return (datetime.now() + timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")


def new_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex[:8]


def s(v) -> str:
    return "" if v is None else str(v).strip()


def norm(v) -> str:
    return s(v).lower()


class Store:

    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.data = {k: [] for k in COLS}
        self.data["_junk_sheets"] = {}
        if path.exists():
            try:
                loaded = json.loads(path.read_text(encoding="utf-8"))
                for k in COLS:
                    self.data[k] = loaded.get(k, [])
                self.data["_junk_sheets"] = loaded.get("_junk_sheets", {})
            except Exception:
                pass

    def save(self):
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), encoding="utf-8")

    def rows(self, key):
        return self.data[key]

    def append(self, key, row: dict):
        with self.lock:
            full = {h: row.get(h, "") for h in COLS[key]}
            self.data[key].append(full)
            self.save()

    def delete_row(self, key, row):
        with self.lock:
            try:
                self.data[key].remove(row)
            except ValueError:
                pass
            self.save()

    def log(self, username, role, action, detail=""):
        self.append("Log_Aktivitas", {"Timestamp": now_str(), "Username": username, "Role": role,
                                        "Action": action, "Detail": detail})
        with self.lock:
            if len(self.data["Log_Aktivitas"]) > ACTIVITY_LOG_MAX_ROWS:
                self.data["Log_Aktivitas"] = self.data["Log_Aktivitas"][-ACTIVITY_LOG_MAX_ROWS:]
                self.save()


STORE: Store


class ApiError(Exception):
    def __init__(self, code, message, extra=None):
        self.code, self.message, self.extra = code, message, (extra or {})


def coerce(raw, tipe, label, minv, maxv, errors, key, required):
    if raw is None or s(raw) == "":
        if required:
            errors[key] = f"{label} wajib diisi"
        return None
    txt = s(raw).replace(",", ".")
    try:
        num = float(txt)
    except ValueError:
        errors[key] = f"{label} harus berupa angka"
        return None
    if num != num or num in (float("inf"), float("-inf")):
        errors[key] = f"{label} harus berupa angka"
        return None
    if tipe == "int" and abs(num - round(num)) > 1e-9:
        errors[key] = f"{label} harus bilangan bulat"
        return None
    if minv is not None and num < minv:
        errors[key] = f"{label} minimal {minv}"
        return None
    if maxv is not None and num > maxv:
        errors[key] = f"{label} maksimal {maxv}"
        return None
    return int(round(num)) if tipe == "int" else num


def coerce_enum(raw, label, options, errors, key, required):
    txt = s(raw)
    if not txt:
        if required:
            errors[key] = f"{label} wajib dipilih"
        return None
    for opt in options:
        if opt.lower() == txt.lower():
            return opt
    errors[key] = f"{label} harus salah satu dari: " + " / ".join(options)
    return None


def coerce_text(raw, label, errors, key, required):
    txt = s(raw).strip()
    if not txt:
        if required:
            errors[key] = f"{label} wajib diisi"
        return ""
    return txt


def validate_submission(payload):
    errors = {}
    identitas = payload.get("identitas") or {}
    docs_in = payload.get("docs") or {}
    booster = payload.get("booster") or {}

    nama_rs = s(identitas.get("nama_rs"))
    daerah_rs = s(identitas.get("daerah_rs"))
    tanggal = s(identitas.get("tanggal"))
    shift = s(identitas.get("shift"))
    if not nama_rs:
        errors["identitas.nama_rs"] = "Nama Rumah Sakit wajib diisi"
    if not daerah_rs:
        errors["identitas.daerah_rs"] = "Daerah Rumah Sakit wajib diisi"
    if not tanggal:
        errors["identitas.tanggal"] = "Tanggal wajib diisi"
    if not shift:
        errors["identitas.shift"] = "Shift wajib dipilih"
    elif shift not in SHIFT_OPTIONS:
        errors["identitas.shift"] = "Shift tidak valid"
    jam_lapor = s(identitas.get("jam_lapor"))
    if not jam_lapor:
        errors["identitas.jam_lapor"] = "Jam laporan wajib diisi"
    elif not JAM_24H_RE.match(jam_lapor):
        errors["identitas.jam_lapor"] = "Format jam tidak valid (format 24 jam, contoh: 09.00 atau 22.00)"
    operator_nama = s(identitas.get("operator_nama"))
    if not operator_nama:
        errors["identitas.operator_nama"] = "Nama Operator wajib dipilih"
    catatan_operator = coerce_text(identitas.get("catatan_operator"), "Catatan Operator",
                                    errors, "identitas.catatan_operator", False)[:300]

    bulan = tanggal[:7]
    docs_row = {"nama_rs": nama_rs, "daerah_rs": daerah_rs, "tanggal": tanggal, "bulan": bulan,
                "shift": shift, "jam_lapor": jam_lapor, "catatan_operator": catatan_operator}
    for field in FIELDS_DOCS:
        key, label, required, tipe = field[0], field[1], field[2], field[3]
        if tipe == "enum":
            docs_row[key] = coerce_enum(docs_in.get(key), label, field[6], errors, f"docs.{key}", required)
        elif tipe == "text":
            docs_row[key] = coerce_text(docs_in.get(key), label, errors, f"docs.{key}", required)
        else:
            minv, maxv = field[4], field[5]
            docs_row[key] = coerce(docs_in.get(key), tipe, label, minv, maxv, errors, f"docs.{key}", required)

    wwz_row = gow_row = None
    if booster.get("has"):
        if not booster.get("has_wwz") and not booster.get("has_gow"):
            errors["booster._"] = "Pilih minimal satu mesin booster (WWZ atau GOW)"
        for prefix, fields, on in (("wwz", FIELDS_WWZ, booster.get("has_wwz")),
                                    ("gow", FIELDS_GOW, booster.get("has_gow"))):
            if not on:
                continue
            data_in = booster.get(prefix) or {}
            row = {"nama_rs": nama_rs, "tanggal": tanggal, "bulan": bulan, "shift": shift, "jam_lapor": jam_lapor}
            filled = 0
            for field in fields:
                key, label, required, tipe, minv, maxv = field[0], field[1], field[2], field[3], field[4], field[5]
                if tipe == "enum":
                    row[key] = coerce_enum(data_in.get(key), f"{prefix.upper()} {label}", field[6],
                                            errors, f"{prefix}.{key}", required)
                elif tipe == "text":
                    row[key] = coerce_text(data_in.get(key), f"{prefix.upper()} {label}",
                                            errors, f"{prefix}.{key}", required)
                else:
                    row[key] = coerce(data_in.get(key), tipe, f"{prefix.upper()} {label}", minv, maxv,
                                       errors, f"{prefix}.{key}", required)
                if key == "unit":
                    if not row[key]:
                        row[key] = "1"
                    continue
                if row[key] is not None and row[key] != "":
                    filled += 1
            if filled == 0:
                errors[f"{prefix}._"] = f"Mesin {prefix.upper()} ditandai ada, minimal satu parameter harus diisi"
            if prefix == "wwz":
                wwz_row = row
            else:
                gow_row = row

    if errors:
        return None, errors
    return {"docs": docs_row, "wwz": wwz_row, "gow": gow_row,
            "meta": {"nama_rs": nama_rs, "daerah_rs": daerah_rs, "tanggal": tanggal, "bulan": bulan,
                     "shift": shift, "operator_nama": operator_nama}}, None


def require_auth(token, role_required=None):
    if not token:
        raise ApiError("unauthorized", "Sesi tidak ditemukan. Silakan login ulang.")
    row = next((r for r in STORE.rows("Sessions") if s(r.get("Token")) == s(token)), None)
    if not row:
        raise ApiError("unauthorized", "Sesi tidak valid. Silakan login ulang.")
    if s(row.get("Expires_At")) and row["Expires_At"] < now_str():
        STORE.rows("Sessions").remove(row)
        STORE.save()
        raise ApiError("session_expired", "Sesi Anda sudah berakhir. Silakan login ulang.")
    if role_required:
        allowed = role_required if isinstance(role_required, (list, tuple)) else [role_required]
        if s(row.get("Role")) not in allowed:
            raise ApiError("forbidden", "Anda tidak memiliki akses untuk aksi ini.")
    return {"username": row["Username"], "role": row["Role"], "name": row.get("Name") or row["Username"]}


_ROLES_MIGRATED_FLAG = BASE_DIR / ".roles_migrated_v3"


def migrate_roles_if_needed():
    return


def h_ping(p):
    return {"pong": datetime.now().isoformat()}


def h_accountsExist(p):
    return {"exists": len(STORE.rows("Akun")) > 0}


def h_bootstrapAdmin(p):
    if STORE.rows("Akun"):
        raise ApiError("already_setup", "Sudah ada akun terdaftar. Hubungi admin untuk dibuatkan akun.")
    username, password, name = s(p.get("username")), s(p.get("password")), s(p.get("name"))
    if not username or not password:
        raise ApiError("validation", "Username dan password wajib diisi.")
    if len(password) < 6:
        raise ApiError("validation", "Password minimal 6 karakter.")
    STORE.append("Akun", {"Username": username, "Password": password, "Role": "admin",
                           "Name": name or username, "Active": True, "Created_At": now_str(),
                           "Created_By": "bootstrap", "Last_Login": "", "Approval_Status": "approved"})
    STORE.log(username, "admin", "bootstrap_admin", "Akun admin pertama dibuat")
    return {"message": "Akun admin pertama berhasil dibuat. Silakan login."}


def h_login(p):
    username, password = s(p.get("username")), s(p.get("password"))
    if not username or not password:
        raise ApiError("validation", "Username dan password wajib diisi.")
    found = next((r for r in STORE.rows("Akun") if norm(r.get("Username")) == norm(username)), None)
    if found:
        if s(found.get("Password")) != password:
            raise ApiError("bad_credentials", "Username atau password salah.")
        approval = s(found.get("Approval_Status"))
        if approval == "pending":
            raise ApiError("pending_approval", "Akun Anda sedang menunggu persetujuan Admin. Coba lagi nanti.")
        if approval == "rejected":
            raise ApiError("rejected", "Registrasi akun Anda ditolak oleh Admin. Hubungi Admin untuk info lebih lanjut.")
        if found.get("Active") is False or s(found.get("Active")) == "false":
            raise ApiError("inactive", "Akun Anda dinonaktifkan. Hubungi admin.")
        token = new_token()
        STORE.append("Sessions", {"Token": token, "Username": found["Username"], "Role": found["Role"],
                                   "Name": found.get("Name"), "Created_At": now_str(),
                                   "Expires_At": now_plus(SESSION_TTL_HOURS)})
        found["Last_Login"] = now_str()
        STORE.save()
        STORE.log(found["Username"], found["Role"], "login", "")
        return {"token": token, "role": s(found.get("Role")), "name": s(found.get("Name")) or found["Username"],
                "username": found["Username"]}

    rs_found = next((r for r in STORE.rows("Rumah_Sakit") if norm(r.get("Username")) == norm(username) and s(r.get("Username"))), None)
    if not rs_found or s(rs_found.get("Password")) != password:
        raise ApiError("bad_credentials", "Username atau password salah.")
    if rs_found.get("Active") is False or s(rs_found.get("Active")) == "false":
        raise ApiError("inactive", "Akun rumah sakit ini dinonaktifkan. Hubungi Teknisi/Admin.")
    token = new_token()
    STORE.append("Sessions", {"Token": token, "Username": rs_found["Username"], "Role": "rs",
                               "Name": rs_found.get("Nama_RS"), "Created_At": now_str(),
                               "Expires_At": now_plus(SESSION_TTL_HOURS)})
    operators = [s(rs_found.get("Operator1")), s(rs_found.get("Operator2")), s(rs_found.get("Operator3"))]
    operators = [o for o in operators if o]
    return {"token": token, "role": "rs", "name": s(rs_found.get("Nama_RS")) or rs_found["Username"],
            "username": rs_found["Username"], "nama_rs": s(rs_found.get("Nama_RS")),
            "daerah_rs": s(rs_found.get("Daerah_RS")), "operators": operators}


def h_confirmRsOperatorLogin(p):
    auth = require_auth(p.get("token"), "rs")
    operator_nama = s(p.get("operator_nama"))
    row = next((r for r in STORE.rows("Sessions") if s(r.get("Token")) == s(p.get("token"))), None)
    name = s(row.get("Name")) if row else auth.get("username")
    detail = name + (" · Operator: " + operator_nama if operator_nama else "")
    STORE.log(auth["username"], "rs", "login", detail)
    return {}


def h_logout(p):
    auth = require_auth(p.get("token"))
    row = next((r for r in STORE.rows("Sessions") if s(r.get("Token")) == s(p.get("token"))), None)
    if row:
        STORE.rows("Sessions").remove(row)
        STORE.save()
    STORE.log(auth["username"], auth["role"], "logout", "")
    return {}


def h_changeOwnPassword(p):
    auth = require_auth(p.get("token"))
    new_password, old_password = s(p.get("newPassword")), s(p.get("oldPassword"))
    if not new_password or len(new_password) < 6:
        raise ApiError("validation", "Password baru minimal 6 karakter.")
    row = next((r for r in STORE.rows("Akun") if norm(r.get("Username")) == norm(auth["username"])), None)
    if not row:
        raise ApiError("not_found", "Akun tidak ditemukan.")
    if s(row.get("Password")) != old_password:
        raise ApiError("bad_credentials", "Password lama salah.")
    row["Password"] = new_password
    STORE.save()
    STORE.log(auth["username"], auth["role"], "change_password", "Ganti password sendiri")
    return {"message": "Password berhasil diubah."}


def h_submitReport(p):
    auth = require_auth(p.get("token"), "rs")
    rs_row = next((r for r in STORE.rows("Rumah_Sakit") if norm(r.get("Username")) == norm(auth["username"])), None)
    if not rs_row:
        raise ApiError("forbidden", "Akun rumah sakit ini tidak ditemukan atau sudah dihapus.")

    parsed, errors = validate_submission(p)
    if errors:
        raise ApiError("validation", "Beberapa field belum benar.", {"errors": errors})
    meta = parsed["meta"]

    operator_options = [s(rs_row.get("Operator1")), s(rs_row.get("Operator2")), s(rs_row.get("Operator3"))]
    operator_options = [o for o in operator_options if o]
    op_match = next((o for o in operator_options if norm(o) == norm(meta["operator_nama"])), None)
    if not op_match:
        raise ApiError("validation", "Beberapa field belum benar.",
                        {"errors": {"identitas.operator_nama": f"Pilih nama operator dari daftar ({', '.join(operator_options)})"}})

    meta = {**meta, "nama_rs": rs_row["Nama_RS"], "daerah_rs": s(rs_row.get("Daerah_RS")), "operator_nama": op_match}
    parsed["docs"]["nama_rs"] = rs_row["Nama_RS"]
    parsed["docs"]["daerah_rs"] = s(rs_row.get("Daerah_RS"))
    if parsed["wwz"]:
        parsed["wwz"]["nama_rs"] = rs_row["Nama_RS"]
    if parsed["gow"]:
        parsed["gow"]["nama_rs"] = rs_row["Nama_RS"]

    if not p.get("confirm_duplicate"):
        existing = next((r for r in STORE.rows("Laporan_DOCS")
                          if norm(r.get("Nama_RS")) == norm(meta["nama_rs"]) and s(r.get("Tanggal")) == meta["tanggal"]
                          and norm(r.get("Shift")) == norm(meta["shift"])), None)
        if existing:
            who = s(existing.get("Submitted_By_Name") or existing.get("Submitted_By"))
            raise ApiError("duplicate",
                            f"Laporan DOCS untuk {meta['nama_rs']} tanggal {meta['tanggal']} shift {meta['shift']} "
                            f"sudah pernah dikirim (pukul {existing.get('Timestamp')} oleh {who}). "
                            f"Kirim ulang hanya jika ini koreksi data.")

    ts = now_str()
    who = {"Submitted_By": auth["username"], "Submitted_By_Name": meta["operator_nama"]}
    written = []
    d = parsed["docs"]
    STORE.append("Laporan_DOCS", {**{
        "Timestamp": ts, "Nama_RS": d["nama_rs"], "Daerah_RS": d["daerah_rs"], "Tanggal": d["tanggal"], "Bulan": d["bulan"],
        "Purity_%": d["purity"], "Running_Hours": d["running_hours"], "Pressure": d["pressure"],
        "Box_Temperature": d["box_temperature"], "XT1": d["xt1"], "XT2": d["xt2"], "XT3": d["xt3"], "XT4": d["xt4"],
        "RTD1": d["rtd1"], "RTD2": d["rtd2"], "RTD3": d["rtd3"], "RTD4": d["rtd4"],
        "Shift": d["shift"], "Jam_Lapor": d["jam_lapor"],
        "VSA": d["vsa"], "SCR": d["scr"],
        "Flow_Avg_LPM": d["flow_avg_lpm"], "Flow_Total_M3": d["flow_total_m3"],
        "Catatan": d["catatan"], "Catatan_Operator": d["catatan_operator"],
    }, **who})
    written.append("Laporan_DOCS")

    if parsed["wwz"]:
        w = parsed["wwz"]
        STORE.append("Laporan_WWZ", {**{
            "Timestamp": ts, "Nama_RS": w["nama_rs"], "Tanggal": w["tanggal"], "Bulan": w["bulan"],
            "Running_Hours": w["running_hours"], "Temp1": w["temp_disc1"], "Temp2": w["temp_disc2"],
            "Press1": w["press_inlet"], "Press2": w["press_l1"], "Press3": w["press_l2"],
            "Shift": w["shift"], "Jam_Lapor": w["jam_lapor"],
            "Riset_RH": w["riset_rh"],
            "Unit": w.get("unit") or "1",
            "Jumlah_Produksi_Tabung_O2": w["jumlah_produksi_tabung_o2"], "Catatan": w["catatan"],
        }, **who})
        written.append("Laporan_WWZ")

    if parsed["gow"]:
        g = parsed["gow"]
        STORE.append("Laporan_GOW", {**{
            "Timestamp": ts, "Nama_RS": g["nama_rs"], "Tanggal": g["tanggal"], "Bulan": g["bulan"],
            "Running_Hours": g["running_hours"],
            "Temp1": g["temp_ex1"], "Temp2": g["temp_ex2"], "Temp3": g["temp_ex3"], "Temp4": g["temp_ex4"],
            "Press_Inlet": g["press_inlet"],
            "Press1": g["press_ex1"], "Press2": g["press_ex2"], "Press3": g["press_ex3"], "Press4": g["press_ex4"],
            "Shift": g["shift"], "Jam_Lapor": g["jam_lapor"],
            "Unit": g.get("unit") or "1",
            "Jumlah_Produksi_Tabung_O2": g["jumlah_produksi_tabung_o2"],
            "Riset_RH": g["riset_rh"], "Catatan": g["catatan"],
        }, **who})
        written.append("Laporan_GOW")

    op_suffix = " · Operator: " + meta["operator_nama"] if meta.get("operator_nama") else ""
    STORE.log(auth["username"], auth["role"], "submit_report", f"{meta['nama_rs']} · {meta['tanggal']}{op_suffix}")
    return {"written": written, "timestamp": ts, "message": "Laporan berhasil disimpan ke " + ", ".join(written)}


def h_getShiftsTaken(p):
    auth = require_auth(p.get("token"), "rs")
    rs_row = next((r for r in STORE.rows("Rumah_Sakit") if norm(r.get("Username")) == norm(auth["username"])), None)
    if not rs_row:
        raise ApiError("forbidden", "Akun rumah sakit ini tidak ditemukan atau sudah dihapus.")
    tanggal = s(p.get("tanggal"))
    if not tanggal:
        raise ApiError("validation", "Tanggal wajib diisi.")
    docs_hari_ini = [r for r in STORE.rows("Laporan_DOCS")
                      if norm(r.get("Nama_RS")) == norm(rs_row["Nama_RS"]) and s(r.get("Tanggal")) == tanggal]
    taken = sorted({norm(r.get("Shift")) for r in docs_hari_ini if r.get("Shift")})
    operators_taken = sorted({norm(r.get("Submitted_By_Name") or r.get("Submitted_By"))
                               for r in docs_hari_ini if (r.get("Submitted_By_Name") or r.get("Submitted_By"))})
    return {"taken": taken, "operators_taken": operators_taken}


def h_updateReport(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])

    report_type = s(p.get("report_type"))
    sheet_key_by_type = {"docs": "Laporan_DOCS", "wwz": "Laporan_WWZ", "gow": "Laporan_GOW"}
    field_map_by_type = {"docs": EDIT_FIELD_MAP_DOCS, "wwz": EDIT_FIELD_MAP_WWZ, "gow": EDIT_FIELD_MAP_GOW}
    fields_def_by_type = {"docs": FIELDS_DOCS, "wwz": FIELDS_WWZ, "gow": FIELDS_GOW}
    action_label_by_type = {"docs": "edit_laporan_docs", "wwz": "edit_laporan_booster", "gow": "edit_laporan_booster"}
    sheet_key = sheet_key_by_type.get(report_type)
    if not sheet_key:
        raise ApiError("validation", "report_type harus salah satu dari: docs, wwz, gow.")

    nama_rs, tanggal, shift, timestamp = s(p.get("nama_rs")), s(p.get("tanggal")), s(p.get("shift")), s(p.get("timestamp"))
    unit = s(p.get("unit")) or "1"
    if not nama_rs or not tanggal or not shift or not timestamp:
        raise ApiError("validation", "Nama RS, tanggal, shift, dan timestamp laporan wajib diisi untuk mengedit.")

    field_map = field_map_by_type[report_type]
    fields_def = fields_def_by_type[report_type]
    values_in = p.get("values") or {}
    errors = {}
    coerced = {}
    for field_def in fields_def:
        key, label, required, tipe = field_def[0], field_def[1], field_def[2], field_def[3]
        minv = field_def[4] if len(field_def) > 4 else None
        maxv = field_def[5] if len(field_def) > 5 else None
        options = field_def[6] if len(field_def) > 6 else None
        if key not in field_map:
            continue
        if key not in values_in:
            continue
        if tipe == "enum":
            coerced[key] = coerce_enum(values_in[key], label, options, errors, key, required)
        elif tipe == "text":
            coerced[key] = coerce_text(values_in[key], label, errors, key, required)
        else:
            coerced[key] = coerce(values_in[key], tipe, label, minv, maxv, errors, key, required)

    if report_type == "docs" and "catatan_operator" in field_map and "catatan_operator" in values_in:
        coerced["catatan_operator"] = coerce_text(values_in["catatan_operator"], "Catatan Operator",
                                                    errors, "catatan_operator", False)[:300]

    if errors:
        raise ApiError("validation", "Beberapa field belum benar.", {"errors": errors})

    matches = [r for r in STORE.rows(sheet_key)
               if norm(r.get("Nama_RS")) == norm(nama_rs) and s(r.get("Tanggal")) == tanggal
               and norm(r.get("Shift")) == norm(shift) and s(r.get("Timestamp")) == timestamp
               and (sheet_key == "Laporan_DOCS" or norm(r.get("Unit") or "1") == norm(unit))]
    if not matches:
        raise ApiError("not_found", "Laporan tidak ditemukan (mungkin sudah berubah/dihapus, muat ulang data lalu coba lagi).")
    target = matches[-1]

    changes = []
    for key, new_val in coerced.items():
        col_name = field_map[key]
        old_str, new_str = s(target.get(col_name)), s(new_val)
        if old_str == new_str:
            continue
        target[col_name] = new_val
        label = next((d[1] for d in fields_def if d[0] == key), col_name)
        changes.append(f"{label}: {old_str or '–'} → {new_str or '–'}")

    target["Updated_At"] = now_str()
    target["Updated_By"] = auth["username"]
    STORE.save()

    unit_desc = "" if sheet_key == "Laporan_DOCS" else f" · {sheet_key.replace('Laporan_', '')} unit {unit}"
    target_desc = f"{nama_rs} · {tanggal} · shift {shift}{unit_desc}"
    summary = ", ".join(changes) if changes else "(tidak ada nilai yang berubah)"
    STORE.log(auth["username"], auth["role"], action_label_by_type[report_type], f"{target_desc} — {summary}")

    return {"message": "Perubahan tersimpan.", "changes": changes, "updated_at": target["Updated_At"], "updated_by": auth["username"]}


def h_getReports(p):
    auth = require_auth(p.get("token"))
    is_admin = auth["role"] in ("admin", "teknisi")
    bulan, rs_filter = s(p.get("bulan")), s(p.get("rs"))
    teknisi_filter = s(p.get("teknisi")) if is_admin else ""
    self_username = "" if is_admin else auth["username"]

    def filt(rows):
        out = []
        for r in rows:
            if bulan and s(r.get("Tanggal"))[:7] != bulan:
                continue
            if rs_filter and norm(r.get("Nama_RS")) != norm(rs_filter):
                continue
            if teknisi_filter and norm(r.get("Submitted_By_Name")) != norm(teknisi_filter):
                continue
            if self_username and norm(r.get("Submitted_By")) != norm(self_username):
                continue
            out.append(r)
        return out

    all_docs = STORE.rows("Laporan_DOCS")
    docs, wwz, gow = filt(all_docs), filt(STORE.rows("Laporan_WWZ")), filt(STORE.rows("Laporan_GOW"))
    scope = all_docs if is_admin else [r for r in all_docs if norm(r.get("Submitted_By")) == norm(auth["username"])]
    daftar_rs = sorted({s(r.get("Nama_RS")) for r in scope if r.get("Nama_RS")})
    bulan_tersedia = sorted({s(r.get("Tanggal"))[:7] for r in scope if r.get("Tanggal")}, reverse=True)
    daftar_teknisi = []
    if is_admin:
        seen = set()
        for r in all_docs:
            n = s(r.get("Submitted_By_Name"))
            if n and n not in seen:
                seen.add(n)
        daftar_teknisi = [{"username": n, "name": n} for n in seen]
    return {"docs": docs, "wwz": wwz, "gow": gow, "daftar_rs": daftar_rs,
            "bulan_tersedia": bulan_tersedia, "daftar_teknisi": daftar_teknisi, "storage_mode": "sheets"}


def h_listAccounts(p):
    require_auth(p.get("token"), "admin")
    rows = [{"username": r["Username"], "name": r.get("Name"), "role": r.get("Role"),
             "active": not (r.get("Active") is False or s(r.get("Active")) == "false"),
             "approval_status": s(r.get("Approval_Status")) or "approved",
             "created_at": r.get("Created_At"), "created_by": r.get("Created_By"),
             "last_login": r.get("Last_Login")} for r in STORE.rows("Akun")]
    return {"accounts": rows}


def h_createAccount(p):
    auth = require_auth(p.get("token"), "admin")
    username, password, name = s(p.get("username")), s(p.get("password")), s(p.get("name"))
    role_in = s(p.get("role"))
    role = role_in if role_in in ("admin", "teknisi", "logistik") else "teknisi"
    if not username or not password:
        raise ApiError("validation", "Username dan password wajib diisi.")
    if len(password) < 6:
        raise ApiError("validation", "Password minimal 6 karakter.")
    akun_rows = STORE.rows("Akun")
    if any(norm(r.get("Username")) == norm(username) for r in akun_rows):
        raise ApiError("duplicate", "Username sudah dipakai.")

    STORE.append("Akun", {"Username": username, "Password": password, "Role": role, "Name": name or username,
                           "Active": True, "Created_At": now_str(), "Created_By": auth["username"], "Last_Login": "",
                           "Approval_Status": "approved"})
    STORE.log(auth["username"], auth["role"], "create_account", f"{username} ({role})")
    return {"message": f"Akun {username} berhasil dibuat."}


def h_listRumahSakit(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    bulan_ini = datetime.now().strftime("%Y-%m")
    stat_by_rs = {}
    for r in list(STORE.rows("Laporan_WWZ")) + list(STORE.rows("Laporan_GOW")):
        if s(r.get("Tanggal"))[:7] != bulan_ini:
            continue
        key = norm(r.get("Nama_RS"))
        if not key:
            continue
        stat = stat_by_rs.setdefault(key, {"tabung": 0})
        try:
            stat["tabung"] += float(r.get("Jumlah_Produksi_Tabung_O2") or 0)
        except (TypeError, ValueError):
            pass
    rows = []
    for r in STORE.rows("Rumah_Sakit"):
        stat = stat_by_rs.get(norm(r.get("Nama_RS")), {"tabung": 0})
        rows.append({"nama_rs": s(r.get("Nama_RS")), "daerah_rs": s(r.get("Daerah_RS")),
                      "operator1": s(r.get("Operator1")), "operator2": s(r.get("Operator2")), "operator3": s(r.get("Operator3")),
                      "username": s(r.get("Username")), "has_password": bool(s(r.get("Password"))),
                      "active": not (r.get("Active") is False or s(r.get("Active")) == "false"),
                      "updated_at": r.get("Updated_At"), "updated_by": r.get("Updated_By"),
                      "tabung_bulan_ini": stat["tabung"]})
    rows.sort(key=lambda r: r["nama_rs"])
    return {"rs": rows}


def h_setRumahSakitAccount(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    nama_rs = s(p.get("nama_rs"))
    if not nama_rs:
        raise ApiError("validation", "Nama Rumah Sakit wajib diisi.")
    username = s(p.get("username"))
    password = s(p.get("password"))
    op1, op2, op3 = s(p.get("operator1")), s(p.get("operator2")), s(p.get("operator3"))
    if not username:
        raise ApiError("validation", "Username wajib diisi.")
    if password and len(password) < 6:
        raise ApiError("validation", "Password minimal 6 karakter.")
    if not op1 or not op2:
        raise ApiError("validation", "Minimal nama 2 operator (Operator 1 & 2) wajib diisi. Operator 3 boleh dikosongkan kalau RS ini cuma punya 2 operator.")

    rows = STORE.rows("Rumah_Sakit")
    if any(norm(r.get("Username")) == norm(username) and norm(r.get("Nama_RS")) != norm(nama_rs) for r in rows):
        raise ApiError("duplicate", "Username sudah dipakai rumah sakit lain.")

    row = next((r for r in rows if norm(r.get("Nama_RS")) == norm(nama_rs)), None)
    daerah_rs = s(p.get("daerah_rs")) or (s(row.get("Daerah_RS")) if row else "")
    final_password = password or (s(row.get("Password")) if row else "")
    if not final_password:
        raise ApiError("validation", "Password wajib diisi untuk akun baru.")

    if row:
        row.update({"Daerah_RS": daerah_rs, "Operator1": op1, "Operator2": op2, "Operator3": op3,
                     "Username": username, "Password": final_password, "Active": True,
                     "Updated_At": now_str(), "Updated_By": auth["username"]})
        STORE.save()
    else:
        STORE.append("Rumah_Sakit", {"Nama_RS": nama_rs, "Daerah_RS": daerah_rs, "Operator1": op1,
                                      "Operator2": op2, "Operator3": op3, "Username": username,
                                      "Password": final_password, "Active": True,
                                      "Updated_At": now_str(), "Updated_By": auth["username"]})
    STORE.log(auth["username"], auth["role"], "set_rs_account", f"{nama_rs} · username: {username}")
    return {"message": f"Akun rumah sakit {nama_rs} berhasil disimpan."}


def h_setRumahSakitActive(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    nama_rs = s(p.get("nama_rs"))
    if not nama_rs:
        raise ApiError("validation", "Nama Rumah Sakit wajib diisi.")
    row = next((r for r in STORE.rows("Rumah_Sakit") if norm(r.get("Nama_RS")) == norm(nama_rs)), None)
    if not row:
        raise ApiError("not_found", "Rumah Sakit tidak ditemukan.")
    active = bool(p.get("active"))
    row["Active"] = active
    row["Updated_At"] = now_str()
    row["Updated_By"] = auth["username"]
    STORE.save()
    STORE.log(auth["username"], auth["role"], "activate_rs" if active else "deactivate_rs", nama_rs)
    return {"message": (f"Rumah Sakit {nama_rs} diaktifkan kembali." if active else f"Rumah Sakit {nama_rs} dinonaktifkan.")}


def h_deleteRumahSakit(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    nama_rs = s(p.get("nama_rs"))
    if not nama_rs:
        raise ApiError("validation", "Nama Rumah Sakit wajib diisi.")
    row = next((r for r in STORE.rows("Rumah_Sakit") if norm(r.get("Nama_RS")) == norm(nama_rs)), None)
    if not row:
        raise ApiError("not_found", "Rumah Sakit tidak ditemukan.")
    STORE.delete_row("Rumah_Sakit", row)
    STORE.log(auth["username"], auth["role"], "delete_rs", nama_rs)
    return {"message": f"Rumah Sakit {nama_rs} berhasil dihapus dari daftar. Data laporan yang sudah ada tidak terhapus."}


def h_setAccountActive(p):
    auth = require_auth(p.get("token"), "admin")
    username = s(p.get("username"))
    if norm(username) == norm(auth["username"]) and not p.get("active"):
        raise ApiError("validation", "Anda tidak bisa menonaktifkan akun Anda sendiri.")
    row = next((r for r in STORE.rows("Akun") if norm(r.get("Username")) == norm(username)), None)
    if not row:
        raise ApiError("not_found", "Akun tidak ditemukan.")
    row["Active"] = bool(p.get("active"))
    STORE.save()
    STORE.log(auth["username"], auth["role"], "activate_account" if p.get("active") else "deactivate_account", username)
    return {"message": f"Status akun {username} diperbarui."}


def h_setAccountApproval(p):
    auth = require_auth(p.get("token"), "admin")
    username = s(p.get("username"))
    decision = s(p.get("decision"))
    if decision not in ("approved", "rejected"):
        raise ApiError("validation", 'Keputusan harus "approved" atau "rejected".')
    row = next((r for r in STORE.rows("Akun") if norm(r.get("Username")) == norm(username)), None)
    if not row:
        raise ApiError("not_found", "Akun tidak ditemukan.")
    row["Approval_Status"] = decision
    row["Active"] = decision == "approved"
    STORE.save()
    STORE.log(auth["username"], auth["role"], "approve_account" if decision == "approved" else "reject_account", username)
    if decision == "approved":
        return {"message": f"Akun {username} disetujui dan sudah bisa login."}
    return {"message": f"Registrasi {username} ditolak."}


def h_resetPassword(p):
    auth = require_auth(p.get("token"), "admin")
    username, new_password = s(p.get("username")), s(p.get("newPassword"))
    if not new_password or len(new_password) < 6:
        raise ApiError("validation", "Password baru minimal 6 karakter.")
    row = next((r for r in STORE.rows("Akun") if norm(r.get("Username")) == norm(username)), None)
    if not row:
        raise ApiError("not_found", "Akun tidak ditemukan.")
    row["Password"] = new_password
    STORE.save()
    STORE.log(auth["username"], auth["role"], "reset_password", username)
    return {"message": f"Password {username} berhasil direset."}


def h_getActivityLog(p):
    require_auth(p.get("token"), "admin")
    limit = int(p.get("limit") or 200)
    rows = list(reversed(STORE.rows("Log_Aktivitas")))
    return {"log": rows[:limit]}


def h_snapshotBulanan(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    bulan = s(p.get("bulan"))
    if len(bulan) != 7 or bulan[4] != "-":
        raise ApiError("validation", "Format bulan harus YYYY-MM.")
    docs = [r for r in STORE.rows("Laporan_DOCS") if s(r.get("Tanggal"))[:7] == bulan]
    wwz = [r for r in STORE.rows("Laporan_WWZ") if s(r.get("Tanggal"))[:7] == bulan]
    gow = [r for r in STORE.rows("Laporan_GOW") if s(r.get("Tanggal"))[:7] == bulan]

    by_rs = {}
    for r in docs:
        rs = s(r.get("Nama_RS"))
        if not rs:
            continue
        by_rs.setdefault(rs, {"daerah": s(r.get("Daerah_RS")), "rows": []})["rows"].append(r)

    y, m = int(bulan[:4]), int(bulan[5:7])
    import calendar
    hari_bulan = calendar.monthrange(y, m)[1]
    today = datetime.now()
    if today.year == y and today.month == m:
        hari_wajib = today.day
    elif bulan < today.strftime("%Y-%m"):
        hari_wajib = hari_bulan
    else:
        hari_wajib = 0

    snapshot_at = now_str()
    rows_out = []
    for rs in sorted(by_rs):
        info = by_rs[rs]
        tanggal_set = {s(r.get("Tanggal")) for r in info["rows"]}
        purities = [float(r.get("Purity_%")) for r in info["rows"] if str(r.get("Purity_%", "")) not in ("", "None")]
        avg_p = round(sum(purities) / len(purities), 1) if purities else ""
        min_p = min(purities) if purities else ""
        max_p = max(purities) if purities else ""
        compliance = round((len(tanggal_set) / hari_wajib) * 100, 1) if hari_wajib else ""
        wwz_rs = [r for r in wwz if norm(r.get("Nama_RS")) == norm(rs)]
        gow_rs = [r for r in gow if norm(r.get("Nama_RS")) == norm(rs)]
        wwz_count = len(wwz_rs)
        gow_count = len(gow_rs)
        tabung_vals = []
        for r in wwz_rs + gow_rs:
            try:
                tabung_vals.append(float(r.get("Jumlah_Produksi_Tabung_O2")))
            except (TypeError, ValueError):
                pass
        total_tabung = sum(tabung_vals) if tabung_vals else 0
        rows_out.append({
            "Bulan": bulan, "Nama_RS": rs, "Daerah_RS": info["daerah"], "Total_Laporan": len(info["rows"]),
            "Hari_Wajib_Lapor": hari_wajib, "Compliance_Rate_%": compliance, "Avg_Purity": avg_p,
            "Min_Purity": min_p, "Max_Purity": max_p, "Laporan_WWZ": wwz_count, "Laporan_GOW": gow_count,
            "Snapshot_At": snapshot_at, "Snapshot_By": auth["username"],
            "Total_Tabung_O2": total_tabung,
        })

    STORE.data["Laporan_Bulanan"] = [r for r in STORE.rows("Laporan_Bulanan") if s(r.get("Bulan")) != bulan]
    STORE.data["Laporan_Bulanan"].extend(rows_out)
    STORE.save()
    STORE.log(auth["username"], auth["role"], "snapshot_bulanan", f"{bulan} ({len(rows_out)} RS)")
    return {"count": len(rows_out), "bulan": bulan,
            "message": f"Snapshot {bulan} tersimpan untuk {len(rows_out)} rumah sakit."}


def h_getMonthlySnapshots(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    bulan = s(p.get("bulan"))
    rows = STORE.rows("Laporan_Bulanan")
    if bulan:
        rows = [r for r in rows if s(r.get("Bulan")) == bulan]
    bulan_tersedia = sorted({s(r.get("Bulan")) for r in STORE.rows("Laporan_Bulanan")}, reverse=True)
    return {"rows": rows, "bulan_tersedia": bulan_tersedia}


SP_DOC_PREFIX = {
    "SP_Request": "REQ", "SP_Pengiriman": "KRM",
    "SP_Penerimaan": "TR", "SP_Pemakaian": "PK", "SP_Penyesuaian": "ADJ",
}


def gen_doc_no(sheet_key):
    prefix = SP_DOC_PREFIX[sheet_key]
    no_col = COLS[sheet_key][0]
    today = datetime.now().strftime("%Y%m%d")
    prefix_str = f"{prefix}-{today}-"
    count = sum(1 for r in STORE.rows(sheet_key) if s(r.get(no_col)).startswith(prefix_str))
    return f"{prefix_str}{count + 1:04d}"


def parse_barang_items(items, nama_rs):
    if not isinstance(items, list) or not items:
        raise ApiError("validation", "Daftar barang tidak boleh kosong — tambah minimal 1 baris barang.")
    master = [r for r in STORE.rows("SP_Master") if norm(r.get("Nama_RS")) == norm(nama_rs)]
    out = []
    for i, it in enumerate(items):
        it = it or {}
        item_id = s(it.get("item_id"))
        if not item_id:
            raise ApiError("validation", f"Barang wajib dipilih di semua baris (baris ke-{i+1} kosong).")
        try:
            qty = float(it.get("qty"))
        except (TypeError, ValueError):
            qty = None
        if qty is None or qty <= 0:
            raise ApiError("validation", f"Jumlah barang harus berupa angka lebih dari 0 di semua baris (baris ke-{i+1}).")
        if item_id == "__MANUAL__":
            nama_manual = s(it.get("nama_barang_manual"))
            if not nama_manual:
                raise ApiError("validation", f"Nama barang manual wajib diisi di baris ke-{i+1}.")
            out.append({"kode_barang": "", "nama_barang": nama_manual, "qty": qty, "rh": s(it.get("rh"))})
            continue
        m = next((r for r in master if s(r.get("Item_Id")) == item_id), None)
        if not m:
            raise ApiError("validation", f"Barang di baris ke-{i+1} tidak ditemukan/tidak berlaku untuk Rumah Sakit ini — muat ulang halaman lalu pilih ulang.")
        out.append({"kode_barang": s(m.get("Kode_Barang")), "nama_barang": s(m.get("Nama_Barang")),
                    "qty": qty, "rh": s(it.get("rh"))})
    return out


def h_listRsPublic(p):
    rows = [r for r in STORE.rows("Rumah_Sakit") if not (s(r.get("Active")) == "false" or r.get("Active") is False)]
    out = sorted(({"nama_rs": s(r.get("Nama_RS")), "daerah_rs": s(r.get("Daerah_RS")),
                   "operator1": s(r.get("Operator1")), "operator2": s(r.get("Operator2")),
                   "operator3": s(r.get("Operator3"))} for r in rows),
                 key=lambda x: x["nama_rs"])
    return {"rs": out}


def next_sp_master_item_id():
    max_n = 0
    for r in STORE.rows("SP_Master"):
        m = re.match(r"^SPM(\d+)$", s(r.get("Item_Id")))
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f"SPM{max_n + 1:06d}"


def h_listSparepartMaster(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    rows = STORE.rows("SP_Master")
    if s(p.get("nama_rs")):
        rows = [r for r in rows if norm(r.get("Nama_RS")) == norm(p.get("nama_rs"))]
    out = sorted(({"item_id": s(r.get("Item_Id")), "nama_rs": s(r.get("Nama_RS")),
                   "kode_barang": s(r.get("Kode_Barang")), "nama_barang": s(r.get("Nama_Barang")),
                   "satuan": s(r.get("Satuan")),
                   "active": not (s(r.get("Active")) == "false" or r.get("Active") is False),
                   "created_at": r.get("Created_At")} for r in rows),
                 key=lambda x: (x["nama_rs"], x["nama_barang"]))
    return {"items": out}


def h_listSparepartActive(p):
    nama_rs = s(p.get("nama_rs"))
    if not nama_rs:
        return {"items": []}
    rows = [r for r in STORE.rows("SP_Master")
            if norm(r.get("Nama_RS")) == norm(nama_rs) and not (s(r.get("Active")) == "false" or r.get("Active") is False)]
    out = sorted(({"item_id": s(r.get("Item_Id")), "kode_barang": s(r.get("Kode_Barang")),
                   "nama_barang": s(r.get("Nama_Barang")), "satuan": s(r.get("Satuan"))} for r in rows),
                 key=lambda x: x["nama_barang"])
    return {"items": out}


def upsert_sparepart_master_row(item_id, nama_rs, kode, nama, satuan):
    rows = STORE.rows("SP_Master")
    existing = None
    if item_id:
        existing = next((r for r in rows if s(r.get("Item_Id")) == item_id), None)
        if not existing:
            return {"error": "Barang tidak ditemukan."}
    else:
        existing = next((r for r in rows if norm(r.get("Nama_RS")) == norm(nama_rs) and (
            norm(r.get("Kode_Barang")) == norm(kode) if kode else
            (not s(r.get("Kode_Barang")) and norm(r.get("Nama_Barang")) == norm(nama))
        )), None)
    if existing:
        existing["Nama_RS"], existing["Kode_Barang"], existing["Nama_Barang"], existing["Satuan"], existing["Active"] = \
            nama_rs, kode, nama, satuan, True
        STORE.save()
        return {"item_id": s(existing.get("Item_Id")), "updated": True}
    new_id = next_sp_master_item_id()
    STORE.append("SP_Master", {"Kode_Barang": kode, "Nama_Barang": nama, "Satuan": satuan,
                                "Active": True, "Created_At": now_str(), "Nama_RS": nama_rs, "Item_Id": new_id})
    return {"item_id": new_id, "updated": False}


def h_setSparepartMaster(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    item_id, nama_rs = s(p.get("item_id")), s(p.get("nama_rs"))
    kode, nama, satuan = s(p.get("kode_barang")), s(p.get("nama_barang")), s(p.get("satuan"))
    if not nama_rs:
        raise ApiError("validation", "Rumah Sakit wajib dipilih.")
    if not nama:
        raise ApiError("validation", "Nama Barang wajib diisi.")
    res = upsert_sparepart_master_row(item_id, nama_rs, kode, nama, satuan)
    if res.get("error"):
        raise ApiError("not_found", res["error"])
    STORE.log(auth["username"], auth["role"], "set_sparepart_master", f"{nama_rs} - {kode or '-'} - {nama}")
    return {"message": f"Barang {nama} berhasil disimpan.", "item_id": res["item_id"]}


def h_setSparepartMasterActive(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    item_id = s(p.get("item_id"))
    row = next((r for r in STORE.rows("SP_Master") if s(r.get("Item_Id")) == item_id), None)
    if not row:
        raise ApiError("not_found", "Barang tidak ditemukan.")
    row["Active"] = bool(p.get("active"))
    STORE.save()
    nama = s(row.get("Nama_Barang"))
    STORE.log(auth["username"], auth["role"], "activate_sparepart" if p.get("active") else "deactivate_sparepart", nama)
    return {"message": f"Status barang {nama} berhasil diperbarui."}


def h_deleteSparepartMaster(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    item_id = s(p.get("item_id"))
    row = next((r for r in STORE.rows("SP_Master") if s(r.get("Item_Id")) == item_id), None)
    if not row:
        raise ApiError("not_found", "Barang tidak ditemukan.")
    nama = s(row.get("Nama_Barang"))
    STORE.delete_row("SP_Master", row)
    STORE.log(auth["username"], auth["role"], "delete_sparepart", nama)
    return {"message": f"Barang {nama} berhasil dihapus dari daftar. Histori transaksi yang sudah ada tidak ikut terhapus."}


def h_importSparepartMasterBulk(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    rows_in = p.get("rows") if isinstance(p.get("rows"), list) else []
    if not rows_in:
        raise ApiError("validation", "Tidak ada baris untuk diimpor.")

    existing_rows = STORE.rows("SP_Master")
    by_kode, by_nama = {}, {}
    max_n = 0
    for row in existing_rows:
        rs, kode, nama = norm(row.get("Nama_RS")), s(row.get("Kode_Barang")), s(row.get("Nama_Barang"))
        if kode:
            by_kode[(rs, norm(kode))] = row
        else:
            by_nama[(rs, norm(nama))] = row
        m = re.match(r"^SPM(\d+)$", s(row.get("Item_Id")))
        if m:
            max_n = max(max_n, int(m.group(1)))

    inserted = updated = skipped = 0
    new_rows = []
    for r in rows_in:
        nama_rs, nama = s(r.get("nama_rs")), s(r.get("nama_barang"))
        if not nama_rs or not nama:
            skipped += 1
            continue
        kode, satuan = s(r.get("kode_barang")), s(r.get("satuan"))
        rs_n = norm(nama_rs)
        key = (rs_n, norm(kode)) if kode else (rs_n, norm(nama))
        existing = by_kode.get(key) if kode else by_nama.get(key)
        if existing:
            existing["Nama_RS"], existing["Kode_Barang"], existing["Nama_Barang"], existing["Satuan"], existing["Active"] = \
                nama_rs, kode, nama, satuan, True
            updated += 1
        else:
            max_n += 1
            new_id = f"SPM{max_n:06d}"
            new_row = {"Kode_Barang": kode, "Nama_Barang": nama, "Satuan": satuan, "Active": True,
                       "Created_At": now_str(), "Nama_RS": nama_rs, "Item_Id": new_id}
            new_rows.append(new_row)
            if kode:
                by_kode[key] = new_row
            else:
                by_nama[key] = new_row
            inserted += 1

    if new_rows:
        existing_rows.extend(new_rows)
    STORE.save()

    STORE.log(auth["username"], auth["role"], "import_sparepart_master", f"{inserted} baru, {updated} diperbarui, {skipped} dilewati")
    msg = f"Import selesai: {inserted} barang baru, {updated} diperbarui"
    msg += f", {skipped} baris dilewati (RS/nama kosong)." if skipped else "."
    return {"message": msg, "inserted": inserted, "updated": updated, "skipped": skipped}


def h_submitSparepartRequest(p):
    nama_rs, nama_operator, tanggal = s(p.get("nama_rs")), s(p.get("nama_operator")), s(p.get("tanggal"))
    if not nama_rs:
        raise ApiError("validation", "Nama Rumah Sakit wajib dipilih.")
    if not nama_operator:
        raise ApiError("validation", "Nama Operator wajib diisi.")
    if not tanggal:
        raise ApiError("validation", "Tanggal wajib diisi.")
    items = parse_barang_items(p.get("items"), nama_rs)
    no_req = gen_doc_no("SP_Request")
    STORE.append("SP_Request", {"No_Request": no_req, "Timestamp": now_str(), "Tanggal": tanggal,
                                 "Nama_RS": nama_rs, "Nama_Operator": nama_operator, "Status": "Menunggu",
                                 "Catatan_Operator": s(p.get("catatan")), "Catatan_Teknisi": "",
                                 "Reviewed_By": "", "Reviewed_At": ""})
    for it in items:
        STORE.append("SP_Request_Items", {"No_Request": no_req, "Kode_Barang": it["kode_barang"],
                                           "Nama_Barang": it["nama_barang"], "Qty": it["qty"]})
    return {"message": f"Request barang {no_req} berhasil dikirim, menunggu persetujuan Teknisi.", "no_request": no_req}


def h_listSparepartRequests(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    status = s(p.get("status"))
    rows = STORE.rows("SP_Request")
    if status:
        rows = [r for r in rows if norm(r.get("Status")) == norm(status)]
    items = STORE.rows("SP_Request_Items")
    out = [{
        "no_request": s(r.get("No_Request")), "timestamp": r.get("Timestamp"), "tanggal": r.get("Tanggal"),
        "nama_rs": r.get("Nama_RS"), "nama_operator": r.get("Nama_Operator"), "status": r.get("Status"),
        "catatan_operator": r.get("Catatan_Operator"), "catatan_teknisi": r.get("Catatan_Teknisi"),
        "reviewed_by": r.get("Reviewed_By"), "reviewed_at": r.get("Reviewed_At"),
        "items": [{"kode_barang": it.get("Kode_Barang"), "nama_barang": it.get("Nama_Barang"), "qty": it.get("Qty")}
                  for it in items if s(it.get("No_Request")) == s(r.get("No_Request"))],
    } for r in rows]
    out.sort(key=lambda x: s(x["timestamp"]), reverse=True)
    return {"requests": out}


def h_listSparepartRequestPublic(p):
    nama_rs, nama_operator = s(p.get("nama_rs")), s(p.get("nama_operator"))
    if not nama_rs or not nama_operator:
        return {"requests": []}
    rows = [r for r in STORE.rows("SP_Request")
            if norm(r.get("Nama_RS")) == norm(nama_rs) and norm(r.get("Nama_Operator")) == norm(nama_operator)]
    items = STORE.rows("SP_Request_Items")
    out = [{
        "no_request": s(r.get("No_Request")), "tanggal": r.get("Tanggal"), "status": r.get("Status"),
        "items": [{"nama_barang": it.get("Nama_Barang"), "qty": it.get("Qty")}
                  for it in items if s(it.get("No_Request")) == s(r.get("No_Request"))],
    } for r in rows]
    out.sort(key=lambda x: s(x["tanggal"]), reverse=True)
    return {"requests": out}


def h_reviewSparepartRequest(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    no_req, approve = s(p.get("no_request")), bool(p.get("approve"))
    row = next((r for r in STORE.rows("SP_Request") if s(r.get("No_Request")) == no_req), None)
    if not row:
        raise ApiError("not_found", "Request tidak ditemukan.")
    row["Status"] = "Disetujui" if approve else "Ditolak"
    row["Catatan_Teknisi"] = s(p.get("catatan_teknisi"))
    row["Reviewed_By"], row["Reviewed_At"] = auth["username"], now_str()
    STORE.save()
    STORE.log(auth["username"], auth["role"], "approve_sp_request" if approve else "reject_sp_request", no_req)
    return {"message": f"Request {no_req} berhasil " + ("disetujui." if approve else "ditolak.")}


def h_submitSparepartUsage(p):
    nama_rs, nama_operator, tanggal = s(p.get("nama_rs")), s(p.get("nama_operator")), s(p.get("tanggal"))
    if not nama_rs:
        raise ApiError("validation", "Nama Rumah Sakit wajib dipilih.")
    if not nama_operator:
        raise ApiError("validation", "Nama Operator wajib diisi.")
    if not tanggal:
        raise ApiError("validation", "Tanggal wajib diisi.")
    items = parse_barang_items(p.get("items"), nama_rs)
    no_pk = gen_doc_no("SP_Pemakaian")
    STORE.append("SP_Pemakaian", {"No_Pemakaian": no_pk, "Timestamp": now_str(), "Tanggal": tanggal,
                                   "Nama_RS": nama_rs, "Nama_Operator": nama_operator, "Catatan": s(p.get("catatan"))})
    for it in items:
        STORE.append("SP_Pemakaian_Items", {"No_Pemakaian": no_pk, "Kode_Barang": it["kode_barang"],
                                             "Nama_Barang": it["nama_barang"], "RH_Saat_Diganti": it["rh"],
                                             "Qty": it["qty"]})
    return {"message": f"Pemakaian barang {no_pk} berhasil dicatat.", "no_pemakaian": no_pk}


def h_listSparepartPemakaian(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    items = STORE.rows("SP_Pemakaian_Items")
    out = [{
        "no_pemakaian": s(r.get("No_Pemakaian")), "timestamp": r.get("Timestamp"), "tanggal": r.get("Tanggal"),
        "nama_rs": r.get("Nama_RS"), "nama_operator": r.get("Nama_Operator"), "catatan": r.get("Catatan"),
        "items": [{"kode_barang": it.get("Kode_Barang"), "nama_barang": it.get("Nama_Barang"),
                   "rh": it.get("RH_Saat_Diganti"), "qty": it.get("Qty")}
                  for it in items if s(it.get("No_Pemakaian")) == s(r.get("No_Pemakaian"))],
    } for r in STORE.rows("SP_Pemakaian")]
    out.sort(key=lambda x: s(x["timestamp"]), reverse=True)
    return {"pemakaian": out}


def h_submitSparepartPengiriman(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi", "logistik"])
    nama_rs, tanggal_kirim = s(p.get("nama_rs")), s(p.get("tanggal_kirim"))
    penerima_nama, penerima_hp = s(p.get("penerima_nama")), s(p.get("penerima_hp"))
    nama_pengirim, jabatan_pengirim = s(p.get("nama_pengirim")), s(p.get("jabatan_pengirim"))
    if not nama_rs:
        raise ApiError("validation", "Nama Rumah Sakit wajib dipilih.")
    if not tanggal_kirim:
        raise ApiError("validation", "Tanggal Pengiriman wajib diisi.")
    if not penerima_nama:
        raise ApiError("validation", "Nama Penerima wajib diisi.")
    if not nama_pengirim:
        raise ApiError("validation", "Nama Pengirim wajib diisi.")
    if not s(p.get("foto_resi_url")):
        raise ApiError("validation", "Foto resi wajib diisi.")
    items = parse_barang_items(p.get("items"), nama_rs)
    no_permintaan = s(p.get("no_permintaan"))
    no_krm = gen_doc_no("SP_Pengiriman")
    STORE.append("SP_Pengiriman", {"No_Pengiriman": no_krm, "No_Permintaan": no_permintaan, "Timestamp": now_str(),
                                    "Tanggal_Kirim": tanggal_kirim, "Nama_RS": nama_rs,
                                    "Penerima_Nama": penerima_nama, "Penerima_HP": penerima_hp,
                                    "Foto_Resi_URL": s(p.get("foto_resi_url")), "Nama_Pengirim": nama_pengirim,
                                    "Jabatan_Pengirim": jabatan_pengirim, "Status": "Dikirim",
                                    "Submitted_By": auth["username"], "Catatan": s(p.get("catatan"))})
    for it in items:
        STORE.append("SP_Pengiriman_Items", {"No_Pengiriman": no_krm, "Kode_Barang": it["kode_barang"],
                                              "Nama_Barang": it["nama_barang"], "Qty": it["qty"]})
    STORE.log(auth["username"], auth["role"], "submit_sp_pengiriman", no_krm)
    return {"message": f"Pengiriman {no_krm} berhasil dicatat.", "no_pengiriman": no_krm}


def h_listSparepartPengiriman(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi", "logistik"])
    rows = STORE.rows("SP_Pengiriman")
    if auth["role"] == "logistik" and p.get("mine"):
        rows = [r for r in rows if norm(r.get("Submitted_By")) == norm(auth["username"])]
    items = STORE.rows("SP_Pengiriman_Items")
    penerimaan_approved_by_krm = {}
    for pr in STORE.rows("SP_Penerimaan"):
        if norm(pr.get("Status")) != "disetujui":
            continue
        penerimaan_approved_by_krm[s(pr.get("No_Pengiriman"))] = s(pr.get("Foto_Barang_URL"))
    out = [{
        "no_pengiriman": s(r.get("No_Pengiriman")), "no_permintaan": s(r.get("No_Permintaan")),
        "timestamp": r.get("Timestamp"), "tanggal_kirim": r.get("Tanggal_Kirim"), "nama_rs": r.get("Nama_RS"),
        "penerima_nama": r.get("Penerima_Nama"), "penerima_hp": r.get("Penerima_HP"),
        "foto_resi_url": r.get("Foto_Resi_URL"), "nama_pengirim": r.get("Nama_Pengirim"),
        "jabatan_pengirim": r.get("Jabatan_Pengirim"), "status": r.get("Status"), "catatan": r.get("Catatan"),
        "foto_penerimaan_url": (penerimaan_approved_by_krm.get(s(r.get("No_Pengiriman")), "")
                                 if norm(r.get("Status")) == "diterima" else ""),
        "items": [{"kode_barang": it.get("Kode_Barang"), "nama_barang": it.get("Nama_Barang"), "qty": it.get("Qty")}
                  for it in items if s(it.get("No_Pengiriman")) == s(r.get("No_Pengiriman"))],
    } for r in rows]
    out.sort(key=lambda x: s(x["timestamp"]), reverse=True)
    return {"pengiriman": out}


def h_listPengirimanTerbuka(p):
    nama_rs = s(p.get("nama_rs"))
    if not nama_rs:
        return {"pengiriman": []}
    rows = [r for r in STORE.rows("SP_Pengiriman")
            if norm(r.get("Nama_RS")) == norm(nama_rs) and norm(r.get("Status")) == "dikirim"]
    items = STORE.rows("SP_Pengiriman_Items")
    out = [{
        "no_pengiriman": s(r.get("No_Pengiriman")), "tanggal_kirim": r.get("Tanggal_Kirim"),
        "items": [{"kode_barang": it.get("Kode_Barang"), "nama_barang": it.get("Nama_Barang"), "qty": it.get("Qty")}
                  for it in items if s(it.get("No_Pengiriman")) == s(r.get("No_Pengiriman"))],
    } for r in rows]
    out.sort(key=lambda x: s(x["tanggal_kirim"]), reverse=True)
    return {"pengiriman": out}


def h_submitSparepartPenerimaan(p):
    nama_rs, nama_operator = s(p.get("nama_rs")), s(p.get("nama_operator"))
    tanggal, no_pengiriman = s(p.get("tanggal_terima")), s(p.get("no_pengiriman"))
    if not nama_rs:
        raise ApiError("validation", "Nama Rumah Sakit wajib dipilih.")
    if not nama_operator:
        raise ApiError("validation", "Nama Operator wajib diisi.")
    if not tanggal:
        raise ApiError("validation", "Tanggal Terima wajib diisi.")
    if not no_pengiriman:
        raise ApiError("validation", "No. Pengiriman wajib dipilih.")
    if not s(p.get("foto_barang_url")):
        raise ApiError("validation", "Foto barang wajib diupload.")
    krm_row = next((r for r in STORE.rows("SP_Pengiriman") if s(r.get("No_Pengiriman")) == no_pengiriman), None)
    if not krm_row:
        raise ApiError("not_found", f"Pengiriman {no_pengiriman} tidak ditemukan.")
    items = [it for it in STORE.rows("SP_Pengiriman_Items") if s(it.get("No_Pengiriman")) == no_pengiriman]
    no_tr = gen_doc_no("SP_Penerimaan")
    STORE.append("SP_Penerimaan", {"No_Penerimaan": no_tr, "No_Pengiriman": no_pengiriman, "Timestamp": now_str(),
                                    "Tanggal_Terima": tanggal, "Nama_RS": nama_rs, "Nama_Operator": nama_operator,
                                    "Foto_Barang_URL": s(p.get("foto_barang_url")), "Status": "Menunggu",
                                    "Catatan_Teknisi": "", "Reviewed_By": "", "Reviewed_At": ""})
    for it in items:
        STORE.append("SP_Penerimaan_Items", {"No_Penerimaan": no_tr, "Kode_Barang": it.get("Kode_Barang"),
                                              "Nama_Barang": it.get("Nama_Barang"), "Qty": it.get("Qty")})
    return {"message": f"Konfirmasi penerimaan {no_tr} berhasil dikirim, menunggu persetujuan Teknisi.", "no_penerimaan": no_tr}


def h_listSparepartPenerimaan(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    status = s(p.get("status"))
    rows = STORE.rows("SP_Penerimaan")
    if status:
        rows = [r for r in rows if norm(r.get("Status")) == norm(status)]
    items = STORE.rows("SP_Penerimaan_Items")
    out = [{
        "no_penerimaan": s(r.get("No_Penerimaan")), "no_pengiriman": s(r.get("No_Pengiriman")),
        "timestamp": r.get("Timestamp"), "tanggal_terima": r.get("Tanggal_Terima"), "nama_rs": r.get("Nama_RS"),
        "nama_operator": r.get("Nama_Operator"), "foto_barang_url": r.get("Foto_Barang_URL"),
        "status": r.get("Status"), "catatan_teknisi": r.get("Catatan_Teknisi"),
        "reviewed_by": r.get("Reviewed_By"), "reviewed_at": r.get("Reviewed_At"),
        "items": [{"kode_barang": it.get("Kode_Barang"), "nama_barang": it.get("Nama_Barang"), "qty": it.get("Qty")}
                  for it in items if s(it.get("No_Penerimaan")) == s(r.get("No_Penerimaan"))],
    } for r in rows]
    out.sort(key=lambda x: s(x["timestamp"]), reverse=True)
    return {"penerimaan": out}


def h_reviewSparepartPenerimaan(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    no_tr, approve = s(p.get("no_penerimaan")), bool(p.get("approve"))
    row = next((r for r in STORE.rows("SP_Penerimaan") if s(r.get("No_Penerimaan")) == no_tr), None)
    if not row:
        raise ApiError("not_found", "Penerimaan tidak ditemukan.")
    row["Status"] = "Disetujui" if approve else "Ditolak"
    row["Catatan_Teknisi"] = s(p.get("catatan_teknisi"))
    row["Reviewed_By"], row["Reviewed_At"] = auth["username"], now_str()
    if approve and s(row.get("No_Pengiriman")):
        krm_row = next((r for r in STORE.rows("SP_Pengiriman") if s(r.get("No_Pengiriman")) == s(row.get("No_Pengiriman"))), None)
        if krm_row:
            krm_row["Status"] = "Diterima"
    STORE.save()
    STORE.log(auth["username"], auth["role"], "approve_sp_penerimaan" if approve else "reject_sp_penerimaan", no_tr)
    msg = "disetujui — stok RS bertambah otomatis & status pengiriman diperbarui." if approve else "ditolak."
    return {"message": f"Penerimaan {no_tr} berhasil {msg}"}


def compute_stock_sparepart(cutoff_date=None):
    stock = {}

    def bump(rs, kode, nama, delta):
        if not rs:
            return
        key = f"{norm(rs)}|||{norm(kode) if kode else 'NONAME:' + norm(nama)}"
        entry = stock.setdefault(key, {"nama_rs": rs, "kode_barang": kode, "nama_barang": nama, "qty": 0})
        entry["qty"] += delta

    penerimaan_rs_ok = {}
    for r in STORE.rows("SP_Penerimaan"):
        if norm(r.get("Status")) != "disetujui":
            continue
        if cutoff_date and s(r.get("Tanggal_Terima")) > cutoff_date:
            continue
        penerimaan_rs_ok[s(r.get("No_Penerimaan"))] = s(r.get("Nama_RS"))
    for it in STORE.rows("SP_Penerimaan_Items"):
        rs = penerimaan_rs_ok.get(s(it.get("No_Penerimaan")))
        if not rs:
            continue
        try:
            qty = float(it.get("Qty") or 0)
        except (TypeError, ValueError):
            qty = 0
        bump(rs, s(it.get("Kode_Barang")), s(it.get("Nama_Barang")), qty)

    pemakaian_rs = {}
    for r in STORE.rows("SP_Pemakaian"):
        if cutoff_date and s(r.get("Tanggal")) > cutoff_date:
            continue
        pemakaian_rs[s(r.get("No_Pemakaian"))] = s(r.get("Nama_RS"))
    for it in STORE.rows("SP_Pemakaian_Items"):
        rs = pemakaian_rs.get(s(it.get("No_Pemakaian")))
        if not rs:
            continue
        try:
            qty = float(it.get("Qty") or 0)
        except (TypeError, ValueError):
            qty = 0
        bump(rs, s(it.get("Kode_Barang")), s(it.get("Nama_Barang")), -qty)

    for r in STORE.rows("SP_Penyesuaian"):
        if cutoff_date and s(r.get("Tanggal")) > cutoff_date:
            continue
        try:
            delta = float(r.get("Delta") or 0)
        except (TypeError, ValueError):
            delta = 0
        bump(s(r.get("Nama_RS")), s(r.get("Kode_Barang")), s(r.get("Nama_Barang")), delta)

    return stock


def compute_sparepart_usage_for_month(ym):
    usage = {}

    def bump(rs, kode, nama, delta):
        if not rs:
            return
        key = f"{norm(rs)}|||{norm(kode) if kode else 'NONAME:' + norm(nama)}"
        usage[key] = usage.get(key, 0) + delta

    pemakaian_rs_in_month = {}
    for r in STORE.rows("SP_Pemakaian"):
        tgl = s(r.get("Tanggal"))
        if not tgl or tgl[:7] != ym:
            continue
        pemakaian_rs_in_month[s(r.get("No_Pemakaian"))] = s(r.get("Nama_RS"))
    for it in STORE.rows("SP_Pemakaian_Items"):
        rs = pemakaian_rs_in_month.get(s(it.get("No_Pemakaian")))
        if not rs:
            continue
        try:
            qty = float(it.get("Qty") or 0)
        except (TypeError, ValueError):
            qty = 0
        bump(rs, s(it.get("Kode_Barang")), s(it.get("Nama_Barang")), qty)
    return usage


def compute_sparepart_dikirim_for_month(ym):
    dikirim = {}

    def bump(rs, kode, nama, delta):
        if not rs:
            return
        key = f"{norm(rs)}|||{norm(kode) if kode else 'NONAME:' + norm(nama)}"
        dikirim[key] = dikirim.get(key, 0) + delta

    pengiriman_rs_in_month = {}
    for r in STORE.rows("SP_Pengiriman"):
        if norm(r.get("Status")) != "diterima":
            continue
        tgl = s(r.get("Tanggal_Kirim"))
        if not tgl or tgl[:7] != ym:
            continue
        pengiriman_rs_in_month[s(r.get("No_Pengiriman"))] = s(r.get("Nama_RS"))
    for it in STORE.rows("SP_Pengiriman_Items"):
        rs = pengiriman_rs_in_month.get(s(it.get("No_Pengiriman")))
        if not rs:
            continue
        try:
            qty = float(it.get("Qty") or 0)
        except (TypeError, ValueError):
            qty = 0
        bump(rs, s(it.get("Kode_Barang")), s(it.get("Nama_Barang")), qty)
    return dikirim


def h_getStockSparepart(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    stock = compute_stock_sparepart()
    ym_sekarang = datetime.now().strftime("%Y-%m")
    usage = compute_sparepart_usage_for_month(ym_sekarang)
    master = [r for r in STORE.rows("SP_Master") if not (s(r.get("Active")) == "false" or r.get("Active") is False)]
    out = []
    for m in master:
        kode, nama, rs = s(m.get("Kode_Barang")), s(m.get("Nama_Barang")), s(m.get("Nama_RS"))
        key = norm(rs) + "|||" + (norm(kode) if kode else "NONAME:" + norm(nama))
        qty = stock[key]["qty"] if key in stock else 0
        out.append({"item_id": s(m.get("Item_Id")), "nama_rs": rs, "kode_barang": kode, "nama_barang": nama,
                     "qty": qty, "dipakai_bulan_ini": usage.get(key, 0)})
    if s(p.get("nama_rs")):
        out = [r for r in out if norm(r["nama_rs"]) == norm(p.get("nama_rs"))]
    out.sort(key=lambda x: (x["nama_rs"], x["nama_barang"]))
    return {"stock": out}


def h_submitSparepartPenyesuaian(p):
    auth = require_auth(p.get("token"), ["admin", "teknisi"])
    item_id = s(p.get("item_id"))
    if not item_id:
        raise ApiError("validation", "Barang wajib dipilih.")
    try:
        qty_baru = float(p.get("qty_baru"))
    except (TypeError, ValueError):
        raise ApiError("validation", "Jumlah baru harus berupa angka.")
    m = next((r for r in STORE.rows("SP_Master") if s(r.get("Item_Id")) == item_id), None)
    if not m:
        raise ApiError("not_found", "Barang tidak ditemukan di Sparepart Master.")
    nama_rs, kode, nama = s(m.get("Nama_RS")), s(m.get("Kode_Barang")), s(m.get("Nama_Barang"))
    stock = compute_stock_sparepart()
    key = norm(nama_rs) + "|||" + (norm(kode) if kode else "NONAME:" + norm(nama))
    qty_sebelum = stock[key]["qty"] if key in stock else 0
    delta = qty_baru - qty_sebelum
    no_py = gen_doc_no("SP_Penyesuaian")
    STORE.append("SP_Penyesuaian", {"No_Penyesuaian": no_py, "Timestamp": now_str(), "Tanggal": now_str()[:10],
                                     "Nama_RS": nama_rs, "Item_Id": item_id, "Kode_Barang": kode, "Nama_Barang": nama,
                                     "Qty_Sebelum": qty_sebelum, "Qty_Sesudah": qty_baru, "Delta": delta,
                                     "Catatan": s(p.get("catatan")), "Submitted_By": auth["username"]})
    STORE.log(auth["username"], auth["role"], "submit_sp_penyesuaian",
              f"{no_py} — {nama} @ {nama_rs}: {qty_sebelum} -> {qty_baru}")
    return {"message": f"Penyesuaian stok tersimpan — {nama} di {nama_rs} sekarang {qty_baru}.",
            "no_penyesuaian": no_py, "qty_baru": qty_baru}


JUNK_SHEET_NAME_RE = re.compile(r"^Sheet\d+$", re.IGNORECASE)


def _scan_junk_sheets_raw():
    expected = COLS["SP_Penyesuaian"]
    out = []
    for name, sheet in STORE.data.get("_junk_sheets", {}).items():
        if not JUNK_SHEET_NAME_RE.match(name):
            continue
        headers = sheet.get("headers", [])
        rows = sheet.get("rows", [])
        matches_schema = headers == expected
        out.append({"name": name, "data_rows": len(rows), "matches_schema": matches_schema, "rows": rows})
    return out


def h_adminScanJunkSheets(p):
    require_auth(p.get("token"), "admin")
    found = _scan_junk_sheets_raw()
    return {"sheets": [{"name": f["name"], "data_rows": f["data_rows"], "unknown_schema": not f["matches_schema"]}
                        for f in found]}


def h_adminCleanupJunkSheets(p):
    auth = require_auth(p.get("token"), "admin")
    found = _scan_junk_sheets_raw()
    to_clean = [f for f in found if f["matches_schema"]]
    skipped = [f["name"] for f in found if not f["matches_schema"]]
    deleted_count = 0
    rows_moved = 0
    headers = COLS["SP_Penyesuaian"]
    for f in to_clean:
        for row in f["rows"]:
            if not any(c not in ("", None) for c in row):
                continue
            STORE.append("SP_Penyesuaian", dict(zip(headers, row)))
            rows_moved += 1
        del STORE.data["_junk_sheets"][f["name"]]
        deleted_count += 1
    if to_clean:
        STORE.save()
    STORE.log(auth["username"], auth["role"], "cleanup_junk_sheets",
              f"{deleted_count} sheet dihapus, {rows_moved} baris dipindah ke SP_Penyesuaian"
              + (f", {len(skipped)} dilewati (schema tidak dikenal): {', '.join(skipped)}" if skipped else ""))
    msg = f"Selesai: {deleted_count} sheet sampah dihapus, {rows_moved} baris data dipindah ke SP_Penyesuaian."
    if skipped:
        msg += f" {len(skipped)} sheet dilewati (schema tidak dikenal, cek manual): {', '.join(skipped)}."
    return {"message": msg, "deleted_count": deleted_count, "rows_moved": rows_moved, "skipped_unknown_schema": skipped}


RECAP_BULAN_ABBR = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"]


def month_end_date(ym):
    y, m = int(ym[:4]), int(ym[5:7])
    last = calendar.monthrange(y, m)[1]
    return f"{ym}-{last:02d}"


def h_getSparepartRecapBulanan(p):
    require_auth(p.get("token"), ["admin", "teknisi"])
    now_ym = datetime.now().strftime("%Y-%m")
    ym = s(p.get("bulan"))
    if not re.match(r"^\d{4}-\d{2}$", ym or ""):
        ym = now_ym
    bulan = {"key": ym, "label": RECAP_BULAN_ABBR[int(ym[5:7]) - 1]}

    master = [{"nama_rs": s(r.get("Nama_RS")), "kode_barang": s(r.get("Kode_Barang")),
               "nama_barang": s(r.get("Nama_Barang")), "satuan": s(r.get("Satuan"))}
              for r in STORE.rows("SP_Master")]
    stock = compute_stock_sparepart(month_end_date(ym))
    penyesuaian = compute_sparepart_usage_for_month(ym)
    dikirim = compute_sparepart_dikirim_for_month(ym)

    def key_of(rs, kode, nama):
        return f"{norm(rs)}|||{norm(kode) if kode else 'NONAME:' + norm(nama)}"

    master.sort(key=lambda x: (x["nama_rs"], x["nama_barang"]))
    items = []
    for it in master:
        k = key_of(it["nama_rs"], it["kode_barang"], it["nama_barang"])
        entry = stock.get(k)
        items.append({"nama_rs": it["nama_rs"], "kode_barang": it["kode_barang"],
                       "nama_barang": it["nama_barang"], "satuan": it["satuan"],
                       "qty": entry["qty"] if entry else 0,
                       "penyesuaian": penyesuaian.get(k, 0), "dikirim": dikirim.get(k, 0)})
    return {"bulan": bulan, "items": items}


SP_UPLOAD_DIR = BASE_DIR / "uploads_sparepart"


def h_uploadFotoSparepart(p):
    import base64
    b64raw = s(p.get("base64"))
    if not b64raw:
        raise ApiError("validation", "Data foto kosong.")
    b64 = b64raw.split(",", 1)[1] if "," in b64raw else b64raw
    try:
        raw_bytes = base64.b64decode(b64)
    except Exception:
        raise ApiError("validation", "Data foto tidak valid (base64 gagal didekode).")
    filename = s(p.get("filename")) or f"foto-{int(datetime.now().timestamp()*1000)}.jpg"
    safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", filename)
    unique_name = f"{int(datetime.now().timestamp()*1000)}-{safe_name}"
    SP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (SP_UPLOAD_DIR / unique_name).write_bytes(raw_bytes)
    return {"url": f"/uploads_sparepart/{unique_name}", "file_id": unique_name}


HANDLERS = {
    "ping": h_ping, "accountsExist": h_accountsExist, "bootstrapAdmin": h_bootstrapAdmin,
    "login": h_login, "logout": h_logout, "confirmRsOperatorLogin": h_confirmRsOperatorLogin, "changeOwnPassword": h_changeOwnPassword,
    "submitReport": h_submitReport, "getReports": h_getReports,
    "listAccounts": h_listAccounts, "createAccount": h_createAccount,
    "setAccountActive": h_setAccountActive, "setAccountApproval": h_setAccountApproval,
    "resetPassword": h_resetPassword,
    "getActivityLog": h_getActivityLog, "snapshotBulanan": h_snapshotBulanan,
    "getMonthlySnapshots": h_getMonthlySnapshots,
    "listRumahSakit": h_listRumahSakit, "setRumahSakitAccount": h_setRumahSakitAccount,
    "setRumahSakitActive": h_setRumahSakitActive, "deleteRumahSakit": h_deleteRumahSakit,
    "getShiftsTaken": h_getShiftsTaken,
    "updateReport": h_updateReport,
    "listRsPublic": h_listRsPublic,
    "listSparepartMaster": h_listSparepartMaster,
    "listSparepartActive": h_listSparepartActive,
    "setSparepartMaster": h_setSparepartMaster,
    "setSparepartMasterActive": h_setSparepartMasterActive,
    "deleteSparepartMaster": h_deleteSparepartMaster,
    "importSparepartMasterBulk": h_importSparepartMasterBulk,
    "getSparepartRecapBulanan": h_getSparepartRecapBulanan,
    "submitSparepartRequest": h_submitSparepartRequest,
    "listSparepartRequestPublic": h_listSparepartRequestPublic,
    "submitSparepartUsage": h_submitSparepartUsage,
    "listSparepartRequests": h_listSparepartRequests,
    "reviewSparepartRequest": h_reviewSparepartRequest,
    "submitSparepartPengiriman": h_submitSparepartPengiriman,
    "listSparepartPengiriman": h_listSparepartPengiriman,
    "listPengirimanTerbuka": h_listPengirimanTerbuka,
    "submitSparepartPenerimaan": h_submitSparepartPenerimaan,
    "listSparepartPenerimaan": h_listSparepartPenerimaan,
    "reviewSparepartPenerimaan": h_reviewSparepartPenerimaan,
    "listSparepartPemakaian": h_listSparepartPemakaian,
    "getStockSparepart": h_getStockSparepart,
    "submitSparepartPenyesuaian": h_submitSparepartPenyesuaian,
    "uploadFotoSparepart": h_uploadFotoSparepart,
    "adminScanJunkSheets": h_adminScanJunkSheets,
    "adminCleanupJunkSheets": h_adminCleanupJunkSheets,
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def _send_json(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/exec", "/"+"exec"):
            action = "ping"
            return self._send_json(200, {"ok": True, "pong": datetime.now().isoformat()})
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/exec":
            return self._send_json(404, {"ok": False, "message": "Not found. Gunakan endpoint /exec"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return self._send_json(200, {"ok": False, "code": "bad_json", "message": "Data yang dikirim tidak valid."})

        migrate_roles_if_needed()
        action_type = payload.get("type", "")
        handler = HANDLERS.get(action_type)
        if not handler:
            return self._send_json(200, {"ok": False, "code": "unknown_type", "message": "Aksi tidak dikenal: " + action_type})
        try:
            result = handler(payload)
            return self._send_json(200, {"ok": True, **(result or {})})
        except ApiError as e:
            return self._send_json(200, {"ok": False, "code": e.code, "message": e.message, **e.extra})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return self._send_json(200, {"ok": False, "code": "server_error", "message": f"{type(e).__name__}: {e}"})

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


JAM_PERIODE = [("08.00 Pagi", "pagi"), ("13.00 Siang", "sore"), ("22.00 Malam", "malam")]


def seed_demo_data():
    if STORE.rows("Akun"):
        print("  (--seed dilewati: sudah ada akun tersimpan di mock_data.json)")
        return
    STORE.append("Akun", {"Username": "admin", "Password": "admin123", "Role": "admin", "Name": "Admin GPI",
                           "Active": True, "Created_At": now_str(), "Created_By": "seed", "Last_Login": "",
                           "Approval_Status": "approved"})
    STORE.append("Akun", {"Username": "teknisi1", "Password": "teknisi123", "Role": "teknisi", "Name": "Teknisi Contoh",
                           "Active": True, "Created_At": now_str(), "Created_By": "seed", "Last_Login": "",
                           "Approval_Status": "approved"})

    import random
    random.seed(7)

    DAERAH = ["Bogor, Jawa Barat", "Tangerang Selatan, Banten", "Yogyakarta, DI Yogyakarta",
              "Surabaya, Jawa Timur", "Bandung, Jawa Barat", "Semarang, Jawa Tengah",
              "Medan, Sumatera Utara", "Makassar, Sulawesi Selatan", "Denpasar, Bali",
              "Palembang, Sumatera Selatan", "Balikpapan, Kalimantan Timur", "Manado, Sulawesi Utara",
              "Pekanbaru, Riau", "Malang, Jawa Timur", "Batam, Kepulauan Riau"]
    RS = []
    for i in range(1, 16):
        nama = f"RS Contoh {i:02d}"
        uname = f"rs{i:02d}"
        operators = [f"Operator {i}A", f"Operator {i}B", f"Operator {i}C"]
        ada_wwz = i % 3 == 0
        ada_gow = i % 5 == 0
        RS.append((nama, DAERAH[(i - 1) % len(DAERAH)], uname, operators, ada_wwz, ada_gow))

    for nama, daerah, uname, operators, ada_wwz, ada_gow in RS:
        STORE.append("Rumah_Sakit", {
            "Nama_RS": nama, "Daerah_RS": daerah,
            "Operator1": operators[0], "Operator2": operators[1], "Operator3": operators[2],
            "Username": uname, "Password": uname + "123", "Active": True,
            "Updated_At": now_str(), "Updated_By": "seed",
        })

    bulan = datetime.now().strftime("%Y-%m")
    hari_ini = datetime.now().day
    for nama, daerah, uname, operators, ada_wwz, ada_gow in RS:
        running = 8000
        for hari in range(1, hari_ini + 1):
            if random.random() < 0.15:
                continue
            running += random.randint(18, 24)
            jam_label, shift = JAM_PERIODE[hari % 3]
            operator_nama = operators[hari % 3]
            ts = f"{bulan}-{hari:02d} 08:00:00"
            tgl = f"{bulan}-{hari:02d}"
            who = {"Submitted_By": uname, "Submitted_By_Name": operator_nama}
            STORE.append("Laporan_DOCS", {**{
                "Timestamp": ts, "Nama_RS": nama, "Daerah_RS": daerah, "Tanggal": tgl, "Bulan": bulan,
                "Purity_%": round(random.uniform(90.5, 95.8), 1), "Running_Hours": running,
                "Pertambahan_Running_Hours": random.randint(18, 24),
                "Pressure": round(random.uniform(3.9, 4.6), 2), "Box_Temperature": round(random.uniform(33, 42), 1),
                "XT1": round(random.uniform(0, 5), 1), "XT2": round(random.uniform(0, 5), 1),
                "XT3": round(random.uniform(0, 5), 1), "XT4": round(random.uniform(0, 5), 1),
                "RTD1": "N", "RTD2": "N", "RTD3": "N", "RTD4": "N",
                "VSA": round(random.uniform(40, 60), 1), "SCR": round(random.uniform(30, 42), 1),
                "Purity_AE1": round(random.uniform(90.5, 95.8), 1),
                "VSA_VFD": "Normal", "Scroll_VFD": "Normal", "Heat_Exchanger": "OK",
                "Flow_Avg_LPM": round(random.uniform(100, 200), 1),
                "Flow_Total_M3": round(random.uniform(2000, 5000), 1),
                "Jumlah_Produksi_Tabung_O2": random.randint(10, 40),
                "Shift": shift, "Jam_Lapor": jam_label,
            }, **who})
            if ada_wwz:
                STORE.append("Laporan_WWZ", {**{
                    "Timestamp": ts, "Nama_RS": nama, "Tanggal": tgl, "Bulan": bulan,
                    "Running_Hours": 600 + hari, "Pertambahan_Running_Hours": 1,
                    "Temp1": 40, "Temp2": 41,
                    "Press1": 9, "Press2": 11, "Press3": 12, "Jumlah_Pengisian": random.randint(3, 9),
                    "Shift": shift, "Jam_Lapor": jam_label, "Riset_RH": random.choice(["Ya", "Tidak"]),
                    "Jumlah_Produksi_Tabung_O2": random.randint(10, 40),
                }, **who})
            if ada_gow:
                STORE.append("Laporan_GOW", {**{
                    "Timestamp": ts, "Nama_RS": nama, "Tanggal": tgl, "Bulan": bulan,
                    "Running_Hours": 900 + hari, "Pertambahan_Running_Hours": 1,
                    "Temp1": 45, "Temp2": 46, "Temp3": 47, "Temp4": 48,
                    "Press_Inlet": 19, "Press1": 20, "Press2": 21, "Press3": 22, "Press4": 23,
                    "Jumlah_Pengisian": random.randint(2, 7),
                    "Shift": shift, "Jam_Lapor": jam_label, "Riset_RH": random.choice(["Ya", "Tidak"]),
                    "Jumlah_Produksi_Tabung_O2": random.randint(10, 40),
                }, **who})
    print("  Data contoh dibuat: 1 admin, 1 teknisi, 15 akun Rumah Sakit (3 operator/RS), laporan bulan berjalan.")
    print("  Login Admin       -> username: admin    password: admin123")
    print("  Login Teknisi     -> username: teknisi1 password: teknisi123")
    print("  Login Rumah Sakit -> username: rs01      password: rs01123  (operator: Operator 1A/1B/1C)")


def main():
    global STORE
    ap = argparse.ArgumentParser(description="Server uji coba lokal (mock Google Apps Script)")
    ap.add_argument("--port", type=int, default=8091)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--seed", action="store_true", help="Isi akun & data contoh untuk demo")
    ap.add_argument("--reset", action="store_true", help="Hapus semua data lokal (mock_data.json) lalu keluar")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    if args.reset:
        if DATA_FILE.exists():
            DATA_FILE.unlink()
            print("mock_data.json dihapus. Jalankan lagi tanpa --reset untuk mulai dari kosong.")
        else:
            print("Tidak ada data untuk dihapus.")
        if _ROLES_MIGRATED_FLAG.exists():
            _ROLES_MIGRATED_FLAG.unlink()
        return

    STORE = Store(DATA_FILE)
    if args.seed:
        seed_demo_data()

    port = args.port
    for _ in range(10):
        try:
            httpd = ThreadingHTTPServer((args.host, port), Handler)
            break
        except OSError:
            port += 1
    else:
        print("Tidak menemukan port bebas.")
        sys.exit(1)

    url = f"http://127.0.0.1:{port}/"
    print()
    print("  ┌───────────────────────────────────────────────────────────┐")
    print("  │  Dashboard Pelaporan Teknisi — Server Uji Coba LOKAL       │")
    print("  │  (mock Google Apps Script — belum tersambung Sheets asli)  │")
    print("  └───────────────────────────────────────────────────────────┘")
    print(f"  Buka di browser : {url}")
    print(f"  Endpoint API    : {url}exec  (otomatis dipakai dashboard secara default)")
    print(f"  Data tersimpan  : {DATA_FILE}")
    if not args.seed and not STORE.rows("Akun"):
        print("  Belum ada akun -> saat dibuka, dashboard akan minta Anda membuat akun Admin pertama.")
    print("  Hentikan server : Ctrl+C")
    print()

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server dihentikan. Data uji coba tetap ada di mock_data.json\n")


if __name__ == "__main__":
    main()
