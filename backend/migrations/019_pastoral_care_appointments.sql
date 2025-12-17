-- Migration: Pastoral Care Appointments
-- Creates table for scheduling catch-ups and pastoral care sessions

CREATE TABLE IF NOT EXISTS pastoral_care_appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    pastor_id TEXT,
    care_case_id INTEGER,
    
    -- Appointment details
    title TEXT NOT NULL,
    description TEXT,
    appointment_type TEXT DEFAULT 'catch_up',
    scheduled_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    location TEXT,
    location_details TEXT,
    
    -- Status and tracking
    status TEXT DEFAULT 'scheduled',
    requested_by_person_id TEXT,
    created_by_person_id TEXT,
    
    -- Notifications
    person_notified BOOLEAN DEFAULT 0,
    pastor_notified BOOLEAN DEFAULT 0,
    reminder_sent BOOLEAN DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    -- Notes
    notes TEXT,
    follow_up_notes TEXT,
    
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (pastor_id) REFERENCES persons(id),
    FOREIGN KEY (care_case_id) REFERENCES heartbeat_care_cases(id),
    FOREIGN KEY (requested_by_person_id) REFERENCES persons(id),
    FOREIGN KEY (created_by_person_id) REFERENCES persons(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_person ON pastoral_care_appointments(person_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pastor ON pastoral_care_appointments(pastor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON pastoral_care_appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON pastoral_care_appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_care_case ON pastoral_care_appointments(care_case_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_appointments_timestamp 
AFTER UPDATE ON pastoral_care_appointments
BEGIN
    UPDATE pastoral_care_appointments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;


