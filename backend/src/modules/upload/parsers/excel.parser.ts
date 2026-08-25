import * as XLSX from 'xlsx';

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * 使用 SheetJS 将 Excel/CSV 缓冲区解析为「表头数组 + 行对象数组」。
 * 所有单元格以字符串读取，便于后续统一校验。
 */
export function parseExcelBuffer(buffer: Buffer): ParsedSheet {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  const rows = json.map((r) => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(r)) {
      const v = r[k];
      out[k] = v === null || v === undefined ? '' : String(v).trim();
    }
    return out;
  });
  return { headers, rows };
}
