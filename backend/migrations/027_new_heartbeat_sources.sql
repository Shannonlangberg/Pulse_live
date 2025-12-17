-- Migration 027: New Heartbeat Data Sources
-- App opens, Prayer submissions tracking

-- App Sessions (track app opens for engagement)
CREATE TABLE IF NOT EXISTS app_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    session_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    platform VARCHAR(20),
    app_version VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_person ON app_sessions(person_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_date ON app_sessions(session_start);

-- Prayer Submissions
CREATE TABLE IF NOT EXISTS prayer_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50),
    email VARCHAR(200),
    name VARCHAR(200),
    submission_type VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT 0,
    is_urgent BOOLEAN DEFAULT 0,
    campus VARCHAR(100),
    source VARCHAR(50),
    prayer_link_id INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (prayer_link_id) REFERENCES prayer_links(id)
);

CREATE INDEX IF NOT EXISTS idx_prayer_submissions_person ON prayer_submissions(person_id);
CREATE INDEX IF NOT EXISTS idx_prayer_submissions_date ON prayer_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_prayer_submissions_type ON prayer_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_prayer_submissions_status ON prayer_submissions(status);

