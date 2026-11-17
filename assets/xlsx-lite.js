(function (global) {
  "use strict";

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function strToBytes(str) {
    return new TextEncoder().encode(str);
  }

  function makeZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((f) => {
      const nameBytes = strToBytes(f.name);
      const data = f.data;
      const crc = crc32(data);
      const size = data.length;

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0, true);
      local.setUint16(8, 0, true);
      local.setUint16(10, 0, true);
      local.setUint16(12, 0, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);
      local.setUint32(22, size, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);

      localParts.push(new Uint8Array(local.buffer), nameBytes, data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint16(8, 0, true);
      central.setUint16(10, 0, true);
      central.setUint16(12, 0, true);
      central.setUint16(14, 0, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, size, true);
      central.setUint32(24, size, true);
      central.setUint16(28, nameBytes.length, true);
      central.setUint16(30, 0, true);
      central.setUint16(32, 0, true);
      central.setUint16(34, 0, true);
      central.setUint16(36, 0, true);
      central.setUint32(38, 0, true);
      central.setUint32(42, offset, true);

      centralParts.push(new Uint8Array(central.buffer), nameBytes);

      offset += 30 + nameBytes.length + size;
    });

    const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
    const centralOffset = offset;

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, centralOffset, true);
    end.setUint16(20, 0, true);

    const allParts = localParts.concat(centralParts, [new Uint8Array(end.buffer)]);
    const totalLen = allParts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(totalLen);
    let pos = 0;
    allParts.forEach((p) => { out.set(p, pos); pos += p.length; });
    return out;
  }

  function xmlEsc(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function colLetter(n) {
    let s = "";
    n = n + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function cellRef(row, col) {
    return colLetter(col) + (row + 1);
  }

  function isNumericValue(v) {
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "number") return isFinite(v);
    if (typeof v !== "string") return false;
    return /^-?\d+(\.\d+)?$/.test(v.trim());
  }

  const PALETTE = {
    headerFill: "1F4E78",
    headerText: "FFFFFF",
    titleText: "1F4E78",
    subtitleText: "595959",
    bandFill: "F2F6FA",
    borderColor: "BFBFBF",
  };

  function StyleBook() {
    this.fonts = [{ sz: 10, bold: false, color: null, italic: false }];
    this.fills = [{ patternType: "none" }, { patternType: "gray125" }];
    this.borders = [{ on: false }];
    this.xfs = [{ fontId: 0, fillId: 0, borderId: 0, align: null }];
    this._fontCache = new Map([[this._fontKey(this.fonts[0]), 0]]);
    this._fillCache = new Map([["none", 0], ["gray125", 1]]);
    this._borderCache = new Map([["off", 0]]);
    this._xfCache = new Map();
  }
  StyleBook.prototype._fontKey = function (f) { return [f.sz, f.bold, f.color, f.italic].join("|"); };
  StyleBook.prototype.font = function (opts) {
    opts = opts || {};
    const f = { sz: opts.sz || 10, bold: !!opts.bold, color: opts.color || null, italic: !!opts.italic };
    const key = this._fontKey(f);
    if (this._fontCache.has(key)) return this._fontCache.get(key);
    const id = this.fonts.length;
    this.fonts.push(f);
    this._fontCache.set(key, id);
    return id;
  };
  StyleBook.prototype.fill = function (color) {
    if (!color) return 0;
    const key = "rgb:" + color;
    if (this._fillCache.has(key)) return this._fillCache.get(key);
    const id = this.fills.length;
    this.fills.push({ patternType: "solid", color: color });
    this._fillCache.set(key, id);
    return id;
  };
  StyleBook.prototype.border = function (on) {
    const key = on ? "on" : "off";
    if (this._borderCache.has(key)) return this._borderCache.get(key);
    const id = this.borders.length;
    this.borders.push({ on: on });
    this._borderCache.set(key, id);
    return id;
  };
  StyleBook.prototype.xf = function (fontId, fillId, borderId, align) {
    const key = [fontId, fillId, borderId, align || ""].join("|");
    if (this._xfCache.has(key)) return this._xfCache.get(key);
    const id = this.xfs.length;
    this.xfs.push({ fontId: fontId, fillId: fillId, borderId: borderId, align: align || null });
    this._xfCache.set(key, id);
    return id;
  };
  StyleBook.prototype.resolveCellXf = function (sheet, r, c) {
    const isTitle = (sheet.titleRows || []).indexOf(r) !== -1;
    const isSubtitle = (sheet.subtitleRows || []).indexOf(r) !== -1;
    const isHeader = (sheet.headerRows || []).indexOf(r) !== -1;
    const legacyBold = (sheet.boldRows || []).indexOf(r) !== -1 ||
      (sheet.bold || []).some(([br, bc]) => br === r && bc === c);
    const hasBorder = sheet.borderFrom !== undefined && sheet.borderFrom !== null && r >= sheet.borderFrom;
    const isBanded = sheet.bandedFrom !== undefined && sheet.bandedFrom !== null &&
      r >= sheet.bandedFrom && (r - sheet.bandedFrom) % 2 === 1;
    const rightAlign = (sheet.rightAlignCols || []).indexOf(c) !== -1;

    let fontId, fillId = 0, align = null;
    if (isTitle) {
      fontId = this.font({ sz: 15, bold: true, color: PALETTE.titleText });
    } else if (isSubtitle) {
      fontId = this.font({ sz: 10, italic: true, color: PALETTE.subtitleText });
    } else if (isHeader) {
      fontId = this.font({ sz: 10, bold: true, color: PALETTE.headerText });
      fillId = this.fill(PALETTE.headerFill);
      align = "center";
    } else {
      fontId = this.font({ sz: 10, bold: legacyBold });
      if (isBanded) fillId = this.fill(PALETTE.bandFill);
      if (rightAlign) align = "right";
    }
    const borderId = this.border(hasBorder);
    return this.xf(fontId, fillId, borderId, align);
  };
  StyleBook.prototype.toXml = function () {
    const fontsXml = this.fonts.map((f) => {
      let x = "<font>";
      x += `<sz val="${f.sz}"/>`;
      if (f.bold) x += "<b/>";
      if (f.italic) x += "<i/>";
      x += `<name val="Calibri"/>`;
      if (f.color) x += `<color rgb="FF${f.color}"/>`;
      x += "</font>";
      return x;
    }).join("");
    const fillsXml = this.fills.map((f) => {
      if (f.patternType === "solid") return `<fill><patternFill patternType="solid"><fgColor rgb="FF${f.color}"/><bgColor indexed="64"/></patternFill></fill>`;
      return `<fill><patternFill patternType="${f.patternType}"/></fill>`;
    }).join("");
    const bordersXml = this.borders.map((b) => {
      if (!b.on) return "<border><left/><right/><top/><bottom/><diagonal/></border>";
      const side = `<color rgb="FF${PALETTE.borderColor}"/>`;
      return `<border><left style="thin">${side}</left><right style="thin">${side}</right>` +
        `<top style="thin">${side}</top><bottom style="thin">${side}</bottom><diagonal/></border>`;
    }).join("");
    const xfsXml = this.xfs.map((x) => {
      const alignXml = x.align ? `<alignment horizontal="${x.align}" vertical="center"/>` : "";
      const applyAlign = x.align ? ' applyAlignment="1"' : "";
      return `<xf numFmtId="0" fontId="${x.fontId}" fillId="${x.fillId}" borderId="${x.borderId}" xfId="0" applyFont="1" applyFill="${x.fillId ? 1 : 0}" applyBorder="${x.borderId ? 1 : 0}"${applyAlign}>${alignXml}</xf>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<fonts count="${this.fonts.length}">${fontsXml}</fonts>` +
      `<fills count="${this.fills.length}">${fillsXml}</fills>` +
      `<borders count="${this.borders.length}">${bordersXml}</borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${xfsXml}</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`;
  };

  function buildSheetXml(sheet, styleBook) {
    const aoa = sheet.aoa || [];

    let colsXml = "";
    if (sheet.colWidths && sheet.colWidths.length) {
      colsXml = "<cols>" + sheet.colWidths.map((w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>";
    }

    let rowsXml = "";
    aoa.forEach((rowArr, r) => {
      let cellsXml = "";
      rowArr.forEach((val, c) => {
        if (val === null || val === undefined || val === "") return;
        const ref = cellRef(r, c);
        const sIdx = styleBook.resolveCellXf(sheet, r, c);
        const styleAttr = sIdx ? ` s="${sIdx}"` : "";
        if (isNumericValue(val)) {
          cellsXml += `<c r="${ref}"${styleAttr}><v>${Number(val)}</v></c>`;
        } else {
          cellsXml += `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${xmlEsc(val)}</t></is></c>`;
        }
      });
      if (cellsXml) rowsXml += `<row r="${r + 1}">${cellsXml}</row>`;
    });

    let mergeXml = "";
    if (sheet.merges && sheet.merges.length) {
      mergeXml = `<mergeCells count="${sheet.merges.length}">` +
        sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("") + "</mergeCells>";
    }

    let freezeXml = "";
    if (sheet.freeze) {
      const [fc, fr] = sheet.freeze;
      const topLeft = cellRef(fr, fc);
      freezeXml = `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${fc}" ySplit="${fr}" topLeftCell="${topLeft}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`;
    }

    let autofilterXml = "";
    if (sheet.autofilter) {
      autofilterXml = `<autoFilter ref="${sheet.autofilter}"/>`;
    }

    let dimensionXml = "";
    if (aoa.length) {
      let maxCol = 0;
      aoa.forEach((rowArr) => { if (rowArr.length > maxCol) maxCol = rowArr.length; });
      if (maxCol > 0) {
        dimensionXml = `<dimension ref="A1:${cellRef(aoa.length - 1, maxCol - 1)}"/>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      dimensionXml + freezeXml + colsXml +
      `<sheetData>${rowsXml}</sheetData>` +
      autofilterXml +
      mergeXml +
      `</worksheet>`;
  }

  function buildWorkbook(sheets) {
    const files = [];
    const styleBook = new StyleBook();

    sheets.forEach((sheet) => {
      (sheet.aoa || []).forEach((rowArr, r) => {
        rowArr.forEach((val, c) => {
          if (val === null || val === undefined || val === "") return;
          styleBook.resolveCellXf(sheet, r, c);
        });
      });
    });

    files.push({ name: "[Content_Types].xml", data: strToBytes(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `</Types>`) });

    files.push({ name: "_rels/.rels", data: strToBytes(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`) });

    files.push({ name: "xl/workbook.xml", data: strToBytes(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>` + sheets.map((s, i) => `<sheet name="${xmlEsc(s.name || ("Sheet" + (i + 1)))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + `</sheets>` +
      `</workbook>`) });

    files.push({ name: "xl/_rels/workbook.xml.rels", data: strToBytes(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`) });

    files.push({ name: "xl/styles.xml", data: strToBytes(styleBook.toXml()) });

    sheets.forEach((s, i) => {
      files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: strToBytes(buildSheetXml(s, styleBook)) });
    });

    return makeZip(files);
  }

  function download(filename, sheets) {
    const bytes = buildWorkbook(sheets);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  global.XlsxLite = { download: download, buildWorkbook: buildWorkbook, colLetter: colLetter, cellRef: cellRef };
})(window);
