CREATE TABLE IF NOT EXISTS overhead_daily (
 day TEXT PRIMARY KEY CHECK(length(day)=10 AND day GLOB '????-??-??'),
 estimate_cents INTEGER NOT NULL CHECK(estimate_cents>=0), updated_utc TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS overhead_project_days (
 day TEXT NOT NULL REFERENCES overhead_daily(day) ON DELETE RESTRICT,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 half_days INTEGER NOT NULL CHECK(half_days IN (1,2)),
 allocated_cents INTEGER NOT NULL CHECK(allocated_cents>=0),
 PRIMARY KEY(day,project_id)
) STRICT;
CREATE TABLE IF NOT EXISTS labor_rate_versions (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE RESTRICT,
 worker_id TEXT NOT NULL, effective_day TEXT NOT NULL,
 bill_hour_cents INTEGER NOT NULL CHECK(bill_hour_cents>=0),
 fully_burdened_cost_hour_cents INTEGER CHECK(fully_burdened_cost_hour_cents>=0),
 UNIQUE(business_id,worker_id,effective_day)
) STRICT;
