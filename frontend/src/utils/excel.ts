import * as XLSX from 'xlsx';

/** 前端解析 Excel/CSV 为表头 + 行对象（用于快速预览）。 */
export async function readExcelRows(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  return { headers, rows: json };
}

/** 前端导出 JSON 数据为 Excel 并触发下载。 */
export function exportToExcel(data: Record<string, unknown>[], filename: string): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'sheet1');
  XLSX.writeFile(wb, filename);
}
