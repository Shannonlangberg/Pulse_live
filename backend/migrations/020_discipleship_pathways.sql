-- Migration: Create Discipleship Pathway System
-- Created: 2025-01-XX
-- Description: Tracks discipleship pathways and individual progress

-- Pathways table (template pathways like "Leadership", "Worship Leader", etc.)
CREATE TABLE IF NOT EXISTS discipleship_pathways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),  -- 'leadership', 'worship', 'ministry', 'connect_leader', 'general'
    is_active BOOLEAN DEFAULT 1,
    is_template BOOLEAN DEFAULT 0,  -- Pre-built templates
    created_by_person_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pathway Steps (milestones in a pathway)
CREATE TABLE IF NOT EXISTS discipleship_pathway_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pathway_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,  -- Order in the pathway
    step_name VARCHAR(200) NOT NULL,
    step_description TEXT,
    milestone_type VARCHAR(50),  -- Maps to DiscipleshipStep.type or custom
    is_required BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pathway_id) REFERENCES discipleship_pathways(id) ON DELETE CASCADE
);

-- Person Pathway Progress (tracks which pathway a person is on and their progress)
CREATE TABLE IF NOT EXISTS person_pathway_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id VARCHAR(50) NOT NULL,
    pathway_id INTEGER NOT NULL,
    assigned_by_person_id VARCHAR(50),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_step_id INTEGER,  -- Current step they're on
    is_active BOOLEAN DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id),
    FOREIGN KEY (pathway_id) REFERENCES discipleship_pathways(id),
    FOREIGN KEY (current_step_id) REFERENCES discipleship_pathway_steps(id)
);

-- Person Pathway Step Completion (tracks when each step was completed)
CREATE TABLE IF NOT EXISTS person_pathway_step_completion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_pathway_progress_id INTEGER NOT NULL,
    pathway_step_id INTEGER NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_by_person_id VARCHAR(50),  -- Who marked it complete (could be self or leader)
    notes TEXT,
    FOREIGN KEY (person_pathway_progress_id) REFERENCES person_pathway_progress(id) ON DELETE CASCADE,
    FOREIGN KEY (pathway_step_id) REFERENCES discipleship_pathway_steps(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pathway_steps_pathway ON discipleship_pathway_steps(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_steps_order ON discipleship_pathway_steps(pathway_id, step_order);
CREATE INDEX IF NOT EXISTS idx_person_pathway_person ON person_pathway_progress(person_id);
CREATE INDEX IF NOT EXISTS idx_person_pathway_active ON person_pathway_progress(person_id, is_active);
CREATE INDEX IF NOT EXISTS idx_step_completion_progress ON person_pathway_step_completion(person_pathway_progress_id);
CREATE INDEX IF NOT EXISTS idx_step_completion_step ON person_pathway_step_completion(pathway_step_id);






