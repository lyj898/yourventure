import * as XLSX from 'xlsx';
import type { CampusWithCount } from './types';

// Client-side Excel export. Exports exactly the rows passed in — i.e. whatever is
// currently visible in the table after search + filters — one sheet, columns matching
// the table (plus student-org count).
export function exportCampusesToExcel(rows: CampusWithCount[]): void {
  const data = rows.map((c) => ({
    Name: c.name,
    City: c.city,
    Province: c.province,
    Type: c.type,
    Ownership: c.ownership,
    'Future Series City': c.future_series_city ?? '',
    'Student Orgs': c.org_count,
    Website: c.website ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Campuses');

  // Filename is stable/simple; no timestamp (Date.* is fine in the browser, but a
  // plain name keeps re-exports tidy for the team).
  XLSX.writeFile(workbook, 'indonesia-campus-directory.xlsx');
}
