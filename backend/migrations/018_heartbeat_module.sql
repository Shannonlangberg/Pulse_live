-- Migration: Create Heartbeat module tables
-- Created: 2025-01-XX
-- Description: Creates all tables for the Heartbeat health tracking module

-- Heartbeat Campuses
CREATE TABLE IF NOT EXISTS heartbeat_campuses (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Heartbeat Services
CREATE TABLE IF NOT EXISTS heartbeat_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campus_id) REFERENCES heartbeat_campuses(id)
);

-- Heartbeat Attendance Events
CREATE TABLE IF NOT EXISTS heartbeat_attendance_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    service_id INTEGER NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (service_id) REFERENCES heartbeat_services(id)
);

-- Heartbeat Connect Groups
CREATE TABLE IF NOT EXISTS heartbeat_connect_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    leader_person_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    day_of_week VARCHAR(20),
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campus_id) REFERENCES heartbeat_campuses(id),
    FOREIGN KEY (leader_person_id) REFERENCES persons(id)
);

-- Heartbeat Connect Attendance
CREATE TABLE IF NOT EXISTS heartbeat_connect_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    connect_group_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (connect_group_id) REFERENCES heartbeat_connect_groups(id)
);

-- Heartbeat Teams
CREATE TABLE IF NOT EXISTS heartbeat_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campus_id) REFERENCES heartbeat_campuses(id)
);

-- Heartbeat Serving Assignments
CREATE TABLE IF NOT EXISTS heartbeat_serving_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    team_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    role VARCHAR(200),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (team_id) REFERENCES heartbeat_teams(id),
    FOREIGN KEY (service_id) REFERENCES heartbeat_services(id)
);

-- Heartbeat Giving Summaries
CREATE TABLE IF NOT EXISTS heartbeat_giving_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    pattern_score REAL DEFAULT 0.0,
    last_gift_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

-- Heartbeat Discipleship Steps
CREATE TABLE IF NOT EXISTS heartbeat_discipleship_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    created_by_person_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (created_by_person_id) REFERENCES persons(id)
);

-- Heartbeat Care Cases
CREATE TABLE IF NOT EXISTS heartbeat_care_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    summary VARCHAR(500),
    details TEXT,
    created_by_person_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (created_by_person_id) REFERENCES persons(id)
);

-- Heartbeat Care Touchpoints
CREATE TABLE IF NOT EXISTS heartbeat_care_touchpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    care_case_id INTEGER NOT NULL,
    person_id VARCHAR(50) NOT NULL,
    contacted_by_person_id VARCHAR(50) NOT NULL,
    method VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (care_case_id) REFERENCES heartbeat_care_cases(id),
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (contacted_by_person_id) REFERENCES persons(id)
);

-- Heartbeat Snapshots
CREATE TABLE IF NOT EXISTS heartbeat_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    campus_id VARCHAR(50) NOT NULL,
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gather_score REAL NOT NULL,
    engagement_score REAL NOT NULL,
    spiritual_score REAL NOT NULL,
    care_score REAL NOT NULL,
    total_score REAL NOT NULL,
    status VARCHAR(20) NOT NULL,
    risk_reasons TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (campus_id) REFERENCES heartbeat_campuses(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_events_person ON heartbeat_attendance_events(person_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_service ON heartbeat_attendance_events(service_id);
CREATE INDEX IF NOT EXISTS idx_connect_attendance_person ON heartbeat_connect_attendance(person_id);
CREATE INDEX IF NOT EXISTS idx_connect_attendance_group ON heartbeat_connect_attendance(connect_group_id);
CREATE INDEX IF NOT EXISTS idx_serving_assignments_person ON heartbeat_serving_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_person ON heartbeat_snapshots(person_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_campus ON heartbeat_snapshots(campus_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_status ON heartbeat_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_care_cases_person ON heartbeat_care_cases(person_id);
CREATE INDEX IF NOT EXISTS idx_care_cases_status ON heartbeat_care_cases(status);






