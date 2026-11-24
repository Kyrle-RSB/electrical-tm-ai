-- Additive optional local branding reference; prior migration bytes remain unchanged.
CREATE TABLE business_logo_assets (
 business_id TEXT PRIMARY KEY REFERENCES business_profiles(id) ON DELETE RESTRICT,
 asset_id TEXT NOT NULL UNIQUE, vault_locator TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg')), updated_utc TEXT NOT NULL
) STRICT;
