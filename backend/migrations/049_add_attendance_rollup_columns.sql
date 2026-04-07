-- Special / holiday services: control inclusion in YTD and dashboard rollups; optional label.
-- SQLite: BOOLEAN stored as INTEGER 0/1

ALTER TABLE attendance_records ADD COLUMN include_in_rollup_metrics INTEGER NOT NULL DEFAULT 1;
ALTER TABLE attendance_records ADD COLUMN special_service_label TEXT;

UPDATE attendance_records SET include_in_rollup_metrics = 1 WHERE include_in_rollup_metrics IS NULL;
