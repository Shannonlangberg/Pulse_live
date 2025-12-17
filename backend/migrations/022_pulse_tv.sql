-- Migration: Pulse TV Module
-- Creates tables for TV series, episodes, tags, progress tracking, and discipleship links

-- TV Series table
CREATE TABLE IF NOT EXISTS tv_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    audience VARCHAR(100),
    thumbnail_url VARCHAR(500),
    is_published BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TV Episodes table
CREATE TABLE IF NOT EXISTS tv_episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    video_url VARCHAR(500),
    duration_seconds INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT 0,
    downloadable_notes_url VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES tv_series(id) ON DELETE CASCADE
);

-- TV Tags table
CREATE TABLE IF NOT EXISTS tv_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TV Series Tags pivot table
CREATE TABLE IF NOT EXISTS tv_series_tags (
    series_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (series_id, tag_id),
    FOREIGN KEY (series_id) REFERENCES tv_series(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tv_tags(id) ON DELETE CASCADE
);

-- TV Episode Tags pivot table
CREATE TABLE IF NOT EXISTS tv_episode_tags (
    episode_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (episode_id, tag_id),
    FOREIGN KEY (episode_id) REFERENCES tv_episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tv_tags(id) ON DELETE CASCADE
);

-- TV User Episode Progress table
CREATE TABLE IF NOT EXISTS tv_user_episode_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    episode_id INTEGER NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_position_seconds INTEGER DEFAULT 0,
    completed_at DATETIME,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
    FOREIGN KEY (episode_id) REFERENCES tv_episodes(id) ON DELETE CASCADE,
    UNIQUE(person_id, episode_id)
);

-- TV Episode Discipleship Links table
CREATE TABLE IF NOT EXISTS tv_episode_discipleship_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    discipleship_step_type VARCHAR(50) NOT NULL,
    auto_complete BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES tv_episodes(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tv_episodes_series_id ON tv_episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_tv_episodes_published ON tv_episodes(is_published);
CREATE INDEX IF NOT EXISTS idx_tv_series_published ON tv_series(is_published);
CREATE INDEX IF NOT EXISTS idx_tv_progress_person_id ON tv_user_episode_progress(person_id);
CREATE INDEX IF NOT EXISTS idx_tv_progress_episode_id ON tv_user_episode_progress(episode_id);
CREATE INDEX IF NOT EXISTS idx_tv_progress_completed ON tv_user_episode_progress(completed);
CREATE INDEX IF NOT EXISTS idx_tv_discipleship_links_episode_id ON tv_episode_discipleship_links(episode_id);

