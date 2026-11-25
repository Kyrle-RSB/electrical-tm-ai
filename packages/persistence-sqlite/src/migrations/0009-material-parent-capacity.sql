-- Preserve 0001-0008 byte-for-byte. Never repair historical quantities silently.
-- Existing invalid allocations (including SUM integer overflow) abort the upgrade;
-- LocalStore retains its verified pre-upgrade rescue and rolls back this migration.
CREATE TEMP TABLE material_capacity_upgrade_guard (
 valid INTEGER NOT NULL CHECK(valid=1)
) STRICT;
INSERT INTO material_capacity_upgrade_guard(valid)
SELECT 0 FROM purchase_lines AS line
WHERE COALESCE((SELECT SUM(quantity_mills) FROM material_dispositions WHERE line_id=line.id),0)
  > line.supplier_quantity_mills LIMIT 1;
DROP TABLE material_capacity_upgrade_guard;
-- Subtract the existing positive integer allocation sum instead of adding a new
-- quantity that might overflow SQLite INTEGER and be promoted to REAL.
DROP TRIGGER material_split_capacity_insert;
DROP TRIGGER material_split_capacity_update;
CREATE TRIGGER material_split_capacity_insert BEFORE INSERT ON material_dispositions
WHEN NEW.quantity_mills > (SELECT supplier_quantity_mills FROM purchase_lines WHERE id=NEW.line_id)
 - COALESCE((SELECT SUM(quantity_mills) FROM material_dispositions WHERE line_id=NEW.line_id),0)
BEGIN SELECT RAISE(ABORT,'Material allocations exceed supplier quantity'); END;
CREATE TRIGGER material_split_capacity_update BEFORE UPDATE ON material_dispositions
WHEN NEW.quantity_mills > (SELECT supplier_quantity_mills FROM purchase_lines WHERE id=NEW.line_id)
 - COALESCE((SELECT SUM(quantity_mills) FROM material_dispositions WHERE line_id=NEW.line_id AND id<>OLD.id),0)
BEGIN SELECT RAISE(ABORT,'Material allocations exceed supplier quantity'); END;
-- Parent updates must enforce the same conservation invariant as child writes.
CREATE TRIGGER material_parent_capacity_update BEFORE UPDATE OF supplier_quantity_mills ON purchase_lines
WHEN COALESCE((SELECT SUM(quantity_mills) FROM material_dispositions WHERE line_id=OLD.id),0)
 > NEW.supplier_quantity_mills
BEGIN SELECT RAISE(ABORT,'Material allocations exceed supplier quantity'); END;
