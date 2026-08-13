# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, date
import json
import logging

db = SQLAlchemy()
logger = logging.getLogger(__name__)

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
    
    # Saints (senior/elderly ministry attendance)
    saints = db.Column(db.Integer, default=0)
    
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
    # When False, row is kept for history but omitted from dashboard YTD / rollup metrics (e.g. Good Friday)
    include_in_rollup_metrics = db.Column(db.Boolean, nullable=False, default=True)
    special_service_label = db.Column(db.String(200))  # e.g. "Good Friday", optional
    
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
            'include_in_rollup_metrics': bool(self.include_in_rollup_metrics) if self.include_in_rollup_metrics is not None else True,
            'special_service_label': self.special_service_label,
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

        ftv = int(row_dict.get('First Time Visitors', 0) or 0)
        visitors_val = int(row_dict.get('Visitors', 0) or 0)
        youth_np = int(row_dict.get('Youth New People', 0) or 0)
        if int(row_dict.get('New People', 0) or 0) > 0 and (ftv + visitors_val + youth_np) == 0:
            visitors_val = int(row_dict.get('New People', 0) or 0)

        ftc = int(row_dict.get('First Time Christians', 0) or 0)
        reded = int(row_dict.get('Rededications', 0) or 0)
        ys = int(row_dict.get('Youth Salvations', 0) or 0)
        nks = int(row_dict.get('New Kids Salvations', 0) or 0)
        if int(row_dict.get('New Christians', 0) or 0) > 0 and (ftc + reded + ys + nks) == 0:
            ftc = int(row_dict.get('New Christians', 0) or 0)

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
            new_kids_salvations=nks,
            packs_out=int(row_dict.get('Packs Out', 0) or 0),
            kids_service_breakdown=json.dumps(kids_breakdown) if kids_breakdown else None,
            youth_attendance=int(row_dict.get('Youth Attendance', 0) or 0),
            youth_salvations=ys,
            youth_new_people=youth_np,
            youth_leaders=int(row_dict.get('Youth Leaders', 0) or 0),
            first_time_visitors=ftv,
            visitors=visitors_val,
            hands_up=int(row_dict.get('Hands up', 0) or 0),
            cards_back=int(row_dict.get('Cards Back', 0) or 0),
            first_time_christians=ftc,
            rededications=reded,
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

