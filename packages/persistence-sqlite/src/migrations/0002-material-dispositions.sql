-- Additive V1 foundation migration. Retain all historical 0001 bytes/checksum.
CREATE TABLE IF NOT EXISTS business_settings (
 business_id TEXT PRIMARY KEY REFERENCES business_profiles(id) ON DELETE RESTRICT,
 trade_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
 mailing_address TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'CAD',
 tax_identifier TEXT NOT NULL DEFAULT '', electrical_license_id TEXT NOT NULL DEFAULT '',
 updated_utc TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS project_details (
 project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE RESTRICT,
 project_name TEXT NOT NULL DEFAULT '', billing_address TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planned','active','on-hold','complete','closed','archived')),
 updated_utc TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS purchase_sources (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES business_profiles(id),
 source_hash TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('po','receipt','credit','other')),
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','reviewed','rejected')),
 vendor TEXT, document_no TEXT, source_date TEXT, vault_locator TEXT NOT NULL, added_utc TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_purchase_sources_dedupe ON purchase_sources(business_id,source_hash);
CREATE TABLE IF NOT EXISTS purchase_lines (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES purchase_sources(id) ON DELETE RESTRICT,
 description TEXT NOT NULL, supplier_quantity_mills INTEGER NOT NULL CHECK(supplier_quantity_mills>0),
 net_unit_cost_cents INTEGER NOT NULL CHECK(net_unit_cost_cents>=0),
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected'))
) STRICT;
CREATE TABLE IF NOT EXISTS material_dispositions (
 id TEXT PRIMARY KEY, line_id TEXT NOT NULL REFERENCES purchase_lines(id) ON DELETE RESTRICT,
 quantity_mills INTEGER NOT NULL CHECK(quantity_mills>0),
 category TEXT NOT NULL CHECK(category IN ('project','stock','other-project','damaged','returned','warranty','nonbillable','other')),
 project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
 notes TEXT NOT NULL DEFAULT '', created_utc TEXT NOT NULL,
 CHECK ((category IN ('project','other-project') AND project_id IS NOT NULL) OR
        (category NOT IN ('project','other-project') AND project_id IS NULL))
) STRICT;
CREATE INDEX IF NOT EXISTS idx_material_split_line ON material_dispositions(line_id);
