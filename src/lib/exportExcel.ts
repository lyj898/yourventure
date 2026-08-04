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

  // Trigger the download via a Blob + anchor rather than XLSX.writeFile. writeFile relies
  // on SheetJS's internal environment detection, which fails silently in some browsers;
  // the explicit Blob URL + <a download> path is reliable across all of them.
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'indonesia-campus-directory.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
