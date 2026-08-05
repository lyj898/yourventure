-- Add dedicated email + WhatsApp columns to student_orgs.
-- Orgs already carry a single primary contact (usually Instagram) in
-- contact_type/contact_value; these two columns let us also record a public
-- email and WhatsApp number per org without losing the Instagram handle.

alter table student_orgs
  add column if not exists email    text,
  add column if not exists whatsapp text;
