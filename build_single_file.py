#!/usr/bin/env python3
import base64
import mimetypes
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INDEX_HTML = ROOT / "index.html"
STYLES_CSS = ROOT / "assets" / "styles.css"
XLSX_LITE_JS = ROOT / "assets" / "xlsx-lite.js"
APP_JS = ROOT / "assets" / "app.js"
LOGO_PNG = ROOT / "assets" / "img" / "logo-gpi.png"
LOGO_DARK_PNG = ROOT / "assets" / "img" / "logo-gpi-dark.png"
FAVICON_PNG = ROOT / "assets" / "img" / "favicon-gpi.png"
OUTPUT_HTML = ROOT / "Dashboard_Teknisi_GPI.html"


def read_text(path):
    if not path.exists():
        sys.exit(f"ERROR: file tidak ditemukan: {path}")
    return path.read_text(encoding="utf-8")


def data_uri(path):
    if not path.exists():
        sys.exit(f"ERROR: file tidak ditemukan: {path}")
    mime, _ = mimetypes.guess_type(str(path))
    mime = mime or "application/octet-stream"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def main():
    html = read_text(INDEX_HTML)
    styles_css = read_text(STYLES_CSS)
    xlsx_lite_js = read_text(XLSX_LITE_JS)
    app_js = read_text(APP_JS)
    logo_uri = data_uri(LOGO_PNG)
    logo_dark_uri = data_uri(LOGO_DARK_PNG)
    favicon_uri = data_uri(FAVICON_PNG)

    stylesheet_pattern = re.compile(
        r'<link\s+rel="stylesheet"\s+href="assets/styles\.css"\s*/?>', re.IGNORECASE
    )
    n, html = _sub_count(stylesheet_pattern, f"<style>\n{styles_css}\n</style>", html)
    if n != 1:
        sys.exit(f"ERROR: diharapkan tepat 1 <link rel=\"stylesheet\" href=\"assets/styles.css\">, ditemukan {n}.")

    scripts_pattern = re.compile(
        r'<script\s+src="assets/xlsx-lite\.js"\s*></script>\s*'
        r'<script\s+src="assets/app\.js"\s*></script>',
        re.IGNORECASE,
    )
    combined_script = (
        "<script>\n"
        "/* ===== assets/xlsx-lite.js (inline, dibundel oleh build_single_file.py) ===== */\n"
        f"{xlsx_lite_js}\n"
        "/* ===== assets/app.js (inline, dibundel oleh build_single_file.py) ===== */\n"
        f"{app_js}\n"
        "</script>"
    )
    n, html = _sub_count(scripts_pattern, combined_script, html)
    if n != 1:
        sys.exit(
            "ERROR: diharapkan tepat 1 pasangan <script src=\"assets/xlsx-lite.js\">"
            "+<script src=\"assets/app.js\"> berurutan, ditemukan pola cocok: " + str(n)
        )

    logo_pattern = re.compile(r'src="assets/img/logo-gpi\.png"')
    n, html = _sub_count(logo_pattern, f'src="{logo_uri}"', html)
    if n < 1:
        sys.exit("ERROR: tidak ada src=\"assets/img/logo-gpi.png\" ditemukan di index.html.")

    logo_dark_pattern = re.compile(r'src="assets/img/logo-gpi-dark\.png"')
    n, html = _sub_count(logo_dark_pattern, f'src="{logo_dark_uri}"', html)
    if n < 1:
        sys.exit("ERROR: tidak ada src=\"assets/img/logo-gpi-dark.png\" ditemukan di index.html.")

    favicon_pattern = re.compile(r'href="assets/img/favicon-gpi\.png"')
    n, html = _sub_count(favicon_pattern, f'href="{favicon_uri}"', html)
    if n != 1:
        sys.exit(f"ERROR: diharapkan tepat 1 href=\"assets/img/favicon-gpi.png\", ditemukan {n}.")

    leftover = re.findall(r'(?:src|href)="assets/[^"]*"', html)
    if leftover:
        sys.exit(f"ERROR: masih ada referensi ke assets/ yang belum ter-inline: {leftover}")

    OUTPUT_HTML.write_text(html, encoding="utf-8")
    size_kb = OUTPUT_HTML.stat().st_size / 1024
    print(f"OK: {OUTPUT_HTML.name} berhasil dibuat ({size_kb:.1f} KB, {html.count(chr(10)) + 1} baris).")


def _sub_count(pattern, repl, text):
    result, n = pattern.subn(lambda m: repl, text)
    return n, result


if __name__ == "__main__":
    main()
