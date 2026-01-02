# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, date
import json
import logging

db = SQLAlchemy()
logger = logging.getLogger(__name__)

class Person(db.Model):
    """Person model for church members"""
    __tablename__ = 'persons'
    
    id = db.Column(db.String(50), primary_key=True)
    full_name = db.Column(db.String(200), nullable=False)
    preferred_name = db.Column(db.String(100))
    email = db.Column(db.String(200), nullable=True)
    phone = db.Column(db.String(50))
    campus = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(50))  # Kids, Youth, Young Adults, Families, Adults, Seniors
    connect_group = db.Column(db.String(200))
    dream_team_roles = db.Column(db.Text)  # JSON array stored as text
    birthday = db.Column(db.Date)
    pastoral_notes = db.Column(db.Text)
    tags = db.Column(db.Text)  # JSON array stored as text
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Discipleship milestones
    dna_completed = db.Column(db.Date)
    baptised_on = db.Column(db.Date)
    filled_holy_spirit = db.Column(db.Date)
    rise_attended = db.Column(db.Date)
    first_served_on = db.Column(db.Date)
    
    # Family and new Christian tracking (columns may not exist in older databases)
    # These are accessed via getattr() in to_dict() to handle gracefully
    family_id = db.Column(db.String(50), nullable=True)  # For family grouping
    is_new_christian = db.Column(db.Boolean, default=False, nullable=True)
    new_christian_date = db.Column(db.Date, nullable=True)  # Date of decision (may differ from baptism)
    follow_up_status = db.Column(db.String(50), nullable=True)  # 'contacted', 'connected', 'joined_events', 'needed'
    service_attended = db.Column(db.String(100), nullable=True)  # Service time attended
    # New person tracking (for manually flagging visitors)
    is_new_person = db.Column(db.Boolean, default=False, nullable=True)
    new_person_date = db.Column(db.Date, nullable=True)  # Date of first visit (may differ from created_at)
    
    # Relationship to engagement profile
    engagement_profile = db.relationship('EngagementProfile', backref='person', uselist=False, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert person to dictionary"""
        try:
            dream_team_roles = json.loads(self.dream_team_roles) if self.dream_team_roles else []
        except (TypeError, ValueError, json.JSONDecodeError):
            dream_team_roles = []
        
        try:
            tags = json.loads(self.tags) if self.tags else []
        except (TypeError, ValueError, json.JSONDecodeError):
            tags = []
        
        def safe_date_serialize(date_val):
            """Safely serialize a date/datetime that might already be a string"""
            if date_val is None:
                return None
            if isinstance(date_val, str):
                return date_val  # Already a string
            return date_val.isoformat()  # Convert date/datetime to string
        
        # Use getattr for all fields to handle cases where Person object is created from raw SQL
        # or when columns don't exist yet (before migration runs)
        return {
            'id': getattr(self, 'id', None),
            'full_name': getattr(self, 'full_name', ''),
            'preferred_name': getattr(self, 'preferred_name', None),
            'email': getattr(self, 'email', None),
            'phone': getattr(self, 'phone', None),
            'campus': getattr(self, 'campus', None),
            'department': getattr(self, 'department', None),
            'connect_group': getattr(self, 'connect_group', None),
            'dream_team_roles': dream_team_roles,
            'birthday': safe_date_serialize(getattr(self, 'birthday', None)),
            'pastoral_notes': getattr(self, 'pastoral_notes', None),
            'tags': tags,
            'is_active': getattr(self, 'is_active', True),
            'created_at': safe_date_serialize(getattr(self, 'created_at', None)),
            'updated_at': safe_date_serialize(getattr(self, 'updated_at', None)),
            'dna_completed': safe_date_serialize(getattr(self, 'dna_completed', None)),
            'baptised_on': safe_date_serialize(getattr(self, 'baptised_on', None)),
            'filled_holy_spirit': safe_date_serialize(getattr(self, 'filled_holy_spirit', None)),
            'rise_attended': safe_date_serialize(getattr(self, 'rise_attended', None)),
            'first_served_on': safe_date_serialize(getattr(self, 'first_served_on', None)),
            # New fields - use getattr with defaults in case migration hasn't run yet
            'family_id': getattr(self, 'family_id', None),
            'is_new_christian': getattr(self, 'is_new_christian', False),
            'new_christian_date': safe_date_serialize(getattr(self, 'new_christian_date', None)),
            'follow_up_status': getattr(self, 'follow_up_status', None),
            'service_attended': getattr(self, 'service_attended', None),
            'is_new_person': getattr(self, 'is_new_person', False),
            'new_person_date': safe_date_serialize(getattr(self, 'new_person_date', None)),
        }


class PastoralCareCase(db.Model):
    """Pastoral care case tracking"""
    __tablename__ = 'pastoral_care_cases'
    
    id = db.Column(db.String(50), primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    priority = db.Column(db.String(20), default='medium')  # high, medium, low
    status = db.Column(db.String(20), default='open')  # open, resolved, closed
    notes = db.Column(db.Text)
    assigned_leader = db.Column(db.String(200))
    follow_up_date = db.Column(db.Date)
    ai_summary = db.Column(db.Text)
    suggested_responses = db.Column(db.Text)  # JSON array stored as text
    family_dependencies = db.Column(db.Text)  # JSON array stored as text
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship
    person = db.relationship('Person', backref='pastoral_care_cases')
    
    def to_dict(self, include_leader_name=True):
        """Convert case to dictionary"""
        try:
            suggested_responses = json.loads(self.suggested_responses) if self.suggested_responses else []
        except (TypeError, ValueError, json.JSONDecodeError):
            suggested_responses = []
        
        try:
            family_dependencies = json.loads(self.family_dependencies) if self.family_dependencies else []
        except (TypeError, ValueError, json.JSONDecodeError):
            family_dependencies = []
        
        def safe_date_serialize(date_val):
            if date_val is None:
                return None
            if isinstance(date_val, str):
                return date_val
            return date_val.isoformat()
        
        # Look up assigned leader name if we have an ID
        assigned_leader_name = None
        if include_leader_name and self.assigned_leader:
            try:
                from sqlalchemy import text
                # Query users table directly (it's a plain table, not a model)
                result = db.session.execute(
                    text("SELECT full_name FROM users WHERE id = :user_id OR CAST(id AS TEXT) = :user_id_str"),
                    {'user_id': self.assigned_leader, 'user_id_str': str(self.assigned_leader)}
                ).fetchone()
                if result:
                    assigned_leader_name = result[0]
            except Exception as e:
                logger.warning(f"Could not look up assigned leader name for ID {self.assigned_leader}: {e}")
        
        # Get person's campus
        person_campus = None
        if self.person:
            person_campus = self.person.campus
        
        return {
            'id': self.id,
            'person_id': self.person_id,
            'person_name': self.person.preferred_name or self.person.full_name if self.person else 'Unknown',
            'campus': person_campus,  # Include person's campus for filtering
            'priority': self.priority,
            'status': self.status,
            'notes': self.notes,
            'assigned_leader': self.assigned_leader,
            'assigned_leader_name': assigned_leader_name or self.assigned_leader if self.assigned_leader else None,
            'follow_up_date': safe_date_serialize(self.follow_up_date),
            'ai_summary': self.ai_summary,
            'suggested_responses': suggested_responses,
            'family_dependencies': family_dependencies,
            'created_at': safe_date_serialize(self.created_at),
            'updated_at': safe_date_serialize(self.updated_at)
        }


# TypeDecorator to handle SQLite datetime strings that SQLAlchemy can't parse for DATE columns
from sqlalchemy import TypeDecorator, Date

class FlexibleDate(TypeDecorator):
    """Custom Date type that handles SQLite datetime strings"""
    impl = Date
    cache_ok = True
    
    def process_result_value(self, value, dialect):
        """Process value when reading from database"""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            # Handle SQLite datetime format: '2025-11-19 00:00:00.000000'
            try:
                # Try ISO format first
                return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
            except ValueError:
                # Try SQLite datetime format
                try:
                    return datetime.strptime(value.split('.')[0], '%Y-%m-%d %H:%M:%S').date()
                except ValueError:
                    # Try just date format
                    try:
                        return datetime.strptime(value.split(' ')[0], '%Y-%m-%d').date()
                    except ValueError:
                        # If all parsing fails, log and return None
                        logger.warning(f"Could not parse date string: {value}")
                        return None
        return value
    
    def process_bind_param(self, value, dialect):
        """Process value when writing to database"""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            # Try to parse string dates
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
            except ValueError:
                try:
                    return datetime.strptime(value.split('.')[0], '%Y-%m-%d %H:%M:%S').date()
                except ValueError:
                    try:
                        return datetime.strptime(value.split(' ')[0], '%Y-%m-%d').date()
                    except ValueError:
                        logger.warning(f"Could not parse date string for binding: {value}")
                        return None
        return value


class EngagementProfile(db.Model):
    """Engagement profile tracking for persons"""
    __tablename__ = 'engagement_profiles'
    
    # Note: Database uses person_id as PRIMARY KEY (no separate id column)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), primary_key=True, nullable=False)
    
    @property
    def id(self):
        """Alias for person_id to maintain compatibility with code that expects .id"""
        return self.person_id
    
    # Summary pulse
    pulse_status = db.Column(db.String(20), default='green')  # green, amber, red
    last_seen = db.Column(FlexibleDate)  # Note: DB uses DATE not DATETIME, but SQLite may store as datetime string
    # Note: pulse_last_calculated column removed - not in actual database schema
    # Note: created_at column removed - not in actual database schema
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Raw logs (JSON columns as per actual DB schema)
    attendance_log = db.Column(db.Text, nullable=False, default='[]')  # JSON array
    serving_log = db.Column(db.Text, nullable=False, default='[]')     # JSON array
    # Note: email_engagement and social_engagement columns removed - not in actual database schema
    
    # Note: The actual DB only has: attendance_log, serving_log
    # milestones_log, created_at, email_engagement, social_engagement do NOT exist
    
    @property
    def milestones_log(self):
        """Property to access milestones - use serving_log as storage since milestones_log doesn't exist"""
        return self.serving_log
    
    @milestones_log.setter
    def milestones_log(self, value):
        """Setter for milestones - store in serving_log"""
        self.serving_log = value
    
    @property
    def email_engagement(self):
        """Property to access email_engagement - return empty array since column doesn't exist"""
        return '[]'
    
    @email_engagement.setter
    def email_engagement(self, value):
        """Setter for email_engagement - no-op since column doesn't exist"""
        pass
    
    @property
    def social_engagement(self):
        """Property to access social_engagement - return empty array since column doesn't exist"""
        return '[]'
    
    @social_engagement.setter
    def social_engagement(self, value):
        """Setter for social_engagement - no-op since column doesn't exist"""
        pass
    
    # Derived metrics (simple v1)
    attendance_frequency = db.Column(db.Float, default=0.0)
    serving_frequency = db.Column(db.Float, default=0.0)
    overall_engagement = db.Column(db.Float, default=0.0)
    
    def _load_json(self, value):
        """Helper to load JSON from text field"""
        return json.loads(value) if value else []
    
    def _dump_json(self, value):
        """Helper to dump JSON to text field"""
        return json.dumps(value or [])
    
    def add_attendance(self, zones, campus, attendance_time=None):
        """Add attendance record and recalculate heartbeat"""
        if attendance_time is None:
            attendance_time = datetime.utcnow()
        
        attendance_log = self._load_json(self.attendance_log)
        attendance_log.append({
            'timestamp': attendance_time.isoformat(),
            'zones': zones,
            'campus': campus
        })
        self.attendance_log = self._dump_json(attendance_log)
        self.last_seen = attendance_time
        self.recalculate_heartbeat()
    
    def add_bible_reading(self, reading_date=None):
        """Add Bible reading record to milestones_log"""
        if reading_date is None:
            reading_date = datetime.utcnow().date()
        elif isinstance(reading_date, str):
            reading_date = datetime.fromisoformat(reading_date).date()
        
        milestones_log = self._load_json(self.milestones_log or '[]')
        milestones_log.append({
            'type': 'bible_reading',
            'date': reading_date.isoformat()
        })
        self.milestones_log = self._dump_json(milestones_log)
        self.recalculate_heartbeat()
    
    def add_giving(self, amount, giving_date=None, campus=None):
        """Add giving record to milestones_log"""
        if giving_date is None:
            giving_date = datetime.utcnow().date()
        elif isinstance(giving_date, str):
            giving_date = datetime.fromisoformat(giving_date).date()
        
        milestones_log = self._load_json(self.milestones_log or '[]')
        milestones_log.append({
            'type': 'giving',
            'date': giving_date.isoformat(),
            'amount': float(amount),
            'campus': campus
        })
        self.milestones_log = self._dump_json(milestones_log)
        self.recalculate_heartbeat()
    
    def add_serving_record(self, role, campus, serving_date=None, location=None):
        """Add serving activity record"""
        if serving_date is None:
            serving_date = datetime.utcnow().date()
        elif isinstance(serving_date, str):
            serving_date = datetime.fromisoformat(serving_date).date()
        
        serving_log = self._load_json(self.serving_log)
        serving_log.append({
            'date': serving_date.isoformat(),
            'role': role,
            'campus': campus,
            'location': location
        })
        self.serving_log = self._dump_json(serving_log)
        self.recalculate_heartbeat()
    
    def add_email_engagement(self, campaign_type, engagement_type, engagement_date=None):
        """Add email engagement record (open, click, reply) to milestones_log"""
        if engagement_date is None:
            engagement_date = datetime.utcnow().date()
        elif isinstance(engagement_date, str):
            engagement_date = datetime.fromisoformat(engagement_date).date()
        
        milestones_log = self._load_json(self.milestones_log or '[]')
        milestones_log.append({
            'type': 'email_engagement',
            'subtype': engagement_type,  # 'open', 'click', 'reply'
            'campaign_type': campaign_type,
            'date': engagement_date.isoformat()
        })
        self.milestones_log = self._dump_json(milestones_log)
        # Update last_seen for engagement activity
        if engagement_date > (self.last_seen or datetime.min.date()):
            self.last_seen = engagement_date
        self.recalculate_heartbeat()
    
    def add_sms_engagement(self, campaign_type, engagement_type, engagement_date=None):
        """Add SMS engagement record (delivered, read, reply) to milestones_log"""
        if engagement_date is None:
            engagement_date = datetime.utcnow().date()
        elif isinstance(engagement_date, str):
            engagement_date = datetime.fromisoformat(engagement_date).date()
        
        milestones_log = self._load_json(self.milestones_log or '[]')
        milestones_log.append({
            'type': 'sms_engagement',
            'subtype': engagement_type,  # 'delivered', 'read', 'reply'
            'campaign_type': campaign_type,
            'date': engagement_date.isoformat()
        })
        self.milestones_log = self._dump_json(milestones_log)
        # Update last_seen for engagement activity
        if engagement_date > (self.last_seen or datetime.min.date()):
            self.last_seen = engagement_date
        self.recalculate_heartbeat()
    
    def add_group_attendance(self, group_id, attendance_date=None, present=True):
        """Add connect group attendance record"""
        import logging
        logger = logging.getLogger(__name__)
        
        if attendance_date is None:
            attendance_date = datetime.utcnow().date()
        elif isinstance(attendance_date, str):
            attendance_date = datetime.fromisoformat(attendance_date).date()
        elif isinstance(attendance_date, datetime):
            attendance_date = attendance_date.date()
        
        logger.info(f"add_group_attendance called - person_id: {self.person_id}, group_id: {group_id}, date: {attendance_date}, present: {present}")
        
        # Handle date comparison - last_seen is a DATE column, attendance_date is already a date
        last_seen_date = self.last_seen
        if isinstance(last_seen_date, datetime):
            last_seen_date = last_seen_date.date()
        
        # attendance_date is already a date object from the conversion above
        if not self.last_seen or attendance_date > last_seen_date:
            old_last_seen = self.last_seen
            # Store as date (not datetime) to match column type
            self.last_seen = attendance_date
            logger.info(f"Updated last_seen from {old_last_seen} to {self.last_seen}")
        
        # Get group attendance from milestones_log
        milestones_log = self._load_json(self.milestones_log or '[]')
        group_log = [log for log in milestones_log if log.get('type') == 'group_attendance']
        logger.info(f"Current group_attendance_log has {len(group_log)} entries")
        
        # Check for duplicate entries (same group_id and date)
        existing_entry = None
        date_iso = attendance_date.isoformat()
        for entry in group_log:
            entry_date = entry.get('date')
            entry_group_id = entry.get('group_id')
            if entry_group_id == group_id and entry_date == date_iso:
                existing_entry = entry
                logger.info(f"Found existing entry for group {group_id} on {date_iso}")
                break
        
        if existing_entry:
            # Update existing entry
            existing_entry['present'] = present
            logger.info(f"Updated existing entry: {existing_entry}")
        else:
            # Add new entry
            new_entry = {
                'group_id': group_id,
                'date': date_iso,
                'present': present
            }
            group_log.append(new_entry)
            logger.info(f"Added new entry: {new_entry}")
        
        # Save to milestones_log
        all_milestones = self._load_json(self.milestones_log or '[]')
        # Remove old group attendance entries
        all_milestones = [m for m in all_milestones if m.get('type') != 'group_attendance']
        # Add new group attendance entries
        all_milestones.extend(group_log)
        self.milestones_log = self._dump_json(all_milestones)
        logger.info(f"Group attendance log now has {len(group_log)} entries")
        
        # Recalculate heartbeat (wrap in try/catch to prevent failures)
        try:
            old_engagement = self.overall_engagement
            old_pulse = self.pulse_status
            self.recalculate_heartbeat()
            logger.info(f"Heartbeat recalculated - engagement: {old_engagement} -> {self.overall_engagement}, pulse: {old_pulse} -> {self.pulse_status}")
        except Exception as e:
            logger.error(f"Error recalculating heartbeat for person {self.person_id}: {e}", exc_info=True)
            # Don't fail the attendance update if heartbeat recalculation fails
    
    def recalculate_heartbeat(self):
        """
        Recalculate heartbeat metrics and pulse_status.
        Enhanced version with all 5 engagement factors and weighted scoring.
        """
        now = datetime.utcnow()
        now_date = now.date()  # Use date for comparisons with last_seen (DATE column)
        eight_weeks_ago = now - timedelta(days=56)
        
        # 1. ATTENDANCE (30% weight)
        attendance_log = self._load_json(self.attendance_log)
        recent_attendance = [
            r for r in attendance_log
            if 'timestamp' in r and (now - datetime.fromisoformat(r['timestamp'])).days <= 56
        ]
        services_last_8_weeks = len(recent_attendance)
        max_services = 8
        attendance_freq = min(services_last_8_weeks / max_services, 1.0) if max_services > 0 else 0.0
        attendance_score = attendance_freq * 100.0
        self.attendance_frequency = attendance_freq
        
        # Update last_seen if we have recent attendance (from service attendance or group attendance)
        latest_activity = None
        
        if recent_attendance:
            latest_attendance = max(
                [datetime.fromisoformat(r['timestamp']) for r in recent_attendance if 'timestamp' in r],
                default=None
            )
            if latest_attendance:
                latest_activity = latest_attendance
        
        # Also check group attendance for last_seen
        milestones_log_all = self._load_json(self.milestones_log or '[]')
        group_log = [log for log in milestones_log_all if log.get('type') == 'group_attendance']
        if group_log:
            recent_group_dates = []
            for r in group_log:
                if r.get('present', True) and 'date' in r:
                    date_str = r['date']
                    try:
                        if isinstance(date_str, str):
                            # Parse ISO date string and convert to datetime
                            date_obj = datetime.fromisoformat(date_str).date()
                            group_datetime = datetime.combine(date_obj, datetime.min.time())
                        else:
                            # Already a date object
                            group_datetime = datetime.combine(date_str, datetime.min.time())
                        recent_group_dates.append(group_datetime)
                    except (ValueError, TypeError):
                        continue
            if recent_group_dates:
                latest_group = max(recent_group_dates)
                if not latest_activity or latest_group > latest_activity:
                    latest_activity = latest_group
        
        if latest_activity:
            # last_seen is a DATE column, so store only the date part
            if isinstance(latest_activity, datetime):
                self.last_seen = latest_activity.date()
            else:
                self.last_seen = latest_activity
        
        # Calculate days since last seen - convert to date if needed
        if self.last_seen:
            if isinstance(self.last_seen, datetime):
                last_seen_date = self.last_seen.date()
            else:
                last_seen_date = self.last_seen
            days_since_last_seen = (now.date() - last_seen_date).days
        else:
            days_since_last_seen = None
        
        # 2. BIBLE READING (25% weight)
        # Target: Daily reading = 56 days in 8 weeks
        milestones_log = self._load_json(self.milestones_log or '[]')
        bible_log = [m for m in milestones_log if m.get('type') == 'bible_reading']
        recent_bible = [
            r for r in bible_log
            if 'date' in r and datetime.fromisoformat(r['date']).date() >= eight_weeks_ago.date()
        ]
        bible_freq = min(len(recent_bible) / 56, 1.0)  # Daily target
        bible_score = bible_freq * 100.0
        
        # 3. GIVING (15% weight)
        # Target: Weekly giving = 8 times in 8 weeks
        giving_log = [m for m in milestones_log if m.get('type') == 'giving']
        recent_giving = [
            r for r in giving_log
            if 'date' in r and datetime.fromisoformat(r['date']).date() >= eight_weeks_ago.date()
        ]
        giving_freq = min(len(recent_giving) / 8, 1.0)  # Weekly target
        giving_score = giving_freq * 100.0
        
        # 4. SERVING (15% weight)
        # Target: Weekly serving = 8 times in 8 weeks
        serving_log = self._load_json(self.serving_log)
        recent_serving = [
            r for r in serving_log
            if 'date' in r and datetime.fromisoformat(r['date']).date() >= eight_weeks_ago.date()
        ]
        serving_freq = min(len(recent_serving) / 8, 1.0)  # Weekly target
        serving_score = serving_freq * 100.0
        self.serving_frequency = serving_freq
        
        # 5. CONNECT GROUPS (15% weight)
        # Target: Weekly attendance = 8 meetings in 8 weeks
        import logging
        logger = logging.getLogger(__name__)
        
        group_log = [m for m in milestones_log if m.get('type') == 'group_attendance']
        logger.info(f"Recalculating heartbeat for person {self.person_id} - group_log has {len(group_log)} entries")
        logger.info(f"Group log entries: {group_log}")
        logger.info(f"Eight weeks ago date: {eight_weeks_ago.date()}")
        
        recent_groups = []
        for r in group_log:
            if 'date' in r and r.get('present', True):
                try:
                    entry_date = datetime.fromisoformat(r['date']).date()
                    if entry_date >= eight_weeks_ago.date():
                        recent_groups.append(r)
                        logger.info(f"Found recent group attendance: {r}")
                except (ValueError, TypeError) as e:
                    logger.warning(f"Error parsing group attendance date {r.get('date')}: {e}")
                    continue
        
        logger.info(f"Recent groups count: {len(recent_groups)}")
        group_freq = min(len(recent_groups) / 8, 1.0)  # Weekly target
        group_score = group_freq * 100.0
        logger.info(f"Group frequency: {group_freq}, Group score: {group_score}")
        
        # Weighted overall engagement score
        weights = {
            'attendance': 0.30,  # 30%
            'bible': 0.25,      # 25%
            'giving': 0.15,     # 15%
            'serving': 0.15,    # 15%
            'groups': 0.15       # 15%
        }
        
        self.overall_engagement = (
            attendance_score * weights['attendance'] +
            bible_score * weights['bible'] +
            giving_score * weights['giving'] +
            serving_score * weights['serving'] +
            group_score * weights['groups']
        )
        
        # Pulse status determination
        # Consider both overall engagement and recency
        if not self.last_seen:
            self.pulse_status = 'red'
        elif days_since_last_seen <= 14:
            # Recent activity - check engagement level
            if self.overall_engagement >= 70:
                self.pulse_status = 'green'
            elif self.overall_engagement >= 40:
                self.pulse_status = 'amber'
            else:
                self.pulse_status = 'red'
        elif days_since_last_seen <= 28:
            # 2-4 weeks - amber unless very high engagement
            if self.overall_engagement >= 80:
                self.pulse_status = 'green'
            else:
                self.pulse_status = 'amber'
        else:
            # >4 weeks - red unless exceptional engagement
            if self.overall_engagement >= 90:
                self.pulse_status = 'amber'
            else:
                self.pulse_status = 'red'
    
    def get_pulse_reasons(self):
        """Explain current pulse status in human language"""
        reasons = []
        
        now = datetime.utcnow()
        eight_weeks_ago = now - timedelta(days=56)
        
        if not self.last_seen:
            reasons.append("No attendance recorded")
        else:
            # Convert last_seen (DATE) to date for comparison with now.date()
            if isinstance(self.last_seen, datetime):
                last_seen_date = self.last_seen.date()
            else:
                last_seen_date = self.last_seen
            days_since_last_seen = (now.date() - last_seen_date).days
            if days_since_last_seen <= 14:
                reasons.append(f"Attended {days_since_last_seen} days ago")
            elif days_since_last_seen <= 28:
                reasons.append(f"Last seen {days_since_last_seen} days ago (2–4 weeks)")
            else:
                reasons.append(f"Last seen {days_since_last_seen} days ago (>4 weeks)")
        
        # Engagement breakdown
        attendance_log = self._load_json(self.attendance_log)
        recent_attendance = [
            r for r in attendance_log
            if 'timestamp' in r and (now - datetime.fromisoformat(r['timestamp'])).days <= 56
        ]
        services_last_8_weeks = len(recent_attendance)
        reasons.append(f"Services: {services_last_8_weeks}/8 in last 8 weeks")
        
        milestones_log = self._load_json(self.milestones_log or '[]')
        bible_log = [m for m in milestones_log if m.get('type') == 'bible_reading']
        recent_bible = [
            r for r in bible_log
            if 'date' in r and datetime.fromisoformat(r['date']).date() >= eight_weeks_ago.date()
        ]
        reasons.append(f"Bible reading: {len(recent_bible)} days in last 8 weeks")
        
        giving_log = [m for m in milestones_log if m.get('type') == 'giving']
        recent_giving = [
            r for r in giving_log
            if 'date' in r and datetime.fromisoformat(r['date']).date() >= eight_weeks_ago.date()
        ]
        reasons.append(f"Giving: {len(recent_giving)} times in last 8 weeks")
        
        serving_log = self._load_json(self.serving_log or '[]')
        recent_serving = [
            r for r in serving_log
            if 'date' in r and datetime.fromisoformat(r['date']).date() >= eight_weeks_ago.date()
        ]
        reasons.append(f"Serving: {len(recent_serving)} times in last 8 weeks")
        
        group_log = [m for m in milestones_log if m.get('type') == 'group_attendance']
        recent_groups = [
            r for r in group_log
            if 'date' in r and r.get('present', True) and 
            datetime.fromisoformat(r['date']).date() >= eight_weeks_ago.date()
        ]
        reasons.append(f"Connect groups: {len(recent_groups)} meetings in last 8 weeks")
        
        reasons.append(f"Overall engagement score: {int(self.overall_engagement)}/100")
        
        return reasons
    
    def to_dict(self, recalculate=True):
        """Convert engagement profile to dictionary"""
        try:
            # Recalculate heartbeat before returning to ensure data is up to date
            if recalculate:
                self.recalculate_heartbeat()
        except Exception as e:
            # If recalculation fails, log but continue
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error recalculating heartbeat for {self.person_id}: {e}")
        
        # Parse milestones_log to extract different types
        try:
            milestones_log = self._load_json(self.milestones_log or '[]')
            bible_log = [m for m in milestones_log if m.get('type') == 'bible_reading']
            giving_log = [m for m in milestones_log if m.get('type') == 'giving']
            group_attendance_log = [m for m in milestones_log if m.get('type') == 'group_attendance']
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error parsing milestones_log for {self.person_id}: {e}")
            bible_log = []
            giving_log = []
            group_attendance_log = []
        
        # Handle last_seen - it's a DATE in DB, not DATETIME
        last_seen_str = None
        try:
            if self.last_seen:
                if isinstance(self.last_seen, datetime):
                    last_seen_str = self.last_seen.isoformat()
                elif hasattr(self.last_seen, 'isoformat'):
                    last_seen_str = self.last_seen.isoformat()
                else:
                    # It's a date object, convert to datetime for isoformat
                    last_seen_str = datetime.combine(self.last_seen, datetime.min.time()).isoformat()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error formatting last_seen for {self.person_id}: {e}")
        
        # Get pulse reasons safely
        try:
            pulse_reasons = self.get_pulse_reasons()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error getting pulse reasons for {self.person_id}: {e}")
            pulse_reasons = ['Error loading engagement data']
        
        try:
            attendance_log = self._load_json(self.attendance_log or '[]')
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error parsing attendance_log for {self.person_id}: {e}")
            attendance_log = []
        
        try:
            serving_log = self._load_json(self.serving_log or '[]')
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error parsing serving_log for {self.person_id}: {e}")
            serving_log = []
        
        return {
            'id': self.person_id,  # Use person_id as id (it's the primary key)
            'person_id': self.person_id,
            'pulse_status': getattr(self, 'pulse_status', 'red'),
            'last_seen': last_seen_str,
            'attendance_log': attendance_log,
            'interaction_log': [],  # Not stored in DB
            'bible_log': bible_log,
            'giving_log': giving_log,
            'serving_log': serving_log,
            'group_attendance_log': group_attendance_log,
            'attendance_frequency': getattr(self, 'attendance_frequency', 0.0),
            'serving_frequency': getattr(self, 'serving_frequency', 0.0),
            'overall_engagement': getattr(self, 'overall_engagement', 0.0),
            'updated_at': self.updated_at.isoformat() if hasattr(self, 'updated_at') and self.updated_at else None,
            'pulse_reasons': pulse_reasons
        }


class BeaconZone(db.Model):
    """Beacon zone model for attendance tracking"""
    __tablename__ = 'beacon_zones'
    
    id = db.Column(db.Integer, primary_key=True)
    zone_name = db.Column(db.String(200), nullable=False)
    campus = db.Column(db.String(100), nullable=False)
    beacon_uuid = db.Column(db.String(100), nullable=False)
    beacon_major = db.Column(db.Integer, nullable=False)
    beacon_minor = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to schedules
    schedules = db.relationship('BeaconSchedule', backref='beacon_zone', lazy='dynamic', cascade='all, delete-orphan')
    
    @classmethod
    def find_zone(cls, uuid, major, minor):
        """Find beacon zone by UUID, major, and minor (case-insensitive UUID matching)"""
        from sqlalchemy import func
        # Normalize UUID to uppercase for case-insensitive matching
        if not uuid:
            return None
        uuid_upper = str(uuid).strip().upper()
        try:
            major_int = int(major)
            minor_int = int(minor)
        except (ValueError, TypeError):
            return None
        return cls.query.filter(
            func.upper(cls.beacon_uuid) == uuid_upper,
            cls.beacon_major == major_int,
            cls.beacon_minor == minor_int,
            cls.is_active == True
        ).first()
    
    def get_active_schedule(self, detection_time=None):
        """
        Get the active schedule for this beacon at the given time.
        Returns the schedule that matches the current day/time, or None.
        """
        if detection_time is None:
            detection_time = datetime.utcnow()
        
        day_name = detection_time.strftime('%A')  # 'Monday', 'Tuesday', etc.
        current_time = detection_time.time()
        
        # Find schedules that match
        matching_schedules = self.schedules.filter_by(is_active=True).all()
        
        for schedule in matching_schedules:
            # Check day of week
            if schedule.day_of_week and schedule.day_of_week != day_name:
                continue
            
            # Check time window
            if schedule.start_time and schedule.end_time:
                if not (schedule.start_time <= current_time <= schedule.end_time):
                    continue
            elif schedule.start_time:
                # Only start time specified - check if we're after it
                if current_time < schedule.start_time:
                    continue
            
            return schedule
        
        return None
    
    def to_dict(self):
        """Convert beacon zone to dictionary"""
        schedules_list = [s.to_dict() for s in self.schedules.filter_by(is_active=True).all()]
        return {
            'id': self.id,
            'zone_name': self.zone_name,
            'campus': self.campus,
            'beacon_uuid': self.beacon_uuid,
            'beacon_major': self.beacon_major,
            'beacon_minor': self.beacon_minor,
            'is_active': self.is_active,
            'schedules': schedules_list,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class BeaconSchedule(db.Model):
    """Schedule for beacon zones - defines when a beacon logs which event type"""
    __tablename__ = 'beacon_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    beacon_zone_id = db.Column(db.Integer, db.ForeignKey('beacon_zones.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)  # 'sunday', 'youth', 'prayer_night', 'kids', etc.
    day_of_week = db.Column(db.String(20))  # 'Sunday', 'Monday', 'Friday', etc. (NULL = any day)
    start_time = db.Column(db.Time)  # e.g., '19:00:00' for 7 PM
    end_time = db.Column(db.Time)  # e.g., '22:00:00' for 10 PM
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert schedule to dictionary"""
        return {
            'id': self.id,
            'beacon_zone_id': self.beacon_zone_id,
            'event_type': self.event_type,
            'day_of_week': self.day_of_week,
            'start_time': self.start_time.strftime('%H:%M:%S') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M:%S') if self.end_time else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class DiscipleshipPathway(db.Model):
    """Discipleship pathway template (e.g., Leadership, Worship Leader, etc.)"""
    __tablename__ = 'discipleship_pathways'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50))  # 'leadership', 'worship', 'ministry', 'connect_leader', 'general'
    is_active = db.Column(db.Boolean, default=True)
    is_template = db.Column(db.Boolean, default=False)  # Pre-built templates
    created_by_person_id = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    steps = db.relationship('PathwayStep', backref='pathway', lazy='dynamic', order_by='PathwayStep.step_order', cascade='all, delete-orphan')
    person_progress = db.relationship('PersonPathwayProgress', backref='pathway', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert pathway to dictionary"""
        # Try to load steps - handle gracefully if step_actions column doesn't exist yet
        try:
            steps_list = [s.to_dict() for s in self.steps.order_by(PathwayStep.step_order).all()]
        except Exception as e:
            # If column doesn't exist (e.g., step_actions), try loading without it
            error_str = str(e).lower()
            if 'no such column' in error_str or 'step_actions' in error_str:
                # Column doesn't exist yet - load steps manually without step_actions
                try:
                    # Query steps without step_actions column
                    steps_list = []
                    from sqlalchemy import text
                    raw_steps = db.session.execute(
                        text('''
                            SELECT id, pathway_id, step_order, step_name, step_description, 
                                   milestone_type, is_required, created_at
                            FROM discipleship_pathway_steps 
                            WHERE pathway_id = :pathway_id
                            ORDER BY step_order
                        '''),
                        {'pathway_id': self.id}
                    ).fetchall()
                    
                    for row in raw_steps:
                        # Handle created_at - might be date object or string
                        created_at = row[7]
                        if created_at:
                            if isinstance(created_at, str):
                                # Already a string, use as-is (might be ISO format or SQLite format)
                                created_at_str = created_at
                            elif hasattr(created_at, 'isoformat'):
                                created_at_str = created_at.isoformat()
                            else:
                                created_at_str = str(created_at)
                        else:
                            created_at_str = None
                        
                        steps_list.append({
                            'id': row[0],
                            'pathway_id': row[1],
                            'step_order': row[2],
                            'step_name': row[3],
                            'step_description': row[4],
                            'milestone_type': row[5],
                            'is_required': bool(row[6]),
                            'step_actions': [],  # Default to empty array
                            'created_at': created_at_str
                        })
                except Exception as e2:
                    logger.error(f"Error loading steps manually: {e2}")
                    steps_list = []
            else:
                # Different error - re-raise
                raise
        
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'is_active': self.is_active,
            'is_template': self.is_template,
            'created_by_person_id': self.created_by_person_id,
            'steps': steps_list,
            'step_count': len(steps_list),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class PathwayStep(db.Model):
    """Individual step/milestone in a pathway"""
    __tablename__ = 'discipleship_pathway_steps'
    
    id = db.Column(db.Integer, primary_key=True)
    pathway_id = db.Column(db.Integer, db.ForeignKey('discipleship_pathways.id'), nullable=False)
    step_order = db.Column(db.Integer, nullable=False)  # Order in pathway (1, 2, 3...)
    step_name = db.Column(db.String(200), nullable=False)
    step_description = db.Column(db.Text)
    milestone_type = db.Column(db.String(50))  # Maps to DiscipleshipStep.type or custom
    is_required = db.Column(db.Boolean, default=True)
    step_actions = db.Column(db.Text, default='[]')  # JSON array of actions/tasks for this step
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    completions = db.relationship('PersonPathwayStepCompletion', backref='pathway_step', lazy='dynamic')
    
    def get_actions(self):
        """Get step actions as list"""
        try:
            # Handle case where column doesn't exist yet (before migration)
            if not hasattr(self, 'step_actions') or self.step_actions is None:
                return []
            return json.loads(self.step_actions) if self.step_actions else []
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
        except AttributeError:
            # Column doesn't exist in database yet
            return []
    
    def set_actions(self, actions_list):
        """Set step actions from list"""
        try:
            self.step_actions = json.dumps(actions_list) if actions_list else '[]'
        except AttributeError:
            # Column doesn't exist in database yet - ignore for now
            pass
    
    def to_dict(self):
        """Convert step to dictionary"""
        result = {
            'id': self.id,
            'pathway_id': self.pathway_id,
            'step_order': self.step_order,
            'step_name': self.step_name,
            'step_description': self.step_description,
            'milestone_type': self.milestone_type,
            'is_required': self.is_required,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        # Only include step_actions if column exists
        try:
            result['step_actions'] = self.get_actions()  # Return as list, not JSON string
        except (AttributeError, KeyError):
            # Column doesn't exist yet - default to empty list
            result['step_actions'] = []
        return result


class PersonPathwayProgress(db.Model):
    """Tracks a person's progress through a pathway"""
    __tablename__ = 'person_pathway_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    pathway_id = db.Column(db.Integer, db.ForeignKey('discipleship_pathways.id'), nullable=False)
    assigned_by_person_id = db.Column(db.String(50))
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    current_step_id = db.Column(db.Integer, db.ForeignKey('discipleship_pathway_steps.id'))
    is_active = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    person = db.relationship('Person', backref='pathway_progress')
    current_step = db.relationship('PathwayStep', foreign_keys=[current_step_id])
    step_completions = db.relationship('PersonPathwayStepCompletion', backref='person_pathway_progress', lazy='dynamic', cascade='all, delete-orphan')
    
    def get_progress_percentage(self):
        """Calculate progress percentage"""
        if not self.pathway:
            return 0
        
        # Handle missing step_actions column
        try:
            total_steps = self.pathway.steps.count()
        except Exception as e:
            error_str = str(e).lower()
            if 'no such column' in error_str and 'step_actions' in error_str:
                # Column doesn't exist - count manually without step_actions
                try:
                    from sqlalchemy import text
                    result = db.session.execute(
                        text('''
                            SELECT COUNT(*) 
                            FROM discipleship_pathway_steps 
                            WHERE pathway_id = :pathway_id
                        '''),
                        {'pathway_id': self.pathway_id}
                    ).scalar()
                    total_steps = result or 0
                except Exception as e2:
                    logger.warning(f"Error counting steps manually in get_progress_percentage: {e2}")
                    total_steps = 0
            else:
                logger.warning(f"Error counting pathway steps in get_progress_percentage: {e}")
                total_steps = 0
        
        if total_steps == 0:
            return 0
        
        completed_steps = self.step_completions.count()
        return round((completed_steps / total_steps) * 100, 1)
    
    def get_next_step(self):
        """Get the next uncompleted step - intelligently skips steps that should be considered complete"""
        if not self.pathway:
            return None
        
        completed_step_ids = [c.pathway_step_id for c in self.step_completions.all()]
        
        # Handle missing step_actions column gracefully
        try:
            all_steps = self.pathway.steps.order_by(PathwayStep.step_order).all()
        except Exception as e:
            error_str = str(e).lower()
            if 'no such column' in error_str and 'step_actions' in error_str:
                # Column doesn't exist - load steps manually without step_actions
                try:
                    from sqlalchemy import text
                    raw_steps = db.session.execute(
                        text('''
                            SELECT id, pathway_id, step_order, step_name, step_description, 
                                   milestone_type, is_required, created_at
                            FROM discipleship_pathway_steps 
                            WHERE pathway_id = :pathway_id
                            ORDER BY step_order
                        '''),
                        {'pathway_id': self.pathway.id}
                    ).fetchall()
                    
                    # Create minimal step objects
                    class MinimalStep:
                        def __init__(self, row):
                            self.id = row[0]
                            self.pathway_id = row[1]
                            self.step_order = row[2]
                            self.step_name = row[3]
                            self.step_description = row[4]
                            self.milestone_type = row[5]
                            self.is_required = bool(row[6])
                            self.created_at = row[7]

                        def to_dict(self):
                            # Handle created_at - might be string or datetime
                            created_at_str = None
                            if self.created_at:
                                if isinstance(self.created_at, str):
                                    created_at_str = self.created_at
                                else:
                                    created_at_str = self.created_at.isoformat() if hasattr(self.created_at, 'isoformat') else str(self.created_at)
                            
                            return {
                                'id': self.id,
                                'step_order': self.step_order,
                                'step_name': self.step_name,
                                'step_description': self.step_description,
                                'milestone_type': self.milestone_type,
                                'is_required': self.is_required,
                                'step_actions': [],
                                'created_at': created_at_str
                            }
                    
                    all_steps = [MinimalStep(row) for row in raw_steps]
                except Exception as e2:
                    logger.warning(f"Error loading steps manually: {e2}")
                    all_steps = []
            else:
                # Different error - re-raise
                raise
        
        # If no steps completed, return first step
        if not completed_step_ids:
            return all_steps[0] if all_steps else None
        
        # Find the highest order number of completed steps
        completed_orders = [
            step.step_order 
            for step in all_steps 
            if step.id in completed_step_ids
        ]
        
        if completed_orders:
            highest_completed_order = max(completed_orders)
            # Find the next uncompleted step after the highest completed step
            for step in all_steps:
                if step.id not in completed_step_ids and step.step_order > highest_completed_order:
                    return step
        
        # If we got here, either all steps are complete, or we should still check for earlier uncompleted steps
        # But only if they haven't completed any steps (to avoid showing step 1 when they've done steps 2,3,4)
        if completed_orders:
            # They've completed steps but there are no steps after their highest completed
            # This means they've completed everything, or we're at the end
            return None
        
        # Fallback: return first uncompleted step
        for step in all_steps:
            if step.id not in completed_step_ids:
                return step
        
        return None  # All steps completed
    
    def _get_current_step_dict(self):
        """Safely get current_step dictionary, handling missing step_actions column"""
        if not self.current_step_id:
            return None
        
        try:
            if self.current_step:
                return self.current_step.to_dict()
        except Exception as e:
            error_str = str(e).lower()
            if 'no such column' in error_str and 'step_actions' in error_str:
                # Column doesn't exist - load step manually without step_actions
                try:
                    from sqlalchemy import text
                    raw_step = db.session.execute(
                        text('''
                            SELECT id, pathway_id, step_order, step_name, step_description, 
                                   milestone_type, is_required, created_at
                            FROM discipleship_pathway_steps 
                            WHERE id = :step_id
                        '''),
                        {'step_id': self.current_step_id}
                    ).fetchone()
                    
                    if raw_step:
                        # Create minimal step dict
                        # Handle created_at - might be string or datetime
                        created_at_str = None
                        if raw_step[7]:
                            if isinstance(raw_step[7], str):
                                created_at_str = raw_step[7]
                            else:
                                created_at_str = raw_step[7].isoformat() if hasattr(raw_step[7], 'isoformat') else str(raw_step[7])
                        
                        return {
                            'id': raw_step[0],
                            'pathway_id': raw_step[1],
                            'step_order': raw_step[2],
                            'step_name': raw_step[3],
                            'step_description': raw_step[4],
                            'milestone_type': raw_step[5],
                            'is_required': bool(raw_step[6]),
                            'step_actions': [],
                            'created_at': created_at_str
                        }
                except Exception as e2:
                    logger.warning(f"Error loading current step manually in to_dict: {e2}")
                    return None
            else:
                logger.warning(f"Error accessing current_step in to_dict: {e}")
                return None
        
        return None
    
    def _safe_count_steps(self):
        """Safely count pathway steps, handling missing step_actions column"""
        if not self.pathway:
            return 0
        
        try:
            return self.pathway.steps.count()
        except Exception as e:
            error_str = str(e).lower()
            if 'no such column' in error_str and 'step_actions' in error_str:
                # Column doesn't exist - count manually
                try:
                    from sqlalchemy import text
                    result = db.session.execute(
                        text('''
                            SELECT COUNT(*) 
                            FROM discipleship_pathway_steps 
                            WHERE pathway_id = :pathway_id
                        '''),
                        {'pathway_id': self.pathway_id}
                    ).scalar()
                    return result or 0
                except Exception as e2:
                    logger.warning(f"Error counting steps manually in _safe_count_steps: {e2}")
                    return 0
            else:
                logger.warning(f"Error counting pathway steps in _safe_count_steps: {e}")
                return 0
    
    def to_dict(self):
        """Convert progress to dictionary"""
        next_step = self.get_next_step()
        completed_step_ids = [c.pathway_step_id for c in self.step_completions.all()]
        
        # Include full pathway with steps
        pathway_dict = None
        if self.pathway:
            # Create a mapping of step_id to completion date
            completion_map = {
                c.pathway_step_id: c.completed_at.isoformat() if c.completed_at else None
                for c in self.step_completions.all()
            }
            
            # Handle missing step_actions column when loading pathway steps
            try:
                pathway_steps = self.pathway.steps.order_by(PathwayStep.step_order).all()
            except Exception as e:
                error_str = str(e).lower()
                if 'no such column' in error_str and 'step_actions' in error_str:
                    # Column doesn't exist - load steps manually without step_actions
                    try:
                        from sqlalchemy import text
                        raw_steps = db.session.execute(
                            text('''
                                SELECT id, pathway_id, step_order, step_name, step_description, 
                                       milestone_type, is_required, created_at
                                FROM discipleship_pathway_steps 
                                WHERE pathway_id = :pathway_id
                                ORDER BY step_order
                            '''),
                            {'pathway_id': self.pathway.id}
                        ).fetchall()
                        
                        # Create minimal step objects
                        class MinimalStep:
                            def __init__(self, row):
                                self.id = row[0]
                                self.pathway_id = row[1]
                                self.step_order = row[2]
                                self.step_name = row[3]
                                self.step_description = row[4]
                                self.milestone_type = row[5]
                                self.is_required = bool(row[6])
                                self.created_at = row[7]

                            def to_dict(self):
                                # Handle created_at - might be string or datetime
                                created_at_str = None
                                if self.created_at:
                                    if isinstance(self.created_at, str):
                                        created_at_str = self.created_at
                                    else:
                                        created_at_str = (
                                            self.created_at.isoformat()
                                            if hasattr(self.created_at, 'isoformat')
                                            else str(self.created_at)
                                        )
                                
                                return {
                                    'id': self.id,
                                    'step_order': self.step_order,
                                    'step_name': self.step_name,
                                    'step_description': self.step_description,
                                    'milestone_type': self.milestone_type,
                                    'is_required': self.is_required,
                                    'step_actions': [],
                                    'created_at': created_at_str
                                }
                        
                        pathway_steps = [MinimalStep(row) for row in raw_steps]
                    except Exception as e2:
                        logger.warning(f"Error loading pathway steps manually in to_dict: {e2}")
                        pathway_steps = []
                else:
                    # Different error - re-raise
                    raise
            
            pathway_dict = {
                'id': self.pathway.id,
                'name': self.pathway.name,
                'description': self.pathway.description,
                'category': self.pathway.category,
                'steps': [
                    {
                        **step.to_dict(),
                        'is_completed': step.id in completed_step_ids,
                        'completed_at': completion_map.get(step.id)
                    }
                    for step in pathway_steps
                ]
            }
        
        return {
            'id': self.id,
            'person_id': self.person_id,
            'pathway_id': self.pathway_id,
            'pathway_name': self.pathway.name if self.pathway else None,
            'pathway': pathway_dict,  # Full pathway with steps
            'assigned_by_person_id': self.assigned_by_person_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'current_step_id': self.current_step_id,
            'current_step': self._get_current_step_dict(),
            'next_step': next_step.to_dict() if next_step else None,
            'is_active': self.is_active,
            'notes': self.notes,
            'progress_percentage': self.get_progress_percentage(),
            'completed_steps': self.step_completions.count(),
            'total_steps': self._safe_count_steps(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class PersonPathwayStepCompletion(db.Model):
    """Tracks when a person completed a specific pathway step"""
    __tablename__ = 'person_pathway_step_completion'
    
    id = db.Column(db.Integer, primary_key=True)
    person_pathway_progress_id = db.Column(db.Integer, db.ForeignKey('person_pathway_progress.id'), nullable=False)
    pathway_step_id = db.Column(db.Integer, db.ForeignKey('discipleship_pathway_steps.id'), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    completed_by_person_id = db.Column(db.String(50))  # Who marked it complete
    notes = db.Column(db.Text)
    
    def to_dict(self):
        """Convert completion to dictionary"""
        return {
            'id': self.id,
            'person_pathway_progress_id': self.person_pathway_progress_id,
            'pathway_step_id': self.pathway_step_id,
            'step_name': self.pathway_step.step_name if self.pathway_step else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'completed_by_person_id': self.completed_by_person_id,
            'notes': self.notes
        }


class ConnectGroup(db.Model):
    """Connect Group model"""
    __tablename__ = 'connect_groups'
    
    id = db.Column(db.String(50), primary_key=True)  # e.g., "cg_copper_coast_1"
    name = db.Column(db.String(200), nullable=False)  # e.g., "Copper Coast Young Adults"
    campus = db.Column(db.String(100), nullable=False)
    leader_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    co_leader_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=True)
    
    # Meeting schedule
    meeting_day = db.Column(db.String(20))  # "Monday", "Tuesday", etc.
    meeting_time = db.Column(db.String(20))  # "7:00 PM"
    meeting_frequency = db.Column(db.String(20), default='weekly')  # weekly, bi-weekly, monthly
    location = db.Column(db.String(200))  # Address or location name
    
    # Leader access (simple password for leader portal)
    leader_access_code = db.Column(db.String(50))  # Simple password for leader login
    leader_emails = db.Column(db.Text)  # JSON array of additional leader emails
    
    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    leader = db.relationship('Person', foreign_keys=[leader_id], backref='led_groups')
    co_leader = db.relationship('Person', foreign_keys=[co_leader_id], backref='co_led_groups')
    
    def get_members(self):
        """Get all active members of this group (matches by ID or name), including leaders"""
        from sqlalchemy import text
        import logging
        logger = logging.getLogger(__name__)
        
        all_members = []
        
        # ALWAYS include the leader(s) first
        if self.leader_id:
            leader = Person.query.filter_by(id=self.leader_id, is_active=True).first()
            if leader:
                all_members.append(leader)
                logger.info(f"Added leader {leader.full_name} to group {self.id} members")
        
        if self.co_leader_id:
            co_leader = Person.query.filter_by(id=self.co_leader_id, is_active=True).first()
            if co_leader and co_leader not in all_members:
                all_members.append(co_leader)
                logger.info(f"Added co-leader {co_leader.full_name} to group {self.id} members")
        
        # Then try by ID (exact match)
        members_by_id = Person.query.filter_by(connect_group=self.id, is_active=True).all()
        if members_by_id:
            logger.info(f"Found {len(members_by_id)} members by ID for group {self.id}")
            for m in members_by_id:
                if m not in all_members:
                    all_members.append(m)
        
        # If no members found by ID, try by name (Pulse stores names like "Mums Group (Courtney Langberg)")
        group_name = self.name.strip()
        
        # Try exact name match (case-insensitive)
        members_by_name = Person.query.filter(
            db.func.lower(Person.connect_group) == db.func.lower(group_name),
            Person.is_active == True
        ).all()
        if members_by_name:
            logger.info(f"Found {len(members_by_name)} members by exact name match: '{group_name}'")
            # Add only if not already in list
            for m in members_by_name:
                if m not in all_members:
                    all_members.append(m)
        
        # Try with "&" instead of "and" (variations)
        group_name_variant = group_name.replace(' and ', ' & ').replace(' And ', ' & ')
        if group_name_variant != group_name:
            members_by_variant = Person.query.filter(
                db.func.lower(Person.connect_group) == db.func.lower(group_name_variant),
                Person.is_active == True
            ).all()
            if members_by_variant:
                logger.info(f"Found {len(members_by_variant)} members by variant name: '{group_name_variant}'")
                for m in members_by_variant:
                    if m not in all_members:
                        all_members.append(m)
        
        # Try with "And" capitalized
        group_name_capitalized = group_name.replace(' and ', ' And ')
        if group_name_capitalized != group_name and group_name_capitalized != group_name_variant:
            members_by_capitalized = Person.query.filter(
                db.func.lower(Person.connect_group) == db.func.lower(group_name_capitalized),
                Person.is_active == True
            ).all()
            if members_by_capitalized:
                logger.info(f"Found {len(members_by_capitalized)} members by capitalized name: '{group_name_capitalized}'")
                for m in members_by_capitalized:
                    if m not in all_members:
                        all_members.append(m)
        
        # Try partial match (in case name is slightly different) - use LIKE with group name
        if group_name and len(all_members) == 0:
            # Try matching with LIKE - more flexible
            members_by_like = Person.query.filter(
                db.func.lower(Person.connect_group).like(db.func.lower(f"%{group_name}%")),
                Person.is_active == True
            ).all()
            if members_by_like:
                logger.info(f"Found {len(members_by_like)} members by partial match: '%{group_name}%'")
                all_members.extend(members_by_like)
        
        # If still no members, try reverse - find all people with this group name/ID and log them
        if len(all_members) == 0:
            # Use raw SQL to see what's actually in the database
            try:
                from sqlalchemy import text
                sample = db.session.execute(
                    text("SELECT id, full_name, connect_group FROM persons WHERE is_active = 1 AND connect_group IS NOT NULL AND connect_group != '' LIMIT 20")
                ).fetchall()
                logger.warning(f"No members found for group '{self.name}' (ID: {self.id}). Sample connect_group values in DB: {[(r[0], r[1], r[2]) for r in sample]}")
            except Exception as e:
                logger.error(f"Error checking database: {e}")
        
        return all_members
    
    def get_member_count(self):
        """Get count of active members"""
        return len(self.get_members())
    
    def get_leader_emails(self):
        """Get list of all leader emails (leader, co-leader, and additional leaders)"""
        emails = []
        if self.leader and self.leader.email:
            emails.append(self.leader.email.lower())
        if self.co_leader and self.co_leader.email:
            emails.append(self.co_leader.email.lower())
        if self.leader_emails:
            try:
                additional_emails = json.loads(self.leader_emails)
                if isinstance(additional_emails, list):
                    emails.extend([e.lower() for e in additional_emails if e])
            except (json.JSONDecodeError, TypeError):
                pass
        return list(set(emails))  # Remove duplicates
    
    def to_dict(self):
        """Convert connect group to dictionary"""
        # Parse leader_emails JSON (handle gracefully if column doesn't exist)
        leader_emails_list = []
        try:
            if hasattr(self, 'leader_emails') and self.leader_emails:
                try:
                    leader_emails_list = json.loads(self.leader_emails)
                    if not isinstance(leader_emails_list, list):
                        leader_emails_list = []
                except (json.JSONDecodeError, TypeError):
                    leader_emails_list = []
        except AttributeError:
            # Column doesn't exist in database
            leader_emails_list = []
        
        result = {
            'id': self.id,
            'name': self.name,
            'campus': self.campus,
            'leader_id': self.leader_id,
            'leader_name': self.leader.full_name if self.leader else None,
            'leader_email': self.leader.email if self.leader else None,
            'co_leader_id': self.co_leader_id,
            'co_leader_name': self.co_leader.full_name if self.co_leader else None,
            'co_leader_email': self.co_leader.email if self.co_leader else None,
            'leader_emails': leader_emails_list,  # Additional leader emails
            'meeting_day': self.meeting_day,
            'meeting_time': self.meeting_time,
            'meeting_frequency': self.meeting_frequency,
            'location': self.location,
            'leader_access_code': self.leader_access_code if hasattr(self, 'leader_access_code') else None,
        }
        
        # Add member count safely
        try:
            result['member_count'] = self.get_member_count()
        except Exception as e:
            result['member_count'] = 0
        
        result['is_active'] = self.is_active
        result['created_at'] = self.created_at.isoformat() if self.created_at else None
        result['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        
        return result


class ConnectGroupMeeting(db.Model):
    """Individual connect group meeting attendance records"""
    __tablename__ = 'connect_group_meetings'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.String(50), db.ForeignKey('connect_groups.id'), nullable=False)
    meeting_date = db.Column(db.Date, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    group = db.relationship('ConnectGroup', backref='meetings')
    attendance = db.relationship('ConnectGroupAttendance', backref='meeting', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert meeting to dictionary"""
        present_count = len([a for a in self.attendance if a.present])
        return {
            'id': self.id,
            'group_id': self.group_id,
            'group_name': self.group.name if self.group else None,
            'meeting_date': self.meeting_date.isoformat(),
            'notes': self.notes,
            'attendance_count': present_count,
            'total_members': len(self.attendance),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ConnectGroupAttendance(db.Model):
    """Individual attendance record for a meeting"""
    __tablename__ = 'connect_group_attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('connect_group_meetings.id'), nullable=False)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    present = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    
    # Relationships
    person = db.relationship('Person', backref='cg_attendance_records')
    
    def to_dict(self):
        """Convert attendance record to dictionary"""
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'person_id': self.person_id,
            'person_name': self.person.full_name if self.person else None,
            'present': self.present,
            'notes': self.notes
        }


class ConnectGroupMessage(db.Model):
    """Group chat messages for connect groups"""
    __tablename__ = 'connect_group_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.String(50), db.ForeignKey('connect_groups.id'), nullable=False)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    group = db.relationship('ConnectGroup', backref='messages')
    person = db.relationship('Person', backref='group_messages')
    
    def to_dict(self):
        """Convert message to dictionary"""
        return {
            'id': self.id,
            'group_id': self.group_id,
            'person_id': self.person_id,
            'person_name': self.person.full_name if self.person else None,
            'person_email': self.person.email if self.person else None,
            'message': self.message,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Group(db.Model):
    """Regular Group model (separate from Connect Groups)"""
    __tablename__ = 'groups'
    
    id = db.Column(db.String(50), primary_key=True)  # e.g., "grp_copper_coast_1"
    name = db.Column(db.String(200), nullable=False)
    campus = db.Column(db.String(100), nullable=False, default='all_campuses')
    leader_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=True)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')  # active, inactive
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    leader = db.relationship('Person', foreign_keys=[leader_id], backref='led_regular_groups')
    
    def to_dict(self):
        """Convert group to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'campus': self.campus,
            'leader_id': self.leader_id,
            'leader_name': self.leader.full_name if self.leader else None,
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class EventCategory(db.Model):
    """Event category model"""
    __tablename__ = 'event_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    color = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert event category to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Event(db.Model):
    """Event model - PCO-level events functionality"""
    __tablename__ = 'events'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    campus = db.Column(db.String(100), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('event_categories.id'))
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    location = db.Column(db.String(200))
    # Note: location_id column removed - doesn't exist in database
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Payment fields (nullable for backward compatibility)
    price = db.Column(db.Numeric(10, 2), nullable=True)  # Price in dollars (e.g., 25.00)
    requires_payment = db.Column(db.Boolean, default=False)
    stripe_price_id = db.Column(db.String(200), nullable=True)  # Stripe Price ID for checkout
    
    # Image/thumbnail
    # Note: image_url column commented out until migration 034_add_image_url_to_events.sql runs
    # Uncomment after migration is applied
    # image_url = db.Column(db.String(500), nullable=True)  # URL to event thumbnail/image
    
    # Beacon zone for attendance tracking
    # Note: beacon_zone_id column commented out until migration 029_add_beacon_to_events.sql runs
    # Uncomment after migration is applied
    # beacon_zone_id = db.Column(db.Integer, db.ForeignKey('beacon_zones.id'), nullable=True)
    
    # Enhanced event fields
    # Note: The following columns don't exist in the database yet - commented out to prevent errors
    # Uncomment these after migration 028_enhanced_events_module.sql runs successfully
    # ministry = db.Column(db.String(100))  # e.g. Kids, Youth, Sunday Services, Prayer, Courses
    # is_all_day = db.Column(db.Boolean, default=False)
    # recurrence_rule = db.Column(db.Text)  # iCal-style RRULE or JSON recurrence object
    # status = db.Column(db.String(20), default='draft')  # draft, published, cancelled, completed
    # visibility = db.Column(db.String(20), default='public')  # internal, public, leaders_only
    # capacity = db.Column(db.Integer, nullable=True)  # Optional max capacity
    # registration_required = db.Column(db.Boolean, default=False)
    # registration_form_id = db.Column(db.Integer, nullable=True)  # Optional reference to form
    # tags = db.Column(db.Text)  # JSON array of tags
    # created_by_user_id = db.Column(db.Integer, nullable=True)  # User who created
    # updated_by_user_id = db.Column(db.Integer, nullable=True)  # User who last updated
    
    # Relationships
    category = db.relationship('EventCategory', backref='events')
    registrations = db.relationship('EventRegistration', backref='event', lazy='dynamic', cascade='all, delete-orphan')
    team_assignments = db.relationship('EventTeamAssignment', backref='event', lazy='dynamic', cascade='all, delete-orphan')
    resource_bookings = db.relationship('EventResourceBooking', backref='event', lazy='dynamic', cascade='all, delete-orphan')
    
    def get_registration_count(self):
        """Get count of active registrations"""
        return self.registrations.filter_by(status='registered').count()
    
    def get_waitlist_count(self):
        """Get count of waitlisted registrations"""
        return self.registrations.filter_by(status='waitlisted').count()
    
    def to_dict(self):
        """Convert event to dictionary"""
        # Note: tags column doesn't exist, so return empty list
        tags_list = []
        
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'campus': self.campus,
            'category_id': self.category_id,
            'category': self.category.to_dict() if self.category else None,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'start_datetime': self.start_time.isoformat() if self.start_time else None,  # Alias for compatibility
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'end_datetime': self.end_time.isoformat() if self.end_time else None,  # Alias for compatibility
            'location': self.location,
            # 'location_id': self.location_id,  # Column doesn't exist
            'is_active': self.is_active,
            'price': float(self.price) if self.price else None,
            'requires_payment': self.requires_payment if self.requires_payment else False,
            'stripe_price_id': self.stripe_price_id,
            'image_url': self.image_url if hasattr(self, 'image_url') else None,
            'beacon_zone_id': self.beacon_zone_id if hasattr(self, 'beacon_zone_id') else None,
            # 'ministry': self.ministry if hasattr(self, 'ministry') else None,  # Commented out until migration runs
            # Note: Removed fields that don't exist in database
            # 'is_all_day': self.is_all_day,
            # 'recurrence_rule': self.recurrence_rule,
            # 'status': self.status,
            # 'visibility': self.visibility,
            # 'capacity': self.capacity,
            # 'registration_required': self.registration_required,
            # 'registration_form_id': self.registration_form_id,
            # 'tags': tags_list,
            # 'created_by_user_id': self.created_by_user_id,
            # 'updated_by_user_id': self.updated_by_user_id,
            'registration_count': self.get_registration_count(),
            'waitlist_count': self.get_waitlist_count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class EventRegistration(db.Model):
    """Event registration model"""
    __tablename__ = 'event_registrations'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=True)  # Nullable for guest registrations
    email = db.Column(db.String(200))  # For non-person registrations
    name = db.Column(db.String(200))  # For non-person registrations
    phone = db.Column(db.String(50))
    status = db.Column(db.String(20), default='registered')  # registered, waitlisted, cancelled, attended, no_show
    guest_count = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    person = db.relationship('Person', backref='event_registrations')
    
    def to_dict(self):
        """Convert registration to dictionary"""
        return {
            'id': self.id,
            'event_id': self.event_id,
            'person_id': self.person_id,
            'person_name': self.person.full_name if self.person else None,
            'email': self.email or (self.person.email if self.person else None),
            'name': self.name or (self.person.full_name if self.person else None),
            'phone': self.phone or (self.person.phone if self.person else None),
            'status': self.status,
            'guest_count': self.guest_count,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class EventTeamAssignment(db.Model):
    """Event team assignment model"""
    __tablename__ = 'event_team_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    team_name = db.Column(db.String(100), nullable=False)  # e.g. Worship, Host, Kids, Production
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    role = db.Column(db.String(100))  # e.g. Leader, Member
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    person = db.relationship('Person', backref='event_team_assignments')
    
    def to_dict(self):
        """Convert team assignment to dictionary"""
        return {
            'id': self.id,
            'event_id': self.event_id,
            'team_name': self.team_name,
            'person_id': self.person_id,
            'person_name': self.person.full_name if self.person else None,
            'person_email': self.person.email if self.person else None,
            'role': self.role,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class EventResourceBooking(db.Model):
    """Event resource booking model"""
    __tablename__ = 'event_resource_bookings'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    resource_type = db.Column(db.String(50), nullable=False)  # Room, Equipment, Vehicle, Other
    resource_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    start_datetime = db.Column(db.DateTime, nullable=False)
    end_datetime = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='requested')  # requested, approved, declined, conflict
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert resource booking to dictionary"""
        return {
            'id': self.id,
            'event_id': self.event_id,
            'resource_type': self.resource_type,
            'resource_name': self.resource_name,
            'quantity': self.quantity,
            'start_datetime': self.start_datetime.isoformat() if self.start_datetime else None,
            'end_datetime': self.end_datetime.isoformat() if self.end_datetime else None,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ResourceCategory(db.Model):
    """Resource category model for organizing resources"""
    __tablename__ = 'resource_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    display_name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(200), unique=True, nullable=False)
    description = db.Column(db.Text)
    folder_id = db.Column(db.String(200))  # Google Drive folder ID
    sort_order = db.Column(db.Integer, default=0)
    links = db.Column(db.Text)  # JSON array of links
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert category to dictionary"""
        # Parse links from JSON string, handle errors gracefully
        links = []
        if self.links:
            try:
                parsed_links = json.loads(self.links)
                if isinstance(parsed_links, list):
                    links = parsed_links
            except (json.JSONDecodeError, TypeError) as e:
                # If links can't be parsed, return empty list
                links = []
        
        return {
            'id': self.slug or str(self.id),
            'displayName': self.display_name,
            'slug': self.slug,
            'description': self.description or '',
            'folderId': self.folder_id or '',
            'sortOrder': self.sort_order or 0,
            'links': links,
            'isActive': self.is_active,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class DriveItemOverride(db.Model):
    """Custom display names for Google Drive items in resource categories"""
    __tablename__ = 'drive_item_overrides'
    
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('resource_categories.id'), nullable=False)
    drive_item_id = db.Column(db.String(200), nullable=False)
    custom_name = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    category = db.relationship('ResourceCategory', backref='drive_overrides')
    
    def to_dict(self):
        """Convert override to dictionary"""
        return {
            'id': self.id,
            'categoryId': self.category_id,
            'driveItemId': self.drive_item_id,
            'customName': self.custom_name,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


# ============================================================================
# HEARTBEAT MODULE MODELS
# ============================================================================

class Campus(db.Model):
    """Campus model for Heartbeat module"""
    __tablename__ = 'heartbeat_campuses'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    timezone = db.Column(db.String(50), default='UTC')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'timezone': self.timezone,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Service(db.Model):
    """Service model for tracking church services"""
    __tablename__ = 'heartbeat_services'
    
    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(db.String(50), db.ForeignKey('heartbeat_campuses.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'sunday', 'youth', 'kids', 'prayer_night', etc.
    starts_at = db.Column(db.DateTime, nullable=False)
    ends_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    campus = db.relationship('Campus', backref='services')
    
    def to_dict(self):
        return {
            'id': self.id,
            'campus_id': self.campus_id,
            'type': self.type,
            'starts_at': self.starts_at.isoformat() if self.starts_at else None,
            'ends_at': self.ends_at.isoformat() if self.ends_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AttendanceEvent(db.Model):
    """Attendance event tracking"""
    __tablename__ = 'heartbeat_attendance_events'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('heartbeat_services.id'), nullable=False)
    source = db.Column(db.String(50), nullable=False)  # 'beacon', 'manual', 'checkin', 'import'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    person = db.relationship('Person', backref='attendance_events')
    service = db.relationship('Service', backref='attendance_events')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'service_id': self.service_id,
            'source': self.source,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class HeartbeatConnectGroup(db.Model):
    """Connect Group model for Heartbeat (extends existing ConnectGroup concept)"""
    __tablename__ = 'heartbeat_connect_groups'
    
    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(db.String(50), db.ForeignKey('heartbeat_campuses.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    leader_person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'home', 'youth', 'interest'
    day_of_week = db.Column(db.String(20))  # 'Monday', 'Tuesday', etc.
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    campus = db.relationship('Campus', backref='connect_groups')
    leader = db.relationship('Person', foreign_keys=[leader_person_id], backref='led_heartbeat_groups')
    
    def to_dict(self):
        return {
            'id': self.id,
            'campus_id': self.campus_id,
            'name': self.name,
            'leader_person_id': self.leader_person_id,
            'type': self.type,
            'day_of_week': self.day_of_week,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ConnectAttendance(db.Model):
    """Connect group attendance records"""
    __tablename__ = 'heartbeat_connect_attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    connect_group_id = db.Column(db.Integer, db.ForeignKey('heartbeat_connect_groups.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False)  # 'present', 'absent', 'apology'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    person = db.relationship('Person', backref='connect_attendance')
    connect_group = db.relationship('HeartbeatConnectGroup', backref='attendance_records')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'connect_group_id': self.connect_group_id,
            'date': self.date.isoformat() if self.date else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Team(db.Model):
    """Serving team model"""
    __tablename__ = 'heartbeat_teams'
    
    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(db.String(50), db.ForeignKey('heartbeat_campuses.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    campus = db.relationship('Campus', backref='teams')
    
    def to_dict(self):
        return {
            'id': self.id,
            'campus_id': self.campus_id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ServingAssignment(db.Model):
    """Serving assignment tracking"""
    __tablename__ = 'heartbeat_serving_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('heartbeat_teams.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('heartbeat_services.id'), nullable=False)
    role = db.Column(db.String(200))
    status = db.Column(db.String(20), nullable=False)  # 'scheduled', 'served', 'no_show'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    person = db.relationship('Person', backref='serving_assignments')
    team = db.relationship('Team', backref='assignments')
    service = db.relationship('Service', backref='serving_assignments')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'team_id': self.team_id,
            'service_id': self.service_id,
            'role': self.role,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class GivingSummary(db.Model):
    """Giving summary for a person over a period"""
    __tablename__ = 'heartbeat_giving_summaries'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    frequency = db.Column(db.String(20), nullable=False)  # 'none', 'occasional', 'monthly', 'weekly'
    pattern_score = db.Column(db.Float, default=0.0)  # 0-1.0
    last_gift_at = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    person = db.relationship('Person', backref='giving_summaries')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'period_start': self.period_start.isoformat() if self.period_start else None,
            'period_end': self.period_end.isoformat() if self.period_end else None,
            'frequency': self.frequency,
            'pattern_score': self.pattern_score,
            'last_gift_at': self.last_gift_at.isoformat() if self.last_gift_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class GivingTransaction(db.Model):
    """Detailed giving transaction tracking with source"""
    __tablename__ = 'giving_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    stripe_payment_intent_id = db.Column(db.String(200), unique=True, nullable=True)
    amount = db.Column(db.Float, nullable=False)  # Amount in dollars
    currency = db.Column(db.String(10), default='AUD')
    giving_type = db.Column(db.String(50), nullable=False)  # 'tithe', 'offering', 'missions', 'event'
    campus = db.Column(db.String(100), nullable=False)
    source = db.Column(db.String(50), nullable=False)  # 'app', 'qr_code', 'web', 'tap_to_give', 'manual'
    qr_code_id = db.Column(db.String(100), nullable=True)  # For tracking which QR code was used
    service_date = db.Column(db.Date, nullable=True)  # Date of service if from QR code
    status = db.Column(db.String(50), default='completed')  # 'completed', 'pending', 'failed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    person = db.relationship('Person', backref='giving_transactions')
    
    def to_dict(self):
        # Safely get person name without triggering lazy load that might fail
        person_name = None
        try:
            if hasattr(self, 'person') and self.person:
                person_name = getattr(self.person, 'full_name', None)
        except Exception:
            # If lazy load fails (e.g., missing columns), just use None
            person_name = None
        
        return {
            'id': self.id,
            'person_id': self.person_id,
            'person_name': person_name,
            'stripe_payment_intent_id': self.stripe_payment_intent_id,
            'amount': self.amount,
            'currency': self.currency,
            'giving_type': self.giving_type,
            'campus': self.campus,
            'source': self.source,
            'qr_code_id': self.qr_code_id,
            'service_date': self.service_date.isoformat() if self.service_date else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class GivingQRCode(db.Model):
    """QR codes for tap-to-give on chair backs"""
    __tablename__ = 'giving_qr_codes'
    
    id = db.Column(db.Integer, primary_key=True)
    qr_code_id = db.Column(db.String(100), unique=True, nullable=False)  # Unique identifier for QR
    campus = db.Column(db.String(100), nullable=False)
    zone = db.Column(db.String(100), nullable=True)  # e.g., "Main Auditorium", "Youth Room"
    seat_number = db.Column(db.String(50), nullable=True)  # e.g., "Row 5, Seat 12"
    is_active = db.Column(db.Boolean, default=True)
    scan_count = db.Column(db.Integer, default=0)  # Track how many times scanned
    last_scan_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'qr_code_id': self.qr_code_id,
            'campus': self.campus,
            'zone': self.zone,
            'seat_number': self.seat_number,
            'is_active': self.is_active,
            'scan_count': self.scan_count,
            'last_scan_at': self.last_scan_at.isoformat() if self.last_scan_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'qr_url': f"/give/qr/{self.qr_code_id}"  # URL for the QR code
        }


class PrayerLink(db.Model):
    """Prayer & Praise submission links for QR/NFC tap points, social media, etc."""
    __tablename__ = 'prayer_links'
    
    id = db.Column(db.Integer, primary_key=True)
    link_id = db.Column(db.String(100), unique=True, nullable=False)  # Unique identifier for link
    link_type = db.Column(db.String(20), nullable=False, default='both')  # 'prayer', 'praise', 'both'
    campus = db.Column(db.String(100), nullable=True)  # Optional campus filter
    department = db.Column(db.String(100), nullable=True)  # Optional department filter (Kids, Youth, Adults, etc.)
    location = db.Column(db.String(200), nullable=True)  # e.g., "Main Entrance", "Youth Room", "Social Media"
    description = db.Column(db.String(500), nullable=True)  # Admin notes about this link
    code_type = db.Column(db.String(20), default='qr')  # 'qr', 'nfc', 'link'
    is_active = db.Column(db.Boolean, default=True)
    scan_count = db.Column(db.Integer, default=0)  # Track how many times accessed
    submission_count = db.Column(db.Integer, default=0)  # Track successful submissions
    last_scan_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(100), nullable=True)  # User who created this link
    
    def to_dict(self):
        return {
            'id': self.id,
            'link_id': self.link_id,
            'link_type': self.link_type,
            'campus': self.campus,
            'department': self.department,
            'location': self.location,
            'description': self.description,
            'code_type': self.code_type,
            'is_active': self.is_active,
            'scan_count': self.scan_count,
            'submission_count': self.submission_count,
            'last_scan_at': self.last_scan_at.isoformat() if self.last_scan_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'url': f"/prayer/link/{self.link_id}",  # Public submission URL
            'full_url': f"https://pulse.futuresbranch.org/prayer/link/{self.link_id}"  # Full URL for QR generation
        }


class GivingSubscription(db.Model):
    """Recurring giving subscriptions via Stripe"""
    __tablename__ = 'giving_subscriptions'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    stripe_subscription_id = db.Column(db.String(200), unique=True, nullable=False)
    stripe_customer_id = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)  # Amount in dollars per period
    currency = db.Column(db.String(10), default='AUD')
    giving_type = db.Column(db.String(50), nullable=False)  # 'tithe', 'offering', 'missions', 'event'
    campus = db.Column(db.String(100), nullable=False)
    source = db.Column(db.String(50), nullable=False)  # 'app', 'qr_code', 'web', 'tap_to_give'
    qr_code_id = db.Column(db.String(100), nullable=True)
    interval = db.Column(db.String(20), nullable=False)  # 'week', 'month', 'year'
    status = db.Column(db.String(50), default='active')  # 'active', 'canceled', 'past_due', 'unpaid'
    current_period_start = db.Column(db.DateTime, nullable=True)
    current_period_end = db.Column(db.DateTime, nullable=True)
    cancel_at_period_end = db.Column(db.Boolean, default=False)
    canceled_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    person = db.relationship('Person', backref='giving_subscriptions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'person_name': self.person.full_name if self.person else None,
            'stripe_subscription_id': self.stripe_subscription_id,
            'stripe_customer_id': self.stripe_customer_id,
            'amount': self.amount,
            'currency': self.currency,
            'giving_type': self.giving_type,
            'campus': self.campus,
            'source': self.source,
            'qr_code_id': self.qr_code_id,
            'interval': self.interval,
            'status': self.status,
            'current_period_start': self.current_period_start.isoformat() if self.current_period_start else None,
            'current_period_end': self.current_period_end.isoformat() if self.current_period_end else None,
            'cancel_at_period_end': self.cancel_at_period_end,
            'canceled_at': self.canceled_at.isoformat() if self.canceled_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class DiscipleshipStep(db.Model):
    """Discipleship milestone tracking"""
    __tablename__ = 'heartbeat_discipleship_steps'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'salvation', 'baptism', 'holy_spirit', 'next_steps', etc.
    description = db.Column(db.Text)
    date = db.Column(db.Date, nullable=False)
    created_by_person_id = db.Column(db.String(50), db.ForeignKey('persons.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    person = db.relationship('Person', foreign_keys=[person_id], backref='discipleship_steps')
    created_by = db.relationship('Person', foreign_keys=[created_by_person_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'type': self.type,
            'description': self.description,
            'date': self.date.isoformat() if self.date else None,
            'created_by_person_id': self.created_by_person_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class CareCase(db.Model):
    """Pastoral care case tracking"""
    __tablename__ = 'heartbeat_care_cases'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'bereavement', 'marriage', 'mental_health', etc.
    status = db.Column(db.String(20), nullable=False)  # 'open', 'in_progress', 'closed'
    priority = db.Column(db.String(20), nullable=False)  # 'low', 'medium', 'high'
    summary = db.Column(db.String(500))
    details = db.Column(db.Text)
    created_by_person_id = db.Column(db.String(50), db.ForeignKey('persons.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    person = db.relationship('Person', foreign_keys=[person_id], backref='care_cases')
    created_by = db.relationship('Person', foreign_keys=[created_by_person_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'type': self.type,
            'status': self.status,
            'priority': self.priority,
            'summary': self.summary,
            'details': self.details,
            'created_by_person_id': self.created_by_person_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class CareTouchpoint(db.Model):
    """Care touchpoint tracking"""
    __tablename__ = 'heartbeat_care_touchpoints'
    
    id = db.Column(db.Integer, primary_key=True)
    care_case_id = db.Column(db.Integer, db.ForeignKey('heartbeat_care_cases.id'), nullable=False)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    contacted_by_person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    method = db.Column(db.String(50), nullable=False)  # 'phone', 'in_person', 'message', 'email', 'visit', 'prayer'
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    care_case = db.relationship('CareCase', backref='touchpoints')
    person = db.relationship('Person', foreign_keys=[person_id], backref='care_touchpoints')
    contacted_by = db.relationship('Person', foreign_keys=[contacted_by_person_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'care_case_id': self.care_case_id,
            'person_id': self.person_id,
            'contacted_by_person_id': self.contacted_by_person_id,
            'method': self.method,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PastoralCareAppointment(db.Model):
    """Scheduled pastoral care appointments/catch-ups"""
    __tablename__ = 'pastoral_care_appointments'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    pastor_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=True)
    care_case_id = db.Column(db.Integer, db.ForeignKey('heartbeat_care_cases.id'), nullable=True)
    
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    appointment_type = db.Column(db.String(50), default='catch_up')
    scheduled_date = db.Column(db.DateTime, nullable=False)
    duration_minutes = db.Column(db.Integer, default=30)
    location = db.Column(db.String(200))
    location_details = db.Column(db.Text)
    
    status = db.Column(db.String(20), default='scheduled')
    requested_by_person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=True)
    created_by_person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=True)
    
    person_notified = db.Column(db.Boolean, default=False)
    pastor_notified = db.Column(db.Boolean, default=False)
    reminder_sent = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    
    notes = db.Column(db.Text)
    follow_up_notes = db.Column(db.Text)
    
    person = db.relationship('Person', foreign_keys=[person_id], backref='pastoral_appointments')
    pastor = db.relationship('Person', foreign_keys=[pastor_id])
    requested_by = db.relationship('Person', foreign_keys=[requested_by_person_id])
    created_by = db.relationship('Person', foreign_keys=[created_by_person_id])
    care_case = db.relationship('CareCase', backref='appointments')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'person_name': self.person.full_name if self.person else None,
            'pastor_id': self.pastor_id,
            'pastor_name': self.pastor.full_name if self.pastor else None,
            'care_case_id': self.care_case_id,
            'title': self.title,
            'description': self.description,
            'appointment_type': self.appointment_type,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'duration_minutes': self.duration_minutes,
            'location': self.location,
            'location_details': self.location_details,
            'status': self.status,
            'requested_by_person_id': self.requested_by_person_id,
            'created_by_person_id': self.created_by_person_id,
            'person_notified': self.person_notified,
            'pastor_notified': self.pastor_notified,
            'reminder_sent': self.reminder_sent,
            'notes': self.notes,
            'follow_up_notes': self.follow_up_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None
        }


class HeartbeatSnapshot(db.Model):
    """Heartbeat health snapshot for a person"""
    __tablename__ = 'heartbeat_snapshots'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    campus_id = db.Column(db.String(50), db.ForeignKey('heartbeat_campuses.id'), nullable=False)
    calculated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    gather_score = db.Column(db.Float, nullable=False)  # 0-100
    engagement_score = db.Column(db.Float, nullable=False)  # 0-100
    spiritual_score = db.Column(db.Float, nullable=False)  # 0-100
    care_score = db.Column(db.Float, nullable=False)  # 0-100
    total_score = db.Column(db.Float, nullable=False)  # 0-100
    status = db.Column(db.String(20), nullable=False)  # 'healthy', 'watch', 'at_risk', 'critical'
    risk_reasons = db.Column(db.Text)  # JSON array of strings
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    person = db.relationship('Person', backref='heartbeat_snapshots')
    campus = db.relationship('Campus', backref='snapshots')
    
    def to_dict(self):
        risk_reasons_list = []
        if self.risk_reasons:
            try:
                risk_reasons_list = json.loads(self.risk_reasons)
            except (json.JSONDecodeError, TypeError):
                pass
        
        return {
            'id': self.id,
            'person_id': self.person_id,
            'campus_id': self.campus_id,
            'calculated_at': self.calculated_at.isoformat() if self.calculated_at else None,
            'gather_score': self.gather_score,
            'engagement_score': self.engagement_score,
            'spiritual_score': self.spiritual_score,
            'care_score': self.care_score,
            'total_score': self.total_score,
            'status': self.status,
            'risk_reasons': risk_reasons_list,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


def init_db(app):
    """Initialize database"""
    db.init_app(app)
    
    try:
        with app.app_context():
            # Create tables
            db.create_all()
            print("[DEBUG] Database tables created successfully")
    except Exception as e:
        print(f"[ERROR] Database initialization error: {e}")
        # Don't raise - allow app to start even if table creation fails
        import traceback
        traceback.print_exc()


# ============================================================================
# PULSE TV MODULE MODELS
# ============================================================================

class TVSeries(db.Model):
    """TV Series model for Pulse TV"""
    __tablename__ = 'tv_series'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100))  # 'foundations', 'leadership', 'parents', 'youth', etc.
    audience = db.Column(db.String(100))  # 'all', 'adults', 'youth', 'kids', 'parents'
    thumbnail_url = db.Column(db.String(500))
    is_published = db.Column(db.Boolean, default=False)
    create_custom_step = db.Column(db.Boolean, default=False)  # Create custom discipleship step when series completed
    custom_step_name = db.Column(db.String(200))  # Custom name for step (defaults to series title)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    episodes = db.relationship('TVEpisode', backref='series', lazy='dynamic', order_by='TVEpisode.order_index', cascade='all, delete-orphan')
    tags = db.relationship('TVTag', secondary='tv_series_tags', lazy='dynamic', backref='series')
    # Note: discipleship_links are accessed through episodes, not directly from series
    
    def to_dict(self, include_episodes=False):
        """Convert series to dictionary"""
        result = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'audience': self.audience,
            'thumbnail_url': self.thumbnail_url,
            'is_published': self.is_published,
            'create_custom_step': self.create_custom_step,
            'custom_step_name': self.custom_step_name,
            'episode_count': self.episodes.filter_by(is_published=True).count() if include_episodes else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_episodes:
            try:
                # For admin views, show all episodes (not just published)
                # Use raw SQL query to avoid SQLAlchemy column issues if thumbnail_url doesn't exist
                from sqlalchemy import text
                try:
                    # Try normal query first
                    episodes_query = self.episodes.order_by(TVEpisode.order_index)
                    episodes_raw = episodes_query.all()
                except Exception as query_err:
                    logger.warning(f"Error querying episodes with ORM for series {self.id}: {query_err}")
                    # Fallback to raw SQL query excluding thumbnail_url
                    try:
                        episodes_raw = db.session.execute(
                            text("""
                                SELECT id, series_id, title, description, video_url, duration_seconds, 
                                       order_index, is_published, downloadable_notes_url,
                                       create_custom_step, custom_step_name, created_at, updated_at
                                FROM tv_episodes 
                                WHERE series_id = :series_id
                                ORDER BY order_index
                            """),
                            {'series_id': self.id}
                        ).fetchall()
                        # Convert to dict format for processing
                        episodes_list = []
                        for row in episodes_raw:
                            episodes_list.append({
                                'id': row.id,
                                'series_id': row.series_id,
                                'title': row.title or '',
                                'description': row.description or '',
                                'video_url': row.video_url,
                                'duration_seconds': row.duration_seconds or 0,
                                'order_index': row.order_index or 0,
                                'is_published': bool(row.is_published) if row.is_published is not None else False,
                                'downloadable_notes_url': row.downloadable_notes_url,
                                'create_custom_step': bool(row.create_custom_step) if row.create_custom_step is not None else False,
                                'custom_step_name': row.custom_step_name,
                                'created_at': row.created_at.isoformat() if row.created_at else None,
                                'updated_at': row.updated_at.isoformat() if row.updated_at else None,
                                'thumbnail_url': None  # Column doesn't exist yet
                            })
                        result['episodes'] = episodes_list
                        return result
                    except Exception as raw_err:
                        logger.error(f"Error with raw SQL query for episodes: {raw_err}")
                        result['episodes'] = []
                        return result
                
                # Process episodes normally
                episodes_list = []
                for e in episodes_raw:
                    try:
                        episodes_list.append(e.to_dict())
                    except Exception as ep_err:
                        logger.warning(f"Error serializing episode {e.id}: {ep_err}")
                        # Try with a minimal dict if full serialization fails
                        try:
                            episodes_list.append({
                                'id': e.id,
                                'title': getattr(e, 'title', ''),
                                'description': getattr(e, 'description', ''),
                                'order_index': getattr(e, 'order_index', 0),
                                'is_published': getattr(e, 'is_published', False),
                                'video_url': getattr(e, 'video_url', None),
                                'duration_seconds': getattr(e, 'duration_seconds', 0),
                                'thumbnail_url': None  # Set to None if column doesn't exist
                            })
                        except Exception as minimal_err:
                            logger.error(f"Error creating minimal episode dict for {e.id}: {minimal_err}")
                            continue
                result['episodes'] = episodes_list
            except Exception as e:
                logger.error(f"Error loading episodes for series {self.id}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                result['episodes'] = []
        
        return result


class TVEpisode(db.Model):
    """TV Episode model"""
    __tablename__ = 'tv_episodes'
    
    id = db.Column(db.Integer, primary_key=True)
    series_id = db.Column(db.Integer, db.ForeignKey('tv_series.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    video_url = db.Column(db.String(500))  # YouTube/Vimeo embed URL or S3 link
    thumbnail_url = db.Column(db.String(500))  # Episode-specific thumbnail (falls back to series thumbnail)
    duration_seconds = db.Column(db.Integer, default=0)
    order_index = db.Column(db.Integer, default=0)
    is_published = db.Column(db.Boolean, default=False)
    downloadable_notes_url = db.Column(db.String(500))
    create_custom_step = db.Column(db.Boolean, default=False)  # Create custom discipleship step when episode completed
    custom_step_name = db.Column(db.String(200))  # Custom name for step (defaults to episode title)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tags = db.relationship('TVTag', secondary='tv_episode_tags', lazy='dynamic', backref='episodes')
    progress_records = db.relationship('TVUserEpisodeProgress', backref='episode', lazy='dynamic', cascade='all, delete-orphan')
    discipleship_links = db.relationship('TVEpisodeDiscipleshipLink', backref='episode', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_progress=False, person_id=None):
        """Convert episode to dictionary"""
        # Safely get thumbnail_url - handle case where column doesn't exist yet
        try:
            thumbnail_url = getattr(self, 'thumbnail_url', None)
        except (AttributeError, KeyError):
            thumbnail_url = None
        
        result = {
            'id': self.id,
            'series_id': self.series_id,
            'series_title': self.series.title if self.series else None,
            'title': self.title,
            'description': self.description,
            'video_url': self.video_url,
            'thumbnail_url': thumbnail_url,
            'duration_seconds': self.duration_seconds,
            'duration_formatted': self._format_duration(self.duration_seconds),
            'order_index': self.order_index,
            'is_published': self.is_published,
            'downloadable_notes_url': self.downloadable_notes_url,
            'create_custom_step': self.create_custom_step,
            'custom_step_name': self.custom_step_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_progress and person_id:
            progress = self.progress_records.filter_by(person_id=person_id).first()
            if progress:
                result['progress'] = progress.to_dict()
            else:
                result['progress'] = None
        
        return result
    
    def _format_duration(self, seconds):
        """Format duration in seconds to HH:MM:SS or MM:SS"""
        if not seconds:
            return "0:00"
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"


class TVTag(db.Model):
    """Tag model for TV content"""
    __tablename__ = 'tv_tags'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# Pivot tables for many-to-many relationships
tv_series_tags = db.Table('tv_series_tags',
    db.Column('series_id', db.Integer, db.ForeignKey('tv_series.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tv_tags.id'), primary_key=True)
)

tv_episode_tags = db.Table('tv_episode_tags',
    db.Column('episode_id', db.Integer, db.ForeignKey('tv_episodes.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tv_tags.id'), primary_key=True)
)


class TVUserEpisodeProgress(db.Model):
    """Tracks user watching progress for episodes"""
    __tablename__ = 'tv_user_episode_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    episode_id = db.Column(db.Integer, db.ForeignKey('tv_episodes.id'), nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_position_seconds = db.Column(db.Integer, default=0)
    completed_at = db.Column(db.DateTime, nullable=True)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    person = db.relationship('Person', backref='tv_progress')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'episode_id': self.episode_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'last_position_seconds': self.last_position_seconds,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'completed': self.completed,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class TVEpisodeDiscipleshipLink(db.Model):
    """Links episodes to discipleship steps for auto-completion"""
    __tablename__ = 'tv_episode_discipleship_links'
    
    id = db.Column(db.Integer, primary_key=True)
    episode_id = db.Column(db.Integer, db.ForeignKey('tv_episodes.id'), nullable=False)
    discipleship_step_type = db.Column(db.String(50), nullable=False)  # 'salvation', 'baptism', 'holy_spirit', 'next_steps', etc.
    auto_complete = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'episode_id': self.episode_id,
            'discipleship_step_type': self.discipleship_step_type,
            'auto_complete': self.auto_complete,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


def create_person_with_engagement(
    full_name,
    email,
    campus,
    preferred_name=None,
    phone=None,
    department=None,
    connect_group=None,
    dream_team_roles=None,
    birthday=None,
    pastoral_notes=None,
    tags=None
):
    """Create a person with an engagement profile"""
    import uuid
    
    # Generate unique ID
    person_id = str(uuid.uuid4())
    
    # Normalize email - convert empty string to None
    email_value = email.strip() if email else None
    email_value = email_value if email_value else None
    
    # Normalize department - standardize case format
    department_value = None
    if department:
        dept_lower = department.strip().lower()
        if dept_lower == 'kids':
            department_value = 'Kids'
        elif dept_lower == 'youth':
            department_value = 'Youth'
        elif dept_lower in ['young adults', 'youngadults', 'young_adults']:
            department_value = 'Young Adults'
        elif dept_lower == 'families':
            department_value = 'Families'
        elif dept_lower == 'adults':
            department_value = 'Adults'
        elif dept_lower == 'seniors':
            department_value = 'Seniors'
        else:
            # For other values, use Title Case
            department_value = department.strip().title()
    
    # Create person
    person = Person(
        id=person_id,
        full_name=full_name,
        email=email_value,
        campus=campus,
        preferred_name=preferred_name,
        phone=phone,
        department=department_value,
        connect_group=connect_group,
        dream_team_roles=json.dumps(dream_team_roles) if dream_team_roles else None,
        birthday=birthday,
        pastoral_notes=pastoral_notes,
        tags=json.dumps(tags) if tags else None
    )
    
    # Create engagement profile
    engagement = EngagementProfile(person_id=person_id)
    
    # Add to session
    db.session.add(person)
    db.session.add(engagement)
    
    return person, engagement


# ============================================================================
# NEW HEARTBEAT DATA SOURCES
# ============================================================================

class AppSession(db.Model):
    """Track app opens for engagement scoring"""
    __tablename__ = 'app_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    session_start = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    platform = db.Column(db.String(20))  # 'ios', 'android', 'web'
    app_version = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    person = db.relationship('Person', backref='app_sessions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'session_start': self.session_start.isoformat() if self.session_start else None,
            'platform': self.platform,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PrayerSubmission(db.Model):
    """Prayer and praise submissions from congregation"""
    __tablename__ = 'prayer_submissions'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=True)  # Nullable for anonymous
    email = db.Column(db.String(200), nullable=True)  # For non-person submissions
    name = db.Column(db.String(200), nullable=True)  # Display name
    
    submission_type = db.Column(db.String(20), nullable=False)  # 'prayer', 'praise'
    category = db.Column(db.String(50))  # 'health', 'family', 'work', 'spiritual', 'other'
    content = db.Column(db.Text, nullable=False)
    is_anonymous = db.Column(db.Boolean, default=False)
    is_urgent = db.Column(db.Boolean, default=False)
    
    # Source tracking
    campus = db.Column(db.String(100))
    source = db.Column(db.String(50))  # 'app', 'web', 'qr', 'nfc'
    prayer_link_id = db.Column(db.Integer, db.ForeignKey('prayer_links.id'), nullable=True)
    
    # Moderation
    status = db.Column(db.String(20), default='pending')  # 'pending', 'approved', 'declined'
    is_public = db.Column(db.Boolean, default=False)  # Can be shared with prayer team
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    person = db.relationship('Person', backref='prayer_submissions')
    prayer_link = db.relationship('PrayerLink', backref='submissions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id if not self.is_anonymous else None,
            'name': self.name if not self.is_anonymous else 'Anonymous',
            'submission_type': self.submission_type,
            'category': self.category,
            'content': self.content,
            'is_anonymous': self.is_anonymous,
            'is_urgent': self.is_urgent,
            'campus': self.campus,
            'source': self.source,
            'status': self.status,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PushNotificationToken(db.Model):
    """Push notification tokens for mobile app users"""
    __tablename__ = 'push_notification_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.String(50), db.ForeignKey('persons.id'), nullable=False)
    email = db.Column(db.String(200), nullable=False, index=True)  # Also index by email for faster lookups
    expo_push_token = db.Column(db.String(200), nullable=False, unique=True, index=True)
    platform = db.Column(db.String(20))  # 'ios', 'android'
    device_id = db.Column(db.String(200))  # Optional device identifier
    app_version = db.Column(db.String(50))  # App version for debugging
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_used_at = db.Column(db.DateTime)  # Track when token was last successfully used
    
    # Relationships
    person = db.relationship('Person', backref='push_tokens')
    
    def to_dict(self):
        return {
            'id': self.id,
            'person_id': self.person_id,
            'email': self.email,
            'expo_push_token': self.expo_push_token,
            'platform': self.platform,
            'device_id': self.device_id,
            'app_version': self.app_version,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None
        }


class ScheduledNotification(db.Model):
    """Scheduled push notifications"""
    __tablename__ = 'scheduled_notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    data = db.Column(db.Text)  # JSON data for notification payload
    target_audience = db.Column(db.String(50), default='all')  # 'all', 'specific_campus', 'specific_users', 'role'
    target_campus = db.Column(db.String(100))  # If targeting specific campus
    target_emails = db.Column(db.Text)  # JSON array of emails if targeting specific users
    target_role = db.Column(db.String(50))  # If targeting specific role
    scheduled_for = db.Column(db.DateTime, nullable=False, index=True)
    sent_at = db.Column(db.DateTime)  # When notification was actually sent
    status = db.Column(db.String(20), default='pending')  # 'pending', 'sent', 'failed', 'cancelled'
    sent_count = db.Column(db.Integer, default=0)  # Number of devices successfully notified
    failed_count = db.Column(db.Integer, default=0)  # Number of failed deliveries
    created_by = db.Column(db.String(200))  # Email of admin who created it
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        target_emails_list = []
        try:
            if self.target_emails:
                target_emails_list = json.loads(self.target_emails) if isinstance(self.target_emails, str) else self.target_emails
        except:
            pass
        
        data_dict = {}
        try:
            if self.data:
                data_dict = json.loads(self.data) if isinstance(self.data, str) else self.data
        except:
            pass
        
        return {
            'id': self.id,
            'title': self.title,
            'body': self.body,
            'data': data_dict,
            'target_audience': self.target_audience,
            'target_campus': self.target_campus,
            'target_emails': target_emails_list,
            'target_role': self.target_role,
            'scheduled_for': self.scheduled_for.isoformat() if self.scheduled_for else None,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'status': self.status,
            'sent_count': self.sent_count,
            'failed_count': self.failed_count,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


# ============================================================================
# ATTENDANCE & STATS MODULE - Multi-Region Support
# ============================================================================

class Region(db.Model):
    """Regions table for multi-national support"""
    __tablename__ = 'regions'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    code = db.Column(db.String(10), nullable=False, unique=True)  # AU, US, BR, ID
    display_name = db.Column(db.String(100), nullable=False)
    timezone = db.Column(db.String(50), default='UTC')
    currency = db.Column(db.String(10), default='USD')
    active = db.Column(db.Boolean, default=True)
    coming_soon = db.Column(db.Boolean, default=False)
    launch_date = db.Column(db.Date)
    
    # Google Sheets config (for backward compatibility during migration)
    sheets_spreadsheet_id = db.Column(db.String(200))  # Optional, for dual-write
    sheets_stats_tab = db.Column(db.String(100), default='Stats')
    sheets_finance_tab = db.Column(db.String(100), default='Tithe')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    campuses = db.relationship('CampusV2', backref='region', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'display_name': self.display_name,
            'timezone': self.timezone,
            'currency': self.currency,
            'active': self.active,
            'coming_soon': self.coming_soon,
            'launch_date': self.launch_date.isoformat() if self.launch_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class CampusV2(db.Model):
    """Campuses table with region support - replaces campuses.json"""
    __tablename__ = 'campuses_v2'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    campus_id = db.Column(db.String(100), nullable=False, unique=True)  # paradise, south, etc.
    name = db.Column(db.String(200), nullable=False)
    display_name = db.Column(db.String(200), nullable=False)
    region_id = db.Column(db.Integer, db.ForeignKey('regions.id'), nullable=False)
    
    # Contact info
    pastor_name = db.Column(db.String(200))
    pastor_email = db.Column(db.String(200))
    
    # Location
    address = db.Column(db.String(500))
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    postal_code = db.Column(db.String(20))
    country = db.Column(db.String(100))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    
    # Configuration
    active = db.Column(db.Boolean, default=True)
    service_times = db.Column(db.Text)  # JSON array: ["9:00 AM", "11:00 AM"]
    detection_patterns = db.Column(db.Text)  # JSON array: ["paradise", "para"]
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    attendance_records = db.relationship('AttendanceRecord', backref='campus', lazy='dynamic')
    
    def to_dict(self):
        try:
            service_times = json.loads(self.service_times) if self.service_times else []
        except:
            service_times = []
        
        try:
            detection_patterns = json.loads(self.detection_patterns) if self.detection_patterns else []
        except:
            detection_patterns = []
        
        return {
            'id': self.id,
            'campus_id': self.campus_id,
            'name': self.name,
            'display_name': self.display_name,
            'region_id': self.region_id,
            'region_code': self.region.code if self.region else None,
            'region_name': self.region.display_name if self.region else None,
            'pastor_name': self.pastor_name,
            'pastor_email': self.pastor_email,
            'address': self.address,
            'city': self.city,
            'state': self.state,
            'postal_code': self.postal_code,
            'country': self.country,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'active': self.active,
            'service_times': service_times,
            'detection_patterns': detection_patterns,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class AttendanceRecord(db.Model):
    """
    Primary attendance/stats record - replaces Google Sheets
    This is the single source of truth for all attendance data
    """
    __tablename__ = 'attendance_records'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses_v2.id'), nullable=False)
    region_id = db.Column(db.Integer, db.ForeignKey('regions.id'), nullable=False)
    
    # Core fields
    date = db.Column(db.Date, nullable=False)
    
    # Attendance totals
    total_attendance = db.Column(db.Integer, default=0)
    total_people_in_campus = db.Column(db.Integer, default=0)
    
    # Adult attendance by service time (stored as JSON)
    # Example: {"9:00 AM": 150, "11:00 AM": 200, "5:30 PM": 75}
    adult_service_breakdown = db.Column(db.Text)
    
    # Kids attendance
    kids_attendance = db.Column(db.Integer, default=0)
    kids_leaders = db.Column(db.Integer, default=0)
    new_kids = db.Column(db.Integer, default=0)
    new_kids_salvations = db.Column(db.Integer, default=0)
    packs_out = db.Column(db.Integer, default=0)
    
    # Kids by service time (stored as JSON)
    # Example: {"Kids 9:00 AM": 45, "Kids 11:00 AM": 60}
    kids_service_breakdown = db.Column(db.Text)
    
    # Youth
    youth_attendance = db.Column(db.Integer, default=0)
    youth_salvations = db.Column(db.Integer, default=0)
    youth_new_people = db.Column(db.Integer, default=0)
    youth_leaders = db.Column(db.Integer, default=0)
    
    # Visitors & Salvations
    first_time_visitors = db.Column(db.Integer, default=0)
    visitors = db.Column(db.Integer, default=0)
    hands_up = db.Column(db.Integer, default=0)
    cards_back = db.Column(db.Integer, default=0)
    first_time_christians = db.Column(db.Integer, default=0)
    rededications = db.Column(db.Integer, default=0)
    salvation_cards_returned = db.Column(db.Integer, default=0)
    
    # Milestones
    baptisms = db.Column(db.Integer, default=0)
    child_dedications = db.Column(db.Integer, default=0)
    
    # Engagement
    connect_groups = db.Column(db.Integer, default=0)
    dream_team = db.Column(db.Integer, default=0)
    
    # Financial (can link to GivingTransaction for details)
    tithe = db.Column(db.Numeric(10, 2), default=0)
    
    # Metadata
    created_by = db.Column(db.Integer)  # User ID
    synced_to_sheets = db.Column(db.Boolean, default=False)  # For dual-write tracking
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes for common queries
    __table_args__ = (
        db.Index('idx_attendance_campus_date', 'campus_id', 'date'),
        db.Index('idx_attendance_region_date', 'region_id', 'date'),
        db.Index('idx_attendance_date', 'date'),
        db.UniqueConstraint('campus_id', 'date', name='uq_campus_date'),
    )
    
    def to_dict(self):
        """Convert to dictionary format"""
        try:
            adult_breakdown = json.loads(self.adult_service_breakdown) if self.adult_service_breakdown else {}
        except:
            adult_breakdown = {}
        
        try:
            kids_breakdown = json.loads(self.kids_service_breakdown) if self.kids_service_breakdown else {}
        except:
            kids_breakdown = {}
        
        return {
            'id': self.id,
            'campus_id': self.campus_id,
            'campus_name': self.campus.display_name if self.campus else None,
            'region_id': self.region_id,
            'region_code': self.campus.region.code if self.campus and self.campus.region else None,
            'date': self.date.isoformat() if self.date else None,
            'total_attendance': self.total_attendance,
            'total_people_in_campus': self.total_people_in_campus,
            'adult_service_breakdown': adult_breakdown,
            'kids_attendance': self.kids_attendance,
            'kids_leaders': self.kids_leaders,
            'new_kids': self.new_kids,
            'new_kids_salvations': self.new_kids_salvations,
            'packs_out': self.packs_out,
            'kids_service_breakdown': kids_breakdown,
            'youth_attendance': self.youth_attendance,
            'youth_salvations': self.youth_salvations,
            'youth_new_people': self.youth_new_people,
            'youth_leaders': self.youth_leaders,
            'first_time_visitors': self.first_time_visitors,
            'visitors': self.visitors,
            'hands_up': self.hands_up,
            'cards_back': self.cards_back,
            'first_time_christians': self.first_time_christians,
            'rededications': self.rededications,
            'salvation_cards_returned': self.salvation_cards_returned,
            'baptisms': self.baptisms,
            'child_dedications': self.child_dedications,
            'connect_groups': self.connect_groups,
            'dream_team': self.dream_team,
            'tithe': float(self.tithe) if self.tithe else 0,
            'created_by': self.created_by,
            'synced_to_sheets': self.synced_to_sheets,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_sheets_row(cls, row_dict, campus_obj):
        """
        Create AttendanceRecord from Google Sheets row format
        Used during migration and dual-write
        """
        # Parse date
        date_val = None
        if 'Date' in row_dict:
            try:
                date_val = datetime.strptime(str(row_dict['Date']), '%Y-%m-%d').date()
            except:
                try:
                    date_val = datetime.strptime(str(row_dict['Date']), '%m/%d/%Y').date()
                except:
                    pass
        
        # Extract service time breakdowns
        adult_breakdown = {}
        kids_breakdown = {}
        
        if campus_obj.service_times:
            try:
                service_times = json.loads(campus_obj.service_times)
                for service_time in service_times:
                    if service_time in row_dict:
                        adult_breakdown[service_time] = int(row_dict[service_time] or 0)
                    kids_key = f'Kids {service_time}'
                    if kids_key in row_dict:
                        kids_breakdown[kids_key] = int(row_dict[kids_key] or 0)
            except:
                pass
        
        return cls(
            campus_id=campus_obj.id,
            region_id=campus_obj.region_id,
            date=date_val,
            total_attendance=int(row_dict.get('Total Attendance', 0) or 0),
            total_people_in_campus=int(row_dict.get('Total People in Campus', 0) or 0),
            adult_service_breakdown=json.dumps(adult_breakdown) if adult_breakdown else None,
            kids_attendance=int(row_dict.get('Kids Attendance', 0) or 0),
            kids_leaders=int(row_dict.get('Kids Leaders', 0) or 0),
            new_kids=int(row_dict.get('New Kids', 0) or 0),
            new_kids_salvations=int(row_dict.get('New Kids Salvations', 0) or 0),
            packs_out=int(row_dict.get('Packs Out', 0) or 0),
            kids_service_breakdown=json.dumps(kids_breakdown) if kids_breakdown else None,
            youth_attendance=int(row_dict.get('Youth Attendance', 0) or 0),
            youth_salvations=int(row_dict.get('Youth Salvations', 0) or 0),
            youth_new_people=int(row_dict.get('Youth New People', 0) or 0),
            youth_leaders=int(row_dict.get('Youth Leaders', 0) or 0),
            first_time_visitors=int(row_dict.get('First Time Visitors', 0) or 0),
            visitors=int(row_dict.get('Visitors', 0) or 0),
            hands_up=int(row_dict.get('Hands up', 0) or 0),
            cards_back=int(row_dict.get('Cards Back', 0) or 0),
            first_time_christians=int(row_dict.get('First Time Christians', 0) or 0),
            rededications=int(row_dict.get('Rededications', 0) or 0),
            salvation_cards_returned=int(row_dict.get('Salvation Cards Returned', 0) or 0),
            baptisms=int(row_dict.get('Baptisms', 0) or 0),
            child_dedications=int(row_dict.get('Child Dedications', 0) or 0),
            connect_groups=int(row_dict.get('Connect Groups', 0) or 0),
            dream_team=int(row_dict.get('Dream Team', 0) or 0),
            tithe=float(row_dict.get('Tithe', 0) or 0),
            synced_to_sheets=True
        )


class FinanceRecord(db.Model):
    """
    Finance/Tithe records - stores tithe data with breakdown
    This table syncs with the Google Sheets "Tithe" tab
    """
    __tablename__ = 'finance_records'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    date = db.Column(db.Date, nullable=False)
    campus_id = db.Column(db.String(100), nullable=False)
    campus_name = db.Column(db.String(200), nullable=False)
    region = db.Column(db.String(50), nullable=False, default='AU')
    
    # Tithe breakdown
    general = db.Column(db.Numeric(10, 2), default=0)
    trust = db.Column(db.Numeric(10, 2), default=0)
    online = db.Column(db.Numeric(10, 2), default=0)
    text = db.Column(db.Numeric(10, 2), default=0)
    total = db.Column(db.Numeric(10, 2), default=0)
    
    # Metadata
    synced_to_sheets = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.utcnow())
    updated_at = db.Column(db.DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    created_by = db.Column(db.String(200))
    updated_by = db.Column(db.String(200))
    
    # Unique constraint: one record per campus per date
    __table_args__ = (
        db.UniqueConstraint('date', 'campus_id', 'region', name='uq_finance_date_campus_region'),
    )
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'campus_id': self.campus_id,
            'campus_name': self.campus_name,
            'region': self.region,
            'general': float(self.general) if self.general else 0,
            'trust': float(self.trust) if self.trust else 0,
            'online': float(self.online) if self.online else 0,
            'text': float(self.text) if self.text else 0,
            'total': float(self.total) if self.total else 0,
            'synced_to_sheets': self.synced_to_sheets,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'updated_by': self.updated_by
        }

