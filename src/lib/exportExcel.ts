import * as XLSX from 'xlsx';
import type { CampusWithCount, StudentOrg } from './types';

// A student org plus its campus's display fields, for the export sheet.
export type OrgExportRow = StudentOrg & {
  campus_name: string;
  campus_city: string;
  campus_future_series_city: string | null;
};

// Client-side Excel export. Two sheets:
//   "Campuses"     — one row per visible campus (matches the table)
//   "Student Orgs" — one row per org (BEM, DPM, HIMA, UKM, …) across those campuses
// Exports exactly what's passed in — i.e. whatever is visible after search + filters.
export function exportToExcel(campuses: CampusWithCount[], orgs: OrgExportRow[]): void {
  const campusData = campuses.map((c) => ({
    Name: c.name,
    City: c.city,
    Province: c.province,
    Type: c.type,
    Ownership: c.ownership,
    'Future Series City': c.future_series_city ?? '',
    'Student Orgs': c.org_count,
    Website: c.website ?? '',
  }));

  const orgRows = [...orgs].sort(
    (a, b) =>
      a.campus_name.localeCompare(b.campus_name) ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  );
  const orgData = orgRows.map((o) => ({
    Campus: o.campus_name,
    'Campus City': o.campus_city,
    'Future Series City': o.campus_future_series_city ?? '',
    'Org Name': o.name ?? '',
    'Org Type': o.org_type,
    'Contact Type': o.contact_type ?? '',
    Contact: o.contact_value ?? '',
    Email: o.email ?? '',
    WhatsApp: o.whatsapp ?? '',
    'Contact Person': o.contact_person ?? '',
    Followers: o.follower_count ?? '',
    Notes: o.notes ?? '',
  }));

  // Student Orgs first so it's the sheet that opens by default (that's the main data);
  // Campuses second as a summary.
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(orgData),
    'Student Orgs',
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(campusData), 'Campuses');

  // Download via Blob + anchor (reliable across browsers; XLSX.writeFile fails silently
  // in some).
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
