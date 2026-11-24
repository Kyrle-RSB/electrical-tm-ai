-- Phase-1 bounded foundation probe migration only. Not complete production schema.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  checksum TEXT NOT NULL,
  installed_utc TEXT NOT NULL
) STRICT;
CREATE TABLE business_profiles (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL CHECK(length(legal_name)>0)
) STRICT;
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE RESTRICT,
  project_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL CHECK(length(customer_name)>0),
  site_address TEXT NOT NULL CHECK(length(site_address)>0),
  opened_utc TEXT NOT NULL
) STRICT;
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  occurred_utc TEXT NOT NULL
) STRICT;
