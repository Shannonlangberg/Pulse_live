-- Migration: Resource categories management tables
-- Created: 2025-11-13
-- Description: Adds database tables for configurable resource categories and manual quick links.

CREATE TABLE IF NOT EXISTS resource_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    folder_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resource_categories_order
    ON resource_categories(sort_order, display_name);

CREATE TABLE IF NOT EXISTS resource_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resource_links_category
        FOREIGN KEY (category_id)
        REFERENCES resource_categories(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_links_category
    ON resource_links(category_id, sort_order, label);

CREATE TRIGGER IF NOT EXISTS trg_resource_categories_updated_at
AFTER UPDATE ON resource_categories
BEGIN
    UPDATE resource_categories
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_resource_links_updated_at
AFTER UPDATE ON resource_links
BEGIN
    UPDATE resource_links
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;


