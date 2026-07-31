import type { Row } from 'exceljs';

// Shared cell styling for the Finance Report Excel exports (finance-reports-admin,
// finance-report), so both components produce visually consistent workbooks.

export const CURRENCY_FMT = '"₱"#,##0.00';

const BORDER = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };

export function styleSectionRow(row: Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
}

export function styleColumnHeaderRow(row: Row): void {
  row.font = { bold: true, color: { argb: 'FF111827' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  row.border = { bottom: BORDER };
}

export function styleTotalsRow(row: Row): void {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  row.border = { top: BORDER };
}

export function styleGridRow(row: Row, striped: boolean): void {
  row.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  if (striped) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
}

export function currencyCell(row: Row, col: number): void {
  row.getCell(col).numFmt = CURRENCY_FMT;
}
