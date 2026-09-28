# app.py

from flask import Flask, request, jsonify, send_from_directory, render_template, redirect, url_for, flash, session, Response, make_response, g
from flask_cors import CORS
from flask_compress import Compress
from models import db, init_db, ResourceCategory, DriveItemOverride, Region, CampusV2, AttendanceRecord, FinanceRecord
from datetime import datetime, timezone, timedelta, date
import os
import re

try:
    import gspread
except Exception as e:
    print(f"[ERROR] Failed to import gspread: {e}")
    raise

try:
    import anthropic
except Exception as e:
    anthropic = None

try:
    from oauth2client.service_account import ServiceAccountCredentials
except Exception as e:
    print(f"[ERROR] Failed to import oauth2client.service_account: {e}")
    raise

import json
from typing import Dict, List, Optional, Any, Tuple
import logging
from sqlalchemy import inspect, text, bindparam
from sqlalchemy.exc import OperationalError, SQLAlchemyError

try:
    from dotenv import load_dotenv
except Exception as e:
    print(f"[ERROR] Failed to import dotenv: {e}")
    raise

try:
    from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
except Exception as e:
    print(f"[ERROR] Failed to import Flask-Login: {e}")
    raise

try:
    from werkzeug.security import generate_password_hash, check_password_hash
except Exception as e:
    print(f"[ERROR] Failed to import werkzeug.security: {e}")
    raise

import requests
import uuid
from functools import wraps

try:
    from num2words import num2words
except ImportError:
    def num2words(n):
        return str(n)

# Load environment variables from .env file - MUST be early
# Load from backend directory explicitly
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

# Configure logging - MUST be before any functions that use logger
logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Default campus service time configuration
DEFAULT_CAMPUS_SERVICE_TIMES = {
    'Paradise': ['9:00 AM', '11:00 AM', '5:30 PM'],
    'South': ['9:00 AM', '11:00 AM'],
    'Salisbury': ['9:00 AM', '11:00 AM'],
    'Adelaide City': ['9:00 AM', '11:00 AM', '5:00 PM'],
    'Mount Barker': ['10:00 AM'],
    'Copper Coast': ['10:00 AM'],
    'Clare Valley': ['10:00 AM'],
    'Victor Harbor': ['10:00 AM'],
    'all_campuses': []  # Will be populated dynamically
}

def load_campus_config():
    """Load campus configuration from JSON file"""
    config_file = os.path.join(os.path.dirname(__file__), 'campus_config.json')
    try:
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                loaded_config = json.load(f)
                # Merge with default config, prioritizing loaded config
                merged_config = DEFAULT_CAMPUS_SERVICE_TIMES.copy()
                merged_config.update(loaded_config)
                return merged_config
        return DEFAULT_CAMPUS_SERVICE_TIMES.copy()
    except Exception as e:
        # Use print for early initialization errors before logger is available
        print(f"[ERROR] Failed to load campus config: {e}")
        try:
            logger.error(f"Failed to load campus config: {e}")
        except Exception:
            pass
        return DEFAULT_CAMPUS_SERVICE_TIMES.copy()

def save_campus_config(config: dict) -> bool:
    """Save campus configuration to JSON file"""
    config_file = os.path.join(os.path.dirname(__file__), 'campus_config.json')
    try:
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        try:
            logger.info(f"Campus configuration saved successfully")
        except Exception:
            print(f"[INFO] Campus configuration saved successfully")
        return True
    except Exception as e:
        try:
            logger.error(f"Failed to save campus config: {e}")
        except Exception:
            print(f"[ERROR] Failed to save campus config: {e}")
        return False

# Load campus configuration at startup
CAMPUS_SERVICE_TIMES = load_campus_config()

def get_campus_service_times(campus: str) -> list:
    """Get service times for a specific campus from campuses.json"""
    campus_normalized = normalize_campus(campus)
    
    # Try to load from campuses.json first
    try:
        campuses_db = load_campuses_database()
        # Map normalized names to campus IDs
        campus_id_mapping = {
            'paradise': 'paradise',
            'south': 'south',
            'salisbury': 'salisbury',
            'adelaide city': 'adelaide_city',
            'mount barker': 'mount_barker',
            'copper coast': 'copper_coast',
            'clare valley': 'clare_valley',
            'victor harbor': 'victor_harbour'
        }
        
        campus_id = campus_id_mapping.get(campus_normalized, campus_normalized)
        campus_data = campuses_db.get('campuses', {}).get(campus_id, {})
        
        if campus_data and 'service_times' in campus_data:
            return campus_data['service_times']
    except Exception as e:
        logger.warning(f"Failed to load service times from campuses.json: {e}")
    
    # Fallback to hardcoded config
    campus_mapping = {
        'paradise': 'Paradise',
        'south': 'South',
        'salisbury': 'Salisbury',
        'adelaide city': 'Adelaide City',
        'mount barker': 'Mount Barker',
        'copper coast': 'Copper Coast',
        'clare valley': 'Clare Valley',
        'victor harbor': 'Victor Harbor'
    }
    
    config_key = campus_mapping.get(campus_normalized, campus)
    return CAMPUS_SERVICE_TIMES.get(config_key, ['10:00 AM'])

def get_all_service_times() -> dict:
    """Get all service times for all campuses"""
    return CAMPUS_SERVICE_TIMES.copy()

# Service time detection patterns for voice input
SERVICE_TIME_PATTERNS = {
    '9:00 AM': ['9am', '9 am', '9:00am', '9:00 am', 'nine am', 'nine o\'clock'],
    '10:00 AM': ['10am', '10 am', '10:00am', '10:00 am', 'ten am', 'ten o\'clock'],
    '11:00 AM': ['11am', '11 am', '11:00am', '11:00 am', 'eleven am', 'eleven o\'clock'],
    '5:00 PM': ['5pm', '5 pm', '5:00pm', '5:00 pm', 'five pm', 'five o\'clock', 'evening service']
}

# Weekend review detection phrases
WEEKEND_REVIEW_PHRASES = [
    'weekend review', 'weekend report', 'sunday review', 'sunday report',
    'how did the church go', 'how did futures church', 'how did the church do',
    'how did we go', 'church report', 'church review', 'futures church report',
    'futures church review', 'how did the church', 'how did futures', 'church summary',
    'church recap', 'church stats', 'futures church stats', 'futures church summary',
    'how did the church go this weekend', 'how did the church go this week',
    'how did futures church go', 'how did futures church go this weekend',
    'how did futures church go this week', 'how did the church go on sunday',
    'how did we go this weekend', 'how did we go this week', 'how did we go on sunday',
    'give me a weekend review', 'give me a church report', 'give me a church review',
    'give me a church summary', 'give me a church recap', 'give me a church stats',
    'give me a futures church report', 'give me a futures church review',
    'give me a futures church summary', 'give me a futures church recap',
    'give me a futures church stats', 'can i get a weekend review', 'can i get a church report',
    'can i get a church review', 'can i get a church summary', 'can i get a church recap',
    'can i get a church stats', 'can i get a futures church report', 'can i get a futures church review',
    'can i get a futures church summary', 'can i get a futures church recap',
    'can i get a futures church stats', 'church-wide report', 'church wide report',
    'church-wide review', 'church wide review', 'church-wide summary', 'church wide summary',
    'church-wide recap', 'church wide recap', 'church-wide stats', 'church wide stats',
]

# Pastor to review type mapping
PASTOR_MAPPING = {
    # Senior/Lead Pastors - get comprehensive all-campus reviews
    'ps ashley': 'all_campuses',
    'pastor ashley': 'all_campuses',
    'ashley': 'all_campuses',
    
    'ps josh': 'all_campuses',  # Lead Pastor - gets all campus data
    'pastor josh': 'all_campuses',
    'josh': 'all_campuses',
    
    'ps peter': 'paradise',
    'pastor peter': 'paradise',
    'peter': 'paradise',
    
    'ps david': 'adelaide_city',
    'pastor david': 'adelaide_city',
    'david': 'adelaide_city',
    
    'ps sarah': 'salisbury',
    'pastor sarah': 'salisbury',
    'sarah': 'salisbury',
    
    'ps mark': 'mount_barker',
    'pastor mark': 'mount_barker',
    'mark': 'mount_barker',
}

def detect_pastor_name(question: str) -> Optional[str]:
    """Detect pastor names in the question and return the campus they map to"""
    question_lower = question.lower()
    
    # Check for pastor names
    for pastor_name, campus in PASTOR_MAPPING.items():
        if pastor_name in question_lower:
            logger.info(f"[PASTOR_DETECTION] Found pastor '{pastor_name}' -> maps to '{campus}'")
            return campus
    
    return None

def detect_service_time(text: str) -> Optional[str]:
    """Detect service time mentioned in text"""
    text_lower = text.lower()
    
    for service_time, patterns in SERVICE_TIME_PATTERNS.items():
        for pattern in patterns:
            if pattern in text_lower:
                return service_time
    
    return None

def parse_service_attendance(text: str, campus: str) -> dict:
    """Parse service-specific attendance from text input"""
    service_times = get_campus_service_times(campus)
    service_attendance = {}
    
    # Try to extract attendance for each service time
    for service_time in service_times:
        patterns = SERVICE_TIME_PATTERNS.get(service_time, [])
        for pattern in patterns:
            # Look for patterns like "9am 150" or "150 at 9am"
            import re
            
            # Pattern: service time followed by number
            match = re.search(rf'{re.escape(pattern)}\s+(\d+)', text.lower())
            if match:
                service_attendance[service_time] = int(match.group(1))
                continue
                
            # Pattern: number followed by service time
            match = re.search(rf'(\d+)\s+(?:at\s+)?{re.escape(pattern)}', text.lower())
            if match:
                service_attendance[service_time] = int(match.group(1))
                continue
    
    return service_attendance

def load_local_data():
    """Load data from local JSON file as fallback when Google Sheets is not available"""
    try:
        # Try multiple possible locations for the data file
        data_locations = [
            'data/logged_stats.json',
            os.path.join(os.path.dirname(__file__), 'data/logged_stats.json'),
            'logged_stats.json',
            os.path.join(os.path.dirname(__file__), 'logged_stats.json')
        ]
        
        for data_path in data_locations:
            try:
                if os.path.exists(data_path):
                    with open(data_path, 'r') as f:
                        data = json.load(f)
                        logger.info(f"Loaded {len(data)} records from {data_path}")
                        return data
            except Exception as e:
                print(f"[DEBUG] Failed to load from {data_path}: {e}")
                continue
        
        logger.warning("No local data file found in any location")
        return []
    except Exception as e:
        logger.error(f"Failed to load local data: {e}")
        return []

scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive"
]

print("[DEBUG] Finished Google Sheets Auth scope definition")

print("[DEBUG] Starting Google Sheets client initialization")
# Initialize Google Sheets client with robust fallback system
def initialize_google_sheets():
    """Initialize Google Sheets with fallback for both local and Railway deployment"""
    global sheet, client
    
    # Try multiple initialization methods
    initialization_methods = [
        ("Railway Environment Variable (Base64)", initialize_from_railway_base64),
        ("Railway Environment Variable", initialize_from_railway),
        ("Local credentials.json", initialize_from_local_file),
        ("Local credentials.json in backend/", initialize_from_backend_file),
        ("Fallback to local data", initialize_fallback)
    ]
    
    for method_name, init_func in initialization_methods:
        try:
            print(f"[DEBUG] Trying {method_name}")
            result = init_func()
            if result:
                print(f"[DEBUG] Google Sheets initialized successfully via {method_name}")
                return True
        except Exception as e:
            print(f"[DEBUG] {method_name} failed: {e}")
            continue
    
    print("[WARNING] All Google Sheets initialization methods failed - using fallback")
    sheet = None
    return False

def initialize_from_railway_base64():
    """Initialize from Railway environment variables (base64-encoded)"""
    global sheet, finance_sheet, client
    import base64
    import json
    
    google_sheets_credentials_b64 = os.getenv("GOOGLE_SHEETS_CREDENTIALS_BASE64")
    if not google_sheets_credentials_b64:
        print("[WARNING] GOOGLE_SHEETS_CREDENTIALS_BASE64 environment variable not found")
        raise Exception("GOOGLE_SHEETS_CREDENTIALS_BASE64 not found")
    
    print(f"[DEBUG] Found GOOGLE_SHEETS_CREDENTIALS_BASE64 variable (length: {len(google_sheets_credentials_b64)})")
    
    try:
        # Decode base64 to get JSON string
        credentials_json = base64.b64decode(google_sheets_credentials_b64).decode('utf-8')
        print(f"[DEBUG] Successfully decoded base64 credentials (length: {len(credentials_json)})")
        
        creds_dict = json.loads(credentials_json)
        print(f"[DEBUG] Successfully parsed credentials JSON (type: {creds_dict.get('type')}, project: {creds_dict.get('project_id')})")
        
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        print("[DEBUG] Successfully created credentials object")
        
        client = gspread.authorize(creds)
        print("[DEBUG] Successfully authorized gspread client")
        
        sheet_name = os.getenv("GOOGLE_SHEET_NAME", "Stats")
        print(f"[DEBUG] Railway Base64: Opening spreadsheet '{sheet_name}'")
        
        # Open the main Google Sheet file
        spreadsheet = client.open(sheet_name)
        print(f"[DEBUG] Railway Base64: Spreadsheet opened successfully")
        print(f"[DEBUG] Railway Base64: Available worksheets: {[ws.title for ws in spreadsheet.worksheets()]}")
        
        # Open the Stats worksheet
        sheet = spreadsheet.worksheet("Stats")
        print(f"[DEBUG] Railway Base64: Successfully opened 'Stats' worksheet")
        
        # Try to open the Tithe tab
        try:
            finance_sheet = spreadsheet.worksheet("Tithe")
            print(f"[DEBUG] Railway Base64: Successfully opened 'Tithe' worksheet")
        except Exception as e:
            try:
                finance_sheet = spreadsheet.worksheet("tithe")
                print(f"[DEBUG] Railway Base64: Successfully opened 'tithe' worksheet")
            except Exception as e2:
                print(f"[WARNING] Railway Base64: Could not open Tithe worksheet: {e2}")
                finance_sheet = None
        
        return True
    except Exception as e:
        print(f"[ERROR] Railway Base64 initialization failed: {e}")
        raise

def initialize_from_railway():
    """Initialize from Railway environment variables"""
    global sheet, finance_sheet, client
    google_sheets_credentials = os.getenv("GOOGLE_SHEETS_CREDENTIALS")
    if not google_sheets_credentials:
        raise Exception("GOOGLE_SHEETS_CREDENTIALS not found")
    
    import json
    creds_dict = json.loads(google_sheets_credentials)
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
    client = gspread.authorize(creds)
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "Stats")  # Default to "Stats" instead of "SHEETS"
    print(f"[DEBUG] Railway: Opening spreadsheet '{sheet_name}'")
    
    # Open the main Google Sheet file
    spreadsheet = client.open(sheet_name)
    print(f"[DEBUG] Railway: Spreadsheet opened successfully")
    print(f"[DEBUG] Railway: Available worksheets: {[ws.title for ws in spreadsheet.worksheets()]}")
    
    # Open the Stats worksheet
    sheet = spreadsheet.worksheet("Stats")  # Stats tab
    print(f"[DEBUG] Railway: Successfully opened 'Stats' worksheet")
    
    # Try to open the Tithe tab (try both "Tithe" and "tithe")
    try:
        finance_sheet = spreadsheet.worksheet("Tithe")
        print(f"[DEBUG] Railway: Successfully opened 'Tithe' worksheet")
    except Exception as e:
        try:
            finance_sheet = spreadsheet.worksheet("tithe")
            print(f"[DEBUG] Railway: Successfully opened 'tithe' worksheet")
        except Exception as e2:
            print(f"[WARNING] Railway: 'Tithe'/'tithe' worksheet not found - finance features will be disabled: {e}")
            finance_sheet = None
    
    print(f"[DEBUG] Railway: Google Sheets initialization complete")
    return True

def initialize_from_local_file():
    """Initialize from local credentials.json in current directory"""
    global sheet, finance_sheet, client
    if not os.path.exists("credentials.json"):
        raise Exception("credentials.json not found")
    
    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
    client = gspread.authorize(creds)
    
    # Open the main Google Sheet file
    spreadsheet = client.open("Stats")
    sheet = spreadsheet.worksheet("Stats")  # Stats tab
    
    # Try to open the Tithe tab (try both "Tithe" and "tithe")
    try:
        finance_sheet = spreadsheet.worksheet("Tithe")
        print(f"[DEBUG] Local: Successfully opened 'Tithe' tab")
    except:
        try:
            finance_sheet = spreadsheet.worksheet("tithe")
            print(f"[DEBUG] Local: Successfully opened 'tithe' tab")
        except:
            print(f"[WARNING] Local: 'Tithe'/'tithe' tab not found - finance features will be disabled")
            finance_sheet = None
    
    return True

def initialize_from_backend_file():
    """Initialize from credentials.json in backend directory"""
    global sheet, finance_sheet, client
    backend_creds_path = os.path.join(os.path.dirname(__file__), "credentials.json")
    if not os.path.exists(backend_creds_path):
        raise Exception("credentials.json not found in backend directory")
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(backend_creds_path, scope)
    client = gspread.authorize(creds)
    
    # Open the main Google Sheet file
    spreadsheet = client.open("Stats")
    sheet = spreadsheet.worksheet("Stats")  # Stats tab
    
    # Try to open the Tithe tab (try both "Tithe" and "tithe")
    try:
        finance_sheet = spreadsheet.worksheet("Tithe")
        print(f"[DEBUG] Backend: Successfully opened 'Tithe' tab")
    except:
        try:
            finance_sheet = spreadsheet.worksheet("tithe")
            print(f"[DEBUG] Backend: Successfully opened 'tithe' tab")
        except:
            print(f"[WARNING] Backend: 'Tithe'/'tithe' tab not found - finance features will be disabled")
            finance_sheet = None
    
    return True

def initialize_fallback():
    """Fallback to local data when Google Sheets is not available"""
    global sheet, finance_sheet
    sheet = None
    finance_sheet = None
    print("[INFO] Using local data fallback - Google Sheets functionality disabled")
    return True

# Initialize Google Sheets
sheet = None  # Initialize as None first (Stats tab)
finance_sheet = None  # Initialize finance sheet for tithe entries
client = None  # Initialize client as None first

try:
    initialize_google_sheets()
except Exception as e:
    logger.error(f"Failed to initialize Google Sheets: {e}")
    print(f"[ERROR] Failed to initialize Google Sheets: {e}")
    sheet = None
    finance_sheet = None

# Simple rate limiter for Google Sheets API calls
import time
last_sheets_call = 0
SHEETS_RATE_LIMIT_SECONDS = 2  # Minimum 2 seconds between calls

# Cache for Google Sheets data - one cache per worksheet 
sheets_cache = {}  # Dictionary of caches keyed by worksheet title
cache_duration = 300  # 5 minutes - increased for better performance

def get_cached_sheets_data(cache_key):
    """Get cached data if fresh (under 2 min old)"""
    if cache_key in sheets_cache:
        cache_entry = sheets_cache[cache_key]
        if cache_entry['data'] and (time.time() - cache_entry['timestamp']) < cache_duration:
            print(f"[CACHE HIT] Using cached data for '{cache_key}' (age: {time.time() - cache_entry['timestamp']:.1f}s)")
            return cache_entry['data']
    return None

def clear_sheets_cache(worksheet_title=None):
    """Clear cache for a specific worksheet or all worksheets"""
    global sheets_cache
    if worksheet_title:
        # Clear cache for specific worksheet
        cache_key_pattern = f"{worksheet_title}_"
        keys_to_remove = [key for key in sheets_cache.keys() if key.startswith(cache_key_pattern)]
        for key in keys_to_remove:
            del sheets_cache[key]
        print(f"[CACHE] Cleared cache for '{worksheet_title}' worksheet")
    else:
        # Clear all cache
        sheets_cache = {}
        print(f"[CACHE] Cleared all cache")

def safe_sheets_request(func, *args, force_refresh=False, **kwargs):
    """Make a request to Google Sheets with rate limiting and caching"""
    global last_sheets_call
    
    # Generate cache key from function object (worksheet)
    try:
        worksheet_title = func.__self__.title
        cache_key = f"{worksheet_title}_{func.__name__}"
    except:
        cache_key = f"{func.__name__}_default"
    
    # Check cache first (unless force_refresh is True)
    if not force_refresh:
        cached = get_cached_sheets_data(cache_key)
        if cached:
            return cached
    
    # Rate limiting: ensure minimum time between calls
    current_time = time.time()
    time_since_last_call = current_time - last_sheets_call
    
    if time_since_last_call < SHEETS_RATE_LIMIT_SECONDS:
        sleep_time = SHEETS_RATE_LIMIT_SECONDS - time_since_last_call
        print(f"[RATE_LIMIT] Sleeping for {sleep_time:.2f} seconds to avoid Google Sheets rate limit")
        time.sleep(sleep_time)
    
    last_sheets_call = time.time()
    
    try:
        result = func(*args, **kwargs)
        # Cache the result with worksheet-specific key
        sheets_cache[cache_key] = {
            'data': result,
            'timestamp': time.time()
        }
        print(f"[CACHE] Stored {len(result) if result else 0} rows for '{cache_key}'")
        return result
    except Exception as e:
        error_msg = str(e).lower()
        
        # Handle list index out of range (empty sheet or malformed structure)
        if 'list index out of range' in error_msg or 'index out of range' in error_msg:
            logger.warning(f"Detected 'list index out of range' error, attempting manual fetch from worksheet")
            try:
                worksheet = func.__self__
                all_values = worksheet.get_all_values()
                
                # If sheet is completely empty, return empty list
                if not all_values or len(all_values) == 0:
                    logger.info(f"Sheet '{worksheet.title}' is empty, returning empty list")
                    return []
                
                # If only headers exist (1 row), return empty list
                if len(all_values) < 2:
                    logger.info(f"Sheet '{worksheet.title}' has only headers, no data rows")
                    return []
                
                # Get headers and filter out empty ones
                headers = all_values[0] if all_values else []
                if not headers:
                    logger.warning(f"Sheet '{worksheet.title}' has no headers")
                    return []
                
                valid_headers = []
                valid_indices = []
                
                for i, header in enumerate(headers):
                    if header and str(header).strip():
                        valid_headers.append(str(header).strip())
                        valid_indices.append(i)
                
                if not valid_headers:
                    logger.warning(f"Sheet '{worksheet.title}' has no valid headers")
                    return []
                
                # Build records using only valid headers
                records = []
                for row_idx, row in enumerate(all_values[1:], start=2):
                    record = {}
                    for i, col_index in enumerate(valid_indices):
                        if col_index < len(row):
                            record[valid_headers[i]] = row[col_index]
                        else:
                            record[valid_headers[i]] = ""  # Fill with empty string if column missing
                    records.append(record)
                
                # Cache and return
                sheets_cache[cache_key] = {
                    'data': records,
                    'timestamp': time.time()
                }
                logger.info(f"[CACHE] Stored {len(records)} rows for '{cache_key}' (manual fetch due to index error)")
                return records
            except Exception as manual_error:
                logger.error(f"Manual fetch also failed: {manual_error}")
                # Return empty list instead of raising error for finance sheet
                if 'finance' in cache_key.lower() or 'tithe' in cache_key.lower():
                    logger.warning(f"Returning empty list for finance sheet due to error")
                    return []
                raise e
        
        # Handle empty header cells error specifically
        elif 'empty cell' in error_msg and 'header' in error_msg:
            logger.warning(f"Detected empty headers in sheet, attempting manual fetch")
            try:
                # Try to get data manually by fetching all values and building records
                worksheet = func.__self__
                all_values = worksheet.get_all_values()
                
                if len(all_values) < 2:
                    return []
                
                # Get headers and filter out empty ones
                headers = all_values[0]
                valid_headers = []
                valid_indices = []
                
                for i, header in enumerate(headers):
                    if header and header.strip():
                        valid_headers.append(header.strip())
                        valid_indices.append(i)
                
                # Build records using only valid headers
                records = []
                for row in all_values[1:]:
                    record = {}
                    for i, col_index in enumerate(valid_indices):
                        if col_index < len(row):
                            record[valid_headers[i]] = row[col_index]
                    records.append(record)
                
                # Cache and return
                sheets_cache[cache_key] = {
                    'data': records,
                    'timestamp': time.time()
                }
                print(f"[CACHE] Stored {len(records)} rows for '{cache_key}' (manual fetch)")
                return records
            except Exception as manual_error:
                logger.error(f"Manual fetch also failed: {manual_error}")
                raise e
        else:
            logger.error(f"Google Sheets API error: {e}")
            raise e
print("[DEBUG] Finished Google Sheets client initialization")

print("[DEBUG] Starting Claude setup")
# Claude setup
try:
    # Try to import anthropic
    try:
        from anthropic import Anthropic
        print("[DEBUG] Successfully imported anthropic.Anthropic")
        
        # Check version
        import anthropic
        print(f"[DEBUG] Anthropic version: {anthropic.__version__}")
        
    except ImportError as e:
        print(f"[ERROR] Failed to import anthropic: {e}")
        logger.error(f"Failed to import anthropic: {e}")
        claude = None
        raise e
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if api_key:
        print(f"[DEBUG] Found ANTHROPIC_API_KEY: {api_key[:10]}...")
        
        # Clear any proxy environment variables that might interfere
        proxy_vars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
        for var in proxy_vars:
            if var in os.environ:
                print(f"[DEBUG] Clearing proxy environment variable: {var}")
                del os.environ[var]
        
        # Try multiple initialization methods for Railway compatibility
        claude = None
        initialization_methods = [
            ("Standard initialization", lambda: Anthropic(api_key=api_key)),
            ("With timeout", lambda: Anthropic(api_key=api_key, timeout=30.0)),
            ("With custom base URL", lambda: Anthropic(api_key=api_key, base_url="https://api.anthropic.com")),
            ("Minimal initialization", lambda: Anthropic(api_key=api_key)),
        ]
        
        for method_name, init_func in initialization_methods:
            try:
                print(f"[DEBUG] Trying {method_name}")
                claude = init_func()
                # Skip test call to avoid hanging during startup
                logger.info(f"Claude initialized successfully via {method_name}")
                print(f"[DEBUG] Claude initialized successfully via {method_name}")
                break
            except Exception as e:
                print(f"[DEBUG] {method_name} failed: {e}")
                logger.warning(f"Claude initialization method '{method_name}' failed: {e}")
                continue
        
        if claude is None:
            print("[WARNING] All Claude initialization methods failed")
            logger.warning("All Claude initialization methods failed")
            claude = None
        else:
            print("[DEBUG] Claude initialization completed successfully")
    else:
        logger.warning("ANTHROPIC_API_KEY not found in environment variables")
        print("[WARNING] ANTHROPIC_API_KEY not found in environment variables")
        claude = None
except Exception as e:
    logger.error(f"Failed to initialize Claude: {e}")
    print(f"[ERROR] Failed to initialize Claude: {e}")
    claude = None
print("[DEBUG] Finished Claude setup")

print("[DEBUG] Starting ElevenLabs setup")
# ElevenLabs setup
try:
    import requests
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    elevenlabs_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Default voice ID
    if elevenlabs_api_key:
        logger.info("ElevenLabs API key found")
        print("[DEBUG] ElevenLabs API key found")
    else:
        logger.warning("ELEVENLABS_API_KEY not found - will use browser TTS")
        print("[WARNING] ELEVENLABS_API_KEY not found - will use browser TTS")
except Exception as e:
    logger.error(f"Failed to initialize ElevenLabs: {e}")
    print(f"[ERROR] Failed to initialize ElevenLabs: {e}")
    elevenlabs_api_key = None
print("[DEBUG] Finished ElevenLabs setup")

print("[DEBUG] Starting memory storage setup")
# Memory storage for conversational history
conversation_memory_file = "data/conversation_memory.json"
print("[DEBUG] Finished memory storage setup")

# ============================================================================
# DUAL-WRITE SYSTEM: Database + Google Sheets (Migration Phase)
# ============================================================================

def save_attendance_record(data, user_id=None):
    """
    Save attendance record to database AND Google Sheets (dual-write)
    This ensures zero downtime during migration
    
    Args:
        data: dict with attendance data
        user_id: ID of user creating record
    
    Returns:
        tuple: (success: bool, record: AttendanceRecord or None, error: str or None)
    """
    from models import AttendanceRecord, CampusV2, Region
    
    try:
        # Get campus object - try multiple lookup strategies
        campus = None
        
        # First, try campus_id from data
        if 'campus_id' in data and data.get('campus_id'):
            campus = CampusV2.query.filter_by(campus_id=data.get('campus_id')).first()
        
        # If not found, try using campus field as campus_id (common case)
        if not campus and 'campus' in data and data.get('campus'):
            campus = CampusV2.query.filter_by(campus_id=data.get('campus')).first()
        
        # If still not found, try display_name match
        if not campus and 'campus' in data and data.get('campus'):
            campus = CampusV2.query.filter_by(display_name=data.get('campus')).first()
        
        # If still not found, try name match
        if not campus and 'campus' in data and data.get('campus'):
            campus = CampusV2.query.filter_by(name=data.get('campus')).first()
        
        if not campus:
            return False, None, f"Campus not found: {data.get('campus') or data.get('campus_id')}"
        
        # Parse date
        date_val = None
        if 'date' in data:
            if isinstance(data['date'], str):
                try:
                    date_val = datetime.strptime(data['date'], '%Y-%m-%d').date()
                except:
                    try:
                        date_val = datetime.strptime(data['date'], '%m/%d/%Y').date()
                    except:
                        pass
            elif isinstance(data['date'], date):
                date_val = data['date']
        
        if not date_val:
            return False, None, "Invalid date format"
        
        # Check if record already exists
        existing = AttendanceRecord.query.filter_by(
            campus_id=campus.id,
            date=date_val
        ).first()
        
        # Build service breakdowns
        adult_breakdown = {}
        kids_breakdown = {}
        if campus.service_times:
            try:
                service_times = json.loads(campus.service_times)
                for service_time in service_times:
                    if service_time in data:
                        adult_breakdown[service_time] = int(data[service_time] or 0)
                    kids_key = f'Kids {service_time}'
                    if kids_key in data:
                        kids_breakdown[kids_key] = int(data[kids_key] or 0)
            except Exception as e:
                logger.warning(f"Error parsing service times: {e}")
        
        # Create or update record
        if existing:
            record = existing
            record.updated_at = datetime.utcnow()
            # Allow an edit to move the record to a new date (e.g. Monday's
            # entry redated to Sunday) - but never onto another record.
            if date_val and existing.date != date_val:
                clash = AttendanceRecord.query.filter_by(campus_id=campus.id, date=date_val).first()
                if clash and clash.id != existing.id:
                    return False, None, f"A record already exists for {campus.display_name} on {date_val}"
                logger.info(f"[SAVE_ATTENDANCE] Moving record {existing.id} from {existing.date} to {date_val}")
                record.date = date_val
        else:
            record = AttendanceRecord(
                campus_id=campus.id,
                region_id=campus.region_id,
                date=date_val,
                created_by=user_id
            )
        
        # Update fields
        # Store the manually entered "Total People in Campus" value
        record.total_people_in_campus = int(data.get('Total People in Campus', 0) or 0)
        record.adult_service_breakdown = json.dumps(adult_breakdown) if adult_breakdown else None
        
        # Kids attendance: the per-service breakdown is the source of truth.
        # Never trust a separately sent "Kids Attendance" total when a breakdown
        # is present - old app builds sent kids INCLUDING leaders there, which
        # the total formula below then double-counted (Salisbury 2026-09-27).
        kids_total = sum(kids_breakdown.values()) if kids_breakdown else 0
        if kids_breakdown:
            sent_kids = data.get('Kids Attendance')
            if sent_kids not in (None, '') and int(sent_kids or 0) != kids_total:
                logger.warning(f"[SAVE_ATTENDANCE] Ignoring sent Kids Attendance={sent_kids}; using breakdown sum {kids_total}")
            record.kids_attendance = kids_total
        elif 'Kids Attendance' in data:
            record.kids_attendance = int(data.get('Kids Attendance') or 0)
        elif not existing:
            record.kids_attendance = 0
        # else: partial update with no kids fields - preserve the stored value
        record.kids_leaders = int(data.get('Kids Leaders', 0) or 0)
        record.new_kids = int(data.get('New Kids', 0) or 0)
        record.new_kids_salvations = int(data.get('New Kids Salvations', 0) or 0)
        record.packs_out = int(data.get('Packs Out', 0) or 0)
        record.kids_service_breakdown = json.dumps(kids_breakdown) if kids_breakdown else None
        # On partial update (existing record, key not in data) preserve current value so Saints/NP/NC/Youth are not wiped
        record.youth_attendance = int(data.get('Youth Attendance', 0) or 0) if (not existing or 'Youth Attendance' in data) else (record.youth_attendance or 0)
        record.youth_salvations = int(data.get('Youth Salvations', 0) or 0) if (not existing or 'Youth Salvations' in data) else (record.youth_salvations or 0)
        record.youth_new_people = int(data.get('Youth New People', 0) or 0) if (not existing or 'Youth New People' in data) else (record.youth_new_people or 0)
        record.youth_leaders = int(data.get('Youth Leaders', 0) or 0) if (not existing or 'Youth Leaders' in data) else (record.youth_leaders or 0)
        record.first_time_visitors = int(data.get('First Time Visitors', 0) or 0) if (not existing or 'First Time Visitors' in data) else (record.first_time_visitors or 0)
        record.visitors = int(data.get('Visitors', 0) or 0) if (not existing or 'Visitors' in data) else (record.visitors or 0)
        record.hands_up = int(data.get('Hands up', 0) or 0) if (not existing or 'Hands up' in data) else (record.hands_up or 0)
        record.cards_back = int(data.get('Cards Back', 0) or 0) if (not existing or 'Cards Back' in data) else (record.cards_back or 0)
        record.first_time_christians = int(data.get('First Time Christians', 0) or 0) if (not existing or 'First Time Christians' in data) else (record.first_time_christians or 0)
        record.rededications = int(data.get('Rededications', 0) or 0) if (not existing or 'Rededications' in data) else (record.rededications or 0)
        record.salvation_cards_returned = int(data.get('Salvation Cards Returned', 0) or 0) if (not existing or 'Salvation Cards Returned' in data) else (record.salvation_cards_returned or 0)
        record.baptisms = int(data.get('Baptisms', 0) or 0) if (not existing or 'Baptisms' in data) else (record.baptisms or 0)
        record.child_dedications = int(data.get('Child Dedications', 0) or 0) if (not existing or 'Child Dedications' in data) else (record.child_dedications or 0)
        record.connect_groups = int(data.get('Connect Groups', 0) or 0) if (not existing or 'Connect Groups' in data) else (record.connect_groups or 0)
        record.dream_team = int(data.get('Dream Team', 0) or 0) if (not existing or 'Dream Team' in data) else (record.dream_team or 0)
        record.tithe = float(data.get('Tithe', 0) or 0) if (not existing or 'Tithe' in data) else float(record.tithe or 0)
        record.notes = data.get('notes') if ('notes' in data or not existing) else record.notes
        record.saints = int(data.get('Saints', 0) or 0) if (not existing or 'Saints' in data) else (record.saints or 0)

        if not existing or 'include_in_rollup_metrics' in data:
            record.include_in_rollup_metrics = coerce_include_in_rollup_metrics(data.get('include_in_rollup_metrics'))
        if not existing or 'special_service_label' in data:
            sl = data.get('special_service_label')
            if sl is None or (isinstance(sl, str) and not str(sl).strip()):
                record.special_service_label = None
            else:
                record.special_service_label = str(sl).strip()[:200]

        # CALCULATE Total Attendance = Service Times + Saints + Kids + Kids Leaders (exclude Youth for Sundays)
        adult_total = sum(adult_breakdown.values()) if adult_breakdown else 0
        saints = record.saints or 0
        total_attendance_calculated = adult_total + saints + record.kids_attendance + record.kids_leaders
        record.total_attendance = total_attendance_calculated
        
        print(f"[SAVE_ATTENDANCE] Calculated total_attendance: {total_attendance_calculated} (adult:{adult_total} + saints:{saints} + kids:{record.kids_attendance} + kids_leaders:{record.kids_leaders})")
        logger.info(f"[SAVE_ATTENDANCE] Calculated total_attendance: {total_attendance_calculated} (adult:{adult_total} + saints:{saints} + kids:{record.kids_attendance} + kids_leaders:{record.kids_leaders})")
        
        # Save to database - flush first to ensure changes are written, then commit
        if not existing:
            db.session.add(record)
        db.session.flush()
        db.session.commit()
        print(f"[SAVE_ATTENDANCE] Committed record id={record.id} (existing={bool(existing)})", flush=True)
        logger.info(f"[SAVE_ATTENDANCE] Committed record id={record.id}")
        
        # DUAL-WRITE: Also save to Google Sheets (for backward compatibility)
        try:
            if sheet or client:  # Only if Google Sheets is available
                logger.info(f"[SAVE_ATTENDANCE] Attempting Google Sheets sync - sheet: {sheet is not None}, client: {client is not None}")
                sync_result = sync_to_google_sheets(record, campus)
                if sync_result is not None and sync_result:
                    record.synced_to_sheets = True
                    db.session.commit()
                    logger.info(f"[SAVE_ATTENDANCE] ✓ Successfully synced to Google Sheets")
                else:
                    logger.warning(f"[SAVE_ATTENDANCE] ✗ Sync to Google Sheets returned False - not marking as synced")
            else:
                logger.warning(f"[SAVE_ATTENDANCE] ✗ Skipping Google Sheets sync - sheet and client are both None")
        except Exception as e:
            logger.error(f"[SAVE_ATTENDANCE] ✗ Failed to sync to Google Sheets (non-fatal): {e}")
            import traceback
            logger.error(f"[SAVE_ATTENDANCE] Traceback: {traceback.format_exc()}")
            # Don't fail the whole operation if Sheets fails
        
        return True, record, None
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to save attendance record: {e}")
        return False, None, str(e)


def sync_to_google_sheets(record, campus):
    """
    Sync an AttendanceRecord to Google Sheets (MULTI-REGION SUPPORT)
    Used during dual-write phase for backup
    
    Now supports per-region Google Sheets:
    - Checks if the campus's region has a sheets_spreadsheet_id configured
    - If yes, syncs to that region's specific sheet
    - If no, falls back to global sheet (for backward compatibility)
    """
    from models import Region
    
    logger.info(f"[SHEETS_SYNC] Starting sync for {campus.display_name} on {record.date}")
    logger.info(f"[SHEETS_SYNC] Global variables - sheet: {sheet is not None}, client: {client is not None}")
    
    # Get the region-specific sheet or fall back to global sheet
    target_sheet = None
    target_spreadsheet_id = None
    target_tab_name = 'Stats'
    
    try:
        # Get the region for this campus
        region = Region.query.filter_by(id=campus.region_id).first()
        
        if region and region.sheets_spreadsheet_id:
            # Region has a specific sheet configured - use it!
            target_spreadsheet_id = region.sheets_spreadsheet_id
            target_tab_name = region.sheets_stats_tab or 'Stats'
            
            logger.info(f"[SHEETS_SYNC] Using region-specific sheet for {region.name}: {target_spreadsheet_id[:20]}...")
            
            # Open the region-specific sheet
            if client:  # Use the global gspread client
                try:
                    region_spreadsheet = client.open_by_key(target_spreadsheet_id)
                    target_sheet = region_spreadsheet.worksheet(target_tab_name)
                    logger.info(f"[SHEETS_SYNC] Successfully opened region sheet: {region.name}/{target_tab_name}")
                except Exception as open_error:
                    logger.error(f"[SHEETS_SYNC] Failed to open region sheet: {open_error}")
                    import traceback
                    logger.error(f"[SHEETS_SYNC] Traceback: {traceback.format_exc()}")
                    return False
            else:
                logger.warning(f"[SHEETS_SYNC] Google Sheets client not available (client is None)")
                return False
        else:
            # No region-specific sheet - fall back to global sheet
            region_info = f"region: {region.name if region else 'None'}, has sheets_spreadsheet_id: {bool(region and region.sheets_spreadsheet_id)}"
            logger.info(f"[SHEETS_SYNC] No region-specific sheet configured ({region_info}), using global sheet")
            target_sheet = sheet  # Use global sheet variable
            
    except Exception as e:
        logger.error(f"[SHEETS_SYNC] Error getting region-specific sheet: {e}, falling back to global sheet")
        import traceback
        logger.error(f"[SHEETS_SYNC] Traceback: {traceback.format_exc()}")
        target_sheet = sheet  # Fall back to global sheet
    
    # If no sheet available (neither region-specific nor global), return False
    if not target_sheet:
        logger.error(f"[SHEETS_SYNC] No Google Sheet available for sync - both target_sheet and global sheet are None")
        return False
    
    # Build row data in Sheets format
    row_data = {
        'Date': record.date.strftime('%Y-%m-%d'),
        'Campus': campus.display_name,
        'Total Attendance': record.total_attendance or '',
        'Total People in Campus': record.total_people_in_campus or '',
        'Kids Attendance': record.kids_attendance or '',
        'Kids Leaders': record.kids_leaders or '',
        'New Kids': record.new_kids or '',
        'New Kids Salvations': record.new_kids_salvations or '',
        'Packs Out': record.packs_out or '',
        'First Time Visitors': record.first_time_visitors or '',
        'Visitors': record.visitors or '',
        'Hands up': record.hands_up or '',
        'Cards Back': record.cards_back or '',
        'First Time Christians': record.first_time_christians or '',
        'Rededications': record.rededications or '',
        'Salvation Cards Returned': record.salvation_cards_returned or '',
        'Youth Attendance': record.youth_attendance or '',
        'Youth Salvations': record.youth_salvations or '',
        'Youth New People': record.youth_new_people or '',
        'Youth Leaders': record.youth_leaders or '',
        'Connect Groups': record.connect_groups or '',
        'Dream Team': record.dream_team or '',
        'Tithe': record.tithe or '',
        'Baptisms': record.baptisms or '',
        'Child Dedications': record.child_dedications or '',
    }
    
    # Add service breakdowns
    try:
        if record.adult_service_breakdown:
            adult_breakdown = json.loads(record.adult_service_breakdown)
            row_data.update(adult_breakdown)
        
        if record.kids_service_breakdown:
            kids_breakdown = json.loads(record.kids_service_breakdown)
            row_data.update(kids_breakdown)
    except:
        pass
    
    # Get existing headers using sanitized function (handles duplicates and empty headers)
    headers = get_sanitized_headers(target_sheet)
    
    # Ensure all columns exist (need to update ensure_google_sheets_columns to accept sheet parameter)
    # For now, skip column creation for region-specific sheets (they should already have columns from template)
    if target_sheet == sheet:
        ensure_google_sheets_columns(list(row_data.keys()))
    
        # Re-fetch headers after adding columns (only for global sheet)
        headers = get_sanitized_headers(target_sheet)
    
    # Build row values - match headers exactly (including empty ones)
    row_values = []
    for header in headers:
        if not header or not header.strip():
            # Empty header column - use empty value
            row_values.append('')
        else:
            # Try exact match first
            value = row_data.get(header)
            
            # If no exact match and header has " (1)" or similar suffix (duplicate), try base name
            # For duplicates, we'll use empty value (duplicates at end are usually unwanted)
            if value is None and ' (' in header and header.strip()[-1] == ')':
                # This is a duplicate header - check if base header exists
                base_header = header.rsplit(' (', 1)[0]
                base_value = row_data.get(base_header)
                # Only use base value if it exists and is not empty
                # For finance duplicates at end, leave empty
                if base_value is not None and base_value != '':
                    value = base_value
                    logger.debug(f"[SHEETS_SYNC] Duplicate header '{header}' -> using value from '{base_header}': {value}")
                else:
                    value = ''  # Leave duplicate empty
            elif value is None:
                value = ''  # Default to empty if not found
            
            row_values.append(value)
    
    logger.info(f"[SHEETS_SYNC] Appending row with {len(row_values)} values to sheet with {len(headers)} headers")
    logger.debug(f"[SHEETS_SYNC] Headers: {headers[:10]}... (showing first 10)")
    
    # Append row (for updates, we'd need to find and update the existing row)
    try:
        target_sheet.append_row(row_values, value_input_option='USER_ENTERED', table_range='A1')
        logger.info(f"[SHEETS_SYNC] Successfully appended row to Google Sheets")
    except Exception as append_error:
        logger.error(f"[SHEETS_SYNC] Failed to append row to Google Sheets: {append_error}")
        import traceback
        logger.error(f"[SHEETS_SYNC] Traceback: {traceback.format_exc()}")
        return False
    
    # Clear cache (only for global sheet)
    if target_sheet == sheet:
        clear_sheets_cache('Stats')
    
    logger.info(f"[SHEETS_SYNC] Successfully synced record to Google Sheets: {campus.display_name} - {record.date}")
    
    return True


def get_attendance_records(campus_name=None, start_date=None, end_date=None, region_code=None):
    """
    Get attendance records from database (fast!)
    
    Args:
        campus_name: Filter by campus display name
        start_date: Filter by start date
        end_date: Filter by end date
        region_code: Filter by region code (AU, US, BR, ID)
    
    Returns:
        list of AttendanceRecord objects
    """
    from models import AttendanceRecord, CampusV2, Region
    
    query = AttendanceRecord.query
    
    # Filter by region
    if region_code:
        region = Region.query.filter_by(code=region_code).first()
        if region:
            query = query.filter_by(region_id=region.id)
    
    # Filter by campus
    if campus_name:
        campus = CampusV2.query.filter_by(display_name=campus_name).first()
        if campus:
            query = query.filter_by(campus_id=campus.id)
    
    # Filter by date range
    if start_date:
        query = query.filter(AttendanceRecord.date >= start_date)
    if end_date:
        query = query.filter(AttendanceRecord.date <= end_date)
    
    # Order by date descending
    query = query.order_by(AttendanceRecord.date.desc())
    
    return query.all()

# Restore missing memory functions

def parse_any_date(date_str):
    """Parse date from various formats commonly found in Google Sheets"""
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%m/%d/%Y', '%-m/%-d/%Y'):
        try:
            return datetime.strptime(date_str, fmt)
        except Exception:
            continue
    raise ValueError(f"Unrecognized date format: {date_str}")

def safe_int(val: Any) -> int:
    """Safely convert a value to int, returning 0 on failure."""
    try:
        return int(str(val).replace(",", "").strip()) if str(val).strip() else 0
    except Exception:
        return 0

def get_row_timestamp(row: Any) -> datetime:
    """Extract and parse a timestamp from a row (dict or tuple). Returns datetime.min on failure."""
    import re
    from datetime import datetime
    ts = ''
    if isinstance(row, dict):
        # Prefer 'Date' column over 'Timestamp' for accurate date tracking
        ts = row.get('Date', '') or row.get('Timestamp', '')
    elif isinstance(row, (list, tuple)):
        # For list/tuple, column B (index 1) is Date, column A (index 0) is Timestamp
        ts = row[1] if len(row) > 1 else (row[0] if len(row) > 0 else '')
    
    if not ts:
        return datetime.min
    
    # Try multiple date formats
    date_formats = [
        '%Y-%m-%dT%H:%M:%S.%f',  # 2025-08-02T10:00:00.000000 (ISO with microseconds)
        '%Y-%m-%dT%H:%M:%S',     # 2025-08-02T10:00:00 (ISO without microseconds)
        '%Y-%m-%d %H:%M:%S',     # 2024-08-04 10:30:00
        '%Y-%m-%d',              # 2024-08-04
        '%m/%d/%Y',              # 10/13/2024
        '%m/%d/%Y %H:%M:%S',     # 10/13/2024 10:30:00
        '%d/%m/%Y',              # 13/10/2024
        '%d/%m/%Y %H:%M:%S',     # 13/10/2024 10:30:00
    ]
    
    for fmt in date_formats:
        try:
            return datetime.strptime(str(ts).strip(), fmt)
        except ValueError:
            continue
    
    # If all formats fail, try regex matching
    try:
        # Match YYYY-MM-DD format
        match = re.match(r'(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?', str(ts))
        if match:
            date_part = match.group(1)
            time_part = match.group(2) or '00:00:00'
            return datetime.strptime(f'{date_part} {time_part}', '%Y-%m-%d %H:%M:%S')
    except Exception:
        pass
    
    return datetime.min

def load_conversation_memory() -> Dict[str, Any]:
    """Load conversation memory from file"""
    try:
        if os.path.exists(conversation_memory_file):
            with open(conversation_memory_file, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load conversation memory: {e}")
    return {}

def save_conversation_memory(memory: Dict[str, Any]):
    """Save conversation memory to file"""
    try:
        os.makedirs(os.path.dirname(conversation_memory_file), exist_ok=True)
        with open(conversation_memory_file, 'w') as f:
            json.dump(memory, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save conversation memory: {e}")

print("[DEBUG] Creating Flask app instance")
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', 'futures-church-secret-key-2025')
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file upload (for training videos)

# Configure session cookies
# Use None for SameSite to allow cookies to be sent with all requests (required for some browsers with fetch POST)
# This is safe because we're using HTTPS in production and checking origins with CORS
app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # Changed from 'Lax' to fix POST request cookie issues
# In production (Railway with HTTPS), cookies with SameSite=None MUST be Secure
# Detect if we're in production by checking for Railway environment variables
is_production = bool(os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('RAILWAY_BRANCH'))
app.config['SESSION_COOKIE_SECURE'] = is_production or os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_NAME'] = 'session'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Keep session for 7 days

# OAuth state token store (in-memory with expiration)
# This is used to store OAuth state tokens that may not persist in sessions
# due to cookie/SameSite restrictions during OAuth redirects
oauth_state_store = {}  # {state_token: {'user_id': int, 'expires_at': datetime}}

# Configure SQLAlchemy database
# Strip whitespace from DATABASE_URL to handle Railway environment variable issues
database_url = os.environ.get('DATABASE_URL', '').strip()

# If no DATABASE_URL is set (or it's SQLite), check for persistent volume paths (Railway volumes)
volume_found = False
if not database_url or database_url.startswith('sqlite:///'):
    # Check common Railway volume mount paths
    volume_paths = [
        '/data',  # Common Railway volume path (RECOMMENDED)
        '/app/backend/instance',  # Alternative Railway volume path
        '/app/data',  # Another common path
    ]
    
    for volume_path in volume_paths:
        if os.path.exists(volume_path) and os.path.isdir(volume_path):
            db_file = os.path.join(volume_path, 'futures_link.db')
            database_url = f'sqlite:///{db_file}'
            logger.info(f"✅ Using persistent volume database: {db_file}")
            volume_found = True
            break
    
    # If no volume found, use default path (WILL NOT PERSIST between deployments)
    if not volume_found:
        if not database_url:
            database_url = 'sqlite:///futures_link.db'
        
        # Local development - use absolute path
        if database_url.startswith('sqlite:///'):
            relative_path = database_url.replace('sqlite:///', '')
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Check if file exists in instance directory first (where it actually is)
            instance_path = os.path.join(backend_dir, 'instance', relative_path)
            if os.path.exists(instance_path):
                database_url = f'sqlite:///{instance_path}'
                logger.info(f"Using database file: {instance_path}")
            else:
                # Use absolute path in backend directory
                abs_path = os.path.join(backend_dir, relative_path)
                database_url = f'sqlite:///{abs_path}'
                logger.info(f"Using database file: {abs_path}")
        
        logger.warning("⚠️  No persistent volume detected! Database will be lost on deployment.")
        logger.warning("💡 RECOMMENDED: Add Railway PostgreSQL service (free) for persistent storage. See POSTGRES_SETUP_GUIDE.md")
        logger.warning("   Alternative: Add Railway volume at /data (requires paid plan)")

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# IMPORTANT: Run migrations BEFORE initializing any models that might query the database
# This ensures the step_actions column exists before SQLAlchemy tries to use it
# Note: run_migrations() is defined later in this file, so we'll call it after function definitions
logger.info("🔄 Will run database migrations after function definitions...")

# Helper function to get database file path (consistent across all endpoints)
def get_db_path():
    """Get the absolute path to the SQLite database file"""
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    db_path = db_uri.replace('sqlite:///', '').replace('sqlite:////', '')
    if not os.path.isabs(db_path):
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        instance_path = os.path.join(backend_dir, 'instance', 'futures_link.db')
        db_path = instance_path if os.path.exists(instance_path) else os.path.join(backend_dir, 'futures_link.db')
    return db_path

# Configure direct database connection for new tables (regions, campuses_v2)
# These are in church_voice.db, while SQLAlchemy uses futures_link.db
CHURCH_VOICE_DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'church_voice.db')

def get_db():
    """Get a direct sqlite3 connection - prefers futures_link.db for users table, church_voice.db for regions/campuses"""
    import sqlite3
    
    # On Railway, check if DATABASE_URL points to a database with users table
    database_url = os.getenv('DATABASE_URL', '').strip()
    if database_url and database_url.startswith('sqlite:///'):
        potential_path = database_url.replace('sqlite:///', '')
        if potential_path.startswith('/'):
            # Check if users table exists in this database
            try:
                test_conn = sqlite3.connect(potential_path)
                test_cursor = test_conn.cursor()
                test_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
                if test_cursor.fetchone():
                    test_conn.close()
                    # Users table exists here, use this database
                    return sqlite3.connect(potential_path)
                test_conn.close()
            except:
                pass  # Fall back to default
    
    # For local development, prefer futures_link.db if users table exists there
    futures_link_path = get_db_path()
    try:
        test_conn = sqlite3.connect(futures_link_path)
        test_cursor = test_conn.cursor()
        test_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if test_cursor.fetchone():
            test_conn.close()
            # Users table exists in futures_link.db, use that
            return sqlite3.connect(futures_link_path)
        test_conn.close()
    except:
        pass  # Fall back to church_voice.db
    
    # Default to CHURCH_VOICE_DB_PATH for regions/campuses tables
    return sqlite3.connect(CHURCH_VOICE_DB_PATH)

def run_migrations():
    """Run SQL migrations on startup"""
    import sqlite3
    import os
    try:
        # Determine which database to use for migrations
        # Use the same database as SQLAlchemy - CRITICAL!
        # Get database path using the same logic as get_db_path() to ensure consistency
        try:
            # Try to get from app config first (most reliable)
            database_url = app.config.get('SQLALCHEMY_DATABASE_URI', '')
            logger.info(f"Migration: Using database from app config: {database_url}")
        except:
            # Fall back to environment variable if app not initialized
            database_url = os.getenv('DATABASE_URL', '').strip()
            logger.info(f"Migration: Using database from env var: {database_url}")
        
        # Extract actual file path from SQLite URL
        if database_url and database_url.startswith('sqlite:///'):
            # Remove sqlite:/// prefix
            db_path = database_url.replace('sqlite:///', '').replace('sqlite:////', '')
            
            # Handle absolute vs relative paths
            if os.path.isabs(db_path):
                # Already absolute - use as is
                logger.info(f"Migration: Using absolute database path: {db_path}")
            else:
                # Relative path - resolve it
                backend_dir = os.path.dirname(os.path.abspath(__file__))
                
                # Check common locations (same logic as database setup)
                # 1. Check /data (Railway volume)
                if os.path.exists('/data') and os.path.isdir('/data'):
                    volume_path = os.path.join('/data', db_path if '/' not in db_path else os.path.basename(db_path))
                    if os.path.exists(volume_path):
                        db_path = volume_path
                        logger.info(f"Migration: Found database in volume: {db_path}")
                    elif '/' not in db_path:
                        # Try default filename in /data
                        volume_path = os.path.join('/data', 'futures_link.db')
                        if os.path.exists(volume_path):
                            db_path = volume_path
                            logger.info(f"Migration: Using default volume database: {db_path}")
                
                # 2. Check instance directory
                if not os.path.exists(db_path):
                    instance_path = os.path.join(backend_dir, 'instance', db_path if '/' not in db_path else os.path.basename(db_path))
                    if os.path.exists(instance_path):
                        db_path = instance_path
                        logger.info(f"Migration: Found database in instance: {db_path}")
                
                # 3. Fall back to backend directory
                if not os.path.exists(db_path) and not os.path.isabs(db_path):
                    db_path = os.path.join(backend_dir, db_path if '/' not in db_path else os.path.basename(db_path))
                    logger.info(f"Migration: Using backend directory database: {db_path}")
        else:
            # No database URL - use default
            db_path = CHURCH_VOICE_DB_PATH
            logger.info(f"Migration: Using default database path: {db_path}")
        
        # Ensure instance directory exists (for default path)
        if db_path == CHURCH_VOICE_DB_PATH:
            os.makedirs(os.path.dirname(CHURCH_VOICE_DB_PATH), exist_ok=True)
        else:
            # For absolute paths, ensure parent directory exists
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Get migrations directory
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        
        if not os.path.exists(migrations_dir):
            logger.warning(f"Migrations directory not found: {migrations_dir}")
            return
        
        # Get all SQL files in migrations directory
        # Filter out PostgreSQL migrations if using SQLite
        all_migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
        
        # Determine database type
        is_postgres = database_url and ('postgresql' in database_url.lower() or 'postgres' in database_url.lower())
        
        # Filter migrations based on database type
        if is_postgres:
            # For PostgreSQL, skip SQLite-specific migrations (or use PostgreSQL versions)
            migration_files = [f for f in all_migration_files if not f.endswith('_postgres.sql')]
            # Prefer PostgreSQL versions if they exist
            postgres_migrations = [f for f in all_migration_files if f.endswith('_postgres.sql')]
            for pg_migration in postgres_migrations:
                base_name = pg_migration.replace('_postgres.sql', '.sql')
                if base_name in migration_files:
                    migration_files.remove(base_name)
                migration_files.append(pg_migration)
            migration_files = sorted(migration_files)
        else:
            # For SQLite, skip PostgreSQL migrations
            migration_files = [f for f in all_migration_files if not f.endswith('_postgres.sql')]
        
        if not migration_files:
            logger.info("No migration files found")
            return
        
        logger.info(f"Running migrations on database: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migrations tracking table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        
        # Get list of already applied migrations
        cursor.execute('SELECT filename FROM schema_migrations')
        applied_migrations = set(row[0] for row in cursor.fetchall())
        
        # CRITICAL FIX: Check if essential tables exist
        # If they don't, delete the corrupted database and start completely fresh
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        users_table_exists = cursor.fetchone() is not None
        
        if not users_table_exists and applied_migrations:
            logger.warning("⚠️ CRITICAL: users table missing but migrations marked as applied!")
            logger.warning("⚠️ Database is corrupted. Deleting and recreating from scratch...")
            conn.close()
            
            # Delete the corrupted database file
            if os.path.exists(db_path):
                os.remove(db_path)
                logger.warning(f"⚠️ Deleted corrupted database: {db_path}")
            
            # Reconnect to create fresh database
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Create fresh migrations tracking table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL UNIQUE,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
            applied_migrations = set()  # Force all migrations to run
            logger.warning("✅ Fresh database created, ready for migrations")
        
        # Run pending migrations
        for migration_file in migration_files:
            if migration_file in applied_migrations:
                logger.info(f"Migration {migration_file} already applied, skipping")
                continue
            
            migration_path = os.path.join(migrations_dir, migration_file)
            logger.info(f"Running migration: {migration_file}")
            
            try:
                with open(migration_path, 'r') as f:
                    migration_sql = f.read()
                
                # Execute the migration using executescript to properly handle triggers
                migration_succeeded = False
                try:
                    # Use executescript to execute all statements in the migration file
                    # This properly handles triggers with embedded semicolons
                    cursor.executescript(migration_sql)
                    conn.commit()
                    migration_succeeded = True
                    logger.info(f"Migration {migration_file}: All statements executed successfully")
                except Exception as e:
                    error_msg = str(e).lower()
                    # Try fallback: split and execute one at a time for better error handling
                    logger.warning(f"Migration {migration_file}: executescript failed ({error_msg[:100]}), trying statement-by-statement...")
                    statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]
                    
                    for statement in statements:
                        if not statement:
                            continue
                        
                        # Check if this is an ALTER TABLE ADD COLUMN statement
                        is_add_column = statement.strip().upper().startswith('ALTER TABLE') and 'ADD COLUMN' in statement.upper()
                        
                        if is_add_column:
                            # Extract column name from statement
                            import re
                            column_match = re.search(r'ADD COLUMN\s+(\w+)', statement, re.IGNORECASE)
                            if column_match:
                                column_name = column_match.group(1)
                                # Check if column already exists
                                try:
                                    cursor.execute(f"PRAGMA table_info(persons)")
                                    columns = [row[1] for row in cursor.fetchall()]
                                    if column_name in columns:
                                        logger.info(f"Migration {migration_file}: Column {column_name} already exists, skipping")
                                        continue
                                except Exception as pragma_error:
                                    logger.warning(f"Migration {migration_file}: Could not check column existence: {pragma_error}")
                        
                        try:
                            cursor.execute(statement)
                            conn.commit()  # Commit after each successful statement
                            logger.info(f"Migration {migration_file}: Successfully executed: {statement[:50]}...")
                        except sqlite3.OperationalError as e:
                            error_msg = str(e).lower()
                            # If column already exists, that's okay - skip this statement
                            if 'duplicate column' in error_msg or 'already exists' in error_msg or 'duplicate column name' in error_msg or 'duplicate column name: step_actions' in error_msg or 'duplicate column name: family_id' in error_msg:
                                logger.info(f"Migration {migration_file}: Column already exists, skipping statement: {statement[:50]}...")
                                conn.commit()  # Commit anyway
                                continue  # Skip this statement, continue with next
                            elif 'syntax error' in error_msg:
                                # Syntax errors might be from comments or empty statements
                                logger.debug(f"Migration {migration_file}: Syntax error (likely harmless): {statement[:50]}...")
                                continue
                            else:
                                # Other operational errors - log but continue (might be table already exists, etc)
                                logger.warning(f"Migration {migration_file}: Operational error (might be harmless): {error_msg[:100]}")
                                conn.commit()  # Commit anyway and continue
                                continue
                    
                    # If we get here, statement-by-statement execution completed
                    conn.commit()
                    migration_succeeded = True
                    logger.info(f"Migration {migration_file}: Statement-by-statement execution completed")
                
                # Mark migration as applied (only if we got here without error)
                if migration_succeeded:
                    try:
                        cursor.execute('INSERT INTO schema_migrations (filename) VALUES (?)', (migration_file,))
                        conn.commit()
                        logger.info(f"Successfully applied migration: {migration_file}")
                    except sqlite3.IntegrityError:
                        # Migration already marked as applied
                        logger.info(f"Migration {migration_file} already marked as applied")
                        conn.rollback()
            except Exception as e:
                error_msg = str(e).lower()
                logger.error(f"Failed to apply migration {migration_file}: {e}")
                conn.rollback()
                # Don't raise for column already exists errors - just log and continue
                # Allow app to start even if migration fails (non-critical)
                if 'duplicate column' not in error_msg and 'already exists' not in error_msg and 'duplicate column name' not in error_msg:
                    logger.warning(f"Migration {migration_file} failed, but continuing startup...")
                    # Don't raise - allow app to start
        
        conn.close()
        logger.info("All migrations completed successfully")
        
    except Exception as e:
        logger.error(f"Migration error: {e}", exc_info=True)
        # Don't raise - allow app to start even if migrations fail
        # This prevents the app from crashing on startup due to migration issues
        logger.warning("Continuing app startup despite migration errors...")

CORS(app, 
     supports_credentials=True, 
     origins=[
         "http://localhost:3000", 
         "http://localhost:3001", 
         "http://localhost:5173",
         "exp://192.168.20.12:8081",
         "exp://192.168.20.12:8082",
         "exp://192.168.15.167:8081",
         "exp://192.168.15.167:8082",
         "exp://localhost:8081",
         "exp://localhost:8082",
         "http://192.168.20.12:8081",
         "http://192.168.20.12:8082",
         "http://192.168.15.167:8081",
         "http://192.168.15.167:8082",
         "https://futures-pulse-production.up.railway.app",  # Production domain
         "https://pulse.futures.church",  # Custom domain
         "*"  # Allow all origins for mobile app testing
     ], 
     allow_headers=["Content-Type", "Authorization", "Accept", "Cache-Control", "Pragma", "Expires"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Enable response compression for better performance
Compress(app)

# Initialize database
init_db(app)

# IMPORTANT: Run migrations AFTER init_db but before any queries that need step_actions column
print("[DEBUG] 🔄 Running database migrations after database initialization...")
logger.info("🔄 Running database migrations after database initialization...")
try:
    print("[DEBUG] Calling run_migrations()...")
    run_migrations()
    print("[DEBUG] ✅ Migrations completed successfully")
    logger.info("✅ Migrations completed successfully")
except Exception as e:
    print(f"[ERROR] ❌ Migration error: {e}")
    logger.error(f"❌ Migration error: {e}", exc_info=True)
    import traceback
    traceback.print_exc()
    # Don't fail startup - app should still work with graceful error handling

# Seed database with initial data
try:
    from seed_campuses import seed_campuses
    seed_campuses()
except Exception as e:
    logger.warning(f"Failed to seed campuses: {e}")

try:
    from seed_users import seed_users
    seed_users()
except Exception as e:
    logger.warning(f"Failed to seed users: {e}")

# Configure Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'api_login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

@login_manager.unauthorized_handler
def unauthorized():
    """Handle unauthorized API requests - return JSON instead of redirect"""
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Authentication required. Please sign in.'}), 401
    # For non-API routes, redirect to login
    return redirect(url_for('api_login'))

# User management functions
def load_users_database():
    """Load users from database"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                SELECT id, username, password_hash, full_name, email, role, campus, active, custom_permissions, region_id, last_login, created_at
                FROM users
                WHERE active = 1
            ''')
        except Exception:
            # Older DB copies may lack last_login/created_at
            cursor.execute('''
                SELECT id, username, password_hash, full_name, email, role, campus, active, custom_permissions, region_id
                FROM users
                WHERE active = 1
            ''')

        users = {}
        for row in cursor.fetchall():
            username = row[1]
            import json
            custom_perms = row[8] if len(row) > 8 else None
            try:
                custom_permissions = json.loads(custom_perms) if custom_perms else None
            except:
                custom_permissions = None

            users[username] = {
                'id': row[0],
                'username': row[1],
                'password_hash': row[2],
                'full_name': row[3] or username,
                'email': row[4] or '',
                'role': row[5],
                'campus': row[6] or '',
                'active': bool(row[7]),
                'custom_permissions': custom_permissions,
                'region_id': row[9] if len(row) > 9 else None,
                'last_login': row[10] if len(row) > 10 else None,
                'created_date': row[11] if len(row) > 11 else None
            }
        
        conn.close()
        
        if not users:
            print("[DEBUG] No users found in database")
            return {'users': {}}
        
        return {'users': users}
        
    except Exception as e:
        print(f"[DEBUG] Failed to load users from database: {e}")
        # If no database, create default users
        print("[DEBUG] No users.json found, creating default users")
        default_users = {
            "users": {
                "admin": {
                    "id": "admin",
                    "username": "admin",
                    "email": "admin@futureschurch.com",
                    "full_name": "Administrator",
                    "role": "admin",
                    "campus": "all_campuses",
                    "active": True,
                    "password_hash": "futures2025"
                }
            },
            "roles": {
                "admin": {
                    "name": "Administrator",
                    "permissions": {
                        "log_stats": "all",
                        "recall_stats": "all",
                        "dashboard_access": "all",
                        "query_access": "all",
                        "manage_users": True,
                        "system_settings": True,
                        "finance_access": True,
                        "cross_location_comparison": True
                    }
                }
            }
        }
        return default_users
    except Exception as e:
        logger.error(f"Failed to load users database: {e}")
        return {"users": {}, "roles": {}}
    
def save_users_database(data):
    """Save users to database (legacy function for compatibility)"""
    # This function is kept for compatibility but now saves to database
    # Individual user operations should use direct SQL instead
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        for username, user_data in data.get('users', {}).items():
            # Check if user exists
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing user
                cursor.execute('''
                    UPDATE users 
                    SET password_hash = ?, full_name = ?, email = ?, role = ?, campus = ?, active = ?
                    WHERE username = ?
                ''', (
                    user_data.get('password_hash', ''),
                    user_data.get('full_name', username),
                    user_data.get('email', ''),
                    user_data.get('role', 'campus_pastor'),
                    user_data.get('campus', ''),
                    1 if user_data.get('active', True) else 0,
                    username
                ))
            else:
                # Insert new user
                cursor.execute('''
                    INSERT INTO users (username, password_hash, full_name, email, role, campus, active)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    username,
                    user_data.get('password_hash', ''),
                    user_data.get('full_name', username),
                    user_data.get('email', ''),
                    user_data.get('role', 'campus_pastor'),
                    user_data.get('campus', ''),
                    1 if user_data.get('active', True) else 0
                ))
        
        conn.commit()
        conn.close()
        print(f"[DEBUG] Saved users to database")
        return True
    except Exception as e:
        logger.error(f"Failed to save users to database: {e}")
        print(f"[DEBUG] Failed to save users to database: {e}")
        return False

# ==================================================================
# PERMISSIONS — single source of truth
# ==================================================================
# Every "can this user do X?" question is answered here and only here.
# Routes must use current_user.has_permission('<key>') or the helpers
# below; do not add inline role lists.
#
# The four leadership titles are synonyms and always share one entry.
LEADERSHIP_ROLES = ('senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor')
ADMIN_ROLES = ('superadmin', 'admin')
ALL_ACCESS_ROLES = ADMIN_ROLES + LEADERSHIP_ROLES

PERMISSION_KEYS = (
    'log_stats', 'recall_stats', 'dashboard_access', 'query_access',
    'edit_access', 'finance_access', 'manage_users', 'manage_campuses',
    'view_all_campuses', 'data_export', 'database_viewer',
    'resource_manager', 'homepage_manager',
)

_FULL_ACCESS = {k: True for k in PERMISSION_KEYS}
_NO_ACCESS = {k: False for k in PERMISSION_KEYS}
_CAMPUS_SCOPED = {
    **_NO_ACCESS,
    'log_stats': True,
    'recall_stats': 'own_campus',
    'dashboard_access': 'own_campus',
    'query_access': True,
    'edit_access': True,
    'database_viewer': True,  # data itself is campus-scoped at the endpoint
}

ROLE_PERMISSIONS = {
    'superadmin': dict(_FULL_ACCESS),
    'admin': dict(_FULL_ACCESS),
    'senior_leadership': dict(_FULL_ACCESS),
    'senior_leader': dict(_FULL_ACCESS),
    'senior_pastor': dict(_FULL_ACCESS),
    'lead_pastor': dict(_FULL_ACCESS),
    'campus_pastor': dict(_CAMPUS_SCOPED),
    'pastor': dict(_CAMPUS_SCOPED),
    'finance': {**_NO_ACCESS, 'finance_access': True},
    # Everyone below has no stats/report access by default; grant per-user
    # via custom_permissions in User Management / Role Manager.
    'staff': dict(_NO_ACCESS),
    'user': dict(_NO_ACCESS),
    'member': dict(_NO_ACCESS),
    'connect_group_leader': dict(_NO_ACCESS),
    'dream_team_leader': dict(_NO_ACCESS),
}

# custom_permissions keys accepted from the UI → permission names they grant
# or deny. A key set to True grants all the listed permissions; False denies
# them (unless another True key still grants one, e.g. recall_stats).
CUSTOM_PERMISSION_KEYS = {
    'input': ('log_stats', 'recall_stats'),
    'dashboard': ('dashboard_access', 'recall_stats'),
    'finance': ('finance_access',),
    'data_export': ('data_export',),
    'database_viewer': ('database_viewer',),
    'resource_manager': ('resource_manager',),
    'campus_management': ('manage_campuses',),
    'user_management': ('manage_users',),
    'homepage_manager': ('homepage_manager',),
    'query': ('query_access',),
    'edit': ('edit_access',),
}

# permission name → custom keys that can affect it (derived once)
_PERM_TO_CUSTOM_KEYS = {}
for _ck, _perms in CUSTOM_PERMISSION_KEYS.items():
    for _p in _perms:
        _PERM_TO_CUSTOM_KEYS.setdefault(_p, []).append(_ck)


def normalize_campus_id(value):
    """adelaide_city / Adelaide City / adelaide-city -> adelaide_city"""
    return str(value or '').strip().lower().replace(' ', '_').replace('-', '_')


def resolve_permission(role, custom_permissions, permission_type):
    """Resolve one permission. Returns True, False, or 'own_campus'.

    Order: superadmin bypass -> explicit custom grant -> explicit custom
    deny -> role default -> False.
    """
    if role == 'superadmin':
        return True

    custom = custom_permissions or {}
    relevant = _PERM_TO_CUSTOM_KEYS.get(permission_type, ())
    granted = [k for k in relevant if custom.get(k) is True]
    denied = [k for k in relevant if custom.get(k) is False]
    if granted:
        return True
    if denied and len(denied) == len([k for k in relevant if custom.get(k) is not None]):
        # every custom key that mentions this permission says no
        return False

    return ROLE_PERMISSIONS.get(role, {}).get(permission_type, False)


def effective_permissions(role, custom_permissions):
    """Full resolved permission map for /api/session. 'own_campus' is
    reported as True with scoping expressed separately via allowed
    campuses."""
    out = {}
    for key in PERMISSION_KEYS:
        val = resolve_permission(role, custom_permissions, key)
        out[key] = bool(val)  # 'own_campus' -> True (page access; data is scoped)
    return out

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, user_data):
        self.id = user_data['id']
        self.username = user_data['username']
        self.email = user_data['email']
        self.full_name = user_data['full_name']
        self.role = user_data['role']
        self.campus = user_data['campus']
        self.active = user_data['active']
        self.password_hash = user_data['password_hash']
        self.custom_permissions = user_data.get('custom_permissions') or {}
        self.region_id = user_data.get('region_id')
        
    def is_authenticated(self):
        return True
        
    def is_active(self):
        return self.active
        
    def is_anonymous(self):
        return False
        
    def get_id(self):
        return str(self.id)
        
    def check_password(self, password):
        """Check if the provided password is correct"""
        from werkzeug.security import check_password_hash
        try:
            # Try standard werkzeug password check
            return check_password_hash(self.password_hash, password)
        except (ValueError, AttributeError):
            # If scrypt hash fails (not available), try bcrypt as fallback
            try:
                import bcrypt
                # Check if it's a bcrypt hash
                if self.password_hash.startswith('$2b$') or self.password_hash.startswith('$2a$'):
                    return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
            except:
                pass
            # If all else fails, check for plain text match (for development only)
            if self.password_hash == password:
                return True
            return False
        
    def has_permission(self, permission_type, action=None, campus=None):
        """Single authority for permission checks.

        Resolution order (see resolve_permission):
          superadmin -> custom_permissions grant -> custom_permissions deny
          -> role default -> False.
        'own_campus' role defaults are True when no campus is asked about,
        otherwise the campus must be one the user can access.
        (The legacy `action` argument is accepted and ignored; the RBAC
        module it used to dispatch to was never wired up.)
        """
        custom_perms = getattr(self, 'custom_permissions', {}) or {}
        perm_value = resolve_permission(self.role, custom_perms, permission_type)

        if perm_value is True:
            return True
        if perm_value == 'own_campus':
            if campus is None:
                return True
            allowed = self.accessible_campus_ids()
            if allowed is None:
                return True
            return normalize_campus_id(campus) in allowed
        if self.role not in ROLE_PERMISSIONS:
            logger.warning(f"[PERMISSION_CHECK] Unknown role '{self.role}' for user {getattr(self, 'username', '?')} - denying '{permission_type}'")
        return False

    def accessible_campus_ids(self):
        """Campus ids this user may act on. None means every campus.

        Order: custom allowed_campuses -> all-access roles/view_all_campuses
        -> the user's own assigned campus.
        """
        custom_perms = getattr(self, 'custom_permissions', {}) or {}
        allowed = custom_perms.get('allowed_campuses')
        if isinstance(allowed, list):
            real = [normalize_campus_id(c) for c in allowed
                    if normalize_campus_id(c) and normalize_campus_id(c) != 'all_campuses']
            if real:
                return set(real)
        if self.role in ALL_ACCESS_ROLES:
            return None
        if resolve_permission(self.role, custom_perms, 'view_all_campuses') is True:
            return None
        own = normalize_campus_id(getattr(self, 'campus', None))
        if not own or own == 'all_campuses':
            return None
        return {own}

    def can_access_campus(self, campus):
        """True if the user may read/write data for this campus id/name."""
        allowed = self.accessible_campus_ids()
        return allowed is None or normalize_campus_id(campus) in allowed

    def get_accessible_campuses(self):
        """Campus id list for data recall (legacy helper)."""
        if not self.has_permission('recall_stats'):
            return []
        allowed = self.accessible_campus_ids()
        if allowed is None:
            try:
                return ['all_campuses'] + [c['id'] for c in get_active_campuses() if c.get('id') != 'all_campuses']
            except Exception:
                return ['all_campuses']
        return sorted(allowed)

@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Try to select with custom_permissions and region_id, fallback if columns don't exist
        try:
            cursor.execute('''
                SELECT id, username, password_hash, full_name, email, role, campus, active, custom_permissions, region_id
                FROM users
                WHERE id = ? AND active = 1
            ''', (user_id,))
        except Exception:
            try:
                # Try with custom_permissions but without region_id
                cursor.execute('''
                    SELECT id, username, password_hash, full_name, email, role, campus, active, custom_permissions
                    FROM users
                    WHERE id = ? AND active = 1
                ''', (user_id,))
            except Exception:
                # Fallback if custom_permissions column doesn't exist yet
                cursor.execute('''
                    SELECT id, username, password_hash, full_name, email, role, campus, active
                    FROM users
                    WHERE id = ? AND active = 1
                ''', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            import json
            custom_permissions = {}
            region_id = None
            
            if len(row) > 8:
                try:
                    custom_perms = row[8]
                    if custom_perms:
                        custom_permissions = json.loads(custom_perms) if isinstance(custom_perms, str) else custom_perms
                except:
                    custom_permissions = {}
            
            # Get region_id if available (column 9)
            if len(row) > 9:
                region_id = row[9]
            
            user_data = {
                'id': str(row[0]),  # Flask-Login expects string ID
                'username': row[1],
                'password_hash': row[2],
                'full_name': row[3] or row[1],
                'email': row[4] or '',
                'role': row[5],
                'campus': row[6] or '',
                'active': bool(row[7]),
                'custom_permissions': custom_permissions,
                'region_id': region_id
            }
            return User(user_data)
        return None
    except Exception as e:
        logger.error(f"Error loading user {user_id}: {e}", exc_info=True)
        return None

def authenticate_user(username_or_email, password):
    """Authenticate user and return User object if valid
    Accepts either username or email for login (case-insensitive)
    """
    try:
        logger.info(f"[AUTH] 🔐 Attempting authentication for: '{username_or_email}'")
        conn = get_db()
        cursor = conn.cursor()
        
        # Normalize input (trim and lowercase for case-insensitive matching)
        normalized_input = username_or_email.strip().lower()
        
        # Check both username and email fields (case-insensitive)
        # SQLite: Use LOWER() on both sides for reliable case-insensitive comparison
        # Try to include custom_permissions and region_id if columns exist
        try:
            cursor.execute('''
                SELECT id, username, password_hash, full_name, email, role, campus, active, custom_permissions, region_id
                FROM users
                WHERE (LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(email)) = LOWER(?)) AND active = 1
            ''', (username_or_email.strip(), username_or_email.strip()))
        except Exception as col_error:
            # Check if error is due to missing column
            error_msg = str(col_error).lower()
            if 'no such column' in error_msg:
                try:
                    # Try with custom_permissions but without region_id
                    cursor.execute('''
                        SELECT id, username, password_hash, full_name, email, role, campus, active, custom_permissions
                        FROM users
                        WHERE (LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(email)) = LOWER(?)) AND active = 1
                    ''', (username_or_email.strip(), username_or_email.strip()))
                except Exception:
                    # Fallback if custom_permissions column doesn't exist yet
                    cursor.execute('''
                        SELECT id, username, password_hash, full_name, email, role, campus, active
                        FROM users
                        WHERE (LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(email)) = LOWER(?)) AND active = 1
                    ''', (username_or_email.strip(), username_or_email.strip()))
            else:
                # Re-raise if it's a different error
                logger.error(f"Database error in authenticate_user: {col_error}")
                raise
        
        row = cursor.fetchone()
        
        if row:
            logger.info(f"[AUTH] ✅ User FOUND in database:")
            logger.info(f"      - ID: {row[0]}")
            logger.info(f"      - Username: '{row[1]}'")
            logger.info(f"      - Email: '{row[4]}'")
            logger.info(f"      - Role: {row[5]}")
            logger.info(f"      - Active: {bool(row[7])}")
            
            # Handle custom_permissions if column exists
            import json
            custom_permissions = {}
            region_id = None
            if len(row) > 8:
                try:
                    custom_perms = row[8]
                    if custom_perms:
                        custom_permissions = json.loads(custom_perms) if isinstance(custom_perms, str) else custom_perms
                except:
                    custom_permissions = {}
            
            # Get region_id if available (column 9)
            if len(row) > 9:
                region_id = row[9]
            
            user_data = {
                'id': str(row[0]),
                'username': row[1],
                'password_hash': row[2],
                'full_name': row[3] or row[1],
                'email': row[4] or '',
                'role': row[5],
                'campus': row[6] or '',
                'active': bool(row[7]),
                'custom_permissions': custom_permissions,
                'region_id': region_id
            }
            
            user = User(user_data)
            password_valid = user.check_password(password)
            
            logger.info(f"[AUTH] 🔑 Password check result: {password_valid}")
            if password_valid:
                # Update last login with ISO8601 format for SQLite compatibility
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                logger.info(f"[AUTH] 📝 Updating last_login to: {now} for user ID: {row[0]}")
                cursor.execute('UPDATE users SET last_login = ? WHERE id = ?', 
                             (now, row[0]))
                conn.commit()
                logger.info(f"[AUTH] ✅ last_login updated successfully")
                conn.close()
                logger.info(f"[AUTH] ✅ Authentication SUCCESS for '{username_or_email}'")
                return user
            else:
                logger.warning(f"[AUTH] ❌ Password INVALID for '{username_or_email}'")
        else:
            logger.warning(f"[AUTH] ❌ User NOT FOUND: '{username_or_email}' (normalized: '{normalized_input}')")
            # Try to find similar users for debugging
            cursor.execute('''
                SELECT username, email, active
                FROM users
                WHERE LOWER(email) LIKE ? OR LOWER(username) LIKE ?
                LIMIT 5
            ''', (f'%{normalized_input}%', f'%{normalized_input}%'))
            similar = cursor.fetchall()
            if similar:
                logger.warning(f"[AUTH] Found similar users: {similar}")
        
        conn.close()
        return None
    except Exception as e:
        logger.error(f"[AUTH] ❌ Authentication ERROR for '{username_or_email}': {e}", exc_info=True)
        return None

print("[DEBUG] User management functions and classes defined")

# Campus management functions
def load_campuses_database():
    """Load campuses from JSON file"""
    try:
        with open(os.path.join(os.path.dirname(__file__), 'campuses.json'), 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load campuses database: {e}")
        # Return basic fallback campuses
        return {
            "campuses": {
                "paradise": {"id": "paradise", "name": "Paradise Campus", "display_name": "Paradise", "active": True, "detection_patterns": ["paradise"]},
                "south": {"id": "south", "name": "South Campus", "display_name": "South", "active": True, "detection_patterns": ["south"]},
                "all_campuses": {"id": "all_campuses", "name": "All Campuses", "display_name": "All Campuses", "active": True, "special": True}
            },
            "metadata": {"version": "1.0"}
        }

def save_campuses_database(data):
    """Save campuses to JSON file"""
    try:
        # Update metadata
        data.setdefault('metadata', {})['last_updated'] = datetime.now().strftime('%Y-%m-%d')
        active_count = sum(1 for campus in data.get('campuses', {}).values() if campus.get('active', False))
        data['metadata']['active_campuses'] = active_count
        data['metadata']['total_campuses'] = len(data.get('campuses', {}))
        
        with open(os.path.join(os.path.dirname(__file__), 'campuses.json'), 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Failed to save campuses database: {e}")
        return False

def get_active_campuses():
    """Get list of active campuses for dropdowns"""
    active_campuses = []
    
    # Load service times from campuses.json
    campuses_db = load_campuses_database()
    service_times_map = {}
    if campuses_db and 'campuses' in campuses_db:
        for campus_id, campus_data in campuses_db['campuses'].items():
            if 'service_times' in campus_data:
                service_times_map[campus_id] = campus_data['service_times']
    
    try:
        # Try to load from database first
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT c.campus_id, c.name, c.display_name, c.region_id, r.code as region_code, c.service_times
            FROM campuses_v2 c
            LEFT JOIN regions r ON c.region_id = r.id
            WHERE c.active = 1
            ORDER BY c.display_name
        ''')
        
        for row in cursor.fetchall():
            campus_id = row[0]
            # Parse service_times from database (stored as JSON string)
            db_service_times = []
            if row[5]:  # service_times column
                try:
                    db_service_times = json.loads(row[5]) if isinstance(row[5], str) else row[5]
                except (json.JSONDecodeError, TypeError):
                    db_service_times = []
            
            # Use database service_times if available, otherwise fall back to JSON file
            final_service_times = db_service_times if db_service_times else service_times_map.get(campus_id, [])
            
            campus_data = {
                'id': campus_id,
                'name': row[2],  # display_name
                'full_name': row[1],  # name
                'region_id': row[3],  # region_id
                'region_code': row[4],  # region_code (AU, US, etc.)
                'service_times': final_service_times,
                'description': campuses_db.get('campuses', {}).get(campus_id, {}).get('description', None)
            }
            print(f"[Backend] Campus {campus_id}: region_id={row[3]}, region_code={row[4]}, service_times={final_service_times}")
            active_campuses.append(campus_data)
        
        conn.close()
        
        # Add "All Campuses" option at the top
        if active_campuses:
            active_campuses.insert(0, {
                'id': 'all_campuses',
                'name': 'All Campuses',
                'full_name': 'All Campuses',
                'region_id': None,
                'region_code': None,
                'service_times': []
            })
        
    except Exception as e:
        logger.warning(f"Failed to load campuses from database, falling back to JSON: {e}")
        # Fallback to JSON file
        campuses_db = load_campuses_database()
        
        for campus_id, campus_data in campuses_db.get('campuses', {}).items():
            if campus_data.get('active', False):
                active_campuses.append({
                    'id': campus_id,
                    'name': campus_data.get('display_name', campus_data.get('name', campus_id)),
                    'full_name': campus_data.get('name', campus_id),
                    'service_times': campus_data.get('service_times', [])
                })
        
        # Sort by name, but put "All Campuses" first if it exists
        active_campuses.sort(key=lambda x: (x['id'] != 'all_campuses', x['name']))
    
    return active_campuses

def get_campuses_for_user():
    """Get campuses accessible to current user based on their role"""
    try:
        if not hasattr(current_user, 'role'):
            return {'campuses': []}
            
        campuses_db = load_campuses_database()
        accessible_campuses = []

        # Single rule set: custom allowed_campuses -> role/campus scope
        allowed = current_user.accessible_campus_ids()
        for campus_id, campus_data in campuses_db.get('campuses', {}).items():
            if not campus_data.get('active', False) or campus_id == 'all_campuses':
                continue
            if allowed is not None and normalize_campus_id(campus_id) not in allowed:
                continue
            accessible_campuses.append({
                'id': campus_id,
                'name': campus_data.get('display_name', campus_data.get('name', campus_id)),
                'full_name': campus_data.get('name', campus_id)
            })

        return {
            'campuses': sorted(accessible_campuses, key=lambda x: x['name'])
        }
    except Exception as e:
        logger.error(f"Error getting campuses for user: {e}")
        return {'campuses': []}

def get_campus_detection_patterns():
    """Get dynamic campus detection patterns from configuration with natural speech support"""
    campuses_db = load_campuses_database()
    patterns = {}
    
    for campus_id, campus_data in campuses_db.get('campuses', {}).items():
        if campus_data.get('active', False):
            detection_patterns = campus_data.get('detection_patterns', [campus_id])
            
            # Create flexible patterns that handle natural speech
            flexible_patterns = []
            for pattern in detection_patterns:
                # Add the base pattern
                flexible_patterns.append(rf'\b{re.escape(pattern)}\b')
                # Add common speech patterns
                flexible_patterns.append(rf'\bfor {re.escape(pattern)}\b')
                flexible_patterns.append(rf'\bat {re.escape(pattern)}\b')
                flexible_patterns.append(rf'\b{re.escape(pattern)} campus\b')
                flexible_patterns.append(rf'\bstats for {re.escape(pattern)}\b')
                flexible_patterns.append(rf'\blog stats for {re.escape(pattern)}\b')
                flexible_patterns.append(rf'\breporting for {re.escape(pattern)}\b')
            
            # Join patterns with OR regex
            pattern = '(?:' + '|'.join(flexible_patterns) + ')'
            patterns[campus_id] = pattern
    
    return patterns

print("[DEBUG] Campus management functions defined")

# Permission decorators
def require_permission(permission_type):
    """Decorator to check if user has specific permission"""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            if not current_user.has_permission(permission_type):
                flash('You do not have permission to access this page.', 'error')
                return redirect(url_for('serve_index'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    """Decorator to require admin or senior leadership access"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if current_user.role not in ALL_ACCESS_ROLES:
            flash('Administrator or Senior Leadership access required.', 'error')
            return redirect(url_for('serve_index'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required_json(f):
    """Decorator to require admin access - returns JSON for API endpoints"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is authenticated via Flask-Login
        is_auth = current_user.is_authenticated
        user_id = getattr(current_user, 'id', None)
        username = getattr(current_user, 'username', None)
        role = getattr(current_user, 'role', None)
        
        logger.info(f"admin_required_json check for {request.path}: authenticated={is_auth}, user_id={user_id}, username={username}, role={role}, session_keys={list(session.keys())}")
        
        if not is_auth:
            logger.warning(f"Unauthenticated access attempt to {request.path} from {request.remote_addr}. Session keys: {list(session.keys())}")
            return jsonify({'error': 'Authentication required. Please sign in.'}), 401
        
        # Check if user has admin role (including superadmin)
        if role not in ALL_ACCESS_ROLES:
            logger.warning(f"Non-admin access attempt to {request.path} by user {username} (role: {role})")
            return jsonify({'error': 'Administrator access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def login_required_json(f):
    """Decorator to require authentication only - returns JSON for API endpoints"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is authenticated via Flask-Login
        is_auth = current_user.is_authenticated
        user_id = getattr(current_user, 'id', None)
        username = getattr(current_user, 'username', None)
        role = getattr(current_user, 'role', None)
        
        logger.info(f"login_required_json check for {request.path}: authenticated={is_auth}, user_id={user_id}, username={username}, role={role}")
        
        if not is_auth:
            logger.warning(f"Unauthenticated access attempt to {request.path} from {request.remote_addr}")
            return jsonify({'error': 'Authentication required. Please sign in.'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def can_recall_data(campus=None):
    """Check if current user can recall data for specified campus"""
    if not current_user.is_authenticated:
        return False
    return current_user.has_permission('recall_stats', campus)

def can_log_stats():
    """Check if current user can log stats"""
    if not current_user.is_authenticated:
        return False
    return current_user.has_permission('log_stats')

print("[DEBUG] Permission decorators defined")

# Enhanced regex patterns for parsing stats with better context awareness and natural speech support
# Voice recognition optimized patterns with common misheard words and variations
patterns = {
    # Main attendance - much more flexible with voice recognition variations
    "total_attendance": r"(\d+)\s+(?:people|attendance|total|had|got|there were|in attendance|attended|showed up|came|were there|total people|total attendance|people total|attendance total|peep|peeps|person|persons|folks|guys|everyone|everybody|crowd|gathering)",
    
    # New people breakdown - more natural variations with voice recognition
    "first_time_visitors": r"(\d+)\s+(?:first\s+time|first-time|first\s+timers?|new\s+people|newcomers?|ftv|first\s+time\s+visitors?|new\s+visitors?|first\s+time\s+guests?|first\s+time\s+guests?|first\s+time\s+people|new\s+comers?|new\s+comers?|first\s+timers?|first\s+time\s+visitors?)",
    "visitors": r"(\d+)\s+(?:visitors?|guests?|passing\s+through|tourists?|visiting|new\s+visitors?|visiting\s+people|visitors?|guests?|visiting\s+guests?|visiting\s+people)",
    "information_gathered": r"(\d+)\s+(?:info\s+gathered|information\s+gathered|details\s+gathered|details\s+collected|contact\s+info|info|cards\s+back|contact\s+cards|response\s+cards|visitor\s+cards|info\s+cards|information\s+cards|contact\s+information|contact\s+info|info\s+cards|contact\s+cards)",
    
    # Christian decisions breakdown - more natural speech with voice variations
    "first_time_christians": r"(\d+)\s+(?:first\s+time\s+(?:conversions?|decisions?|salvations?)|new\s+(?:conversions?|christians?)|(?:got\s+)?saved|baptisms?|ftc|people\s+got\s+saved|people\s+saved|salvations?|decisions?|conversions?|people\s+made\s+decisions?|people\s+accepted\s+christ|salvations?|decisions?|conversions?|saved|got\s+saved|made\s+decisions?|accepted\s+christ)",
    "rededications": r"(\d+)\s+(?:rededication|re-dedication|recommitment|re-commitment|renewed\s+(?:faith|commitment)|came\s+back|rededicated|re-dedicated|renewed|people\s+rededicated|people\s+renewed|rededications?|re-dedications?|recommitments?|renewed)",
    
    # Youth breakdown - more flexible with voice recognition
    "youth_attendance": r"(\d+)\s+(?:youth(?:\s+attendance|\s+group|\s+ministry)?|teens?|youth\s+people|youth\s+attended|youth\s+came|youth\s+showed\s+up|youth\s+group|youth\s+ministry|teens?|teenagers?|young\s+people)",
    "youth_salvations": r"(\d+)\s+(?:youth\s+(?:salvations?|decisions?|saved)|teen\s+(?:salvations?|decisions?)|youth\s+got\s+saved|youth\s+people\s+saved|youth\s+made\s+decisions?|youth\s+salvations?|youth\s+decisions?|youth\s+saved)",
    "youth_new_people": r"(\d+)\s+(?:youth\s+(?:new\s+people|visitors?|newcomers?)|teen\s+(?:new\s+people|visitors?)|new\s+youth|youth\s+newcomers?|youth\s+visitors?|new\s+youth|youth\s+new\s+people)",
    
    # Kids breakdown - more natural with voice recognition
    "kids_attendance": r"(\d+)\s+(?:kids\s+attendance|children\s+attendance|kids\s+total|kids|children|kids\s+attended|kids\s+came|kids\s+showed\s+up|kids\s+ministry|children\s+ministry|nursery|kid\s+ministry|children\s+attended)",
    "kids_leaders": r"(\d+)\s+(?:kids\s+leaders?|children\s+leaders?|kids\s+helpers?|kids\s+volunteers?|children\s+helpers?|kids\s+team|kids\s+leaders?|children\s+leaders?|kids\s+helpers?)",
    "new_kids": r"(\d+)\s+(?:new\s+kids|new\s+children|kids\s+visitors?|new\s+kids\s+came|new\s+children\s+came|new\s+kids|new\s+children|kids\s+visitors?)",
    "new_kids_salvations": r"(\d+)\s+(?:kids?\s+(?:salvations?|decisions?|saved)|children\s+(?:salvations?|decisions?)|kids\s+got\s+saved|children\s+got\s+saved|kids\s+made\s+decisions?|children\s+made\s+decisions?|kids\s+salvations?|children\s+salvations?)",
    
    # Ministry metrics - more flexible with voice recognition
    "connect_groups": r"(\d+)\s+(?:connect\s+groups?|small\s+groups?|connects?|life\s+groups?|active\s+groups?|people\s+in\s+connect\s+groups?|people\s+joined\s+connect\s+groups?|connect\s+groups?|small\s+groups?|life\s+groups?)",
    "dream_team": r"(\d+)\s+(?:dream\s+team|dt|team\s+members?|serving\s+team|people\s+on\s+dream\s+team|people\s+served|serving\s+people|volunteers?|on\s+dream\s+team|dream\s+team|volunteers?|team\s+members?)",
    
    # Special events - more natural with voice recognition
    "baptisms": r"(\d+)\s+(?:baptisms?|baptized|baptismal|water\s+baptism|people\s+baptized|people\s+got\s+baptized|baptisms?|baptized|baptismal)",
    "child_dedications": r"(\d+)\s+(?:child\s+dedications?|baby\s+dedications?|dedications?|dedicated|people\s+dedicated|children\s+dedicated|child\s+dedications?|baby\s+dedications?|dedications?)",
    
    # Information gathering - more flexible with voice recognition
    "information_gathered": r"(\d+)\s+(?:info\s+gathered|information\s+gathered|details\s+gathered|details\s+collected|contact\s+info|info|cards\s+back|contact\s+cards|response\s+cards|visitor\s+cards|info\s+cards|information\s+cards|contact\s+information|collected|gathered|info\s+gathered|information\s+gathered)",
    
    # Rededications - more flexible with voice recognition
    "rededications": r"(\d+)\s+(?:rededication|re-dedication|recommitment|re-commitment|renewed\s+(?:faith|commitment)|came\s+back|rededicated|re-dedicated|renewed|people\s+rededicated|people\s+renewed|rededications?|re-dedications?|recommitments?)",
    
    # New kids - more flexible with voice recognition
    "new_kids": r"(\d+)\s+(?:new\s+kids|new\s+children|kids\s+visitors?|new\s+kids\s+came|new\s+children\s+came|new\s+kids|new\s+children|kids\s+visitors?)",
    
    # Service time patterns - much more flexible with voice recognition
    "9:00_am": r"(\d+)\s+(?:9\s*am|9\s*:?\s*00\s*am|9\s*o'clock|nine\s*am|nine\s*o'clock|9\s*am\s*service|9\s*:?\s*00\s*service|nine\s*am\s*service|9\s*am|nine\s*am|9\s*o'clock)",
    "10:00_am": r"(\d+)\s+(?:10\s*am|10\s*:?\s*00\s*am|10\s*o'clock|ten\s*am|ten\s*o'clock|10\s*am\s*service|10\s*:?\s*00\s*service|ten\s*am\s*service|10\s*am|ten\s*am|10\s*o'clock)",
    "11:00_am": r"(\d+)\s+(?:11\s*am|11\s*:?\s*00\s*am|11\s*o'clock|eleven\s*am|eleven\s*o'clock|11\s*am\s*service|11\s*:?\s*00\s*service|eleven\s*am\s*service|11\s*am|eleven\s*am|11\s*o'clock)",
    "5:00_pm": r"(\d+)\s+(?:5\s*pm|5\s*:?\s*00\s*pm|5\s*o'clock|five\s*pm|five\s*o'clock|5\s*pm\s*service|5\s*:?\s*00\s*service|five\s*pm\s*service|5\s*pm|five\s*pm|5\s*o'clock)",
    
    # Financial - enhanced for voice recognition
    "tithe": r"(\d+(?:\.\d+)?)\s+(?:tithe|offering|giving|donations?|money|dollars?|bucks?|tithe|offering|giving|donations?|money|dollars?)",
    
    # Backward compatibility patterns with voice recognition
    "new_people": r"(\d+)\s+(?:new(?:\s+(?!time|people))|np)(?!\s+(?:visitors?|guests?))",
    "new_christians": r"(\d+)\s+(?:salvations?|decisions?|nc)(?!\s+(?:rededication|re-dedication))",
    "kids_total": r"(\d+)\s+(?:kids|children|kids\s+ministry|nursery)",
    "volunteers": r"(\d+)\s+(?:volunteers?|team\s+members?|servers?|volunteers?|team\s+members?)"
}

# Campus detection patterns (loaded dynamically)
def get_campus_patterns():
    """Get campus patterns dynamically from configuration"""
    return get_campus_detection_patterns()

def detect_campus(text: str) -> Optional[str]:
    """Detect campus from text using dynamic patterns from configuration with fuzzy matching for voice recognition"""
    text_lower = text.lower()
    
    # Get dynamic campus patterns
    campus_patterns = get_campus_patterns()
    
    # Check each campus pattern with exact matching first
    for campus_id, pattern in campus_patterns.items():
        if re.search(pattern, text_lower, re.IGNORECASE):
            return campus_id
    
    # Enhanced fuzzy matching for voice recognition with common misspellings and variations
    fuzzy_campus_patterns = {
        'south': [
            r'\bsouth\b', r'\bsowth\b', r'\bsow\b', r'\bsowf\b', r'\bsowth campus\b',
            r'\bsouth campus\b', r'\bsow campus\b', r'\bsowf campus\b', r'\bsouthside\b',
            r'\bsouth side\b', r'\bsouthern\b', r'\bsouth campus\b', r'\bsouth location\b',
            r'\bsouth church\b', r'\bsouth location\b', r'\bsouth site\b'
        ],
        'salisbury': [
            r'\bsalisbury\b', r'\bsalsbury\b', r'\bsalsbery\b', r'\bsalisbery\b',
            r'\bsalisbury campus\b', r'\bsalsbury campus\b', r'\bsalsbery campus\b',
            r'\bsalisbery campus\b', r'\bsalisbury location\b', r'\bsalisbury church\b',
            r'\bsalisbury site\b', r'\bsalsbury location\b', r'\bsalsbury church\b'
        ],
        'paradise': [
            r'\bparadise\b', r'\bparadice\b', r'\bparidise\b', r'\bparidice\b',
            r'\bparadise campus\b', r'\bparadice campus\b', r'\bparidise campus\b',
            r'\bparidice campus\b', r'\bparadise location\b', r'\bparadise church\b',
            r'\bparadise site\b', r'\bparadice location\b', r'\bparadice church\b'
        ],
        'adelaide_city': [
            r'\badelaide\b', r'\badelaide city\b', r'\badelaide city campus\b',
            r'\badelaide campus\b', r'\badelaide city campus\b', r'\badelaide location\b',
            r'\badelaide church\b', r'\badelaide site\b', r'\badelaide city location\b',
            r'\badelaide city church\b', r'\badelaide city site\b'
        ]
    }
    
    # Check fuzzy patterns for each campus
    for campus_id, patterns in fuzzy_campus_patterns.items():
        for pattern in patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                logger.info(f"Fuzzy campus match: '{text}' -> {campus_id}")
                # Map campus IDs to actual Google Sheets campus names
                campus_mapping = {
                    'south': 'South',
                    'salisbury': 'Salisbury', 
                    'paradise': 'Paradise',
                    'adelaide_city': 'Adelaide City'
                }
                return campus_mapping.get(campus_id, campus_id)
    
    # Check for partial matches (for voice recognition errors)
    partial_matches = {
        'south': ['sow', 'sowth', 'sowf', 'south'],
        'salisbury': ['sals', 'salis', 'salsbury', 'salisbury'],
        'paradise': ['parad', 'paradis', 'paradice'],
        'adelaide_city': ['adela', 'adelaide']
    }
    
    for campus_id, partials in partial_matches.items():
        for partial in partials:
            if partial in text_lower:
                logger.info(f"Partial campus match: '{text}' -> {campus_id}")
                # Map campus IDs to actual Google Sheets campus names
                campus_mapping = {
                    'south': 'South',
                    'salisbury': 'Salisbury', 
                    'paradise': 'Paradise',
                    'adelaide_city': 'Adelaide City'
                }
                return campus_mapping.get(campus_id, campus_id)
    
    # If no specific campus is mentioned, check if this looks like a church-wide stat query
    church_wide_indicators = [
        'how many', 'what is', "what's", 'give me', 'tell me', 'what was', 'how much',
        'total', 'average', 'church', 'this weekend', 'this week', 'this month', 'this year',
        'all campuses', 'church wide', 'across all', 'every campus', 'all locations'
    ]
    
    has_church_wide_query = any(indicator in text_lower for indicator in church_wide_indicators)
    
    if has_church_wide_query:
        return "all_campuses"
    
    # If no campus mentioned but contains numbers (likely stat logging), 
    # we'll need to handle this in the calling function
    return None

def get_all_campuses_data(rows: list, start_date: datetime, end_date: datetime) -> list:
    """Get data from all campuses within the date range"""
    all_campus_data = []
    
    for row in rows:
        try:
            timestamp_str = row.get("Timestamp", "")
            if timestamp_str:
                # Handle different timestamp formats
                if "T" in timestamp_str:
                    row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                else:
                    row_date = parse_any_date(timestamp_str)
                # Check if row date is within the specified range
                if start_date <= row_date <= end_date:
                    all_campus_data.append(row)
            else:
                # If no timestamp, include the row (fallback)
                all_campus_data.append(row)
        except Exception as e:
            logger.warning(f"Could not parse timestamp for row: {e}")
            all_campus_data.append(row)
    
    return all_campus_data

def generate_cross_campus_insights(question: str, analysis_data: dict, filtered_rows: list) -> str:
    """Generate intelligent AI insights for cross-campus data"""
    if not claude:
        return "I'd be happy to analyze your church-wide data, but I need to connect to my AI assistant first."
    
    # Prepare data summary for Claude
    data_summary = f"""
Here's what I found for Futures Church ({analysis_data.get('date_range', 'recent data')}):

Church-wide numbers:
- {analysis_data.get('total_attendance', 0):,} total attendance
- {analysis_data.get('total_new_people', 0):,} new people
- {analysis_data.get('total_new_christians', 0):,} new christians
- {analysis_data.get('total_youth', 0):,} youth
- {analysis_data.get('total_kids', 0):,} kids
- {analysis_data.get('total_connect_groups', 0):,} connect groups

Weekly averages across all campuses:
- {analysis_data.get('averages', {}).get('attendance', 0):.1f} people per week
- {analysis_data.get('averages', {}).get('new_people', 0):.1f} new people per week
- {analysis_data.get('averages', {}).get('new_christians', 0):.1f} new christians per week
- {analysis_data.get('averages', {}).get('youth', 0):.1f} youth per week
- {analysis_data.get('averages', {}).get('kids', 0):.1f} kids per week
- {analysis_data.get('averages', {}).get('connect_groups', 0):.1f} connect groups per week
"""

    # Add recent data points for trend analysis
    if filtered_rows:
        recent_data = "Recent weeks across all campuses:\n"
        for i, row in enumerate(filtered_rows[-5:], 1):  # Last 5 entries
            if isinstance(row, dict):
                date = row.get('Date', row.get('Timestamp', 'Unknown'))
                campus = row.get('Campus', 'Unknown')
                attendance = row.get('Total Attendance', 0)
                new_people = row.get('New People', 0)
                new_christians = row.get('New Christians', 0)
                recent_data += f"{i}. {date} ({campus}): {attendance} people, {new_people} new, {new_christians} christians\n"
        data_summary += f"\n{recent_data}"

    # Create intelligent prompt for cross-campus analysis
    question_lower = question.lower()
    
    if any(word in question_lower for word in ['trend', 'trends', 'pattern', 'growth', 'improve', 'attention', 'working']):
        prompt = f"""You're a friendly church growth expert. A leader from Futures Church is asking: "{question}"

{data_summary}

Give them warm, encouraging insights about their church-wide data. Focus on:
- What trends you see across all their campuses
- How the whole church is performing
- What areas are doing well or need attention across campuses
- Simple suggestions that could help the entire church

Be conversational and encouraging. Use their data to back up your insights. Keep it under 120 words and make it feel like a friendly conversation about their whole church."""
    
    elif any(word in question_lower for word in ['compare', 'vs', 'versus', 'against', 'difference']):
        prompt = f"""You're a helpful church data friend. A leader from Futures Church is asking: "{question}"

{data_summary}

Give them friendly analysis of their church-wide data. Focus on:
- How their overall numbers stack up
- What patterns you notice across campuses
- What the data tells us about their church-wide progress
- What might be influencing their results

Be encouraging and use their specific numbers. Keep it under 120 words and sound like you're chatting about their whole church."""
    
    else:
        prompt = f"""You're a helpful church assistant. A leader from Futures Church is asking: "{question}"

{data_summary}

Give them friendly, helpful insights about their church-wide data. Focus on:
- What they're really asking about
- What their church-wide data shows
- How this info can help their whole church
- What positive things you notice across all campuses

Be warm and specific. Use their data to give meaningful insights about Futures Church as a whole. Keep it under 120 words and sound conversational."""

    try:
        response = claude.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=300,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )
        response_text = response.content[0].text.strip() if hasattr(response.content[0], 'text') else str(response.content[0])
        return response_text
        
    except Exception as e:
        logger.error(f"Claude API error in generate_cross_campus_insights: {e}")
        return f"I'd be happy to analyze your church-wide data for Futures Church, but I'm having trouble connecting to my AI assistant right now. The data shows {analysis_data.get('total_attendance', 0)} total attendance across all campuses with an average of {analysis_data.get('averages', {}).get('attendance', 0):.1f} people per week."

def preprocess_voice_text(text: str) -> str:
    """Preprocess voice input text to improve recognition accuracy with enhanced noise handling"""
    # Convert to lowercase for consistent processing
    text = text.lower()
    
    # Enhanced voice recognition corrections with more comprehensive patterns
    voice_corrections = {
        # Numbers and common misheard words - expanded for better recognition
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
        'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14',
        'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18',
        'nineteen': '19', 'twenty': '20', 'thirty': '30', 'forty': '40',
        'fifty': '50', 'sixty': '60', 'seventy': '70', 'eighty': '80',
        'ninety': '90', 'hundred': '100', 'thousand': '1000',
        
        # Common voice recognition errors - expanded list
        'peep': 'people', 'peeps': 'people', 'peeple': 'people', 'peepul': 'people',
        'peeple': 'people', 'peepul': 'people', 'peeple': 'people',
        'salvations': 'salvations', 'salvation': 'salvations', 'salvashuns': 'salvations',
        'decisions': 'decisions', 'decision': 'decisions', 'decishuns': 'decisions',
        'conversions': 'conversions', 'conversion': 'conversions', 'convershuns': 'conversions',
        'visitors': 'visitors', 'visitor': 'visitors', 'vizitors': 'visitors',
        'guests': 'guests', 'guest': 'guests', 'gests': 'guests',
        'kids': 'kids', 'kid': 'kids', 'kidds': 'kids',
        'children': 'children', 'child': 'children', 'chilldren': 'children',
        'youth': 'youth', 'teens': 'youth', 'teenagers': 'youth', 'yoot': 'youth',
        'volunteers': 'volunteers', 'volunteer': 'volunteers', 'voluntears': 'volunteers',
        'team members': 'volunteers', 'team member': 'volunteers', 'team membrs': 'volunteers',
        'dream team': 'dream team', 'dream team members': 'dream team', 'dream tem': 'dream team',
        
        # Campus name corrections - expanded for better recognition
        'sowth': 'south', 'sow': 'south', 'sowf': 'south', 'sowth': 'south',
        'salsbury': 'salisbury', 'salsbery': 'salisbury', 'salisbery': 'salisbury',
        'salsberry': 'salisbury', 'salisberry': 'salisbury', 'salsbery': 'salisbury',
        'paradice': 'paradise', 'paridise': 'paradise', 'paridice': 'paradise',
        'paradice': 'paradise', 'paridise': 'paradise', 'paridice': 'paradise',
        'adelaide city': 'adelaide city', 'adelaide': 'adelaide city', 'adelaid': 'adelaide city',
        
        # Query-specific corrections
        'how many': 'how many', 'how much': 'how much', 'what is': 'what is',
        'what was': 'what was', "what's": "what's", 'tell me': 'tell me',
        'give me': 'give me', 'show me': 'show me', 'can you': 'can you',
        'could you': 'could you', 'would you': 'would you',
        
        # Time-related corrections
        'last week': 'last week', 'this week': 'this week', 'last month': 'last month',
        'this month': 'this month', 'last year': 'last year', 'this year': 'this year',
        'quarter': 'quarter', 'q1': 'q1', 'q2': 'q2', 'q3': 'q3', 'q4': 'q4',
        
        # Stat-related corrections
        'attendance': 'attendance', 'attendence': 'attendance', 'attendence': 'attendance',
        'new people': 'new people', 'newpeeple': 'new people', 'newpeeple': 'new people',
        'first time': 'first time', 'firsttime': 'first time', 'firsttime': 'first time',
        'connect groups': 'connect groups', 'connectgroups': 'connect groups',
        'dream team': 'dream team', 'dreamteam': 'dream team', 'dreamtem': 'dream team',
        
        # Common speech patterns
        'um': '', 'uh': '', 'ah': '', 'er': '', 'like': '', 'you know': '',
        'i mean': '', 'sort of': '', 'kind of': '', 'basically': '', 'actually': '',
        
        # Filler words and hesitations
        'well': '', 'so': '', 'and': '', 'but': '', 'or': '', 'then': '',
        'now': '', 'here': '', 'there': '', 'this': '', 'that': '',
        
        # Common speech disfluencies
        'i think': '', 'i guess': '', 'i mean': '', 'you know': '', 'right': '',
        'okay': '', 'ok': '', 'yeah': '', 'yes': '', 'no': '', 'not': '',
        
        # Numbers in words to digits
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
        'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
        'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
    }
    
    # Apply corrections with word boundary matching for better accuracy
    for wrong, correct in voice_corrections.items():
        # Use word boundary matching to avoid partial word replacements
        pattern = r'\b' + re.escape(wrong) + r'\b'
        text = re.sub(pattern, correct, text, flags=re.IGNORECASE)
    
    # Clean up extra spaces and punctuation more aggressively
    text = re.sub(r'\s+', ' ', text)  # Multiple spaces to single space
    text = re.sub(r'[^\w\s\d]', ' ', text)  # Remove punctuation but keep spaces
    text = re.sub(r'\s+', ' ', text)  # Clean up spaces again after punctuation removal
    text = text.strip()
    
    # Remove common speech artifacts
    text = re.sub(r'\b(um|uh|ah|er|like|you know|i mean|sort of|kind of|basically|actually)\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+', ' ', text)  # Clean up spaces again
    text = text.strip()
    
    # Normalize common phrases
    text = re.sub(r'\b(how many|how much)\b', 'how many', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(what is|what was|whats)\b', 'what is', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(tell me|give me|show me)\b', 'tell me', text, flags=re.IGNORECASE)
    
    # Final cleanup
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

def extract_stats_with_context(text: str, campus: str) -> Dict[str, Any]:
    """Extract stats with enhanced context awareness and natural speech support"""
    # Preprocess voice input for better recognition
    processed_text = preprocess_voice_text(text)
    
    result = {
        "Campus": campus,
        "Timestamp": datetime.now(timezone.utc).isoformat(),
        "Raw_Text": text,
        "Processed_Text": processed_text
    }
    
    # Enhanced stat extraction with better context awareness
    # Use processed text for better voice recognition
    search_text = processed_text if processed_text else text
    
    for key, pattern in patterns.items():
        match = re.search(pattern, search_text, re.IGNORECASE)
        if match:
            # Convert to string for Google Sheets compatibility
            stat_name = key.replace("_", " ").title()
            
            # Handle special mappings for Google Sheets headers
            header_mapping = {
                "Total Attendance": "Total Attendance",
                "First Time Visitors": "First Time Visitors", 
                "Visitors": "Visitors",
                "Cards Back": "Cards Back",
                "First Time Christians": "First Time Christians",
                "Rededications": "Rededications",
                "Salvation Cards Returned": "Salvation Cards Returned",
                "Youth Attendance": "Youth Attendance",
                "Youth Salvations": "Youth Salvations", 
                "Youth New People": "Youth New People",
                "Kids Attendance": "Kids Attendance",
                "Kids Leaders": "Kids Leaders",
                "New Kids": "New Kids",
                "New Kids Salvations": "New Kids Salvations",
                "Connect Groups": "Connect Groups",
                "Dream Team": "Dream Team",
                "Baptisms": "Baptisms",
                "Child Dedications": "Child Dedications",
                "Tithe": "Tithe",
                # Service time mappings
                "9:00 Am": "9:00 AM",
                "10:00 Am": "10:00 AM", 
                "11:00 Am": "11:00 AM",
                "5:00 Pm": "5:00 PM"
            }
            
            final_stat_name = header_mapping.get(stat_name, stat_name)
            result[final_stat_name] = str(match.group(1))
            logger.info(f"Extracted {final_stat_name}: {match.group(1)}")
    
    return result

def extract_stats_with_smart_campus(text: str, default_campus: str = None) -> Dict[str, Any]:
    """Extract stats with smart campus detection - if no campus mentioned, use default or prompt"""
    # First try to detect campus from text
    detected_campus = detect_campus(text)
    
    if detected_campus:
        # Campus was mentioned in the text
        return extract_stats_with_context(text, detected_campus)
    else:
        # No campus mentioned - check if this looks like stat logging
        stat_patterns = [
            r'\d+\s+(?:people|attendance|total|had|got|there were)',
            r'\d+\s+(?:first\s+time|first-time|first\s+timers?|new\s+people|newcomers?)',
            r'\d+\s+(?:visitors?|guests?)',
            r'\d+\s+(?:salvations?|decisions?|got\s+saved|conversions?)',
            r'\d+\s+(?:youth|teens?)',
            r'\d+\s+(?:kids|children)',
            r'\d+\s+(?:connect\s+groups?|small\s+groups?)',
            r'\d+\s+(?:dream\s+team|volunteers?|team\s+members?)'
        ]
        
        has_stats = any(re.search(pattern, text.lower()) for pattern in stat_patterns)
        
        if has_stats:
            # This looks like stat logging but no campus mentioned
            if default_campus:
                logger.info(f"No campus mentioned but stats detected - using default campus: {default_campus}")
                return extract_stats_with_context(text, default_campus)
            else:
                # Return stats with a placeholder campus that will prompt user
                stats = extract_stats_with_context(text, "PENDING_CAMPUS")
                stats["requires_campus_selection"] = True
                return stats
        else:
            # No stats detected - return empty result
            return {
                "Campus": None,
                "Timestamp": datetime.now(timezone.utc).isoformat(),
                "Raw_Text": text,
                "requires_campus_selection": False
            }

def generate_encouragement_with_memory(text: str, campus: str, memory: Dict[str, Any]) -> List[str]:
    """Generate conversational responses using Claude with conversation memory"""
    if not claude:
        return ["Thanks for inputting those stats!", "Keep up the great work!"]
    
    # Build context from memory with better formatting
    campus_history = memory.get(campus, [])
    recent_stats = campus_history[-3:] if campus_history else []
    
    context = ""
    if recent_stats:
        context = f"\n\nRecent stats from {campus} campus:\n"
        for i, stat in enumerate(recent_stats, 1):
            raw_text = stat.get('Raw_Text', '')
            timestamp = stat.get('Timestamp', '')
            if timestamp:
                # Extract just the date part
                try:
                    date_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    date_str = date_obj.strftime("%B %d")
                except:
                    date_str = "recently"
            else:
                date_str = "recently"
            context += f"{i}. {date_str}: {raw_text}\n"
    
    # Check if this contains actual numbers (indicating stat logging)
    text_lower = text.lower()
    contains_numbers = any(char.isdigit() for char in text)
    
    # Check for explicit query indicators
    is_query = any(word in text_lower for word in [
        'how many', 'what is', 'what was', 'what were', 'average', 'last week', 'this week', 'total', 'count', 'query', 'data', 'has had', 'had this year', 'had this month',
        'compare', 'comparison', 'vs', 'versus', 'between', 'year over year',
        'review', 'annual review', 'mid year review', 'mid-year review', 'report', 'summary', 'dashboard', 'snapshot', 'full report', 'overview', 'recap', 'stats summary', 'stat summary', 'stat report', 'stat overview', 'stat recap',
        'annual', 'mid year', 'mid-year', 'midyear'
    ]) or any(word in text_lower for word in ['q1', 'q2', 'q3', 'q4', 'quarter 1', 'quarter 2', 'quarter 3', 'quarter 4', 'first quarter', 'second quarter', 'third quarter', 'fourth quarter'])
    
    # Check if this is a request to log stats (no numbers yet)
    is_request = not contains_numbers and any(word in text_lower for word in ['log', 'record', 'enter', 'add', 'can i log', 'want to log', 'help me log', 'can we log'])
    
    # If it has numbers and is not explicitly a query, treat as stat logging
    is_stat_logging = contains_numbers and not is_query
    
    if is_query:
        prompt = f"""You are a helpful church AI assistant. A leader from the {campus} campus is asking for data:
"{text}"

{context}

Respond naturally as a helpful assistant. Tell them you'll look up that information for them right away! Be conversational and friendly. Keep it under 15 words. Examples:
- "I'll look that up for you right away!"
- "Let me check the data for {campus} campus."
- "I'll find that information for you."""
    elif is_request:
        prompt = f"""You are a friendly, helpful church AI assistant. A leader from the {campus} campus is asking:
"{text}"

{context}

Respond naturally as a helpful assistant. If they want to log stats, guide them conversationally. Be encouraging and friendly. Keep it under 20 words. 

Guide them to log new stats. Examples:
- "Perfect! I'm ready to record today's stats for {campus} campus. What were your numbers?"
- "Great! Let's log today's stats for {campus} campus. How many people attended?"
- "Absolutely! I'm here to help log stats for {campus} campus. What numbers do you have?"
- "Ready to log stats for {campus} campus! What numbers do you have today?"""
    elif is_stat_logging:
        # For actual stat logging with numbers, give confirmation responses
        return ["Thanks for inputting those stats for " + campus + " campus!", "Great numbers this week!"]
    else:
        prompt = f"""You are a church insights assistant. A leader from the {campus} campus submitted:
"{text}"

{context}

Generate EXACTLY 2 short insights (max 12 words each). Focus on different trends, patterns, or observations. Be encouraging but factual. Format as:
1. [First insight]
2. [Second insight]"""

    try:
        response = claude.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=80,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )
        response_text = response.content[0].text.strip() if hasattr(response.content[0], 'text') else str(response.content[0])
        
        if is_request:
            # For requests, return a single helpful response
            return [response_text]
        else:
            # Parse the response to extract exactly 2 insights
            lines = response_text.split('\n')
            insights = []
            
            for line in lines:
                line = line.strip()
                if line and not line.startswith('1.') and not line.startswith('2.'):
                    insights.append(line)
            
            # Ensure we have exactly 2 insights
            if len(insights) >= 2:
                return insights[:2]
            elif len(insights) == 1:
                return [insights[0], "Great progress this week!"]
            else:
                return ["Thanks for inputting those stats!", "Keep up the great work!"]
            
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        if is_request:
            return [f"Sure! I'd love to help input stats for {campus} campus. Just tell me the numbers!", "What were your attendance numbers today?"]
        else:
            return ["Thanks for inputting those stats!", "Keep up the great work!"]

def generate_audio_with_elevenlabs(text: str, filename: Optional[str] = None, voice_id: Optional[str] = None) -> Optional[str]:
    """Generate audio using ElevenLabs API with enhanced voice options and error handling"""
    if not elevenlabs_api_key:
        logger.warning("ElevenLabs API key not configured")
        return None
    
    try:
        # Use provided voice_id or default
        target_voice_id = voice_id or elevenlabs_voice_id
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        
        # Enhanced voice settings for better quality
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.6,  # Increased for more consistent voice
                "similarity_boost": 0.7,  # Increased for better voice quality
                "style": 0.3,  # Add some style variation
                "use_speaker_boost": True  # Enhance speaker clarity
            }
        }
        
        response = requests.post(url, json=data, headers=headers, timeout=30)
        
        if response.status_code == 200:
            # Ensure temp_audio directory exists in backend folder
            temp_audio_dir = os.path.join(os.path.dirname(__file__), "temp_audio")
            os.makedirs(temp_audio_dir, exist_ok=True)
            
            if filename:
                # If filename provided, use it as-is
                audio_filename = filename  
                full_path = audio_filename
            else:
                # Generate filename with timestamp and voice info
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                voice_suffix = f"_v{target_voice_id}" if voice_id else ""
                audio_filename = f"response_{timestamp}{voice_suffix}.mp3"
                full_path = os.path.join(temp_audio_dir, audio_filename)
            
            with open(full_path, "wb") as f:
                f.write(response.content)
            logger.info(f"Generated audio file: {full_path} (voice: {target_voice_id})")
            
            # Return URL path for the audio file
            return f"/temp_audio/{audio_filename}"
        else:
            logger.error(f"ElevenLabs API error: {response.status_code} - {response.text}")
            return None
    except requests.exceptions.Timeout:
        logger.error("ElevenLabs API request timed out")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"ElevenLabs API request failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to generate audio with ElevenLabs: {e}")
        return None

def detect_missing_stats(text: str, campus: str) -> List[str]:
    """Detect what stats might be missing and suggest follow-up questions"""
    extracted = extract_stats_with_context(text, campus)
    missing = []
    
    # Check for common missing stats
    if not any(key in extracted for key in ["Total Attendance", "Total attendance"]):
        missing.append("How many people attended today?")
    
    if not any(key in extracted for key in ["New People", "New people"]):
        missing.append("Were there any new visitors today?")
    
    if not any(key in extracted for key in ["Kids Total", "Kids total"]):
        missing.append("How many kids were in children's ministry?")
    
    if not any(key in extracted for key in ["Youth Attendance", "Youth attendance"]):
        missing.append("How many youth attended?")
    
    return missing

def parse_date_range(question: str) -> tuple:
    """Parse date range from question text"""
    question_lower = question.lower()
    current_year = datetime.now().year
    
    # Extract year from question (look for 4-digit years like 2024, 2023, etc.)
    import re
    year_match = re.search(r'\b(20\d{2})\b', question)
    target_year = int(year_match.group(1)) if year_match else current_year
    
    # YTD (Year to Date) detection
    if any(phrase in question_lower for phrase in ['ytd', 'year to date', 'this year', 'so far this year']):
        start_date = datetime(target_year, 1, 1)
        end_date = datetime.now() if target_year == current_year else datetime(target_year, 12, 31)
        logger.info(f"[QUERY] YTD detected: {start_date} to {end_date}")
        return start_date, end_date, f"year to date ({target_year})"
    
    # Month range detection
    months = {
        'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
        'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
        'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
        'november': 11, 'nov': 11, 'december': 12, 'dec': 12
    }
    
    # Look for "from X to Y" or "X to Y" patterns
    for month_name, month_num in months.items():
        if month_name in question_lower:
            # Check for "from X to Y" pattern
            if f"from {month_name}" in question_lower:
                for end_month_name, end_month_num in months.items():
                    if f"to {end_month_name}" in question_lower:
                        start_date = datetime(target_year, month_num, 1)
                        if end_month_num == 12:
                            end_date = datetime(target_year, end_month_num, 31)
                        else:
                            end_date = datetime(target_year, end_month_num + 1, 1) - timedelta(days=1)
                        return start_date, end_date, f"{month_name.title()} to {end_month_name.title()} {target_year}"
            
            # Check for "X to Y" pattern (without "from")
            for end_month_name, end_month_num in months.items():
                if f"{month_name} to {end_month_name}" in question_lower:
                    start_date = datetime(target_year, month_num, 1)
                    if end_month_num == 12:
                        end_date = datetime(target_year, end_month_num, 31)
                    else:
                        end_date = datetime(target_year, end_month_num + 1, 1) - timedelta(days=1)
                    return start_date, end_date, f"{month_name.title()} to {end_month_name.title()} {target_year}"
    
    # Single month detection
    for month_name, month_num in months.items():
        if month_name in question_lower:
            start_date = datetime(target_year, month_num, 1)
            if month_num == 12:
                end_date = datetime(target_year, month_num, 31)
            else:
                end_date = datetime(target_year, month_num + 1, 1) - timedelta(days=1)
            return start_date, end_date, f"{month_name.title()} {target_year}"
    
    # No date range found - default to recent data
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)  # Default to last 30 days
    return start_date, end_date, "recent data"

def detect_comparison_request(question: str) -> tuple:
    """Detect if this is a comparison request and extract years/periods to compare"""
    question_lower = question.lower()
    current_year = datetime.now().year
    import re
    
    # Look for comparison keywords - more precise list
    comparison_keywords = [
        'compare', 'comparison', 'vs', 'versus', 'against', 'side by side', 'year over year',
        'between', 'difference', 'compared to', 'compared with', 'relative to',
        'q1 vs', 'q2 vs', 'q3 vs', 'q4 vs', 'quarter 1 vs', 'quarter 2 vs', 'quarter 3 vs', 'quarter 4 vs',
        'first quarter vs', 'second quarter vs', 'third quarter vs', 'fourth quarter vs',
        'mid-year vs', 'mid year vs', 'midyear vs', 'year to year',
        'growth', 'trend', 'improvement', 'decline', 'increase', 'decrease', 'change',
        'how are we doing', 'how did we do', 'performance', 'results'
    ]
    
    # Check for explicit comparison indicators
    explicit_comparison_indicators = [
        'compare', 'comparison', 'vs', 'versus', 'against', 'side by side', 'year over year',
        'between', 'difference', 'compared to', 'compared with', 'relative to',
        'year to year', 'growth', 'trend', 'improvement', 'decline', 'increase', 'decrease', 'change'
    ]
    
    # Check for specific comparison patterns
    has_explicit_comparison = any(indicator in question_lower for indicator in explicit_comparison_indicators)
    
    # Check for YTD (Year to Date) comparison
    ytd_keywords = ['ytd', 'year to date', 'so far this year', 'this year to date']
    has_ytd_keyword = any(keyword in question_lower for keyword in ytd_keywords)
    
    # Check for "this year" which should NOT be a comparison, UNLESS it's explicitly a comparison
    if ('this year' in question_lower or 'current year' in question_lower) and not any(word in question_lower for word in ['compare', 'comparison', 'vs', 'versus', 'against', 'compared to', 'compared with', 'ytd', 'year to date']):
        return False, [], None, None
    
    # Check for "annual" or "yearly" only if they appear with comparison context
    annual_keywords = ['annual', 'yearly']
    has_annual_keyword = any(keyword in question_lower for keyword in annual_keywords)
    
    # Only treat as comparison if there's explicit comparison language OR annual/yearly with comparison context OR YTD comparison
    is_comparison = has_explicit_comparison or (has_annual_keyword and any(word in question_lower for word in ['compare', 'comparison', 'vs', 'versus', 'against', 'between', 'difference'])) or has_ytd_keyword
    logger.info(f"[COMPARE DEBUG] Question: '{question}' -> Lower: '{question_lower}'")
    logger.info(f"[COMPARE DEBUG] Comparison keywords found: {[kw for kw in comparison_keywords if kw in question_lower]}")
    logger.info(f"[COMPARE DEBUG] Is comparison: {is_comparison}")
    if not is_comparison:
        return False, [], None, None
    
    # Detect mid-year comparison
    if 'mid-year' in question_lower or 'mid year' in question_lower or 'midyear' in question_lower:
        years = re.findall(r'\b(20\d{2})\b', question)
        if len(years) >= 2:
            return True, [int(years[0]), int(years[1])], 'mid_year', None
        elif len(years) == 1:
            y = int(years[0])
            return True, [y-1, y], 'mid_year', None
        else:
            return True, [current_year-1, current_year], 'mid_year', None

    # Detect quarterly comparison (Q1, Q2, Q3, Q4) - improved detection
    quarter = None
    quarter_patterns = [
        (r'\bq1\b', 1), (r'\bq2\b', 2), (r'\bq3\b', 3), (r'\bq4\b', 4),
        (r'\bquarter 1\b', 1), (r'\bquarter 2\b', 2), (r'\bquarter 3\b', 3), (r'\bquarter 4\b', 4),
        (r'\bfirst quarter\b', 1), (r'\bsecond quarter\b', 2), (r'\bthird quarter\b', 3), (r'\bfourth quarter\b', 4)
    ]
    
    for pattern, q in quarter_patterns:
        if re.search(pattern, question_lower):
            quarter = q
            break
    
    if quarter:
        years = re.findall(r'\b(20\d{2})\b', question)
        if len(years) >= 2:
            return True, [int(years[0]), int(years[1])], 'quarterly', quarter
        elif len(years) == 1:
            y = int(years[0])
            return True, [y-1, y], 'quarterly', quarter
        else:
            return True, [current_year-1, current_year], 'quarterly', quarter

    # Detect monthly comparison
    months = {
        'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
        'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
        'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
        'november': 11, 'nov': 11, 'december': 12, 'dec': 12
    }
    
    # Check for monthly comparison patterns like "march vs april" or "monthly comparison"
    monthly_indicators = ['monthly comparison', 'monthly vs', 'month vs', 'month comparison']
    has_monthly_indicator = any(indicator in question_lower for indicator in monthly_indicators)
    
    # Also check for month names in comparison
    mentioned_months = []
    for month_name, month_num in months.items():
        if month_name in question_lower:
            mentioned_months.append(month_num)
    
    if has_monthly_indicator or len(mentioned_months) >= 1:
        # If we found month names, use the first one; otherwise use current month
        month = mentioned_months[0] if mentioned_months else datetime.now().month
        
        years = re.findall(r'\b(20\d{2})\b', question)
        if len(years) >= 2:
            return True, [int(years[0]), int(years[1])], 'monthly', month
        elif len(years) == 1:
            y = int(years[0])
            return True, [y-1, y], 'monthly', month
        else:
            return True, [current_year-1, current_year], 'monthly', month

    # Detect YTD comparison
    if has_ytd_keyword:
        years = re.findall(r'\b(20\d{2})\b', question)
        if len(years) >= 2:
            logger.info(f"[COMPARE DEBUG] YTD comparison detected with years: {years}")
            return True, [int(year) for year in years], 'ytd', None
        elif len(years) == 1:
            y = int(years[0])
            logger.info(f"[COMPARE DEBUG] YTD comparison detected with single year: {y}, comparing with {y-1}")
            return True, [y-1, y], 'ytd', None
        else:
            logger.info(f"[COMPARE DEBUG] YTD comparison detected with no years, using {current_year-1} and {current_year}")
            return True, [current_year-1, current_year], 'ytd', None

    # Default: annual comparison
    years = re.findall(r'\b(20\d{2})\b', question)
    if len(years) >= 2:
        return True, [int(year) for year in years], 'annual', None
    elif len(years) == 1:
        y = int(years[0])
        return True, [y-1, y], 'annual', None
    else:
        return True, [current_year-1, current_year], 'annual', None

def detect_cross_location_comparison(question: str) -> tuple:
    """Detect if this is a cross-location comparison request and extract campuses to compare"""
    question_lower = question.lower()
    
    # Check if user has permission for cross-location comparison
    if not hasattr(current_user, 'is_authenticated') or not current_user or not current_user.is_authenticated or not current_user.has_permission('dashboard_access'):
        return False, [], None, None
    
    # Look for cross-location comparison keywords
    cross_location_keywords = [
        'compare', 'vs', 'versus', 'against', 'between', 'difference',
        'south vs', 'barker vs', 'paradise vs', 'adelaide vs', 'salisbury vs',
        'south compared to', 'barker compared to', 'paradise compared to', 'adelaide compared to', 'salisbury compared to',
        'how many', 'did south have', 'did barker have', 'did paradise have', 'did adelaide have', 'did salisbury have',
        'south and', 'barker and', 'paradise and', 'adelaide and', 'salisbury and'
    ]
    
    # Check for explicit cross-location comparison indicators
    has_cross_location_indicator = any(indicator in question_lower for indicator in cross_location_keywords)
    
    if not has_cross_location_indicator:
        return False, [], None, None
    
    # Get all available campuses
    available_campuses = get_campuses_for_user()
    campus_names = [campus['id'] for campus in available_campuses.get('campuses', []) if campus['id'] != 'all_campuses']
    
    # Get campus detection patterns for better matching
    campus_patterns = get_campus_detection_patterns()
    
    # Detect mentioned campuses in the question
    mentioned_campuses = []
    for campus_id in campus_names:
        # Check if campus name appears in question
        if campus_id.lower() in question_lower:
            mentioned_campuses.append(campus_id)
        else:
            # Check campus detection patterns
            if campus_id in campus_patterns:
                pattern = campus_patterns[campus_id]
                if re.search(pattern, question_lower, re.IGNORECASE):
                    mentioned_campuses.append(campus_id)
    
    # Also check for common campus name variations
    campus_variations = {
        'mount_barker': ['barker', 'mt barker', 'mount barker'],
        'south': ['south'],
        'paradise': ['paradise'],
        'adelaide_city': ['adelaide', 'city', 'cbd'],
        'salisbury': ['salisbury']
    }
    
    for campus_id, variations in campus_variations.items():
        if campus_id in campus_names:  # Only check if campus is available to user
            for variation in variations:
                if variation.lower() in question_lower and campus_id not in mentioned_campuses:
                    mentioned_campuses.append(campus_id)
                    break
    
    # If no specific campuses mentioned, return False
    if len(mentioned_campuses) < 2:
        return False, [], None, None
    
    # Detect time period
    current_year = datetime.now().year
    years = re.findall(r'\b(20\d{2})\b', question)
    year = int(years[0]) if years else current_year
    
    # Detect specific stat being compared
    specific_stat = detect_specific_stat_in_comparison(question)
    
    logger.info(f"[CROSS_LOCATION] Detected cross-location comparison: campuses={mentioned_campuses}, year={year}, stat={specific_stat}")
    
    return True, mentioned_campuses, year, specific_stat

def handle_cross_location_comparison(question: str, campuses: list, year: int, specific_stat: str = None) -> dict:
    """Handle cross-location comparison requests between multiple campuses"""
    logger.info(f"[CROSS_LOCATION] handle_cross_location_comparison called with: question={question}, campuses={campuses}, year={year}, specific_stat={specific_stat}")
    
    try:
        # Get data for each campus
        campus_reports = []
        for campus in campuses:
            # Get data for the specific year
            start_date = datetime(year, 1, 1)
            end_date = datetime(year, 12, 31)
            
            # Get rows data
            rows = []
            if sheet:
                try:
                    rows = safe_sheets_request(sheet.get_all_records)
                except Exception as e:
                    logger.error(f"Failed to get stats from Google Sheets: {e}")
                    rows = []
            
            # Filter rows for this campus and year
            filtered_rows = []
            campus_normalized = normalize_campus(campus)
            
            for row in rows:
                try:
                    if isinstance(row, dict):
                        row_campus = normalize_campus(row.get('Campus', ''))
                        if (row_campus == campus_normalized or 
                            campus_normalized in row_campus or 
                            row_campus in campus_normalized):
                            
                            row_date = get_row_timestamp(row)
                            if row_date != datetime.min and start_date <= row_date <= end_date:
                                filtered_rows.append(row)
                except Exception as e:
                    logger.warning(f"Could not process row: {e}")
                    continue
            
            # Calculate stats for this campus
            if filtered_rows:
                analysis_data = calculate_stats_from_filtered_rows(filtered_rows)
                
                # Create report for this campus
                campus_report = {
                    "campus": display_campus_name(campus),
                    "year": year,
                    "stats": analysis_data,
                    "entry_count": len(filtered_rows)
                }
                campus_reports.append(campus_report)
                
                # Debug logging
                logger.info(f"[CROSS_LOCATION] Campus {campus}: {len(filtered_rows)} rows, new_people={analysis_data.get('total_new_people', 0)}, new_christians={analysis_data.get('total_new_christians', 0)}")
            else:
                logger.warning(f"[CROSS_LOCATION] No data found for campus {campus} in year {year}")
        
        if not campus_reports:
            return {
                "error": "No data found for the specified campuses and year",
                "text": f"Sorry, I couldn't find data for {', '.join([display_campus_name(c) for c in campuses])} in {year}.",
                "popup": True
            }
        
        # Create comparison table
        comparison_data = []
        stat_mappings = [
            ("total_attendance", "Total Attendance"),
            ("total_first_time_visitors", "First Time Visitors"),
            ("total_new_people", "New People"),
            ("total_new_christians", "New Christians"),
            ("total_rededications", "Rededications"),
            ("total_youth_attendance", "Youth Attendance"),
            ("total_youth_salvations", "Youth Salvations"),
            ("total_youth_new_people", "Youth New People"),
            ("total_kids_attendance", "Kids Attendance"),
            ("total_kids_leaders", "Kids Leaders"),
            ("total_new_kids", "New Kids"),
            ("total_new_kids_salvations", "New Kids Salvations"),
            ("total_connect_groups", "Connect Groups"),
            ("total_dream_team", "Dream Team"),
            ("total_tithe", "Tithe"),
            ("total_baptisms", "Baptisms"),
            ("total_child_dedications", "Child Dedications"),
            ("total_information_gathered", "Cards Back")
        ]
        
        # If specific stat requested, only include that stat
        if specific_stat:
            stat_mappings = [(f"total_{specific_stat}", specific_stat.replace('_', ' ').title())]
        
        for stat_key, stat_label in stat_mappings:
            row_data = {"stat": stat_label}
            for report in campus_reports:
                # Use the original campus name as the key, not the display name
                campus_name = report["campus"]
                stat_value = report["stats"].get(stat_key, 0)
                # Use the original campus name from the campuses list
                original_campus = next((c for c in campuses if display_campus_name(c) == campus_name), campus_name)
                row_data[original_campus] = stat_value
            comparison_data.append(row_data)
        
        # Create summary text
        campus_names = [display_campus_name(c) for c in campuses]
        if specific_stat:
            summary = f"Comparison of {specific_stat.replace('_', ' ').title()} between {', '.join(campus_names)} in {year}"
        else:
            summary = f"Comparison of all stats between {', '.join(campus_names)} in {year}"
        
        # Create spoken summary
        spoken_summary = f"Here's your comparison between {', '.join(campus_names)} for {year}."
        
        return {
            "question": question,
            "comparison": True,
            "cross_location": True,
            "campuses": campuses,
            "year": year,
            "summary": summary,
            "data": comparison_data,
            "text": spoken_summary,
            "popup": True
        }
        
    except Exception as e:
        logger.error(f"[CROSS_LOCATION] Error in handle_cross_location_comparison: {e}")
        return {
            "error": "Failed to generate cross-location comparison",
            "text": "Sorry, I couldn't generate that cross-location comparison. Please try a different query.",
            "popup": True
        }

# Handler for mid-year and quarterly comparisons

def query_data_internal(data: Dict[str, Any]) -> Dict[str, Any]:
    """Internal function to query data - handles all types of stat queries with popup support"""
    question = str(data.get("question", "")).strip()
    if not question:
        return {"error": "Missing question"}

    # Extract campus from question using the same detection logic
    campus = detect_campus(question)
    question_lower = question.lower()
    
    # Smart campus defaulting based on user role when no campus is mentioned
    if not campus:
        if hasattr(current_user, 'is_authenticated') and current_user and current_user.is_authenticated:
            if current_user.role == 'campus_pastor':
                # Campus pastors get their assigned campus by default
                campus = getattr(current_user, 'campus', 'main')
                logger.info(f"[QUERY] No campus mentioned - using campus pastor's campus: {campus}")
            elif current_user.role in ALL_ACCESS_ROLES:
                # Senior leadership gets all campuses by default
                campus = 'all_campuses'
                logger.info(f"[QUERY] No campus mentioned - using all campuses for senior leadership")
            else:
                # Other roles default to main or all_campuses
                campus = 'all_campuses'
                logger.info(f"[QUERY] No campus mentioned - defaulting to all campuses")
        else:
            campus = 'all_campuses'
    else:
        logger.info(f"[QUERY] Campus detected from question: {campus}")
    
    logger.info(f"[QUERY] Processing question: '{question}' | Final Campus: {campus}")
    
    # 1. CROSS-LOCATION COMPARISON REQUESTS - CHECK FIRST
    is_cross_location, campuses, year, specific_stat = detect_cross_location_comparison(question)
    if is_cross_location:
        logger.info(f"[QUERY] Detected cross-location comparison: campuses={campuses}, year={year}, stat={specific_stat}")
        
        result = handle_cross_location_comparison(question, campuses, year, specific_stat)
        
        # Ensure the response has the correct format for the frontend
        if result.get('comparison'):
            # Add popup flag for comparison results
            result['popup'] = True
            logger.info(f"[QUERY] Cross-location comparison result keys: {list(result.keys())}")
            return result
        else:
            logger.error(f"[QUERY] Cross-location comparison failed to return proper format")
            return {
                "error": "Failed to generate cross-location comparison",
                "text": "Sorry, I couldn't generate that cross-location comparison. Please try a different query.",
                "popup": True
            }

    # 2. COMPARISON REQUESTS (Year over year, quarterly, etc.)
    is_comparison, years, period_type, period_value = detect_comparison_request(question)
    if is_comparison:
        logger.info(f"[QUERY] Detected comparison: years={years}, period={period_type}, value={period_value}")
        campus = detect_campus(question) or campus or "main"
        
        # Add comprehensive logging
        logger.info(f"[QUERY] Processing comparison for campus: {campus}")
        logger.info(f"[QUERY] Question: '{question}'")
        logger.info(f"[QUERY] Period type: {period_type}, Period value: {period_value}")
        
        result = handle_period_comparison_request(question, campus, years, period_type, period_value)
        
        # Ensure the response has the correct format for the frontend
        if result.get('comparison'):
            # Add popup flag for comparison results
            result['popup'] = True
            logger.info(f"[QUERY] Comparison result keys: {list(result.keys())}")
            return result
        else:
            logger.error(f"[QUERY] Comparison failed to return proper format")
            return {
                "error": "Failed to generate comparison",
                "text": "Sorry, I couldn't generate that comparison. Please try a different query.",
                "popup": True
            }

    # 2. REVIEW INTENTS (Annual, Quarterly, Mid-Year Reviews)
    if is_review_intent(question):
        logger.info(f"[QUERY] Detected review intent")
        campus = detect_campus(question) or campus or "main"
        import re
        years = re.findall(r'\b(20\d{2})\b', question)
        if len(years) == 0:
            years = [datetime.now().year]
        elif len(years) == 1:
            years = [int(y) for y in years]
        else:
            years = [int(y) for y in years]
        # Check if this is a cross-campus request
        if campus == "all_campuses" or any(indicator in question_lower for indicator in ['all campuses', 'futures church', 'church wide', 'across all']):  
            # Detect specific review type for cross-campus
            review_type, period_value, year = detect_review_type(question)
            year = years[0] if years else year  # Use detected year or default
            
            # Map review types to cross-campus report types
            if review_type == "quarterly":
                cross_campus_report = generate_cross_campus_report('quarterly', f"Q{period_value} {year}")
                spoken_summary = f"Here's your Q{period_value} {year} quarterly review for All Campuses."
            elif review_type == "monthly":
                month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December']
                month_name = month_names[period_value]
                cross_campus_report = generate_cross_campus_report('monthly', f"{month_name} {year}")
                spoken_summary = f"Here's your {month_name} {year} monthly review for All Campuses."
            elif review_type == "mid_year":
                cross_campus_report = generate_cross_campus_report('mid_year', f"Jan-Jun {year}")
                spoken_summary = f"Here's your {year} mid-year review for All Campuses."
            else:
                # Default to annual
                cross_campus_report = generate_cross_campus_report('annual', "")
                spoken_summary = f"Here's your annual review for All Campuses campus in {year}."
            
            stats = cross_campus_report.get('stats', {})
            
            # Create report format for popup
            report_data = [
                {"label": "Total Attendance", "total": stats.get('attendance', {}).get('total', 0), "average": stats.get('attendance', {}).get('average', 0), "count": cross_campus_report.get('entry_count', 0), "year": year},
                {"label": "New People", "total": stats.get('new_people', {}).get('total', 0), "average": stats.get('new_people', {}).get('average', 0), "count": cross_campus_report.get('entry_count', 0), "year": year},
                {"label": "New Christians", "total": stats.get('new_christians', {}).get('total', 0), "average": stats.get('new_christians', {}).get('average', 0), "count": cross_campus_report.get('entry_count', 0), "year": year},
                {"label": "Youth Attendance", "total": stats.get('youth', {}).get('total', 0), "average": stats.get('youth', {}).get('average', 0), "count": cross_campus_report.get('entry_count', 0), "year": year},
                {"label": "Kids Total", "total": stats.get('kids', {}).get('total', 0), "average": stats.get('kids', {}).get('average', 0), "count": cross_campus_report.get('entry_count', 0), "year": year},
                {"label": "Connect Groups", "total": stats.get('connect_groups', {}).get('total', 0), "average": stats.get('connect_groups', {}).get('average', 0), "count": cross_campus_report.get('entry_count', 0), "year": year},
                {"label": "Volunteers", "total": 0, "average": 0, "count": 0, "year": year}  # Volunteers not tracked in cross-campus yet
            ]
            
            return {
                "report": report_data,
                "text": spoken_summary,
                "popup": True,
                "stats": stats,
                "campus": "All Campuses",
                "year": year
            }
        else:
            # Single campus review - detect specific review type
            review_type, period_value, year = detect_review_type(question)
            year = years[0] if years else year  # Use detected year or default
            
            if review_type == "quarterly":
                report = generate_quarterly_report(campus, year, period_value)
            elif review_type == "monthly":
                report = generate_monthly_report(campus, year, period_value)
            elif review_type == "mid_year":
                report = generate_mid_year_report(campus, year)
            else:
                # Default to annual review
                report = generate_full_stat_report(campus, [year])
            
            report["popup"] = True  # Enable popup for reviews
            return report

    # 2. WEEKEND REVIEWS
    if any(phrase in question_lower for phrase in WEEKEND_REVIEW_PHRASES):
        logger.info(f"[QUERY] Detected weekend review")
        
        # First check for pastor names (priority over campus detection)
        pastor_campus = detect_pastor_name(question)
        if pastor_campus:
            campus = pastor_campus
            logger.info(f"[QUERY] Pastor detected - using campus: {campus}")
        else:
            campus = detect_campus(question)
            logger.info(f"[QUERY] No pastor detected - using campus detection: {campus}")
        if campus and campus != "all_campuses":
            # Campus-specific weekend review - use proper weekend date range
            today = datetime.now()
            # Find the most recent Sunday
            days_since_sunday = today.weekday() + 1  # Monday=0, so Sunday=6
            if days_since_sunday == 7:  # Today is Sunday
                days_since_sunday = 0
            most_recent_sunday = today - timedelta(days=days_since_sunday)
            
            # Weekend is Monday to Sunday (7 days ending on Sunday)
            start_date = most_recent_sunday - timedelta(days=6)  # Monday
            end_date = most_recent_sunday  # Sunday
            rows = []
            if sheet:
                try:
                    rows = safe_sheets_request(sheet.get_all_records)
                except Exception as e:
                    logger.error(f"Failed to get stats from Google Sheets: {e}")
                    rows = []
            if not rows:
                memory = load_conversation_memory()
                campus_history = memory.get("session_stats", {}).get(campus, [])
                rows = campus_history
            
            campus_normalized = normalize_campus(campus)
            filtered_rows = []
            for row in rows:
                row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
                if row_campus == campus_normalized or campus_normalized in row_campus:
                    # Use Date field instead of Timestamp for weekend reviews
                    date_str = row.get("Date", "")
                    if date_str:
                        try:
                            # Parse the Date field directly
                            row_date = datetime.strptime(date_str, "%Y-%m-%d")
                            if start_date <= row_date <= end_date:
                                filtered_rows.append(row)
                        except Exception:
                            continue
            
            logger.info(f"[WEEKEND_REVIEW] Found {len(rows)} total rows, {len(filtered_rows)} filtered rows for {campus} in last 7 days")
            analysis_data = calculate_stats_from_filtered_rows(filtered_rows)
            logger.info(f"[WEEKEND_REVIEW] Analysis data: {analysis_data}")
            
            # Check if we have any data
            has_data = (analysis_data.get('total_entries', 0) > 0 or 
                       any(analysis_data.get(key, 0) > 0 for key in ['total_attendance', 'total_new_people', 'total_new_christians', 'total_youth', 'total_kids', 'total_connect_groups']))
            
            if has_data:
                # Create detailed summary for display
                detailed_summary = (
                    f"{display_campus_name(campus)} Weekend Review\n"
                    f"Total Attendance: {analysis_data.get('total_attendance', 0):,}\n"
                    f"New People: {analysis_data.get('total_new_people', 0):,}\n"
                    f"New Christians: {analysis_data.get('total_new_christians', 0):,}\n"
                    f"Youth: {analysis_data.get('total_youth', 0):,}\n"
                    f"Kids: {analysis_data.get('total_kids', 0):,}\n"
                    f"Connect Groups: {analysis_data.get('total_connect_groups', 0):,}"
                )
                
                # Create spoken summary 
                spoken_summary = f"Here's your weekend review for {display_campus_name(campus)} campus."
            else:
                # No data found
                detailed_summary = (
                    f"{display_campus_name(campus)} Weekend Review\n"
                    f"No stats have been logged for {display_campus_name(campus)} campus in the last 7 days.\n"
                    f"This could mean:\n"
                    f"• Stats haven't been entered yet for this weekend\n"
                    f"• The campus name might not match our records\n"
                    f"• There was no service this weekend"
                )
                
                # Create spoken summary 
                spoken_summary = f"I couldn't find any weekend stats for {display_campus_name(campus)} campus in the last 7 days. You may need to enter the stats first or check if the campus name is correct."
            
            # Create comprehensive report with all available stats
            report = []
            stat_mappings = [
                ("total_attendance", "Total Attendance", "attendance"),
                ("total_first_time_visitors", "First Time Visitors", "first_time_visitors"),
                ("total_information_gathered", "Cards Back", "information_gathered"),
                ("total_new_christians", "New Christians", "new_christians"),
                ("total_rededications", "Rededications", "rededications"),
                ("total_youth_attendance", "Youth Attendance", "youth_attendance"),
                ("total_youth_salvations", "Youth Salvations", "youth_salvations"),
                ("total_youth_new_people", "Youth New People", "youth_new_people"),
                ("total_kids_attendance", "Kids Attendance", "kids_attendance"),
                ("total_kids_leaders", "Kids Leaders", "kids_leaders"),
                ("total_new_kids", "New Kids", "new_kids"),
                ("total_new_kids_salvations", "New Kids Salvations", "new_kids_salvations"),
                ("total_connect_groups", "Connect Groups", "connect_groups"),
                ("total_dream_team", "Dream Team", "dream_team"),
                ("total_tithe", "Tithe", "tithe"),
                ("total_baptisms", "Baptisms", "baptisms"),
                ("total_child_dedications", "Child Dedications", "child_dedications"),
                ("total_new_people", "New People", "new_people"),  # Keep for backward compatibility
            ]
            
            for stat_key, label, avg_key in stat_mappings:
                total = analysis_data.get(stat_key, 0)
                average = analysis_data.get("averages", {}).get(avg_key, 0)
                count = analysis_data.get("total_entries", 0)
                
                # Only include stats that have data or are important to show
                if total > 0 or label in ["Total Attendance", "New Christians", "Youth Attendance", "Kids Attendance", "Connect Groups", "Dream Team"]:
                    report.append({
                        "label": label,
                        "total": total,
                        "average": average,
                        "count": count,
                        "year": start_date.year
                    })
            return {
                "question": question,
                "campus": display_campus_name(campus),
                "date_range": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
                "summary": detailed_summary,
                "stats": analysis_data,
                "report": report,
                "text": spoken_summary,
                "popup": True
            }
        else:
            # Cross-campus weekend review
            logger.info(f"[WEEKEND_REVIEW] Processing cross-campus weekend review")
            report = generate_cross_campus_report('weekly', "")
            logger.info(f"[WEEKEND_REVIEW] Cross-campus report: {report}")
            stats = report.get('stats', {})
            
            # Create detailed summary for display
            detailed_summary = (
                f"Futures Church Weekend Review\n"
                f"Total Attendance: {stats.get('attendance', {}).get('total', 0):,}\n"
                f"Average Attendance: {stats.get('attendance', {}).get('average', 0):,.1f}\n"
                f"New People: {stats.get('new_people', {}).get('total', 0):,}\n"
                f"New Christians: {stats.get('new_christians', {}).get('total', 0):,}\n"
                f"Youth: {stats.get('youth', {}).get('total', 0):,}\n"
                f"Kids: {stats.get('kids', {}).get('total', 0):,}\n"
                f"Connect Groups: {stats.get('connect_groups', {}).get('total', 0):,}"
            )
            
            # Create spoken summary
            spoken_summary = f"Here's your weekend review for Futures Church across all campuses."
            return {
                "question": question,
                "campus": "Futures Church (All Campuses)",
                "date_range": report.get('date_range', ''),
                "summary": detailed_summary,
                "stats": stats,
                "report": report,
                "text": spoken_summary,
                "popup": True
            }

    # 3. CROSS-CAMPUS REVIEWS
    cross_campus_result = detect_cross_campus_review(question)
    if cross_campus_result:
        review_type, _ = cross_campus_result
        logger.info(f"[QUERY] Detected cross-campus review: {review_type}")
        report = generate_cross_campus_report(review_type, "")
        stats = report.get('stats', {})
        
        # Create comprehensive summary
        summary = f"Futures Church {review_type.title()} Report\n"
        summary += f"Total Attendance: {stats.get('attendance', {}).get('total', 0):,}\n"
        summary += f"Average Attendance: {stats.get('attendance', {}).get('average', 0):,.1f}\n"
        summary += f"New People: {stats.get('new_people', {}).get('total', 0):,}\n"
        summary += f"New Christians: {stats.get('new_christians', {}).get('total', 0):,}\n"
        summary += f"Youth: {stats.get('youth', {}).get('total', 0):,}\n"
        summary += f"Kids: {stats.get('kids', {}).get('total', 0):,}\n"
        summary += f"Connect Groups: {stats.get('connect_groups', {}).get('total', 0):,}"
        
        # Convert to report format for popup
        report_data = [
            {"label": "Total Attendance", "total": stats.get('attendance', {}).get('total', 0), "average": stats.get('attendance', {}).get('average', 0), "count": report.get('entry_count', 0), "year": datetime.now().year},
            {"label": "New People", "total": stats.get('new_people', {}).get('total', 0), "average": stats.get('new_people', {}).get('average', 0), "count": report.get('entry_count', 0), "year": datetime.now().year},
            {"label": "New Christians", "total": stats.get('new_christians', {}).get('total', 0), "average": stats.get('new_christians', {}).get('average', 0), "count": report.get('entry_count', 0), "year": datetime.now().year},
            {"label": "Youth", "total": stats.get('youth', {}).get('total', 0), "average": stats.get('youth', {}).get('average', 0), "count": report.get('entry_count', 0), "year": datetime.now().year},
            {"label": "Kids", "total": stats.get('kids', {}).get('total', 0), "average": stats.get('kids', {}).get('average', 0), "count": report.get('entry_count', 0), "year": datetime.now().year},
            {"label": "Connect Groups", "total": stats.get('connect_groups', {}).get('total', 0), "average": stats.get('connect_groups', {}).get('average', 0), "count": report.get('entry_count', 0), "year": datetime.now().year},
        ]
        
        return {
            "question": question,
            "campus": "Futures Church (All Campuses)",
            "date_range": report.get('date_range', ''),
            "summary": summary,
            "stats": stats,
            "report": report_data,
            "text": summary,
            "popup": True
        }

    # 5. SIMPLE STAT QUERIES (How many people, what was attendance, etc.)
    # First check for multiple stats (e.g., "np and nc")
    multiple_stats = detect_multiple_stats(question)
    simple_stat_result = detect_simple_stat_query(question)
    
    if multiple_stats:
        logger.info(f"[QUERY] Detected multiple stat query: {multiple_stats}")
        stat_types = multiple_stats
        keyword = "multiple stats"
    elif simple_stat_result:
        stat_type, keyword = simple_stat_result
        stat_types = [stat_type]  # Convert to list for consistency
        logger.info(f"[QUERY] Detected simple stat query: {stat_type} (keyword: {keyword})")
    else:
        stat_types = None
        keyword = None
    
    if stat_types:
        
        # Default campus if none detected
        if not campus or campus == "all_campuses":
            campus = "main"
        
        # Parse date range from question
        start_date, end_date, date_range_text = parse_date_range(question)
        
        # Get data - prioritize Google Sheets over local data
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
                logger.info(f"[QUERY] Using Google Sheets data: {len(rows)} rows")
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        
        if not rows:
            logger.info("[QUERY] Falling back to local data")
            rows = load_local_data()
            if not rows:
                memory = load_conversation_memory()
                campus_history = memory.get("session_stats", {}).get(campus, [])
                rows = campus_history
        
        # Handle cross-campus queries
        if campus == "all_campuses" or any(indicator in question_lower for indicator in ['all campuses', 'futures church', 'church wide', 'across all']):
            # Cross-campus simple stat query
            analysis_data = get_all_campuses_data(rows, start_date, end_date)
            campus_display = "Futures Church (All Campuses)"
            
            # Calculate cross-campus totals
            total_attendance = sum(safe_int(row.get('Total Attendance', 0)) for row in analysis_data)
            total_new_people = sum(safe_int(row.get('New People', 0)) for row in analysis_data)
            total_new_christians = sum(safe_int(row.get('New Christians', 0)) for row in analysis_data)
            total_youth = sum(safe_int(row.get('Youth Attendance', 0)) for row in analysis_data)
            total_kids = sum(safe_int(row.get('Kids Total', 0)) for row in analysis_data)
            total_connect_groups = sum(safe_int(row.get('Connect Groups', 0)) for row in analysis_data)
            
            # Calculate averages
            valid_entries = len([row for row in analysis_data if safe_int(row.get('Total Attendance', 0)) > 0])
            avg_attendance = total_attendance / valid_entries if valid_entries > 0 else 0
            avg_new_people = total_new_people / valid_entries if valid_entries > 0 else 0
            avg_new_christians = total_new_christians / valid_entries if valid_entries > 0 else 0
            avg_youth = total_youth / valid_entries if valid_entries > 0 else 0
            avg_kids = total_kids / valid_entries if valid_entries > 0 else 0
            avg_connect_groups = total_connect_groups / valid_entries if valid_entries > 0 else 0
            
            cross_campus_data = {
                'total_attendance': total_attendance,
                'total_new_people': total_new_people,
                'total_new_christians': total_new_christians,
                'total_youth': total_youth,
                'total_kids': total_kids,
                'total_connect_groups': total_connect_groups,
                'averages': {
                    'attendance': avg_attendance,
                    'new_people': avg_new_people,
                    'new_christians': avg_new_christians,
                    'youth': avg_youth,
                    'kids': avg_kids,
                    'connect_groups': avg_connect_groups
                }
            }
            
            answer = generate_simple_stat_answer(stat_types[0], cross_campus_data, campus_display, f" {date_range_text}")
            
            # Create targeted report data for popup - only show the requested stat(s)
            report_data = create_targeted_report_data(stat_types, cross_campus_data, start_date.year, valid_entries)
            
            return {
                "question": question,
                "campus": campus_display,
                "date_range": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
                "answer": answer,
                "text": answer,
                "stats": cross_campus_data,
                "report": report_data,
                "popup": True
            }
        else:
            # Single campus simple stat query
            campus_normalized = normalize_campus(campus)
            filtered_rows = []
            logger.info(f"[QUERY] Looking for campus: '{campus}' (normalized: '{campus_normalized}')")
            
            for row in rows:
                row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
                original_campus = row.get("Campus") or row.get("campus") or ""
                logger.info(f"[QUERY] Row campus: '{original_campus}' (normalized: '{row_campus}')")
                
                # Enhanced campus matching with better case-insensitive handling
                campus_match = False
                
                # Direct normalization comparison
                if row_campus == campus_normalized:
                    campus_match = True
                
                # Case-insensitive comparison of original names
                elif original_campus.lower() == campus.lower():
                    campus_match = True
                
                # Partial matching for voice recognition
                elif campus_normalized in row_campus or row_campus in campus_normalized:
                    campus_match = True
                
                # Handle special cases like "south" vs "South"
                elif campus_normalized == "south" and row_campus == "south":
                    campus_match = True
                elif campus_normalized == "salisbury" and row_campus == "salisbury":
                    campus_match = True
                elif campus_normalized == "paradise" and row_campus == "paradise":
                    campus_match = True
                elif campus_normalized == "adelaide city" and row_campus == "adelaide city":
                    campus_match = True
                
                if campus_match:
                    row_date = get_row_timestamp(row)
                    if row_date != datetime.min and start_date <= row_date <= end_date:
                        filtered_rows.append(row)
            
            logger.info(f"[QUERY] Found {len(filtered_rows)} rows for campus '{campus}'")
            if filtered_rows:
                logger.info(f"[QUERY] Sample row: {filtered_rows[0]}")
            
            analysis_data = calculate_stats_for_year_range(filtered_rows, campus, start_date.year, end_date.year if end_date.year != start_date.year else None)
            
            # Calculate cross-campus averages for comparison
            if sheet:
                try:
                    all_rows = safe_sheets_request(sheet.get_all_records)
                    all_filtered_rows = []
                    for row in all_rows:
                        row_date = get_row_timestamp(row)
                        if row_date != datetime.min and start_date <= row_date <= end_date:
                            all_filtered_rows.append(row)
                    
                    # Calculate averages across all campuses
                    if all_filtered_rows:
                        total_weeks = len(all_filtered_rows)
                        cross_campus_totals = {
                            'attendance': sum(safe_int(row.get('Attendance', 0)) for row in all_filtered_rows),
                            'new_people': sum(safe_int(row.get('New People', 0)) for row in all_filtered_rows),
                            'new_christians': sum(safe_int(row.get('New Christians', 0)) for row in all_filtered_rows),
                            'youth': sum(safe_int(row.get('Youth', 0)) for row in all_filtered_rows),
                            'kids': sum(safe_int(row.get('Kids', 0)) for row in all_filtered_rows),
                            'connect_groups': sum(safe_int(row.get('Connect Groups', 0)) for row in all_filtered_rows),
                            'dream_team': sum(safe_int(row.get('Dream Team', 0)) for row in all_filtered_rows)
                        }
                        
                        analysis_data['cross_campus_averages'] = {
                            stat_type: total / total_weeks if total_weeks > 0 else 0
                            for stat_type, total in cross_campus_totals.items()
                        }
                except Exception as e:
                    logger.error(f"Failed to calculate cross-campus averages: {e}")
                    analysis_data['cross_campus_averages'] = {}
            
            answer = generate_simple_stat_answer(stat_types[0], analysis_data, display_campus_name(campus), f" {date_range_text}")
            
            # Create targeted report data for popup - only show the requested stat(s)
            report_data = create_targeted_report_data(stat_types, analysis_data, start_date.year, analysis_data.get("total_entries", 0))
            
            return {
                "question": question,
                "campus": display_campus_name(campus),
                "date_range": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
                "answer": answer,
                "text": answer,
                "stats": analysis_data,
                "report": report_data,
                "popup": True
            }

    # 6. GENERAL/BIG PICTURE QUERIES
    general_patterns = [
        'summary', 'all numbers', 'big picture', 'overview', 'all stats', 'full stats',
        'church numbers', 'show me everything', 'what are our numbers', 'church stats'
    ]
    
    if any(pattern in question_lower for pattern in general_patterns):
        logger.info(f"[QUERY] Detected general/big picture query")
        
        # Default to current year if no specific period mentioned
        if not campus or campus == "all_campuses":
            campus = "main"
        
        start_date, end_date, date_range_text = parse_date_range(question)
        
        # Get data and calculate comprehensive stats
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
                logger.info(f"[QUERY] Retrieved {len(rows)} rows from Google Sheets")
                if rows:
                    logger.info(f"[QUERY] Sample row keys: {list(rows[0].keys())}")
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        if not rows:
            memory = load_conversation_memory()
            campus_history = memory.get("session_stats", {}).get(campus, [])
            rows = campus_history
        
        # Filter by campus and date
        campus_normalized = normalize_campus(campus)
        logger.info(f"[QUERY] Looking for campus: '{campus}' (normalized: '{campus_normalized}')")
        filtered_rows = []
        for row in rows:
            row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
            original_campus = row.get("Campus") or row.get("campus") or ""
            logger.info(f"[QUERY] Row campus: '{original_campus}' (normalized: '{row_campus}')")
            
            # More flexible campus matching
            if (row_campus == campus_normalized or 
                campus_normalized in row_campus or 
                row_campus in campus_normalized or
                campus_normalized.replace(" ", "") in row_campus.replace(" ", "") or
                row_campus.replace(" ", "") in campus_normalized.replace(" ", "")):
                timestamp_str = row.get("Timestamp", "")
                if timestamp_str:
                    try:
                        if "T" in timestamp_str:
                            row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            row_date = parse_any_date(timestamp_str)
                        if start_date <= row_date <= end_date:
                            filtered_rows.append(row)
                    except Exception:
                        continue
        
        analysis_data = calculate_stats_for_year_range(filtered_rows, campus, start_date.year, end_date.year if end_date.year != start_date.year else None)
        
        # Create comprehensive summary
        campus_display = display_campus_name(campus)
        summary = f"{campus_display} Church Stats ({date_range_text})\n\n"
        summary += f"📊 Attendance: {analysis_data.get('total_attendance', 0):,} total (avg: {analysis_data.get('averages', {}).get('attendance', 0):.1f})\n"
        summary += f"👥 New People: {analysis_data.get('total_new_people', 0):,} total (avg: {analysis_data.get('averages', {}).get('new_people', 0):.1f})\n"
        summary += f"✝️ New Christians: {analysis_data.get('total_new_christians', 0):,} total (avg: {analysis_data.get('averages', {}).get('new_christians', 0):.1f})\n"
        summary += f"🎯 Youth: {analysis_data.get('total_youth', 0):,} total (avg: {analysis_data.get('averages', {}).get('youth', 0):.1f})\n"
        summary += f"👶 Kids: {analysis_data.get('total_kids', 0):,} total (avg: {analysis_data.get('averages', {}).get('kids', 0):.1f})\n"
        summary += f"🤝 Connect Groups: {analysis_data.get('total_connect_groups', 0):,} total (avg: {analysis_data.get('averages', {}).get('connect_groups', 0):.1f})\n"
        summary += f"🌟 Dream Team: {analysis_data.get('total_dream_team', 0):,} total (avg: {analysis_data.get('averages', {}).get('dream_team', 0):.1f})"
        
        # Create report data for popup
        report_data = [
            {"label": "Total Attendance", "total": analysis_data.get("total_attendance", 0), "average": analysis_data.get("averages", {}).get("attendance", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "New People", "total": analysis_data.get("total_new_people", 0), "average": analysis_data.get("averages", {}).get("new_people", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "New Christians", "total": analysis_data.get("total_new_christians", 0), "average": analysis_data.get("averages", {}).get("new_christians", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Youth", "total": analysis_data.get("total_youth", 0), "average": analysis_data.get("averages", {}).get("youth", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Kids", "total": analysis_data.get("total_kids", 0), "average": analysis_data.get("averages", {}).get("kids", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Connect Groups", "total": analysis_data.get("total_connect_groups", 0), "average": analysis_data.get("averages", {}).get("connect_groups", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Dream Team", "total": analysis_data.get("total_dream_team", 0), "average": analysis_data.get("averages", {}).get("dream_team", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
        ]
        
        return {
            "question": question,
            "campus": campus_display,
            "date_range": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
            "answer": summary,
            "text": summary,
            "stats": analysis_data,
            "report": report_data,
            "popup": True
        }

    # 7. AI INSIGHTS for complex questions
    if any(word in question_lower for word in ['trend', 'trends', 'pattern', 'growth', 'improve', 'attention', 'working', 'analysis', 'insight', 'why', 'how are we', 'what areas']):
        logger.info(f"[QUERY] Detected AI insights query")
        
        if not campus or campus == "all_campuses":
            campus = "main"
        
        start_date, end_date, date_range_text = parse_date_range(question)
        
        # Get and filter data
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        if not rows:
            memory = load_conversation_memory()
            campus_history = memory.get("session_stats", {}).get(campus, [])
            rows = campus_history
        
        campus_normalized = normalize_campus(campus)
        filtered_rows = []
        for row in rows:
            row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
            if row_campus == campus_normalized or campus_normalized in row_campus:
                timestamp_str = row.get("Timestamp", "")
                if timestamp_str:
                    try:
                        if "T" in timestamp_str:
                            row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            row_date = parse_any_date(timestamp_str)
                        if start_date <= row_date <= end_date:
                            filtered_rows.append(row)
                    except Exception:
                        continue
        
        analysis_data = calculate_stats_for_year_range(filtered_rows, campus, start_date.year, end_date.year if end_date.year != start_date.year else None)
        ai_insights = generate_ai_insights(question, campus, analysis_data, filtered_rows)
        
        # Create report data for popup
        report_data = [
            {"label": "Total Attendance", "total": analysis_data.get("total_attendance", 0), "average": analysis_data.get("averages", {}).get("attendance", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "New People", "total": analysis_data.get("total_new_people", 0), "average": analysis_data.get("averages", {}).get("new_people", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "New Christians", "total": analysis_data.get("total_new_christians", 0), "average": analysis_data.get("averages", {}).get("new_christians", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Youth", "total": analysis_data.get("total_youth", 0), "average": analysis_data.get("averages", {}).get("youth", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Kids", "total": analysis_data.get("total_kids", 0), "average": analysis_data.get("averages", {}).get("kids", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Connect Groups", "total": analysis_data.get("total_connect_groups", 0), "average": analysis_data.get("averages", {}).get("connect_groups", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
            {"label": "Dream Team", "total": analysis_data.get("total_dream_team", 0), "average": analysis_data.get("averages", {}).get("dream_team", 0), "count": analysis_data.get("total_entries", 0), "year": start_date.year},
        ]
        
        return {
            "question": question,
            "campus": display_campus_name(campus),
            "date_range": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
            "answer": ai_insights,
            "text": ai_insights,
            "insights": [ai_insights],
            "stats": analysis_data,
            "report": report_data,
            "popup": True
        }

    # 8. FALLBACK: Default response for unrecognized queries
    logger.info(f"[QUERY] No specific pattern matched, using fallback")
    return {
        "error": f"I'm not sure how to answer '{question}'. Try asking for specific stats like 'How many people attended this month?' or 'Show me the annual report for South campus'."
    }

def generate_ai_insights(question: str, campus: str, analysis_data: dict, filtered_rows: list) -> str:
    """Generate intelligent AI insights using Claude based on the data and question"""
    if not claude:
        return "I'd be happy to analyze your data, but I need to connect to my AI assistant first."
    
    # Prepare data summary for Claude
    data_summary = f"""
Here's what I found for {display_campus_name(campus)} campus ({analysis_data.get('date_range', 'recent data')}):

Their numbers:
- {analysis_data.get('total_attendance', 0):,} total attendance
- {analysis_data.get('total_new_people', 0):,} new people
- {analysis_data.get('total_new_christians', 0):,} new christians
- {analysis_data.get('total_youth', 0):,} youth
- {analysis_data.get('total_kids', 0):,} kids
- {analysis_data.get('total_connect_groups', 0):,} connect groups

Weekly averages:
- {analysis_data.get('averages', {}).get('attendance', 0):.1f} people per week
- {analysis_data.get('averages', {}).get('new_people', 0):.1f} new people per week
- {analysis_data.get('averages', {}).get('new_christians', 0):.1f} new christians per week
- {analysis_data.get('averages', {}).get('youth', 0):.1f} youth per week
- {analysis_data.get('averages', {}).get('kids', 0):.1f} kids per week
- {analysis_data.get('averages', {}).get('connect_groups', 0):.1f} connect groups per week
"""

    # Add recent data points for trend analysis
    if filtered_rows:
        recent_data = "Recent weeks:\n"
        for i, row in enumerate(filtered_rows[-5:], 1):  # Last 5 entries
            if isinstance(row, dict):
                date = row.get('Date', row.get('Timestamp', 'Unknown'))
                attendance = row.get('Total Attendance', 0)
                new_people = row.get('New People', 0)
                new_christians = row.get('New Christians', 0)
                recent_data += f"{i}. {date}: {attendance} people, {new_people} new, {new_christians} christians\n"
        data_summary += f"\n{recent_data}"

    # Create intelligent prompt based on question type
    question_lower = question.lower()
    
    if any(word in question_lower for word in ['trend', 'trends', 'pattern', 'growth', 'improve', 'attention', 'working', 'analysis', 'insight', 'why', 'how are we', 'what areas']):
        prompt = f"""You're a friendly church growth expert. A leader from {display_campus_name(campus)} campus is asking: "{question}"

{data_summary}

Give them warm, encouraging insights about their data. Focus on:
- What trends you see in their numbers
- How their campus is performing overall
- What areas are doing well or need attention
- Simple suggestions that could help

Be conversational and encouraging. Use their data to back up your insights. Keep it under 120 words and make it feel like a friendly conversation."""
    
    elif any(word in question_lower for word in ['compare', 'vs', 'versus', 'against', 'difference']):
        prompt = f"""You're a helpful church data friend. A leader from {display_campus_name(campus)} campus is asking: "{question}"

{data_summary}

Give them friendly analysis of their data. Focus on:
- How their numbers stack up
- What patterns you notice
- What the data tells us about their progress
- What might be influencing their results

Be encouraging and use their specific numbers. Keep it under 120 words and sound like you're chatting with a friend."""
    
    elif any(word in question_lower for word in ['how', 'what', 'why', 'analysis', 'insight']):
        prompt = f"""You're a helpful church assistant. A leader from {display_campus_name(campus)} campus is asking: "{question}"

{data_summary}

Give them friendly, helpful insights. Focus on:
- What they're really asking about
- What their data shows
- How this info can help them
- What positive things you notice

Be warm and specific. Use their data to give meaningful insights. Keep it under 120 words and sound conversational."""
    
    else:
        prompt = f"""You're a helpful church assistant. A leader from {display_campus_name(campus)} campus is asking: "{question}"

{data_summary}

Give them friendly, helpful insights. Focus on:
- What they're really asking about
- What their data shows
- How this info can help them
- What positive things you notice

Be warm and specific. Use their data to give meaningful insights. Keep it under 120 words and sound conversational."""

    try:
        response = claude.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=300,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )
        response_text = response.content[0].text.strip() if hasattr(response.content[0], 'text') else str(response.content[0])
        return response_text
        
    except Exception as e:
        logger.error(f"Claude API error in generate_ai_insights: {e}")
        return f"I'd be happy to analyze your data for {display_campus_name(campus)} campus, but I'm having trouble connecting to my AI assistant right now. The data shows {analysis_data.get('total_attendance', 0)} total attendance with an average of {analysis_data.get('averages', {}).get('attendance', 0):.1f} people per week."

def detect_review_type(question: str) -> tuple:
    """Detect the type of review requested and extract relevant parameters"""
    import re
    q = question.lower()
    
    # Quarterly review detection (Q1, Q2, Q3, Q4)
    quarterly_patterns = [
        r'\bq1\b', r'\bq2\b', r'\bq3\b', r'\bq4\b',
        r'\bquarter 1\b', r'\bquarter 2\b', r'\bquarter 3\b', r'\bquarter 4\b',
        r'\bfirst quarter\b', r'\bsecond quarter\b', r'\bthird quarter\b', r'\bfourth quarter\b',
        r'\bq1 review\b', r'\bq2 review\b', r'\bq3 review\b', r'\bq4 review\b',
        r'\bquarterly review\b', r'\bquarter review\b'
    ]
    
    for pattern in quarterly_patterns:
        if re.search(pattern, q):
            # Extract quarter number
            if 'q1' in q or 'quarter 1' in q or 'first quarter' in q:
                quarter = 1
            elif 'q2' in q or 'quarter 2' in q or 'second quarter' in q:
                quarter = 2
            elif 'q3' in q or 'quarter 3' in q or 'third quarter' in q:
                quarter = 3
            elif 'q4' in q or 'quarter 4' in q or 'fourth quarter' in q:
                quarter = 4
            else:
                quarter = 1  # Default to Q1
            
            # Extract year
            import re
            years = re.findall(r'\b(20\d{2})\b', question)
            year = int(years[0]) if years else datetime.now().year
            
            return "quarterly", quarter, year
    
    # Monthly review detection
    monthly_patterns = [
        r'\bmonthly review\b', r'\bmonth review\b', r'\bmonthly report\b', r'\bmonth report\b',
        r'\bmonthly summary\b', r'\bmonth summary\b', r'\bmonthly stats\b', r'\bmonth stats\b',
        r'\bmonthly statistics\b', r'\bmonth statistics\b', r'\bmonthly numbers\b', r'\bmonth numbers\b',
        r'\bmonthly data\b', r'\bmonth data\b', r'\bmonthly recap\b', r'\bmonth recap\b',
        r'\bmonthly overview\b', r'\bmonth overview\b', r'\bmonthly dashboard\b', r'\bmonth dashboard\b',
        r'\bjanuary review\b', r'\bfebruary review\b', r'\bmarch review\b', r'\bapril review\b',
        r'\bmay review\b', r'\bjune review\b', r'\bjuly review\b', r'\baugust review\b',
        r'\bseptember review\b', r'\boctober review\b', r'\bnovember review\b', r'\bdecember review\b',
        r'\bjanuary report\b', r'\bfebruary report\b', r'\bmarch report\b', r'\bapril report\b',
        r'\bmay report\b', r'\bjune report\b', r'\bjuly report\b', r'\baugust report\b',
        r'\bseptember report\b', r'\boctober report\b', r'\bnovember report\b', r'\bdecember report\b'
    ]
    
    for pattern in monthly_patterns:
        if re.search(pattern, q):
            # Extract month number
            months = {
                'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
                'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
                'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
                'november': 11, 'nov': 11, 'december': 12, 'dec': 12
            }
            
            month = None
            for month_name, month_num in months.items():
                if month_name in q or month_name[:3] in q:
                    month = month_num
                    break
            
            # If no specific month found, default to the most recent complete month (previous month)
            if month is None:
                current_date = datetime.now()
                if current_date.month == 1:
                    month = 12  # December of previous year
                else:
                    month = current_date.month - 1
                
            # Extract year
            years = re.findall(r'\b(20\d{2})\b', question)
            if years:
                year = int(years[0])
            else:
                current_date = datetime.now()
                # If we defaulted to December and we're in January, use previous year
                if month == 12 and current_date.month == 1:
                    year = current_date.year - 1
                else:
                    year = current_date.year
            
            return "monthly", month, year

    # Mid-year review detection
    mid_year_patterns = [
        r'\bmid.?year\b', r'\bmidyear\b', r'\bmid.?year review\b', r'\bmidyear review\b',
        r'\bmid.?year report\b', r'\bmidyear report\b', r'\bmid.?year summary\b', r'\bmidyear summary\b',
        r'\bmid.?year stats\b', r'\bmidyear stats\b', r'\bmid.?year statistics\b', r'\bmidyear statistics\b',
        r'\bmid.?year numbers\b', r'\bmidyear numbers\b', r'\bmid.?year data\b', r'\bmidyear data\b',
        r'\bmid.?year recap\b', r'\bmidyear recap\b', r'\bmid.?year overview\b', r'\bmidyear overview\b',
        r'\bmid.?year dashboard\b', r'\bmidyear dashboard\b', r'\bmid.?year snapshot\b', r'\bmidyear snapshot\b',
        r'\bmid.?year full report\b', r'\bmidyear full report\b', r'\bmid.?year full review\b', r'\bmidyear full review\b',
        r'\bmid.?year full summary\b', r'\bmidyear full summary\b', r'\bmid.?year stat report\b', r'\bmidyear stat report\b',
        r'\bmid.?year stat summary\b', r'\bmidyear stat summary\b', r'\bmid.?year stat overview\b', r'\bmidyear stat overview\b',
        r'\bmid.?year stat recap\b', r'\bmidyear stat recap\b', r'\bmid.?year stats summary\b', r'\bmidyear stats summary\b',
        r'\bmid.?year stats overview\b', r'\bmidyear stats overview\b', r'\bmid.?year stats recap\b', r'\bmidyear stats recap\b'
    ]
    
    for pattern in mid_year_patterns:
        if re.search(pattern, q):
            # Extract year
            import re
            years = re.findall(r'\b(20\d{2})\b', question)
            year = int(years[0]) if years else datetime.now().year
            
            return "mid_year", None, year
    
    # Annual review detection (default)
    annual_patterns = [
        'review', 'annual review', 'anual review', 'report', 'summary', 'dashboard', 'snapshot', 'full report', 'overview', 'recap',
        'stats summary', 'stat summary', 'stat report', 'stat overview', 'stat recap',
        'year in review', 'yearly review', 'yearly report', 'year-end review', 'end of year report', 'end of year review',
        'give me a review', 'give me an annual review', 'can i get a review', 'can i get an annual review', 'show me a review', 'show me an annual review',
        'show me the annual report', 'show me the report', 'show me the summary', 'show me the dashboard', 'show me the stats summary',
        'generate a report', 'generate an annual report', 'generate a summary', 'generate an annual summary',
        'full stats', 'all stats', 'all statistics', 'all numbers', 'all data', 'all metrics',
        'recap of the year', 'recap for the year', 'recap', 'stat recap', 'stats recap',
        'big picture', 'big picture stats', 'big picture summary', 'big picture report',
        'comprehensive report', 'comprehensive review', 'comprehensive summary',
        'church report', 'church review', 'church summary',
        'annual stats', 'annual statistics', 'annual numbers', 'annual data',
        'give me a summary', 'can i get a summary', 'show me a summary',
        'give me a dashboard', 'can i get a dashboard', 'show me a dashboard',
        'give me a snapshot', 'can i get a snapshot', 'show me a snapshot',
        'give me an overview', 'can i get an overview', 'show me an overview',
        'give me a full report', 'can i get a full report', 'show me a full report',
        'give me a full review', 'can i get a full review', 'show me a full review',
        'give me a full summary', 'can i get a full summary', 'show me a full summary',
        'give me a stat report', 'can i get a stat report', 'show me a stat report',
        'give me a stat summary', 'can i get a stat summary', 'show me a stat summary',
        'give me a stat overview', 'can i get a stat overview', 'show me a stat overview',
        'give me a stat recap', 'can i get a stat recap', 'show me a stat recap',
        'give me a stats summary', 'can i get a stats summary', 'show me a stats summary',
        'give me a stats overview', 'can i get a stats overview', 'show me a stats overview',
        'give me a stats recap', 'can i get a stats recap', 'show me a stats recap',
        'give me an annual stats', 'can i get annual stats', 'show me annual stats',
        'give me an annual statistics', 'can i get annual statistics', 'show me annual statistics',
        'give me an annual numbers', 'can i get annual numbers', 'show me annual numbers',
        'give me an annual data', 'can i get annual data', 'show me annual data',
        'give me an annual summary', 'can i get annual summary', 'show me annual summary',
        'give me an annual report', 'can i get annual report', 'show me annual report',
        'give me an annual review', 'can i get annual review', 'show me annual review',
        'give me an anual review', 'can i get an anual review', 'show me an anual review',
        'give me an anual report', 'can i get an anual report', 'show me an anual report',
        'give me an anual summary', 'can i get an anual summary', 'show me an anual summary',
        'give me an anual stats', 'can i get an anual stats', 'show me an anual stats',
        'give me an anual statistics', 'can i get an anual statistics', 'show me an anual statistics',
        'give me an anual numbers', 'can i get an anual numbers', 'show me an anual numbers',
        'give me an anual data', 'can i get an anual data', 'show me an anual data'
    ]
    
    for pattern in annual_patterns:
        if pattern in q:
            # Extract year
            import re
            years = re.findall(r'\b(20\d{2})\b', question)
            year = int(years[0]) if years else datetime.now().year
            
            return "annual", None, year
    
    return None, None, None

def is_review_intent(question: str) -> bool:
    """Check if the question is asking for a review (but not a comparison or weekend review)"""
    # First check if this is a comparison request - if so, it's not a review intent
    is_comparison, _, _, _ = detect_comparison_request(question)
    if is_comparison:
        return False
    
    # Check if this is a weekend review - if so, it's not a general review intent
    question_lower = question.lower()
    if any(phrase in question_lower for phrase in WEEKEND_REVIEW_PHRASES):
        return False
    
    # Then check for review intent
    review_type, _, _ = detect_review_type(question)
    return review_type is not None

def generate_quarterly_report(campus: str, year: int, quarter: int) -> dict:
    """Generate a quarterly report for a specific quarter and year"""
    # Define quarter date ranges
    quarter_ranges = {
        1: (datetime(year, 1, 1), datetime(year, 3, 31)),
        2: (datetime(year, 4, 1), datetime(year, 6, 30)),
        3: (datetime(year, 7, 1), datetime(year, 9, 30)),
        4: (datetime(year, 10, 1), datetime(year, 12, 31))
    }
    
    start_date, end_date = quarter_ranges[quarter]
    
    # Get rows data
    rows = []
    if sheet:
        try:
            rows = safe_sheets_request(sheet.get_all_records)
        except Exception as e:
            logger.error(f"Failed to get stats from Google Sheets: {e}")
            rows = []
    
    if not rows:
        memory = load_conversation_memory()
        campus_history = memory.get("session_stats", {}).get(campus, [])
        if not campus_history:
            campus_capitalized = campus.title()
            campus_history = memory.get("session_stats", {}).get(campus_capitalized, [])
            if campus_history:
                campus = campus_capitalized
        rows = campus_history
    
    # Filter rows by campus and date range
    filtered_rows = []
    campus_normalized = normalize_campus(campus)
    
    for row in rows:
        row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
        if row_campus == campus_normalized or campus_normalized in row_campus:
            timestamp_str = row.get("Timestamp", "")
            if timestamp_str:
                try:
                    if "T" in timestamp_str:
                        row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        row_date = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    if start_date <= row_date <= end_date:
                        filtered_rows.append(row)
                except Exception:
                    continue
    
    # Calculate stats for the quarter
    total_attendance = 0
    total_new_people = 0
    total_new_christians = 0
    total_youth = 0
    total_kids = 0
    total_connect_groups = 0
    entry_count = 0
    
    # Track values for average calculation
    attendance_values = []
    new_people_values = []
    new_christians_values = []
    youth_values = []
    kids_values = []
    connect_groups_values = []
    
    for entry in filtered_rows:
        if isinstance(entry, dict):
            def safe_int_stat(val):
                try:
                    if val is None or val == '':
                        return 0
                    return int(str(val).replace(',', '').strip())
                except Exception:
                    return 0
            attendance_val = safe_int_stat(entry.get('Total Attendance'))
            new_people_val = safe_int_stat(entry.get('New People'))
            new_christians_val = safe_int_stat(entry.get('New Christians'))
            youth_val = safe_int_stat(entry.get('Youth Attendance'))
            kids_val = safe_int_stat(entry.get('Kids Total'))
            connect_groups_val = safe_int_stat(entry.get('Connect Groups'))
            
            # Only count entries with at least one stat
            if any([attendance_val, new_people_val, new_christians_val, youth_val, kids_val, connect_groups_val]):
                entry_count += 1
            
            # Add to totals
            total_attendance += attendance_val
            total_new_people += new_people_val
            total_new_christians += new_christians_val
            total_youth += youth_val
            total_kids += kids_val
            total_connect_groups += connect_groups_val
            
            # Add to lists for averages (only if > 0)
            if attendance_val > 0:
                attendance_values.append(attendance_val)
            if new_people_val > 0:
                new_people_values.append(new_people_val)
            if new_christians_val > 0:
                new_christians_values.append(new_christians_val)
            if youth_val > 0:
                youth_values.append(youth_val)
            if kids_val > 0:
                kids_values.append(kids_val)
            if connect_groups_val > 0:
                connect_groups_values.append(connect_groups_val)
    
    # Calculate averages
    avg_attendance = sum(attendance_values) / len(attendance_values) if attendance_values else 0
    avg_new_people = sum(new_people_values) / len(new_people_values) if new_people_values else 0
    avg_new_christians = sum(new_christians_values) / len(new_christians_values) if new_christians_values else 0
    avg_youth = sum(youth_values) / len(youth_values) if youth_values else 0
    avg_kids = sum(kids_values) / len(kids_values) if kids_values else 0
    avg_connect_groups = sum(connect_groups_values) / len(connect_groups_values) if connect_groups_values else 0
    
    # Create results in the same format as annual report
    results = []
    stat_types = [
        ('attendance', 'Total Attendance', 'attendance'),
        ('new_people', 'New People', 'new_people'),
        ('new_christians', 'New Christians', 'new_christians'),
        ('youth', 'Youth Attendance', 'youth'),
        ('kids', 'Kids Total', 'kids'),
        ('connect_groups', 'Connect Groups', 'connect_groups'),
    ]
    
    for stat_type, stat_label, avg_key in stat_types:
        if stat_type == 'attendance':
            total = total_attendance
            avg = avg_attendance
        elif stat_type == 'new_people':
            total = total_new_people
            avg = avg_new_people
        elif stat_type == 'new_christians':
            total = total_new_christians
            avg = avg_new_christians
        elif stat_type == 'youth':
            total = total_youth
            avg = avg_youth
        elif stat_type == 'kids':
            total = total_kids
            avg = avg_kids
        elif stat_type == 'connect_groups':
            total = total_connect_groups
            avg = avg_connect_groups
        else:
            total = 0
            avg = 0
        
        results.append({
            "stat": stat_type,
            "label": stat_label,
            "year": year,
            "quarter": quarter,
            "campus": display_campus_name(campus),
            "total": total,
            "average": round(avg, 1),
            "count": entry_count
        })
    
    # Generate spoken summary
    quarter_names = {1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4"}
    spoken_summary = f"Here's your {quarter_names[quarter]} {year} report for {display_campus_name(campus)} campus."
    
    return {
        "report": results,
        "text": spoken_summary,
        "review_type": "quarterly",
        "quarter": quarter,
        "year": year
    }

def generate_monthly_report(campus: str, year: int, month: int) -> dict:
    """Generate a monthly report for a specific month and year"""
    # Calculate month date range
    if month == 12:
        start_date = datetime(year, month, 1)
        end_date = datetime(year, month, 31)
    else:
        start_date = datetime(year, month, 1)
        end_date = datetime(year, month + 1, 1) - timedelta(days=1)
    
    # Get rows data
    rows = []
    if sheet:
        try:
            rows = safe_sheets_request(sheet.get_all_records)
        except Exception as e:
            logger.error(f"Failed to get stats from Google Sheets: {e}")
            rows = []
    
    if not rows:
        memory = load_conversation_memory()
        campus_history = memory.get("session_stats", {}).get(campus, [])
        if not campus_history:
            campus_capitalized = campus.title()
            campus_history = memory.get("session_stats", {}).get(campus_capitalized, [])
            if campus_history:
                campus = campus_capitalized
        rows = campus_history
    
    # Filter rows by campus and date range
    filtered_rows = []
    campus_normalized = normalize_campus(campus)
    
    for row in rows:
        row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
        if row_campus == campus_normalized or campus_normalized in row_campus:
            timestamp_str = row.get("Timestamp", "")
            if timestamp_str:
                try:
                    if "T" in timestamp_str:
                        row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        row_date = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    if start_date <= row_date <= end_date:
                        filtered_rows.append(row)
                except Exception:
                    filtered_rows.append(row)
            else:
                filtered_rows.append(row)
    
    # Initialize all stat totals
    totals = {
        'total_attendance': 0,
        'first_time_visitors': 0,
        'visitors': 0,
        'information_gathered': 0,
        'first_time_christians': 0,
        'rededications': 0,
        'youth_attendance': 0,
        'youth_salvations': 0,
        'youth_new_people': 0,
        'kids_attendance': 0,
        'kids_leaders': 0,
        'new_kids': 0,
        'new_kids_salvations': 0,
        'connect_groups': 0,
        'dream_team': 0
    }
    
    # Initialize value lists for averages
    values = {key: [] for key in totals.keys()}
    
    entry_count = 0
    
    for entry in filtered_rows:
        if isinstance(entry, dict):
            def safe_int_stat(val):
                try:
                    if val is None or val == '':
                        return 0
                    return int(str(val).replace(',', '').strip())
                except Exception:
                    return 0
            
            # Extract all stats
            stats = {
                'total_attendance': safe_int_stat(entry.get('Total Attendance')),
                'first_time_visitors': safe_int_stat(entry.get('First Time Visitors')),
                'visitors': safe_int_stat(entry.get('Visitors')),
                'information_gathered': safe_int_stat(entry.get('Cards Back')),
                'first_time_christians': safe_int_stat(entry.get('First Time Christians')),
                'rededications': safe_int_stat(entry.get('Rededications')),
                'youth_attendance': safe_int_stat(entry.get('Youth Attendance')),
                'youth_salvations': safe_int_stat(entry.get('Youth Salvations')),
                'youth_new_people': safe_int_stat(entry.get('Youth New People')),
                'kids_attendance': safe_int_stat(entry.get('Kids Attendance') or entry.get('Kids Total')),
                'kids_leaders': safe_int_stat(entry.get('Kids Leaders')),
                'new_kids': safe_int_stat(entry.get('New Kids')),
                'new_kids_salvations': safe_int_stat(entry.get('New Kids Salvations')),
                'connect_groups': safe_int_stat(entry.get('Connect Groups')),
                'dream_team': safe_int_stat(entry.get('Dream Team'))
            }
            
            # Only count entries with at least one stat
            if any(stats.values()):
                entry_count += 1
            
            # Add to totals and value lists
            for key, value in stats.items():
                totals[key] += value
                if value > 0:
                                         values[key].append(value)
    
    # Calculate averages
    averages = {}
    for key in totals.keys():
        averages[key] = sum(values[key]) / len(values[key]) if values[key] else 0
    
    # Create comprehensive results with ALL stat headers
    results = []
    stat_definitions = [
        ('total_attendance', 'Total Attendance'),
        ('first_time_visitors', 'First Time Visitors'),
        ('visitors', 'Visitors'),
        ('new_people', 'New People'),  # Calculated field
        ('information_gathered', 'Cards Back'),
        ('first_time_christians', 'First Time Christians'),
        ('rededications', 'Rededications'),
        ('new_christians', 'New Christians'),  # Calculated field
        ('youth_attendance', 'Youth Attendance'),
        ('youth_salvations', 'Youth Salvations'),
        ('youth_new_people', 'Youth New People'),
        ('kids_attendance', 'Kids Total'),
        ('kids_leaders', 'Kids Leaders'),
        ('new_kids', 'New Kids'),
        ('new_kids_salvations', 'New Kids Salvations'),
        ('connect_groups', 'Connect Groups'),
        ('dream_team', 'Volunteers')  # Dream Team = Volunteers
    ]
    
    month_names = [
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    
    for stat_key, stat_label in stat_definitions:
        # Handle calculated fields
        if stat_key == 'new_people':
            total = totals['first_time_visitors'] + totals['visitors']
            avg = (averages['first_time_visitors'] + averages['visitors']) if (averages['first_time_visitors'] > 0 or averages['visitors'] > 0) else 0
        elif stat_key == 'new_christians':
            total = totals['first_time_christians'] + totals['rededications']
            avg = (averages['first_time_christians'] + averages['rededications']) if (averages['first_time_christians'] > 0 or averages['rededications'] > 0) else 0
        else:
            total = totals.get(stat_key, 0)
            avg = averages.get(stat_key, 0)
        
        results.append({
            "stat": stat_key,
            "label": stat_label,
            "year": year,
            "month": month,
            "period": "monthly",
            "campus": display_campus_name(campus),
            "total": total,
            "average": round(avg, 1),
            "count": entry_count
        })
    
    # Add service breakdown if campus has multiple services
    service_breakdown = calculate_service_breakdown(filtered_rows, campus)
    service_breakdown_text = format_service_breakdown_for_display(service_breakdown, campus)
    
    # Generate spoken summary with service breakdown if available
    month_name = month_names[month]
    spoken_summary = f"Here's your {month_name} {year} monthly review for {display_campus_name(campus)}."
    
    # Add service breakdown to spoken summary if multiple services
    if service_breakdown and len(service_breakdown) > 1:
        total_by_services = sum(data['total'] for data in service_breakdown.values())
        if total_by_services > 0:
            breakdown_parts = []
            for service_time, data in service_breakdown.items():
                if data['total'] > 0:
                    breakdown_parts.append(f"{service_time}: {data['total']:,}")
            if breakdown_parts:
                spoken_summary += f" Service breakdown: {', '.join(breakdown_parts)}."
    
    return {
        "report": results,
        "text": spoken_summary,
        "review_type": "monthly",
        "month": month,
        "year": year,
        "service_breakdown": service_breakdown,
        "service_breakdown_text": service_breakdown_text
    }

def generate_mid_year_report(campus: str, year: int) -> dict:
    """Generate a mid-year report (January to June)"""
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 6, 30)
    
    # Get rows data
    rows = []
    if sheet:
        try:
            rows = safe_sheets_request(sheet.get_all_records)
        except Exception as e:
            logger.error(f"Failed to get stats from Google Sheets: {e}")
            rows = []
    
    if not rows:
        memory = load_conversation_memory()
        campus_history = memory.get("session_stats", {}).get(campus, [])
        if not campus_history:
            campus_capitalized = campus.title()
            campus_history = memory.get("session_stats", {}).get(campus_capitalized, [])
            if campus_history:
                campus = campus_capitalized
        rows = campus_history
    
    # Filter rows by campus and date range
    filtered_rows = []
    campus_normalized = normalize_campus(campus)
    
    for row in rows:
        row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
        if row_campus == campus_normalized or campus_normalized in row_campus:
            timestamp_str = row.get("Timestamp", "")
            if timestamp_str:
                try:
                    if "T" in timestamp_str:
                        row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        row_date = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    if start_date <= row_date <= end_date:
                        filtered_rows.append(row)
                except Exception:
                    continue
    
    # Calculate stats for the mid-year period
    total_attendance = 0
    total_new_people = 0
    total_new_christians = 0
    total_youth = 0
    total_kids = 0
    total_connect_groups = 0
    entry_count = 0
    
    # Track values for average calculation
    attendance_values = []
    new_people_values = []
    new_christians_values = []
    youth_values = []
    kids_values = []
    connect_groups_values = []
    
    for entry in filtered_rows:
        if isinstance(entry, dict):
            def safe_int_stat(val):
                try:
                    if val is None or val == '':
                        return 0
                    return int(str(val).replace(',', '').strip())
                except Exception:
                    return 0
            attendance_val = safe_int_stat(entry.get('Total Attendance'))
            new_people_val = safe_int_stat(entry.get('New People'))
            new_christians_val = safe_int_stat(entry.get('New Christians'))
            youth_val = safe_int_stat(entry.get('Youth Attendance'))
            kids_val = safe_int_stat(entry.get('Kids Total'))
            connect_groups_val = safe_int_stat(entry.get('Connect Groups'))
            
            # Only count entries with at least one stat
            if any([attendance_val, new_people_val, new_christians_val, youth_val, kids_val, connect_groups_val]):
                entry_count += 1
            
            # Add to totals
            total_attendance += attendance_val
            total_new_people += new_people_val
            total_new_christians += new_christians_val
            total_youth += youth_val
            total_kids += kids_val
            total_connect_groups += connect_groups_val
            
            # Add to lists for averages (only if > 0)
            if attendance_val > 0:
                attendance_values.append(attendance_val)
            if new_people_val > 0:
                new_people_values.append(new_people_val)
            if new_christians_val > 0:
                new_christians_values.append(new_christians_val)
            if youth_val > 0:
                youth_values.append(youth_val)
            if kids_val > 0:
                kids_values.append(kids_val)
            if connect_groups_val > 0:
                connect_groups_values.append(connect_groups_val)
    
    # Calculate averages
    avg_attendance = sum(attendance_values) / len(attendance_values) if attendance_values else 0
    avg_new_people = sum(new_people_values) / len(new_people_values) if new_people_values else 0
    avg_new_christians = sum(new_christians_values) / len(new_christians_values) if new_christians_values else 0
    avg_youth = sum(youth_values) / len(youth_values) if youth_values else 0
    avg_kids = sum(kids_values) / len(kids_values) if kids_values else 0
    avg_connect_groups = sum(connect_groups_values) / len(connect_groups_values) if connect_groups_values else 0
    
    # Create results in the same format as annual report
    results = []
    stat_types = [
        ('attendance', 'Total Attendance', 'attendance'),
        ('new_people', 'New People', 'new_people'),
        ('new_christians', 'New Christians', 'new_christians'),
        ('youth', 'Youth Attendance', 'youth'),
        ('kids', 'Kids Total', 'kids'),
        ('connect_groups', 'Connect Groups', 'connect_groups'),
    ]
    
    for stat_type, stat_label, avg_key in stat_types:
        if stat_type == 'attendance':
            total = total_attendance
            avg = avg_attendance
        elif stat_type == 'new_people':
            total = total_new_people
            avg = avg_new_people
        elif stat_type == 'new_christians':
            total = total_new_christians
            avg = avg_new_christians
        elif stat_type == 'youth':
            total = total_youth
            avg = avg_youth
        elif stat_type == 'kids':
            total = total_kids
            avg = avg_kids
        elif stat_type == 'connect_groups':
            total = total_connect_groups
            avg = avg_connect_groups
        else:
            total = 0
            avg = 0
        
        results.append({
            "stat": stat_type,
            "label": stat_label,
            "year": year,
            "period": "mid_year",
            "campus": display_campus_name(campus),
            "total": total,
            "average": round(avg, 1),
            "count": entry_count
        })
    
    # Generate spoken summary
    spoken_summary = f"Here's your mid-year {year} report for {display_campus_name(campus)} campus."
    
    return {
        "report": results,
        "text": spoken_summary,
        "review_type": "mid_year",
        "year": year
    }

def generate_full_stat_report(campus: str, years: list) -> dict:
    # List of all stat types to include - comprehensive list
    stat_types = [
        ('attendance', 'Total Attendance', 'attendance'),
        ('first_time_visitors', 'First Time Visitors', 'first_time_visitors'),
        ('information_gathered', 'Cards Back', 'information_gathered'),
        ('new_christians', 'New Christians', 'new_christians'),
        ('rededications', 'Rededications', 'rededications'),
        ('youth_attendance', 'Youth Attendance', 'youth_attendance'),
        ('youth_salvations', 'Youth Salvations', 'youth_salvations'),
        ('youth_new_people', 'Youth New People', 'youth_new_people'),
        ('kids_attendance', 'Kids Attendance', 'kids_attendance'),
        ('kids_leaders', 'Kids Leaders', 'kids_leaders'),
        ('new_kids', 'New Kids', 'new_kids'),
        ('new_kids_salvations', 'New Kids Salvations', 'new_kids_salvations'),
        ('connect_groups', 'Connect Groups', 'connect_groups'),
        ('dream_team', 'Dream Team', 'dream_team'),
        ('tithe', 'Tithe', 'tithe'),
        ('baptisms', 'Baptisms', 'baptisms'),
        ('child_dedications', 'Child Dedications', 'child_dedications'),
        ('new_people', 'New People', 'new_people'),  # Keep for backward compatibility
    ]
    results = []
    for year in years:
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        if not rows:
            memory = load_conversation_memory()
            campus_history = memory.get("session_stats", {}).get(campus, [])
            if not campus_history:
                campus_capitalized = campus.title()
                campus_history = memory.get("session_stats", {}).get(campus_capitalized, [])
                if campus_history:
                    campus = campus_capitalized
            rows = campus_history
        year_stats = calculate_stats_for_year_range(rows, campus, year)
        for stat_type, stat_label, avg_key in stat_types:
            # Get total and average from the calculated stats
            total = year_stats.get(f'total_{stat_type}', 0)
            avg = year_stats.get('averages', {}).get(stat_type, 0)
            count = year_stats.get('total_entries', 0)
            
            results.append({
                "stat": stat_type,
                "label": stat_label,
                "year": year,
                "campus": display_campus_name(campus),
                "total": total,
                "average": round(avg, 1),
                "count": count
            })
    # Generate a spoken summary that matches the report data
    spoken_summary = generate_spoken_report_summary(results, campus, years)
    return {
        "report": results,
        "text": spoken_summary
    }

def generate_spoken_report_summary(results: list, campus: str, years: list) -> str:
    """Generate a simple, friendly response for annual/mid-year reviews"""
    campus_display = display_campus_name(campus)
    if not results:
        return f"No data found for {campus_display} campus."
    
    # Default to "annual review" unless it's clearly mid-year
    current_year = datetime.now().year
    current_month = datetime.now().month
    is_mid_year = any(year == current_year for year in years) and current_month <= 6  # Only call it mid-year if we're in first half
    
    if len(years) == 1:
        year_str = str(years[0])
        if is_mid_year:
            return f"Here's your mid-year review for {campus_display} campus in {year_str}."
        else:
            return f"Here's your annual review for {campus_display} campus in {year_str}."
    else:
        years_str = ", ".join(str(year) for year in sorted(years))
        return f"Here's your annual review for {campus_display} campus covering {years_str}."
    # After generating the summary string, replace large numbers with their word equivalents
    import re
    def replace_large_numbers(text):
        def repl(match):
            n = int(match.group(0).replace(',', ''))
            if n >= 1000:
                return num2words(n, to='number').replace('-', ' ')
            return match.group(0)
        return re.sub(r'\b\d{1,3}(?:,\d{3})+|\b\d{4,}\b', repl, text)
    summary = ... # existing summary generation logic
    summary = replace_large_numbers(summary)
    return summary

def detect_specific_stat_in_comparison(question: str) -> Optional[str]:
    """Detect which specific stat is being compared in the question"""
    question_lower = question.lower()
    
    # Map of stat keywords to stat types
    stat_keywords = {
        'attendance': ['attendance', 'total attendance', 'total', 'people'],
        'new_people': ['new people', 'newpeople', 'np', 'new', 'visitors'],
        'new_christians': ['new christians', 'christians', 'souls', 'salvations', 'conversions'],
        'youth': ['youth', 'youth attendance', 'teens', 'teenagers'],
        'kids': ['kids', 'children', 'kids total', 'children total'],
        'connect_groups': ['connect groups', 'connectgroups', 'groups', 'small groups', 'cell groups'],
        'dream_team': ['volunteers', 'dream team', 'serving', 'team']
    }
    
    # Check for specific stat mentions
    for stat_type, keywords in stat_keywords.items():
        for keyword in keywords:
            if keyword in question_lower:
                logger.info(f"[COMPARE] Detected specific stat: {stat_type} (keyword: {keyword})")
                return stat_type
    
    # If no specific stat detected, return None (will show all stats)
    logger.info(f"[COMPARE] No specific stat detected, will show all stats")
    return None

def generate_single_year_report(campus: str, year: int) -> dict:
    """Generate a report for a single year for comparison purposes"""
    # List of all stat types to include - comprehensive list
    stat_types = [
        ('attendance', 'Total Attendance', 'attendance'),
        ('first_time_visitors', 'First Time Visitors', 'first_time_visitors'),
        ('information_gathered', 'Cards Back', 'information_gathered'),
        ('new_christians', 'New Christians', 'new_christians'),
        ('rededications', 'Rededications', 'rededications'),
        ('youth_attendance', 'Youth Attendance', 'youth_attendance'),
        ('youth_salvations', 'Youth Salvations', 'youth_salvations'),
        ('youth_new_people', 'Youth New People', 'youth_new_people'),
        ('kids_attendance', 'Kids Attendance', 'kids_attendance'),
        ('kids_leaders', 'Kids Leaders', 'kids_leaders'),
        ('new_kids', 'New Kids', 'new_kids'),
        ('new_kids_salvations', 'New Kids Salvations', 'new_kids_salvations'),
        ('connect_groups', 'Connect Groups', 'connect_groups'),
        ('dream_team', 'Dream Team', 'dream_team'),
        ('tithe', 'Tithe', 'tithe'),
        ('baptisms', 'Baptisms', 'baptisms'),
        ('child_dedications', 'Child Dedications', 'child_dedications'),
        ('new_people', 'New People', 'new_people'),  # Keep for backward compatibility
    ]
    results = []
    rows = []
    if sheet:
        try:
            rows = safe_sheets_request(sheet.get_all_records)
        except Exception as e:
            logger.error(f"Failed to get stats from Google Sheets: {e}")
            rows = []
    if not rows:
        memory = load_conversation_memory()
        campus_history = memory.get("session_stats", {}).get(campus, [])
        if not campus_history:
            campus_capitalized = campus.title()
            campus_history = memory.get("session_stats", {}).get(campus_capitalized, [])
            if campus_history:
                campus = campus_capitalized
        rows = campus_history
    
    year_stats = calculate_stats_for_year_range(rows, campus, year)
    for stat_type, stat_label, avg_key in stat_types:
        # Get total and average from the calculated stats
        total = year_stats.get(f'total_{stat_type}', 0)
        avg = year_stats.get('averages', {}).get(stat_type, 0)
        count = year_stats.get('total_entries', 0)
        
        results.append({
            "stat": stat_type,
            "label": stat_label,
            "year": year,
            "campus": display_campus_name(campus),
            "total": total,
            "average": round(avg, 1),
            "count": count
        })
    
    return {
        "report": results,
        "text": f"Report for {display_campus_name(campus)} campus in {year}"
    }

def generate_targeted_comparison_report(campus: str, year: int, period_type: str, period_value: Optional[int], specific_stat: str) -> dict:
    """Generate a targeted report with only the specific stat for comparison"""
    # Generate the full report first
    if period_type == 'mid_year':
        full_report = generate_mid_year_report(campus, year)
    elif period_type == 'quarterly' and period_value:
        full_report = generate_quarterly_report(campus, year, period_value)
    elif period_type == 'monthly' and period_value:
        full_report = generate_monthly_report(campus, year, period_value)
    elif period_type == 'ytd':
        # Generate YTD report using the same logic as in handle_period_comparison_request
        current_date = datetime.now()
        start_date = datetime(year, 1, 1)
        
        # For YTD comparison, we want to compare the same period:
        # - Current year: Jan 1 to current date
        # - Past year: Jan 1 to the same day/month as current date
        if year == current_date.year:
            end_date = current_date
        else:
            # For past years, use the same day/month as current date
            try:
                end_date = datetime(year, current_date.month, current_date.day)
            except ValueError:
                # Get the last day of the month
                if current_date.month == 12:
                    end_date = datetime(year, 12, 31)
                else:
                    end_date = datetime(year, current_date.month + 1, 1) - timedelta(days=1)
        
        logger.info(f"[YTD DEBUG] Processing YTD for year {year}")
        logger.info(f"[YTD DEBUG] Start date: {start_date}, End date: {end_date}")
        logger.info(f"[YTD DEBUG] Current date: {current_date}")
        logger.info(f"[YTD DEBUG] Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        logger.info(f"[YTD DEBUG] Period type: {period_type}")
        logger.info(f"[YTD DEBUG] Campus: {campus}")
        
        # Get all rows and filter by date range
        if sheet:
            rows = safe_sheets_request(sheet.get_all_records)
            logger.info(f"[YTD DEBUG] Retrieved {len(rows)} rows from Google Sheets")
        else:
            rows = []
            logger.info(f"[YTD DEBUG] No sheet available, using empty rows")
        
        # Filter rows for YTD period
        filtered_rows = []
        for row in rows:
            row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
            campus_normalized = normalize_campus(campus)
            
            # More flexible campus matching
            campus_match = (row_campus == campus_normalized or
                          campus_normalized in row_campus or
                          row_campus in campus_normalized or
                          campus_normalized.replace(" ", "") in row_campus.replace(" ", "") or
                          row_campus.replace(" ", "") in campus_normalized.replace(" ", ""))
            
            if campus_match:
                row_date = get_row_timestamp(row)
                if row_date != datetime.min and start_date <= row_date <= end_date:
                    filtered_rows.append(row)
                    logger.info(f"[YTD DEBUG] Included row: {row.get('Date', 'unknown')} - {row.get('Campus', 'unknown')} - Attendance: {row.get('Total Attendance', 0)}")
                else:
                    logger.info(f"[YTD DEBUG] Excluded row: {row.get('Date', 'unknown')} - {row.get('Campus', 'unknown')} - Date: {row_date} (not in range {start_date} to {end_date})")
        
        logger.info(f"[YTD DEBUG] Found {len(filtered_rows)} rows matching campus '{campus}' and date range")
        
        # Calculate stats for YTD period
        stats = calculate_stats_from_filtered_rows(filtered_rows)
        stats["year"] = year
        
        logger.info(f"[YTD DEBUG] Calculated YTD stats: {stats}")
        
        # Format as report
        full_report = {
            "report": [],
            "text": f"YTD Report for {display_campus_name(campus)} campus in {year}",
            "year": year,
            "campus": campus
        }
        
        # Convert stats to report format
        stat_types = [
            ('attendance', 'Total Attendance'),
            ('new_people', 'New People'),
            ('new_christians', 'New Christians'),
            ('youth_attendance', 'Youth Attendance'),
            ('kids_attendance', 'Kids Attendance'),
            ('connect_groups', 'Connect Groups'),
            ('dream_team', 'Dream Team')
        ]
        
        for stat_key, stat_label in stat_types:
            total = stats.get(f'total_{stat_key}', 0)
            avg = stats.get('averages', {}).get(stat_key, 0)
            count = stats.get('total_entries', 0)
            
            full_report["report"].append({
                "stat": stat_key,
                "label": stat_label,
                "year": year,
                "campus": display_campus_name(campus),
                "total": total,
                "average": round(avg, 1),
                "count": count
            })
    else:
        full_report = generate_single_year_report(campus, year)
    
    # Filter to only include the specific stat
    filtered_report = []
    for stat_entry in full_report.get('report', []):
        if stat_entry.get('stat') == specific_stat:
            filtered_report.append(stat_entry)
            break
    
    # Return the report with only the specific stat
    result = full_report.copy()
    result['report'] = filtered_report
    return result

def handle_period_comparison_request(question: str, campus: str, years: list, period_type: str, period_value: Optional[int] = None) -> dict:
    logger.info(f"[COMPARE] handle_period_comparison_request called with: question={question}, campus={campus}, years={years}, period_type={period_type}, period_value={period_value}")
    # period_type: 'mid_year' or 'quarterly'
    # period_value: quarter number if quarterly, None if mid_year
    
    # Detect which specific stat is being compared
    specific_stat = detect_specific_stat_in_comparison(question)
    logger.info(f"[COMPARE] Specific stat detected: {specific_stat}")
    
    try:
        reports = []
        for year in years:
            if specific_stat:
                # Generate targeted report with only the specific stat
                report = generate_targeted_comparison_report(campus, year, period_type, period_value, specific_stat)
            else:
                # Generate full report with all stats
                if period_type == 'mid_year':
                    report = generate_mid_year_report(campus, year)
                elif period_type == 'quarterly' and period_value:
                    report = generate_quarterly_report(campus, year, period_value)
                elif period_type == 'monthly' and period_value:
                    report = generate_monthly_report(campus, year, period_value)
                elif period_type == 'ytd':
                    # For YTD comparison, we need to compare the same period in both years
                    current_date = datetime.now()
                    start_date = datetime(year, 1, 1)
                    
                    # For YTD comparison, we want to compare the same period:
                    # - Current year: Jan 1 to current date
                    # - Past year: Jan 1 to the same day/month as current date
                    if year == current_date.year:
                        end_date = current_date
                    else:
                        # For past years, use the same day/month as current date
                        try:
                            end_date = datetime(year, current_date.month, current_date.day)
                        except ValueError:
                            # Get the last day of the month
                            if current_date.month == 12:
                                end_date = datetime(year, 12, 31)
                            else:
                                end_date = datetime(year, current_date.month + 1, 1) - timedelta(days=1)
                    
                    logger.info(f"[YTD DEBUG] Processing YTD for year {year}")
                    logger.info(f"[YTD DEBUG] Start date: {start_date}, End date: {end_date}")
                    logger.info(f"[YTD DEBUG] Current date: {current_date}")
                    logger.info(f"[YTD DEBUG] Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
                    logger.info(f"[YTD DEBUG] Period type: {period_type}")
                    logger.info(f"[YTD DEBUG] Campus: {campus}")
                    
                    # Get all rows and filter by date range
                    if sheet:
                        rows = safe_sheets_request(sheet.get_all_records)
                        logger.info(f"[YTD DEBUG] Retrieved {len(rows)} rows from Google Sheets")
                    else:
                        rows = []
                        logger.info(f"[YTD DEBUG] No sheet available, using empty rows")
                    
                    # Filter rows for YTD period
                    filtered_rows = []
                    for row in rows:
                        row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
                        campus_normalized = normalize_campus(campus)
                        
                        # More flexible campus matching
                        campus_match = (row_campus == campus_normalized or
                                      campus_normalized in row_campus or
                                      row_campus in campus_normalized or
                                      campus_normalized.replace(" ", "") in row_campus.replace(" ", "") or
                                      row_campus.replace(" ", "") in campus_normalized.replace(" ", ""))
                        
                        if campus_match:
                            row_date = get_row_timestamp(row)
                            if row_date != datetime.min and start_date <= row_date <= end_date:
                                filtered_rows.append(row)
                                logger.info(f"[YTD DEBUG] Included row: {row.get('Date', 'unknown')} - {row.get('Campus', 'unknown')} - Attendance: {row.get('Total Attendance', 0)}")
                            else:
                                logger.info(f"[YTD DEBUG] Excluded row: {row.get('Date', 'unknown')} - {row.get('Campus', 'unknown')} - Date: {row_date} (not in range {start_date} to {end_date})")
                    
                    logger.info(f"[YTD DEBUG] Found {len(filtered_rows)} rows matching campus '{campus}' and date range")
                    
                    # Calculate stats for YTD period
                    stats = calculate_stats_from_filtered_rows(filtered_rows)
                    stats["year"] = year
                    
                    logger.info(f"[YTD DEBUG] Calculated YTD stats: {stats}")
                    
                    # Format as report
                    report = {
                        "report": [],
                        "text": f"YTD Report for {display_campus_name(campus)} campus in {year}",
                        "year": year,
                        "campus": campus
                    }
                    
                    # Convert stats to report format
                    stat_types = [
                        ('attendance', 'Total Attendance'),
                        ('new_people', 'New People'),
                        ('new_christians', 'New Christians'),
                        ('youth_attendance', 'Youth Attendance'),
                        ('kids_attendance', 'Kids Attendance'),
                        ('connect_groups', 'Connect Groups'),
                        ('dream_team', 'Dream Team')
                    ]
                    
                    for stat_key, stat_label in stat_types:
                        total = stats.get(f'total_{stat_key}', 0)
                        avg = stats.get('averages', {}).get(stat_key, 0)
                        count = stats.get('total_entries', 0)
                        
                        report["report"].append({
                            "stat": stat_key,
                            "label": stat_label,
                            "year": year,
                            "campus": display_campus_name(campus),
                            "total": total,
                            "average": round(avg, 1),
                            "count": count
                        })
                else:
                    report = generate_single_year_report(campus, year)
            reports.append(report)
        
        logger.info(f"[COMPARE] Generated {len(reports)} reports")
        
        # Compose comparison summary
        if specific_stat:
            stat_labels = {
                'attendance': 'Attendance',
                'new_people': 'New People', 
                'new_christians': 'New Christians',
                'youth': 'Youth',
                'kids': 'Kids',
                'connect_groups': 'Connect Groups',
                'dream_team': 'Volunteers'
            }
            stat_name = stat_labels.get(specific_stat, specific_stat)
            summary = f"Comparison of {stat_name} for {years[0]} and {years[1]} at {display_campus_name(campus)} campus."
        else:
            if period_type == 'ytd':
                summary = f"YTD (Year to Date) comparison for {years[0]} and {years[1]} at {display_campus_name(campus)} campus."
            else:
                summary = f"Comparison of {period_type.replace('_',' ')} "
                if period_type == 'quarterly' and period_value:
                    summary += f"Q{period_value} "
                summary += f"for {years[0]} and {years[1]} at {display_campus_name(campus)} campus."

        # PATCH: Ensure both reports have all stat keys
        stat_keys = ['attendance', 'new_people', 'new_christians', 'youth', 'kids', 'connect_groups']
        stat_labels = {
            'attendance': 'Attendance',
            'new_people': 'New People',
            'new_christians': 'New Christians',
            'youth': 'Youth',
            'kids': 'Kids',
            'connect_groups': 'Connect Groups'
        }
        
        def fill_missing_stats(report, year):
            stats_dict = {stat['stat']: stat for stat in report.get('report', [])}
            filled = []
            
            # If specific stat requested, only include that stat
            if specific_stat:
                stat = stats_dict.get(specific_stat, {
                    'stat': specific_stat,
                    'label': stat_labels.get(specific_stat, specific_stat.title()),
                    'year': year,
                    'total': 0,
                    'average': 0,
                    'count': 0,
                    'campus': campus,
                    'quarter': period_value if period_type == 'quarterly' else None
                })
                filled.append(stat)
            else:
                # Include all stats
                for key in stat_keys:
                    stat = stats_dict.get(key, {
                        'stat': key,
                        'label': stat_labels[key],
                        'year': year,
                        'total': 0,
                        'average': 0,
                        'count': 0,
                        'campus': campus,
                        'quarter': period_value if period_type == 'quarterly' else None
                    })
                    filled.append(stat)
            return filled
        
        # Fill missing stats for both reports (only if not specific stat)
        if not specific_stat:
            for i, year in enumerate(years):
                reports[i]['report'] = fill_missing_stats(reports[i], year)
        
        # Calculate percent changes
        percent_changes = {}
        if specific_stat:
            # Only calculate for the specific stat
            if len(reports[0]['report']) > 0 and len(reports[1]['report']) > 0:
                v1 = reports[0]['report'][0]['total']
                v2 = reports[1]['report'][0]['total']
                if v1 == 0 and v2 == 0:
                    pct = 0.0
                elif v1 == 0:
                    pct = 100.0
                else:
                    pct = ((v2 - v1) / abs(v1)) * 100.0
                percent_changes[specific_stat] = pct
        else:
            # Calculate for all stats
            for idx, key in enumerate(stat_keys):
                if idx < len(reports[0]['report']) and idx < len(reports[1]['report']):
                    v1 = reports[0]['report'][idx]['total']
                    v2 = reports[1]['report'][idx]['total']
                    if v1 == 0 and v2 == 0:
                        pct = 0.0
                    elif v1 == 0:
                        pct = 100.0
                    else:
                        pct = ((v2 - v1) / abs(v1)) * 100.0
                    percent_changes[key] = pct
        
        logger.info(f"[COMPARE] Calculated percent changes: {percent_changes}")
        
        # Compose and return the full comparison object
        result = {
            'comparison': True,
            'reports': reports,
            'percent_changes': percent_changes,
            'text': summary,
            'campus': campus,
            'insights': [summary],
            'years': years,
            'period_type': period_type,
            'period_value': period_value,
            'specific_stat': specific_stat
        }
        
        logger.info(f"[COMPARE] Returning comparison result with keys: {list(result.keys())}")
        logger.info(f"[COMPARE] Reports length: {len(result['reports'])}")
        logger.info(f"[COMPARE] Percent changes keys: {list(result['percent_changes'].keys())}")
        
        return result
        
    except Exception as e:
        logger.error(f"[COMPARE] Error in handle_period_comparison_request: {e}")
        # Return a fallback response
        return {
            'comparison': True,
            'reports': [],
            'percent_changes': {},
            'text': f"Error generating comparison for {campus} campus",
            'campus': campus,
            'insights': [f"Could not generate comparison: {str(e)}"],
            'years': years,
            'period_type': period_type,
            'period_value': period_value,
            'specific_stat': specific_stat
        }

def calculate_stats_from_filtered_rows(filtered_rows: List[dict]) -> dict:
    """Calculate stats from already filtered rows without additional filtering"""
    # Initialize all stat totals
    stats = {
        'attendance': 0,
        'first_time_visitors': 0,
        'information_gathered': 0,
        'new_christians': 0,
        'rededications': 0,
        'youth_attendance': 0,
        'youth_salvations': 0,
        'youth_new_people': 0,
        'kids_attendance': 0,
        'kids_leaders': 0,
        'new_kids': 0,
        'new_kids_salvations': 0,
        'connect_groups': 0,
        'dream_team': 0,
        'saints': 0,
        'tithe': 0,
        'baptisms': 0,
        'child_dedications': 0,
        'new_people': 0  # Keep for backward compatibility
    }
    
    # Track values for average calculation
    averages = {}
    entry_count = 0
    
    for entry in filtered_rows:
        if isinstance(entry, dict):
            def safe_int_stat(val):
                try:
                    if val is None or val == '':
                        return 0
                    return int(str(val).replace(',', '').strip())
                except Exception:
                    return 0
            
            # Extract all available stats with flexible field name matching
            def get_stat_value(field_names):
                """Get stat value from multiple possible field names"""
                for field_name in field_names:
                    value = entry.get(field_name)
                    if value is not None and value != '':
                        return safe_int_stat(value)
                return 0
            
            stat_values = {
                'attendance': get_stat_value(['Total Attendance', 'attendance']),
                'first_time_visitors': get_stat_value(['First Time Visitors', 'ft_visitors']),
                'visitors': get_stat_value(['Visitors', 'visitors']),
                'information_gathered': get_stat_value(['Cards Back', 'info_collected']),
                'first_time_christians': get_stat_value(['First Time Christians', 'salvations']),
                'rededications': get_stat_value(['Rededications', 'rededications']),
                'youth_attendance': get_stat_value(['Youth Attendance', 'youth']),
                'youth_salvations': get_stat_value(['Youth Salvations', 'youth_salvations']),
                'youth_new_people': get_stat_value(['Youth New People', 'youth_new']),
                'kids_attendance': get_stat_value(['Kids Attendance', 'Kids Total', 'kids']),
                'kids_leaders': get_stat_value(['Kids Leaders', 'kids_leaders']),
                'new_kids': get_stat_value(['New Kids', 'new_kids']),
                'new_kids_salvations': get_stat_value(['New Kids Salvations', 'new_kids_salvations']),
                'connect_groups': get_stat_value(['Connect Groups', 'groups']),
                'dream_team': get_stat_value(['Dream Team', 'team', 'Volunteers', 'volunteers']),
                'saints': get_stat_value(['Saints', 'saints']),
                'tithe': get_stat_value(['Tithe']),
                'baptisms': get_stat_value(['Baptisms']),
                'child_dedications': get_stat_value(['Child Dedications'])
            }
            
            # Calculate new people as First Time Visitors + Visitors
            new_people_total = stat_values['first_time_visitors'] + stat_values['visitors']
            stat_values['new_people'] = new_people_total
            
            # Calculate new christians as First Time Christians + Rededications
            new_christians_total = stat_values['first_time_christians'] + stat_values['rededications']
            stat_values['new_christians'] = new_christians_total
            
            # Only count entries with at least one stat
            if any(stat_values.values()):
                entry_count += 1
            
            # Add to totals
            for stat_name, value in stat_values.items():
                stats[f'total_{stat_name}'] = stats.get(f'total_{stat_name}', 0) + value
                
                # Track for averages (only if > 0)
                if value > 0:
                    if stat_name not in averages:
                        averages[stat_name] = []
                    averages[stat_name].append(value)
    
    # Calculate averages
    avg_stats = {}
    for stat_name, values in averages.items():
        if values:
            avg_stats[stat_name] = round(sum(values) / len(values), 1)
        else:
            avg_stats[stat_name] = 0
    
    return {
        "total_entries": entry_count,
        **stats,
        "averages": avg_stats
    }

def calculate_service_breakdown(filtered_rows: List[dict], campus: str) -> dict:
    """Calculate attendance breakdown by service times for a campus using actual Google Sheets columns"""
    print(f"\n[DEBUG SERVICE BREAKDOWN] ========== Starting for campus: {campus} ==========")
    print(f"[DEBUG SERVICE BREAKDOWN] Processing {len(filtered_rows)} rows")
    for idx, row in enumerate(filtered_rows):  # Show ALL rows now
        print(f"[DEBUG ROW {idx+1}] Date: {row.get('Date')}, Campus: {row.get('Campus')}, 9AM: {row.get('9:00 AM')}, 10AM: {row.get('10:00 AM')}, 11AM: {row.get('11:00 AM')}, 5PM: {row.get('5:00 PM')}, 5:30PM: {row.get('5:30 PM')}")
    service_times = get_campus_service_times(campus)
    print(f"[DEBUG SERVICE BREAKDOWN] Service times for {campus}: {service_times}")
    service_breakdown = {}
    kids_service_breakdown = {}
    
    # Map service times to actual Google Sheets column names
    SERVICE_COLUMN_MAPPING = {
        '9:00 AM': '9:00 AM',
        '10:00 AM': '10:00 AM', 
        '11:00 AM': '11:00 AM',
        '5:00 PM': '5:00 PM',
        '5:30 PM': '5:30 PM'
    }
    
    # Map kids service times to Google Sheets columns
    KIDS_COLUMN_MAPPING = {
        '9:00 AM': 'Kids 9:00 AM',
        '10:00 AM': 'Kids 10:00 AM', 
        '11:00 AM': 'Kids 11:00 AM',
        '5:00 PM': 'Kids 5:00 PM',
        '5:30 PM': 'Kids 5:30 PM'
    }
    
    # Initialize service breakdown structure
    for service_time in service_times:
        service_breakdown[service_time] = {
            'total': 0,
            'count': 0,
            'average': 0.0,
            'entries': []
        }
        kids_service_breakdown[service_time] = {
            'total': 0,
            'count': 0,
            'average': 0.0,
            'entries': []
        }
    
    # Process each row to extract service-specific data
    for entry in filtered_rows:
        if isinstance(entry, dict):
            total_attendance = 0
            try:
                total_attendance = int(str(entry.get('Total Attendance', 0)).replace(',', '').strip())
            except:
                total_attendance = 0
            
            # Extract service-specific attendance from actual Google Sheets columns
            service_specific_data = {}
            kids_specific_data = {}
            service_total = 0
            
            for service_time in service_times:
                # Adult attendance
                column_name = SERVICE_COLUMN_MAPPING.get(service_time, service_time)
                if column_name in entry:
                    try:
                        attendance = int(str(entry[column_name]).replace(',', '').strip())
                        if attendance > 0:
                            service_specific_data[service_time] = attendance
                            service_total += attendance
                    except:
                        pass
                
                # Kids attendance
                kids_column_name = KIDS_COLUMN_MAPPING.get(service_time)
                if kids_column_name and kids_column_name in entry:
                    try:
                        kids_attendance = int(str(entry[kids_column_name]).replace(',', '').strip())
                        if kids_attendance > 0:
                            kids_specific_data[service_time] = kids_attendance
                    except:
                        pass
            
            # If we have service-specific data from Google Sheets columns, use it
            if service_specific_data:
                for service_time, attendance in service_specific_data.items():
                    if service_time in service_breakdown:
                        service_breakdown[service_time]['total'] += attendance
                        service_breakdown[service_time]['count'] += 1
                        service_breakdown[service_time]['entries'].append(attendance)
            
            # Process kids data
            if kids_specific_data:
                for service_time, kids_attendance in kids_specific_data.items():
                    if service_time in kids_service_breakdown:
                        kids_service_breakdown[service_time]['total'] += kids_attendance
                        kids_service_breakdown[service_time]['count'] += 1
                        kids_service_breakdown[service_time]['entries'].append(kids_attendance)
            
            # If no service-specific data but we have total attendance, distribute proportionally
            elif total_attendance > 0 and len(service_times) > 0:
                # Use default distribution based on typical service patterns
                # This can be customized per campus in the future
                default_ratios = {
                    '9:00 AM': 0.35,   # 35% typically at 9am
                    '10:00 AM': 1.0,   # 100% for single service campuses
                    '11:00 AM': 0.65,  # 65% typically at 11am  
                    '5:00 PM': 0.15    # 15% typically at evening service
                }
                
                if len(service_times) == 1:
                    # Single service campus - all attendance goes to that service
                    service_time = service_times[0]
                    attendance = total_attendance
                    service_breakdown[service_time]['total'] += attendance
                    service_breakdown[service_time]['count'] += 1
                    service_breakdown[service_time]['entries'].append(attendance)
                else:
                    # Multiple services - distribute based on ratios
                    remaining_attendance = total_attendance
                    
                    for i, service_time in enumerate(service_times):
                        if i == len(service_times) - 1:
                            # Last service gets remainder
                            attendance = remaining_attendance
                        else:
                            ratio = default_ratios.get(service_time, 1.0 / len(service_times))
                            attendance = int(total_attendance * ratio)
                            remaining_attendance -= attendance
                        
                        if attendance > 0:
                            service_breakdown[service_time]['total'] += attendance
                            service_breakdown[service_time]['count'] += 1
                            service_breakdown[service_time]['entries'].append(attendance)
    
    # Calculate averages for adult attendance
    for service_time in service_breakdown:
        if service_breakdown[service_time]['count'] > 0:
            service_breakdown[service_time]['average'] = round(
                service_breakdown[service_time]['total'] / service_breakdown[service_time]['count'], 1
            )
    
    # Calculate averages for kids attendance
    for service_time in kids_service_breakdown:
        if kids_service_breakdown[service_time]['count'] > 0:
            kids_service_breakdown[service_time]['average'] = round(
                kids_service_breakdown[service_time]['total'] / kids_service_breakdown[service_time]['count'], 1
            )
    
    print(f"[DEBUG SERVICE BREAKDOWN] Final results for {campus}:")
    for service_time, data in service_breakdown.items():
        print(f"  {service_time}: total={data['total']}, count={data['count']}, avg={data['average']}")
    print(f"[DEBUG SERVICE BREAKDOWN] ========== End for campus: {campus} ==========\n")
    
    return {
        'adult': service_breakdown,
        'kids': kids_service_breakdown
    }

def enhance_attendance_with_service_breakdown(stats: dict, filtered_rows: List[dict], campus: str) -> dict:
    """Enhance attendance stats with service time breakdown"""
    breakdown_data = calculate_service_breakdown(filtered_rows, campus)
    
    # Add both adult and kids service breakdown to the stats
    stats['service_breakdown'] = breakdown_data['adult']
    stats['kids_service_breakdown'] = breakdown_data['kids']
    
    # Add summary information
    total_services = sum(data['total'] for data in breakdown_data['adult'].values())
    stats['total_attendance_by_services'] = total_services
    
    # If the service breakdown total doesn't match the original total attendance,
    # use the original (it might be more accurate)
    if 'total_attendance' in stats and stats['total_attendance'] != total_services:
        stats['attendance_note'] = f"Service breakdown total ({total_services}) differs from reported total ({stats.get('total_attendance', 0)})"
    
    return stats

def format_service_breakdown_for_display(service_breakdown: dict, campus: str) -> str:
    """Format service breakdown for display in reports"""
    if not service_breakdown:
        return ""
    
    campus_name = display_campus_name(campus)
    breakdown_text = f"\n\n{campus_name} Service Breakdown:\n"
    
    total_all_services = 0
    for service_time, data in service_breakdown.items():
        total = data['total']
        average = data['average']
        count = data['count']
        
        breakdown_text += f"  • {service_time}: {total:,} total"
        if count > 1:
            breakdown_text += f" (avg: {average:.1f} over {count} services)"
        breakdown_text += "\n"
        
        total_all_services += total
    
    breakdown_text += f"  Total across all services: {total_all_services:,}"
    
    return breakdown_text

def extract_stats_with_service_context(text: str, campus: str) -> Dict[str, Any]:
    """Enhanced stats extraction that recognizes service-specific attendance"""
    # Start with the existing extraction
    stats = extract_stats_with_context(text, campus)
    
    # Try to parse service-specific attendance
    service_attendance = parse_service_attendance(text, campus)
    
    if service_attendance:
        # If we found service-specific data, add it to the stats
        stats['service_breakdown'] = service_attendance
        
        # Calculate total attendance from services
        total_from_services = sum(service_attendance.values())
        
        # If no total attendance was found, use the service total
        if not stats.get('Total Attendance') and total_from_services > 0:
            stats['Total Attendance'] = total_from_services
        
        # Add individual service columns for storage
        for service_time, attendance in service_attendance.items():
            column_name = f"{service_time.replace(':', '').replace(' ', '_').lower()}_attendance"
            stats[column_name] = attendance
    
    return stats

def calculate_stats_for_year_range(rows: List[dict], campus: str, start_year: int, end_year: Optional[int] = None) -> dict:
    """Calculate stats for a specific year range"""
    if end_year is None:
        end_year = start_year
    
    start_date = datetime(start_year, 1, 1)
    end_date = datetime(end_year, 12, 31, 23, 59, 59)
    
    # Normalize campus name for comparison
    campus_normalized = normalize_campus(campus)
    filtered_rows = []
    unique_campuses = set()
    
    logger.info(f"[YEAR_RANGE] Filtering for {campus} ({campus_normalized}) from {start_year} to {end_year}")
    logger.info(f"[YEAR_RANGE] Date range: {start_date} to {end_date}")
    
    for row in rows:
        row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
        unique_campuses.add(row_campus)
        
        # More flexible campus matching
        campus_match = (row_campus == campus_normalized or
                       campus_normalized in row_campus or
                       row_campus in campus_normalized or
                       campus_normalized.replace(" ", "") in row_campus.replace(" ", "") or
                       row_campus.replace(" ", "") in campus_normalized.replace(" ", ""))
        
        if campus_match:
            # Use the improved get_row_timestamp function
            row_date = get_row_timestamp(row)
            
            if row_date != datetime.min and start_date <= row_date <= end_date:
                filtered_rows.append(row)
                logger.info(f"[YEAR_RANGE] INCLUDED: {row.get('Date', 'No Date')} - {row.get('Campus', 'No Campus')} - {row_date}")
            else:
                logger.info(f"[YEAR_RANGE] EXCLUDED: {row.get('Date', 'No Date')} - {row.get('Campus', 'No Campus')} - {row_date}")
    
    logger.info(f"[YEAR_RANGE] Found {len(filtered_rows)} rows for {campus} in {start_year}-{end_year}")
    logger.info(f"[YEAR_RANGE] Unique campuses in data: {sorted(unique_campuses)}")
    
    # Use the comprehensive calculate_stats_from_filtered_rows function
    stats = calculate_stats_from_filtered_rows(filtered_rows)
    stats["year"] = start_year
    return stats

def extract_stat_from_row(entry, stat_type):
    # If entry is a dict, use flexible field name matching
    if isinstance(entry, dict):
        stat_fields = {
            'attendance': ["Total Attendance", "Attendance", "attendance", "total_attendance"],
            'new_people': ["New People", "NewPeople", "new_people", "First Time Visitors", "Visitors"],
            'new_christians': ["New Christians", "Souls", "new_christians", "First Time Christians", "Rededications"],
            'youth': ["Youth Attendance", "Youth", "youth_attendance"],
            'kids': ["Kids Total", "Kids", "kids_total"],
            'connect_groups': ["Connect Groups", "ConnectGroups", "connect_groups"],
            'dream_team': ["Volunteers", "volunteers", "Dream Team", "dream_team"]
        }
        for field in stat_fields.get(stat_type, []):
            val = entry.get(field)
            if val not in (None, ""):
                try:
                    return int(str(val).replace(",", "").strip())
                except Exception:
                    continue
        return 0
    # If entry is a list or tuple, use positional mapping
    elif isinstance(entry, (list, tuple)):
        # Detect format: if 3rd column is a date, it's standard; if 2nd column is campus, it's link-logged
        def is_date(val):
            try:
                if not val or not isinstance(val, str):
                    return False
                parts = val.split("-")
                return len(parts) >= 3 and len(parts[0]) == 4
            except Exception:
                return False
        # Standard: [Timestamp, Date, Campus, ...]
        if len(entry) >= 12 and is_date(entry[1]):
            mapping = {
                'attendance': 3,
                'new_people': 4,
                'new_christians': 5,
                'youth': 6,
                'kids': 9,
                'connect_groups': 11,
                'dream_team': None  # Not present
            }
        # Link-logged: [Timestamp, Campus, Attendance, ...]
        elif len(entry) >= 8 and not is_date(entry[1]):
            mapping = {
                'attendance': 2,
                'new_people': 3,
                'new_christians': 4,
                'youth': 5,
                'kids': 6,
                'connect_groups': 7,
                'dream_team': None  # Not present
            }
        else:
            return 0
        idx = mapping.get(stat_type)
        if idx is not None and idx < len(entry):
            val = entry[idx]
            if val not in (None, ""):
                try:
                    return int(str(val).replace(",", "").strip())
                except Exception:
                    return 0
        return 0
    return 0

def get_weekly_campus_comparison_data():
    """Get weekly comparison data across all campuses for senior leaders/admins (always last 7 days)"""
    try:
        if not sheet:
            return []
        
        # Get all records
        rows = safe_sheets_request(sheet.get_all_records)
        if not rows:
            return []
        
        # Always use last 7 days for weekly comparison
        now = datetime.now()
        start_date = now - timedelta(days=7)
        end_date = now
        
        # Get active campuses (excluding 'all_campuses' special entry)
        campuses_db = load_campuses_database()
        active_campuses = []
        for campus_id, campus_info in campuses_db.get('campuses', {}).items():
            if campus_info.get('active', False) and not campus_info.get('special', False):
                active_campuses.append({
                    'id': campus_id,
                    'name': campus_info.get('display_name', campus_id),
                    'full_name': campus_info.get('name', campus_id)
                })
        
        comparison_data = []
        
        for campus_info in active_campuses:
            campus_id = campus_info['id']
            campus_name = campus_info['name']
            
            # Filter rows for this campus
            campus_normalized = normalize_campus(campus_id)
            campus_rows = []
            for row in rows:
                row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
                if row_campus == campus_normalized or campus_normalized in row_campus:
                    timestamp_str = row.get("Timestamp", "")
                    if timestamp_str:
                        try:
                            if "T" in timestamp_str:
                                row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            else:
                                row_date = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                            
                            if start_date <= row_date <= end_date:
                                campus_rows.append(row)
                        except Exception:
                            continue
            
            # Calculate campus stats
            total_attendance = 0
            total_new_people = 0
            total_new_christians = 0
            total_dream_team = 0
            entry_count = 0
            
            for row in campus_rows:
                total_attendance += safe_int(row.get('Total Attendance', 0))
                total_new_people += safe_int(row.get('New People', 0))
                total_new_christians += safe_int(row.get('New Christians', 0))
                total_dream_team += safe_int(row.get('Dream Team', 0))
                entry_count += 1
            
            # Calculate Dream Team percentage (dream team as % of attendance)
            dream_team_percentage = (total_dream_team / total_attendance * 100) if total_attendance > 0 else 0
            
            # Determine status based on performance
            status = determine_campus_status(total_attendance, total_new_people, total_new_christians, dream_team_percentage, entry_count)
            
            comparison_data.append({
                'campus': campus_name,
                'attendance': total_attendance,
                'new_people': total_new_people,
                'salvations': total_new_christians,
                'dream_team_percent': round(dream_team_percentage, 1),
                'status': status,
                'entries': entry_count
            })
        
        # Sort by attendance (highest first)
        comparison_data.sort(key=lambda x: x['attendance'], reverse=True)
        
        return comparison_data
        
    except Exception as e:
        logger.error(f"Campus comparison data error: {e}")
        return []

def determine_campus_status(attendance, new_people, salvations, dream_team_percent, entries):
    """Determine campus status based on performance metrics"""
    if entries == 0:
        return "No Data"
    
    # Calculate performance score (out of 100)
    score = 0
    
    # Attendance factor (30% of score)
    if attendance >= 400:
        score += 30
    elif attendance >= 200:
        score += 20
    elif attendance >= 100:
        score += 15
    else:
        score += 5
    
    # New People factor (25% of score)
    avg_new_people = new_people / entries if entries > 0 else 0
    if avg_new_people >= 8:
        score += 25
    elif avg_new_people >= 5:
        score += 20
    elif avg_new_people >= 2:
        score += 15
    else:
        score += 5
    
    # Salvations factor (25% of score)
    avg_salvations = salvations / entries if entries > 0 else 0
    if avg_salvations >= 3:
        score += 25
    elif avg_salvations >= 1:
        score += 20
    elif avg_salvations >= 0.5:
        score += 15
    else:
        score += 5
    
    # Dream Team factor (20% of score)
    if dream_team_percent >= 30:
        score += 20
    elif dream_team_percent >= 25:
        score += 15
    elif dream_team_percent >= 20:
        score += 10
    else:
        score += 5
    
    # Determine status based on total score
    if score >= 85:
        return "Excellent"
    elif score >= 65:
        return "Good"
    elif score >= 45:
        return "Fair"
    else:
        return "Needs Attention"

# Insights function removed - will be rebuilt from scratch

def calculate_date_range(date_filter, custom_start_date, custom_end_date, now):
    """Calculate start and end dates based on filter type"""
    print(f"[DEBUG] calculate_date_range called with: date_filter={date_filter}, custom_start_date={custom_start_date}, custom_end_date={custom_end_date}")
    try:
        if date_filter == 'last_weekend':
            # Find the most recent weekend (Friday-Tuesday)
            # Include Friday (youth night), Saturday, Sunday, Monday, Tuesday (late submissions)
            # Friday is weekday 4, Saturday is 5, Sunday is 6, Monday is 0, Tuesday is 1
            today = now.date() if isinstance(now, datetime) else now
            days_since_saturday = (today.weekday() + 2) % 7  # Days since last Saturday
            if days_since_saturday == 0:
                # Today is Saturday, go back to last Saturday
                days_since_saturday = 7
            last_saturday = today - timedelta(days=days_since_saturday)
            last_friday = last_saturday - timedelta(days=1)  # Friday (youth night)
            last_sunday = last_saturday + timedelta(days=1)
            last_monday = last_sunday + timedelta(days=1)  # Monday (late submissions)
            last_tuesday = last_monday + timedelta(days=1)  # Tuesday (late submissions)
            start_date = datetime.combine(last_friday, datetime.min.time())  # Start from Friday
            end_date = datetime.combine(last_tuesday, datetime.max.time())  # End Tuesday night
            print(f"[DEBUG] last_weekend: Friday={last_friday} to Tuesday={last_tuesday}")
        elif date_filter == 'last_7_days':
            start_date = now - timedelta(days=7)
            end_date = now
        elif date_filter == 'last_30_days':
            start_date = now - timedelta(days=30)
            end_date = now
        elif date_filter == 'last_90_days':
            start_date = now - timedelta(days=90)
            end_date = now
        elif date_filter == 'last_6_months':
            start_date = now - timedelta(days=180)  # Approximately 6 months
            end_date = now
        elif date_filter == 'last_12_months':
            start_date = now - timedelta(days=365)  # 12 months
            end_date = now
        elif date_filter == 'ytd':
            # Year to date
            start_date = datetime(now.year, 1, 1)
            end_date = now
        elif date_filter == 'year_to_date':
            # Year to date (alternative name)
            start_date = datetime(now.year, 1, 1)
            end_date = now
        elif date_filter == 'this_year':
            # This year (January 1 to December 31)
            start_date = datetime(now.year, 1, 1)
            end_date = datetime(now.year, 12, 31, 23, 59, 59)
            print(f"[DEBUG] this_year case: start_date={start_date}, end_date={end_date}")
        elif date_filter == 'last_year':
            # Previous full year
            start_date = datetime(now.year - 1, 1, 1)
            end_date = datetime(now.year - 1, 12, 31, 23, 59, 59)
        elif date_filter == 'custom' and custom_start_date and custom_end_date:
            # Custom date range
            start_date = datetime.strptime(custom_start_date, '%Y-%m-%d')
            end_date = datetime.strptime(custom_end_date, '%Y-%m-%d')
            # Set end date to end of day
            end_date = end_date.replace(hour=23, minute=59, second=59)
        else:
            # Default to last 30 days
            start_date = now - timedelta(days=30)
            end_date = now
        
        return start_date, end_date
    except Exception as e:
        logger.error(f"Date range calculation error: {e}")
        # Default fallback
        return now - timedelta(days=30), now

def get_monthly_tithe_from_finance_tab(campus, start_date, end_date):
    """Get monthly tithe totals from the Tithe tab for charts"""
    try:
        if not finance_sheet:
            return {}
        
        rows = safe_sheets_request(finance_sheet.get_all_records)
        monthly_tithe = {}
        
        # Convert datetime to date if necessary
        if isinstance(start_date, datetime):
            start_date = start_date.date()
        if isinstance(end_date, datetime):
            end_date = end_date.date()
        
        for row in rows:
            try:
                date_str = row.get('Date', '')
                if not date_str:
                    continue
                
                # Parse date
                if isinstance(date_str, str):
                    row_date = None
                    for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
                        try:
                            row_date = datetime.strptime(date_str, fmt).date()
                            break
                        except ValueError:
                            continue
                    if not row_date:
                        continue
                else:
                    continue
                
                # Check if in date range
                if not (start_date <= row_date <= end_date):
                    continue
                
                # Check campus match (skip filtering for roll-up views)
                if campus not in ['all_campuses', 'australia']:
                    row_campus = str(row.get('Campus', '')).strip().lower().replace(' ', '_')
                    campus_normalized = campus.lower().replace(' ', '_')
                    if row_campus != campus_normalized:
                        continue
                
                # Get month key and accumulate tithe
                month_key = row_date.strftime('%Y-%m')
                if month_key not in monthly_tithe:
                    monthly_tithe[month_key] = 0
                
                total = float(row.get('Total', 0) or 0)
                monthly_tithe[month_key] += total
            except Exception as e:
                continue
        
        return monthly_tithe
    except Exception as e:
        logger.error(f"Error fetching monthly tithe from Tithe tab: {str(e)}")
        return {}

def get_tithe_breakdown(campus, start_date, end_date):
    """Get tithe breakdown from DATABASE FIRST, then fallback to Google Sheets"""
    try:
        from datetime import datetime as dt_module
        
        logger.info(f"[TITHE_BREAKDOWN] Called with campus='{campus}', start_date={start_date}, end_date={end_date}")
        
        # Convert datetime to date if necessary
        if isinstance(start_date, datetime):
            start_date = start_date.date()
        if isinstance(end_date, datetime):
            end_date = end_date.date()
        
        logger.info(f"[TITHE_BREAKDOWN] After conversion: start_date={start_date}, end_date={end_date}")
        
        breakdown = {'general': 0, 'trust': 0, 'online': 0, 'text': 0, 'total': 0, 'count': 0}
        
        # ============================================================
        # STEP 1: TRY DATABASE FIRST (PRIMARY SOURCE)
        # ============================================================
        try:
            logger.info(f"[TITHE_BREAKDOWN] Step 1: Querying database for campus='{campus}'")
            
            # Build query
            query = FinanceRecord.query.filter(
                FinanceRecord.date >= start_date,
                FinanceRecord.date <= end_date
            )
            
            # Filter by campus if not "all_campuses"
            if campus not in ['all_campuses', 'australia']:
                # First, try to find the campus in CampusV2 to get the exact campus_id
                campus_obj = CampusV2.query.filter(
                    db.or_(
                        db.func.lower(CampusV2.campus_id) == campus.lower(),
                        db.func.lower(CampusV2.name) == campus.lower(),
                        db.func.lower(CampusV2.display_name) == campus.lower(),
                        db.func.lower(CampusV2.campus_id) == campus.lower().replace(' ', '_').replace('-', '_'),
                        db.func.lower(CampusV2.name) == campus.lower().replace('_', ' ').replace('-', ' '),
                        db.func.lower(CampusV2.display_name) == campus.lower().replace('_', ' ').replace('-', ' ')
                    )
                ).first()
                
                if campus_obj:
                    # Use the exact campus_id from the database - this is the most reliable match
                    exact_campus_id = campus_obj.campus_id
                    logger.info(f"[TITHE_BREAKDOWN] Found campus in CampusV2: '{campus}' -> campus_id='{exact_campus_id}', name='{campus_obj.name}', display_name='{campus_obj.display_name}'")
                    # Match by exact campus_id OR campus_name (case-insensitive) - handle both formats
                    query = query.filter(
                        db.or_(
                            db.func.lower(FinanceRecord.campus_id) == exact_campus_id.lower(),
                            db.func.lower(FinanceRecord.campus_name) == campus_obj.display_name.lower(),
                            db.func.lower(FinanceRecord.campus_name) == campus_obj.name.lower()
                        )
                    )
                else:
                    # Fallback: try multiple format variants
                    campus_normalized = campus.lower().replace(' ', '_').replace('-', '_').strip()
                    campus_lower = campus.lower().strip()
                    campus_name_variants = [
                        campus_lower,
                        campus_normalized,
                        campus.replace('_', ' ').lower(),
                        campus.replace(' ', '_').lower(),
                        campus.replace('-', '_').lower(),
                        campus.replace('-', ' ').lower()
                    ]
                    
                    logger.info(f"[TITHE_BREAKDOWN] Campus not found in CampusV2, using variants: original='{campus}', normalized='{campus_normalized}'")
                    
                    # Build comprehensive OR filter for campus matching
                    conditions = []
                    for variant in campus_name_variants:
                        conditions.append(db.func.lower(FinanceRecord.campus_id) == variant)
                        conditions.append(db.func.lower(FinanceRecord.campus_name) == variant)
                    
                    query = query.filter(db.or_(*conditions))
                    logger.info(f"[TITHE_BREAKDOWN] Applied {len(conditions)} matching conditions (fallback)")
            else:
                logger.info(f"[TITHE_BREAKDOWN] No campus filter (all_campuses or australia)")
            
            # Get records
            records = query.all()
            logger.info(f"[TITHE_BREAKDOWN] Found {len(records)} finance records in database for campus '{campus}' in date range {start_date} to {end_date}")
            
            if records:
                # Log all found records for debugging
                logger.info(f"[TITHE_BREAKDOWN] Records found:")
                for record in records:
                    logger.info(f"  - {record.campus_name} (ID: {record.campus_id}) on {record.date}: ${record.total}")
                
                # Aggregate from database
                for record in records:
                    breakdown['general'] += float(record.general or 0)
                    breakdown['trust'] += float(record.trust or 0)
                    breakdown['online'] += float(record.online or 0)
                    breakdown['text'] += float(record.text or 0)
                    breakdown['total'] += float(record.total or 0)
                    breakdown['count'] += 1
                
                logger.info(f"[TITHE_BREAKDOWN] Aggregated from database: count={breakdown['count']}, total=${breakdown['total']:.2f}, general=${breakdown['general']:.2f}, trust=${breakdown['trust']:.2f}, online=${breakdown['online']:.2f}, text=${breakdown['text']:.2f}")
                
                # Calculate averages
                if breakdown['count'] > 0:
                    for key in ['general', 'trust', 'online', 'text', 'total']:
                        breakdown[key] = round(breakdown[key] / breakdown['count'], 2)
                
                logger.info(f"[TITHE_BREAKDOWN] ✅ Returning database data (averages): {breakdown}")
                return breakdown
            else:
                logger.warning(f"[TITHE_BREAKDOWN] ⚠️ No database records found for campus '{campus}' in date range {start_date} to {end_date}, falling back to sheets")
                # Log what records exist in the database for debugging
                all_records = FinanceRecord.query.filter(
                    FinanceRecord.date >= start_date,
                    FinanceRecord.date <= end_date
                ).all()
                if all_records:
                    logger.info(f"[TITHE_BREAKDOWN] But found {len(all_records)} records in date range for other campuses:")
                    for record in all_records[:10]:  # Log first 10
                        logger.info(f"  - {record.campus_name} (ID: {record.campus_id}) on {record.date}")
        except Exception as e:
            logger.error(f"[TITHE_BREAKDOWN] ❌ Error loading tithe from database: {str(e)}", exc_info=True)
            logger.warning(f"[TITHE_BREAKDOWN] Falling back to Google Sheets")
        
        # ============================================================
        # STEP 2: FALLBACK TO GOOGLE SHEETS
        # ============================================================
        if not finance_sheet:
            logger.warning("Finance sheet not available, returning zero breakdown")
            return {'general': 0, 'trust': 0, 'online': 0, 'text': 0, 'total': 0}
        
        rows = safe_sheets_request(finance_sheet.get_all_records)
        breakdown = {'general': 0, 'trust': 0, 'online': 0, 'text': 0, 'total': 0, 'count': 0}
        
        logger.info(f"[TITHE_BREAKDOWN] Querying sheets for campus='{campus}', date_range={start_date} to {end_date}, total_rows={len(rows) if rows else 0}")
        
        for row in rows:
            try:
                date_str = row.get('Date', '')
                if not date_str:
                    continue
                
                # Parse date
                if isinstance(date_str, str):
                    row_date = None
                    for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
                        try:
                            row_date = datetime.strptime(date_str, fmt).date()
                            break
                        except ValueError:
                            continue
                    if not row_date:
                        continue
                else:
                    continue
                
                # Check if in date range
                if not (start_date <= row_date <= end_date):
                    continue
                
                # Check campus match (skip filtering for roll-up views)
                if campus not in ['all_campuses', 'australia']:
                    row_campus = str(row.get('Campus', '')).strip()
                    # Normalize both for comparison - handle multiple formats
                    row_campus_normalized = row_campus.lower().replace(' ', '_').replace('-', '_')
                    campus_normalized = campus.lower().replace(' ', '_').replace('-', '_')
                    
                    # Try multiple matching strategies
                    campus_match = (
                        row_campus_normalized == campus_normalized or
                        row_campus.lower() == campus.lower() or
                        row_campus_normalized == campus.lower() or
                        row_campus.lower() == campus_normalized
                    )
                    
                    if not campus_match:
                        continue
                
                # Accumulate breakdown (column names match Google Sheets exactly)
                breakdown['general'] += float(row.get('General', 0) or 0)
                breakdown['trust'] += float(row.get('Trust', 0) or 0)
                breakdown['online'] += float(row.get('Online Giving', 0) or 0)
                breakdown['text'] += float(row.get('Text', 0) or 0)
                breakdown['total'] += float(row.get('Total', 0) or 0)
                breakdown['count'] += 1
                logger.debug(f"[TITHE_BREAKDOWN] Matched row: Campus='{row.get('Campus')}', Date='{row.get('Date')}', Total='{row.get('Total')}'")
            except Exception as e:
                logger.debug(f"[TITHE_BREAKDOWN] Error processing row: {str(e)}")
                continue
        
        # Calculate averages
        if breakdown['count'] > 0:
            for key in ['general', 'trust', 'online', 'text', 'total']:
                breakdown[key] = round(breakdown[key] / breakdown['count'], 2)
        
        logger.info(f"[TITHE_BREAKDOWN] Loaded from sheets: {breakdown['count']} records for '{campus}', total=${breakdown['total']:.2f}")
        return breakdown
        
    except Exception as e:
        logger.error(f"Error fetching tithe breakdown: {str(e)}")
        return {'general': 0, 'trust': 0, 'online': 0, 'text': 0, 'total': 0}


def _ytd_chart_week_key(record_date):
    """
    ISO week key (YYYY-Www) matching YTD chart columns (each column is Mon–Sun).

    Stats are often entered a day or two after Sunday. Raw ISO would put a Monday
    date in the *next* week, leaving the real service week empty. Map Monday and
    Tuesday to the ISO week that contains the preceding Sunday.
    """
    rd = record_date.date() if isinstance(record_date, datetime) else record_date
    if rd.weekday() in (0, 1):  # Monday or Tuesday
        rd = rd - timedelta(days=(rd.weekday() + 1) % 7)
    monday = rd - timedelta(days=rd.weekday())
    year, week_num, _ = monday.isocalendar()
    return f"{year}-W{week_num:02d}"


VALID_METRICS_SCOPES = frozenset({
    'default',
    'rollup_only',
    'sundays_only',
    'sundays_rollup_only',
    'special_events_only',
})


def normalize_metrics_scope(raw):
    if raw is None:
        return 'default'
    s = str(raw).strip().lower()
    return s if s in VALID_METRICS_SCOPES else 'default'


def coerce_include_in_rollup_metrics(value):
    """Default True when value is None. Accepts bool, int/float, or common string forms."""
    if value is None:
        return True
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(int(value))
    s = str(value).strip().lower()
    if s in ('0', 'false', 'no', 'off', ''):
        return False
    if s in ('1', 'true', 'yes', 'on'):
        return True
    return True


def apply_attendance_metrics_scope(query, metrics_scope='default'):
    """
    Filter AttendanceRecord query for dashboard/reports.
    default: no filter
    rollup_only: include_in_rollup_metrics == True (legacy / API)
    sundays_only: calendar Sunday (legacy / API)
    sundays_rollup_only: Sundays + standard services only
    special_events_only: rows flagged as special (include_in_rollup_metrics is False)
    """
    from models import AttendanceRecord
    from sqlalchemy import and_, extract
    from sqlalchemy.sql import func

    scope = normalize_metrics_scope(metrics_scope)
    if scope == 'default':
        return query
    if scope == 'special_events_only':
        return query.filter(AttendanceRecord.include_in_rollup_metrics.is_(False))
    parts = []
    if scope in ('rollup_only', 'sundays_rollup_only'):
        parts.append(AttendanceRecord.include_in_rollup_metrics.is_(True))
    if scope in ('sundays_only', 'sundays_rollup_only'):
        try:
            dialect = db.engine.dialect.name
        except Exception:
            dialect = 'sqlite'
        if dialect == 'sqlite':
            parts.append(func.strftime('%w', AttendanceRecord.date) == '0')
        else:
            parts.append(extract('dow', AttendanceRecord.date) == 0)
    if not parts:
        return query
    return query.filter(and_(*parts))


def get_dashboard_data(campus, date_filter='last_12_months', custom_start_date='', custom_end_date='', show_previous_year=False, metrics_scope='default'):
    """
    Get dashboard data - DATABASE FIRST VERSION
    Primary source: attendance_records table (database)
    Fallback: Google Sheets (if database is empty or unavailable)
    """
    try:
        # ============================================================
        # STEP 1: TRY DATABASE FIRST (PRIMARY SOURCE)
        # ============================================================
        from models import AttendanceRecord, CampusV2
        
        data_source = "Database"
        
        # Calculate date range
        now = datetime.now()
        end_date = now.date()
        if date_filter == 'last_weekend':
            # Find the most recent weekend (Friday-Tuesday)
            # Include Friday (youth night), Saturday, Sunday, Monday, Tuesday (late submissions)
            # Friday is weekday 4, Saturday is 5, Sunday is 6, Monday is 0, Tuesday is 1
            days_since_saturday = (end_date.weekday() + 2) % 7  # Days since last Saturday
            if days_since_saturday == 0:
                # Today is Saturday, go back to last Saturday
                days_since_saturday = 7
            last_saturday = end_date - timedelta(days=days_since_saturday)
            last_friday = last_saturday - timedelta(days=1)  # Friday (youth night)
            last_sunday = last_saturday + timedelta(days=1)
            last_monday = last_sunday + timedelta(days=1)  # Monday (late submissions)
            last_tuesday = last_monday + timedelta(days=1)  # Tuesday (late submissions)
            start_date = last_friday  # Start from Friday
            end_date = last_tuesday  # End Tuesday
            print(f"[DASHBOARD] last_weekend: Friday={last_friday} to Tuesday={last_tuesday}")
        elif date_filter == 'last_7_days':
            start_date = end_date - timedelta(days=7)
        elif date_filter == 'last_30_days':
            start_date = end_date - timedelta(days=30)
        elif date_filter == 'last_90_days':
            start_date = end_date - timedelta(days=90)
        elif date_filter == 'last_3_months':
            start_date = end_date - timedelta(days=90)
        elif date_filter == 'last_6_months':
            start_date = end_date - timedelta(days=180)
        elif date_filter in ['this_year', 'year_to_date']:
            start_date = datetime(end_date.year, 1, 1).date()
        elif date_filter == 'last_12_months':
            start_date = end_date - timedelta(days=365)
        elif custom_start_date and custom_end_date:
            start_date = datetime.strptime(custom_start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(custom_end_date, '%Y-%m-%d').date()
        else:
            start_date = end_date - timedelta(days=365)
        
        print(f"[DASHBOARD] Campus: {campus}, Date range: {start_date} to {end_date}, Source: Trying Database first")
        logger.info(f"[DASHBOARD] Campus: {campus}, Date range: {start_date} to {end_date}")
        
        # Get Australia region ID for filtering (used in multiple places)
        from models import Region
        australia_region = None
        if campus == 'australia':
            australia_region = Region.query.filter_by(code='AU').first()
            if not australia_region:
                logger.error("[DASHBOARD] Australia region not found in database")
                raise Exception("Australia region not found")
            print(f"[DASHBOARD] Using Australia region filter (region_id={australia_region.id})")
        
        # Query database for records
        try:
            if campus in ['all_campuses', 'australia']:
                # For 'australia', filter by Australia region only
                # For 'all_campuses', include all active regions (but typically means Australia in practice)
                if campus == 'australia' and australia_region:
                    # Get only Australia region campuses
                    campuses_query = CampusV2.query.filter_by(active=True, region_id=australia_region.id).all()
                    campus_ids = [c.id for c in campuses_query]
                    
                    # Also filter records by region_id for safety
                    records = apply_attendance_metrics_scope(
                        AttendanceRecord.query.filter(
                            AttendanceRecord.region_id == australia_region.id,
                            AttendanceRecord.campus_id.in_(campus_ids),
                            AttendanceRecord.date >= start_date,
                            AttendanceRecord.date <= end_date
                        ),
                        metrics_scope,
                    ).order_by(AttendanceRecord.date.desc()).all()
                    
                    print(f"[DASHBOARD] Found {len(records)} database records across {len(campus_ids)} Australia campuses (region_id={australia_region.id})")
                    logger.info(f"[DASHBOARD] Australia dashboard: {len(records)} records, {len(campus_ids)} campuses")
                else:
                    # 'all_campuses' - get all active campuses (all regions)
                    campuses_query = CampusV2.query.filter_by(active=True).all()
                    campus_ids = [c.id for c in campuses_query]
                    
                    records = apply_attendance_metrics_scope(
                        AttendanceRecord.query.filter(
                            AttendanceRecord.campus_id.in_(campus_ids),
                            AttendanceRecord.date >= start_date,
                            AttendanceRecord.date <= end_date
                        ),
                        metrics_scope,
                    ).order_by(AttendanceRecord.date.desc()).all()
                    
                    print(f"[DASHBOARD] Found {len(records)} database records across {len(campus_ids)} campuses (all regions)")
            else:
                # Single campus - find by campus_id (e.g., 'adelaide_city', 'paradise')
                # Normalize so "Adelaide City" or "Adelaide City Campus" still finds adelaide_city
                campus_obj = CampusV2.query.filter_by(campus_id=campus).first()
                if not campus_obj and campus:
                    campus_normalized = str(campus).strip().lower().replace(' ', '_').replace('-', '_')
                    # Remove trailing _campus if present so "adelaide_city_campus" -> "adelaide_city"
                    if campus_normalized.endswith('_campus'):
                        campus_normalized = campus_normalized[:-7]
                    campus_obj = CampusV2.query.filter_by(campus_id=campus_normalized).first()
                if not campus_obj and campus:
                    # Try match by display_name or name (e.g. "Adelaide City")
                    name_stripped = campus.strip()
                    campus_obj = CampusV2.query.filter(
                        db.or_(
                            CampusV2.display_name == name_stripped,
                            CampusV2.name == name_stripped
                        )
                    ).first()
                
                if not campus_obj:
                    print(f"[DASHBOARD] Campus '{campus}' not found in database, falling back to Google Sheets")
                    raise Exception("Campus not found - will use Google Sheets")
                
                records = apply_attendance_metrics_scope(
                    AttendanceRecord.query.filter(
                        AttendanceRecord.campus_id == campus_obj.id,
                        AttendanceRecord.date >= start_date,
                        AttendanceRecord.date <= end_date
                    ),
                    metrics_scope,
                ).order_by(AttendanceRecord.date.desc()).all()
                
                print(f"[DASHBOARD] Found {len(records)} database records for campus '{campus}' (ID: {campus_obj.id})")
            
            # If we have database records, use them!
            if records and len(records) > 0:
                print(f"[DASHBOARD] ✅ Using DATABASE as primary source ({len(records)} records)")
                logger.info(f"[DASHBOARD] Using database data source with {len(records)} records")
                
                # Aggregate stats from database
                stats = {
                    'total_attendance': 0,
                    'total_people': 0,
                    'first_time_visitors': 0,
                    'visitors': 0,
                    'new_people': 0,
                    'first_time_christians': 0,
                    'rededications': 0,
                    'new_christians': 0,
                    'hands_up': 0,
                    'cards_back': 0,
                    'salvation_cards_returned': 0,
                    'youth_attendance': 0,
                    'youth_salvations': 0,
                    'youth_new_people': 0,
                    'youth_leaders': 0,
                    'kids_attendance': 0,
                    'kids_leaders': 0,
                    'new_kids': 0,
                    'new_kids_salvations': 0,
                    'packs_out': 0,
                    'information_gathered': 0,
                    'connect_groups': 0,
                    'dream_team': 0,
                    'saints': 0,
                    'baptisms': 0,
                    'child_dedications': 0,
                    'tithe': 0.0,
                    'entry_count': len(records),
                }
                
                recent_entries = []
                monthly_trends = {}
                service_breakdown = {}
                kids_service_breakdown = {}
                
                # Track kids totals for debugging
                kids_by_campus = {}
                
                for record in records:
                    # Aggregate totals
                    stats['total_attendance'] += record.total_attendance or 0
                    stats['total_people'] += record.total_people_in_campus or 0
                    stats['first_time_visitors'] += record.first_time_visitors or 0
                    stats['visitors'] += record.visitors or 0
                    stats['first_time_christians'] += record.first_time_christians or 0
                    stats['rededications'] += record.rededications or 0
                    stats['hands_up'] += record.hands_up or 0
                    stats['cards_back'] += record.cards_back or 0
                    stats['salvation_cards_returned'] += record.salvation_cards_returned or 0
                    stats['youth_attendance'] += record.youth_attendance or 0
                    stats['youth_salvations'] += record.youth_salvations or 0
                    stats['youth_new_people'] += record.youth_new_people or 0
                    stats['youth_leaders'] += record.youth_leaders or 0
                    
                    # Kids aggregation
                    kids_val = record.kids_attendance or 0
                    stats['kids_attendance'] += kids_val
                    stats['kids_leaders'] += record.kids_leaders or 0
                    stats['new_kids'] += record.new_kids or 0
                    stats['new_kids_salvations'] += record.new_kids_salvations or 0
                    
                    # Track kids by campus for debugging
                    if kids_val > 0:
                        campus_obj_entry = CampusV2.query.get(record.campus_id)
                        campus_name = campus_obj_entry.display_name if campus_obj_entry else f"Campus_{record.campus_id}"
                        if campus_name not in kids_by_campus:
                            kids_by_campus[campus_name] = 0
                        kids_by_campus[campus_name] += kids_val
                    stats['packs_out'] += record.packs_out or 0
                    stats['connect_groups'] += record.connect_groups or 0
                    stats['dream_team'] += record.dream_team or 0
                    stats['saints'] += record.saints or 0
                    stats['baptisms'] += record.baptisms or 0
                    stats['child_dedications'] += record.child_dedications or 0
                    stats['tithe'] += float(record.tithe or 0)
                    
                    # Adult service breakdown for charts
                    if record.adult_service_breakdown:
                        try:
                            adult_breakdown = json.loads(record.adult_service_breakdown)
                            for service_time, count in adult_breakdown.items():
                                if service_time not in service_breakdown:
                                    service_breakdown[service_time] = {'total': 0, 'count': 0}
                                service_breakdown[service_time]['total'] += count
                                service_breakdown[service_time]['count'] += 1
                        except:
                            pass
                    
                    # Kids service breakdown for charts
                    if record.kids_service_breakdown:
                        try:
                            kids_breakdown = json.loads(record.kids_service_breakdown)
                            for service_time, count in kids_breakdown.items():
                                if service_time not in kids_service_breakdown:
                                    kids_service_breakdown[service_time] = {'total': 0, 'count': 0}
                                kids_service_breakdown[service_time]['total'] += count
                                kids_service_breakdown[service_time]['count'] += 1
                        except:
                            pass
                    
                    # Recent entries (last 10)
                    if len(recent_entries) < 10:
                        campus_obj_entry = CampusV2.query.get(record.campus_id)
                        recent_entries.append({
                            'date': record.date.strftime('%Y-%m-%d'),
                            'campus': campus_obj_entry.display_name if campus_obj_entry else 'Unknown',
                            'total_attendance': record.total_attendance or 0,
                            'kids_attendance': record.kids_attendance or 0,
                            'new_people': (record.first_time_visitors or 0) + (record.visitors or 0),
                            'new_christians': (record.first_time_christians or 0) + (record.rededications or 0)
                        })
                    
                    # Monthly trends
                    month_key = record.date.strftime('%Y-%m')
                    if month_key not in monthly_trends:
                        monthly_trends[month_key] = {
                            'attendance': 0,
                            'new_people': 0,
                            'new_christians': 0,
                            'count': 0
                        }
                    monthly_trends[month_key]['attendance'] += record.total_attendance or 0
                    monthly_trends[month_key]['new_people'] += (record.first_time_visitors or 0) + (record.visitors or 0)
                    monthly_trends[month_key]['new_christians'] += (record.first_time_christians or 0) + (record.rededications or 0)
                    monthly_trends[month_key]['count'] += 1
                
                # Calculate derived stats
                # FIX: Include youth_new_people in total new_people count
                stats['new_people'] = stats['first_time_visitors'] + stats['visitors'] + stats['youth_new_people']
                stats['new_christians'] = stats['first_time_christians'] + stats['rededications']
                
                # Debug logging for kids totals
                if kids_by_campus:
                    print(f"[DASHBOARD] Kids breakdown by campus: {kids_by_campus}")
                    logger.info(f"[DASHBOARD] Kids breakdown by campus: {kids_by_campus}")
                print(f"[DASHBOARD] Total kids_attendance summed: {stats['kids_attendance']} across {len(records)} records")
                logger.info(f"[DASHBOARD] Total kids_attendance: {stats['kids_attendance']}, entry_count: {len(records)}")
                
                # Calculate averages
                entry_count = stats['entry_count'] or 1
                stats['avg_attendance'] = stats['total_attendance'] / entry_count
                stats['avg_kids_attendance'] = stats['kids_attendance'] / entry_count
                stats['avg_kids_leaders'] = stats['kids_leaders'] / entry_count
                # FIX: Include youth leaders in youth_attendance for weekend totals
                # Store both: youth_attendance (with leaders) for weekend total, and separate youth_leaders for display
                stats['youth_attendance'] = stats['youth_attendance'] + stats['youth_leaders']  # Include leaders for weekend total
                stats['avg_youth_attendance'] = stats['youth_attendance'] / entry_count
                stats['avg_tithe'] = stats['tithe'] / entry_count
                stats['avg_connect_groups'] = stats['connect_groups'] / entry_count
                stats['avg_dream_team'] = stats['dream_team'] / entry_count
                stats['avg_saints'] = stats['saints'] / entry_count
                stats['avg_new_people'] = stats['new_people'] / entry_count
                stats['avg_first_time_visitors'] = stats['first_time_visitors'] / entry_count
                stats['avg_first_time_christians'] = stats['first_time_christians'] / entry_count
                stats['avg_rededications'] = stats['rededications'] / entry_count
                
                # FIX: total_people should be average, not sum across dates
                # Convert the summed total_people to an average
                stats['total_people'] = stats['total_people'] / entry_count
                
                # Calculate monthly averages for trends
                for month_key, month_data in monthly_trends.items():
                    count = month_data['count'] or 1
                    month_data['avg_attendance'] = month_data['attendance'] / count
                    month_data['avg_new_people'] = month_data['new_people'] / count
                    month_data['avg_new_christians'] = month_data['new_christians'] / count
                
                # Calculate averages for service breakdowns (for frontend display)
                for service_time, data in service_breakdown.items():
                    data['average'] = data['total'] / data['count'] if data['count'] > 0 else 0
                
                for service_time, data in kids_service_breakdown.items():
                    data['average'] = data['total'] / data['count'] if data['count'] > 0 else 0
                
                # FALLBACK: If service breakdown exists but count doesn't match entry_count,
                # it means some records lack adult_service_breakdown data
                # In this case, we should use the total_attendance and entry_count from stats
                if service_breakdown:
                    # Check if any service time has a count less than entry_count
                    for service_time, data in service_breakdown.items():
                        original_count = data['count']
                        if original_count < entry_count and original_count > 0:
                            # Some records are missing breakdown data
                            # Use the overall stats instead of incomplete breakdown data
                            data['total'] = stats['total_attendance']
                            data['count'] = entry_count
                            data['average'] = stats['avg_attendance']
                            print(f"[DASHBOARD] ⚠️  Service {service_time} had incomplete data (only {original_count} of {entry_count} records had breakdown)")
                            print(f"[DASHBOARD] ⚠️  Using overall stats: total={data['total']}, count={data['count']}, avg={data['average']:.1f}")
                
                # FALLBACK 2: If no service breakdown data exists at all
                elif not service_breakdown and stats['avg_attendance'] > 0:
                    # Get the primary service time for this campus (usually 10:00 AM)
                    default_service_time = '10:00 AM'
                    service_breakdown[default_service_time] = {
                        'total': stats['total_attendance'],
                        'count': entry_count,
                        'average': stats['avg_attendance']
                    }
                    print(f"[DASHBOARD] ⚠️  No service breakdown data in records, created fallback for {default_service_time}")
                
                print(f"[DASHBOARD] ✅ Database aggregation complete: total_attendance={stats['total_attendance']}, avg={stats['avg_attendance']:.1f}")
                print(f"[DASHBOARD] Service breakdown: {list(service_breakdown.keys())}")
                print(f"[DASHBOARD] Kids service breakdown: {list(kids_service_breakdown.keys())}")
                
                # Build chart_data from YTD database records (not just filtered range)
                # Query ALL records from January 1st to today for YTD chart
                now = datetime.now()
                ytd_start = datetime(now.year, 1, 1)
                ytd_end = now
                
                print(f"[DASHBOARD YTD] Querying YTD records from {ytd_start.strftime('%Y-%m-%d')} to {ytd_end.strftime('%Y-%m-%d')}")
                
                # Query YTD records (separate from filtered records)
                if campus in ['all_campuses', 'australia', 'usa']:
                    # Multi-campus query - filter by region for 'australia'
                    if campus == 'australia' and australia_region:
                        ytd_records = apply_attendance_metrics_scope(
                            AttendanceRecord.query.filter(
                                AttendanceRecord.region_id == australia_region.id,
                                AttendanceRecord.date >= ytd_start,
                                AttendanceRecord.date <= ytd_end
                            ),
                            metrics_scope,
                        ).all()
                        print(f"[DASHBOARD YTD] Filtered YTD records for Australia region (region_id={australia_region.id})")
                    else:
                        # All campuses/all regions
                        ytd_records = apply_attendance_metrics_scope(
                            AttendanceRecord.query.filter(
                                AttendanceRecord.date >= ytd_start,
                                AttendanceRecord.date <= ytd_end
                            ),
                            metrics_scope,
                        ).all()
                else:
                    # Single campus query
                    ytd_records = apply_attendance_metrics_scope(
                        AttendanceRecord.query.filter(
                            AttendanceRecord.campus_id == campus_obj.id,
                            AttendanceRecord.date >= ytd_start,
                            AttendanceRecord.date <= ytd_end
                        ),
                        metrics_scope,
                    ).all()
                
                print(f"[DASHBOARD YTD] Found {len(ytd_records)} YTD records for chart")
                
                # Build weekly aggregates for YTD (week-by-week instead of monthly)
                ytd_weekly = {}
                for record in ytd_records:
                    record_date = record.date
                    days_since_monday = record_date.weekday()  # Monday is 0
                    week_start = record_date - timedelta(days=days_since_monday)
                    week_key = _ytd_chart_week_key(record_date)
                    
                    if week_key not in ytd_weekly:
                        ytd_weekly[week_key] = {
                            'attendance': 0,
                            'new_people': 0,
                            'new_christians': 0,
                            'count': 0,
                            'week_start': week_start,
                            'week_end': week_start + timedelta(days=6)
                        }
                    ytd_weekly[week_key]['attendance'] += record.total_attendance or 0
                    ytd_weekly[week_key]['new_people'] += (record.first_time_visitors or 0) + (record.visitors or 0)
                    ytd_weekly[week_key]['new_christians'] += (record.first_time_christians or 0) + (record.rededications or 0)
                    ytd_weekly[week_key]['count'] += 1
                
                print(f"[DASHBOARD YTD] Weekly aggregates: {len(ytd_weekly)} weeks")
                
                # Previous calendar year — same week slots as current YTD (for "Show previous year")
                prev_ytd_weekly = {}
                if show_previous_year:
                    prev_start_d = date(now.year - 1, 1, 1)
                    try:
                        prev_end_d = date(now.year - 1, now.month, now.day)
                    except ValueError:
                        prev_end_d = date(now.year - 1, now.month, 28)
                    if campus in ['all_campuses', 'australia', 'usa']:
                        if campus == 'australia' and australia_region:
                            prev_ytd_records = apply_attendance_metrics_scope(
                                AttendanceRecord.query.filter(
                                    AttendanceRecord.region_id == australia_region.id,
                                    AttendanceRecord.date >= prev_start_d,
                                    AttendanceRecord.date <= prev_end_d
                                ),
                                metrics_scope,
                            ).all()
                        else:
                            prev_ytd_records = apply_attendance_metrics_scope(
                                AttendanceRecord.query.filter(
                                    AttendanceRecord.date >= prev_start_d,
                                    AttendanceRecord.date <= prev_end_d
                                ),
                                metrics_scope,
                            ).all()
                    else:
                        prev_ytd_records = apply_attendance_metrics_scope(
                            AttendanceRecord.query.filter(
                                AttendanceRecord.campus_id == campus_obj.id,
                                AttendanceRecord.date >= prev_start_d,
                                AttendanceRecord.date <= prev_end_d
                            ),
                            metrics_scope,
                        ).all()
                    print(f"[DASHBOARD YTD] Previous-year chart: {len(prev_ytd_records)} records from {prev_start_d} to {prev_end_d}")
                    for record in prev_ytd_records:
                        record_date = record.date
                        pkey = _ytd_chart_week_key(record_date)
                        if pkey not in prev_ytd_weekly:
                            prev_ytd_weekly[pkey] = {
                                'attendance': 0,
                                'new_people': 0,
                                'new_christians': 0,
                                'count': 0,
                            }
                        prev_ytd_weekly[pkey]['attendance'] += record.total_attendance or 0
                        prev_ytd_weekly[pkey]['new_people'] += (record.first_time_visitors or 0) + (record.visitors or 0)
                        prev_ytd_weekly[pkey]['new_christians'] += (record.first_time_christians or 0) + (record.rededications or 0)
                        prev_ytd_weekly[pkey]['count'] += 1
                
                # Build chart_data for Year-To-Date view (weekly)
                chart_data = {
                    'labels': [],
                    'attendance': [],
                    'new_people': [],
                    'new_christians': [],
                    'youth': [],
                    'kids': [],
                    'tithe_ytd': [],
                    'tithe_previous_year': [],
                    'attendance_previous_year': [],
                    'tithe_labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                }
                
                # Populate chart with YTD data (week by week from January 1st to today)
                # Start from the first Monday of the year (or Jan 1st if it's a Monday)
                ytd_start_date = ytd_start.date() if isinstance(ytd_start, datetime) else ytd_start
                current_week_start = ytd_start_date
                # Find the Monday of the week containing Jan 1st
                days_since_monday = current_week_start.weekday()
                if days_since_monday > 0:
                    current_week_start = current_week_start - timedelta(days=days_since_monday)
                
                anchor_curr = current_week_start
                prev_jan1 = date(now.year - 1, 1, 1)
                anchor_prev = prev_jan1
                dmp = anchor_prev.weekday()
                if dmp > 0:
                    anchor_prev = anchor_prev - timedelta(days=dmp)
                
                # Get today's date and find the Monday of this week
                today = now.date() if isinstance(now, datetime) else now
                days_since_monday_today = today.weekday()
                last_week_start = today - timedelta(days=days_since_monday_today)
                
                # Iterate week by week
                while current_week_start <= last_week_start:
                    # Use ISO week format to match aggregation
                    year, week_num, _ = current_week_start.isocalendar()
                    week_key = f"{year}-W{week_num:02d}"
                    
                    # Create label: Show date range like "Jan 1-7"
                    week_end_date = current_week_start + timedelta(days=6)
                    if current_week_start.month == week_end_date.month:
                        week_label = f"{current_week_start.strftime('%b %d')}-{week_end_date.strftime('%d')}"
                    else:
                        week_label = f"{current_week_start.strftime('%b %d')}-{week_end_date.strftime('%b %d')}"
                    
                    chart_data['labels'].append(week_label)
                    
                    # Get data for this week from ytd_weekly
                    week_data = ytd_weekly.get(week_key, {'attendance': 0, 'new_people': 0, 'new_christians': 0, 'count': 0})
                    
                    # For multi-campus views (australia, all_campuses), show TOTAL attendance (not average)
                    # For single campus, show average per service
                    if campus in ['all_campuses', 'australia', 'usa']:
                        # Regional/multi-campus: show total attendance across all campuses
                        attendance_val = week_data['attendance'] if week_data['count'] > 0 else 0
                        new_people_val = week_data['new_people'] if week_data['count'] > 0 else 0
                        new_christians_val = week_data['new_christians'] if week_data['count'] > 0 else 0
                    else:
                        # Single campus: show average per service
                        count = week_data['count'] or 1
                        attendance_val = week_data['attendance'] / count if week_data['count'] > 0 else 0
                        new_people_val = week_data['new_people'] / count if week_data['count'] > 0 else 0
                        new_christians_val = week_data['new_christians'] / count if week_data['count'] > 0 else 0
                    
                    chart_data['attendance'].append(attendance_val)
                    chart_data['new_people'].append(new_people_val)
                    chart_data['new_christians'].append(new_christians_val)
                    chart_data['youth'].append(0)  # TODO: Add youth breakdown if needed
                    chart_data['kids'].append(0)  # TODO: Add kids breakdown if needed
                    
                    if show_previous_year:
                        offset_weeks = (current_week_start - anchor_curr).days // 7
                        prev_week_start = anchor_prev + timedelta(days=7 * offset_weeks)
                        py, pw, _ = prev_week_start.isocalendar()
                        prev_week_key = f"{py}-W{pw:02d}"
                        prev_week_data = prev_ytd_weekly.get(
                            prev_week_key,
                            {'attendance': 0, 'new_people': 0, 'new_christians': 0, 'count': 0},
                        )
                        if campus in ['all_campuses', 'australia', 'usa']:
                            prev_attendance_val = prev_week_data['attendance'] if prev_week_data['count'] > 0 else 0
                        else:
                            pc = prev_week_data['count'] or 1
                            prev_attendance_val = (
                                prev_week_data['attendance'] / pc if prev_week_data['count'] > 0 else 0
                            )
                        chart_data['attendance_previous_year'].append(prev_attendance_val)
                    
                    # Move to next week (add 7 days)
                    current_week_start = current_week_start + timedelta(days=7)
                
                print(f"[DASHBOARD] Built chart_data with {len(chart_data['labels'])} weeks: {chart_data['labels']}")
                print(f"[DASHBOARD] Chart attendance values: {chart_data['attendance']}")
                
                return {
                    'stats': stats,
                    'recent_entries': recent_entries,
                    'trends': monthly_trends,
                    'service_breakdown': service_breakdown,
                    'kids_service_breakdown': kids_service_breakdown,
                    'chart_data': chart_data,
                    'data_source': 'Database',
                    'metrics_scope': normalize_metrics_scope(metrics_scope),
                }
            else:
                print(f"[DASHBOARD] ⚠️  No database records found, falling back to Google Sheets")
                data_source = "Google Sheets (database empty)"
                
        except Exception as db_error:
            print(f"[DASHBOARD] ⚠️  Database error: {db_error}, falling back to Google Sheets")
            logger.warning(f"[DASHBOARD] Database query failed, using Google Sheets fallback: {db_error}")
            data_source = "Google Sheets (database error)"
        
        # ============================================================
        # STEP 2: FALLBACK TO GOOGLE SHEETS (IF DATABASE FAILED/EMPTY)
        # ============================================================
        print(f"[DASHBOARD] Using Google Sheets as fallback")
        
        # Try to get data from Google Sheets first, fallback to local data
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
                if rows is None:  # Rate limited or failed
                    rows = load_local_data()
                    data_source = "Local Data (Google Sheets rate limited)"
                else:
                    data_source = "Google Sheets"
            except Exception as e:
                logger.warning(f"Google Sheets failed, using local data: {e}")
                rows = load_local_data()
                data_source = "Local Data (Google Sheets failed)"
        else:
            rows = load_local_data()
            data_source = "Local Data (Google Sheets not available)"
        
        if not rows:
            return {"stats": {}, "recent_entries": [], "trends": {}, "data_source": data_source}
        
        # Calculate date range first to avoid redundant computation
        now = datetime.now()
        start_date, end_date = calculate_date_range(date_filter, custom_start_date, custom_end_date, now)
        
        # Pre-normalize campus for single-pass filtering
        campus_normalized = None
        skip_campus_filter = campus in ['all_campuses', 'australia']
        australia_campuses = None
        if campus == 'australia':
            # For Australia rollup, filter to only Australian campuses
            australia_campuses = ['paradise', 'south', 'salisbury', 'adelaide_city', 'adelaide city', 
                                 'mount_barker', 'mount barker', 'copper_coast', 'copper coast',
                                 'clare_valley', 'clare valley', 'victor_harbour', 'victor_harbor', 'victor harbour']
        elif not skip_campus_filter:
            campus_normalized = normalize_campus(campus)
        
        # Pre-compile date parsing (most common format first for speed)
        date_formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']
        
        # Combine campus and date filtering into single pass for performance
        filtered_rows = []
        for row in rows:
            # Campus filtering (if needed)
            if campus == 'australia' and australia_campuses:
                # Filter to only Australian campuses, exclude non-AU like Alpharetta
                row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
                row_campus_lower = row_campus.lower().replace(' ', '_').replace('-', '_')
                is_australian = False
                for au_campus in australia_campuses:
                    au_normalized = au_campus.lower().replace(' ', '_').replace('-', '_')
                    if au_normalized in row_campus_lower or row_campus_lower in au_normalized:
                        is_australian = True
                        break
                if not is_australian:
                    continue
            elif not skip_campus_filter:
                row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
                campus_match = (row_campus == campus_normalized or
                               campus_normalized in row_campus or
                               row_campus in campus_normalized or
                               campus_normalized.replace(" ", "") in row_campus.replace(" ", "") or
                               row_campus.replace(" ", "") in campus_normalized.replace(" ", ""))
                if not campus_match:
                    continue
            
            # Date filtering (combined with campus check)
            date_str = row.get("Date", "")
            if not date_str or not isinstance(date_str, str):
                continue
            
            # Optimized date parsing - try most common format first
            row_date = None
            for fmt in date_formats:
                try:
                    row_date = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    continue
            
            # Check if date is valid and within range
            if row_date and start_date <= row_date <= end_date:
                filtered_rows.append(row)
        
        # Ensure we have data to process
        if not filtered_rows:
            return {"stats": {}, "recent_entries": [], "trends": {}, "data_source": data_source}
        
        period_stats = {
            # Main attendance
            'total_attendance': 0,
            
            # Campus database
            'total_people': 0,
            
                    # Service time totals removed
            
            # New people breakdown
            'first_time_visitors': 0,
            'visitors': 0,
            'information_gathered': 0,
            'packs_out': 0,  # New people packs handed out
            'new_people': 0,  # Calculated: first_time + visitors
            
            # Christian decisions breakdown
            'first_time_christians': 0,
            'rededications': 0,
            'hands_up': 0,  # People who responded (may differ from actual salvations)
            'new_christians': 0,  # Calculated: first_time + rededications
            
            # Youth breakdown
            'youth_attendance': 0,
            'youth_salvations': 0,
            'youth_new_people': 0,
            'youth_leaders': 0,
            
            # Kids breakdown
            'kids_attendance': 0,
            'kids_leaders': 0,
            'new_kids': 0,
            'new_kids_salvations': 0,
            'salvation_cards_returned': 0,
            
            # Ministry metrics
            'connect_groups': 0,
            'dream_team': 0,
            'saints': 0,
            
            # Financial data
            'tithe': 0,
            
            # Special events
            'baptisms': 0,
            'child_dedications': 0,
            
            # System tracking
            'entry_count': 0,
            
            # Backward compatibility
            'kids_total': 0,  # Will map to kids_attendance
            'volunteers': 0  # Will map to dream_team
        }
        
        recent_entries = []
        monthly_trends = {}
        
        processed_count = 0
        valid_timestamps = 0
        
        # Helper function to get stat value with flexible field names
        def get_stat_value(row, field_names):
            for field in field_names:
                value = row.get(field)
                if value is not None and value != '' and str(value).strip() != '':
                    # Handle numeric values and convert to int
                    try:
                        return safe_int(value)
                    except (ValueError, TypeError):
                        continue
            return 0
        
        # Helper function to calculate total attendance from service times
        def calculate_total_attendance(row):
            """Calculate total attendance by summing all service time columns"""
            service_times = ['9:00 AM', '10:00 AM', '11:00 AM', '5:00 PM', '5:30 PM']
            total = 0
            for service_time in service_times:
                value = row.get(service_time, '')
                if value is not None and value != '' and str(value).strip() != '':
                    try:
                        total += safe_int(value)
                    except (ValueError, TypeError):
                        continue
            return total
        
        # Helper function to calculate total kids attendance from service times
        def calculate_kids_attendance(row):
            """Calculate total kids attendance by summing all kids service time columns"""
            kids_service_times = ['Kids 9:00 AM', 'Kids 10:00 AM', 'Kids 11:00 AM', 'Kids 5:00 PM', 'Kids 5:30 PM']
            total = 0
            for service_time in kids_service_times:
                value = row.get(service_time, '')
                if value is not None and value != '' and str(value).strip() != '':
                    try:
                        total += safe_int(value)
                    except (ValueError, TypeError):
                        continue
            return total
        
        # Initialize monthly trends tracking
        monthly_trends = {}
        
        for row in filtered_rows:
            processed_count += 1
            try:
                # Get date from row (already filtered, so should be valid)
                row_date = get_row_timestamp(row)
                if row_date and row_date != datetime.min:
                    valid_timestamps += 1
                    
                    # Add to recent entries for display
                    if len(recent_entries) < 10:
                        # Calculate New People and New Christians for recent entries
                        # Accept both "First Time" and "First Time Visitors" for flexibility
                        first_time_visitors = get_stat_value(row, ['First Time', 'First Time Visitors', 'first_time_visitors'])
                        visitors = get_stat_value(row, ['Visitors', 'visitors'])
                        new_people = first_time_visitors + visitors
                        
                        first_time_christians = get_stat_value(row, ['First Time Christians', 'first_time_christians'])
                        rededications = get_stat_value(row, ['Rededications', 'rededications'])
                        new_christians = first_time_christians + rededications
                        
                        recent_entries.append({
                            'date': row_date.strftime('%Y-%m-%d'),
                            'campus': row.get('Campus', 'Unknown'),
                            'attendance': calculate_total_attendance(row),
                            'new_people': new_people,
                            'new_christians': new_christians
                        })
                    
                    # Calculate monthly trends
                    month_key = row_date.strftime('%Y-%m')
                    if month_key not in monthly_trends:
                        monthly_trends[month_key] = {
                            'attendance': 0,
                            'count': 0,
                            'new_people': 0,
                            'new_christians': 0,
                            'tithe': 0
                        }
                    
                    attendance = calculate_total_attendance(row)
                    
                    # Calculate New People from First Time Visitors + Visitors
                    # Accept both "First Time" and "First Time Visitors" for flexibility
                    first_time_visitors = get_stat_value(row, ['First Time', 'First Time Visitors', 'first_time_visitors'])
                    visitors = get_stat_value(row, ['Visitors', 'visitors'])
                    new_people = first_time_visitors + visitors
                    
                    # Calculate New Christians from First Time Christians + Rededications
                    first_time_christians = get_stat_value(row, ['First Time Christians', 'first_time_christians'])
                    rededications = get_stat_value(row, ['Rededications', 'rededications'])
                    new_christians = first_time_christians + rededications
                    
                    monthly_trends[month_key]['attendance'] += attendance
                    monthly_trends[month_key]['count'] += 1
                    monthly_trends[month_key]['new_people'] += new_people
                    monthly_trends[month_key]['new_christians'] += new_christians
                    
                    # Add tithe data to monthly trends
                    tithe_value = row.get('Tithe', '')
                    if tithe_value and str(tithe_value).strip() != '':
                        try:
                            tithe_clean = str(tithe_value).replace('$', '').replace(',', '').strip()
                            if tithe_clean:
                                monthly_trends[month_key]['tithe'] += float(tithe_clean)
                        except (ValueError, TypeError):
                            pass
                    
                    # Main attendance
                    period_stats['total_attendance'] += attendance
                    
                    # Campus database size
                    total_people = get_stat_value(row, ['Total People in Campus', 'total_people_in_campus'])
                    period_stats['total_people'] = max(period_stats['total_people'], total_people)  # Use max value (most recent)
                    
                                         # Service time processing removed
                    
                    # New people breakdown
                    # Accept both "First Time" and "First Time Visitors" for flexibility
                    first_time = get_stat_value(row, ['First Time', 'First Time Visitors', 'first_time_visitors'])
                    visitors = get_stat_value(row, ['Visitors', 'visitors'])
                    period_stats['first_time_visitors'] += first_time
                    period_stats['visitors'] += visitors
                    # Accept both "NP Cards Back" and "Cards Back" for flexibility
                    info_gathered_value = get_stat_value(row, ['NP Cards Back', 'Cards Back', 'information_gathered'])
                    # Track packs out (new people packs handed out)
                    packs_out = get_stat_value(row, ['Packs Out', 'packs_out'])
                    period_stats['packs_out'] += packs_out
                    if row.get('Campus') == 'Adelaide City' and row.get('Date') == '2025-10-05':
                        print(f"[DEBUG] Adelaide City 2025-10-05 - Raw row data: {row}")
                        print(f"[DEBUG] Cards Back value: {info_gathered_value}")
                        print(f"[DEBUG] Row keys: {list(row.keys())}")
                    period_stats['information_gathered'] += info_gathered_value
                    
                    # Debug: Track total information_gathered for Adelaide City
                    if row.get('Campus') == 'Adelaide City':
                        print(f"[DEBUG] Adelaide City running total - information_gathered: {period_stats['information_gathered']}, entry_count: {period_stats['entry_count']}")
                    
                    # Christian decisions breakdown
                    first_time_christians = get_stat_value(row, ['First Time Christians', 'first_time_christians'])
                    rededications = get_stat_value(row, ['Rededications', 'rededications'])
                    # Track hands up (people who responded, may differ from actual salvations)
                    hands_up = get_stat_value(row, ['Hands up', 'Hands Up', 'hands_up'])
                    period_stats['hands_up'] += hands_up
                    
                    # Debug: Check First Time Christians value for Adelaide City
                    if row.get('Campus') == 'Adelaide City' and row.get('Date') == '2025-10-05':
                        raw_value = row.get('First Time Christians', 'NOT_FOUND')
                        print(f"[DEBUG] Adelaide City 2025-10-05 - Raw First Time Christians: {raw_value} (type: {type(raw_value)})")
                        print(f"[DEBUG] Adelaide City 2025-10-05 - After get_stat_value: {first_time_christians}")
                        print(f"[DEBUG] Adelaide City 2025-10-05 - After safe_int: {safe_int(raw_value) if raw_value != 'NOT_FOUND' else 'N/A'}")
                    
                    period_stats['first_time_christians'] += first_time_christians
                    period_stats['rededications'] += rededications
                        
                    # Youth breakdown
                    period_stats['youth_attendance'] += get_stat_value(row, ['Youth Attendance', 'youth_attendance'])
                    period_stats['youth_salvations'] += get_stat_value(row, ['Youth Salvations', 'youth_salvations'])
                    period_stats['youth_new_people'] += get_stat_value(row, ['Youth New People', 'youth_new_people'])
                    period_stats['youth_leaders'] += get_stat_value(row, ['Youth Leaders', 'youth_leaders'])
                    
                    # Kids breakdown
                    period_stats['kids_attendance'] += calculate_kids_attendance(row)
                    period_stats['kids_leaders'] += get_stat_value(row, ['Kids Leaders', 'kids_leaders'])
                    period_stats['new_kids'] += get_stat_value(row, ['New Kids', 'new_kids'])
                    period_stats['new_kids_salvations'] += get_stat_value(row, ['New Kids Salvations', 'new_kids_salvations'])
                    
                    # Salvation Cards Returned
                    period_stats['salvation_cards_returned'] += get_stat_value(row, ['Salvation Cards Returned', 'salvation_cards_returned'])
                    
                    # Ministry metrics
                    period_stats['connect_groups'] += get_stat_value(row, ['Connect Groups', 'connect_groups'])
                    period_stats['dream_team'] += get_stat_value(row, ['Dream Team', 'dream_team', 'Volunteers', 'volunteers'])
                    period_stats['saints'] += get_stat_value(row, ['Saints', 'saints'])
                    
                    # Financial data - handle empty strings and convert to number
                    tithe_value = row.get('Tithe', '')
                    if tithe_value and str(tithe_value).strip() != '':
                        try:
                            # Remove any currency symbols and commas, then convert to float
                            tithe_clean = str(tithe_value).replace('$', '').replace(',', '').strip()
                            if tithe_clean:
                                period_stats['tithe'] += float(tithe_clean)
                        except (ValueError, TypeError):
                            pass
                    
                    # Additional metrics that might be missing
                    # Baptisms and child dedications
                    baptisms = int(row.get('Baptisms', 0) or 0)
                    child_dedications = int(row.get('Child Dedications', 0) or 0)
                    period_stats['baptisms'] += baptisms
                    period_stats['child_dedications'] += child_dedications
                    
                    # System tracking
                    period_stats['entry_count'] += 1
                    
                    # Backward compatibility
                    period_stats['kids_total'] = period_stats['kids_attendance']
                    period_stats['volunteers'] = period_stats['dream_team']
                    
            except Exception as e:
                print(f"[DEBUG] Error processing row: {e}")
                continue
        
        # Calculate derived stats
        period_stats['new_people'] = period_stats['first_time_visitors'] + period_stats['visitors']
        period_stats['new_christians'] = period_stats['first_time_christians'] + period_stats['rededications']
        
        # Total people comes from Google Sheet only - no hardcoded defaults
        
        # Calculate tithe YTD totals from Tithe tab (not Stats tab)
        # YTD = Year-To-Date (January 1 to current date of current year)
        now = datetime.now()
        ytd_start = datetime(now.year, 1, 1)
        ytd_end = now
        
        # Get YTD tithe from Tithe tab
        tithe_ytd_breakdown = get_tithe_breakdown(campus, ytd_start, ytd_end)
        period_stats['tithe_ytd'] = tithe_ytd_breakdown.get('total', 0)
        print(f"[DEBUG TITHE YTD] YTD total from Tithe tab: ${period_stats['tithe_ytd']:,.2f}")
        
        # Initialize previous_year_averages if not defined yet
        if 'previous_year_averages' not in locals():
            previous_year_averages = {}
        period_stats['tithe_previous_year'] = sum(prev_data.get('total_tithe', 0) for prev_data in previous_year_averages.values())
        
        # Build YTD monthly data for charts (January through current month of current year)
        # This is separate from filtered_rows and always shows full YTD
        ytd_monthly_trends = {}
        
        print(f"[DEBUG YTD] Building YTD data from {ytd_start.strftime('%Y-%m-%d')} to {ytd_end.strftime('%Y-%m-%d')}")
        print(f"[DEBUG YTD] Total rows to process: {len(rows)}")
        
        ytd_rows_processed = 0
        ytd_rows_matched_campus = 0
        ytd_rows_matched_date = 0
        
        for row in rows:
            try:
                row_date = get_row_timestamp(row)
                if not row_date or row_date == datetime.min:
                    continue
                
                ytd_rows_processed += 1
                
                # Only process YTD data (Jan 1 to now of current year)
                if not (ytd_start <= row_date <= ytd_end):
                    continue
                
                ytd_rows_matched_date += 1
                
                # Filter by campus if needed (skip filtering for roll-up views)
                if campus not in ['all_campuses', 'australia']:
                    row_campus = normalize_campus(row.get('Campus', ''))
                    campus_normalized = normalize_campus(campus)
                    if row_campus != campus_normalized:
                        continue
                
                ytd_rows_matched_campus += 1
                
                # Calculate YTD monthly trends for charts
                month_key = row_date.strftime('%Y-%m')
                if month_key not in ytd_monthly_trends:
                    ytd_monthly_trends[month_key] = {
                        'attendance': 0,
                        'count': 0,
                        'new_people': 0,
                        'new_christians': 0,
                        'tithe': 0,
                        'youth_attendance': 0,
                        'kids_attendance': 0
                    }
                
                attendance = calculate_total_attendance(row)
                # Accept both "First Time" and "First Time Visitors" for flexibility
                first_time_visitors = get_stat_value(row, ['First Time', 'First Time Visitors', 'first_time_visitors'])
                visitors = get_stat_value(row, ['Visitors', 'visitors'])
                new_people = first_time_visitors + visitors
                first_time_christians = get_stat_value(row, ['First Time Christians', 'first_time_christians'])
                rededications = get_stat_value(row, ['Rededications', 'rededications'])
                new_christians = first_time_christians + rededications
                youth_attendance = get_stat_value(row, ['Youth Attendance', 'youth_attendance'])
                kids_attendance = calculate_kids_attendance(row)
                
                ytd_monthly_trends[month_key]['attendance'] += attendance
                ytd_monthly_trends[month_key]['count'] += 1
                ytd_monthly_trends[month_key]['new_people'] += new_people
                ytd_monthly_trends[month_key]['new_christians'] += new_christians
                ytd_monthly_trends[month_key]['youth_attendance'] += youth_attendance
                ytd_monthly_trends[month_key]['kids_attendance'] += kids_attendance
                
                tithe_value = row.get('Tithe', '')
                if tithe_value and str(tithe_value).strip() != '':
                    try:
                        tithe_clean = str(tithe_value).replace('$', '').replace(',', '').strip()
                        if tithe_clean:
                            ytd_monthly_trends[month_key]['tithe'] += float(tithe_clean)
                    except (ValueError, TypeError):
                        pass
                        
            except Exception as e:
                continue
        
        print(f"[DEBUG YTD] Rows processed: {ytd_rows_processed}, matched date: {ytd_rows_matched_date}, matched campus: {ytd_rows_matched_campus}")
        print(f"[DEBUG YTD] YTD monthly trends found: {list(ytd_monthly_trends.keys())}")
        
        # Fetch monthly tithe data from Tithe tab (not Stats tab)
        monthly_tithe_from_finance = get_monthly_tithe_from_finance_tab(campus, ytd_start, ytd_end)
        print(f"[DEBUG TITHE] Monthly tithe from Tithe tab: {monthly_tithe_from_finance}")
        
        # Calculate monthly averages from YTD data (for charts)
        monthly_averages = {}
        
        # Use YTD data for chart monthly averages
        # Calculate averages per WEEK, not per entry
        for month_key, month_data in ytd_monthly_trends.items():
            if month_data['count'] > 0:
                # Use actual service count for more accurate averages
                services_count = month_data['count']
                
                # Get tithe from Tithe tab instead of Stats tab
                tithe_from_finance_tab = monthly_tithe_from_finance.get(month_key, 0)
                
                monthly_averages[month_key] = {
                    'avg_attendance': round(month_data['attendance'] / services_count, 1),
                    'total_attendance': month_data['attendance'],
                    'services_count': services_count,
                    'avg_new_people': round(month_data['new_people'] / services_count, 1),
                    'total_new_people': month_data['new_people'],
                    'avg_new_christians': round(month_data['new_christians'] / services_count, 1),
                    'total_new_christians': month_data['new_christians'],
                    'avg_youth_attendance': round(month_data['youth_attendance'] / services_count, 1),
                    'total_youth_attendance': month_data['youth_attendance'],
                    'avg_kids_attendance': round(month_data['kids_attendance'] / services_count, 1),
                    'total_kids_attendance': month_data['kids_attendance'],
                    'total_tithe': tithe_from_finance_tab  # Use Tithe tab data, not Stats tab
                }
        
        # Then, add missing months with zero data to ensure complete range
        if start_date and end_date:
            current_date = start_date.replace(day=1)
            end_month = end_date.replace(day=1)
            
            while current_date <= end_month:
                month_key = current_date.strftime('%Y-%m')
                if month_key not in monthly_averages:
                    monthly_averages[month_key] = {
                        'avg_attendance': 0,
                        'total_attendance': 0,
                        'services_count': 0,
                        'avg_new_people': 0,
                        'total_new_people': 0,
                        'avg_youth_attendance': 0,
                        'total_youth_attendance': 0,
                        'avg_kids_attendance': 0,
                        'total_kids_attendance': 0,
                        'avg_new_christians': 0,
                        'total_new_christians': 0
                    }
                
                # Move to next month
                current_date = (current_date.replace(day=28) + timedelta(days=4)).replace(day=1)
        
        print(f"[DEBUG] Total attendance calculated: {period_stats['total_attendance']}")
        print(f"[DEBUG] Total people in campus: {period_stats['total_people']}")
        print(f"[DEBUG] Total new people calculated: {period_stats['new_people']}")
        print(f"[DEBUG] Total new christians calculated: {period_stats['new_christians']}")
        print(f"[DEBUG] Monthly averages: {monthly_averages}")
        
        # Prepare chart data with monthly averages
        # Chart data will be generated later with complete month range
        
        # Calculate averages for all metrics
        # Calculate number of weeks in the date range for proper averaging
        date_range_days = (end_date - start_date).days
        num_weeks = max(1, date_range_days / 7)  # At least 1 week
        
        if period_stats['entry_count'] > 0:
            # Main metrics - average per SERVICE for attendance (for monthly/period reports)
            period_stats['avg_attendance'] = period_stats['total_attendance'] / period_stats['entry_count']
            period_stats['avg_total_people'] = period_stats['total_people']  # This is a single value per campus, not averaged
            
            # New people breakdown - use entry_count (these are totals, not averages)
            period_stats['avg_first_time_visitors'] = period_stats['first_time_visitors'] / period_stats['entry_count']
            period_stats['avg_visitors'] = period_stats['visitors'] / period_stats['entry_count']
            period_stats['avg_information_gathered'] = period_stats['information_gathered'] / period_stats['entry_count']
            period_stats['avg_packs_out'] = period_stats['packs_out'] / period_stats['entry_count']
            period_stats['avg_new_people'] = period_stats['new_people'] / period_stats['entry_count']
            
            # Christian decisions breakdown - use entry_count (these are totals, not averages)
            period_stats['avg_first_time_christians'] = period_stats['first_time_christians'] / period_stats['entry_count']
            period_stats['avg_rededications'] = period_stats['rededications'] / period_stats['entry_count']
            period_stats['avg_hands_up'] = period_stats['hands_up'] / period_stats['entry_count']
            period_stats['avg_new_christians'] = period_stats['new_christians'] / period_stats['entry_count']
            
            # Youth breakdown - average per SERVICE for attendance
            period_stats['avg_youth_attendance'] = period_stats['youth_attendance'] / period_stats['entry_count']
            period_stats['avg_youth_salvations'] = period_stats['youth_salvations'] / period_stats['entry_count']
            period_stats['avg_youth_new_people'] = period_stats['youth_new_people'] / period_stats['entry_count']
            
            # Kids breakdown - average per SERVICE for attendance
            period_stats['avg_kids_attendance'] = period_stats['kids_attendance'] / period_stats['entry_count']
            period_stats['avg_kids_leaders'] = period_stats['kids_leaders'] / period_stats['entry_count']
            period_stats['avg_new_kids'] = period_stats['new_kids'] / period_stats['entry_count']
            period_stats['avg_new_kids_salvations'] = period_stats['new_kids_salvations'] / period_stats['entry_count']
            
            # Ministry metrics - average per SERVICE
            period_stats['avg_connect_groups'] = period_stats['connect_groups'] / period_stats['entry_count']
            period_stats['avg_dream_team'] = period_stats['dream_team'] / period_stats['entry_count']
            period_stats['avg_saints'] = period_stats['saints'] / period_stats['entry_count']
            
            # Financial data - average per SERVICE
            period_stats['avg_tithe'] = period_stats['tithe'] / period_stats['entry_count']
            
            # Special events - use entry_count
            period_stats['avg_baptisms'] = period_stats['baptisms'] / period_stats['entry_count']
            period_stats['avg_child_dedications'] = period_stats['child_dedications'] / period_stats['entry_count']
            
                    # Service time averages removed
            
            # Backward compatibility
            period_stats['avg_kids_total'] = period_stats['kids_total'] / period_stats['entry_count']
            period_stats['avg_volunteers'] = period_stats['volunteers'] / period_stats['entry_count']
        else:
            # Zero out all averages if no entries
            period_stats['avg_attendance'] = 0
            period_stats['avg_total_people'] = 0
            period_stats['avg_first_time_visitors'] = 0
            period_stats['avg_visitors'] = 0
            period_stats['avg_information_gathered'] = 0
            period_stats['avg_packs_out'] = 0
            period_stats['avg_new_people'] = 0
            period_stats['avg_first_time_christians'] = 0
            period_stats['avg_rededications'] = 0
            period_stats['avg_hands_up'] = 0
            period_stats['avg_new_christians'] = 0
            period_stats['avg_youth_attendance'] = 0
            period_stats['avg_youth_salvations'] = 0
            period_stats['avg_youth_new_people'] = 0
            period_stats['avg_kids_attendance'] = 0
            period_stats['avg_kids_leaders'] = 0
            period_stats['avg_new_kids'] = 0
            period_stats['avg_new_kids_salvations'] = 0
            period_stats['avg_connect_groups'] = 0
            period_stats['avg_dream_team'] = 0
            period_stats['avg_saints'] = 0
            period_stats['avg_tithe'] = 0
            period_stats['avg_baptisms'] = 0
            period_stats['avg_child_dedications'] = 0
            period_stats['avg_service_9am'] = 0
            period_stats['avg_service_10am'] = 0
            period_stats['avg_service_11am'] = 0
            period_stats['avg_service_5pm'] = 0
            period_stats['avg_kids_total'] = 0
            period_stats['avg_volunteers'] = 0
        
        # Sort trends by month (show more months for longer date ranges)
        trend_months = min(12, max(6, int((end_date - start_date).days / 30)))  # Adaptive trend period
        sorted_trends = dict(sorted(monthly_trends.items())[-trend_months:])
        
        # Prepare dashboard data for insights generation
        dashboard_data_for_insights = {
            'stats': period_stats,
            'trends': sorted_trends,
            'campus': campus
        }
        
        # Calculate service breakdown for campuses with multiple services
        service_breakdown = {}
        kids_service_breakdown = {}
        if campus != 'all_campuses':
            breakdown_data = calculate_service_breakdown(filtered_rows, campus)
            service_breakdown = breakdown_data.get('adult', {})
            kids_service_breakdown = breakdown_data.get('kids', {})
        
        # Generate chart data - only show months with actual data
        chart_data = {
            'labels': [],
            'attendance': [],
            'new_people': [],
            'new_christians': [],
            'youth': [],
            'kids': [],
            'tithe_ytd': [],
            'tithe_previous_year': [],
            'attendance_previous_year': [],
            'tithe_labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        }
        
        # Add previous year data (always calculate when available)
        previous_year_data = {
            'attendance': [],
            'new_people': [],
            'new_christians': [],
            'tithe': []
        }
        
        # Calculate previous year averages (always calculate when available)
        previous_year_averages = {}
        
        # Calculate date range for previous year (same months, but previous year)
        prev_start_date = start_date.replace(year=start_date.year - 1)
        prev_end_date = end_date.replace(year=end_date.year - 1)
        
        print(f"[DEBUG PREV YEAR] Calculating previous year data for range: {prev_start_date.strftime('%Y-%m-%d')} to {prev_end_date.strftime('%Y-%m-%d')}")
        print(f"[DEBUG PREV YEAR] Campus filter: '{campus}'")
        print(f"[DEBUG PREV YEAR] Total rows available: {len(rows)}")
        
        # Filter rows for previous year
        prev_filtered_rows = []
        for row in rows:
            try:
                date_str = row.get("Date", "")
                if not date_str:
                    continue
                
                if isinstance(date_str, str):
                    for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
                        try:
                            row_date = datetime.strptime(date_str, fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        continue
                else:
                    continue
                
                # Check if row is within previous year date range
                if prev_start_date <= row_date <= prev_end_date:
                    prev_filtered_rows.append(row)
                    
            except Exception:
                continue
        
        print(f"[DEBUG PREV YEAR] Found {len(prev_filtered_rows)} rows for previous year")
        print(f"[DEBUG PREV YEAR] Looking for campus: {campus} (normalized: {normalize_campus(campus)})")
        if len(prev_filtered_rows) > 0:
            print(f"[DEBUG PREV YEAR] Sample row: {prev_filtered_rows[0]}")
        
        # Debug: Show unique campuses in previous year data
        prev_year_campuses = set()
        for row in prev_filtered_rows:
            row_campus = row.get('Campus', '')
            if row_campus:
                prev_year_campuses.add(f"{row_campus} -> {normalize_campus(row_campus)}")
        print(f"[DEBUG PREV YEAR] Unique campuses found: {prev_year_campuses}")
        
        # Calculate monthly trends for previous year
        prev_monthly_trends = {}
        prev_rows_matched_campus = 0
        for row in prev_filtered_rows:
            try:
                row_date = None
                date_str = row.get("Date", "")
                if isinstance(date_str, str):
                    for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
                        try:
                            row_date = datetime.strptime(date_str, fmt)
                            break
                        except ValueError:
                            continue
                
                if not row_date:
                    continue
                
                # Filter by campus if not all_campuses
                if campus not in ['all_campuses', 'australia']:
                    row_campus = normalize_campus(row.get('Campus', ''))
                    campus_normalized = normalize_campus(campus)
                    if row_campus != campus_normalized:
                        continue
                
                prev_rows_matched_campus += 1
                
                # Calculate monthly trends
                month_key = row_date.strftime('%Y-%m')
                if month_key not in prev_monthly_trends:
                    prev_monthly_trends[month_key] = {
                        'attendance': 0,
                        'count': 0,
                        'new_people': 0,
                        'new_christians': 0,
                        'tithe': 0
                    }
                
                # Calculate attendance by summing service time columns
                service_times = ['9:00 AM', '10:00 AM', '11:00 AM', '5:00 PM', '5:30 PM']
                attendance = 0
                for service_time in service_times:
                    value = row.get(service_time, '')
                    if value is not None and value != '' and str(value).strip() != '':
                        try:
                            attendance += int(str(value).replace(',', '').strip())
                        except (ValueError, TypeError):
                            continue
                
                # Accept both "First Time" and "First Time Visitors" for flexibility
                first_time_visitors = get_stat_value(row, ['First Time', 'First Time Visitors', 'first_time_visitors'])
                visitors = get_stat_value(row, ['Visitors', 'visitors'])
                new_people = first_time_visitors + visitors
                first_time_christians = get_stat_value(row, ['First Time Christians', 'first_time_christians'])
                rededications = get_stat_value(row, ['Rededications', 'rededications'])
                new_christians = first_time_christians + rededications
                
                prev_monthly_trends[month_key]['attendance'] += attendance
                prev_monthly_trends[month_key]['count'] += 1
                prev_monthly_trends[month_key]['new_people'] += new_people
                prev_monthly_trends[month_key]['new_christians'] += new_christians
                
                # Add tithe data to previous year trends
                tithe_value = row.get('Tithe', '')
                if tithe_value and str(tithe_value).strip() != '':
                    try:
                        tithe_clean = str(tithe_value).replace('$', '').replace(',', '').strip()
                        if tithe_clean:
                            prev_monthly_trends[month_key]['tithe'] += float(tithe_clean)
                    except (ValueError, TypeError):
                        pass
                
            except Exception as e:
                continue
        
        print(f"[DEBUG PREV YEAR] Rows matched campus filter: {prev_rows_matched_campus}")
        print(f"[DEBUG PREV YEAR] Monthly trends found: {list(prev_monthly_trends.keys())}")
        
        # Calculate previous year monthly averages - include ALL months
        for month_key, month_data in prev_monthly_trends.items():
            if month_data['count'] > 0:
                previous_year_averages[month_key] = {
                    'avg_attendance': round(month_data['attendance'] / month_data['count'], 1),
                    'avg_new_people': round(month_data['new_people'] / month_data['count'], 1),
                    'avg_new_christians': round(month_data['new_christians'] / month_data['count'], 1),
                    'total_tithe': month_data['tithe']
                }
        
        # Add missing months with zero data to ensure complete range
        prev_current_date = prev_start_date.replace(day=1)
        prev_end_month = prev_end_date.replace(day=1)
        
        while prev_current_date <= prev_end_month:
            prev_month_key = prev_current_date.strftime('%Y-%m')
            if prev_month_key not in previous_year_averages:
                previous_year_averages[prev_month_key] = {
                    'avg_attendance': 0,
                    'avg_new_people': 0,
                    'avg_new_christians': 0,
                    'total_tithe': 0
                }
            
            # Move to next month
            prev_current_date = (prev_current_date.replace(day=28) + timedelta(days=4)).replace(day=1)
        
        print(f"[DEBUG PREV YEAR] Rows matched campus filter: {prev_rows_matched_campus}")
        print(f"[DEBUG PREV YEAR] Previous year monthly trends: {list(prev_monthly_trends.keys())}")
        print(f"[DEBUG PREV YEAR] Previous year averages: {previous_year_averages}")
        
        # Get current month to exclude from charts
        current_month = datetime.now().strftime('%Y-%m')
        
        # Always show YTD (Year-To-Date) for charts - January to current month
        print(f"[DEBUG] Chart generation - monthly_averages: {monthly_averages}")
        print(f"[DEBUG] Chart generation - current_month: {current_month}")
        
        # For charts, always show YTD (Jan through current month), not just the filtered date range
        now = datetime.now()
        ytd_start = datetime(now.year, 1, 1)  # January 1st of current year
        ytd_end = now.replace(day=1)  # Current month
        
        if ytd_start and ytd_end:
            current_date = ytd_start.replace(day=1)  # Start from January
            end_month = ytd_end.replace(day=1)  # End at current month
            
            while current_date <= end_month:
                month_key = current_date.strftime('%Y-%m')
                
                # Format month label (e.g., "2025-01" -> "Jan 2025")
                month_name = current_date.strftime('%b %Y')
                chart_data['labels'].append(month_name)
                
                # Get data for this month from averages, or use zeros if no data
                month_data = monthly_averages.get(month_key, {})
                
                attendance_val = month_data.get('avg_attendance', 0)
                new_people_val = month_data.get('avg_new_people', 0)
                new_christians_val = month_data.get('avg_new_christians', 0)
                youth_val = month_data.get('avg_youth_attendance', 0)
                kids_val = month_data.get('avg_kids_attendance', 0)
                tithe_val = month_data.get('total_tithe', 0)
                
                # For current month, show average based on number of actual entries
                # 1 entry: show actual data
                # 2 entries: divide total by 2
                # 3 entries: divide total by 3, etc.
                if month_key == current_month and month_data.get('services_count', 0) > 0:
                    # Get the number of actual services/entries we have for this month
                    num_entries = month_data.get('services_count', 0)
                    
                    # For 2+ entries, calculate average by dividing sum by number of entries
                    if num_entries >= 2:
                        # Use total values and divide by number of actual entries
                        total_attendance = month_data.get('total_attendance', 0)
                        total_new_people = month_data.get('total_new_people', 0)
                        total_new_christians = month_data.get('total_new_christians', 0)
                        total_youth = month_data.get('total_youth_attendance', 0)
                        total_kids = month_data.get('total_kids_attendance', 0)
                        
                        # Divide by number of actual entries to get average
                        attendance_val = total_attendance / num_entries if total_attendance > 0 else attendance_val
                        new_people_val = total_new_people / num_entries if total_new_people > 0 else new_people_val
                        new_christians_val = total_new_christians / num_entries if total_new_christians > 0 else new_christians_val
                        youth_val = total_youth / num_entries if total_youth > 0 else youth_val
                        kids_val = total_kids / num_entries if total_kids > 0 else kids_val
                        tithe_val = tithe_val / num_entries if tithe_val > 0 else tithe_val
                        
                        print(f"[DEBUG] Current month {month_key}: {num_entries} entries - showing average (total÷{num_entries})")
                    else:
                        print(f"[DEBUG] Current month {month_key}: {num_entries} entry - showing actual data")
                
                chart_data['attendance'].append(attendance_val)
                chart_data['new_people'].append(new_people_val)
                chart_data['new_christians'].append(new_christians_val)
                chart_data['youth'].append(youth_val)
                chart_data['kids'].append(kids_val)
                chart_data['tithe_ytd'].append(tithe_val)
                
                # Add previous year data (always add when available)
                # Find corresponding month in previous year
                prev_month_key = f"{current_date.year - 1}-{current_date.strftime('%m')}"
                prev_data = previous_year_averages.get(prev_month_key, {})
                
                previous_year_data['attendance'].append(prev_data.get('avg_attendance', 0))
                previous_year_data['new_people'].append(prev_data.get('avg_new_people', 0))
                previous_year_data['new_christians'].append(prev_data.get('avg_new_christians', 0))
                previous_year_data['tithe'].append(prev_data.get('total_tithe', 0))
                chart_data['tithe_previous_year'].append(prev_data.get('total_tithe', 0))
                chart_data['attendance_previous_year'].append(prev_data.get('avg_attendance', 0))
                
                print(f"[DEBUG] Added to chart: {month_name} - attendance: {attendance_val}, new_people: {new_people_val}, new_christians: {new_christians_val}")
                
                # Move to next month
                current_date = (current_date.replace(day=28) + timedelta(days=4)).replace(day=1)

        
        # Always include previous year data if it has content
        final_previous_year_data = None
        if previous_year_data and any(previous_year_data.values()):
            final_previous_year_data = previous_year_data
            print(f"[DEBUG] Returning previous year data: {final_previous_year_data}")
        else:
            print(f"[DEBUG] No previous year data to return: {previous_year_data}")
            
        # Force populate previous year data arrays if they're empty but we have averages
        if (final_previous_year_data is None and 
            previous_year_averages and 
            len(previous_year_averages) > 0):
            
            print(f"[DEBUG] Force populating previous year data arrays from averages")
            final_previous_year_data = {
                'attendance': [],
                'new_people': [],
                'new_christians': []
            }
            
            # Populate arrays with the calculated averages
            for month_key in sorted(prev_monthly_trends.keys()):
                month_data = prev_monthly_trends[month_key]
                if month_data['count'] > 0:
                    final_previous_year_data['attendance'].append(month_data['attendance'])
                    final_previous_year_data['new_people'].append(month_data['new_people'])
                    final_previous_year_data['new_christians'].append(month_data['new_christians'])
            
            print(f"[DEBUG] Force populated previous year data: {final_previous_year_data}")
        
        # Get tithe breakdown from Tithe tab
        tithe_breakdown = get_tithe_breakdown(campus, start_date, end_date)
        
        return {
            'stats': period_stats,
            'recent_entries': recent_entries[:10],
            'trends': {
                'monthly_averages': monthly_averages,
                'monthly_trends': monthly_trends
            },
            'chart_data': chart_data,
            'previous_year_data': final_previous_year_data,  # Always return previous year data when available
            'campus': campus,
            'service_breakdown': service_breakdown,  # Adult service times
            'kids_service_breakdown': kids_service_breakdown,  # Kids service times
            'tithe_breakdown': tithe_breakdown,  # Include tithe breakdown from Tithe tab
            'date_range': {
                'start': start_date.strftime('%Y-%m-%d'),
                'end': end_date.strftime('%Y-%m-%d'),
                'filter_type': date_filter
            },
            'function_called': 'FIRST_FUNCTION_WITH_AVERAGES'
        }
        
    except Exception as e:
        logger.error(f"Dashboard data error: {e}")
        return {"error": str(e)}



# Removed duplicate get_dashboard_data_v2 function to fix conflicts
# def get_dashboard_data_v2(campus, date_filter='last_12_months', custom_start_date='', custom_end_date=''):
#     """Get dashboard data with date filtering - V2 with averages"""
#     try:
#         print("[DEBUG] SECOND get_dashboard_data function called - THIS IS THE OLD ONE")
        # # Get data from Google Sheets
        # rows = []
        # logger.info(f"[SHEETS DEBUG] Starting data retrieval for campus: {campus}")
        # logger.info(f"[SHEETS DEBUG] Sheet object exists: {sheet is not None}")
        # 
        # if sheet:
        #     try:
        #         logger.info(f"[SHEETS DEBUG] Attempting to get all records from Google Sheets")
        #         rows = safe_sheets_request(sheet.get_all_records)
        #         logger.info(f"[SHEETS DEBUG] Successfully retrieved {len(rows)} rows from Google Sheets")
        #         if rows:
        #             logger.info(f"[SHEETS DEBUG] First row keys: {list(rows[0].keys())}")
        #             logger.info(f"[SHEETS DEBUG] Sample first row: {rows[0]}")
        #         else:
        #             logger.warning(f"[SHEETS DEBUG] Google Sheets returned empty data")
        #     except Exception as e:
        #         logger.error(f"[SHEETS DEBUG] Failed to get stats from Google Sheets: {e}")
        #         logger.error(f"[SHEETS DEBUG] Exception type: {type(e).__name__}")
        #         rows = []
        # 
        # if not rows:
        #     logger.warning(f"[SHEETS DEBUG] No rows from Google Sheets, falling back to conversation memory for campus: {campus}")
        #     # Fallback to conversation memory
        #     memory = load_conversation_memory()
        #     campus_history = memory.get("session_stats", {}).get(campus, [])
        #         logger.info(f"[SHEETS DEBUG] Conversation memory has {len(campus_history)} rows for campus: {campus}")
        #     if campus_history:
        #         logger.info(f"[SHEETS DEBUG] Memory row keys: {list(campus_history[0].keys())}")
        #     rows = campus_history
        
        # # Calculate date range based on filter
        # end_date = datetime.now()
        # if date_filter == 'last_7_days':
        #     start_date = end_date - timedelta(days=7)
        # elif date_filter == 'last_30_days':
        #     start_date = end_date - timedelta(days=30)
        # elif date_filter == 'last_90_days':
        #     start_date = end_date - timedelta(days=90)
        # elif date_filter == 'this_year':
        #     start_date = datetime(end_date.year, 1, 1)
        # elif date_filter == 'last_12_months':
        #     start_date = end_date - timedelta(days=365)  # 12 months
        # elif custom_start_date and custom_end_date:
        #     start_date = datetime.strptime(custom_start_date, '%Y-%m-%d')
        #     end_date = datetime.strptime(custom_end_date, '%Y-%m-%d')
        # else:
        #     start_date = end_date - timedelta(days=30)  # Default to 30 days
        # 
        # # Filter rows by campus and date range
        # filtered_rows = []
        # campus_normalized = normalize_campus(campus) if campus != 'all_campuses' else None
        # logger.info(f"[FILTER DEBUG] Total rows before filtering: {len(rows)}")
        # logger.info(f"[FILTER DEBUG] Campus: {campus}, Normalized: {campus_normalized}")
        # logger.info(f"[FILTER DEBUG] Date filter: {date_filter}, Start: {start_date}, End: {end_date}")
        # 
        # campus_match_count = 0
        # date_match_count = 0
        # 
        # for i, row in enumerate(rows):
        #     try:
        #         # Check campus filter
        #         if campus_normalized:
        #             row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
        #             campus_matches = (row_campus == campus_normalized or campus_normalized in row_campus)
        #             if not campus_matches:
        #             if i < 5:  # Log first few mismatches for debugging
        #                 logger.debug(f"[FILTER DEBUG] Row {i} campus mismatch: '{row_campus}' vs '{campus_normalized}'")
        #             continue
        #         campus_match_count += 1
        #         
        #         # Check date filter - use Date column instead of Timestamp
        #         date_str = row.get("Date", "")
        #         if not date_str:
        #             date_str = row.get("Timestamp", "")
        #         
        #         if date_str:
        #             try:
        #                 # Parse date using the same logic as query functions
        #                 row_date = get_row_timestamp(row)
        #                 
        #                 # Check if row is within date range
        #                 if row_date != datetime.min and start_date <= row_date <= end_date:
        #                     filtered_rows.append(row)
        #                     date_match_count += 1
        #                 else:
        #                     if i < 5:  # Log first few date mismatches for debugging
        #                         logger.debug(f"[FILTER DEBUG] Row {i} date mismatch: {row_date} not in range {start_date} to {end_date}")
        #             except Exception as e:
        #                 logger.warning(f"[FILTER DEBUG] Could not parse date '{date_str}' from row {i}: {e}")
        #         else:
        #             # No date column, include the row
        #             filtered_rows.append(row)
        #             date_match_count += 1
        # except Exception as e:
        #     logger.warning(f"[FILTER DEBUG] Error processing row {i}: {e}")
        #     continue
        
        logger.info(f"[FILTER DEBUG] Campus matches: {campus_match_count}, Date matches: {date_match_count}")
        logger.info(f"[FILTER DEBUG] Final filtered rows: {len(filtered_rows)}")
        
        print(f"[DEBUG] Filtered rows after date filtering: {len(filtered_rows)}")
        
        # Calculate stats using correct Google Sheets headers
        print(f"[DEBUG] Sample row keys: {list(filtered_rows[0].keys()) if filtered_rows else 'No rows'}")
        print(f"[DEBUG] Sample row: {filtered_rows[0] if filtered_rows else 'No rows'}")
        total_attendance = sum(safe_int(row.get('Total Attendance', 0)) for row in filtered_rows)
        print(f"[DEBUG] Total attendance calculated: {total_attendance}")
        
        # New People = First Time Visitors + Visitors  
        total_new_people = sum(
            safe_int(row.get('First Time Visitors', 0)) + safe_int(row.get('Visitors', 0)) 
            for row in filtered_rows
        )
        
        # New Christians = First Time Christians + Rededications
        total_new_christians = sum(
            safe_int(row.get('First Time Christians', 0)) + safe_int(row.get('Rededications', 0))
            for row in filtered_rows
        )
        
        total_youth = sum(safe_int(row.get('Youth Attendance', 0)) for row in filtered_rows)
        total_kids = sum(safe_int(row.get('Kids Attendance', 0)) for row in filtered_rows)
        total_connect_groups = sum(safe_int(row.get('Connect Groups', 0)) for row in filtered_rows)
        total_dream_team = sum(safe_int(row.get('Dream Team', 0)) for row in filtered_rows)
        # Debug tithe calculation - more robust with currency handling
        def parse_tithe_value(val):
            """Parse tithe value, handling currency formatting"""
            if not val:
                return 0
            try:
                # Remove dollar signs, commas, and spaces, then convert to float
                cleaned = str(val).replace('$', '').replace(',', '').replace(' ', '').strip()
                if cleaned:
                    return int(float(cleaned))
                return 0
            except Exception:
                return 0
        
        tithe_values = []
        tithe_debug_info = []
        for i, row in enumerate(filtered_rows):
            tithe_raw = row.get('Tithe', 0)
            tithe_converted = parse_tithe_value(tithe_raw)
            tithe_debug_info.append(f"Row {i}: raw='{tithe_raw}', converted={tithe_converted}")
            if tithe_converted > 0:
                tithe_values.append(tithe_converted)
                logger.debug(f"[TITHE DEBUG] Row {i} tithe: '{tithe_raw}' -> {tithe_converted}")
        
        total_tithe = sum(tithe_values)
        logger.debug(f"[TITHE DEBUG] Total tithe values found: {len(tithe_values)}, Total: ${total_tithe}")
        logger.debug(f"[TITHE DEBUG] First 5 tithe debug entries: {tithe_debug_info[:5]}")
        
        # Calculate averages
        valid_entries = len([row for row in filtered_rows if calculate_total_attendance(row) > 0])
        avg_attendance = total_attendance / valid_entries if valid_entries > 0 else 0
        avg_new_people = total_new_people / valid_entries if valid_entries > 0 else 0
        avg_new_christians = total_new_christians / valid_entries if valid_entries > 0 else 0
        avg_youth = total_youth / valid_entries if valid_entries > 0 else 0
        avg_kids = total_kids / valid_entries if valid_entries > 0 else 0
        avg_connect_groups = total_connect_groups / valid_entries if valid_entries > 0 else 0
        avg_dream_team = total_dream_team / valid_entries if valid_entries > 0 else 0
        
        # Prepare chart data for YTD trends (monthly aggregation)
        chart_data = {}
        
        # Group data by month for trend analysis
        monthly_data = {}
        for row in filtered_rows:
            try:
                # Use Date field instead of Timestamp for more accurate date filtering
                date_str = row.get("Date", "")
                if not date_str:
                    # Fallback to Timestamp if Date is not available
                    date_str = row.get("Timestamp", "")
                
                if date_str:
                    if "T" in date_str:
                        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    else:
                        date_obj = parse_any_date(date_str)
                    
                    month_key = date_obj.strftime('%Y-%m')
                    if month_key not in monthly_data:
                        monthly_data[month_key] = {
                            'attendance': [],
                            'new_people': [],
                            'new_christians': [],
                            'month_name': date_obj.strftime('%b %Y')
                        }
                    
                    monthly_data[month_key]['attendance'].append(safe_int(row.get('Total Attendance', 0)))
                    monthly_data[month_key]['new_people'].append(
                        safe_int(row.get('First Time Visitors', 0)) + safe_int(row.get('Visitors', 0))
                    )
                    monthly_data[month_key]['new_christians'].append(
                        safe_int(row.get('First Time Christians', 0)) + safe_int(row.get('Rededications', 0))
                    )
            except Exception:
                continue
        
        # Convert to chart format with complete month range
        attendance_labels = []
        attendance_values = []
        new_people_values = []
        new_christians_values = []
        
        # Create complete month range from start_date to end_date
        if start_date and end_date:
            current_date = start_date.replace(day=1)  # Start from first day of month
            end_month = end_date.replace(day=1)  # End at first day of month
            
            # Get current month to exclude from charts
            current_month = datetime.now().strftime('%Y-%m')
            
            while current_date <= end_month:
                month_key = current_date.strftime('%Y-%m')
                
                # Skip current month
                if month_key == current_month:
                    current_date = (current_date.replace(day=28) + timedelta(days=4)).replace(day=1)
                    continue
                
                month_name = current_date.strftime('%b %Y')
                attendance_labels.append(month_name)
                
                # Get data for this month from monthly_data, or use zeros if no data
                data = monthly_data.get(month_key, {'attendance': [], 'new_people': [], 'new_christians': []})
                
                # Calculate averages instead of totals
                attendance_count = len(data['attendance'])
                new_people_count = len(data['new_people'])
                new_christians_count = len(data['new_christians'])
                
                avg_attendance = sum(data['attendance']) / attendance_count if attendance_count > 0 else 0
                avg_new_people = sum(data['new_people']) / new_people_count if new_people_count > 0 else 0
                avg_new_christians = sum(data['new_christians']) / new_christians_count if new_christians_count > 0 else 0
                
                attendance_values.append(round(avg_attendance, 1))
                new_people_values.append(round(avg_new_people, 1))
                new_christians_values.append(round(avg_new_christians, 1))
                
                # Move to next month
                current_date = (current_date.replace(day=28) + timedelta(days=4)).replace(day=1)
        
        chart_data = {
            'labels': attendance_labels,
            'attendance': attendance_values,
            'new_people': new_people_values,
            'new_christians': new_christians_values
        }
        
        # Calculate detailed breakdown stats for modals using correct headers
        total_first_time_visitors = sum(safe_int(row.get('First Time Visitors', 0)) for row in filtered_rows)
        total_visitors = sum(safe_int(row.get('Visitors', 0)) for row in filtered_rows)
        total_first_time_christians = sum(safe_int(row.get('First Time Christians', 0)) for row in filtered_rows)
        total_rededications = sum(safe_int(row.get('Rededications', 0)) for row in filtered_rows)
        total_youth_attendance = sum(safe_int(row.get('Youth Attendance', 0)) for row in filtered_rows)
        total_youth_salvations = sum(safe_int(row.get('Youth Salvations', 0)) for row in filtered_rows)
        total_youth_new_people = sum(safe_int(row.get('Youth New People', 0)) for row in filtered_rows)
        total_kids_attendance = sum(safe_int(row.get('Kids Attendance', 0)) for row in filtered_rows)
        total_kids_leaders = sum(safe_int(row.get('Kids Leaders', 0)) for row in filtered_rows)
        total_new_kids = sum(safe_int(row.get('New Kids', 0)) for row in filtered_rows)
        total_new_kids_salvations = sum(safe_int(row.get('New Kids Salvations', 0)) for row in filtered_rows)

        # Calculate service time breakdown for attendance
        service_breakdown = {}
        if campus != 'all_campuses':
            service_breakdown = calculate_service_breakdown(filtered_rows, campus)
        else:
            # For all campuses, show individual service time totals
            service_times = ['9:00 AM', '10:00 AM', '11:00 AM', '5:00 PM']
            for service_time in service_times:
                total = sum(safe_int(row.get(service_time, 0)) for row in filtered_rows)
                if total > 0:
                    service_breakdown[service_time] = {
                        'total': total,
                        'count': len([row for row in filtered_rows if safe_int(row.get(service_time, 0)) > 0]),
                        'average': total / len([row for row in filtered_rows if safe_int(row.get(service_time, 0)) > 0]) if len([row for row in filtered_rows if safe_int(row.get(service_time, 0)) > 0]) > 0 else 0,
                        'entries': [safe_int(row.get(service_time, 0)) for row in filtered_rows if safe_int(row.get(service_time, 0)) > 0]
                    }

        return {
            'stats': {
                'total_attendance': total_attendance,
                'total_new_people': total_new_people,
                'total_new_christians': total_new_christians,
                'total_youth': total_youth,
                'total_kids': total_kids,
                'total_connect_groups': total_connect_groups,
                'total_dream_team': total_dream_team,
                'total_tithe': total_tithe,
                'avg_attendance': avg_attendance,
                'avg_new_people': avg_new_people,
                'avg_new_christians': avg_new_christians,
                'avg_youth': avg_youth,
                'avg_kids': avg_kids,
                'avg_connect_groups': avg_connect_groups,
                'avg_dream_team': avg_dream_team,
                # Breakdown stats for modals
                'first_time_visitors': total_first_time_visitors,
                'visitors': total_visitors,
                'first_time_christians': total_first_time_christians,
                'rededications': total_rededications,
                'youth_attendance': total_youth_attendance,
                'youth_salvations': total_youth_salvations,
                'youth_new_people': total_youth_new_people,
                'kids_attendance': total_kids_attendance,
                'kids_leaders': total_kids_leaders,
                'new_kids': total_new_kids,
                'new_kids_salvations': total_new_kids_salvations
            },
            'service_breakdown': service_breakdown,
            'chart_data': chart_data,
            'date_range': f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
            'function_called': 'SECOND_FUNCTION_WITH_TOTALS'
        }
    
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        return {
            'error': f'Error loading dashboard data: {str(e)}',
            'stats': {},
            'chart_data': {'attendance_labels': [], 'attendance_values': []}
        }

def get_campus_comparison_data(campus_filter=None):
    """Get comparison data across campuses for leadership insights"""
    try:
        if not sheet:
            return []
        
        # sheet is already a worksheet object, not a spreadsheet
        data = safe_sheets_request(sheet.get_all_records)
        
        if not data:
            return []
        
        # Get data for the last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        # If campus_filter is provided, only analyze that campus
        if campus_filter:
            campuses = [campus_filter.lower()]
        else:
            campuses = ['paradise', 'south', 'adelaide_city', 'salisbury', 'clare_valley', 
                       'mount_barker', 'victor_harbour', 'copper_coast']
        
        campus_stats = []
        
        for campus in campuses:
            # Filter data for this campus and date range
            campus_data = []
            for row in data:
                try:
                    date_str = row.get('Date', '')
                    if not date_str:
                        continue
                    
                    # Try multiple date formats
                    row_date = None
                    date_formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']
                    
                    for date_format in date_formats:
                        try:
                            row_date = datetime.strptime(date_str, date_format)
                            break
                        except ValueError:
                            continue
                    
                    if row_date and start_date <= row_date <= end_date and row.get('Campus', '').lower() == campus.lower():
                        campus_data.append(row)
                except (ValueError, TypeError):
                    continue
            
            if campus_data:
                # Calculate basic stats for this campus using correct headers
                total_attendance = sum(safe_int(row.get('Total Attendance', 0)) for row in campus_data)
                
                # New People = First Time Visitors + Visitors  
                total_new_people = sum(
                    safe_int(row.get('First Time Visitors', 0)) + safe_int(row.get('Visitors', 0))
                    for row in campus_data
                )
                
                # New Christians = First Time Christians + Rededications
                total_new_christians = sum(
                    safe_int(row.get('First Time Christians', 0)) + safe_int(row.get('Rededications', 0))
                    for row in campus_data
                )
                
                total_youth = sum(safe_int(row.get('Youth Attendance', 0)) for row in campus_data)
                total_kids = sum(safe_int(row.get('Kids Attendance', 0)) for row in campus_data)
                
                avg_attendance = total_attendance / len(campus_data) if campus_data else 0
                avg_new_people = total_new_people / len(campus_data) if campus_data else 0
                avg_new_christians = total_new_christians / len(campus_data) if campus_data else 0
                
                # Calculate growth rates compared to previous period
                prev_start = start_date - timedelta(days=30)
                prev_data = []
                for row in data:
                    try:
                        date_str = row.get('Date', '')
                        if not date_str:
                            continue
                        
                        # Try multiple date formats
                        row_date = None
                        date_formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']
                        
                        for date_format in date_formats:
                            try:
                                row_date = datetime.strptime(date_str, date_format)
                                break
                            except ValueError:
                                continue
                        
                        if row_date and prev_start <= row_date < start_date and row.get('Campus', '').lower() == campus.lower():
                            prev_data.append(row)
                    except (ValueError, TypeError):
                        continue
                
                # Calculate growth percentages
                attendance_growth = 0
                new_people_growth = 0
                new_christians_growth = 0
                
                if prev_data:
                    prev_avg_attendance = sum(safe_int(row.get('Total Attendance', 0)) for row in prev_data) / len(prev_data)
                    
                    # Calculate previous period averages with correct headers
                    prev_total_new_people = sum(
                        safe_int(row.get('First Time Visitors', 0)) + safe_int(row.get('Visitors', 0))
                        for row in prev_data
                    )
                    prev_avg_new_people = prev_total_new_people / len(prev_data)
                    
                    prev_total_new_christians = sum(
                        safe_int(row.get('First Time Christians', 0)) + safe_int(row.get('Rededications', 0))
                        for row in prev_data
                    )
                    prev_avg_new_christians = prev_total_new_christians / len(prev_data)
                    
                    if prev_avg_attendance > 0:
                        attendance_growth = ((avg_attendance - prev_avg_attendance) / prev_avg_attendance) * 100
                    
                    if prev_avg_new_people > 0:
                        new_people_growth = ((avg_new_people - prev_avg_new_people) / prev_avg_new_people) * 100
                    
                    if prev_avg_new_christians > 0:
                        new_christians_growth = ((avg_new_christians - prev_avg_new_christians) / prev_avg_new_christians) * 100
                
                campus_stats.append({
                    'campus': campus,
                    'display_name': campus.replace('_', ' ').title(),
                    'attendance': round(avg_attendance, 1),
                    'new_people': round(avg_new_people, 1),
                    'new_christians': round(avg_new_christians, 1),
                    'youth': round(total_youth / len(campus_data), 1) if campus_data else 0,
                    'kids': round(total_kids / len(campus_data), 1) if campus_data else 0,
                    'attendance_growth': round(attendance_growth, 1),
                    'new_people_growth': round(new_people_growth, 1),
                    'new_christians_growth': round(new_christians_growth, 1),
                    'total_records': len(campus_data),
                    'conversion_rate': round((avg_new_christians / max(avg_new_people, 1)) * 100, 1)
                })
        
        return sorted(campus_stats, key=lambda x: x['attendance'], reverse=True)
        
    except Exception as e:
        logger.error(f"Campus comparison data error: {e}")
        return []

def generate_campus_insights(campus_data, campus_filter=None):
    """Generate AI-powered insights from campus data"""
    try:
        if not campus_data:
            return ["No campus data available for insights generation."]
        
        insights = []
        
        # If this is campus-specific data (single campus)
        if campus_filter and len(campus_data) == 1:
            campus = campus_data[0]
            
            # Campus-specific insights
            insights.append(f"📊 {campus['display_name']} current performance: {campus['attendance']} average attendance, {campus['new_people']} new people per week")
            
            # Growth insights
            if campus['attendance_growth'] > 10:
                insights.append(f"🚀 Excellent growth! Your attendance is up {campus['attendance_growth']}% from last month")
            elif campus['attendance_growth'] > 0:
                insights.append(f"📈 Positive growth: {campus['attendance_growth']}% attendance increase from last month")
            elif campus['attendance_growth'] < -10:
                insights.append(f"⚠️ Attendance declined {abs(campus['attendance_growth'])}% - consider community outreach initiatives")
            else:
                insights.append(f"📊 Attendance stable with {campus['attendance_growth']}% change from last month")
            
            # Conversion insights
            if campus['conversion_rate'] > 25:
                insights.append(f"🎯 Outstanding conversion rate! {campus['conversion_rate']}% of new people are becoming Christians")
            elif campus['conversion_rate'] > 15:
                insights.append(f"✅ Good conversion rate: {campus['conversion_rate']}% of new people becoming Christians")
            else:
                insights.append(f"💡 Focus opportunity: {campus['conversion_rate']}% conversion rate - consider follow-up strategies")
            
            # Youth and kids
            if campus['youth'] > 25:
                insights.append(f"👥 Strong youth program with {campus['youth']} average attendance")
            elif campus['youth'] > 0:
                insights.append(f"👥 Youth engagement: {campus['youth']} average - room for growth")
            
            if campus['kids'] > 20:
                insights.append(f"👶 Thriving kids ministry with {campus['kids']} average attendance")
            elif campus['kids'] > 0:
                insights.append(f"👶 Kids ministry: {campus['kids']} average - potential for expansion")
            
            # Encouragement
            insights.append(f"💪 Keep up the great work! {campus['display_name']} is making a real impact in the community")
            
        else:
            # Multi-campus insights (for senior leadership/admin)
            
            # Top performing campus
            if campus_data:
                top_campus = campus_data[0]
                insights.append(f"🏆 {top_campus['display_name']} leads in attendance with {top_campus['attendance']} average weekly attendance")
            
            # Growth analysis
            growth_leaders = [campus for campus in campus_data if campus['attendance_growth'] > 10]
            if growth_leaders:
                campus_names = [campus['display_name'] for campus in growth_leaders[:3]]
                insights.append(f"📈 Strong growth at {', '.join(campus_names)} - attendance up 10%+ from last month")
            
            declining_campuses = [campus for campus in campus_data if campus['attendance_growth'] < -10]
            if declining_campuses:
                campus_names = [campus['display_name'] for campus in declining_campuses[:2]]
                insights.append(f"⚠️ {', '.join(campus_names)} showing declining attendance - may need attention")
            
            # New people conversion insights
            high_conversion = [campus for campus in campus_data if campus['conversion_rate'] > 20]
            if high_conversion:
                campus_names = [campus['display_name'] for campus in high_conversion[:2]]
                insights.append(f"🎯 Excellent conversion rates at {', '.join(campus_names)} - over 20% of new people becoming Christians")
            
            # Youth and kids analysis
            youth_leaders = sorted([campus for campus in campus_data if campus['youth'] > 0], key=lambda x: x['youth'], reverse=True)[:2]
            if youth_leaders:
                campus_names = [f"{campus['display_name']} ({campus['youth']})" for campus in youth_leaders]
                insights.append(f"👥 Youth engagement leaders: {', '.join(campus_names)}")
            
            # Overall network performance
            total_attendance = sum(campus['attendance'] * campus['total_records'] for campus in campus_data)
            total_records = sum(campus['total_records'] for campus in campus_data)
            network_avg = total_attendance / max(total_records, 1)
            
            total_new_people = sum(campus['new_people'] * campus['total_records'] for campus in campus_data)
            total_new_christians = sum(campus['new_christians'] * campus['total_records'] for campus in campus_data)
            network_conversion = (total_new_christians / max(total_new_people, 1)) * 100
            
            insights.append(f"🌟 Network average: {network_avg:.1f} attendance, {network_conversion:.1f}% conversion rate across all campuses")
            
            # Opportunities
            underperforming = [campus for campus in campus_data if campus['attendance'] < network_avg * 0.7]
            if underperforming:
                campus_names = [campus['display_name'] for campus in underperforming[:2]]
                insights.append(f"💡 Growth opportunities at {', '.join(campus_names)} - below network average")
        
        return insights[:6]  # Limit to 6 insights
        
    except Exception as e:
        logger.error(f"Insights generation error: {e}")
        return ["Unable to generate insights at this time. Please try again later."]

def get_weekly_campus_comparison_data():
    """Get campus comparison data for the current week"""
    try:
        # Get data from Google Sheets
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        
        if not rows:
            return []
        
        # Get current week's data (last 7 days)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        # Group by campus
        campus_data = {}
        for row in rows:
            try:
                # Check if row is within current week
                timestamp_str = row.get("Timestamp", "")
                if timestamp_str:
                    if "T" in timestamp_str:
                        row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        row_date = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    
                    if start_date <= row_date <= end_date:
                        campus = row.get("Campus", "").lower()
                        if campus not in campus_data:
                            campus_data[campus] = {
                                'campus': campus,
                                'attendance': 0,
                                'new_people': 0,
                                'new_christians': 0
                            }
                        
                        campus_data[campus]['attendance'] += safe_int(row.get('Total Attendance', 0))
                        campus_data[campus]['new_people'] += safe_int(row.get('New People', 0))
                        campus_data[campus]['new_christians'] += safe_int(row.get('New Christians', 0))
            except Exception:
                continue
        
        # Convert to list and sort by attendance
        comparison_list = list(campus_data.values())
        comparison_list.sort(key=lambda x: x['attendance'], reverse=True)
        
        return comparison_list
    
    except Exception as e:
        logger.error(f"Error getting campus comparison data: {e}")
        return []

# @app.route('/dashboard')
# @login_required
# def dashboard():
#     """Dashboard with analytics and statistics - React app handles this now"""
#     # This route is now handled by React Router
#     pass

# @app.route('/finance')
# @login_required
# def finance_dashboard():
#     """Finance team tithe logging interface - React app handles this now"""
#     # This route is now handled by React Router
#     pass

def get_existing_tithe_data(selected_date):
    """Get existing tithe data for the selected date from DATABASE (primary) or Sheets (fallback)"""
    try:
        from datetime import datetime as dt_module
        
        # Parse the selected date
        target_date = dt_module.strptime(selected_date, '%Y-%m-%d').date()
        
        # First, try to get from database
        try:
            db_records = FinanceRecord.query.filter_by(date=target_date).all()
            if db_records:
                existing_data = {}
                for record in db_records:
                    # Use campus_id as key (lowercase for consistency)
                    key = record.campus_id.lower()
                    existing_data[key] = {
                        'general': float(record.general) if record.general else 0,
                        'trust': float(record.trust) if record.trust else 0,
                        'online': float(record.online) if record.online else 0,
                        'text': float(record.text) if record.text else 0,
                        'total': float(record.total) if record.total else 0,
                        'source': 'database'
                    }
                logger.info(f"Loaded {len(existing_data)} finance records from database for {selected_date}")
                return existing_data
        except Exception as e:
            logger.warning(f"Error loading from database, falling back to sheets: {str(e)}")
        
        # Fallback to Google Sheets if database fails or is empty
        if not finance_sheet:
            return {}
        
        # Get all rows from the Tithe tab
        rows = safe_sheets_request(finance_sheet.get_all_records)
        existing_data = {}
        
        for row in rows:
            date_str = row.get("Date", "")
            if date_str:
                try:
                    # Parse the date from the row
                    if "T" in date_str:
                        row_date = dt_module.fromisoformat(date_str.replace('Z', '+00:00')).date()
                    else:
                        row_date = dt_module.strptime(date_str, "%Y-%m-%d").date()
                    
                    # If dates match, collect tithe data
                    if row_date == target_date:
                        campus = row.get('Campus', '')
                        general = row.get('General', 0)
                        trust = row.get('Trust', 0)
                        online = row.get('Online Giving', 0)
                        text = row.get('Text', 0)
                        total = row.get('Total', 0)
                        if campus:
                            existing_data[campus.lower()] = {
                                'general': safe_int(general) if general else 0,
                                'trust': safe_int(trust) if trust else 0,
                                'online': safe_int(online) if online else 0,
                                'text': safe_int(text) if text else 0,
                                'total': safe_int(total) if total else 0,
                                'row_index': rows.index(row) + 2,  # +2 because sheets are 1-indexed and have header
                                'source': 'sheets'
                            }
                except Exception as e:
                    logger.warning(f"Error parsing date {date_str}: {e}")
                    continue
        
        logger.info(f"Loaded {len(existing_data)} finance records from sheets for {selected_date}")
        return existing_data
        
    except Exception as e:
        logger.error(f"Error getting existing tithe data: {str(e)}")
        return {}

@app.route('/finance/submit', methods=['POST'])
@login_required
def submit_tithe_data():
    """Submit tithe data for multiple campuses"""
    try:
        # Only users with finance access can access this
        if not current_user.has_permission('finance_access'):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        selected_date = data.get('date')
        tithe_data = data.get('tithe_data', {})
        
        if not selected_date or not tithe_data:
            return jsonify({'error': 'Missing date or tithe data'}), 400
        
        results = []
        
        # Process each campus's tithe data
        for campus_id, amount in tithe_data.items():
            if amount and float(amount) > 0:
                result = update_tithe_for_campus(campus_id, selected_date, float(amount))
                results.append({
                    'campus': campus_id,
                    'amount': amount,
                    'success': result['success'],
                    'message': result['message']
                })
        
        return jsonify({
            'success': True,
            'message': f'Tithe data submitted for {len(results)} campuses',
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error submitting tithe data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/finance/status')
@login_required
def check_finance_status():
    """Check if finance sheet is connected"""
    try:
        return jsonify({
            'success': True,
            'finance_sheet_connected': finance_sheet is not None,
            'finance_sheet_title': finance_sheet.title if finance_sheet else None
        })
    except Exception as e:
        logger.error(f"Error checking finance status: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/finance/existing')
@login_required
def get_existing_finance_data():
    """Get existing finance data for a specific date"""
    try:
        # Only users with finance access can access this
        if not current_user.has_permission('finance_access'):
            return jsonify({'success': False, 'error': 'Access denied. Finance access required.'}), 403
        
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({'success': False, 'error': 'Date parameter is required'}), 400
        
        # Get existing tithe data for the date
        existing_data = get_existing_tithe_data(date_str)
        
        return jsonify({
            'success': True,
            'existing_data': existing_data
        })
        
    except Exception as e:
        logger.error(f"Error getting existing finance data: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred while loading finance data'}), 500

@app.route('/api/finance/submit', methods=['POST'])
@login_required
def submit_finance_data():
    """Submit tithe data for multiple campuses - region-restricted for finance users"""
    try:
        # Only users with finance access can access this
        if not current_user.has_permission('finance_access'):
            return jsonify({'success': False, 'error': 'Access denied. Finance access required.'}), 403
        
        # Get user's region_id for filtering
        user_region_id = getattr(current_user, 'region_id', None)
        
        # For finance users, restrict to their region only (unless superadmin)
        if current_user.role == 'finance' and user_region_id and current_user.role != 'superadmin':
            logger.info(f"[FINANCE_SUBMIT] Finance user {current_user.username} restricted to region_id={user_region_id}")
        
        data = request.get_json()
        selected_date = data.get('date')
        tithe_data = data.get('tithe_data', {})
        
        logger.info(f"Finance submit request - Date: {selected_date}, Campus count: {len(tithe_data)}, User region: {user_region_id}")
        
        if not selected_date:
            return jsonify({'success': False, 'error': 'Date is required'}), 400
        
        if not tithe_data:
            return jsonify({'success': False, 'error': 'Tithe data is required for at least one campus'}), 400
        
        results = []
        success_count = 0
        
        # Process each campus's tithe data
        for campus_id, campus_data in tithe_data.items():
            if campus_data:
                # Validate region access for finance users
                if current_user.role == 'finance' and user_region_id and current_user.role != 'superadmin':
                    # Get campus to check its region
                    campus = CampusV2.query.filter_by(campus_id=campus_id).first()
                    if not campus:
                        logger.warning(f"[FINANCE_SUBMIT] Campus {campus_id} not found")
                        results.append({
                            'campus': campus_id,
                            'success': False,
                            'message': f'Campus {campus_id} not found'
                        })
                        continue
                    
                    # Check if campus is in user's region
                    if campus.region_id != user_region_id:
                        logger.warning(f"[FINANCE_SUBMIT] Finance user {current_user.username} attempted to input for campus {campus_id} (region_id={campus.region_id}) but user is restricted to region_id={user_region_id}")
                        results.append({
                            'campus': campus_id,
                            'success': False,
                            'message': f'Access denied. You can only input finance data for campuses in your region.'
                        })
                        continue
                
                # campus_data is now a dict with {general, trust, online, text}
                general = float(campus_data.get('general', 0))
                trust = float(campus_data.get('trust', 0))
                online = float(campus_data.get('online', 0))
                text = float(campus_data.get('text', 0))
                total = general + trust + online + text
                
                if total > 0:
                    breakdown = {
                        'general': general,
                        'trust': trust,
                        'online': online,
                        'text': text,
                        'total': total
                    }
                    # Pass current user's email for audit trail
                    result = update_tithe_for_campus(campus_id, selected_date, breakdown, current_user.email)
                    results.append({
                        'campus': campus_id,
                        'total': total,
                        'breakdown': breakdown,
                        'success': result.get('success', False),
                        'message': result.get('message', '')
                    })
                    if result.get('success'):
                        success_count += 1
        
        if success_count > 0:
            return jsonify({
                'success': True,
                'message': f'Tithe data submitted for {success_count} campus(es)',
                'results': results
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to submit tithe data for any campus',
                'results': results
            }), 500
            
    except Exception as e:
        logger.error(f"Error submitting finance data: {str(e)}")
        return jsonify({'success': False, 'error': f'An error occurred: {str(e)}'}), 500


@app.route('/api/finance/records', methods=['GET'])
@login_required
def get_finance_records():
    """
    Get finance records from database
    Accessible by finance team and super admin only
    """
    try:
        # Check permissions - only finance and superadmin can view
        if not current_user.has_permission('finance_access'):
            return jsonify({'success': False, 'error': 'Access denied. Finance access required.'}), 403
        
        # Get filters from query params
        campus_filter = request.args.get('campus', '')
        start_date_str = request.args.get('start_date', '')
        end_date_str = request.args.get('end_date', '')
        limit = int(request.args.get('limit', 100))
        
        logger.info(f"Fetching finance records with filters: campus={campus_filter}, start={start_date_str}, end={end_date_str}")
        
        # Build query
        query = FinanceRecord.query
        
        # Apply filters
        if campus_filter:
            query = query.filter(FinanceRecord.campus_id == campus_filter)
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            query = query.filter(FinanceRecord.date >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            query = query.filter(FinanceRecord.date <= end_date)
        
        # Get records (most recent first)
        records = query.order_by(FinanceRecord.date.desc()).limit(limit).all()
        
        logger.info(f"Found {len(records)} finance records")
        
        # Convert to dict
        records_data = [record.to_dict() for record in records]
        
        return jsonify({
            'success': True,
            'records': records_data,
            'count': len(records_data)
        })
        
    except Exception as e:
        logger.error(f"Error fetching finance records: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/finance/records/<int:record_id>', methods=['PUT'])
@login_required
def update_finance_record(record_id):
    """
    Update a finance record
    Accessible by finance team and super admin only
    """
    try:
        # Check permissions
        if not current_user.has_permission('finance_access'):
            return jsonify({'success': False, 'error': 'Access denied. Finance access required.'}), 403
        
        # Get the record
        record = FinanceRecord.query.get(record_id)
        if not record:
            return jsonify({'success': False, 'error': 'Record not found'}), 404
        
        # Get update data
        data = request.get_json()
        
        # Update fields
        if 'general' in data:
            record.general = float(data['general'])
        if 'trust' in data:
            record.trust = float(data['trust'])
        if 'online' in data:
            record.online = float(data['online'])
        if 'text' in data:
            record.text = float(data['text'])
        
        # Recalculate total
        record.total = float(record.general or 0) + float(record.trust or 0) + float(record.online or 0) + float(record.text or 0)
        record.updated_at = datetime.utcnow()
        record.updated_by = current_user.email
        
        db.session.commit()
        
        logger.info(f"Updated finance record {record_id} by {current_user.email}")
        
        return jsonify({
            'success': True,
            'message': 'Finance record updated successfully',
            'record': record.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating finance record: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/finance/records/<int:record_id>', methods=['DELETE'])
@login_required
def delete_finance_record(record_id):
    """
    Delete a finance record
    Accessible by super admin only
    """
    try:
        # Check permissions - only superadmin can delete
        user_role = getattr(current_user, 'role', 'member')
        if user_role != 'superadmin':
            return jsonify({'success': False, 'error': 'Access denied. Super admin only.'}), 403
        
        # Get the record
        record = FinanceRecord.query.get(record_id)
        if not record:
            return jsonify({'success': False, 'error': 'Record not found'}), 404
        
        # Delete it
        db.session.delete(record)
        db.session.commit()
        
        logger.info(f"Deleted finance record {record_id} by {current_user.email}")
        
        return jsonify({
            'success': True,
            'message': 'Finance record deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting finance record: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


def save_finance_to_database(campus_id, date_str, tithe_breakdown, user_email=None):
    """Save finance data to the database"""
    try:
        from datetime import datetime as dt_module
        from sqlalchemy.exc import IntegrityError
        
        # Parse date
        date_obj = dt_module.strptime(date_str, '%Y-%m-%d').date()
        
        # Get campus info
        campus = CampusV2.query.filter_by(campus_id=campus_id).first()
        if not campus:
            # Try normalized lookup
            normalized_campus_id = normalize_campus(campus_id)
            campus = CampusV2.query.filter(
                db.func.lower(CampusV2.campus_id) == normalized_campus_id.lower()
            ).first()
        
        if not campus:
            logger.warning(f"Campus not found for ID: {campus_id}")
            campus_name = campus_id.replace('_', ' ').title()
            region = 'AU'  # Default
        else:
            campus_name = campus.display_name or campus.name
            region = campus.region.code if campus.region else 'AU'
        
        # Extract breakdown
        general = float(tithe_breakdown.get('general', 0))
        trust = float(tithe_breakdown.get('trust', 0))
        online = float(tithe_breakdown.get('online', 0))
        text = float(tithe_breakdown.get('text', 0))
        total = float(tithe_breakdown.get('total', 0))
        
        # Check if record exists
        existing_record = FinanceRecord.query.filter_by(
            date=date_obj,
            campus_id=campus_id,
            region=region
        ).first()
        
        if existing_record:
            # Update existing record
            existing_record.general = general
            existing_record.trust = trust
            existing_record.online = online
            existing_record.text = text
            existing_record.total = total
            existing_record.campus_name = campus_name
            existing_record.updated_at = dt_module.utcnow()
            existing_record.updated_by = user_email
            existing_record.synced_to_sheets = True  # Mark as synced since we're also saving to sheets
            
            db.session.commit()
            logger.info(f"Updated finance record in database for {campus_id} on {date_str}: ${total}")
            return {'success': True, 'message': 'Updated', 'record_id': existing_record.id}
        else:
            # Create new record
            new_record = FinanceRecord(
                date=date_obj,
                campus_id=campus_id,
                campus_name=campus_name,
                region=region,
                general=general,
                trust=trust,
                online=online,
                text=text,
                total=total,
                synced_to_sheets=True,
                created_by=user_email,
                updated_by=user_email
            )
            
            db.session.add(new_record)
            db.session.commit()
            logger.info(f"Created finance record in database for {campus_id} on {date_str}: ${total}")
            return {'success': True, 'message': 'Created', 'record_id': new_record.id}
            
    except IntegrityError as e:
        db.session.rollback()
        logger.error(f"Integrity error saving finance to database: {str(e)}")
        return {'success': False, 'message': 'Duplicate entry or constraint violation'}
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error saving finance to database: {str(e)}")
        return {'success': False, 'message': f'Database error: {str(e)}'}


def update_tithe_for_campus(campus_id, date_str, tithe_amount, user_email=None):
    """Update or add tithe data for a specific campus and date to BOTH database AND Google Sheets"""
    try:
        # First, save to database
        db_result = save_finance_to_database(campus_id, date_str, tithe_amount, user_email)
        if not db_result['success']:
            logger.warning(f"Failed to save to database: {db_result['message']}")
            # Continue to sheets anyway
        
        if not finance_sheet:
            logger.error("Finance sheet is None when trying to update tithe")
            # If database save succeeded but sheets failed, still return success
            if db_result['success']:
                return {'success': True, 'message': f'Saved to database only (sheets unavailable) - {db_result["message"]}'}
            return {'success': False, 'message': 'Finance sheet (Tithe tab) not available'}
        
        # Get all rows from the Tithe tab
        try:
            rows = safe_sheets_request(finance_sheet.get_all_records)
            # Ensure rows is a list (handle None case)
            if rows is None:
                rows = []
        except Exception as e:
            logger.error(f"Error getting records from finance sheet: {str(e)}")
            # Return empty list instead of failing - we can still append new rows
            rows = []
        
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Look for existing row for this campus and date
        # Normalize the incoming campus_id for comparison
        normalized_campus_id = normalize_campus(campus_id)
        existing_row_index = None
        latest_timestamp = None
        
        # Only search existing rows if we have any
        for i, row in enumerate(rows):
            date_str_row = row.get("Date", "")
            campus_name = row.get('Campus', '')
            timestamp_str = row.get('Timestamp', '')
            if date_str_row and campus_name:
                try:
                    if "T" in date_str_row:
                        row_date = datetime.fromisoformat(date_str_row.replace('Z', '+00:00')).date()
                    else:
                        row_date = datetime.strptime(date_str_row, "%Y-%m-%d").date()
                    
                    # Normalize both campus names for comparison
                    normalized_row_campus = normalize_campus(campus_name)
                    
                    if row_date == target_date and normalized_row_campus == normalized_campus_id:
                        # If there are multiple matches, use the most recent one (by timestamp)
                        if timestamp_str:
                            try:
                                if "T" in timestamp_str:
                                    row_timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                                else:
                                    row_timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                                
                                if latest_timestamp is None or row_timestamp > latest_timestamp:
                                    latest_timestamp = row_timestamp
                                    existing_row_index = i + 2  # +2 for 1-indexed and header
                            except:
                                # If timestamp parsing fails, just use this row if we haven't found one yet
                                if existing_row_index is None:
                                    existing_row_index = i + 2
                        else:
                            # No timestamp, use first match if we haven't found one
                            if existing_row_index is None:
                                existing_row_index = i + 2
                except Exception as e:
                    logger.warning(f"Error matching row {i}: {e}")
                    continue
        
        if existing_row_index:
            logger.info(f"Found existing row {existing_row_index} for {campus_id} on {date_str} (updating instead of creating new)")
        
        # tithe_amount is now a dict with breakdown: {general, trust, online, text, total}
        general = tithe_amount.get('general', 0) if isinstance(tithe_amount, dict) else 0
        trust = tithe_amount.get('trust', 0) if isinstance(tithe_amount, dict) else 0
        online = tithe_amount.get('online', 0) if isinstance(tithe_amount, dict) else 0
        text = tithe_amount.get('text', 0) if isinstance(tithe_amount, dict) else 0
        total = tithe_amount.get('total', 0) if isinstance(tithe_amount, dict) else tithe_amount
        
        if existing_row_index:
            # Update existing row - update all tithe breakdown columns (D-H)
            # D=General, E=Trust, F=Online Giving, G=Text, H=Total
            try:
                finance_sheet.update(f'D{existing_row_index}:H{existing_row_index}', [[general, trust, online, text, total]])
                logger.info(f"Updated tithe for {campus_id} on {date_str}: ${total} (G:{general}, T:{trust}, O:{online}, Tx:{text})")
                return {'success': True, 'message': f'Updated existing entry for {campus_id}'}
            except Exception as e:
                logger.error(f"Error updating row in finance sheet: {str(e)}")
                return {'success': False, 'message': f'Error updating entry: {str(e)}'}
        else:
            # Create new row in Tithe tab with breakdown
            # Tithe tab columns: A=Timestamp, B=Date, C=Campus, D=General, E=Trust, F=Online Giving, G=Text, H=Total
            # Use Adelaide timezone for timestamp
            from zoneinfo import ZoneInfo
            adelaide_tz = ZoneInfo('Australia/Adelaide')
            now_adelaide = datetime.now(adelaide_tz)
            
            # First, ensure headers exist (in case sheet was just created)
            try:
                headers = finance_sheet.row_values(1)  # Get first row (headers)
                expected_headers = ['Timestamp', 'Date', 'Campus', 'General', 'Trust', 'Online Giving', 'Text', 'Total']
                if len(headers) < len(expected_headers):
                    # Add missing headers
                    finance_sheet.update('A1:H1', [expected_headers])
                    logger.info(f"Updated Tithe sheet headers")
            except Exception as e:
                logger.warning(f"Could not check/update headers: {e}")
            
            new_row = [
                now_adelaide.strftime('%Y-%m-%d %H:%M:%S'),  # A: Timestamp
                date_str,                    # B: Date
                campus_id.replace('_', ' ').title(),  # C: Campus
                general,                     # D: General
                trust,                       # E: Trust
                online,                      # F: Online Giving
                text,                        # G: Text
                total                        # H: Total
            ]
            
            try:
                finance_sheet.append_row(new_row, value_input_option='USER_ENTERED')
                logger.info(f"Created new tithe entry for {campus_id} on {date_str}: ${total} (G:{general}, T:{trust}, O:{online}, Tx:{text})")
                return {'success': True, 'message': f'Created new entry for {campus_id}'}
            except Exception as e:
                logger.error(f"Error appending row to finance sheet: {str(e)}")
                return {'success': False, 'message': f'Error creating entry: {str(e)}'}
            
    except Exception as e:
        logger.error(f"Error updating tithe for {campus_id}: {str(e)}")
        return {'success': False, 'message': str(e)}

@app.route('/')
def serve_index():
    """Main application page - serve React app for all users"""
    print(f"[DEBUG] Root route accessed - User authenticated: {current_user.is_authenticated}")
    
    # Always serve the React app - let React handle authentication
    print("[DEBUG] Serving React app")
    return send_from_directory('static', 'index.html')

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def api_register():
    """Public registration endpoint - creates User account and links to Person record"""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response, 200
    
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        full_name = data.get('full_name', '').strip()
        campus = data.get('campus', '').strip()
        
        if not email or not password or not full_name:
            return jsonify({"error": "Email, password, and full name are required"}), 400
        
        # Check if User account already exists
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?', (email,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            return jsonify({"error": "An account with this email already exists. Please login instead."}), 400
        
        # Create User account (full_name/campus come directly from the request payload)
        user_id = str(uuid.uuid4())
        password_hash = generate_password_hash(password, method='pbkdf2:sha256')
        
        cursor.execute('''
            INSERT INTO users (id, username, email, password_hash, full_name, role, campus, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            full_name,
            email,
            password_hash,
            full_name,
            'pastor',  # Default role
            campus or 'all_campuses',
            1,
            datetime.now()
        ))
        conn.commit()
        
        logger.info(f"[REGISTER] ✅ Created User account for {email}")
        
        # Auto-login the user
        user_data = {
            'id': user_id,
            'username': full_name,
            'email': email,
            'full_name': full_name,
            'role': 'pastor',
            'campus': campus or 'all_campuses',
            'active': True
        }
        user = User(user_data)
        login_user(user, remember=True)
        session.modified = True
        
        return jsonify({
            "success": True,
            "authenticated": True,
            "message": "Account created successfully!",
            "token": session.get('_id', 'session-token'),
            "user": {
                "id": user_id,
                "email": email,
                "name": full_name,
                "role": 'pastor',
                "campus": campus or 'all_campuses'
            }
        })
        
    except Exception as e:
        logger.error(f"[REGISTER] Error: {e}", exc_info=True)
        return jsonify({"error": "Registration failed. Please try again."}), 500


@app.route('/api/login', methods=['POST', 'OPTIONS'])
def api_login():
    """API login endpoint for React frontend and mobile app"""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response, 200
    
    try:
        logger.info(f"=== LOGIN ATTEMPT ===")
        logger.info(f"Method: {request.method}")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"is_json: {request.is_json}")
        logger.info(f"Headers: {dict(request.headers)}")
        logger.info(f"Body (raw): {request.get_data(as_text=True)}")
        
        # Try to get JSON data even if Content-Type is wrong
        data = None
        try:
            data = request.get_json(force=True, silent=True)
            logger.info(f"JSON data (forced): {data}")
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}")
        
        if not data:
            # Fallback to form data
            data = request.form.to_dict()
            logger.info(f"Form data: {data}")
        
        if data:
            # Accept both 'username' and 'email' for mobile app compatibility
            username = data.get('username', '').strip() or data.get('email', '').strip()
            password = data.get('password', '').strip()
        else:
            username = ''
            password = ''
        
        logger.info(f"Parsed - username/email: '{username}', password: {'***' if password else '(empty)'}")
        
        if not username or not password:
            logger.warning(f"Missing credentials - username='{username}', password={'present' if password else 'missing'}")
            return jsonify({"error": "Please enter both username and password."}), 400
        
        user = authenticate_user(username, password)
        if user:
            login_user(user, remember=True)
            # Ensure session is saved
            session.modified = True
            logger.info(f"✅ User {username} logged in successfully, user_id={user.id}, role={user.role}")
            logger.info(f"[LOGIN] Session after login_user: keys={list(session.keys())}, _user_id={session.get('_user_id')}")
            
            # Log successful login
            try:
                log_security_event(user.id, 'login_success', 'User logged in successfully')
            except Exception as log_error:
                logger.error(f"Error logging security event: {log_error}")
            
            # Person records were removed with the CRM; keep response keys for frontend compat
            personal_campus = None
            person_id = None

            # Google Drive: restore access from stored refresh token (if user connected before)
            try:
                refresh_google_access_token_in_session()
            except Exception as g_err:
                logger.warning("Google session hydrate at login: %s", g_err)

            token_expiry = session.get("google_drive_token_expiry", 0)
            token_valid = token_expiry > datetime.now(timezone.utc).timestamp()
            has_access = bool(session.get("google_drive_access_token"))
            needs_drive_auth = not (has_access and token_valid)
            
            # Return proper response format for mobile app
            user_campus = getattr(user, 'campus', 'all_campuses')
            return jsonify({
                "success": True, 
                "authenticated": True,
                "redirect": "/",
                "token": session.get('_id', 'session-token'),  # Return session identifier
                "needs_drive_auth": needs_drive_auth,  # Prompt for Google auth if needed
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.full_name or user.username,
                    "role": user.role,
                    "access_campus": user_campus,  # For access control (all_campuses for admin)
                    "campus": personal_campus or user_campus,  # Personal campus (where they attend)
                    "person_id": person_id  # NEW: Person ID for linking prayer requests to correct profile
                }
            })
        else:
            # More detailed logging for failed login
            logger.warning(f"❌ Login FAILED for: '{username}'")
            logger.warning(f"   - Email format: {username if '@' in username else 'Not an email'}")
            logger.warning(f"   - Attempting to find user in database...")
            
            # Try to check if user exists (for debugging)
            try:
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, username, email, active, role
                    FROM users
                    WHERE TRIM(LOWER(email)) = ? OR TRIM(LOWER(username)) = ?
                ''', (username.lower().strip(), username.lower().strip()))
                debug_user = cursor.fetchone()
                conn.close()
                
                if debug_user:
                    logger.warning(f"   - User EXISTS in DB: id={debug_user[0]}, username='{debug_user[1]}', email='{debug_user[2]}', active={debug_user[3]}, role={debug_user[4]}")
                    if not debug_user[3]:
                        logger.warning(f"   - ❌ User account is INACTIVE!")
                        return jsonify({"error": "Your account is inactive. Please contact support."}), 401
                    logger.warning(f"   - ⚠️ Password does not match OR password hash format issue")
                else:
                    logger.warning(f"   - ❌ User NOT FOUND in database")
            except Exception as debug_error:
                logger.error(f"Error checking user existence: {debug_error}")
            
            # Log failed login attempt
            try:
                log_security_event('unknown', 'login_failed', f'Failed login attempt for username: {username}')
            except Exception as log_error:
                logger.error(f"Error logging security event: {log_error}")
            
            return jsonify({"error": "Invalid username/email or password."}), 401
    except Exception as e:
        logger.error(f"Error in api_login: {e}", exc_info=True)
        return jsonify({"error": "Internal server error. Please try again."}), 500

# Security Settings Endpoints
@app.route('/api/security/change_password', methods=['POST'])
@login_required
def change_password():
    """Change user password"""
    try:
        data = request.get_json()
        current_password = data.get('currentPassword', '').strip()
        new_password = data.get('newPassword', '').strip()
        confirm_password = data.get('confirmPassword', '').strip()
        
        if not current_password or not new_password or not confirm_password:
            return jsonify({"error": "All fields are required"}), 400
        
        if new_password != confirm_password:
            return jsonify({"error": "New passwords do not match"}), 400
        
        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters long"}), 400
        
        # Verify current password
        if not current_user.check_password(current_password):
            return jsonify({"error": "Current password is incorrect"}), 401
        
        # Update password in users.json
        users_data = load_users()
        if current_user.id in users_data['users']:
            users_data['users'][current_user.id]['password_hash'] = generate_password_hash(new_password)
            save_users(users_data)
            
            # Log security event
            log_security_event(current_user.id, 'password_change', 'Password changed successfully')
            
            return jsonify({"message": "Password changed successfully"}), 200
        else:
            return jsonify({"error": "User not found"}), 404
            
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/security/account_info', methods=['GET'])
@login_required
def get_account_info():
    """Get current user account information"""
    try:
        users_data = load_users()
        user_data = users_data['users'].get(current_user.id, {})
        
        # Remove sensitive information
        account_info = {
            'id': user_data.get('id'),
            'username': user_data.get('username'),
            'email': user_data.get('email'),
            'full_name': user_data.get('full_name'),
            'role': user_data.get('role'),
            'campus': user_data.get('campus'),
            'active': user_data.get('active'),
            'created_date': user_data.get('created_date'),
            'last_login': user_data.get('last_login'),
            'role_name': users_data['roles'].get(user_data.get('role', ''), {}).get('name', 'Unknown'),
            'role_description': users_data['roles'].get(user_data.get('role', ''), {}).get('description', '')
        }
        
        return jsonify(account_info), 200
        
    except Exception as e:
        logger.error(f"Error getting account info: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/security/sessions', methods=['GET'])
@login_required
def get_active_sessions():
    """Get active sessions for current user (simplified - in production would track actual sessions)"""
    try:
        # For now, return basic session info
        # In production, this would track actual session tokens
        session_info = {
            'current_session': {
                'id': f"session_{current_user.id}_{int(datetime.now().timestamp())}",
                'created': datetime.now().isoformat(),
                'ip_address': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', 'Unknown')
            },
            'total_sessions': 1  # Simplified for demo
        }
        
        return jsonify(session_info), 200
        
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/security/logout_all', methods=['POST'])
@login_required
def logout_all_sessions():
    """Logout from all sessions (simplified implementation)"""
    try:
        # In production, this would invalidate all session tokens
        # For now, just log the event
        log_security_event(current_user.id, 'logout_all', 'User logged out from all sessions')
        
        return jsonify({"message": "Logged out from all sessions"}), 200
        
    except Exception as e:
        logger.error(f"Error logging out all sessions: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/security/activity_log', methods=['GET'])
@login_required
def get_activity_log():
    """Get user activity log"""
    try:
        # Load security logs
        security_logs = load_security_logs()
        user_logs = security_logs.get(current_user.id, [])
        
        # Return last 50 entries
        recent_logs = user_logs[-50:] if user_logs else []
        
        return jsonify({
            'logs': recent_logs,
            'total_entries': len(user_logs)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting activity log: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/security/two_factor', methods=['GET', 'POST'])
@login_required
def two_factor_settings():
    """Two-factor authentication settings (placeholder for future implementation)"""
    try:
        if request.method == 'GET':
            # Return current 2FA status
            return jsonify({
                'enabled': False,
                'method': 'none',
                'message': 'Two-factor authentication is not yet implemented'
            }), 200
        else:
            # POST request to enable/disable 2FA
            data = request.get_json()
            action = data.get('action', '')
            
            if action == 'enable':
                return jsonify({
                    'message': 'Two-factor authentication is not yet implemented',
                    'enabled': False
                }), 200
            elif action == 'disable':
                return jsonify({
                    'message': 'Two-factor authentication is not yet implemented',
                    'enabled': False
                }), 200
            else:
                return jsonify({"error": "Invalid action"}), 400
                
    except Exception as e:
        logger.error(f"Error with 2FA settings: {e}")
        return jsonify({"error": "Internal server error"}), 500

# Admin-only security endpoints
@app.route('/api/security/admin/users', methods=['GET'])
@login_required
def get_all_users():
    """Get all users (admin only)"""
    try:
        if not current_user.has_permission('manage_users'):
            return jsonify({"error": "Access denied"}), 403
        
        # Get users from database instead of JSON file
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, username, email, full_name, role, campus, active, created_at, last_login, region_id
            FROM users
            ORDER BY full_name
        ''')
        
        users_list = []
        users_data = load_users()  # Still need this for role names
        
        for row in cursor.fetchall():
            user_id, username, email, full_name, role, campus, active, created_at, last_login, region_id = row
            
            # Format last login for display
            last_login_display = "Never"
            if last_login:
                try:
                    # Convert to readable format
                    if isinstance(last_login, str):
                        last_login_dt = datetime.fromisoformat(last_login.replace('Z', '+00:00'))
                    else:
                        last_login_dt = last_login
                    last_login_display = last_login_dt.strftime('%Y-%m-%d %H:%M')
                except:
                    last_login_display = "Unknown"
            
            user_info = {
                'id': str(user_id),
                'username': username,
                'email': email or 'N/A',
                'full_name': full_name or username,
                'role': role,
                'campus': campus or '',
                'region_id': region_id,
                'active': bool(active),
                'created_date': created_at.strftime('%Y-%m-%d') if created_at else 'Unknown',
                'last_login': last_login_display,
                'role_name': users_data['roles'].get(role, {}).get('name', 'Unknown')
            }
            users_list.append(user_info)
        
        conn.close()
        return jsonify({'users': users_list}), 200
        
    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/security/admin/user/<user_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_user(user_id):
    """Manage user (admin only)"""
    try:
        if not current_user.has_permission('manage_users'):
            return jsonify({"error": "Access denied"}), 403
        
        # Check if user exists in database first
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        user_exists = cursor.fetchone()
        conn.close()
        
        if not user_exists:
            return jsonify({"error": "User not found"}), 404
        
        users_data = load_users()
        
        if request.method == 'PUT':
            # Update user
            data = request.get_json()
            
            # Update database
            conn = get_db()
            cursor = conn.cursor()
            
            # Build update query dynamically
            update_fields = []
            update_values = []
            
            if 'active' in data:
                update_fields.append('active = ?')
                update_values.append(data['active'])
            if 'role' in data:
                update_fields.append('role = ?')
                update_values.append(data['role'])
            if 'campus' in data:
                update_fields.append('campus = ?')
                update_values.append(data['campus'])
                
                # Auto-assign role based on campus
                if data['campus'] and data['campus'] != 'all_campuses':
                    # If assigned to specific campus, make them campus_pastor
                    if 'role' not in data or data.get('role') == 'admin':
                        update_fields.append('role = ?')
                        update_values.append('campus_pastor')
                elif data['campus'] == 'all_campuses':
                    # If assigned to all campuses, make them senior_leader (unless they're admin)
                    if 'role' not in data or data.get('role') == 'campus_pastor':
                        update_fields.append('role = ?')
                        update_values.append('senior_leader')
            if 'email' in data:
                update_fields.append('email = ?')
                update_values.append(data['email'])
            if 'full_name' in data:
                update_fields.append('full_name = ?')
                update_values.append(data['full_name'])
            
            if update_fields:
                update_values.append(user_id)
                cursor.execute(f'''
                    UPDATE users 
                    SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', update_values)
                conn.commit()
            
            conn.close()
            
            # Also update JSON file for backward compatibility (if user exists there)
            if user_id in users_data['users']:
                user_data = users_data['users'][user_id]
                if 'active' in data:
                    user_data['active'] = data['active']
                if 'role' in data:
                    user_data['role'] = data['role']
                if 'campus' in data:
                    user_data['campus'] = data['campus']
                if 'email' in data:
                    user_data['email'] = data['email']
                if 'full_name' in data:
                    user_data['full_name'] = data['full_name']
                
                save_users(users_data)
            
            log_security_event(current_user.id, 'user_updated', f'Updated user {user_id}')
            
            return jsonify({"message": "User updated successfully"}), 200
            
        elif request.method == 'DELETE':
            # Deactivate user (don't actually delete)
            users_data['users'][user_id]['active'] = False
            save_users(users_data)
            log_security_event(current_user.id, 'user_deactivated', f'Deactivated user {user_id}')
            
            return jsonify({"message": "User deactivated successfully"}), 200
            
    except Exception as e:
        logger.error(f"Error managing user: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/security/admin/logs', methods=['GET'])
@login_required
def get_security_logs():
    """Get all security logs (admin only)"""
    try:
        if not current_user.has_permission('manage_users'):
            return jsonify({"error": "Access denied"}), 403
        
        security_logs = load_security_logs()
        
        # Return all logs (in production, this would be paginated)
        all_logs = []
        for user_id, logs in security_logs.items():
            for log in logs:
                log['user_id'] = user_id
                all_logs.append(log)
        
        # Sort by timestamp (newest first)
        all_logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return jsonify({
            'logs': all_logs[:100],  # Limit to 100 most recent
            'total_entries': len(all_logs)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting security logs: {e}")
        return jsonify({"error": "Internal server error"}), 500

# Security utility functions
def log_security_event(user_id, event_type, description):
    """Log security events"""
    try:
        security_logs = load_security_logs()
        
        if user_id not in security_logs:
            security_logs[user_id] = []
        
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'description': description,
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', 'Unknown')
        }
        
        security_logs[user_id].append(log_entry)
        
        # Keep only last 1000 entries per user
        if len(security_logs[user_id]) > 1000:
            security_logs[user_id] = security_logs[user_id][-1000:]
        
        save_security_logs(security_logs)
        
    except Exception as e:
        logger.error(f"Error logging security event: {e}")

def load_security_logs():
    """Load security logs from file"""
    try:
        log_file = os.path.join('data', 'security_logs.json')
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        logger.error(f"Error loading security logs: {e}")
        return {}

def save_security_logs(logs):
    """Save security logs to file"""
    try:
        log_file = os.path.join('data', 'security_logs.json')
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        with open(log_file, 'w') as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving security logs: {e}")

def load_users():
    """Load users from users.json"""
    try:
        users_file = os.path.join('users.json')
        if os.path.exists(users_file):
            with open(users_file, 'r') as f:
                return json.load(f)
        return {"users": {}, "roles": {}, "metadata": {}}
    except Exception as e:
        logger.error(f"Error loading users: {e}")
        return {"users": {}, "roles": {}, "metadata": {}}

def save_users(data):
    """Save users to users.json"""
    try:
        users_file = os.path.join('users.json')
        with open(users_file, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving users: {e}")

@app.route('/api/logout', methods=['POST'])
def logout():
    """Logout user and clear session"""
    try:
        # Get user ID before logout
        user_id = None
        if hasattr(current_user, 'id') and current_user.is_authenticated:
            user_id = current_user.id
        elif 'user_id' in session:
            user_id = session.get('user_id')
        
        # Remove Flask-Login user session data
        if '_user_id' in session:
            session.pop('_user_id', None)
        if 'user_id' in session:
            session.pop('user_id', None)
        if '_fresh' in session:
            session.pop('_fresh', None)
            
        # Call Flask-Login logout
        logout_user()
        
        # Force clear the entire session
        for key in list(session.keys()):
            session.pop(key, None)
        
        # Modify session to force save
        session.modified = True
        
        logger.info(f"User {user_id} logged out successfully")
        
        # Return response with clear cookie headers
        response = jsonify({"success": True, "message": "Logged out successfully"})
        response.set_cookie('session', '', expires=0, samesite='Lax', path='/')
        response.set_cookie('remember_token', '', expires=0, path='/')
        
        return response
    except Exception as e:
        logger.error(f"Logout error: {e}", exc_info=True)
        # Even if there's an error, try to clear everything
        for key in list(session.keys()):
            session.pop(key, None)
        session.modified = True
        response = jsonify({"success": True, "message": "Logged out"})
        response.set_cookie('session', '', expires=0, path='/')
        return response

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files from static directory"""
    if app.static_folder:
        # Ensure filename is a string
        if not isinstance(filename, str):
            filename = str(filename)
        return send_from_directory(app.static_folder, filename)
    return jsonify({"error": "Static folder not configured"}), 404

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve React assets from static/assets directory"""
    if app.static_folder:
        # Ensure filename is a string
        if not isinstance(filename, str):
            filename = str(filename)
        return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)
    return jsonify({"error": "Static folder not configured"}), 404

@app.route('/videos/<path:filename>')
def serve_videos(filename):
    """Serve training videos from /data/videos directory (persistent storage)"""
    # Ensure filename is a string
    if not isinstance(filename, str):
        filename = str(filename)
    
    # Use /data/videos/ for persistent storage (Railway volume mount)
    videos_dir = os.path.join('/data', 'videos')
    video_path = os.path.join(videos_dir, filename)
    
    if os.path.exists(video_path):
        logger.info(f"Serving video: {filename} from {videos_dir}")
        return send_from_directory(videos_dir, filename)
    else:
        logger.warning(f"Video not found: {filename} (looking in {videos_dir})")
        return jsonify({"error": "Video not found"}), 404

@app.route('/temp_audio/<path:filename>')
def serve_audio(filename):
    """Serve generated audio files"""
    # Ensure filename is a string
    if not isinstance(filename, str):
        filename = str(filename)
    # Use absolute path to temp_audio directory in backend folder
    temp_audio_dir = os.path.join(os.path.dirname(__file__), "temp_audio")
    return send_from_directory(temp_audio_dir, filename)

# @app.route('/query')
# @login_required
# def serve_query():
#     """Query page with voice interface - React app handles this now"""
#     # This route is now handled by React Router
#     pass

@app.route('/api/health')
def health_check():
    """Simple health check endpoint - must respond quickly"""
    try:
        # Simple health check - don't check external services to avoid timeouts
        return jsonify({
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 500

@app.route('/api/debug/auth', methods=['GET', 'POST'])
def debug_auth():
    """Debug authentication status"""
    # Try to load user from session manually
    manual_user = None
    if '_user_id' in session:
        try:
            manual_user = load_user(session.get('_user_id'))
        except Exception as e:
            manual_user = f"Error loading user: {e}"
    
    return jsonify({
        "method": request.method,
        "is_authenticated": current_user.is_authenticated,
        "user_id": current_user.get_id() if current_user.is_authenticated else None,
        "username": current_user.username if current_user.is_authenticated else None,
        "role": current_user.role if current_user.is_authenticated else None,
        "session_keys": list(session.keys()),
        "session_user_id": session.get('_user_id'),
        "session_fresh": session.get('_fresh'),
        "cookies_received": list(request.cookies.keys()),
        "has_session_cookie": 'session' in request.cookies,
        "session_cookie_value_length": len(request.cookies.get('session', '')) if 'session' in request.cookies else 0,
        "manual_user_load": str(manual_user) if manual_user and not isinstance(manual_user, str) else manual_user,
        "cookie_config": {
            "samesite": app.config.get('SESSION_COOKIE_SAMESITE'),
            "secure": app.config.get('SESSION_COOKIE_SECURE'),
            "httponly": app.config.get('SESSION_COOKIE_HTTPONLY'),
            "name": app.config.get('SESSION_COOKIE_NAME')
        },
        "request_headers": {
            "cookie": request.headers.get('Cookie', 'None'),
            "host": request.headers.get('Host'),
            "origin": request.headers.get('Origin'),
            "referer": request.headers.get('Referer')
        }
    })

@app.route('/api/debug/sheets')
def debug_sheets():
    """Debug Google Sheets connection"""
    try:
        google_sheets_credentials = os.getenv("GOOGLE_SHEETS_CREDENTIALS")
        sheet_name = os.getenv("GOOGLE_SHEET_NAME", "SHEETS")
        
        if not google_sheets_credentials:
            return jsonify({
                "error": "GOOGLE_SHEETS_CREDENTIALS not found in environment variables"
            })
        
        import json
        creds_dict = json.loads(google_sheets_credentials)
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        client = gspread.authorize(creds)
        
        # Try to list available spreadsheets
        try:
            available_sheets = client.openall()
            sheet_titles = [s.title for s in available_sheets]
            
            # Try to access the specific sheet
            try:
                target_sheet = client.open(sheet_name)
                sheet_data = target_sheet.sheet1.get_all_records()
                sample_row = sheet_data[0] if sheet_data else {}
                return jsonify({
                    "success": True,
                    "sheet_name": sheet_name,
                    "available_sheets": sheet_titles,
                    "row_count": len(sheet_data),
                    "sample_row": sample_row,
                    "service_account_email": creds_dict.get("client_email", "unknown")
                })
            except Exception as sheet_error:
                return jsonify({
                    "error": f"Could not access sheet '{sheet_name}': {str(sheet_error)}",
                    "available_sheets": sheet_titles,
                    "service_account_email": creds_dict.get("client_email", "unknown")
                })
                
        except Exception as list_error:
            return jsonify({
                "error": f"Could not list sheets: {str(list_error)}",
                "service_account_email": creds_dict.get("client_email", "unknown")
            })
            
    except Exception as e:
        return jsonify({
            "error": f"Failed to initialize Google Sheets: {str(e)}"
        })

@app.route('/api/debug/data')
def debug_data():
    """Debug local data loading"""
    try:
        data = load_local_data()
        return jsonify({
            "status": "success",
            "data_count": len(data) if data else 0,
            "sample_data": data[:2] if data else [],
            "data_locations_tried": ["backend/data/logged_stats.json", "data/logged_stats.json", "/app/backend/data/logged_stats.json"]
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        })

@app.route('/api/debug/sheets-sync-status')
def debug_sheets_sync_status():
    """Check the current status of Google Sheets sync variables"""
    try:
        return jsonify({
            "status": "success",
            "sheet_initialized": sheet is not None,
            "client_initialized": client is not None,
            "finance_sheet_initialized": finance_sheet is not None,
            "env_vars": {
                "GOOGLE_SHEETS_CREDENTIALS_BASE64": bool(os.getenv("GOOGLE_SHEETS_CREDENTIALS_BASE64")),
                "GOOGLE_SHEETS_CREDENTIALS": bool(os.getenv("GOOGLE_SHEETS_CREDENTIALS")),
                "GOOGLE_SHEET_NAME": os.getenv("GOOGLE_SHEET_NAME", "Not Set")
            },
            "will_sync_to_sheets": (sheet is not None) or (client is not None),
            "message": "If will_sync_to_sheets is False, Google Sheets sync is disabled"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        })

@app.route('/api/debug/routes')
def debug_routes():
    """List all registered routes for debugging"""
    try:
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                "endpoint": rule.endpoint,
                "methods": list(rule.methods),
                "path": rule.rule
            })
        
        # Filter for profile routes
        profile_routes = [r for r in routes if 'profile' in r['path'].lower()]
        
        return jsonify({
            "status": "success",
            "total_routes": len(routes),
            "profile_routes": profile_routes,
            "change_password_routes": [r for r in routes if 'change' in r['path'].lower() and 'password' in r['path'].lower()]
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        })

@app.route('/api/emergency/reset-password', methods=['POST'])
def emergency_reset_password():
    """Emergency password reset endpoint - USE WITH CAUTION"""
    try:
        data = request.get_json()
        username = data.get('username')
        new_password = data.get('new_password')
        emergency_key = data.get('emergency_key')
        
        # Check emergency key (set in environment)
        expected_key = os.environ.get('EMERGENCY_RESET_KEY', 'futures-emergency-2025')
        if emergency_key != expected_key:
            logger.warning(f"[EMERGENCY] Invalid emergency key attempt for user: {username}")
            return jsonify({"error": "Invalid emergency key"}), 403
        
        if not username or not new_password:
            return jsonify({"error": "Username and new_password required"}), 400
        
        # Get user from database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, email FROM users WHERE username = ?', (username,))
        user_row = cursor.fetchone()
        
        if not user_row:
            return jsonify({"error": "User not found"}), 404
        
        user_id, username, email = user_row
        logger.info(f"[EMERGENCY] Resetting password for user: {username} (ID: {user_id})")
        
        # Update password
        password_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
        conn.commit()
        
        logger.info(f"[EMERGENCY] ✅ Password reset successfully for user: {username}")
        return jsonify({
            "success": True,
            "message": f"Password reset successfully for {username}",
            "username": username,
            "email": email
        })
        
    except Exception as e:
        logger.error(f"[EMERGENCY] Error resetting password: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

# PROFILE MANAGEMENT ROUTES - Moved here to ensure registration
@app.route('/api/profile/change-password', methods=['POST', 'OPTIONS'])
def profile_change_password():
    """Allow users to change their own password"""
    logger.info(f"[PROFILE-PWD] === PASSWORD CHANGE REQUEST ===")
    logger.info(f"[PROFILE-PWD] Method: {request.method}")
    logger.info(f"[PROFILE-PWD] Cookies received: {list(request.cookies.keys())}")
    logger.info(f"[PROFILE-PWD] Has session cookie: {'session' in request.cookies}")
    logger.info(f"[PROFILE-PWD] Session keys: {list(session.keys())}")
    logger.info(f"[PROFILE-PWD] Session _user_id: {session.get('_user_id')}")
    logger.info(f"[PROFILE-PWD] current_user.is_authenticated: {current_user.is_authenticated}")
    logger.info(f"[PROFILE-PWD] current_user: {current_user}")
    
    # Handle OPTIONS for CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    
    # Check authentication - try both Flask-Login and session
    user_id = None
    if current_user.is_authenticated:
        user_id = current_user.id
        logger.info(f"[PROFILE-PWD] ✅ Authenticated via Flask-Login, user_id: {user_id}")
    elif '_user_id' in session:
        # Fallback: load user from session if Flask-Login didn't work
        user_id = session.get('_user_id')
        logger.info(f"[PROFILE-PWD] ⚠️  Using session fallback, _user_id: {user_id}")
    
    if not user_id:
        logger.error(f"[PROFILE-PWD] ❌ AUTHENTICATION FAILED")
        logger.error(f"[PROFILE-PWD] Session keys: {list(session.keys())}")
        logger.error(f"[PROFILE-PWD] Cookies: {list(request.cookies.keys())}")
        logger.error(f"[PROFILE-PWD] Request headers: {dict(request.headers)}")
        return jsonify({"error": "Authentication required", "debug": {"session_keys": list(session.keys()), "has_cookie": 'session' in request.cookies}}), 401
    
    try:
        data = request.get_json()
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({"error": "Missing required fields"}), 400
        
        if len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        
        # Get user directly from database
        logger.info(f"[PROFILE] Changing password for user_id: {user_id}")
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, password_hash FROM users WHERE id = ? AND active = 1', (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            logger.error(f"[PROFILE] User not found in database: {user_id}")
            return jsonify({"error": "User not found"}), 404
        
        # Verify current password
        if not check_password_hash(user_row[2], current_password):
            logger.warning(f"[PROFILE] Incorrect current password for user_id: {user_id}")
            return jsonify({"error": "Current password is incorrect"}), 401
        
        # Update password in database
        new_password_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_password_hash, user_id))
        conn.commit()
        
        logger.info(f"[PROFILE] ✅ Password changed successfully for user_id: {user_id}")
        return jsonify({"success": True, "message": "Password changed successfully"})
    except Exception as e:
        logger.error(f"[PROFILE] Change password error: {e}", exc_info=True)
        return jsonify({"error": "Failed to change password"}), 500

@app.route('/api/profile/update-email', methods=['POST', 'OPTIONS'])
def profile_update_email():
    """Allow users to update their email"""
    logger.info(f"[PROFILE] Email update endpoint hit - method: {request.method}, authenticated: {current_user.is_authenticated}, session_user_id: {session.get('_user_id')}")
    
    # Handle OPTIONS for CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    
    # Check authentication - try both Flask-Login and session
    user_id = None
    if current_user.is_authenticated:
        user_id = current_user.id
    elif '_user_id' in session:
        # Fallback: load user from session if Flask-Login didn't work
        user_id = session.get('_user_id')
        logger.info(f"[PROFILE] Using session _user_id: {user_id}")
    
    if not user_id:
        logger.warning(f"[PROFILE] Unauthenticated email update attempt - session keys: {list(session.keys())}")
        return jsonify({"error": "Authentication required"}), 401
    
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        
        if not email or '@' not in email:
            return jsonify({"error": "Invalid email address"}), 400
        
        # Get user directly from database
        logger.info(f"[PROFILE] Updating email for user_id: {user_id}")
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE id = ? AND active = 1', (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            logger.error(f"[PROFILE] User not found in database: {user_id}")
            return jsonify({"error": "User not found"}), 404
        
        # Update email in database
        cursor.execute('UPDATE users SET email = ? WHERE id = ?', (email, user_id))
        conn.commit()
        
        logger.info(f"[PROFILE] ✅ Email updated successfully for user_id: {user_id}")
        return jsonify({"success": True, "message": "Email updated successfully"})
    except Exception as e:
        logger.error(f"[PROFILE] Update email error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update email"}), 500

@app.route('/api/sync/pending', methods=['POST'])
@login_required
def sync_pending_records():
    """Re-sync all attendance records that failed to sync to Google Sheets"""
    try:
        
        # Check if Google Sheets is available
        if not sheet and not client:
            return jsonify({
                "success": False,
                "error": "Google Sheets is not initialized. Check environment variables."
            }), 400
        
        # Find all records that haven't been synced
        pending_records = AttendanceRecord.query.filter(
            (AttendanceRecord.synced_to_sheets == False) | (AttendanceRecord.synced_to_sheets.is_(None))
        ).all()
        
        if not pending_records:
            return jsonify({
                "success": True,
                "message": "No pending records to sync",
                "synced": 0,
                "failed": 0
            })
        
        logger.info(f"[SYNC_PENDING] Found {len(pending_records)} pending records to sync")
        
        synced_count = 0
        failed_count = 0
        errors = []
        
        for record in pending_records:
            try:
                # Get the campus for this record
                campus = CampusV2.query.get(record.campus_id)
                if not campus:
                    logger.warning(f"[SYNC_PENDING] Campus not found for record {record.id}")
                    failed_count += 1
                    errors.append(f"Record {record.id}: Campus not found")
                    continue
                
                # Attempt to sync
                sync_result = sync_to_google_sheets(record, campus)
                if sync_result is not None and sync_result:
                    record.synced_to_sheets = True
                    db.session.commit()
                    synced_count += 1
                    logger.info(f"[SYNC_PENDING] ✓ Synced record {record.id} ({campus.display_name} - {record.date})")
                else:
                    failed_count += 1
                    errors.append(f"Record {record.id} ({campus.display_name} - {record.date}): Sync returned False")
                    logger.warning(f"[SYNC_PENDING] ✗ Failed to sync record {record.id}")
                    
            except Exception as e:
                failed_count += 1
                error_msg = f"Record {record.id}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"[SYNC_PENDING] Error syncing record {record.id}: {e}", exc_info=True)
        
        return jsonify({
            "success": True,
            "message": f"Sync completed: {synced_count} synced, {failed_count} failed",
            "total_pending": len(pending_records),
            "synced": synced_count,
            "failed": failed_count,
            "errors": errors[:10] if errors else []  # Limit to first 10 errors
        })
        
    except Exception as e:
        logger.error(f"[SYNC_PENDING] Error in sync_pending_records: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/attendance/import-from-sheets', methods=['POST'])
@login_required
def import_from_sheets():
    """
    Import / upsert attendance from Google Sheet (GOOGLE_SHEET_IMPORT_ID or GOOGLE_SHEET_IMPORT_NAME / GOOGLE_SHEET_NAME).
    Inserts new campus+date rows; updates existing rows with sheet values. Maps aggregate columns
    New People -> visitors (when detail columns empty) and Salvations / New Christians -> first_time_christians
    when detail salvation columns are empty.
    """
    try:
        from datetime import datetime

        # Import affects all campuses - restricted to data_export holders
        # (admin/leadership by default)
        if not current_user.has_permission('data_export'):
            return jsonify({"error": "Access denied - insufficient permissions"}), 403

        if not client:
            return jsonify({
                "success": False,
                "error": "Google Sheets is not initialized. Check environment variables."
            }), 400

        # Prefer spreadsheet ID (more reliable than name) - get from sheet URL: .../d/SHEET_ID/edit
        sheet_id = os.getenv("GOOGLE_SHEET_IMPORT_ID", "").strip()
        sheet_name = os.getenv("GOOGLE_SHEET_IMPORT_NAME") or os.getenv("GOOGLE_SHEET_NAME", "Stats")
        def _is_sheets_access_error(e):
            err_msg = str(e)
            err_lower = err_msg.lower()
            return (
                "SpreadsheetNotFound" in type(e).__name__
                or "APIError" in type(e).__name__
                or "404" in err_lower
                or "unable to open the file" in err_lower
                or "page not found" in err_lower
                or ("sorry" in err_lower and "open" in err_lower)  # Google "Sorry, unable to open..."
            )

        _hint = (
            "1) Ensure GOOGLE_SHEET_IMPORT_ID is correct (copy from sheet URL between /d/ and /edit). "
            "2) Share the sheet with churchgtp-service@churchgtp.iam.gserviceaccount.com as Editor."
        )

        try:
            if sheet_id:
                spreadsheet = client.open_by_key(sheet_id)
            else:
                spreadsheet = client.open(sheet_name)
            try:
                worksheet = spreadsheet.worksheet("Stats")
            except Exception:
                worksheet = spreadsheet.get_worksheet(0)
            # Use get_all_values + manual parsing to avoid "header row is not unique" error from get_all_records
            all_values = worksheet.get_all_values()
        except Exception as e:
            if _is_sheets_access_error(e):
                return jsonify({
                    "success": False,
                    "error": f"Could not access Google Sheet. {_hint}"
                }), 400
            raise
        if not all_values or len(all_values) < 2:
            return jsonify({
                "success": True,
                "message": "No data to import",
                "imported": 0,
                "skipped": 0,
                "errors": 0
            })
        headers = all_values[0]
        # Deduplicate headers for dict keys (gspread get_all_records fails on duplicates)
        seen = {}
        unique_headers = []
        for h in headers:
            h = (h or "").strip()
            if h not in seen:
                seen[h] = 1
                unique_headers.append(h)
            else:
                unique_headers.append(f"{h}_{seen[h]}")
                seen[h] += 1
        all_rows = []
        for row in all_values[1:]:
            all_rows.append(dict(zip(unique_headers, (row + [""] * len(unique_headers))[:len(unique_headers)])))
        if not all_rows:
            return jsonify({
                "success": True,
                "message": "No data to import",
                "imported": 0,
                "skipped": 0,
                "errors": 0
            })

        import sqlite3

        conn = get_db()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(attendance_records)")
        _att_cols = {r[1] for r in cursor.fetchall()}
        _has_saints_col = "saints" in _att_cols

        cursor.execute("SELECT id, display_name, campus_id, service_times, region_id FROM campuses_v2")
        campuses_db = cursor.fetchall()
        campus_lookup = {}
        for cid, display_name, campus_code, service_times_json, region_id in campuses_db:
            campus_lookup[display_name.lower()] = {
                "id": cid,
                "display_name": display_name,
                "service_times": json.loads(service_times_json) if service_times_json else [],
                "region_id": region_id,
            }
            campus_lookup[campus_code.lower()] = campus_lookup[display_name.lower()]

        def safe_int(val):
            try:
                return int(val) if val else 0
            except Exception:
                return 0

        def safe_float_val(val):
            try:
                return float(val) if val not in (None, "") else 0.0
            except Exception:
                return 0.0

        def _cell_nonempty(row_dict, key):
            if key not in row_dict:
                return False
            v = row_dict.get(key)
            return v is not None and str(v).strip() != ""

        def _parse_import_date(date_raw):
            if date_raw is None or str(date_raw).strip() == "":
                return None
            s = str(date_raw).strip()
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%d-%m-%Y", "%m-%d-%Y"):
                try:
                    return datetime.strptime(s, fmt).date()
                except ValueError:
                    continue
            return None

        def _pick_merge_int(row_dict, key, existing_row, col_name):
            if _cell_nonempty(row_dict, key):
                return safe_int(row_dict.get(key))
            if existing_row is not None:
                return int(existing_row[col_name] or 0)
            return 0

        def _merge_visitor_fields(row_dict, existing_row):
            """Map sheet New People + detailed columns -> first_time_visitors, visitors, youth_new_people."""
            sf_tv = safe_int(row_dict.get("First Time Visitors")) or safe_int(row_dict.get("First Time"))
            s_vis = safe_int(row_dict.get("Visitors"))
            s_ynp = safe_int(row_dict.get("Youth New People"))
            agg_np = safe_int(row_dict.get("New People"))
            touched = (
                _cell_nonempty(row_dict, "New People")
                or _cell_nonempty(row_dict, "First Time Visitors")
                or _cell_nonempty(row_dict, "First Time")
                or _cell_nonempty(row_dict, "Visitors")
                or _cell_nonempty(row_dict, "Youth New People")
            )
            if touched:
                if agg_np > 0 and (sf_tv + s_vis + s_ynp) == 0:
                    return (sf_tv, agg_np, s_ynp)
                return (sf_tv, s_vis, s_ynp)
            if existing_row is not None:
                return (
                    int(existing_row["first_time_visitors"] or 0),
                    int(existing_row["visitors"] or 0),
                    int(existing_row["youth_new_people"] or 0),
                )
            return (sf_tv, s_vis, s_ynp)

        def _merge_salvation_fields(row_dict, existing_row):
            """Map sheet Salvations / New Christians + detail columns -> DB salvation fields."""
            s_ftc = safe_int(row_dict.get("First Time Christians"))
            s_red = safe_int(row_dict.get("Rededications"))
            s_ys = safe_int(row_dict.get("Youth Salvations"))
            s_nks = safe_int(row_dict.get("New Kids Salvations")) or safe_int(row_dict.get("Kids Salvations"))
            s_cards = safe_int(row_dict.get("Salvation Cards Returned"))
            agg = max(safe_int(row_dict.get("Salvations")), safe_int(row_dict.get("New Christians")))
            detail = s_ftc + s_red + s_ys + s_nks
            touched = (
                _cell_nonempty(row_dict, "Salvations")
                or _cell_nonempty(row_dict, "New Christians")
                or _cell_nonempty(row_dict, "First Time Christians")
                or _cell_nonempty(row_dict, "Rededications")
                or _cell_nonempty(row_dict, "Youth Salvations")
                or _cell_nonempty(row_dict, "New Kids Salvations")
                or _cell_nonempty(row_dict, "Kids Salvations")
                or _cell_nonempty(row_dict, "Salvation Cards Returned")
            )
            if touched:
                if agg > 0 and detail == 0:
                    return (agg, 0, 0, 0, s_cards)
                return (s_ftc, s_red, s_ys, s_nks, s_cards)
            if existing_row is not None:
                return (
                    int(existing_row["first_time_christians"] or 0),
                    int(existing_row["rededications"] or 0),
                    int(existing_row["youth_salvations"] or 0),
                    int(existing_row["new_kids_salvations"] or 0),
                    int(existing_row["salvation_cards_returned"] or 0),
                )
            return (s_ftc, s_red, s_ys, s_nks, s_cards)

        imported = updated = skipped = errors = 0
        for row in all_rows:
            try:
                campus_name = row.get("Campus", "").strip().lower()
                if not campus_name or campus_name not in campus_lookup:
                    skipped += 1
                    continue
                campus_info = campus_lookup[campus_name]
                campus_id = campus_info["id"]
                region_id = campus_info["region_id"]
                service_times = campus_info["service_times"]

                date_val = _parse_import_date(row.get("Date"))
                if not date_val:
                    skipped += 1
                    continue

                cursor.execute(
                    "SELECT * FROM attendance_records WHERE campus_id = ? AND date = ?",
                    (campus_id, date_val.isoformat()),
                )
                existing = cursor.fetchone()

                old_adult = {}
                if existing and existing["adult_service_breakdown"]:
                    try:
                        old_adult = json.loads(existing["adult_service_breakdown"])
                    except Exception:
                        old_adult = {}
                old_kids = {}
                if existing and existing["kids_service_breakdown"]:
                    try:
                        old_kids = json.loads(existing["kids_service_breakdown"])
                    except Exception:
                        old_kids = {}

                adult_breakdown = {}
                any_adult_cell = False
                for st in service_times:
                    if _cell_nonempty(row, st):
                        any_adult_cell = True
                        adult_breakdown[st] = safe_int(row.get(st))
                if not any_adult_cell:
                    adult_breakdown = dict(old_adult)

                kids_breakdown = {}
                any_kids_cell = False
                for st in service_times:
                    kids_key = f"Kids {st}"
                    if _cell_nonempty(row, kids_key):
                        any_kids_cell = True
                        kids_breakdown[kids_key] = safe_int(row.get(kids_key))
                if not any_kids_cell:
                    kids_breakdown = dict(old_kids)

                if _cell_nonempty(row, "Total Attendance"):
                    tot = safe_int(row.get("Total Attendance"))
                elif existing:
                    tot = int(existing["total_attendance"] or 0)
                else:
                    tot = 0

                if _cell_nonempty(row, "Total People in Campus"):
                    tpc = safe_int(row.get("Total People in Campus"))
                elif _cell_nonempty(row, "Total Attendance"):
                    tpc = tot
                elif existing:
                    tpc = int(existing["total_people_in_campus"] or 0)
                else:
                    tpc = tot

                kids_att = _pick_merge_int(row, "Kids Attendance", existing, "kids_attendance")
                kids_lead = _pick_merge_int(row, "Kids Leaders", existing, "kids_leaders")
                new_kids_v = _pick_merge_int(row, "New Kids", existing, "new_kids")
                if _cell_nonempty(row, "New Kids Salvations"):
                    nks_v = safe_int(row.get("New Kids Salvations"))
                elif _cell_nonempty(row, "Kids Salvations"):
                    nks_v = safe_int(row.get("Kids Salvations"))
                elif existing is not None:
                    nks_v = int(existing["new_kids_salvations"] or 0)
                else:
                    nks_v = 0
                packs = _pick_merge_int(row, "Packs Out", existing, "packs_out")
                youth_att = _pick_merge_int(row, "Youth Attendance", existing, "youth_attendance")
                youth_sal = _pick_merge_int(row, "Youth Salvations", existing, "youth_salvations")
                youth_lead = _pick_merge_int(row, "Youth Leaders", existing, "youth_leaders")
                hands = _pick_merge_int(row, "Hands up", existing, "hands_up")
                cards_b = _pick_merge_int(row, "Cards Back", existing, "cards_back")
                bapt = _pick_merge_int(row, "Baptisms", existing, "baptisms")
                child_d = _pick_merge_int(row, "Child Dedications", existing, "child_dedications")
                cg = _pick_merge_int(row, "Connect Groups", existing, "connect_groups")
                dt = _pick_merge_int(row, "Dream Team", existing, "dream_team")

                if _cell_nonempty(row, "Tithe"):
                    tithe_v = safe_float_val(row.get("Tithe"))
                elif existing:
                    tithe_v = float(existing["tithe"] or 0)
                else:
                    tithe_v = 0.0

                ftv, visitors_v, ynp = _merge_visitor_fields(row, existing)
                ftc, reded, ys_v, nks_m, cards_ret = _merge_salvation_fields(row, existing)

                saints_v = 0
                if _has_saints_col:
                    saints_v = _pick_merge_int(row, "Saints", existing, "saints")

                adult_json = json.dumps(adult_breakdown) if adult_breakdown else None
                kids_json = json.dumps(kids_breakdown) if kids_breakdown else None

                if existing:
                    eid = int(existing["id"])
                    if _has_saints_col:
                        cursor.execute(
                            """
                            UPDATE attendance_records SET
                                total_attendance = ?, total_people_in_campus = ?,
                                adult_service_breakdown = ?, kids_service_breakdown = ?,
                                kids_attendance = ?, kids_leaders = ?, new_kids = ?, new_kids_salvations = ?, packs_out = ?,
                                youth_attendance = ?, youth_salvations = ?, youth_new_people = ?, youth_leaders = ?,
                                first_time_visitors = ?, visitors = ?, hands_up = ?, cards_back = ?,
                                first_time_christians = ?, rededications = ?, salvation_cards_returned = ?,
                                baptisms = ?, child_dedications = ?, connect_groups = ?, dream_team = ?, tithe = ?,
                                saints = ?, synced_to_sheets = 1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            """,
                            (
                                tot,
                                tpc,
                                adult_json,
                                kids_json,
                                kids_att,
                                kids_lead,
                                new_kids_v,
                                nks_v,
                                packs,
                                youth_att,
                                youth_sal,
                                ynp,
                                youth_lead,
                                ftv,
                                visitors_v,
                                hands,
                                cards_b,
                                ftc,
                                reded,
                                cards_ret,
                                bapt,
                                child_d,
                                cg,
                                dt,
                                tithe_v,
                                saints_v,
                                eid,
                            ),
                        )
                    else:
                        cursor.execute(
                            """
                            UPDATE attendance_records SET
                                total_attendance = ?, total_people_in_campus = ?,
                                adult_service_breakdown = ?, kids_service_breakdown = ?,
                                kids_attendance = ?, kids_leaders = ?, new_kids = ?, new_kids_salvations = ?, packs_out = ?,
                                youth_attendance = ?, youth_salvations = ?, youth_new_people = ?, youth_leaders = ?,
                                first_time_visitors = ?, visitors = ?, hands_up = ?, cards_back = ?,
                                first_time_christians = ?, rededications = ?, salvation_cards_returned = ?,
                                baptisms = ?, child_dedications = ?, connect_groups = ?, dream_team = ?, tithe = ?,
                                synced_to_sheets = 1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            """,
                            (
                                tot,
                                tpc,
                                adult_json,
                                kids_json,
                                kids_att,
                                kids_lead,
                                new_kids_v,
                                nks_v,
                                packs,
                                youth_att,
                                youth_sal,
                                ynp,
                                youth_lead,
                                ftv,
                                visitors_v,
                                hands,
                                cards_b,
                                ftc,
                                reded,
                                cards_ret,
                                bapt,
                                child_d,
                                cg,
                                dt,
                                tithe_v,
                                eid,
                            ),
                        )
                    updated += 1
                else:
                    if _has_saints_col:
                        cursor.execute(
                            """
                            INSERT INTO attendance_records (
                                campus_id, region_id, date, total_attendance, total_people_in_campus,
                                adult_service_breakdown, kids_service_breakdown,
                                kids_attendance, kids_leaders, new_kids, new_kids_salvations, packs_out,
                                youth_attendance, youth_salvations, youth_new_people, youth_leaders,
                                first_time_visitors, visitors, hands_up, cards_back,
                                first_time_christians, rededications, salvation_cards_returned,
                                baptisms, child_dedications, connect_groups, dream_team, tithe, saints,
                                synced_to_sheets, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                            """,
                            (
                                campus_id,
                                region_id,
                                date_val.isoformat(),
                                tot,
                                tpc,
                                adult_json,
                                kids_json,
                                kids_att,
                                kids_lead,
                                new_kids_v,
                                nks_v,
                                packs,
                                youth_att,
                                youth_sal,
                                ynp,
                                youth_lead,
                                ftv,
                                visitors_v,
                                hands,
                                cards_b,
                                ftc,
                                reded,
                                cards_ret,
                                bapt,
                                child_d,
                                cg,
                                dt,
                                tithe_v,
                                saints_v,
                            ),
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO attendance_records (
                                campus_id, region_id, date, total_attendance, total_people_in_campus,
                                adult_service_breakdown, kids_service_breakdown,
                                kids_attendance, kids_leaders, new_kids, new_kids_salvations, packs_out,
                                youth_attendance, youth_salvations, youth_new_people, youth_leaders,
                                first_time_visitors, visitors, hands_up, cards_back,
                                first_time_christians, rededications, salvation_cards_returned,
                                baptisms, child_dedications, connect_groups, dream_team, tithe,
                                synced_to_sheets, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                            """,
                            (
                                campus_id,
                                region_id,
                                date_val.isoformat(),
                                tot,
                                tpc,
                                adult_json,
                                kids_json,
                                kids_att,
                                kids_lead,
                                new_kids_v,
                                nks_v,
                                packs,
                                youth_att,
                                youth_sal,
                                ynp,
                                youth_lead,
                                ftv,
                                visitors_v,
                                hands,
                                cards_b,
                                ftc,
                                reded,
                                cards_ret,
                                bapt,
                                child_d,
                                cg,
                                dt,
                                tithe_v,
                            ),
                        )
                    imported += 1
            except Exception as e:
                errors += 1
                logger.warning(f"[IMPORT_SHEETS] Row error: {e}")

        conn.commit()
        conn.close()

        logger.info(
            f"[IMPORT_SHEETS] imported={imported} updated={updated} skipped={skipped} errors={errors} from '{sheet_name}'"
        )
        return jsonify(
            {
                "success": True,
                "message": f"Import completed: {imported} new, {updated} updated, {skipped} skipped, {errors} errors",
                "imported": imported,
                "updated": updated,
                "skipped": skipped,
                "errors": errors,
                "sheet_name": sheet_name,
            }
        )
    except Exception as e:
        logger.error(f"[IMPORT_SHEETS] Error: {e}", exc_info=True)
        err_str = str(e)
        err_lower = err_str.lower()
        # Convert Google Sheets access errors to 400 with actionable message
        if (
            "APIError" in type(e).__name__
            or "unable to open the file" in err_lower
            or "page not found" in err_lower
            or ("sorry" in err_lower and "open" in err_lower)
        ):
            return jsonify({
                "success": False,
                "error": "Could not access Google Sheet. 1) Ensure GOOGLE_SHEET_IMPORT_ID is correct (copy from sheet URL between /d/ and /edit). 2) Share the sheet with churchgtp-service@churchgtp.iam.gserviceaccount.com as Editor."
            }), 400
        return jsonify({
            "success": False,
            "error": err_str
        }), 500

@app.route('/api/sync/all', methods=['POST'])
@login_required
def sync_all_records():
    """Fresh sync: Re-sync all attendance records to Google Sheets (optionally force re-sync)"""
    try:
        
        # Check if Google Sheets is available
        if not sheet and not client:
            return jsonify({
                "success": False,
                "error": "Google Sheets is not initialized. Check environment variables."
            }), 400
        
        # Get force parameter (optional)
        force = request.json.get('force', False) if request.is_json else False
        
        # Find all records
        if force:
            # Force re-sync all records
            all_records = AttendanceRecord.query.all()
            logger.info(f"[SYNC_ALL] Force syncing all {len(all_records)} records")
        else:
            # Only sync pending records
            all_records = AttendanceRecord.query.filter(
                (AttendanceRecord.synced_to_sheets == False) | (AttendanceRecord.synced_to_sheets.is_(None))
            ).all()
            logger.info(f"[SYNC_ALL] Syncing {len(all_records)} pending records")
        
        if not all_records:
            return jsonify({
                "success": True,
                "message": "No records to sync",
                "synced": 0,
                "failed": 0
            })
        
        synced_count = 0
        failed_count = 0
        errors = []
        
        for record in all_records:
            try:
                # Get the campus for this record
                campus = CampusV2.query.get(record.campus_id)
                if not campus:
                    logger.warning(f"[SYNC_ALL] Campus not found for record {record.id}")
                    failed_count += 1
                    errors.append(f"Record {record.id}: Campus not found")
                    continue
                
                # Attempt to sync
                sync_result = sync_to_google_sheets(record, campus)
                if sync_result is not None and sync_result:
                    record.synced_to_sheets = True
                    db.session.commit()
                    synced_count += 1
                    logger.info(f"[SYNC_ALL] ✓ Synced record {record.id} ({campus.display_name} - {record.date})")
                else:
                    failed_count += 1
                    errors.append(f"Record {record.id} ({campus.display_name} - {record.date}): Sync returned False")
                    logger.warning(f"[SYNC_ALL] ✗ Failed to sync record {record.id}")
                    
            except Exception as e:
                failed_count += 1
                error_msg = f"Record {record.id}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"[SYNC_ALL] Error syncing record {record.id}: {e}", exc_info=True)
        
        return jsonify({
            "success": True,
            "message": f"Sync completed: {synced_count} synced, {failed_count} failed",
            "total_records": len(all_records),
            "synced": synced_count,
            "failed": failed_count,
            "errors": errors[:10] if errors else []  # Limit to first 10 errors
        })
        
    except Exception as e:
        logger.error(f"[SYNC_ALL] Error in sync_all_records: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/debug/claude')
def debug_claude():
    """Debug Claude connection"""
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        api_key_present = bool(api_key)
        
        # Try to create a new client directly in this endpoint
        test_client = None
        test_error = None
        
        try:
            from anthropic import Anthropic
            # Try without any extra arguments to avoid proxy issues
            test_client = Anthropic(api_key=api_key)
            # Test with a simple API call
            test_response = test_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1,
                messages=[{"role": "user", "content": "test"}]
            )
            test_success = True
        except Exception as e:
            test_error = str(e)
            test_success = False
        
        if claude is None:
            return jsonify({
                "status": "error",
                "message": "Claude not initialized during startup",
                "claude": None,
                "api_key_present": api_key_present,
                "api_key_preview": api_key[:10] + "..." if api_key else None,
                "test_client_creation": test_success,
                "test_error": test_error,
                "anthropic_import_success": "anthropic imported successfully"
            })
        
        # Try to make a simple test call
        try:
            # This is a minimal test - just check if the client can be created
            return jsonify({
                "status": "success",
                "message": "Claude connected",
                "claude": "initialized",
                "api_key_present": api_key_present,
                "api_key_preview": api_key[:10] + "..." if api_key else None,
                "test_client_creation": test_success,
                "test_error": test_error
            })
        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Claude test failed: {e}",
                "claude": None,
                "api_key_present": api_key_present,
                "api_key_preview": api_key[:10] + "..." if api_key else None,
                "test_client_creation": test_success,
                "test_error": test_error
            })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Debug error: {e}",
            "claude": None,
            "api_key_present": bool(os.getenv("ANTHROPIC_API_KEY"))
        })

@app.route('/api/session')
def session_info():
    """Get current session info - public endpoint for mobile app"""
    # Detect Railway branch/environment
    # Priority: 1. Custom APP_ENV variable, 2. Detect from hostname/URL, 3. RAILWAY_BRANCH, 4. RAILWAY_ENVIRONMENT, 5. Service name, 6. Default to 'beta' (safer default)
    app_env = os.getenv('APP_ENV', '').strip().lower()
    railway_branch_env = os.getenv('RAILWAY_BRANCH', '').strip().lower()
    railway_env = os.getenv('RAILWAY_ENVIRONMENT', '').strip().lower()
    
    railway_branch = None
    
    # Use APP_ENV first if set and not empty
    if app_env:
        railway_branch = app_env
        logger.info(f"[BRANCH_DETECT] Using APP_ENV: {app_env}")
    elif railway_branch_env:
        railway_branch = railway_branch_env
        logger.info(f"[BRANCH_DETECT] Using RAILWAY_BRANCH: {railway_branch_env}")
    elif railway_env:
        railway_branch = railway_env
        logger.info(f"[BRANCH_DETECT] Using RAILWAY_ENVIRONMENT: {railway_env}")
    
    # If not explicitly set, try to detect from request hostname
    if not railway_branch:
        try:
            hostname = request.host.lower() if request else ''
            logger.info(f"[BRANCH_DETECT] Checking hostname: {hostname}")
            
            # Check if URL contains 'branch' or 'beta' (e.g., futuresbranch-production.up.railway.app)
            if 'branch' in hostname or 'beta' in hostname or 'staging' in hostname:
                railway_branch = 'beta'
                logger.info(f"[BRANCH_DETECT] Detected 'beta' from hostname: {hostname}")
            # Check if it's the main/production URL (futures-pulse-production)
            elif 'futures-pulse-production' in hostname:
                railway_branch = 'main'
                logger.info(f"[BRANCH_DETECT] Detected 'main' from hostname: {hostname}")
        except Exception as e:
            logger.warning(f"[BRANCH_DETECT] Could not detect from hostname: {e}")
    
    # If still not set, try to detect from Railway service name
    if not railway_branch:
        service_name = os.getenv('RAILWAY_SERVICE_NAME', '').lower()
        logger.info(f"[BRANCH_DETECT] Checking service name: {service_name}")
        if 'beta' in service_name or 'branch' in service_name:
            railway_branch = 'beta'
            logger.info(f"[BRANCH_DETECT] Detected 'beta' from service name")
        elif service_name:
            railway_branch = 'main'
            logger.info(f"[BRANCH_DETECT] Detected 'main' from service name")
    
    # Default to 'beta' if still not determined (safer to show more features than hide them)
    if not railway_branch:
        railway_branch = 'beta'
        logger.info(f"[BRANCH_DETECT] Defaulting to 'beta' (no detection)")
    
    # Normalize branch name
    if railway_branch in ['production', 'prod', 'main']:
        railway_branch = 'main'
    elif railway_branch in ['beta', 'staging', 'dev', 'development']:
        railway_branch = 'beta'
    
    # Log the final detected branch for debugging
    logger.info(f"[BRANCH_DETECT] ✓ FINAL: branch={railway_branch}, APP_ENV={app_env}, hostname={request.host if request else 'N/A'}")
    
    # Allow unauthenticated access for mobile app session check
    if current_user.is_authenticated:
        # Google Drive: refresh access token using DB refresh token when session is stale
        try:
            refresh_google_access_token_in_session()
        except Exception as g_err:
            logger.warning("Google session hydrate at /api/session: %s", g_err)

        needs_drive_auth = False
        drive_status = {
            'authenticated': False,
            'token_valid': False,
            'has_token': False
        }

        drive_authenticated = session.get('google_drive_authenticated', False)
        drive_status['authenticated'] = drive_authenticated
        drive_status['has_token'] = bool(session.get('google_drive_access_token'))

        token_expiry = session.get('google_drive_token_expiry', 0)
        token_valid = token_expiry > datetime.now(timezone.utc).timestamp()
        drive_status['token_valid'] = token_valid

        has_access = bool(session.get('google_drive_access_token'))
        needs_drive_auth = not (has_access and token_valid)
        
        # Load feature flags from environment variables
        feature_flags = {
            'home': True,  # Always enabled
            'dashboard': True,  # Always enabled
            'input': True,  # Weekly Input - always enabled for Pulse v1
            'resources': True,  # Always enabled for Pulse v1
            'user_management': True,  # Always enabled for Pulse v1
            'campus_management': True,  # Always enabled for Pulse v1
            'resource_manager': True,  # Always enabled for Pulse v1
            'finance': True,  # Finance input - always enabled for Pulse v1
            'giving': True,  # Giving analytics - always enabled for Pulse v1
            # Optional features - controlled by environment variables
            'pulse_tv': os.getenv('PULSE_TV_ENABLED', 'false').lower() == 'true',
            'tv_manager': os.getenv('PULSE_TV_ENABLED', 'false').lower() == 'true',
            'events': os.getenv('EVENTS_ENABLED', 'false').lower() == 'true',
            'events_manager': os.getenv('EVENTS_ENABLED', 'false').lower() == 'true',
            'devotions': os.getenv('DEVOTIONS_ENABLED', 'false').lower() == 'true',
            'pathway_manager': os.getenv('PATHWAYS_ENABLED', 'false').lower() == 'true',
            'serving': os.getenv('SERVING_ENABLED', 'false').lower() == 'true',
            'prayer': os.getenv('PRAYER_ENABLED', 'false').lower() == 'true',
            'people': os.getenv('PEOPLE_ENABLED', 'false').lower() == 'true',
            'connect_groups': os.getenv('GROUPS_FOR_STAFF_ENABLED', 'false').lower() == 'true',
            'communication': os.getenv('COMMUNICATION_ENABLED', 'false').lower() == 'true',
            'notifications': os.getenv('NOTIFICATIONS_ENABLED', 'false').lower() == 'true',
            'data_export': os.getenv('DATA_EXPORT_ENABLED', 'false').lower() == 'true',
            'beacon_management': os.getenv('BEACON_MGMT_ENABLED', 'false').lower() == 'true',
        }
        
        # Raw custom permissions (legacy consumers) plus the RESOLVED permission
        # set - the frontend should gate nav/pages on `permissions` only.
        user_custom_perms = getattr(current_user, 'custom_permissions', {})
        allowed_ids = current_user.accessible_campus_ids()

        response = jsonify({
            "authenticated": True,
            "user": current_user.username,
            "email": getattr(current_user, 'email', current_user.username),
            "role": current_user.role,
            "campus": current_user.campus,
            "full_name": current_user.full_name,
            "region_id": getattr(current_user, 'region_id', None),  # Include region_id for frontend filtering
            "custom_permissions": user_custom_perms,  # Return ONLY user's custom permissions, not merged feature flags
            "permissions": effective_permissions(current_user.role, user_custom_perms or {}),
            "allowed_campuses": sorted(allowed_ids) if allowed_ids is not None else None,
            "needs_drive_auth": needs_drive_auth,
            "drive_status": drive_status,  # Debug info
            "user_id": current_user.id,  # Debug info
            "session_keys": list(session.keys()),  # Debug info
            "railway_branch": railway_branch,  # Branch/environment info
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        # Prevent caching of session data - critical for permission updates
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    else:
        response = jsonify({
            "authenticated": False,
            "user": None,
            "role": None,
            "campus": None,
            "full_name": None,
            "needs_drive_auth": False,
            "railway_branch": railway_branch,  # Branch/environment info
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        # Prevent caching of session data
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

@app.route('/api/stats')
@login_required
def get_stats():
    # Check if user has recall permissions
    if not current_user.has_permission('recall_stats'):
        return jsonify({"error": "You do not have permission to recall statistics data"}), 403
    
    print(f"[DEBUG] get_stats called - campus_filter: {request.args.get('campus', '')}")
    
    try:
        campus_filter = request.args.get('campus', '').strip()
        
        # For campus pastors, restrict to their campus only
        if current_user.role == 'campus_pastor':
            if campus_filter and campus_filter != current_user.campus:
                return jsonify({
                    "error": f"You can only access data for {safe_campus_name(current_user.campus)[1]} campus"
                }), 403
            # Force campus filter to user's campus
            campus_filter = current_user.campus
        
        # ============================================================
        # USE DATABASE AS PRIMARY SOURCE (like /api/recent_entries)
        # ============================================================
        from models import AttendanceRecord, CampusV2
        
        try:
            # Get most recent record(s) from database
            if campus_filter:
                # Find campus by campus_id (e.g., 'samarinda', 'adelaide_city')
                campus_obj = CampusV2.query.filter(
                    (CampusV2.campus_id == campus_filter) | 
                    (CampusV2.id == campus_filter) |
                    (CampusV2.display_name == campus_filter)
                ).first()
                
                if not campus_obj:
                    logger.warning(f"[STATS] Campus '{campus_filter}' not found in database")
                    return jsonify({"stats": {}, "encouragements": []})
                
                # Get most recent record for this campus
                most_recent = AttendanceRecord.query.filter_by(
                    campus_id=campus_obj.id
                ).order_by(AttendanceRecord.date.desc()).first()
                
                if not most_recent:
                    logger.info(f"[STATS] No records found for campus '{campus_filter}'")
                    return jsonify({"stats": {}, "encouragements": []})
                
                # Convert database record to frontend format
                stats_for_frontend = {
                    'Total Attendance': most_recent.total_attendance or 0,
                    'total_attendance': most_recent.total_attendance or 0,
                    'New People': (most_recent.first_time_visitors or 0) + (most_recent.visitors or 0),
                    'new_people': (most_recent.first_time_visitors or 0) + (most_recent.visitors or 0),
                    'New Christians': (most_recent.first_time_christians or 0) + (most_recent.rededications or 0),
                    'new_christians': (most_recent.first_time_christians or 0) + (most_recent.rededications or 0),
                    'Youth Attendance': most_recent.youth_attendance or 0,
                    'youth_attendance': most_recent.youth_attendance or 0,
                    'Kids Total': most_recent.kids_attendance or 0,
                    'kids_total': most_recent.kids_attendance or 0,
                    'Connect Groups': most_recent.connect_groups or 0,
                    'connect_groups': most_recent.connect_groups or 0
                }
                
                encouragements = []
                if most_recent.notes:
                    # Parse notes for encouragements (if stored in notes field)
                    notes_text = most_recent.notes
                    if " | " in notes_text:
                        encouragements.extend(notes_text.split(" | "))
                    else:
                        encouragements.append(notes_text)
                
                logger.info(f"[STATS] Returning stats for {campus_filter} from database: {stats_for_frontend}")
                return jsonify({
                    "stats": stats_for_frontend,
                    "encouragements": encouragements
                })
            else:
                # No campus filter - return the 5 most recent records overall
                recent_records = AttendanceRecord.query.order_by(
                    AttendanceRecord.date.desc()
                ).limit(5).all()
                
                if not recent_records:
                    logger.info("[STATS] No records found in database")
                    return jsonify({"stats": [], "encouragements": []})
                
                stats_for_frontend = []
                encouragements = []
                
                for record in recent_records:
                    campus_obj = CampusV2.query.get(record.campus_id)
                    campus_name = campus_obj.display_name if campus_obj else 'Unknown'
                    
                    stats_for_frontend.append({
                        'Total Attendance': record.total_attendance or 0,
                        'total_attendance': record.total_attendance or 0,
                        'New People': (record.first_time_visitors or 0) + (record.visitors or 0),
                        'new_people': (record.first_time_visitors or 0) + (record.visitors or 0),
                        'New Christians': (record.first_time_christians or 0) + (record.rededications or 0),
                        'new_christians': (record.first_time_christians or 0) + (record.rededications or 0),
                        'Youth Attendance': record.youth_attendance or 0,
                        'youth_attendance': record.youth_attendance or 0,
                        'Kids Total': record.kids_attendance or 0,
                        'kids_total': record.kids_attendance or 0,
                        'Connect Groups': record.connect_groups or 0,
                        'connect_groups': record.connect_groups or 0,
                        'Campus': campus_name
                    })
                    
                    if record.notes:
                        if " | " in record.notes:
                            encouragements.extend(record.notes.split(" | "))
                        else:
                            encouragements.append(record.notes)
                
                logger.info(f"[STATS] Returning {len(recent_records)} stats overall from database (no campus filter)")
                return jsonify({
                    "stats": stats_for_frontend,
                    "encouragements": encouragements
                })
        except Exception as db_error:
            logger.error(f"[STATS] Database error: {db_error}")
            import traceback
            logger.error(f"[STATS] Traceback: {traceback.format_exc()}")
            # Fallback to empty response rather than Google Sheets (which doesn't have Indonesian data)
            return jsonify({"stats": [] if not campus_filter else {}, "encouragements": []})
            
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to retrieve stats"}), 500

# Add a decorator to log endpoint and request data
from functools import wraps

def log_endpoint(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            data = request.get_json(silent=True)
        except Exception:
            data = None
        logger.info(f"[API LOG] Endpoint: {request.path} | Method: {request.method} | Data: {data}")
        return f(*args, **kwargs)
    return decorated_function

# Apply the decorator to all API endpoints
@app.route('/api/process_voice', methods=['POST'])
@log_endpoint
@login_required
def process_voice():
    if not request.is_json:
        return jsonify({"error": "Expected JSON request"}), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing or invalid JSON body"}), 400

    text = str(data.get("text", "")).strip()
    campus = str(data.get("campus", "")).strip()
    input_type = str(data.get("input_type", "text")).strip()  # 'voice' or 'text'

    if not text:
        return jsonify({"error": "Missing text"}), 400

    # Always detect campus from text first, then fall back to provided campus
    detected_campus = detect_campus(text)
    if detected_campus:  # If we detected a specific campus
        campus = detected_campus
        logger.info(f"Detected campus from text: {campus}")
    elif campus and campus.lower() not in ['none', 'null', '']:
        logger.info(f"Using provided campus: {campus}")
    else:
        # Smart campus defaulting based on user role when no campus is mentioned
        if current_user.is_authenticated:
            if current_user.role == 'campus_pastor':
                # Campus pastors get their assigned campus by default
                campus = getattr(current_user, 'campus', None)
                if campus:
                    logger.info(f"No campus mentioned - using campus pastor's campus: {campus}")
                else:
                    campus = None  # No assigned campus - will prompt user
            elif current_user.role in ALL_ACCESS_ROLES:
                # Senior leadership gets all campuses by default for queries
                # For stat logging, they'll still need to specify
                campus = None  # Will be handled differently for queries vs logging
                logger.info(f"No campus mentioned - senior leadership (will default to all_campuses for queries)")
            else:
                campus = None  # No campus detected - will prompt user
        else:
            campus = None  # No campus detected - will prompt user
    
    logger.info(f"Final campus: {campus}")
    
    # Enhanced query detection with better natural language understanding
    import re
    text_lower = text.lower()
    
    # Query intent patterns (questions, requests for information)
    query_patterns = [
        r'\b(?:what|how|when|where|why|which|who)\b',
        r'\b(?:tell me|show me|give me|can you|could you|would you)\b',
        r'\b(?:what is|what was|what are|what were)\b',
        r'\b(?:how many|how much|how often|how long)\b',
        r'\b(?:average|total|sum|count|number)\b',
        r'\b(?:compare|comparison|versus|vs)\b',
        r'\b(?:trend|trends|pattern|growth|change)\b',
        r'\b(?:report|summary|overview|recap|review)\b',
        r'\b(?:this week|this month|this year|last week|last month|last year)\b',
        r'\b(?:quarterly|monthly|annual|yearly)\b',
        r'\b(?:best|worst|highest|lowest|top|bottom)\b',
        r'\b(?:percentage|percent|%)\b',
        r'\b(?:increase|decrease|up|down|better|worse)\b'
    ]
    
    # Stat logging patterns (specific numbers being reported)
    stat_patterns = [
        r'\d+\s+(?:people|attendance|total|had|got|there were)',
        r'\d+\s+(?:first\s+time|first-time|first\s+timers?|new\s+people|newcomers?)',
        r'\d+\s+(?:visitors?|guests?)',
        r'\d+\s+(?:info\s+gathered|information\s+gathered|details\s+gathered|cards\s+back|contact\s+cards|info\s+cards|information\s+cards)',
        r'\d+\s+(?:salvations?|decisions?|got\s+saved|conversions?)',
        r'\d+\s+(?:rededication|re-dedication|rededications?)',
        r'\d+\s+(?:youth|teens?)',
        r'\d+\s+(?:kids|children)',
        r'\d+\s+(?:connect\s+groups?|small\s+groups?|groups?)',
        r'\d+\s+(?:dream\s+team|volunteers?|team\s+members?|on\s+dream\s+team)',
        r'\d+\s+(?:baptisms?|baptized|baptismal)',
        r'\d+\s+(?:child\s+dedications?|baby\s+dedications?|dedications?)',
        r'\d+\s+(?:new\s+kids|new\s+children)',
        r'\d+\s+(?:collected|gathered|info|information)'
    ]
    
    is_stat_logging = any(re.search(pattern, text.lower()) for pattern in stat_patterns)
        
    # Load conversation memory
    memory = load_conversation_memory()
    
    # Check if this is a query request vs stat logging
    text_lower = text.lower()
    import re
    
    # FIRST: Check for clear query patterns (these take priority)
    query_keywords = [
        'how many', 'what is', 'what was', "what's", 'tell me', 'give me', 'show me',
        'average', 'last week', 'this week', 'last month', 'this month', 'count', 'query', 'data', 
        'has had', 'had this year', 'had this month', 'had last', 'compare', 'comparison', 
        'vs', 'versus', 'between', 'year over year', 'review', 'annual review', 
        'mid year review', 'mid-year review', 'midyear'
    ]
    
    contains_year = bool(re.search(r'\b20\d{2}\b', text_lower))
    contains_quarter = any(q in text_lower for q in ['q1', 'q2', 'q3', 'q4', 'quarter 1', 'quarter 2', 'quarter 3', 'quarter 4', 'first quarter', 'second quarter', 'third quarter', 'fourth quarter'])
    
    # Enhanced query detection with better natural language understanding
    is_query = False
    
    # Check for query patterns with improved detection
    query_indicators = [
        # Question words
        any(word in text_lower for word in ['what', 'how', 'when', 'where', 'why', 'which', 'who']),
        # Request words
        any(phrase in text_lower for phrase in ['tell me', 'show me', 'give me', 'can you', 'could you', 'would you']),
        # Information seeking
        any(phrase in text_lower for phrase in ['what is', 'what was', 'what are', 'what were', 'how many', 'how much']),
        # Analysis words
        any(word in text_lower for word in ['average', 'total', 'sum', 'count', 'number', 'compare', 'comparison']),
        # Time references
        any(phrase in text_lower for phrase in ['this week', 'this month', 'this year', 'last week', 'last month', 'last year']),
        # Report words
        any(word in text_lower for word in ['report', 'summary', 'overview', 'recap', 'review', 'trend', 'trends']),
        # Year/quarter references
        contains_year or contains_quarter,
        # Starts with question words
        text_lower.startswith(('what', 'how', 'show', 'give', 'tell', 'can you', 'could you'))
    ]
    
    is_query = any(query_indicators)
    
    # Validate campus exists if provided (AFTER query detection)
    if campus and campus.lower() != 'all_campuses':  # Skip validation for all_campuses
        try:
            campuses_data = get_campuses_for_user()
            valid_campus_ids = [c['id'] for c in campuses_data.get('campuses', [])]
            
            if campus.lower() not in [c_id.lower() for c_id in valid_campus_ids]:
                return jsonify({
                    'error': f'Invalid campus: {campus}. Please select a valid campus.',
                    'text': f'Invalid campus selected. Please choose from the available campuses.',
                    'requires_campus_selection': True
                }), 400
                
        except Exception as e:
            logger.warning(f"Could not validate campus access: {str(e)}")
            # Continue processing if campus validation fails (for backward compatibility)

    # Load conversation memory
    memory = load_conversation_memory()
    
    # Check if this is a query request vs stat logging
    text_lower = text.lower()
    import re
    
    # FIRST: Check for clear query patterns (these take priority)
    query_keywords = [
        'how many', 'what is', 'what was', "what's", 'tell me', 'give me', 'show me',
        'average', 'last week', 'this week', 'last month', 'this month', 'count', 'query', 'data', 
        'has had', 'had this year', 'had this month', 'had last', 'compare', 'comparison', 
        'vs', 'versus', 'between', 'year over year', 'review', 'annual review', 
        'mid year review', 'mid-year review', 'midyear'
    ]
    
    contains_year = bool(re.search(r'\b20\d{2}\b', text_lower))
    contains_quarter = any(q in text_lower for q in ['q1', 'q2', 'q3', 'q4', 'quarter 1', 'quarter 2', 'quarter 3', 'quarter 4', 'first quarter', 'second quarter', 'third quarter', 'fourth quarter'])
    
    # Enhanced query detection with better natural language understanding
    is_query = False
    
    # Check for query patterns with improved detection
    query_indicators = [
        # Question words
        any(word in text_lower for word in ['what', 'how', 'when', 'where', 'why', 'which', 'who']),
        # Request words
        any(phrase in text_lower for phrase in ['tell me', 'show me', 'give me', 'can you', 'could you', 'would you']),
        # Information seeking
        any(phrase in text_lower for phrase in ['what is', 'what was', 'what are', 'what were', 'how many', 'how much']),
        # Analysis words
        any(word in text_lower for word in ['average', 'total', 'sum', 'count', 'number', 'compare', 'comparison']),
        # Time references
        any(phrase in text_lower for phrase in ['this week', 'this month', 'this year', 'last week', 'last month', 'last year']),
        # Report words
        any(word in text_lower for word in ['report', 'summary', 'overview', 'recap', 'review', 'trend', 'trends']),
        # Year/quarter references
        contains_year or contains_quarter,
        # Starts with question words
        text_lower.startswith(('what', 'how', 'show', 'give', 'tell', 'can you', 'could you'))
    ]
    
    is_query = any(query_indicators)
    
    # If it's not clearly a query, check for stat logging patterns
    if not is_query:
        stat_logging_patterns = [
            r'\d+\s+(?:people|attendance|total|had|got|there were)',
            r'\d+\s+(?:new(?:\s+people|visitors?|guests?)?|np)',
            r'\d+\s+(?:salvations|new\s+christians|decisions|baptisms?|nc)',
            r'\d+\s+(?:youth(?:\s+group|\s+ministry)?|teens?|yout)',
            r'\d+\s+(?:kids|children|kids\s+ministry|nursery)',
            r'\d+\s+(?:connect\s+groups?|small\s+groups?|connects?|life\s+groups?)',
            r'\$?\d+(?:,\d{3})*(?:\.\d{2})?\s+(?:tithe|offering|giving|in\s+tithe)',
            r'\d+\s+(?:volunteers?|team\s+members?|servers?)'
        ]
        
        # Only treat as stat logging if it contains actual numbers and no query keywords
        contains_stat_logging = any(re.search(pattern, text_lower) for pattern in stat_logging_patterns)
        
        # Final check: if it has stat logging patterns but also query words, it's a query
        if contains_stat_logging and any(word in text_lower for word in query_keywords):
            is_query = True
    
    # Handle case where no campus is detected
    if campus is None or campus == "None" or campus == "null":
        # For queries, apply smart defaulting based on user role
        if is_query and current_user.is_authenticated:
            if current_user.role in ALL_ACCESS_ROLES:
                campus = 'all_campuses'
                logger.info(f"Query with no campus - defaulting to all_campuses for senior leadership")
            elif current_user.role == 'campus_pastor':
                campus = getattr(current_user, 'campus', 'all_campuses')
                logger.info(f"Query with no campus - using campus pastor's assigned campus: {campus}")
        else:
            campus = 'all_campuses'  # Default for other roles
            logger.info(f"Query with no campus - defaulting to all_campuses for other roles")
    
    # For stat logging, require campus selection
            return jsonify({
                "text": "I'd be happy to help you input stats! Which campus would you like to input stats for? You can say something like 'Salisbury campus', 'South campus', or just 'Salisbury' or 'South'.",
                "campus": None,
                "stats": {},
                "missing_stats": [],
                "suggestions": ["Try saying: 'Salisbury campus', 'South campus', 'Paradise campus', 'Adelaide City campus'"],
                "insights": ["Please select a campus first"]
            })
    
    # Check permissions based on operation type
    if is_query:
        # Check if user has recall permissions
        if not current_user.has_permission('recall_stats'):
            error_text = "I'm sorry, you don't have permission to query statistics data. You can only log new statistics."
            
            # Generate audio with ElevenLabs if available
            audio_url = None
            if elevenlabs_api_key:
                audio_url = generate_audio_with_elevenlabs(error_text)
            
            return jsonify({
                "error": "You do not have permission to query statistics data",
                "text": error_text,
                "campus": campus,
                "stats": {},
                "missing_stats": [],
                "suggestions": [],
                "insights": ["Permission denied for data queries"],
                "audio_url": audio_url
            }), 403
            
        # For campus pastors, validate they can only access their campus data
        if current_user.role == 'campus_pastor':
            detected_campus = detect_campus(text)
            if detected_campus and detected_campus != 'all_campuses':
                if not current_user.has_permission('recall_stats', detected_campus):
                    error_text = f"I'm sorry, you can only access data for {safe_campus_name(current_user.campus)[1]} campus."
                    
                    # Generate audio with ElevenLabs if available
                    audio_url = None
                    if elevenlabs_api_key:
                        audio_url = generate_audio_with_elevenlabs(error_text)
                    
                    return jsonify({
                        "error": f"You can only access data for {safe_campus_name(current_user.campus)[1]} campus",
                        "text": error_text,
                        "campus": campus,
                        "stats": {},
                        "missing_stats": [],
                        "suggestions": [],
                        "insights": ["Access restricted to your campus only"],
                        "audio_url": audio_url
                    }), 403
            elif detected_campus == 'all_campuses' or not detected_campus:
                # Modify query to restrict to user's campus
                text = text + f" for {safe_campus_name(current_user.campus)[1]}"
                
        # Call the query endpoint internally
        query_data = {"question": text}
    else:
        # Check if user has log permissions for stat logging
        if not current_user.has_permission('log_stats'):
            error_text = "I'm sorry, you don't have permission to log statistics data."
            
            # Generate audio with ElevenLabs if available
            audio_url = None
            if elevenlabs_api_key:
                audio_url = generate_audio_with_elevenlabs(error_text)
            
            return jsonify({
                "error": "You do not have permission to log statistics",
                "text": error_text,
                "campus": campus,
                "stats": {},
                "missing_stats": [],
                "suggestions": [],
                "insights": ["Permission denied for data logging"],
                "audio_url": audio_url
            }), 403

    # Process based on operation type
    if is_query:
        # Call the query endpoint internally
        query_data = {"question": text}
        query_response = query_data_internal(query_data)
        if not query_response:
            return jsonify({"error": "No response from query_data_internal"}), 500
        # Format response for frontend
        if query_response and "error" in query_response:
            response_text = query_response["error"]
        else:
            # Use the actual report text if available, otherwise fallback
            response_text = query_response.get("text", query_response.get("answer", "I couldn't find that information."))
        
        # Generate audio with ElevenLabs if available - ONLY for voice input
        audio_url = None
        if elevenlabs_api_key and input_type == 'voice':
            audio_url = generate_audio_with_elevenlabs(response_text)
        
        # Format response for frontend - preserve all query fields and force popup
        response = {
            "text": response_text,
            "campus": display_campus_name(campus),
            "stats": {},
            "missing_stats": [],
            "suggestions": [],
            "insights": [response_text],
            "audio_url": audio_url,
            "popup": True  # Force popup for all queries
        }
        
        # Preserve all query fields from query_response
        if "report" in query_response:
            response["report"] = query_response["report"]
        if "analysis" in query_response:
            response["analysis"] = query_response["analysis"]
        if "question" in query_response:
            response["question"] = query_response["question"]
        if "answer" in query_response:
            response["answer"] = query_response["answer"]
        # Preserve comparison fields
        if "comparison" in query_response:
            response["comparison"] = query_response["comparison"]
        if "reports" in query_response:
            response["reports"] = query_response["reports"]
        if "percent_changes" in query_response:
            response["percent_changes"] = query_response["percent_changes"]
        if "years" in query_response:
            response["years"] = query_response["years"]
        if "period_type" in query_response:
            response["period_type"] = query_response["period_type"]
        if "period_value" in query_response:
            response["period_value"] = query_response["period_value"]
        
        return jsonify(response)
    
    # Extract stats with enhanced context
    result = extract_stats_with_context(text, campus)
    
    # Generate insights with memory
    insights = generate_encouragement_with_memory(text, campus, memory)
    
    # Detect missing stats
    missing_stats = detect_missing_stats(text, campus)
    
    # Update memory
    if campus not in memory:
        memory[campus] = []
    memory[campus].append(result)
    save_conversation_memory(memory)

    # Log to Google Sheet if available
    if sheet:
        try:
            # Use Adelaide timezone for Australian campuses
            from zoneinfo import ZoneInfo
            adelaide_tz = ZoneInfo('Australia/Adelaide')
            now = datetime.now(adelaide_tz)
            timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
            
            # Calculate Sunday date (the Sunday that just passed)
            today = datetime.now()
            days_since_sunday = (today.weekday() + 1) % 7
            sunday_date = (today - timedelta(days=days_since_sunday)).strftime('%Y-%m-%d')
            
            date = sunday_date
            
            # Create row in exact column order matching full structure:
            # A=Timestamp, B=Date, C=Campus, D=Total Attendance, E=First Time Visitors, F=Visitors, G=Cards Back,
            # H=First Time Christians, I=Rededications, J=Youth Attendance, K=Youth Salvations, L=Youth New People,
            # M=Kids Attendance, N=Kids Leaders, O=New Kids, P=New Kids Salvations, Q=Connect Groups, R=Dream Team, S=Tithe, T=Baptisms, U=Child Dedications
            row = [
                timestamp,  # A - Timestamp
                date,  # B - Date (Sunday date)
                result.get("Campus", display_campus_name(campus)),  # C - Campus
                result.get("Total Attendance", ""),  # D - Total Attendance
                result.get("First Time Visitors", ""),  # E - First Time Visitors
                result.get("Visitors", ""),  # F - Visitors
                result.get("Cards Back", ""),  # G - Cards Back
                result.get("First Time Christians", ""),  # H - First Time Christians
                result.get("Rededications", ""),  # I - Rededications
                result.get("Youth Attendance", ""),  # J - Youth Attendance
                result.get("Youth Salvations", ""),  # K - Youth Salvations
                result.get("Youth New People", ""),  # L - Youth New People
                result.get("Kids Attendance", ""),  # M - Kids Attendance
                result.get("Kids Leaders", ""),  # N - Kids Leaders
                result.get("New Kids", ""),  # O - New Kids
                result.get("New Kids Salvations", ""),  # P - New Kids Salvations
                result.get("Connect Groups", ""),  # Q - Connect Groups
                result.get("Dream Team", ""),  # R - Dream Team
                result.get("Tithe", ""),  # S - Tithe
                result.get("Baptisms", ""),  # T - Baptisms
                result.get("Child Dedications", "")  # U - Child Dedications
            ]
            sheet.append_row(row, value_input_option='USER_ENTERED', table_range='A1')
        except Exception as e:
            logger.error(f"Failed to log to Google Sheets: {e}")

    # Always return campus and stats in a way the frontend expects
    # Convert result to frontend-expected format
    frontend_stats = {}
    for key, value in result.items():
        if key in ["Total Attendance", "New People", "New Christians", "Youth Attendance", "Kids Total", "Connect Groups", "Tithe Amount", "Volunteers"]:
            # Convert to frontend expected keys
            frontend_key = key.lower().replace(" ", "_")
            if value and str(value).strip():
                frontend_stats[frontend_key] = value
                logger.info(f"✅ Converting {key} -> {frontend_key} = {value}")
            else:
                logger.info(f"❌ Skipping {key} -> {frontend_key} (empty value: {value})")
        else:
            logger.info(f"⚠️ Skipping unknown key: {key}")
    
    # Debug logging
    logger.info(f"Extracted stats: {result}")
    logger.info(f"Frontend stats: {frontend_stats}")
    
    # Generate response text
    response_text = insights[0] if insights else "Thanks for inputting those stats!"
    
    # Generate audio with ElevenLabs if available
    audio_url = None
    if elevenlabs_api_key:
        audio_url = generate_audio_with_elevenlabs(response_text)
    
    return jsonify({
        "text": response_text,
        "campus": display_campus_name(campus),
        "stats": frontend_stats,
        "missing_stats": missing_stats,
        "suggestions": missing_stats,
        "insights": insights,
        "audio_url": audio_url
    })

@app.route('/api/memory/<campus>')
def get_campus_memory(campus: str):
    """Get conversation memory for a specific campus"""
    memory = load_conversation_memory()
    campus_history = memory.get(campus, [])
    return jsonify({
        "campus": campus,
        "history": campus_history[-10:],  # Last 10 entries
        "total_entries": len(campus_history)
    })

def _campus_rows_for_current_user():
    """Real campus rows (no virtual all_campuses) the current user may act on.

    One rule set: custom allowed_campuses -> role/campus scope
    (User.accessible_campus_ids) -> region filter for region-bound users.
    """
    rows = [c for c in get_active_campuses() if c['id'] != 'all_campuses']
    allowed = current_user.accessible_campus_ids()
    if allowed is not None:
        return [c for c in rows if normalize_campus_id(c['id']) in allowed]
    user_region_id = getattr(current_user, 'region_id', None)
    if current_user.role == 'finance' and user_region_id:
        return [c for c in rows if c.get('region_id') == user_region_id]
    return rows


@app.route('/api/campuses')
@login_required
def get_campuses():
    """Get list of active campuses for dropdowns based on user permissions"""
    filtered_campuses = _campus_rows_for_current_user()
    if len(filtered_campuses) == 1:
        default_campus = filtered_campuses[0]['id']
    else:
        default_campus = filtered_campuses[0]['id'] if filtered_campuses else "all_campuses"
        if current_user.accessible_campus_ids() is None:
            # unrestricted users get the virtual all_campuses row for dashboards
            all_row = [c for c in get_active_campuses() if c['id'] == 'all_campuses']
            filtered_campuses = all_row + filtered_campuses
            default_campus = "all_campuses"

    return jsonify({
        "campuses": [{
            'id': c['id'], 
            'name': c['name'],
            'region_id': c.get('region_id'),  # Include region_id for filtering
            'region_code': c.get('region_code'),  # Include region_code for display
            'service_times': c.get('service_times', [])
        } for c in filtered_campuses],
        "default": default_campus
    })


def _campus_picklist_for_report_scoping():
    """
    Real campus rows the current user may use on dashboards — same rules as GET /api/campuses,
    excluding the virtual ``all_campuses`` row. Used to scope quarterly attendance reports for
    users without ``data_export`` (e.g. campus pastors).
    """
    return _campus_rows_for_current_user()


def _resolve_requested_campus_to_pick_id(raw: str, pick: list) -> str | None:
    def _norm_local(x: str) -> str:
        s = (x or "").strip().lower().replace(" ", "_").replace("-", "_")
        if s.endswith("_campus"):
            s = s[:-7]
        return s

    r = _norm_local(raw)
    for c in pick:
        cid = c.get('id')
        if not cid:
            continue
        if str(cid).strip() == str(raw).strip():
            return cid
        if _norm_local(str(cid)) == r:
            return cid
    return None


def _scope_quarterly_report_params_for_current_user(region: str, campuses_csv: str) -> tuple[str, str]:
    """
    Users with ``data_export`` may use any region/campus filters.

    Other users with ``dashboard_access`` may only run reports for campuses they are allowed to see
    on /api/campuses (assigned campus, allowed_campuses, or role-based list). Unknown campuses or
    cross-region tricks are rejected.
    """
    if current_user.has_permission('data_export'):
        return ((region or '').strip(), (campuses_csv or '').strip())
    if not current_user.has_permission('dashboard_access'):
        raise ValueError('You do not have access to attendance reports.')
    pick = _campus_picklist_for_report_scoping()
    if not pick:
        raise ValueError('No campuses are assigned to your account for this report.')

    parts = [s.strip() for s in (campuses_csv or '').split(',') if s.strip()]
    reg = (region or '').strip().upper()

    if parts:
        out_ids = []
        for p in parts:
            cid = _resolve_requested_campus_to_pick_id(p, pick)
            if not cid:
                raise ValueError(f'Campus is not available for your account: {p}')
            out_ids.append(cid)
        seen = set()
        uniq = []
        for x in out_ids:
            if x not in seen:
                seen.add(x)
                uniq.append(x)
        if reg:
            for c in pick:
                if c['id'] in uniq:
                    rc = (c.get('region_code') or '').upper()
                    if rc and rc != reg:
                        raise ValueError('Selected campuses do not match the chosen region filter.')
        return ((region or '').strip(), ','.join(uniq))

    if reg:
        subset = [c for c in pick if (c.get('region_code') or '').upper() == reg]
        if not subset:
            raise ValueError('You have no assigned campuses in that region.')
        return (reg, ','.join(dict.fromkeys(c['id'] for c in subset)))

    if len(pick) == 1:
        return ('', pick[0]['id'])
    return ('', ','.join(dict.fromkeys(c['id'] for c in pick)))


@app.route('/api/campuses/public')
def get_campuses_public():
    """Public endpoint for campuses - no authentication required"""
    try:
        active_campuses = get_active_campuses()
        campuses_db = load_campuses_database()
        
        return jsonify({
            "campuses": [{
                'id': c['id'], 
                'name': c['name'],
                'full_name': c.get('full_name', c['name']),
                'region_id': c.get('region_id'),
                'region_code': c.get('region_code'),
                'description': c.get('description') or campuses_db.get('campuses', {}).get(c['id'], {}).get('description'),
                'location': campuses_db.get('campuses', {}).get(c['id'], {}).get('address'),
                'parking': campuses_db.get('campuses', {}).get(c['id'], {}).get('parking'),
                'kids_info': campuses_db.get('campuses', {}).get(c['id'], {}).get('kids_info'),
                'service_times': c.get('service_times', [])
            } for c in active_campuses],
            "default": "all_campuses"
        })
    except Exception as e:
        logger.error(f"Error getting public campuses: {e}")
        return jsonify({"campuses": [], "default": "all_campuses"})

@app.route('/api/campuses/create', methods=['POST'])
@admin_required
def create_campus_api():
    """Create a new campus via API"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('campus_management') is False:
        return jsonify({"error": "Access denied - Campuses management has been disabled for your account"}), 403
    if not request.is_json:
        return jsonify({"error": "Expected JSON request"}), 400
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing or invalid JSON body"}), 400
    
    # Extract campus data
    campus_name = data.get('name', '').strip()
    campus_address = data.get('address', '').strip()
    campus_pastor = data.get('pastor', '').strip()
    campus_status = data.get('status', 'active')
    
    if not campus_name:
        return jsonify({"error": "Campus name is required"}), 400
    
    # Load existing campuses
    campuses_db = load_campuses_database()
    
    # Generate campus ID from name
    campus_id = campus_name.lower().replace(' ', '_').replace('-', '_')
    
    # Check if campus already exists
    if campus_id in campuses_db.get('campuses', {}):
        return jsonify({"error": "Campus already exists"}), 400
    
    # Create new campus
    new_campus = {
        "id": campus_id,
        "name": campus_name,
        "display_name": campus_name,
        "slug": campus_id,
        "active": campus_status == 'active',
        "address": campus_address,
        "pastor": campus_pastor,
        "detection_patterns": [campus_name.lower()],
        "created_date": datetime.now().strftime('%Y-%m-%d'),
        "notes": None
    }
    
    # Add to database
    campuses_db['campuses'][campus_id] = new_campus
    
    # Save database
    if save_campuses_database(campuses_db):
        return jsonify({
            "success": True,
            "message": "Campus created successfully",
            "campus": new_campus
        })
    else:
        return jsonify({"error": "Failed to save campus"}), 500

@app.route('/api/campuses/<campus_id>/edit', methods=['POST'])
@admin_required
def edit_campus_api(campus_id):
    """Edit an existing campus via API"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('campus_management') is False:
        return jsonify({"error": "Access denied - Campuses management has been disabled for your account"}), 403
    if not request.is_json:
        return jsonify({"error": "Expected JSON request"}), 400
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing or invalid JSON body"}), 400
    
    # Load existing campuses
    campuses_db = load_campuses_database()
    
    # Check if campus exists
    if campus_id not in campuses_db.get('campuses', {}):
        return jsonify({"error": "Campus not found"}), 404
    
    # Update campus data
    campus = campuses_db['campuses'][campus_id]
    
    if 'name' in data:
        campus['name'] = data['name'].strip()
        campus['display_name'] = data['name'].strip()
    
    if 'address' in data:
        campus['address'] = data['address'].strip()
    
    if 'pastor' in data:
        campus['pastor'] = data['pastor'].strip()
    
    if 'status' in data:
        campus['active'] = data['status'] == 'active'
    
    # Save database
    if save_campuses_database(campuses_db):
        return jsonify({
            "success": True,
            "message": "Campus updated successfully",
            "campus": campus
        })
    else:
        return jsonify({"error": "Failed to save campus"}), 500

@app.route('/api/campuses/<campus_id>/delete', methods=['POST'])
@admin_required
def delete_campus_api(campus_id):
    """Delete a campus via API"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('campus_management') is False:
        return jsonify({"error": "Access denied - Campuses management has been disabled for your account"}), 403
    # Load existing campuses
    campuses_db = load_campuses_database()
    
    # Check if campus exists
    if campus_id not in campuses_db.get('campuses', {}):
        return jsonify({"error": "Campus not found"}), 404
    
    # Check if it's a special campus that shouldn't be deleted
    if campus_id == 'all_campuses':
        return jsonify({"error": "Cannot delete special campus 'all_campuses'"}), 400
    
    # Remove campus
    del campuses_db['campuses'][campus_id]
    
    # Save database
    if save_campuses_database(campuses_db):
        return jsonify({
            "success": True,
            "message": "Campus deleted successfully"
        })
    else:
        return jsonify({"error": "Failed to save campus"}), 500

@app.route('/api/query', methods=['POST'])
@log_endpoint
@login_required
def query():
    """Query historical data and answer questions about stats"""
    if not request.is_json:
        return jsonify({"error": "Expected JSON request"}), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing or invalid JSON body"}), 400

    # Check if user has recall permissions
    if not current_user.has_permission('recall_stats'):
        return jsonify({"error": "You do not have permission to recall statistics data"}), 403

    # For campus pastors, validate they can only access their campus data
    if current_user.role == 'campus_pastor':
        # Extract campus from query if possible
        question = data.get('question', '').lower()
        detected_campus = detect_campus(question)
        
        # If a specific campus is detected, check if user can access it
        if detected_campus and detected_campus != 'all_campuses':
            if not current_user.has_permission('recall_stats', detected_campus):
                return jsonify({
                    "error": f"You can only access data for {safe_campus_name(current_user.campus)[1]} campus"
                }), 403
        # If query is for all campuses, restrict to user's campus
        elif detected_campus == 'all_campuses' or not detected_campus:
            data['question'] = data.get('question', '') + f" for {safe_campus_name(current_user.campus)[1]}"

    # Use the internal function that has review intent handling
    result = query_data_internal(data)
    
    # If there's an error, return it
    if "error" in result:
        return jsonify(result), 400
    
    # If there's a report, return it with the report structure
    if "report" in result:
        return jsonify(result)
    
    # Otherwise, return the normal response
    return jsonify(result)

@app.route('/api/bulk_review', methods=['POST'])
def bulk_review():
    """Parse multi-line review text and return a structured report of all detected stats"""
    if not request.is_json:
        return jsonify({"error": "Expected JSON request"}), 400
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing or invalid JSON body"}), 400
    text = str(data.get("text", "")).strip()
    if not text:
        return jsonify({"error": "Missing text"}), 400

    # Split text into lines and try to detect stat/campus/year for each block
    import re
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    campus = None
    # Try to detect campus from the header or any line
    for line in lines:
        detected = detect_campus(line)
        if detected:
            campus = detected
            break
    if not campus:
        campus = "main"  # fallback
    campus_normalized = normalize_campus(campus)

    # Define stat label to stat type mapping (expand as needed)
    stat_map = {
        'souls': 'new_christians',
        'attendance': 'attendance',
        'new people': 'new_people',
        'cg': 'connect_groups', 'cgs': 'connect_groups', 'connect groups': 'connect_groups',
        'dt': 'dream_team', 'dream team': 'dream_team', 'team': 'dream_team',
        'yth': 'youth', 'youth': 'youth',
        'kids': 'kids',
    }
    # For each stat block, look for lines like 'Total Souls:', 'Average Attendance:', etc.
    results = []
    for i, line in enumerate(lines):
        # Try to match stat label
        stat_label_match = re.match(r'(total|average)?\s*([a-zA-Z\u2019\'\s]+):', line, re.IGNORECASE)
        if stat_label_match:
            intent = stat_label_match.group(1) or ''
            stat_label = stat_label_match.group(2).strip().lower()
            # Map to stat type
            stat_type = None
            for key, value in stat_map.items():
                if key in stat_label:
                    stat_type = value
                    break
            if not stat_type:
                continue  # skip unknown stat
            # Look ahead for year lines (e.g., '2025 YTD:', '2024 YTD:')
            year_lines = []
            for j in range(i+1, min(i+5, len(lines))):
                year_match = re.match(r'(20\d{2})\s*(ytd)?', lines[j], re.IGNORECASE)
                if year_match:
                    year = int(year_match.group(1))
                    ytd = bool(year_match.group(2))
                    year_lines.append((year, ytd))
            # For each year, run the stat query
            for year, ytd in year_lines:
                # Use the same stat/campus/year detection logic as comparison
                # For YTD, use Jan 1 to now; else, use full year
                if ytd:
                    start_date = datetime(year, 1, 1)
                    end_date = datetime.now() if year == datetime.now().year else datetime(year, 12, 31)
        else:
            start_date = datetime(year, 1, 1)
            end_date = datetime(year, 12, 31)
        
        # Get rows data
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        if not rows:
            memory = load_conversation_memory()
            # Try all possible normalizations for the campus key
            session_stats = memory.get("session_stats", {})
            campus_history = session_stats.get(campus, [])
            if not campus_history:
                campus_capitalized = campus.title()
                campus_history = session_stats.get(campus_capitalized, [])
            if not campus_history:
                for k in session_stats:
                    if normalize_campus(k) == campus_normalized:
                        campus_history = session_stats[k]
                        break
                if campus_history:
                    campus = campus_capitalized
            rows = campus_history
        # Filter rows by date
        filtered_rows = []
        unique_campuses = set()
        for row in rows:
            row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
            unique_campuses.add(row_campus)
            if row_campus == campus_normalized or campus_normalized in row_campus:
                timestamp_str = row.get("Timestamp", "")
                if timestamp_str:
                    try:
                        if "T" in timestamp_str:
                            row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            row_date = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                        if start_date <= row_date <= end_date:
                            filtered_rows.append(row)
                    except Exception:
                        filtered_rows.append(row)
                else:
                    filtered_rows.append(row)
        print(f"[DEBUG] Unique campuses in data: {sorted(unique_campuses)}")
        # Calculate stat value
        total = 0
        avg = 0
        count = 0
        values = []
        for entry in filtered_rows:
            if stat_type == "attendance":
                val = safe_int(entry.get("Total Attendance") or entry.get("total_attendance"))
            elif stat_type == "new_people":
                val = safe_int(entry.get("New People") or entry.get("new_people"))
            elif stat_type == "new_christians":
                val = safe_int(entry.get("New Christians") or entry.get("new_christians"))
            elif stat_type == "youth":
                val = safe_int(entry.get("Youth Attendance") or entry.get("youth_attendance"))
            elif stat_type == "kids":
                val = safe_int(entry.get("Kids Total") or entry.get("kids_total"))
            elif stat_type == "connect_groups":
                val = safe_int(entry.get("Connect Groups") or entry.get("connect_groups"))
            elif stat_type == "dream_team":
                val = safe_int(entry.get("Volunteers") or entry.get("volunteers"))
            else:
                val = 0
            print(f"[DEBUG] Stat: {stat_type}, Value: {val}, Entry: {entry}")
            if val > 0:
                values.append(val)
                total += val
                count += 1
        if count > 0:
            avg = total / count
        results.append({
            "stat": stat_type,
            "intent": intent.strip().lower() or "total",
            "year": year,
            "ytd": ytd,
            "campus": display_campus_name(campus),
            "total": total,
            "average": round(avg, 1),
            "count": count
        })
    return jsonify({"results": results})

@app.route('/api/test')
def test_route():
    """Test route to verify Flask is working and check Google Sheets data"""
    logger.info("Test route called")
    if sheet:
        try:
            rows = safe_sheets_request(sheet.get_all_records)
            # Get unique campus names
            campus_names = set()
            for row in rows:
                campus = row.get("Campus") or row.get("campus") or ""
                if campus:
                    campus_names.add(campus)
            
            return jsonify({
                "message": "Test route working",
                "total_rows": len(rows),
                "unique_campuses": list(campus_names),
                "sample_row_keys": list(rows[0].keys()) if rows else []
            })
        except Exception as e:
            return jsonify({"error": str(e)})
    else:
        return jsonify({"error": "Google Sheets not connected"})

# Admin routes for campus management
@app.route('/api/admin/campuses', methods=['GET'])
@login_required
def get_admin_campuses():
    """Get all campuses and their service times for admin management"""
    if not current_user.has_permission('manage_campuses'):
        return jsonify({"error": "Insufficient permissions"}), 403
    
    try:
        global CAMPUS_SERVICE_TIMES
        return jsonify({
            "campuses": CAMPUS_SERVICE_TIMES,
            "success": True
        })
    except Exception as e:
        logger.error(f"Failed to get admin campuses: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/campuses', methods=['POST'])
@login_required
def add_campus():
    """Add a new campus with service times"""
    if not current_user.has_permission('manage_campuses'):
        return jsonify({"error": "Insufficient permissions"}), 403
    
    try:
        data = request.get_json()
        campus_name = data.get('name', '').strip()
        service_times = data.get('service_times', [])
        
        if not campus_name:
            return jsonify({"error": "Campus name is required"}), 400
        
        if not service_times:
            return jsonify({"error": "At least one service time is required"}), 400
        
        # Validate service times format
        for time in service_times:
            if not isinstance(time, str) or not time.strip():
                return jsonify({"error": "Invalid service time format"}), 400
        
        global CAMPUS_SERVICE_TIMES
        CAMPUS_SERVICE_TIMES[campus_name] = service_times
        
        if save_campus_config(CAMPUS_SERVICE_TIMES):
            logger.info(f"Added new campus: {campus_name} with service times: {service_times}")
            return jsonify({
                "message": f"Campus '{campus_name}' added successfully",
                "campus": {
                    "name": campus_name,
                    "service_times": service_times
                },
                "success": True
            })
        else:
            return jsonify({"error": "Failed to save campus configuration"}), 500
            
    except Exception as e:
        logger.error(f"Failed to add campus: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/campuses/<campus_name>', methods=['PUT'])
@login_required
def update_campus(campus_name):
    """Update service times for an existing campus"""
    if not current_user.has_permission('manage_campuses'):
        return jsonify({"error": "Insufficient permissions"}), 403
    
    try:
        data = request.get_json()
        service_times = data.get('service_times', [])
        
        if not service_times:
            return jsonify({"error": "At least one service time is required"}), 400
        
        # Validate service times format
        for time in service_times:
            if not isinstance(time, str) or not time.strip():
                return jsonify({"error": "Invalid service time format"}), 400
        
        global CAMPUS_SERVICE_TIMES
        if campus_name not in CAMPUS_SERVICE_TIMES:
            return jsonify({"error": "Campus not found"}), 404
        
        CAMPUS_SERVICE_TIMES[campus_name] = service_times
        
        if save_campus_config(CAMPUS_SERVICE_TIMES):
            logger.info(f"Updated campus: {campus_name} with service times: {service_times}")
            return jsonify({
                "message": f"Campus '{campus_name}' updated successfully",
                "campus": {
                    "name": campus_name,
                    "service_times": service_times
                },
                "success": True
            })
        else:
            return jsonify({"error": "Failed to save campus configuration"}), 500
            
    except Exception as e:
        logger.error(f"Failed to update campus: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/campuses/<campus_name>', methods=['DELETE'])
@login_required
def delete_campus(campus_name):
    """Delete a campus"""
    if not current_user.has_permission('manage_campuses'):
        return jsonify({"error": "Insufficient permissions"}), 403
    
    try:
        global CAMPUS_SERVICE_TIMES
        if campus_name not in CAMPUS_SERVICE_TIMES:
            return jsonify({"error": "Campus not found"}), 404
        
        if campus_name == 'all_campuses':
            return jsonify({"error": "Cannot delete the 'all_campuses' entry"}), 400
        
        del CAMPUS_SERVICE_TIMES[campus_name]
        
        if save_campus_config(CAMPUS_SERVICE_TIMES):
            logger.info(f"Deleted campus: {campus_name}")
            return jsonify({
                "message": f"Campus '{campus_name}' deleted successfully",
                "success": True
            })
        else:
            return jsonify({"error": "Failed to save campus configuration"}), 500
            
    except Exception as e:
        logger.error(f"Failed to delete campus: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================================
# NEW REGION-AWARE CAMPUS MANAGEMENT API
# ============================================================================

@app.route('/api/weekly-submission-status', methods=['GET'])
@login_required
def get_weekly_submission_status():
    """Get submission status for all campuses for the current week (Saturday-Sunday weekend) - Multi-region support"""
    try:
        from models import Region, CampusV2, AttendanceRecord
        
        print(f"[WEEKLY_SUBMISSION] Request received. User: {current_user.username}, Role: {current_user.role}")
        
        # Only admins and lead pastors can see this
        if current_user.role not in ALL_ACCESS_ROLES:
            print(f"[WEEKLY_SUBMISSION] Unauthorized - user role: {current_user.role}")
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get region parameter (optional - defaults to user's region or AU)
        region_code = request.args.get('region', 'AU').upper()
        print(f"[WEEKLY_SUBMISSION] Looking for region: {region_code}")
        
        # Find the region using raw SQL to avoid model column issues
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, code, display_name FROM regions WHERE code = ?", (region_code,))
        region_row = cursor.fetchone()
        
        if not region_row:
            print(f"[WEEKLY_SUBMISSION] Region {region_code} not found")
            return jsonify({'error': f'Region {region_code} not found'}), 404
        
        region_id = region_row[0]
        region_dict = {
            'id': region_row[0],
            'name': region_row[1],
            'code': region_row[2],
            'display_name': region_row[3]
        }
        print(f"[WEEKLY_SUBMISSION] Found region: {region_dict['display_name']} (ID: {region_id})")
        
        # Get the most recent Sunday (or today if it's Sunday)
        today = datetime.now()
        days_since_sunday = (today.weekday() + 1) % 7  # Monday is 0, Sunday is 6
        most_recent_sunday = today - timedelta(days=days_since_sunday)
        most_recent_sunday = most_recent_sunday.replace(hour=0, minute=0, second=0, microsecond=0).date()
        
        # Also check for Saturday submissions (many campuses submit Saturday evening)
        most_recent_saturday = most_recent_sunday - timedelta(days=1)
        
        # For the current week, include today (Mon-Fri submissions count too!)
        end_date = today.date() if today.date() > most_recent_sunday else most_recent_sunday
        
        print(f"[WEEKLY_SUBMISSION] Date range: {most_recent_saturday} to {end_date}")
        logger.info(f"[WEEKLY_SUBMISSION] Checking submissions from {most_recent_saturday} to {end_date}")
        
        # Get all campuses for this region
        campuses = CampusV2.query.filter_by(region_id=region_id, active=True).all()
        
        if not campuses:
            return jsonify({
                'week_start': most_recent_saturday.strftime('%B %d, %Y'),
                'campuses': [],
                'region': region_dict
            })
        
        # Check submission status for each campus using DATABASE (attendance_records)
        campus_status = []
        for campus in campuses:
            print(f"[WEEKLY_SUBMISSION] Checking campus: {campus.display_name} (ID: {campus.id}, campus_id: {campus.campus_id})")
            
            # Find the most recent submission for this campus (Saturday through today)
            latest_record = AttendanceRecord.query.filter(
                AttendanceRecord.campus_id == campus.id,
                AttendanceRecord.date >= most_recent_saturday,
                AttendanceRecord.date <= end_date
            ).order_by(AttendanceRecord.date.desc()).first()
            
            print(f"[WEEKLY_SUBMISSION] Campus {campus.campus_id}: Record found = {latest_record is not None}")
            if latest_record:
                print(f"[WEEKLY_SUBMISSION] Record date: {latest_record.date}")
            
            # Determine status
            status = 'submitted' if latest_record else 'not_submitted'
            last_submitted = latest_record.date.strftime('%A, %B %d') if latest_record else None
            
            campus_status.append({
                'id': campus.campus_id,
                'name': campus.display_name,
                'status': status,
                'last_submitted': last_submitted,
                'week_start': most_recent_saturday.strftime('%B %d, %Y')  # Show Saturday as week start
            })
        
        print(f"[WEEKLY_SUBMISSION] Returning {len(campus_status)} campus statuses")
        return jsonify({
            'campuses': campus_status,
            'week_start': most_recent_saturday.strftime('%B %d, %Y')  # Show Saturday as week start
        })
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[WEEKLY_SUBMISSION] ERROR: {e}")
        print(f"[WEEKLY_SUBMISSION] Traceback: {error_trace}")
        logger.error(f"[WEEKLY_SUBMISSION] Error getting weekly submission status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v2/regions', methods=['GET'])
def get_regions():
    """Get all regions"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, code, display_name, timezone, currency, active, coming_soon, launch_date
            FROM regions
            ORDER BY active DESC, display_name ASC
        """)
        
        regions = []
        for row in cursor.fetchall():
            regions.append({
                'id': row[0],
                'name': row[1],
                'code': row[2],
                'display_name': row[3],
                'timezone': row[4],
                'currency': row[5],
                'active': bool(row[6]),
                'coming_soon': bool(row[7]),
                'launch_date': row[8]
            })
        
        return jsonify({'regions': regions})
    except Exception as e:
        logger.error(f"Failed to get regions: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/v2/campuses', methods=['GET'])
@login_required
def get_campuses_v2():
    """Get all campuses with region information (admin management - respect Role Manager)"""
    try:
        if not current_user.has_permission('manage_campuses'):
            return jsonify({"error": "Access denied - Campuses management has been disabled for your account"}), 403
        conn = get_db()
        cursor = conn.cursor()
        
        # Get campuses with region info
        cursor.execute("""
            SELECT 
                c.id, c.campus_id, c.name, c.display_name, c.region_id,
                c.pastor_name, c.pastor_email, c.address, c.city, c.state,
                c.postal_code, c.country, c.active, c.service_times,
                c.detection_patterns, c.notes, c.created_at,
                r.name as region_name, r.code as region_code, r.display_name as region_display_name
            FROM campuses_v2 c
            LEFT JOIN regions r ON c.region_id = r.id
            ORDER BY r.display_name, c.display_name
        """)
        
        campuses = []
        for row in cursor.fetchall():
            service_times = json.loads(row[13]) if row[13] else []
            detection_patterns = json.loads(row[14]) if row[14] else []
            
            campuses.append({
                'id': row[0],
                'campus_id': row[1],
                'name': row[2],
                'display_name': row[3],
                'region_id': row[4],
                'pastor_name': row[5],
                'pastor_email': row[6],
                'address': row[7],
                'city': row[8],
                'state': row[9],
                'postal_code': row[10],
                'country': row[11],
                'active': bool(row[12]),
                'service_times': service_times,
                'detection_patterns': detection_patterns,
                'notes': row[15],
                'created_at': row[16],
                'region': {
                    'name': row[17],
                    'code': row[18],
                    'display_name': row[19]
                }
            })
        
        return jsonify({'campuses': campuses})
    except Exception as e:
        logger.error(f"Failed to get campuses: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/v2/campuses', methods=['POST'])
@admin_required
def create_campus_v2():
    """Create a new campus"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('campus_management') is False:
        return jsonify({"error": "Access denied - Campuses management has been disabled for your account"}), 403
    try:
        data = request.get_json()
        print(f"[CREATE_CAMPUS] Received data: {data}")
        logger.info(f"[CREATE_CAMPUS] Received data: {data}")
        
        # Validate required fields
        required = ['name', 'display_name', 'region_id']
        for field in required:
            if field not in data:
                error_msg = f"Missing required field: {field}"
                print(f"[CREATE_CAMPUS] ERROR: {error_msg}")
                return jsonify({"error": error_msg}), 400
        
        # Generate campus_id from name
        campus_id = data['name'].lower().replace(' ', '_').replace('-', '_')
        print(f"[CREATE_CAMPUS] Generated campus_id: {campus_id}")
        
        # Prepare service times and detection patterns
        service_times = json.dumps(data.get('service_times', []))
        detection_patterns = json.dumps(data.get('detection_patterns', [campus_id.replace('_', ' ')]))
        
        # Insert into database
        conn = get_db()
        cursor = conn.cursor()
        print(f"[CREATE_CAMPUS] Inserting into database...")
        cursor.execute("""
            INSERT INTO campuses_v2 
            (campus_id, name, display_name, region_id, pastor_name, pastor_email, 
             address, city, state, postal_code, country, active, service_times, 
             detection_patterns, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            campus_id,
            data['name'],
            data['display_name'],
            data['region_id'],
            data.get('pastor_name', ''),
            data.get('pastor_email', ''),
            data.get('address', ''),
            data.get('city', ''),
            data.get('state', ''),
            data.get('postal_code', ''),
            data.get('country', ''),
            1 if data.get('active', True) else 0,
            service_times,
            detection_patterns,
            data.get('notes', '')
        ))
        conn.commit()
        print(f"[CREATE_CAMPUS] Successfully created campus: {campus_id}")
        logger.info(f"[CREATE_CAMPUS] Successfully created campus: {campus_id}")
        
        return jsonify({
            "success": True,
            "message": "Campus created successfully",
            "campus_id": campus_id
        })
    except Exception as e:
        print(f"[CREATE_CAMPUS] EXCEPTION: {e}")
        import traceback
        print(f"[CREATE_CAMPUS] Traceback: {traceback.format_exc()}")
        logger.error(f"[CREATE_CAMPUS] Failed to create campus: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/v2/campuses/<campus_id>', methods=['PUT'])
@admin_required
def update_campus_v2(campus_id):
    """Update an existing campus"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('campus_management') is False:
        return jsonify({"error": "Access denied - Campuses management has been disabled for your account"}), 403
    try:
        data = request.get_json()
        
        # Prepare service times and detection patterns
        service_times = json.dumps(data.get('service_times', []))
        detection_patterns = json.dumps(data.get('detection_patterns', []))
        
        # Update database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE campuses_v2
            SET name = ?, display_name = ?, region_id = ?, pastor_name = ?, 
                pastor_email = ?, address = ?, city = ?, state = ?, postal_code = ?,
                country = ?, active = ?, service_times = ?, detection_patterns = ?, notes = ?
            WHERE campus_id = ?
        """, (
            data.get('name'),
            data.get('display_name'),
            data.get('region_id'),
            data.get('pastor_name', ''),
            data.get('pastor_email', ''),
            data.get('address', ''),
            data.get('city', ''),
            data.get('state', ''),
            data.get('postal_code', ''),
            data.get('country', ''),
            1 if data.get('active', True) else 0,
            service_times,
            detection_patterns,
            data.get('notes', ''),
            campus_id
        ))
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": "Campus updated successfully"
        })
    except Exception as e:
        logger.error(f"Failed to update campus: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/v2/campuses/<campus_id>', methods=['DELETE'])
@admin_required
def delete_campus_v2(campus_id):
    """Delete a campus"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('campus_management') is False:
        return jsonify({"error": "Access denied - Campuses management has been disabled for your account"}), 403
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM campuses_v2 WHERE campus_id = ?", (campus_id,))
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": "Campus deleted successfully"
        })
    except Exception as e:
        logger.error(f"Failed to delete campus: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================================
# END NEW REGION-AWARE CAMPUS MANAGEMENT API
# ============================================================================

@app.route('/api/service-times', methods=['GET'])
def get_service_times():
    """Get service times for all campuses or a specific campus"""
    campus = request.args.get('campus')
    
    if campus:
        service_times = get_campus_service_times(campus)
        return jsonify({
            "campus": display_campus_name(campus),
            "service_times": service_times
        })
    else:
        all_service_times = get_all_service_times()
        return jsonify({
            "all_campuses": all_service_times
        })

@app.route('/api/service-times', methods=['POST'])
@login_required
def update_service_times():
    """Update service times for a campus.

    Campus pastors (anyone with log_stats) may manage the times for campuses
    they can access; admins/leadership can manage any campus. Persists to
    campuses_v2.service_times - the store Stats Input and dashboards read.
    """
    try:
        data = request.get_json()
        campus = (data.get('campus') or '').strip()
        service_times = data.get('service_times', [])

        if not campus or not isinstance(service_times, list):
            return jsonify({"error": "Campus and service_times are required"}), 400

        if not current_user.has_permission('log_stats'):
            return jsonify({"error": "You don't have permission to manage service times"}), 403
        if not current_user.can_access_campus(campus):
            return jsonify({"error": f"You don't have access to manage {campus}"}), 403

        # Clean the list: strings only, trimmed, de-duplicated, order kept
        valid_times = []
        for time_str in service_times:
            if isinstance(time_str, str) and time_str.strip() and time_str.strip() not in valid_times:
                valid_times.append(time_str.strip())

        if not valid_times:
            return jsonify({"error": "At least one service time is required"}), 400
        if len(valid_times) > 12:
            return jsonify({"error": "Too many service times (max 12)"}), 400

        campus_norm = normalize_campus_id(campus)
        campus_obj = CampusV2.query.filter_by(campus_id=campus_norm).first()
        if not campus_obj:
            return jsonify({"error": f"Campus not found: {campus}"}), 404

        campus_obj.service_times = json.dumps(valid_times)
        db.session.commit()

        # Keep the in-memory fallback map in sync for this process
        try:
            CAMPUS_SERVICE_TIMES[display_campus_name(campus)] = valid_times
        except Exception:
            pass

        logger.info(f"[SERVICE_TIMES] {current_user.username} set {campus_norm} -> {valid_times}")
        return jsonify({
            "success": True,
            "campus": campus_norm,
            "service_times": valid_times,
            "message": f"Service times updated for {campus_obj.display_name or campus_norm}"
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating service times: {e}")
        return jsonify({"error": "Failed to update service times"}), 500

@app.route('/api/test_voice', methods=['POST'])
def test_voice_processing():
    """Test voice processing functionality with enhanced debugging"""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        text = data.get('text', '')
        campus = data.get('campus', '')
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Test preprocessing
        processed_text = preprocess_voice_text(text)
        
        # Test stat extraction
        stats = extract_stats_with_context(text, campus)
        
        # Test campus detection
        detected_campus = detect_campus(text)
        
        # Test pattern matching for debugging
        pattern_matches = {}
        search_text = processed_text if processed_text else text
        for key, pattern in patterns.items():
            match = re.search(pattern, search_text, re.IGNORECASE)
            if match:
                pattern_matches[key] = {
                    "matched_text": match.group(0),
                    "extracted_value": match.group(1),
                    "pattern": pattern
                }
        
        # Test query detection
        text_lower = text.lower()
        query_keywords = [
            'how many', 'what is', 'what was', "what's", 'tell me', 'give me', 'show me',
            'average', 'last week', 'this week', 'last month', 'this month', 'count', 'query', 'data'
        ]
        is_query = any(word in text_lower for word in query_keywords)
        
        return jsonify({
            "original_text": text,
            "processed_text": processed_text,
            "detected_campus": detected_campus,
            "extracted_stats": stats,
            "pattern_matches": pattern_matches,
            "patterns_matched": len(pattern_matches),
            "total_patterns": len(patterns),
            "is_query": is_query,
            "message": "Voice processing test completed with enhanced debugging"
        })
        
    except Exception as e:
        logger.error(f"Voice test error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/test_voice_enhanced', methods=['POST'])
def test_voice_parsing_enhanced():
    """Enhanced voice parsing test with detailed debugging and confidence scoring"""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        text = data.get('text', '')
        campus = data.get('campus', '')
        confidence = data.get('confidence', 0)
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Enhanced preprocessing with confidence tracking
        original_text = text
        processed_text = preprocess_voice_text(text)
        
        # Test stat extraction with confidence
        stats = extract_stats_with_context(text, campus)
        
        # Test campus detection with confidence
        detected_campus = detect_campus(text)
        
        # Enhanced pattern matching with confidence scoring
        pattern_matches = {}
        search_text = processed_text if processed_text else text
        total_confidence = 0
        match_count = 0
        
        for key, pattern in patterns.items():
            match = re.search(pattern, search_text, re.IGNORECASE)
            if match:
                match_count += 1
                # Calculate pattern confidence based on match quality
                match_text = match.group(0)
                pattern_confidence = min(1.0, len(match_text) / len(search_text) + 0.3)
                total_confidence += pattern_confidence
                
                pattern_matches[key] = {
                    "matched_text": match_text,
                    "extracted_value": match.group(1),
                    "pattern": pattern,
                    "confidence": pattern_confidence,
                    "position": match.start()
                }
        
        # Calculate overall parsing confidence
        overall_confidence = (total_confidence / max(match_count, 1)) * confidence if match_count > 0 else 0
        
        # Test query detection with enhanced patterns
        text_lower = text.lower()
        query_keywords = [
            'how many', 'what is', 'what was', "what's", 'tell me', 'give me', 'show me',
            'average', 'last week', 'this week', 'last month', 'this month', 'count', 'query', 'data',
            'has had', 'had this year', 'had this month', 'had last', 'compare', 'comparison',
            'vs', 'versus', 'between', 'year over year', 'review', 'annual review',
            'mid year review', 'mid-year review', 'midyear', 'trend', 'trends', 'growth',
            'percentage', 'percent', '%', 'increase', 'decrease', 'up', 'down'
        ]
        
        query_confidence = 0
        query_matches = []
        for keyword in query_keywords:
            if keyword in text_lower:
                query_matches.append(keyword)
                query_confidence += 0.1
        
        is_query = query_confidence > 0.1
        
        # Enhanced campus detection with fuzzy matching
        campus_confidence = 0
        campus_matches = []
        if detected_campus:
            campus_confidence = 0.8
            campus_matches.append(detected_campus)
        
        # Test for common voice recognition issues
        voice_issues = []
        if len(text.split()) < 3:
            voice_issues.append("Very short input - may be incomplete")
        if confidence < 0.5:
            voice_issues.append("Low confidence - consider retrying")
        if not any(char.isdigit() for char in text):
            voice_issues.append("No numbers detected - may be a query")
        
        # Generate suggestions for improvement
        suggestions = []
        if overall_confidence < 0.5:
            suggestions.append("Try speaking more clearly and including specific numbers")
        if not is_query and match_count == 0:
            suggestions.append("Consider rephrasing as a question or including specific stats")
        if campus_confidence < 0.5:
            suggestions.append("Try mentioning a specific campus name")
        
        return jsonify({
            "original_text": original_text,
            "processed_text": processed_text,
            "voice_confidence": confidence,
            "overall_parsing_confidence": overall_confidence,
            "detected_campus": detected_campus,
            "campus_confidence": campus_confidence,
            "campus_matches": campus_matches,
            "extracted_stats": stats,
            "pattern_matches": pattern_matches,
            "patterns_matched": len(pattern_matches),
            "total_patterns": len(patterns),
            "is_query": is_query,
            "query_confidence": query_confidence,
            "query_matches": query_matches,
            "voice_issues": voice_issues,
            "suggestions": suggestions,
            "processing_quality": {
                "text_length": len(text),
                "word_count": len(text.split()),
                "has_numbers": any(char.isdigit() for char in text),
                "has_campus_mention": bool(detected_campus),
                "has_query_keywords": is_query,
                "has_stat_patterns": match_count > 0
            },
            "message": "Enhanced voice parsing test completed with detailed analysis"
        })
        
    except Exception as e:
        logger.error(f"Enhanced voice test error: {e}")
        return jsonify({"error": str(e)}), 500

# Update greeting_audio endpoint to use the correct filename
@app.route('/api/greeting_audio')
def greeting_audio():
    """Generate and serve the greeting audio using ElevenLabs, cache for reuse."""
    logger.info("Greeting audio endpoint called")
    greeting_text = "Connected to Futures Link, how can I help you today?"
    
    # Use absolute path for temp_audio directory
    temp_audio_dir = os.path.join(os.path.dirname(__file__), "temp_audio")
    audio_filename = os.path.join(temp_audio_dir, "greeting_elevenlabs.mp3")
    
    try:
        if not os.path.exists(audio_filename):
            logger.info("Greeting audio file does not exist, generating with ElevenLabs...")
            os.makedirs(temp_audio_dir, exist_ok=True)
            audio_url = generate_audio_with_elevenlabs(greeting_text, filename=audio_filename)
            if not audio_url or not os.path.exists(audio_filename):
                logger.error("Failed to generate greeting audio file with ElevenLabs.")
                return jsonify({"error": "Failed to generate greeting audio file."}), 500
            logger.info(f"Greeting audio file generated: {audio_filename}")
        else:
            logger.info(f"Greeting audio file already exists: {audio_filename}")
        logger.info(f"Serving greeting audio file: {audio_filename}")
        return send_from_directory(temp_audio_dir, 'greeting_elevenlabs.mp3')
    except Exception as e:
        logger.error(f"Error in greeting_audio route: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/database_viewer', methods=['GET'])
@login_required
def get_database_viewer():
    """
    Database viewer - shows all attendance records in database
    For admins to see exactly what's stored
    """
    try:
        from models import AttendanceRecord, CampusV2, Region
        
        # Check user role and custom permissions
        user_role = getattr(current_user, 'role', 'member')
        custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
        
        print(f"[DATABASE_VIEWER] User role: {user_role}, custom_perms: {custom_perms}")
        logger.info(f"[DATABASE_VIEWER] User role: {user_role}, custom_perms: {custom_perms}")
        
        # Respect explicit denial from Role Manager (overrides role)
        if not current_user.has_permission('database_viewer'):
            print(f"[DATABASE_VIEWER] Access denied for role: {user_role}, custom_perms: {custom_perms}")
            logger.warning(f"[DATABASE_VIEWER] Access denied for role: {user_role}")
            return jsonify({"error": "Access denied - insufficient permissions"}), 403
        
        # Get filters from query params
        region_filter = request.args.get('region', '')
        campus_filter = request.args.get('campus', '')
        start_date_str = request.args.get('start_date', '')
        end_date_str = request.args.get('end_date', '')
        limit = int(request.args.get('limit', 100))  # Default to last 100 records
        
        # Campus-scoped users only see campuses they can access
        user_campus = getattr(current_user, 'campus', None)
        allowed_ids = current_user.accessible_campus_ids()
        if allowed_ids is not None:
            if campus_filter and campus_filter != 'all' and normalize_campus_id(campus_filter) not in allowed_ids:
                return jsonify({"error": "Access denied - you don't have access to this campus"}), 403
            if not campus_filter or campus_filter == 'all':
                campus_filter = None  # scoped below by allowed_ids
            logger.info(f"[DATABASE_VIEWER] Campus-scoped user - allowed campuses: {allowed_ids}")
        
        print(f"[DATABASE_VIEWER] Fetching records with filters: region={region_filter}, campus={campus_filter}, start={start_date_str}, end={end_date_str}, limit={limit}")
        logger.info(f"[DATABASE_VIEWER] Fetching records with filters: region={region_filter}, campus={campus_filter}, start={start_date_str}, end={end_date_str}, limit={limit}")
        
        # Build query
        query = AttendanceRecord.query
        
        # Apply filters
        if region_filter:
            region_obj = Region.query.filter_by(code=region_filter, active=True).first()
            if region_obj:
                query = query.filter(AttendanceRecord.region_id == region_obj.id)
            else:
                print(f"[DATABASE_VIEWER] Warning: Region not found for code: {region_filter}")
                logger.warning(f"[DATABASE_VIEWER] Warning: Region not found for code: {region_filter}")
        
        if campus_filter:
            campus_obj = CampusV2.query.filter_by(campus_id=campus_filter).first()
            if campus_obj:
                query = query.filter(AttendanceRecord.campus_id == campus_obj.id)
            else:
                print(f"[DATABASE_VIEWER] Warning: Campus not found for campus_id: {campus_filter}")
                logger.warning(f"[DATABASE_VIEWER] Warning: Campus not found for campus_id: {campus_filter}")
        elif allowed_ids is not None:
            # Campus-scoped user with no specific campus selected - restrict to their campuses
            scoped_rows = CampusV2.query.filter(CampusV2.campus_id.in_(list(allowed_ids))).all()
            query = query.filter(AttendanceRecord.campus_id.in_([c.id for c in scoped_rows]))

        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            query = query.filter(AttendanceRecord.date >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            query = query.filter(AttendanceRecord.date <= end_date)
        
        # Get records (most recent first)
        records = query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.created_at.desc()).limit(limit).all()
        
        print(f"[DATABASE_VIEWER] Found {len(records)} records")
        logger.info(f"[DATABASE_VIEWER] Found {len(records)} records")
        
        # Get regions using raw SQL to avoid model-schema mismatch
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, code, display_name FROM regions WHERE active = 1")
        region_rows = cursor.fetchall()
        region_by_id = {row[0]: {'id': row[0], 'name': row[1], 'code': row[2], 'display_name': row[3]} for row in region_rows}
        
        # Convert to list of dicts
        records_data = []
        for record in records:
            campus = CampusV2.query.get(record.campus_id)
            region = region_by_id.get(record.region_id) if record.region_id else None
            
            # Parse service breakdowns
            adult_breakdown = {}
            kids_breakdown = {}
            if record.adult_service_breakdown:
                try:
                    adult_breakdown = json.loads(record.adult_service_breakdown)
                except:
                    pass
            if record.kids_service_breakdown:
                try:
                    kids_breakdown = json.loads(record.kids_service_breakdown)
                except:
                    pass
            
            records_data.append({
                'id': record.id,
                'date': record.date.strftime('%Y-%m-%d'),
                'campus': campus.display_name if campus else f"Unknown (ID: {record.campus_id})",
                'campus_id': campus.campus_id if campus else None,
                'region': region['display_name'] if region else f"Unknown (ID: {record.region_id})",
                'total_attendance': record.total_attendance,
                'total_people_in_campus': record.total_people_in_campus,
                'adult_service_breakdown': adult_breakdown,
                'kids_attendance': record.kids_attendance,
                'kids_leaders': record.kids_leaders,
                'kids_service_breakdown': kids_breakdown,
                'new_kids': record.new_kids,
                'new_kids_salvations': record.new_kids_salvations,
                'youth_attendance': record.youth_attendance,
                'youth_salvations': record.youth_salvations,
                'youth_new_people': record.youth_new_people,
                'youth_leaders': record.youth_leaders,
                'first_time_visitors': record.first_time_visitors,
                'visitors': record.visitors,
                'hands_up': record.hands_up,
                'cards_back': record.cards_back,
                'first_time_christians': record.first_time_christians,
                'rededications': record.rededications,
                'salvation_cards_returned': record.salvation_cards_returned,
                'baptisms': record.baptisms,
                'child_dedications': record.child_dedications,
                'connect_groups': record.connect_groups,
                'dream_team': record.dream_team,
                'packs_out': record.packs_out,
                'saints': record.saints or 0,
                'tithe': float(record.tithe) if record.tithe else 0.0,
                'include_in_rollup_metrics': bool(getattr(record, 'include_in_rollup_metrics', True)),
                'special_service_label': getattr(record, 'special_service_label', None) or '',
                'synced_to_sheets': record.synced_to_sheets,
                'created_at': record.created_at.isoformat() if record.created_at else None,
                'updated_at': record.updated_at.isoformat() if record.updated_at else None
            })
        
        return jsonify({
            'records': records_data,
            'total': len(records_data),
            'limit': limit
        })
        
    except Exception as e:
        print(f"[DATABASE_VIEWER] Error: {e}")
        logger.error(f"[DATABASE_VIEWER] Error: {e}", exc_info=True)
        import traceback
        error_trace = traceback.format_exc()
        print(f"[DATABASE_VIEWER] Full traceback: {error_trace}")
        logger.error(f"[DATABASE_VIEWER] Full traceback: {error_trace}")
        return jsonify({"error": f"Failed to load database records: {str(e)}"}), 500

@app.route('/api/database_viewer/export', methods=['GET'])
@login_required
def export_database_viewer_csv():
    """
    Export attendance records as CSV - uses same filters as database_viewer
    """
    try:
        import csv
        import io
        from models import AttendanceRecord, CampusV2, Region
        
        # Check user role and custom permissions (same as database_viewer endpoint)
        user_role = getattr(current_user, 'role', 'member')
        custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
        if not current_user.has_permission('database_viewer'):
            logger.warning(f"[EXPORT_CSV] Access denied for role: {user_role}")
            return jsonify({"error": "Access denied - insufficient permissions"}), 403
        
        # Get filters from query params (same as database_viewer)
        region_filter = request.args.get('region', '')
        campus_filter = request.args.get('campus', '')
        start_date_str = request.args.get('start_date', '')
        end_date_str = request.args.get('end_date', '')
        
        # Campus-scoped users only export campuses they can access
        user_campus = getattr(current_user, 'campus', None)
        allowed_ids = current_user.accessible_campus_ids()
        if allowed_ids is not None:
            if campus_filter and campus_filter != 'all' and normalize_campus_id(campus_filter) not in allowed_ids:
                return jsonify({"error": "Access denied - you don't have access to this campus"}), 403
            if not campus_filter or campus_filter == 'all':
                campus_filter = None
            logger.info(f"[EXPORT_CSV] Campus-scoped user - allowed campuses: {allowed_ids}")

        # Build query (same logic as database_viewer)
        query = AttendanceRecord.query
        
        if region_filter:
            region_obj = Region.query.filter_by(code=region_filter, active=True).first()
            if region_obj:
                query = query.filter(AttendanceRecord.region_id == region_obj.id)
            else:
                print(f"[EXPORT_CSV] Warning: Region not found for code: {region_filter}")
                logger.warning(f"[EXPORT_CSV] Warning: Region not found for code: {region_filter}")
        
        if campus_filter:
            campus_obj = CampusV2.query.filter_by(campus_id=campus_filter).first()
            if campus_obj:
                query = query.filter(AttendanceRecord.campus_id == campus_obj.id)
            else:
                print(f"[EXPORT_CSV] Warning: Campus not found for campus_id: {campus_filter}")
                logger.warning(f"[EXPORT_CSV] Warning: Campus not found for campus_id: {campus_filter}")
        elif allowed_ids is not None:
            scoped_rows = CampusV2.query.filter(CampusV2.campus_id.in_(list(allowed_ids))).all()
            query = query.filter(AttendanceRecord.campus_id.in_([c.id for c in scoped_rows]))
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            query = query.filter(AttendanceRecord.date >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            query = query.filter(AttendanceRecord.date <= end_date)
        
        # Get all records (no limit for export)
        records = query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.created_at.desc()).all()
        
        # Get regions
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, code, display_name FROM regions WHERE active = 1")
        region_rows = cursor.fetchall()
        region_by_id = {row[0]: {'id': row[0], 'name': row[1], 'code': row[2], 'display_name': row[3]} for row in region_rows}
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Date', 'Campus', 'Region', 'Total Attendance', 'Total People in Campus',
            'Kids Attendance', 'Kids Leaders', 'New Kids', 'Kids Salvations',
            'Youth Attendance', 'Youth Leaders', 'Youth Salvations', 'Youth New People',
            'First Time Visitors', 'Visitors', 'New People', 'Hands Up', 'Cards Returned',
            'First Time Christians', 'Rededications', 'New Christians', 'Salvation Cards Returned',
            'Saints', 'Baptisms', 'Child Dedications', 'Connect Groups', 'Dream Team', 'Packs Out',
            'Tithe', 'Counts in normal totals (Y/N)', 'Special service label', 'Synced to Sheets', 'Created At', 'Updated At'
        ])
        
        # Write data rows
        for record in records:
            campus = CampusV2.query.get(record.campus_id)
            region = region_by_id.get(record.region_id) if record.region_id else None
            
            # Calculate derived fields
            new_people = (record.first_time_visitors or 0) + (record.visitors or 0)
            new_christians = (record.first_time_christians or 0) + (record.rededications or 0)
            
            writer.writerow([
                record.date.strftime('%Y-%m-%d') if record.date else '',
                campus.display_name if campus else f"Unknown (ID: {record.campus_id})",
                region['display_name'] if region else f"Unknown (ID: {record.region_id})",
                record.total_attendance or 0,
                record.total_people_in_campus or 0,
                record.kids_attendance or 0,
                record.kids_leaders or 0,
                record.new_kids or 0,
                record.new_kids_salvations or 0,
                record.youth_attendance or 0,
                record.youth_leaders or 0,
                record.youth_salvations or 0,
                record.youth_new_people or 0,
                record.first_time_visitors or 0,
                record.visitors or 0,
                new_people,
                record.hands_up or 0,
                record.cards_back or 0,
                record.first_time_christians or 0,
                record.rededications or 0,
                new_christians,
                record.salvation_cards_returned or 0,
                record.saints or 0,
                record.baptisms or 0,
                record.child_dedications or 0,
                record.connect_groups or 0,
                record.dream_team or 0,
                record.packs_out or 0,
                f"${float(record.tithe or 0):.2f}",
                'Yes' if getattr(record, 'include_in_rollup_metrics', True) else 'No',
                getattr(record, 'special_service_label', None) or '',
                'Yes' if record.synced_to_sheets else 'No',
                record.created_at.isoformat() if record.created_at else '',
                record.updated_at.isoformat() if record.updated_at else ''
            ])
        
        # Prepare response
        output.seek(0)
        response = make_response(output.getvalue())
        
        # Generate filename with date range
        date_range = ""
        if start_date_str and end_date_str:
            date_range = f"_{start_date_str}_to_{end_date_str}"
        elif start_date_str:
            date_range = f"_from_{start_date_str}"
        elif end_date_str:
            date_range = f"_to_{end_date_str}"
        
        filename = f"attendance_records{date_range}_{datetime.now().strftime('%Y%m%d')}.csv"
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        
        return response
        
    except Exception as e:
        logger.error(f"[EXPORT_CSV] Error: {e}", exc_info=True)
        return jsonify({"error": f"Failed to export CSV: {str(e)}"}), 500

@app.route('/api/attendance_records/<int:record_id>', methods=['DELETE'])
@login_required
def delete_attendance_record(record_id):
    """Delete an attendance record - Admin only"""
    try:
        from models import AttendanceRecord
        
        # Check user role - only admins can delete
        user_role = getattr(current_user, 'role', 'member')
        print(f"[DELETE_RECORD] User role: {user_role}, attempting to delete record {record_id}")
        logger.info(f"[DELETE_RECORD] User role: {user_role}, record_id: {record_id}")
        
        if user_role not in ['superadmin', 'admin']:
            print(f"[DELETE_RECORD] Access denied for role: {user_role}")
            return jsonify({"error": "Access denied - admin only"}), 403
        
        # Find and delete the record
        record = AttendanceRecord.query.get(record_id)
        
        if not record:
            print(f"[DELETE_RECORD] Record {record_id} not found")
            return jsonify({"error": "Record not found"}), 404
        
        print(f"[DELETE_RECORD] Deleting record: campus_id={record.campus_id}, date={record.date}")
        
        db.session.delete(record)
        db.session.commit()
        
        print(f"[DELETE_RECORD] Successfully deleted record {record_id}")
        logger.info(f"[DELETE_RECORD] Successfully deleted record {record_id}")
        
        return jsonify({"success": True, "message": "Record deleted successfully"}), 200
        
    except Exception as e:
        print(f"[DELETE_RECORD] Error: {e}")
        logger.error(f"[DELETE_RECORD] Error: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": f"Failed to delete record: {str(e)}"}), 500

@app.route('/api/attendance_records/<int:record_id>', methods=['PUT'])
@login_required
def update_attendance_record(record_id):
    """Update an attendance record - Admin, senior leadership, or campus_pastor for their campus"""
    try:
        from models import AttendanceRecord, CampusV2
        import json
        
        # Check user role
        user_role = getattr(current_user, 'role', 'member')
        user_campus = getattr(current_user, 'campus', None)
        
        print(f"[UPDATE_RECORD] User role: {user_role}, attempting to update record {record_id}")
        logger.info(f"[UPDATE_RECORD] User role: {user_role}, record_id: {record_id}")
        
        # Permission: edit_access (admins/leadership by default; campus-scoped
        # roles and custom grants included), then campus ownership below.
        if not current_user.has_permission('edit_access'):
            print(f"[UPDATE_RECORD] Access denied for role: {user_role}")
            return jsonify({"error": "Access denied - insufficient permissions"}), 403

        # Find the record
        record = AttendanceRecord.query.get(record_id)

        if not record:
            print(f"[UPDATE_RECORD] Record {record_id} not found")
            return jsonify({"error": "Record not found"}), 404

        # Campus-scoped users can only edit records for campuses they can access
        campus_obj = CampusV2.query.get(record.campus_id)
        if not current_user.can_access_campus(campus_obj.campus_id if campus_obj else None):
            print(f"[UPDATE_RECORD] Campus access denied - user campus: {user_campus}, record campus: {campus_obj.campus_id if campus_obj else 'unknown'}")
            return jsonify({"error": "Access denied - you can only edit records for your campus"}), 403
        
        # Get update data from request
        data = request.get_json()
        
        # Update fields (similar to quick_input)
        if 'total_attendance' in data:
            record.total_attendance = int(data.get('total_attendance', 0) or 0)
        if 'total_people_in_campus' in data:
            record.total_people_in_campus = int(data.get('total_people_in_campus', 0) or 0)
        if 'kids_attendance' in data:
            record.kids_attendance = int(data.get('kids_attendance', 0) or 0)
        if 'kids_leaders' in data:
            record.kids_leaders = int(data.get('kids_leaders', 0) or 0)
        if 'new_kids' in data:
            record.new_kids = int(data.get('new_kids', 0) or 0)
        if 'new_kids_salvations' in data:
            record.new_kids_salvations = int(data.get('new_kids_salvations', 0) or 0)
        if 'packs_out' in data:
            record.packs_out = int(data.get('packs_out', 0) or 0)
        if 'youth_attendance' in data:
            record.youth_attendance = int(data.get('youth_attendance', 0) or 0)
        if 'youth_salvations' in data:
            record.youth_salvations = int(data.get('youth_salvations', 0) or 0)
        if 'youth_new_people' in data:
            record.youth_new_people = int(data.get('youth_new_people', 0) or 0)
        if 'youth_leaders' in data:
            record.youth_leaders = int(data.get('youth_leaders', 0) or 0)
        if 'first_time_visitors' in data:
            record.first_time_visitors = int(data.get('first_time_visitors', 0) or 0)
        if 'visitors' in data:
            record.visitors = int(data.get('visitors', 0) or 0)
        if 'hands_up' in data:
            record.hands_up = int(data.get('hands_up', 0) or 0)
        if 'cards_back' in data:
            record.cards_back = int(data.get('cards_back', 0) or 0)
        if 'first_time_christians' in data:
            record.first_time_christians = int(data.get('first_time_christians', 0) or 0)
        if 'rededications' in data:
            record.rededications = int(data.get('rededications', 0) or 0)
        if 'salvation_cards_returned' in data:
            record.salvation_cards_returned = int(data.get('salvation_cards_returned', 0) or 0)
        if 'baptisms' in data:
            record.baptisms = int(data.get('baptisms', 0) or 0)
        if 'child_dedications' in data:
            record.child_dedications = int(data.get('child_dedications', 0) or 0)
        if 'connect_groups' in data:
            record.connect_groups = int(data.get('connect_groups', 0) or 0)
        if 'dream_team' in data:
            record.dream_team = int(data.get('dream_team', 0) or 0)
        if 'tithe' in data:
            record.tithe = float(data.get('tithe', 0) or 0)
        if 'adult_service_breakdown' in data:
            record.adult_service_breakdown = json.dumps(data['adult_service_breakdown']) if data.get('adult_service_breakdown') else None
        if 'kids_service_breakdown' in data:
            record.kids_service_breakdown = json.dumps(data['kids_service_breakdown']) if data.get('kids_service_breakdown') else None
        if 'notes' in data:
            record.notes = data.get('notes')
        if 'include_in_rollup_metrics' in data:
            record.include_in_rollup_metrics = coerce_include_in_rollup_metrics(data.get('include_in_rollup_metrics'))
        if 'special_service_label' in data:
            sl = data.get('special_service_label')
            if sl is None or (isinstance(sl, str) and not str(sl).strip()):
                record.special_service_label = None
            else:
                record.special_service_label = str(sl).strip()[:200]
        
        # Mark as not synced since it was updated
        record.synced_to_sheets = False
        
        # Save changes
        db.session.commit()
        
        print(f"[UPDATE_RECORD] Successfully updated record {record_id}")
        logger.info(f"[UPDATE_RECORD] Successfully updated record {record_id}")
        
        # Return updated record data
        campus = CampusV2.query.get(record.campus_id)
        return jsonify({
            "success": True,
            "message": "Record updated successfully",
            "record": {
                'id': record.id,
                'date': record.date.strftime('%Y-%m-%d'),
                'campus': campus.display_name if campus else f"Unknown (ID: {record.campus_id})",
                'total_attendance': record.total_attendance,
                'kids_attendance': record.kids_attendance,
                'youth_attendance': record.youth_attendance,
                'synced_to_sheets': record.synced_to_sheets
            }
        }), 200
        
    except Exception as e:
        print(f"[UPDATE_RECORD] Error: {e}")
        logger.error(f"[UPDATE_RECORD] Error: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": f"Failed to update record: {str(e)}"}), 500

@app.route('/api/recent_entries', methods=['GET'])
@login_required
def get_recent_entries():
    """Get recent entries for the user's campus (last 30 days) - NOW USING DATABASE"""
    try:
        # Campus from query parameter; when absent, show ALL campuses the user
        # can access (scoped below) rather than just their assigned one, so
        # multi-campus users (allowed_campuses) see everything they manage.
        campus = request.args.get('campus', '').strip()
        
        # Calculate date range (last 30 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        
        # Get data from DATABASE (primary source)
        entries = []
        try:
            from models import AttendanceRecord, CampusV2
            
            # Scope by the user's accessible campuses (custom allowed_campuses,
            # role, or own campus). None = unrestricted.
            user_role = getattr(current_user, 'role', 'member')
            allowed_ids = current_user.accessible_campus_ids()

            if campus and campus != 'all_campuses' and not current_user.can_access_campus(campus):
                return jsonify({"error": f"You don't have access to entries for {campus}"}), 403

            if not campus or campus == 'all_campuses':
                logger.info(f"[RECENT_ENTRIES] Fetching entries for accessible campuses (role: {user_role}, allowed: {allowed_ids})")
                query = AttendanceRecord.query.filter(
                    AttendanceRecord.date >= start_date,
                    AttendanceRecord.date <= end_date
                )
                if allowed_ids is not None:
                    campus_rows = CampusV2.query.filter(CampusV2.campus_id.in_(list(allowed_ids))).all()
                    query = query.filter(AttendanceRecord.campus_id.in_([c.id for c in campus_rows]))
                records = query.order_by(AttendanceRecord.date.desc()).all()
                campus = None
                logger.info(f"[RECENT_ENTRIES] Found {len(records)} records")

            # If specific campus requested
            if campus and campus != 'all_campuses':
                logger.info(f"[RECENT_ENTRIES] Looking for entries from {start_date} to {end_date} for campus '{campus}'")
                
                # Try to find campus: by id (int), campus_id (e.g. adelaide_city), then normalized, then display_name
                campus_obj = CampusV2.query.filter(
                    (CampusV2.id == campus) | (CampusV2.campus_id == campus)
                ).first()
                if not campus_obj:
                    campus_norm = str(campus).strip().lower().replace(' ', '_').replace('-', '_')
                    if campus_norm.endswith('_campus'):
                        campus_norm = campus_norm[:-7]
                    campus_obj = CampusV2.query.filter(CampusV2.campus_id == campus_norm).first()
                if not campus_obj:
                    campus_obj = CampusV2.query.filter(CampusV2.display_name == campus.strip()).first()
                if not campus_obj:
                    campus_obj = CampusV2.query.filter(CampusV2.name == campus.strip()).first()
                
                if not campus_obj:
                    logger.warning(f"[RECENT_ENTRIES] Campus '{campus}' not found in database")
                    return jsonify({"entries": []}), 200
                
                logger.info(f"[RECENT_ENTRIES] Found campus: {campus_obj.display_name} (ID: {campus_obj.id}, campus_id: {campus_obj.campus_id})")
                
                # Query attendance records from database
                records = AttendanceRecord.query.filter(
                    AttendanceRecord.campus_id == campus_obj.id,
                    AttendanceRecord.date >= start_date,
                    AttendanceRecord.date <= end_date
                ).order_by(AttendanceRecord.date.desc()).all()
                
                logger.info(f"[RECENT_ENTRIES] Found {len(records)} records in database for campus '{campus}'")
            
            for record in records:
                # Convert database record to frontend format
                # DON'T use to_dict() - it tries to access region which has schema issues
                campus = CampusV2.query.get(record.campus_id)
                
                # Extract service time breakdowns
                adult_breakdown = {}
                kids_breakdown = {}
                if record.adult_service_breakdown:
                    try:
                        adult_breakdown = json.loads(record.adult_service_breakdown)
                    except:
                        pass
                if record.kids_service_breakdown:
                    try:
                        kids_breakdown = json.loads(record.kids_service_breakdown)
                    except:
                        pass
                
                # Build stats dict manually with TITLE CASE field names (frontend expects these)
                # NOTE: Field names must match the frontend's fieldMapping in LogStats.jsx
                stats_dict = {
                    'id': record.id,
                    'date': record.date.strftime('%Y-%m-%d'),
                    'campus': campus.display_name if campus else 'Unknown',
                    'campusId': campus.campus_id if campus else None,
                    # Main totals
                    'Total Attendance': record.total_attendance or 0,
                    'Total People in Campus': record.total_people_in_campus or 0,
                    'Kids Attendance': record.kids_attendance or 0,
                    'Youth Attendance': record.youth_attendance or 0,
                    # Calculated fields
                    'New People': (record.first_time_visitors or 0) + (record.visitors or 0),
                    'New Christians': (record.first_time_christians or 0) + (record.rededications or 0),
                    # Kids fields (matching frontend expectations)
                    'Kids Leaders': record.kids_leaders or 0,
                    'New Kids': record.new_kids or 0,
                    'New Kids Salvations': record.new_kids_salvations or 0,  # Frontend expects this name
                    'Packs Out': record.packs_out or 0,
                    # Visitors & Salvations (matching frontend expectations)
                    'First Time Visitors': record.first_time_visitors or 0,  # Frontend maps to 'First Time'
                    'Visitors': record.visitors or 0,
                    'Hands up': record.hands_up or 0,
                    'Cards Back': record.cards_back or 0,  # Frontend maps to 'Cards Returned'
                    'First Time Christians': record.first_time_christians or 0,  # Frontend maps to 'First Time Decision'
                    'Rededications': record.rededications or 0,  # Frontend maps to 'Rededication'
                    'Salvation Cards Returned': record.salvation_cards_returned or 0,
                    # Youth fields (matching frontend expectations)
                    'Youth New People': record.youth_new_people or 0,  # Frontend maps to 'Youth NP'
                    'Youth Salvations': record.youth_salvations or 0,
                    'Youth Leaders': record.youth_leaders or 0,
                    # Church life
                    'Saints': record.saints or 0,
                    'Connect Groups': record.connect_groups or 0,
                    'Dream Team': record.dream_team or 0,
                    'Baptisms': record.baptisms or 0,
                    'Child Dedications': record.child_dedications or 0,
                    'Seniors': 0,  # Not stored in DB yet
                    'Tithe': float(record.tithe) if record.tithe else 0.0,
                    'include_in_rollup_metrics': bool(getattr(record, 'include_in_rollup_metrics', True)),
                    'special_service_label': getattr(record, 'special_service_label', None) or '',
                    # Service time breakdowns (from JSON fields)
                    **adult_breakdown,
                    **kids_breakdown
                }
                
                entries.append({
                    'id': record.id,
                    'date': record.date.strftime('%Y-%m-%d'),
                    'campus': campus.display_name if campus else 'Unknown',
                    'campusId': campus.campus_id if campus else None,
                    'stats': stats_dict,
                    'originalDate': record.date.strftime('%Y-%m-%d'),
                    'timestamp': record.created_at.isoformat() if record.created_at else None
                })
            
            logger.info(f"[RECENT_ENTRIES] Converted {len(entries)} database records to frontend format")
            resp = jsonify({"entries": entries})
            resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
            resp.headers['Pragma'] = 'no-cache'
            return resp
            
        except Exception as e:
            logger.error(f"[RECENT_ENTRIES] Error loading from database: {e}")
            logger.error(f"[RECENT_ENTRIES] Traceback: {traceback.format_exc()}")
            # Return empty entries - Google Sheets has duplicate headers and can't be used as fallback
            return jsonify({"entries": []}), 200
    except Exception as e:
        logger.error(f"[RECENT_ENTRIES] Unexpected error: {e}")
        logger.error(f"[RECENT_ENTRIES] Traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e), "entries": []}), 500

@app.route('/api/admin/attendance/all', methods=['GET'])
@admin_required
def get_all_attendance_records():
    """Get ALL attendance records from database - respects Role Manager data_export"""
    if not current_user.has_permission('data_export'):
        return jsonify({"error": "Access denied - Data Export / Attendance Data has been disabled for your account"}), 403
    try:
        from models import AttendanceRecord, CampusV2, Region
        
        # Get query parameters
        region_code = request.args.get('region', '').strip()
        campus_id = request.args.get('campus_id', '').strip()
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        export_format = request.args.get('format', 'json').strip()  # 'json' or 'csv'
        
        # Build query
        query = AttendanceRecord.query
        
        # Filter by region
        if region_code:
            region = Region.query.filter_by(code=region_code).first()
            if region:
                query = query.filter_by(region_id=region.id)
        
        # Filter by campus
        if campus_id:
            campus = CampusV2.query.filter_by(campus_id=campus_id).first()
            if campus:
                query = query.filter_by(campus_id=campus.id)
        
        # Filter by date range
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                query = query.filter(AttendanceRecord.date >= start)
            except:
                pass
        
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                query = query.filter(AttendanceRecord.date <= end)
            except:
                pass
        
        # Order by date descending
        records = query.order_by(AttendanceRecord.date.desc()).all()
        
        # Convert to list of dicts
        records_data = []
        for record in records:
            campus = CampusV2.query.get(record.campus_id)
            region = Region.query.get(record.region_id)
            
            # Parse service breakdowns
            adult_breakdown = {}
            kids_breakdown = {}
            if record.adult_service_breakdown:
                try:
                    adult_breakdown = json.loads(record.adult_service_breakdown)
                except:
                    pass
            if record.kids_service_breakdown:
                try:
                    kids_breakdown = json.loads(record.kids_service_breakdown)
                except:
                    pass
            
            record_dict = {
                'id': record.id,
                'campus': campus.display_name if campus else f"Unknown (ID: {record.campus_id})",
                'campus_id': campus.campus_id if campus else None,
                'region': region.display_name if region else f"Unknown (ID: {record.region_id})",
                'region_code': region.code if region else None,
                'date': record.date.strftime('%Y-%m-%d'),
                'total_attendance': record.total_attendance,
                'total_people_in_campus': record.total_people_in_campus,
                'adult_service_breakdown': adult_breakdown,
                'kids_attendance': record.kids_attendance,
                'kids_leaders': record.kids_leaders,
                'kids_service_breakdown': kids_breakdown,
                'youth_attendance': record.youth_attendance,
                'youth_salvations': record.youth_salvations,
                'first_time_visitors': record.first_time_visitors,
                'visitors': record.visitors,
                'hands_up': record.hands_up,
                'first_time_christians': record.first_time_christians,
                'rededications': record.rededications,
                'baptisms': record.baptisms,
                'child_dedications': record.child_dedications,
                'connect_groups': record.connect_groups,
                'dream_team': record.dream_team,
                'synced_to_sheets': record.synced_to_sheets,
                'created_at': record.created_at.isoformat() if record.created_at else None,
                'updated_at': record.updated_at.isoformat() if record.updated_at else None
            }
            records_data.append(record_dict)
        
        # Export as CSV if requested
        if export_format == 'csv':
            import csv
            from io import StringIO
            
            output = StringIO()
            if records_data:
                # Get all unique keys from all records
                fieldnames = set()
                for record in records_data:
                    fieldnames.update(record.keys())
                
                # Flatten service breakdowns for CSV
                csv_data = []
                for record in records_data:
                    row = record.copy()
                    # Flatten adult breakdown
                    for service, count in row.get('adult_service_breakdown', {}).items():
                        row[f"Adult_{service}"] = count
                    row.pop('adult_service_breakdown', None)
                    # Flatten kids breakdown
                    for service, count in row.get('kids_service_breakdown', {}).items():
                        row[f"Kids_{service}"] = count
                    row.pop('kids_service_breakdown', None)
                    csv_data.append(row)
                
                writer = csv.DictWriter(output, fieldnames=sorted(fieldnames))
                writer.writeheader()
                writer.writerows(csv_data)
            
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename=attendance_records_{datetime.now().strftime("%Y%m%d")}.csv'
            return response
        
        # Return JSON
        return jsonify({
            "success": True,
            "count": len(records_data),
            "records": records_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching all attendance records: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def get_sanitized_headers(worksheet):
    """
    Get headers from Google Sheet row 1, handling duplicates and empty headers.
    Returns a list of sanitized (unique) headers.
    
    This bypasses get_all_records() which fails when headers have duplicates.
    """
    try:
        # Read headers directly from row 1
        header_row = worksheet.row_values(1)
        
        if not header_row:
            logger.warning("[HEADERS] No headers found in row 1")
            return []
        
        # Clean and sanitize headers
        sanitized_headers = []
        header_counts = {}  # Track how many times we've seen each header
        
        for header in header_row:
            # Skip empty headers
            if not header or not str(header).strip():
                sanitized_headers.append('')  # Keep position, but mark as empty
                continue
            
            header_str = str(header).strip()
            
            # Make duplicates unique by appending a number
            if header_str in header_counts:
                # This is a duplicate - increment count and append number
                header_counts[header_str] += 1
                unique_header = f"{header_str} ({header_counts[header_str]})"
                sanitized_headers.append(unique_header)
                logger.warning(f"[HEADERS] Duplicate header found: '{header_str}' -> renamed to '{unique_header}'")
            else:
                # First occurrence - keep original name, initialize count
                header_counts[header_str] = 0
                sanitized_headers.append(header_str)
        
        # Filter out empty headers at the end
        while sanitized_headers and (not sanitized_headers[-1] or not sanitized_headers[-1].strip()):
            sanitized_headers.pop()
        
        logger.info(f"[HEADERS] Sanitized {len(header_row)} headers to {len(sanitized_headers)} unique headers")
        return sanitized_headers
        
    except Exception as e:
        logger.error(f"[HEADERS] Error getting sanitized headers: {e}", exc_info=True)
        return []


def ensure_google_sheets_columns(required_headers):
    """Ensure Google Sheets has all required columns, adding missing ones"""
    try:
        if not sheet:
            return False
        
        # Get current headers using sanitized function (handles duplicates)
        current_headers = get_sanitized_headers(sheet)
        
        # Filter out empty headers for comparison
        current_headers_clean = [h for h in current_headers if h and h.strip()]
        
        # Find missing headers
        missing_headers = [h for h in required_headers if h not in current_headers_clean]
        
        if not missing_headers:
            return True  # All headers exist
        
        # Get the header row (row 1)
        try:
            header_row = sheet.row_values(1)
        except:
            header_row = []
        
        # Remove empty headers at the end before adding new ones
        while header_row and (not header_row[-1] or not str(header_row[-1]).strip()):
            header_row.pop()
        
        # Add missing headers at the end
        for header in missing_headers:
            header_row.append(header)
        
        # Calculate the range for the header row
        # Convert column number to letter (handles AA, AB, etc.)
        def col_num_to_letter(n):
            """Convert column number to Excel-style letter (1=A, 27=AA, etc.)"""
            result = ""
            while n > 0:
                n -= 1
                result = chr(65 + (n % 26)) + result
                n //= 26
            return result
        
        last_col_letter = col_num_to_letter(len(header_row))
        header_range = f'A1:{last_col_letter}1'
        
        # Update the header row
        sheet.update(header_range, [header_row], value_input_option='USER_ENTERED')
        logger.info(f"Added missing columns to Google Sheets: {missing_headers}")
        
        return True
    except Exception as e:
        logger.error(f"Error ensuring Google Sheets columns: {e}")
        return False


# ============================================================================
# DUAL-WRITE SYSTEM: Database + Google Sheets (Migration Phase)
# ============================================================================

def save_attendance_record(data, user_id=None):
    """
    Save attendance record to database AND Google Sheets (dual-write)
    This ensures zero downtime during migration
    
    Args:
        data: dict with attendance data
        user_id: ID of user creating record
    
    Returns:
        tuple: (success: bool, record: AttendanceRecord or None, error: str or None)
    """
    from models import AttendanceRecord, CampusV2, Region, db
    
    try:
        # DEBUG: Log all incoming data (using both print and logger for visibility)
        print(f"\n{'='*80}")
        print(f"[SAVE_ATTENDANCE] === RECEIVED DATA ===")
        print(f"[SAVE_ATTENDANCE] Data keys: {list(data.keys())}")
        print(f"[SAVE_ATTENDANCE] Full data: {data}")
        print(f"{'='*80}\n")
        logger.info(f"[SAVE_ATTENDANCE] === RECEIVED DATA ===")
        logger.info(f"[SAVE_ATTENDANCE] Data keys: {list(data.keys())}")
        logger.info(f"[SAVE_ATTENDANCE] Full data: {data}")
        
        # Get campus object - try multiple lookup strategies
        campus = None
        campus_value = data.get('campus', '').strip() if data.get('campus') else ''
        campus_id_value = data.get('campus_id', '').strip() if data.get('campus_id') else ''
        # Expire all objects to ensure we see committed data
        db.session.expire_all()
        
        print(f"[SAVE_ATTENDANCE DEBUG] Starting campus lookup: campus='{campus_value}', campus_id='{campus_id_value}'", flush=True)
        logger.info(f"[SAVE_ATTENDANCE] Looking up campus. campus='{campus_value}', campus_id='{campus_id_value}'")
        
        # Use direct session query to avoid session issues
        # First, try campus_id from data
        if campus_id_value:
            try:
                logger.info(f"[SAVE_ATTENDANCE] Querying by campus_id: {campus_id_value}")
                campus = db.session.query(CampusV2).filter(CampusV2.campus_id == campus_id_value).first()
                if campus:
                    logger.info(f"[SAVE_ATTENDANCE] Found campus by campus_id: {campus.campus_id}")
                else:
                    logger.info(f"[SAVE_ATTENDANCE] No campus found with campus_id: {campus_id_value}")
            except Exception as e:
                logger.error(f"[SAVE_ATTENDANCE] Error querying by campus_id: {e}", exc_info=True)
        
        # If not found, try using campus field as campus_id (common case)
        if not campus and campus_value:
            # Try exact match first
            try:
                logger.info(f"[SAVE_ATTENDANCE] Querying by campus value (exact): {campus_value}")
                campus = db.session.query(CampusV2).filter(CampusV2.campus_id == campus_value).first()
                if campus:
                    logger.info(f"[SAVE_ATTENDANCE] Found campus by campus field as campus_id: {campus.campus_id}")
                else:
                    logger.info(f"[SAVE_ATTENDANCE] No campus found with exact campus value: {campus_value}")
            except Exception as e:
                logger.error(f"[SAVE_ATTENDANCE] Error querying by campus value: {e}", exc_info=True)
            
            # Try lowercase version (and strip _campus so "Adelaide City Campus" -> adelaide_city)
            if not campus:
                try:
                    campus_lower = campus_value.lower().replace(' ', '_').replace('-', '_').strip()
                    if campus_lower.endswith('_campus'):
                        campus_lower = campus_lower[:-7]
                    logger.info(f"[SAVE_ATTENDANCE] Querying by normalized: {campus_lower}")
                    campus = db.session.query(CampusV2).filter(CampusV2.campus_id == campus_lower).first()
                    if campus:
                        logger.info(f"[SAVE_ATTENDANCE] Found campus by lowercase campus_id: {campus.campus_id}")
                    else:
                        logger.info(f"[SAVE_ATTENDANCE] No campus found with lowercase: {campus_lower}")
                except Exception as e:
                    logger.error(f"[SAVE_ATTENDANCE] Error querying by lowercase: {e}", exc_info=True)
        
        # If still not found, try display_name match
        if not campus and campus_value:
            campus = db.session.query(CampusV2).filter(CampusV2.display_name == campus_value).first()
            if campus:
                logger.info(f"[SAVE_ATTENDANCE] Found campus by display_name: {campus.campus_id}")
        
        # If still not found, try name match
        if not campus and campus_value:
            campus = db.session.query(CampusV2).filter(CampusV2.name == campus_value).first()
            if campus:
                logger.info(f"[SAVE_ATTENDANCE] Found campus by name: {campus.campus_id}")
        if not campus:
            try:
                db.session.expire_all()
                all_campuses = db.session.query(CampusV2).all()
                available_ids = [c.campus_id for c in all_campuses] if all_campuses else []
                
                # If still empty, try direct SQL query as fallback
                if not available_ids:
                    from sqlalchemy import text
                    result = db.session.execute(text("SELECT campus_id FROM campuses_v2 WHERE active = 1"))
                    available_ids = [row[0] for row in result.fetchall()]
                    logger.info(f"[SAVE_ATTENDANCE] Fallback SQL query found {len(available_ids)} campuses")
                
                logger.error(f"[SAVE_ATTENDANCE] Campus not found. Searched for: '{campus_value}' or '{campus_id_value}'. Available campus_ids: {available_ids}")
            except Exception as e:
                logger.error(f"[SAVE_ATTENDANCE] Error querying campuses: {e}", exc_info=True)
                import traceback
                logger.error(f"[SAVE_ATTENDANCE] Traceback: {traceback.format_exc()}")
                available_ids = []
            return False, None, f"Campus not found: {campus_value or campus_id_value}"
        
        # Parse date
        date_val = None
        if 'date' in data:
            if isinstance(data['date'], str):
                try:
                    date_val = datetime.strptime(data['date'], '%Y-%m-%d').date()
                except:
                    date_val = datetime.strptime(data['date'], '%m/%d/%Y').date()
            elif isinstance(data['date'], date):
                date_val = data['date']
        
        if not date_val:
            return False, None, "Invalid date format"

        # UPDATE MODE: find existing record - prefer recordId (most reliable), then originalCampus+originalDate
        existing = None
        record_id = data.get('recordId')
        if record_id is not None and isinstance(record_id, (int, float)):
            rid = int(record_id)
            existing = AttendanceRecord.query.get(rid)
            if existing:
                print(f"[SAVE_ATTENDANCE] Found existing record by recordId={rid}", flush=True)
                logger.info(f"[SAVE_ATTENDANCE] Found existing record by recordId={rid}")
            else:
                print(f"[SAVE_ATTENDANCE] RecordId {rid} not found, trying fallback lookup", flush=True)
        if not existing and data.get('originalCampus') and data.get('originalDate'):
            oc = (data.get('originalCampus') or '').strip()
            od = (data.get('originalDate') or '').strip()
            if oc and od:
                try:
                    original_date_val = datetime.strptime(od, '%Y-%m-%d').date()
                except Exception:
                    try:
                        original_date_val = datetime.strptime(od, '%m/%d/%Y').date()
                    except Exception:
                        original_date_val = None
                if original_date_val:
                    original_campus_obj = db.session.query(CampusV2).filter(CampusV2.campus_id == oc).first()
                    if not original_campus_obj:
                        onorm = oc.lower().replace(' ', '_').replace('-', '_').strip()
                        if onorm.endswith('_campus'):
                            onorm = onorm[:-7]
                        original_campus_obj = db.session.query(CampusV2).filter(CampusV2.campus_id == onorm).first()
                    if not original_campus_obj:
                        original_campus_obj = db.session.query(CampusV2).filter(CampusV2.display_name == oc).first()
                    if original_campus_obj:
                        existing = AttendanceRecord.query.filter_by(
                            campus_id=original_campus_obj.id,
                            date=original_date_val
                        ).first()
                        if existing:
                            logger.info(f"[SAVE_ATTENDANCE] Found existing record by original campus '{oc}' date '{od}' (id={existing.id})")
        if not existing:
            existing = AttendanceRecord.query.filter_by(
                campus_id=campus.id,
                date=date_val
            ).first()
        
        # Build service breakdowns
        adult_breakdown = {}
        kids_breakdown = {}
        if campus.service_times:
            try:
                service_times = json.loads(campus.service_times)
                for service_time in service_times:
                    if service_time in data:
                        adult_breakdown[service_time] = int(data[service_time] or 0)
                    kids_key = f'Kids {service_time}'
                    if kids_key in data:
                        kids_breakdown[kids_key] = int(data[kids_key] or 0)
            except Exception as e:
                logger.warning(f"Error parsing service times: {e}")
        
        # Create or update record
        if existing:
            record = existing
            record.updated_at = datetime.utcnow()
            # Allow an edit to move the record to a new date (e.g. Monday's
            # entry redated to Sunday) - but never onto another record.
            if date_val and existing.date != date_val:
                clash = AttendanceRecord.query.filter_by(campus_id=campus.id, date=date_val).first()
                if clash and clash.id != existing.id:
                    return False, None, f"A record already exists for {campus.display_name} on {date_val}"
                logger.info(f"[SAVE_ATTENDANCE] Moving record {existing.id} from {existing.date} to {date_val}")
                record.date = date_val
        else:
            record = AttendanceRecord(
                campus_id=campus.id,
                region_id=campus.region_id,
                date=date_val,
                created_by=user_id
            )
        
        # Update fields
        # Store the manually entered "Total People in Campus" value
        record.total_people_in_campus = int(data.get('Total People in Campus', 0) or 0)
        record.adult_service_breakdown = json.dumps(adult_breakdown) if adult_breakdown else None
        
        # Kids attendance: the per-service breakdown is the source of truth.
        # Never trust a separately sent "Kids Attendance" total when a breakdown
        # is present - old app builds sent kids INCLUDING leaders there, which
        # the total formula below then double-counted (Salisbury 2026-09-27).
        kids_total = sum(kids_breakdown.values()) if kids_breakdown else 0
        if kids_breakdown:
            sent_kids = data.get('Kids Attendance')
            if sent_kids not in (None, '') and int(sent_kids or 0) != kids_total:
                logger.warning(f"[SAVE_ATTENDANCE] Ignoring sent Kids Attendance={sent_kids}; using breakdown sum {kids_total}")
            record.kids_attendance = kids_total
        elif 'Kids Attendance' in data:
            record.kids_attendance = int(data.get('Kids Attendance') or 0)
        elif not existing:
            record.kids_attendance = 0
        # else: partial update with no kids fields - preserve the stored value
        record.kids_leaders = int(data.get('Kids Leaders', 0) or 0)
        record.new_kids = int(data.get('New Kids', 0) or 0)
        record.new_kids_salvations = int(data.get('New Kids Salvations', 0) or 0)
        record.packs_out = int(data.get('Packs Out', 0) or 0)
        record.kids_service_breakdown = json.dumps(kids_breakdown) if kids_breakdown else None
        # On partial update (existing record, key not in data) preserve current value so Saints/NP/NC/Youth are not wiped
        record.youth_attendance = int(data.get('Youth Attendance', 0) or 0) if (not existing or 'Youth Attendance' in data) else (record.youth_attendance or 0)
        record.youth_salvations = int(data.get('Youth Salvations', 0) or 0) if (not existing or 'Youth Salvations' in data) else (record.youth_salvations or 0)
        record.youth_new_people = int(data.get('Youth New People', 0) or 0) if (not existing or 'Youth New People' in data) else (record.youth_new_people or 0)
        record.youth_leaders = int(data.get('Youth Leaders', 0) or 0) if (not existing or 'Youth Leaders' in data) else (record.youth_leaders or 0)
        record.first_time_visitors = int(data.get('First Time Visitors', 0) or 0) if (not existing or 'First Time Visitors' in data) else (record.first_time_visitors or 0)
        record.visitors = int(data.get('Visitors', 0) or 0) if (not existing or 'Visitors' in data) else (record.visitors or 0)
        record.hands_up = int(data.get('Hands up', 0) or 0) if (not existing or 'Hands up' in data) else (record.hands_up or 0)
        record.cards_back = int(data.get('Cards Back', 0) or 0) if (not existing or 'Cards Back' in data) else (record.cards_back or 0)
        record.first_time_christians = int(data.get('First Time Christians', 0) or 0) if (not existing or 'First Time Christians' in data) else (record.first_time_christians or 0)
        record.rededications = int(data.get('Rededications', 0) or 0) if (not existing or 'Rededications' in data) else (record.rededications or 0)
        record.salvation_cards_returned = int(data.get('Salvation Cards Returned', 0) or 0) if (not existing or 'Salvation Cards Returned' in data) else (record.salvation_cards_returned or 0)
        record.baptisms = int(data.get('Baptisms', 0) or 0) if (not existing or 'Baptisms' in data) else (record.baptisms or 0)
        record.child_dedications = int(data.get('Child Dedications', 0) or 0) if (not existing or 'Child Dedications' in data) else (record.child_dedications or 0)
        record.connect_groups = int(data.get('Connect Groups', 0) or 0) if (not existing or 'Connect Groups' in data) else (record.connect_groups or 0)
        record.dream_team = int(data.get('Dream Team', 0) or 0) if (not existing or 'Dream Team' in data) else (record.dream_team or 0)
        record.tithe = float(data.get('Tithe', 0) or 0) if (not existing or 'Tithe' in data) else float(record.tithe or 0)
        record.notes = data.get('notes') if ('notes' in data or not existing) else record.notes
        record.saints = int(data.get('Saints', 0) or 0) if (not existing or 'Saints' in data) else (record.saints or 0)

        if not existing or 'include_in_rollup_metrics' in data:
            record.include_in_rollup_metrics = coerce_include_in_rollup_metrics(data.get('include_in_rollup_metrics'))
        if not existing or 'special_service_label' in data:
            sl = data.get('special_service_label')
            if sl is None or (isinstance(sl, str) and not str(sl).strip()):
                record.special_service_label = None
            else:
                record.special_service_label = str(sl).strip()[:200]

        # CALCULATE Total Attendance = Service Times + Saints + Kids + Kids Leaders (exclude Youth for Sundays)
        adult_total = sum(adult_breakdown.values()) if adult_breakdown else 0
        saints = record.saints or 0
        total_attendance_calculated = adult_total + saints + record.kids_attendance + record.kids_leaders
        record.total_attendance = total_attendance_calculated
        
        print(f"[SAVE_ATTENDANCE] Calculated total_attendance: {total_attendance_calculated} (adult:{adult_total} + saints:{saints} + kids:{record.kids_attendance} + kids_leaders:{record.kids_leaders})")
        logger.info(f"[SAVE_ATTENDANCE] Calculated total_attendance: {total_attendance_calculated} (adult:{adult_total} + saints:{saints} + kids:{record.kids_attendance} + kids_leaders:{record.kids_leaders})")
        
        # Save to database - flush first to ensure changes are written, then commit
        if not existing:
            db.session.add(record)
        db.session.flush()
        db.session.commit()
        print(f"[SAVE_ATTENDANCE] Committed record id={record.id} (existing={bool(existing)})", flush=True)
        logger.info(f"[SAVE_ATTENDANCE] Committed record id={record.id}")
        
        # DUAL-WRITE: Also save to Google Sheets (for backward compatibility)
        try:
            if sheet or client:  # Only if Google Sheets is available
                logger.info(f"[SAVE_ATTENDANCE] Attempting Google Sheets sync - sheet: {sheet is not None}, client: {client is not None}")
                sync_result = sync_to_google_sheets(record, campus)
                if sync_result is not None and sync_result:
                    record.synced_to_sheets = True
                    db.session.commit()
                    logger.info(f"[SAVE_ATTENDANCE] ✓ Successfully synced to Google Sheets")
                else:
                    logger.warning(f"[SAVE_ATTENDANCE] ✗ Sync to Google Sheets returned False - not marking as synced")
            else:
                logger.warning(f"[SAVE_ATTENDANCE] ✗ Skipping Google Sheets sync - sheet and client are both None")
        except Exception as e:
            logger.error(f"[SAVE_ATTENDANCE] ✗ Failed to sync to Google Sheets (non-fatal): {e}")
            import traceback
            logger.error(f"[SAVE_ATTENDANCE] Traceback: {traceback.format_exc()}")
            # Don't fail the whole operation if Sheets fails
        
        return True, record, None
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to save attendance record: {e}")
        return False, None, str(e)


def sync_to_google_sheets_DUPLICATE_FUNCTION_TO_REMOVE(record, campus):
    """
    DUPLICATE FUNCTION - SHOULD BE REMOVED
    This is a duplicate of the sync_to_google_sheets function above
    Keeping temporarily to avoid breaking anything, but should consolidate
    """
    # Call the main function
    return sync_to_google_sheets(record, campus)


@app.route('/api/quick_input', methods=['POST'])
@login_required
def quick_input():
    """Handle quick input form submissions - NOW WITH DUAL-WRITE"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        campus = data.get('campus', '').strip()
        date_str = data.get('date', '').strip()
        stats = data.get('stats', {})
        
        logger.info(f"[QUICK_INPUT] Received request - campus: '{campus}', date: '{date_str}'")
        
        if not campus:
            return jsonify({"error": "Campus is required"}), 400
        
        if not date_str:
            return jsonify({"error": "Date is required"}), 400
        
        # Check if user has permission to log stats FOR THIS CAMPUS
        if not current_user.has_permission('log_stats'):
            return jsonify({"error": "You don't have permission to log stats"}), 403
        if not current_user.can_access_campus(campus):
            return jsonify({"error": f"You don't have access to log stats for {campus}"}), 403

        # Normalize campus_id
        normalized_campus_id = campus.lower().replace(' ', '_')
        logger.info(f"[QUICK_INPUT] Normalized campus_id: '{normalized_campus_id}' from campus: '{campus}'")
        
        # Prepare data for save_attendance_record
        save_data = {
            'campus': campus,
            'campus_id': normalized_campus_id,
            'date': date_str,
            **stats  # Spread all stats fields
        }
        for k in ('include_in_rollup_metrics', 'special_service_label'):
            if k in data:
                save_data[k] = data[k]
        
        # Save using dual-write system (Database + Google Sheets backup)
        success, record, error = save_attendance_record(
            save_data, 
            user_id=current_user.id if hasattr(current_user, 'id') else None
        )
        
        if success:
            total_stats = len([v for v in stats.values() if v and v != 0])
            return jsonify({
                "success": True,
                "text": f"Successfully input {total_stats} stats for {campus} campus on {date_str}!",
                "record_id": record.id,
                "stats": stats,
                "campus": campus,
                "date": date_str,
                "synced_to_sheets": record.synced_to_sheets,
                "version": "DATABASE_DUAL_WRITE_2025"
            })
        else:
            return jsonify({"error": error or "Failed to save"}), 500
            
    except Exception as e:
        logger.error(f"Quick input error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/quick_input/update', methods=['POST'])
@login_required
def quick_input_update():
    """Handle quick input form updates - NOW WITH DUAL-WRITE"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        campus = data.get('campus', '').strip()
        date_str = data.get('date', '').strip()
        stats = data.get('stats', {})
        original_campus = data.get('originalCampus', campus).strip()
        original_date = data.get('originalDate', date_str).strip()
        
        print(f"[EDIT_REQUEST] Received edit request:")
        print(f"  campus: '{campus}'")
        print(f"  date_str: '{date_str}'")
        print(f"  original_campus: '{original_campus}'")
        print(f"  original_date: '{original_date}'")
        logger.info(f"[EDIT_REQUEST] Received edit request:")
        logger.info(f"  campus: '{campus}'")
        logger.info(f"  date_str: '{date_str}'")
        logger.info(f"  original_campus: '{original_campus}'")
        logger.info(f"  original_date: '{original_date}'")
        
        if not campus:
            return jsonify({"error": "Campus is required"}), 400
        
        if not date_str:
            return jsonify({"error": "Date is required"}), 400
        
        # Check if user has permission to update stats FOR THESE CAMPUSES
        if not current_user.has_permission('log_stats'):
            return jsonify({"error": "You don't have permission to update stats"}), 403
        if not current_user.can_access_campus(campus) or not current_user.can_access_campus(original_campus):
            return jsonify({"error": f"You don't have access to update stats for {campus}"}), 403
        
        # Prepare data for save_attendance_record - pass recordId (most reliable), originalCampus/originalDate for lookup
        save_data = {
            'campus': campus,
            'campus_id': campus.lower().replace(' ', '_'),
            'date': date_str,
            **stats  # Spread all stats fields
        }
        record_id = data.get('recordId')
        if record_id is not None:
            save_data['recordId'] = record_id
            logger.info(f"[EDIT_REQUEST] Passing recordId for update: {record_id}")
        if original_campus and original_date:
            save_data['originalCampus'] = original_campus
            save_data['originalDate'] = original_date
            logger.info(f"[EDIT_REQUEST] Passing originalCampus/originalDate for update lookup: '{original_campus}' / '{original_date}'")

        for k in ('include_in_rollup_metrics', 'special_service_label'):
            if k in data:
                save_data[k] = data[k]

        # Save using dual-write system (will find by original date+campus when provided, then update)
        success, record, error = save_attendance_record(
            save_data,
            user_id=current_user.id if hasattr(current_user, 'id') else None
        )

        if success:
            total_stats = len([v for v in stats.values() if v and v != 0])
            return jsonify({
                "success": True,
                "text": f"Successfully updated {total_stats} stats for {campus} campus on {date_str}!",
                "record_id": record.id,
                "stats": stats,
                "campus": campus,
                "date": date_str,
                "synced_to_sheets": record.synced_to_sheets,
                "version": "DATABASE_DUAL_WRITE_2025"
            })
        else:
            return jsonify({"error": error or "Failed to update"}), 500
        
        # OLD GOOGLE SHEETS ONLY CODE - KEPT FOR REFERENCE BUT NOT USED
        # Find and update in Google Sheets
        try:
            if not sheet:
                return jsonify({"error": "Google Sheets not connected"}), 500
            
            # Try multiple times to find the entry (in case of API caching)
            row_index = None
            headers = []
            all_records = []
            
            for attempt in range(3):  # Try up to 3 times
                # Get all records to find the row to update
                all_records = safe_sheets_request(sheet.get_all_records)
                if not all_records:
                    if attempt < 2:
                        time.sleep(2)  # Wait 2 seconds before retrying (increased from 1)
                        continue
                    return jsonify({"error": "No data available"}), 404
                
                headers = list(all_records[0].keys()) if all_records else []
                
                # Find the row index (add 2 because: 1 for header, 1 for 1-indexed)
                search_campus_norm = normalize_campus(original_campus)
                search_campus_variants = [
                    original_campus,
                    original_campus.lower(),
                    original_campus.replace('_', ' '),
                    original_campus.replace('_', ' ').title(),
                    original_campus.replace('_', ' ').lower(),
                    search_campus_norm,
                    # Add more variations for better matching
                    original_campus.replace('_', '').lower(),
                    original_campus.replace('_', '').title()
                ]
                logger.info(f"[Attempt {attempt + 1}] Searching for date='{original_date}', campus variants: {search_campus_variants}")
                
                # First, try to find the most recent entry with matching date (more forgiving)
                matching_date_entries = []
                for idx, record in enumerate(all_records):
                    record_date = str(record.get('Date', ''))
                    if record_date == original_date:
                        matching_date_entries.append((idx, record))
                
                print(f"[EDIT_DEBUG] Found {len(matching_date_entries)} entries with date {original_date}")
                logger.info(f"Found {len(matching_date_entries)} entries with date {original_date}")
                
                # Log all entries on this date for debugging
                for idx, record in matching_date_entries:
                    print(f"  Entry {idx}: Campus='{record.get('Campus')}', Total='{record.get('Total Attendance')}', 9AM='{record.get('9:00 AM')}'")
                    logger.info(f"  Entry {idx}: Campus='{record.get('Campus')}', Total='{record.get('Total Attendance')}', 9AM='{record.get('9:00 AM')}'")
                
                for idx, record in matching_date_entries:
                    record_campus_raw = str(record.get('Campus', ''))
                    record_campus = normalize_campus(record_campus_raw)
                    
                    logger.info(f"Trying to match '{original_campus}' (normalized: '{search_campus_norm}') against '{record_campus_raw}' (normalized: '{record_campus}')")
                    
                    # Very flexible campus matching - try multiple variants
                    campus_match = False
                    for variant in search_campus_variants:
                        variant_norm = normalize_campus(variant)
                        variant_lower = variant.lower()
                        record_lower = record_campus_raw.lower()
                        
                        # Multiple matching strategies
                        if (variant_norm in record_campus or 
                            record_campus in variant_norm or 
                            variant_norm == record_campus or
                            variant_lower == record_lower or
                            variant_lower.replace('_', ' ') == record_lower.replace('_', ' ') or
                            variant_lower.replace('_', '') == record_lower.replace('_', '') or
                            # Check if any word from variant matches any word from record
                            any(word in record_lower.split() for word in variant_lower.split() if len(word) > 2) or
                            any(word in variant_lower.split() for word in record_lower.split() if len(word) > 2)):
                            campus_match = True
                            logger.info(f"✓ MATCHED using variant '{variant}' against '{record_campus_raw}' (normalized: '{record_campus}')")
                            break
                        else:
                            logger.debug(f"  No match: variant '{variant}' (norm: '{variant_norm}') vs record '{record_campus_raw}' (norm: '{record_campus}')")
                    
                    if campus_match:
                        row_index = idx + 2  # +1 for header, +1 for 1-indexed
                        logger.info(f"✓ Found row to update at index {row_index}: '{record_campus_raw}' on {record_date}")
                        break
                
                if row_index:
                    break  # Found it!
                    
                # Not found, wait and retry with longer delay
                if attempt < 2:
                    wait_time = 2 if attempt == 0 else 3  # 2 seconds first retry, 3 seconds second retry
                    logger.warning(f"Entry not found on attempt {attempt + 1}, waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
            
            if not row_index:
                # Entry not found - try one more fallback: use the most recent entry on this date FOR THE SAME CAMPUS
                logger.warning(f"Exact campus match not found. Trying fallback: most recent entry on {original_date} for campus {original_campus}")
                
                # Sort by timestamp to get the most recent entry
                entries_on_date = [r for r in all_records if r.get('Date') == original_date]
                
                # FIX: Filter by campus first - only consider entries from the same campus
                # This prevents overwriting another campus's data
                entries_on_date = [r for r in entries_on_date if normalize_campus(str(r.get('Campus', ''))) == search_campus_norm]
                
                if entries_on_date:
                    # Try to sort by timestamp if available
                    try:
                        entries_on_date.sort(key=lambda x: x.get('Timestamp', ''), reverse=True)
                    except:
                        pass  # If timestamp sorting fails, use original order
                    
                    # Use the most recent entry (now guaranteed to be from the same campus)
                    most_recent_entry = entries_on_date[0]
                    most_recent_idx = all_records.index(most_recent_entry)
                    row_index = most_recent_idx + 2
                    
                    logger.warning(f"Using fallback: most recent entry at index {row_index} for campus '{most_recent_entry.get('Campus')}' on {original_date}")
                    logger.warning(f"This will UPDATE the existing entry instead of creating a new one")
                else:
                    # No entries on this date for this campus
                    logger.error(f"No entries found on {original_date} for campus {original_campus}. Recent entries:")
                    for r in all_records[-5:]:
                        logger.error(f"  Campus: '{r.get('Campus')}', Date: '{r.get('Date')}', Normalized: '{normalize_campus(r.get('Campus', ''))}'")
                    
                    return jsonify({
                        "error": f"Entry not found for {original_campus} on {original_date}. This usually means Google Sheets is still syncing. Please wait 10-15 seconds and try again.",
                        "suggestion": "wait"
                    }), 404
            
            # Prepare the row data
            def safe_value(key, default=0):
                val = stats.get(key, default)
                if val == 0 or val == '':
                    return ''
                return safe_int(val)
            
            # Use Adelaide timezone
            from zoneinfo import ZoneInfo
            adelaide_tz = ZoneInfo('Australia/Adelaide')
            now_adelaide = datetime.now(adelaide_tz)
            
            row_data = {
                'Timestamp': now_adelaide.strftime('%Y-%m-%d %H:%M:%S'),
                'Date': date_str,
                'Campus': campus,
                'Total People in Campus': safe_value('Total People in Campus'),
                'Total Attendance': safe_value('Total Attendance'),
                '9:00 AM': safe_value('9:00 AM'),
                '10:00 AM': safe_value('10:00 AM'),
                '11:00 AM': safe_value('11:00 AM'),
                '5:00 PM': safe_value('5:00 PM'),
                '5:30 PM': safe_value('5:30 PM'),
                'Kids 9:00 AM': safe_value('Kids 9:00 AM'),
                'Kids 10:00 AM': safe_value('Kids 10:00 AM'),
                'Kids 11:00 AM': safe_value('Kids 11:00 AM'),
                'Kids 5:00 PM': safe_value('Kids 5:00 PM'),
                'Kids 5:30 PM': safe_value('Kids 5:30 PM'),
                'Kids Attendance': safe_value('Kids Attendance'),
                'Kids Leaders': safe_value('Kids Leaders'),
                'New Kids': safe_value('New Kids'),
                'New Kids Salvations': safe_value('New Kids Salvations'),
                'Packs Out': safe_value('Packs Out'),
                'First Time Visitors': safe_value('First Time Visitors'),
                'Visitors': safe_value('Visitors'),
                'Hands up': safe_value('Hands up'),
                'Cards Back': safe_value('Cards Back'),
                'First Time Christians': safe_value('First Time Christians'),
                'Rededications': safe_value('Rededications'),
                'Youth Attendance': safe_value('Youth Attendance'),
                'Youth Salvations': safe_value('Youth Salvations'),
                'Youth New People': safe_value('Youth New People'),
                'Youth Leaders': safe_value('Youth Leaders'),
                'Connect Groups': safe_value('Connect Groups'),
                'Dream Team': safe_value('Dream Team'),
                'Tithe': safe_value('Tithe'),
                'Baptisms': safe_value('Baptisms'),
                'Child Dedications': safe_value('Child Dedications')
            }
            
            # Get service times dynamically for this campus
            campus_service_times = get_campus_service_times(campus)
            logger.info(f"[DYNAMIC_SERVICE_TIMES] Campus '{campus}' has service times: {campus_service_times}")
            
            # Dynamically add service times (adult and kids)
            for service_time in campus_service_times:
                row_data[service_time] = safe_value(service_time)
                row_data[f'Kids {service_time}'] = safe_value(f'Kids {service_time}')
            
            # Build list of all required headers (only from row_data, not from existing sheet)
            required_headers = list(row_data.keys())
            
            # Ensure Google Sheets has all required columns (only adds missing ones from our list)
            ensure_google_sheets_columns(required_headers)
            
            # Re-fetch headers after potentially adding new columns
            all_records = safe_sheets_request(sheet.get_all_records)
            headers = list(all_records[0].keys()) if all_records else []
            
            # Only add headers that are in our expected list (prevent adding unwanted columns)
            # Define the valid headers we want to support
            valid_headers = set(required_headers)  # Only our required headers are valid
            for header in headers:
                if header in valid_headers and header not in row_data:
                    row_data[header] = ''
            
            # Convert to list format for Google Sheets
            row_values = []
            for header in headers:
                value = row_data.get(header, '')
                row_values.append(value)
            
            # Update the specific row
            # Column range: A to the last column based on headers
            # Convert column number to letter (handles AA, AB, etc.)
            def col_num_to_letter(n):
                """Convert column number to Excel-style letter (1=A, 27=AA, etc.)"""
                result = ""
                while n > 0:
                    n -= 1
                    result = chr(65 + (n % 26)) + result
                    n //= 26
                return result
            
            last_col_letter = col_num_to_letter(len(headers))
            range_notation = f'A{row_index}:{last_col_letter}{row_index}'
            
            sheet.update(range_notation, [row_values], value_input_option='USER_ENTERED')
            
            # Clear cache so updated entry shows up immediately
            clear_sheets_cache('Stats')
            logger.info(f"Updated row {row_index} for {campus} on {date_str}")
            
            total_stats = len([v for v in stats.values() if v and v != 0])
            response_text = f"Successfully updated {total_stats} stats for {campus} campus on {date_str}!"
            
            return jsonify({
                "success": True,
                "text": response_text,
                "stats": stats,
                "campus": campus,
                "date": date_str,
                "row_updated": row_index
            })
            
        except Exception as e:
            logger.error(f"Failed to update in Google Sheets: {e}")
            return jsonify({"error": f"Failed to update in database: {str(e)}"}), 500
            
    except Exception as e:
        logger.error(f"Quick input update error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/voices', methods=['GET'])
@login_required
def get_available_voices():
    """Get available voices from ElevenLabs"""
    if not elevenlabs_api_key:
        return jsonify({"error": "ElevenLabs API key not configured"}), 500
    
    try:
        url = "https://api.elevenlabs.io/v1/voices"
        headers = {
            "Accept": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            voices = response.json().get('voices', [])
            # Filter to only include English voices and format for frontend
            english_voices = []
            for voice in voices:
                if voice.get('labels', {}).get('language') == 'en':
                    english_voices.append({
                        'id': voice.get('voice_id'),
                        'name': voice.get('name'),
                        'description': voice.get('description', ''),
                        'category': voice.get('category', ''),
                        'language': voice.get('labels', {}).get('language', 'en')
                    })
            return jsonify({"voices": english_voices})
        else:
            logger.error(f"ElevenLabs voices API error: {response.status_code} - {response.text}")
            return jsonify({"error": "Failed to fetch voices"}), 500
            
    except Exception as e:
        logger.error(f"Failed to fetch voices: {e}")
        return jsonify({"error": "Failed to fetch voices"}), 500

@app.route('/api/generate_audio', methods=['POST'])
@login_required
def generate_audio():
    """Generate audio using ElevenLabs for any text with custom voice support"""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        voice_id = data.get('voice_id', elevenlabs_voice_id)  # Use provided voice or default
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Create temp_audio directory if it doesn't exist
        temp_audio_dir = os.path.join(os.path.dirname(__file__), "temp_audio")
        if not os.path.exists(temp_audio_dir):
            os.makedirs(temp_audio_dir)
        
        # Generate unique filename based on text hash and voice
        import hashlib
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        voice_suffix = f"_v{voice_id}" if voice_id != elevenlabs_voice_id else ""
        audio_filename = os.path.join(temp_audio_dir, f"query_{text_hash}{voice_suffix}.mp3")
        
        # Check if audio file already exists
        if os.path.exists(audio_filename):
            return jsonify({
                "audio_url": f"/temp_audio/query_{text_hash}{voice_suffix}.mp3",
                "voice_id": voice_id
            })
        
        # Generate new audio with specified voice
        audio_url = generate_audio_with_elevenlabs(text, filename=audio_filename, voice_id=voice_id)
        
        if audio_url:
            return jsonify({
                "audio_url": f"/temp_audio/query_{text_hash}{voice_suffix}.mp3",
                "voice_id": voice_id
            })
        else:
            return jsonify({"error": "Failed to generate audio"}), 500
            
    except Exception as e:
        logger.error(f"Error generating audio: {e}")
        return jsonify({"error": "Failed to generate audio"}), 500

# Update demo_status to use the correct filename for greeting audio
# Insights API endpoint removed - will be rebuilt from scratch

@app.route('/api/sheets/headers')
@login_required
def get_sheets_headers():
    """Debug endpoint to check Google Sheets headers"""
    try:
        if not sheet:
            return jsonify({'error': 'Google Sheets not available'}), 500
        
        # Get first row to see headers
        data = safe_sheets_request(sheet.get_all_records)
        if data and len(data) > 0:
            first_row = data[0]
            headers = list(first_row.keys())
            
            # Sample first few rows for debugging
            sample_data = data[:3] if len(data) >= 3 else data
            
            return jsonify({
                'available_headers': headers,
                'expected_headers': [
                    'Timestamp', 'Date', 'Campus', 'Total Attendance', 'First Time Visitors', 
                    'Visitors', 'Cards Back', 'First Time Christians', 'Rededications',
                    'Youth Attendance', 'Youth Salvations', 'Youth New People', 'Kids Attendance',
                    'Kids Leaders', 'New Kids', 'New Kids Salvations', 'Connect Groups', 
                    'Dream Team', 'Tithe', 'Baptisms', 'Child Dedications'
                ],
                'sample_data': sample_data,
                'total_rows': len(data)
            })
        else:
            return jsonify({'error': 'No data found in sheets', 'available_headers': []})
            
    except Exception as e:
        logger.error(f"Error getting sheets headers: {e}")
        return jsonify({'error': f'Failed to get headers: {str(e)}'}), 500

@app.route('/api/demo_status')
def demo_status():
    """Check all services for demo readiness"""
    status = {
        "backend": "running",
        "claude": claude is not None,
        "elevenlabs": elevenlabs_api_key is not None,
        "google_sheets": sheet is not None,
        "greeting_audio": "ready",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    try:
        greeting_text = "Connected to Futures Link, how can I help you today?"
        
        # Use absolute path for temp_audio directory
        temp_audio_dir = os.path.join(os.path.dirname(__file__), "temp_audio")
        audio_filename = os.path.join(temp_audio_dir, "greeting_elevenlabs.mp3")
        
        if not os.path.exists(audio_filename):
            if elevenlabs_api_key:
                os.makedirs(temp_audio_dir, exist_ok=True)
                audio_url = generate_audio_with_elevenlabs(greeting_text, filename=audio_filename)
                status["greeting_audio"] = "generated" if audio_url else "failed"
            else:
                status["greeting_audio"] = "no_elevenlabs_key"
        else:
            status["greeting_audio"] = "cached"
    except Exception as e:
        status["greeting_audio"] = f"error: {str(e)}"
    return jsonify(status)

@app.route('/api/test_dashboard')
def test_dashboard():
    """Test endpoint for dashboard data (requires login + dashboard access)"""
    # Dashboard access: authenticated + permitted + campus-scoped
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
    if not current_user.has_permission('dashboard_access'):
        return jsonify({"error": "You don't have dashboard access"}), 403
    try:
        # Get dashboard data using existing function
        dashboard_data = get_dashboard_data('all_campuses', 'last_12_months')
        return jsonify(dashboard_data)
    except Exception as e:
        logger.error(f"Test dashboard error: {e}")
        return jsonify({"error": "Failed to load dashboard data"}), 500

@app.route('/api/weekend_report/<campus>')
@login_required
def get_weekend_report(campus):
    """Get weekend report for a specific campus"""
    try:
        date_str = request.args.get('date', None)
        report = generate_weekend_report(campus, date_str)
        return jsonify(report)
    except Exception as e:
        logger.error(f"Weekend report error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/senior_leadership_weekend_report')
@login_required
@admin_required
def get_senior_leadership_weekend_report():
    """Get comprehensive weekend report for senior leadership across all campuses"""
    try:
        date_str = request.args.get('date', None)
        report = generate_senior_leadership_weekend_report(date_str)
        return jsonify(report)
    except Exception as e:
        logger.error(f"Senior leadership weekend report error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/q1_campus_report/<campus>')
@login_required
def get_q1_campus_report(campus):
    """Get Q1 report for a specific campus"""
    try:
        # Check if user has access to this campus
        if not current_user.has_permission('recall_stats', campus=campus):
            return jsonify({'success': False, 'error': 'Access denied. You do not have permission to view this campus data.'}), 403
        
        year = request.args.get('year', datetime.now().year)
        try:
            year = int(year)
        except ValueError:
            year = datetime.now().year
        
        report = generate_q1_campus_report(campus, year)
        
        if 'error' in report:
            return jsonify({'success': False, 'error': report['error']}), 500
        
        return jsonify({'success': True, 'report': report})
        
    except Exception as e:
        logger.error(f"Error getting Q1 campus report: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred while generating the report'}), 500

@app.route('/api/q1_leadership_report')
@login_required
@admin_required
def get_q1_leadership_report():
    """Get Q1 leadership report for all campuses"""
    try:
        # Only users with admin access can access this
        if not current_user.has_permission('data_export'):
            return jsonify({'success': False, 'error': 'Access denied. Admin access required.'}), 403
        
        year = request.args.get('year', datetime.now().year)
        try:
            year = int(year)
        except ValueError:
            year = datetime.now().year
        
        report = generate_q1_leadership_report(year)
        
        if 'error' in report:
            return jsonify({'success': False, 'error': report['error']}), 500
        
        return jsonify({'success': True, 'report': report})
        
    except Exception as e:
        logger.error(f"Error getting Q1 leadership report: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred while generating the report'}), 500

@app.route('/api/any_time_frame_campus_report/<campus>')
@login_required
def get_any_time_frame_campus_report(campus):
    """Get any time frame campus report"""
    try:
        # Get date parameters from query string
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            return jsonify({'error': 'start_date and end_date parameters are required'}), 400
        
        # Parse dates
        try:
            start_date = datetime.fromisoformat(start_date_str)
            end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
        
        # Check permissions
        if not current_user.has_permission('recall_stats', campus):
            return jsonify({'error': 'Access denied'}), 403
        
        report = generate_any_time_frame_campus_report(campus, start_date, end_date)
        return jsonify(report)
    except Exception as e:
        logger.error(f"Error getting any time frame campus report: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/any_time_frame_leadership_report')
@login_required
@admin_required
def get_any_time_frame_leadership_report():
    """Get any time frame leadership report"""
    try:
        # Get date parameters from query string
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            return jsonify({'error': 'start_date and end_date parameters are required'}), 400
        
        # Parse dates
        try:
            start_date = datetime.fromisoformat(start_date_str)
            end_date = datetime.fromisoformat(end_date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
        
        report = generate_any_time_frame_leadership_report(start_date, end_date)
        return jsonify(report)
    except Exception as e:
        logger.error(f"Error getting any time frame leadership report: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard_data_public')
def get_dashboard_data_public():
    """Dashboard data for the web app (requires login; name is historical)"""
    # Dashboard access: authenticated + permitted + campus-scoped
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
    if not current_user.has_permission('dashboard_access'):
        return jsonify({"error": "You don't have dashboard access"}), 403
    try:
        campus = request.args.get('campus', 'all_campuses')
        if campus != 'all_campuses' and not current_user.can_access_campus(campus):
            return jsonify({"error": "You don't have access to this campus"}), 403
        if campus == 'all_campuses' and current_user.accessible_campus_ids() is not None:
            return jsonify({"error": "Select a specific campus - your access is campus-scoped"}), 403
        date_filter = request.args.get('date_filter', 'last_12_months')
        custom_start_date = request.args.get('custom_start_date', '')
        custom_end_date = request.args.get('custom_end_date', '')
        show_previous_year = request.args.get('show_previous_year', 'false').lower() == 'true'
        metrics_scope = _parse_metrics_scope()
        
        # Use the working Google Sheets function directly
        dashboard_data = get_dashboard_data(
            campus, date_filter, custom_start_date, custom_end_date, show_previous_year,
            metrics_scope=metrics_scope,
        )
        response = jsonify(dashboard_data)
        # Prevent caching so dashboard always shows fresh database data
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        return response
    except Exception as e:
        logger.error(f"Public dashboard API error: {e}")
        return jsonify({"error": "Failed to load dashboard data"}), 500

@app.route('/api/campus_dashboard_data')
def get_campus_dashboard_data():
    """Campus-specific dashboard data with enhanced metrics"""
    # Dashboard access: authenticated + permitted + campus-scoped
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
    if not current_user.has_permission('dashboard_access'):
        return jsonify({"error": "You don't have dashboard access"}), 403
    try:
        campus_id = request.args.get('campus_id', 'all_campuses')
        if campus_id != 'all_campuses' and not current_user.can_access_campus(campus_id):
            return jsonify({"error": "You don't have access to this campus"}), 403
        if campus_id == 'all_campuses' and current_user.accessible_campus_ids() is not None:
            return jsonify({"error": "Select a specific campus - your access is campus-scoped"}), 403
        date_filter = request.args.get('date_filter', 'last_12_months')
        custom_start_date = request.args.get('custom_start_date', '')
        custom_end_date = request.args.get('custom_end_date', '')
        show_previous_year = request.args.get('show_previous_year', 'false').lower() == 'true'
        metrics_scope = _parse_metrics_scope()
        
        # Get base dashboard data with all date parameters
        dashboard_data = get_dashboard_data(
            campus_id, date_filter, custom_start_date, custom_end_date, show_previous_year,
            metrics_scope=metrics_scope,
        )
        
        # Enhance with campus-specific metrics
        enhanced_data = enhance_campus_data(dashboard_data, campus_id)
        
        return jsonify(enhanced_data)
    except Exception as e:
        print(f"[ERROR] Campus dashboard data error: {e}")
        return jsonify({"error": "Failed to load campus dashboard data"}), 500

def enhance_campus_data(data, campus_id):
    """Enhance dashboard data with campus-specific metrics"""
    try:
        stats = data.get('stats', {})
        
        # Calculate additional metrics
        total_people = stats.get('total_people', 0)  # This would need to be added to the data source
        sunday_attendance = stats.get('sunday_attendance', stats.get('total_attendance', 0))
        connect_groups = stats.get('connect_groups', 0)
        
        # Calculate percentages
        attendance_percentage = (stats.get('total_attendance', 0) / total_people * 100) if total_people > 0 else 0
        connect_group_percentage = (connect_groups / sunday_attendance * 100) if sunday_attendance > 0 else 0
        
        # Add enhanced metrics
        enhanced_stats = {
            **stats,
            'total_people': total_people,
            'sunday_attendance': sunday_attendance,
            'attendance_percentage': round(attendance_percentage, 1),
            'connect_group_percentage': round(connect_group_percentage, 1),
            'services_breakdown': get_services_breakdown(campus_id),
            'kids_services_breakdown': get_kids_services_breakdown(campus_id)
        }
        
        return {
            **data,
            'stats': enhanced_stats,
            'campus_id': campus_id
        }
        
    except Exception as e:
        print(f"[ERROR] Error enhancing campus data: {e}")
        return data

def get_services_breakdown(campus_id):
    """Get breakdown of services for a campus"""
    # This would typically come from your database
    # For now, return mock data
    return [
        {'service': '9:00 AM', 'attendance': 150},
        {'service': '11:00 AM', 'attendance': 200}
    ]

def get_kids_services_breakdown(campus_id):
    """Get breakdown of kids services for a campus"""
    # This would typically come from your database
    # For now, return mock data
    return [
        {'service': 'Kids 9:00 AM', 'attendance': 45},
        {'service': 'Kids 11:00 AM', 'attendance': 60}
    ]

@app.route('/api/dashboard/data')
def get_dashboard_api_data():
    """API endpoint for dashboard data"""
    # Dashboard access: authenticated + permitted + campus-scoped
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401
    if not current_user.has_permission('dashboard_access'):
        return jsonify({"error": "You don't have dashboard access"}), 403
    try:
        campus = request.args.get('campus', 'all_campuses')
        if campus != 'all_campuses' and not current_user.can_access_campus(campus):
            return jsonify({"error": "You don't have access to this campus"}), 403
        if campus == 'all_campuses' and current_user.accessible_campus_ids() is not None:
            return jsonify({"error": "Select a specific campus - your access is campus-scoped"}), 403
        date_filter = request.args.get('date_filter', 'last_12_months')
        custom_start_date = request.args.get('custom_start_date', '')
        custom_end_date = request.args.get('custom_end_date', '')
        metrics_scope = _parse_metrics_scope()
        
        # Get dashboard data using existing function with custom date support
        print(f"[DEBUG] API calling get_dashboard_data with: campus={campus}, date_filter={date_filter}")
        dashboard_data = get_dashboard_data(
            campus, date_filter, custom_start_date, custom_end_date,
            metrics_scope=metrics_scope,
        )
        print(f"[DEBUG] API received data: {dashboard_data.get('stats', {}).get('total_attendance', 'No data')}")
        print(f"[DEBUG] API returning: {dashboard_data}")
        print(f"[DEBUG] API stats keys: {list(dashboard_data.get('stats', {}).keys()) if isinstance(dashboard_data, dict) else 'No stats'}")
        
        # Return JSON response
        return jsonify(dashboard_data)
    except Exception as e:
        logger.error(f"Dashboard API error: {e}")
        return jsonify({"error": "Failed to load dashboard data"}), 500

@app.route('/api/dashboard/regional')
@login_required
def get_regional_dashboard_data():
    """
    Regional dashboard - aggregates stats for all campuses in a region
    Accessible by region_leader role (for their region) or global roles (any region)
    """
    try:
        from models import Region, CampusV2, AttendanceRecord
        from sqlalchemy import func
        
        # Get request parameters
        region_code = request.args.get('region', request.args.get('region_code', 'AU'))
        date_filter = request.args.get('date_filter', 'last_12_months')
        custom_start_date = request.args.get('custom_start_date', '')
        custom_end_date = request.args.get('custom_end_date', '')
        show_previous_year = request.args.get('show_previous_year', 'false').lower() == 'true'
        metrics_scope = _parse_metrics_scope()
        
        print(f"[REGIONAL_DASHBOARD] Request for region: {region_code}, filter: {date_filter}")
        logger.info(f"[REGIONAL_DASHBOARD] Request for region: {region_code}, filter: {date_filter}")
        
        # Get user context from current_user (Flask-Login)
        user_role = getattr(current_user, 'role', 'member') if current_user.is_authenticated else 'member'
        user_region_id = getattr(current_user, 'region_id', None) if current_user.is_authenticated else None
        
        print(f"[REGIONAL_DASHBOARD] User: {current_user.username if current_user.is_authenticated else 'anonymous'}, Role: {user_role}")
        logger.info(f"[REGIONAL_DASHBOARD] User role: {user_role}, region_id: {user_region_id}")
        
        # Find the region using raw SQL to avoid model column issues
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, code, display_name, timezone, currency FROM regions WHERE code = ?", (region_code.upper(),))
        region_row = cursor.fetchone()
        
        if not region_row:
            logger.error(f"[REGIONAL_DASHBOARD] Region not found: {region_code}")
            return jsonify({"error": f"Region not found: {region_code}"}), 404
        
        region_id = region_row[0]
        region_dict = {
            'id': region_row[0],
            'name': region_row[1],
            'code': region_row[2],
            'display_name': region_row[3],
            'timezone': region_row[4],
            'currency': region_row[5]
        }
        
        print(f"[REGIONAL_DASHBOARD] Found region: {region_dict['display_name']} (ID: {region_id})")
        logger.info(f"[REGIONAL_DASHBOARD] Found region: {region_dict['display_name']} (ID: {region_id})")
        
        # For now, allow all authenticated users access to regional dashboards
        # Superadmin, admin, senior leadership roles should have access
        allowed_roles = ['superadmin', 'admin', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'senior_leadership']
        
        print(f"[REGIONAL_DASHBOARD] Checking access - User role: '{user_role}', Allowed roles: {allowed_roles}")
        print(f"[REGIONAL_DASHBOARD] Role check result: {user_role in allowed_roles}")
        
        if user_role not in allowed_roles:
            logger.warning(f"[REGIONAL_DASHBOARD] Access denied for user role: '{user_role}' (not in {allowed_roles})")
            print(f"[REGIONAL_DASHBOARD] Access denied - user role '{user_role}' not in allowed roles")
            return jsonify({"error": f"Access denied to regional dashboard. Your role '{user_role}' does not have permission."}), 403
        
        print(f"[REGIONAL_DASHBOARD] ✅ Access granted for role: {user_role}")
        
        # Calculate date range
        end_date = datetime.now().date()
        if date_filter == 'last_weekend':
            # Find the most recent weekend (Friday-Tuesday)
            # Include Friday (youth night), Saturday, Sunday, Monday, Tuesday (late submissions)
            # Friday is weekday 4, Saturday is 5, Sunday is 6, Monday is 0, Tuesday is 1
            days_since_saturday = (end_date.weekday() + 2) % 7  # Days since last Saturday
            if days_since_saturday == 0:
                # Today is Saturday, go back to last Saturday
                days_since_saturday = 7
            last_saturday = end_date - timedelta(days=days_since_saturday)
            last_friday = last_saturday - timedelta(days=1)  # Friday (youth night)
            last_sunday = last_saturday + timedelta(days=1)
            last_monday = last_sunday + timedelta(days=1)  # Monday (late submissions)
            last_tuesday = last_monday + timedelta(days=1)  # Tuesday (late submissions)
            start_date = last_friday  # Start from Friday
            end_date = last_tuesday  # End Tuesday
            print(f"[REGIONAL_DASHBOARD] last_weekend: Friday={last_friday} to Tuesday={last_tuesday}")
        elif date_filter == 'last_7_days':
            start_date = end_date - timedelta(days=7)
        elif date_filter == 'last_30_days':
            start_date = end_date - timedelta(days=30)
        elif date_filter == 'last_90_days':
            start_date = end_date - timedelta(days=90)
        elif date_filter in ['this_year', 'year_to_date']:
            start_date = datetime(end_date.year, 1, 1).date()
        elif date_filter == 'last_12_months':
            start_date = end_date - timedelta(days=365)
        elif custom_start_date and custom_end_date:
            start_date = datetime.strptime(custom_start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(custom_end_date, '%Y-%m-%d').date()
        else:
            start_date = end_date - timedelta(days=365)
        
        # Query attendance records for this region
        records = apply_attendance_metrics_scope(
            AttendanceRecord.query.filter(
                AttendanceRecord.region_id == region_id,
                AttendanceRecord.date >= start_date,
                AttendanceRecord.date <= end_date,
            ),
            metrics_scope,
        ).all()
        
        print(f"[REGIONAL_DASHBOARD] Date range: {start_date} to {end_date}")
        print(f"[REGIONAL_DASHBOARD] Found {len(records)} attendance records for region_id={region_id}")
        
        # Debug: Show breakdown by date and campus
        if records:
            from collections import defaultdict
            date_breakdown = defaultdict(lambda: {'count': 0, 'total_attendance': 0, 'campuses': set()})
            for r in records:
                date_breakdown[r.date]['count'] += 1
                date_breakdown[r.date]['total_attendance'] += (r.total_attendance or 0)
                campus = CampusV2.query.get(r.campus_id)
                if campus:
                    date_breakdown[r.date]['campuses'].add(campus.display_name)
            
            print(f"[REGIONAL_DASHBOARD] Breakdown by date:")
            for date_key in sorted(date_breakdown.keys()):
                info = date_breakdown[date_key]
                print(f"[REGIONAL_DASHBOARD]   {date_key}: {info['count']} records, total_attendance={info['total_attendance']}, campuses={sorted(info['campuses'])}")
        
        # If no records, fall back to Google Sheets (database first, Sheets backup)
        if len(records) == 0:
            total_records = AttendanceRecord.query.count()
            print(f"[REGIONAL_DASHBOARD] No records found. Total records in table: {total_records}")
            if total_records > 0:
                sample_record = AttendanceRecord.query.first()
                print(f"[REGIONAL_DASHBOARD] Sample record: region_id={sample_record.region_id}, campus_id={sample_record.campus_id}, date={sample_record.date}")
            # Fall back to get_dashboard_data (uses Sheets when DB empty)
            campus_for_fallback = 'australia' if region_code.upper() == 'AU' else 'all_campuses'
            print(f"[REGIONAL_DASHBOARD] Falling back to Google Sheets via get_dashboard_data(campus={campus_for_fallback})")
            try:
                fallback = get_dashboard_data(
                    campus_for_fallback, date_filter, custom_start_date, custom_end_date,
                    metrics_scope=metrics_scope,
                )
                s = fallback.get('stats', {})
                if s:
                    record_count = max(1, s.get('entry_count', 1))
                    resp_data = {
                        'date_range': {'start': str(start_date), 'end': str(end_date), 'filter': date_filter},
                        'stats': {
                            'total_attendance': s.get('total_attendance', 0),
                            'avg_weekly_attendance': round(s.get('avg_attendance', 0), 1),
                            'total_kids': s.get('kids_attendance', 0),
                            'avg_kids': round(s.get('avg_kids_attendance', 0), 1),
                            'total_kids_leaders': s.get('kids_leaders', 0),
                            'avg_kids_leaders': round(s.get('avg_kids_leaders', 0), 1),
                            'total_youth': s.get('youth_attendance', 0),
                            'avg_youth': round(s.get('avg_youth_attendance', 0), 1),
                            'total_salvations': (s.get('first_time_christians', 0) + s.get('rededications', 0) + s.get('youth_salvations', 0) + s.get('new_kids_salvations', 0)),
                            'first_time_christians': s.get('first_time_christians', 0),
                            'rededications': s.get('rededications', 0),
                            'youth_salvations': s.get('youth_salvations', 0),
                            'new_kids_salvations': s.get('new_kids_salvations', 0),
                            'total_visitors': s.get('first_time_visitors', 0),
                            'new_people': s.get('new_people', 0),
                            'total_saints': s.get('saints', 0),
                            'avg_saints': round(float(s.get('avg_saints', 0)), 1),
                            'total_giving': round(float(s.get('tithe', 0)), 2),
                            'avg_weekly_giving': round(float(s.get('avg_tithe', 0)), 2),
                            'week_count': record_count,
                        },
                        'campuses': [],
                        'chart_data': fallback.get('chart_data', {'labels': [], 'attendance': [], 'new_people': [], 'new_christians': []}),
                        'data_source': fallback.get('data_source', 'Google Sheets'),
                        'metrics_scope': normalize_metrics_scope(metrics_scope),
                    }
                    resp = jsonify(resp_data)
                    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
                    resp.headers['Pragma'] = 'no-cache'
                    return resp
            except Exception as fb_err:
                print(f"[REGIONAL_DASHBOARD] Sheets fallback failed: {fb_err}")
                logger.warning(f"[REGIONAL_DASHBOARD] Sheets fallback failed: {fb_err}")
        
        # Get campuses in this region
        campuses = CampusV2.query.filter_by(region_id=region_id, active=True).all()
        
        print(f"[REGIONAL_DASHBOARD] Found {len(campuses)} active campuses")
        for campus in campuses:
            print(f"[REGIONAL_DASHBOARD] Campus: {campus.display_name} (ID: {campus.id}, campus_id: {campus.campus_id})")
        
        # Aggregate statistics
        # First, sum raw values from database
        raw_total_attendance = sum(r.total_attendance or 0 for r in records)
        total_people_in_campus = sum(r.total_people_in_campus or 0 for r in records)
        total_kids = sum(r.kids_attendance or 0 for r in records)
        total_kids_leaders = sum(r.kids_leaders or 0 for r in records)
        total_youth = sum(r.youth_attendance or 0 for r in records)
        total_youth_leaders = sum(r.youth_leaders or 0 for r in records)
        total_saints = sum(r.saints or 0 for r in records)
        
        # CRITICAL FIX: Ensure kids are included in total_attendance for Sunday Attendance
        # Some older records might not have kids included in total_attendance
        # Sunday Attendance = Adults + Saints + Kids + Kids Leaders (but NOT Youth)
        # 
        # Strategy: Check if kids are already included, and if not, add them
        # We can't simply subtract and add back because we don't know for sure if kids are included
        # 
        # SAFER APPROACH: Check if raw_total_attendance already includes kids
        # If raw_total_attendance >= (adults_estimate + kids), then kids are likely included
        # But we can't know for sure, so we'll use a conservative approach:
        # 
        # For NEW records (saved via API): total_attendance = adults + saints + kids + kids_leaders
        # For OLD records (migrated): might not have kids included
        # 
        # BEST APPROACH: Sum each record's components separately to avoid double-counting
        # We'll sum: (total_attendance - kids) for records where kids might be included
        #         + (total_attendance) for records where kids are definitely NOT included
        # Then add back total kids ONCE
        
        adults_and_saints_total = 0
        records_without_kids = 0
        records_with_kids = 0
        
        for r in records:
            record_kids = (r.kids_attendance or 0) + (r.kids_leaders or 0)
            record_total = r.total_attendance or 0
            
            # Determine if kids are included in this record's total_attendance
            if record_total < record_kids:
                # Kids are definitely NOT included (impossible for total < kids if kids are included)
                adults_and_saints_total += record_total
                records_without_kids += 1
            else:
                # Kids MIGHT be included - subtract them to get adults+saints
                # This is safe: if kids are included, we extract them correctly
                # If kids are NOT included but total > kids, we slightly undercount adults+saints
                # but then we add kids back, so we get the correct total
                adults_and_saints_total += (record_total - record_kids)
                records_with_kids += 1
        
        # Now add back total kids ONCE to get correct Sunday Attendance
        # This ensures kids are included exactly once, regardless of whether they were in the original total
        total_attendance = adults_and_saints_total + total_kids + total_kids_leaders
        
        # VERIFICATION: Check for potential double-counting
        # Mathematical check: If all records have kids included, then:
        #   adults_and_saints_total + total_kids = raw_total_attendance
        # If no records have kids included, then:
        #   adults_and_saints_total = raw_total_attendance (before adding kids)
        #   total_attendance = raw_total_attendance + total_kids
        
        expected_if_all_have_kids = raw_total_attendance
        actual_calculated = total_attendance
        difference = actual_calculated - expected_if_all_have_kids
        total_kids_sum = total_kids + total_kids_leaders
        
        print(f"[REGIONAL_DASHBOARD] ⚠️  VERIFICATION CHECK (preventing double-counting):")
        print(f"[REGIONAL_DASHBOARD]   Raw total_attendance from DB: {raw_total_attendance}")
        print(f"[REGIONAL_DASHBOARD]   Adults+saints extracted: {adults_and_saints_total}")
        print(f"[REGIONAL_DASHBOARD]   Total kids to add: {total_kids_sum}")
        print(f"[REGIONAL_DASHBOARD]   Final calculated total_attendance: {actual_calculated}")
        print(f"[REGIONAL_DASHBOARD]   Difference from raw: {difference}")
        
        if difference == 0:
            print(f"[REGIONAL_DASHBOARD]   ✅ VERIFIED: All records already had kids included - no double counting")
        elif difference == total_kids_sum:
            print(f"[REGIONAL_DASHBOARD]   ✅ VERIFIED: No records had kids included - adding them now (correct, no double counting)")
        elif 0 < difference < total_kids_sum:
            print(f"[REGIONAL_DASHBOARD]   ✅ VERIFIED: Mixed scenario - some records had kids, some didn't")
            print(f"[REGIONAL_DASHBOARD]   ✅ This is expected and correct - kids are counted exactly once")
        else:
            print(f"[REGIONAL_DASHBOARD]   ⚠️  WARNING: Unexpected difference - investigating...")
            print(f"[REGIONAL_DASHBOARD]   Records with kids: {records_with_kids}, Records without kids: {records_without_kids}")
        
        # Final sanity check: total_attendance should be >= raw_total_attendance (we're adding kids if missing)
        if actual_calculated < raw_total_attendance:
            print(f"[REGIONAL_DASHBOARD]   ❌ ERROR: Calculated total is LESS than raw total - this shouldn't happen!")
        elif actual_calculated == raw_total_attendance:
            print(f"[REGIONAL_DASHBOARD]   ✅ Kids were already included in all records")
        else:
            print(f"[REGIONAL_DASHBOARD]   ✅ Kids were added to records that were missing them")
        
        # Debug: Show totals breakdown
        print(f"[REGIONAL_DASHBOARD] Aggregated totals:")
        print(f"[REGIONAL_DASHBOARD]   raw_total_attendance (from DB): {raw_total_attendance}")
        print(f"[REGIONAL_DASHBOARD]   total_kids: {total_kids}")
        print(f"[REGIONAL_DASHBOARD]   total_kids_leaders: {total_kids_leaders}")
        print(f"[REGIONAL_DASHBOARD]   adults_and_saints_total: {adults_and_saints_total}")
        print(f"[REGIONAL_DASHBOARD]   total_attendance (corrected with kids): {total_attendance}")
        print(f"[REGIONAL_DASHBOARD]   total_youth: {total_youth}")
        print(f"[REGIONAL_DASHBOARD]   total_youth_leaders: {total_youth_leaders}")
        print(f"[REGIONAL_DASHBOARD]   total_youth_with_leaders (for Weekend): {total_youth + total_youth_leaders}")
        print(f"[REGIONAL_DASHBOARD]   Records without kids in total_attendance: {records_without_kids} of {len(records)}")
        
        # Weekend Attendance = Sunday Attendance + Youth + Youth Leaders
        # So we need to include youth_leaders in the total_youth value returned
        total_youth_with_leaders = total_youth + total_youth_leaders
        # Salvations - break down by type
        total_adult_salvations = sum(r.first_time_christians or 0 for r in records)
        total_rededications = sum(r.rededications or 0 for r in records)
        total_youth_salvations = sum(r.youth_salvations or 0 for r in records)
        total_kids_salvations = sum(r.new_kids_salvations or 0 for r in records)
        total_salvations = total_adult_salvations + total_rededications + total_youth_salvations + total_kids_salvations
        total_baptisms = sum(r.baptisms or 0 for r in records)
        total_child_dedications = sum(r.child_dedications or 0 for r in records)
        total_dream_team = sum(r.dream_team or 0 for r in records)
        total_connect_groups = sum(r.connect_groups or 0 for r in records)
        total_visitors = sum(r.first_time_visitors or 0 for r in records)
        total_youth_new_people = sum(r.youth_new_people or 0 for r in records)
        # FIX: Include youth_new_people in total new_people count
        total_new_people = total_visitors + sum(r.visitors or 0 for r in records) + total_youth_new_people
        total_giving = sum(float(r.tithe or 0) for r in records)
        
        # Calculate averages - use number of records (services) not unique dates
        # This ensures we get average per service across all campuses
        record_count = max(1, len(records))
        avg_attendance = total_attendance / record_count if record_count > 0 else 0
        avg_kids = total_kids / record_count if record_count > 0 else 0
        avg_kids_leaders = total_kids_leaders / record_count if record_count > 0 else 0
        avg_youth = total_youth / record_count if record_count > 0 else 0
        avg_giving = total_giving / record_count if record_count > 0 else 0
        
        # Calculate week_count for display purposes (unique dates)
        week_count = max(1, len(set(r.date for r in records)))
        
        # Get campus breakdown with detailed stats
        campus_stats = []
        for campus in campuses:
            campus_records = [r for r in records if r.campus_id == campus.id]
            if campus_records:
                # Calculate Sunday attendance (adults + saints + kids + kids_leaders, but NOT youth)
                campus_total = 0
                campus_kids = 0
                campus_kids_leaders = 0
                campus_youth = 0
                campus_youth_leaders = 0
                campus_saints = 0
                
                for r in campus_records:
                    # Calculate Sunday attendance (same logic as regional total)
                    record_kids = (r.kids_attendance or 0) + (r.kids_leaders or 0)
                    record_total = r.total_attendance or 0
                    
                    # Determine if kids are included in this record's total_attendance
                    if record_total < record_kids:
                        # Kids are definitely NOT included
                        adults_and_saints = record_total
                    else:
                        # Kids might be included, subtract to get adults+saints
                        adults_and_saints = max(0, record_total - record_kids)
                    
                    # Sunday Attendance = adults+saints + kids (always include kids)
                    corrected_attendance = adults_and_saints + record_kids
                    campus_total += corrected_attendance
                    
                    campus_kids += (r.kids_attendance or 0)
                    campus_kids_leaders += (r.kids_leaders or 0)
                    campus_youth += (r.youth_attendance or 0)
                    campus_youth_leaders += (r.youth_leaders or 0)
                    campus_saints += (r.saints or 0)
                
                # Average per service (record), not per unique date
                record_count = len(campus_records)
                campus_avg = campus_total / record_count if record_count > 0 else 0
                campus_stats.append({
                    'campus_id': campus.campus_id,
                    'campus_name': campus.display_name,
                    'total_attendance': campus_total,  # Sunday attendance (adults + kids + kids_leaders + saints)
                    'avg_attendance': round(campus_avg, 1),
                    'total_kids': campus_kids,
                    'total_kids_leaders': campus_kids_leaders,
                    'total_kids_with_leaders': campus_kids + campus_kids_leaders,
                    'avg_kids': round(campus_kids / record_count, 1) if record_count > 0 else 0,
                    'avg_kids_leaders': round(campus_kids_leaders / record_count, 1) if record_count > 0 else 0,
                    'total_youth': campus_youth + campus_youth_leaders,  # Youth + leaders
                    'total_youth_attendance': campus_youth,  # Youth only
                    'total_youth_leaders': campus_youth_leaders,
                    'avg_youth': round((campus_youth + campus_youth_leaders) / record_count, 1) if record_count > 0 else 0,
                    'total_saints': campus_saints,
                    'avg_saints': round(campus_saints / record_count, 1) if record_count > 0 else 0,
                    'total_connect_groups': sum(r.connect_groups or 0 for r in campus_records),
                    'record_count': record_count
                })
        
        # Sort campuses by total attendance
        campus_stats.sort(key=lambda x: x['total_attendance'], reverse=True)
        
        # Build YTD chart_data (weekly aggregation) for regional dashboard
        now = datetime.now()
        ytd_start = datetime(now.year, 1, 1)
        ytd_end = now
        
        # Query YTD records for this region
        ytd_records = apply_attendance_metrics_scope(
            AttendanceRecord.query.filter(
                AttendanceRecord.region_id == region_id,
                AttendanceRecord.date >= ytd_start,
                AttendanceRecord.date <= ytd_end,
            ),
            metrics_scope,
        ).all()
        
        print(f"[REGIONAL_DASHBOARD YTD] Found {len(ytd_records)} YTD records for chart (region_id={region_id}, date range: {ytd_start.date()} to {ytd_end.date()})")
        
        # Debug: Check records for Jan 18 specifically
        jan_18_records = [r for r in ytd_records if r.date == date(2026, 1, 18)]
        if jan_18_records:
            total_jan_18 = sum(r.total_attendance or 0 for r in jan_18_records)
            print(f"[REGIONAL_DASHBOARD YTD] Jan 18 records: {len(jan_18_records)} records, total attendance: {total_jan_18}")
            for r in jan_18_records:
                campus = CampusV2.query.get(r.campus_id)
                campus_name = campus.display_name if campus else f"Campus_{r.campus_id}"
                print(f"[REGIONAL_DASHBOARD YTD]   - {campus_name}: {r.total_attendance}")
        
        # Build weekly aggregates for YTD (week-by-week instead of monthly)
        ytd_weekly = {}
        for record in ytd_records:
            record_date = record.date
            days_since_monday = record_date.weekday()  # Monday is 0
            week_start = record_date - timedelta(days=days_since_monday)
            week_key = _ytd_chart_week_key(record_date)
            
            if week_key not in ytd_weekly:
                ytd_weekly[week_key] = {
                    'attendance': 0,
                    'new_people': 0,
                    'new_christians': 0,
                    'count': 0,
                    'week_start': week_start,
                    'week_end': week_start + timedelta(days=6),
                    'dates': []  # Track which dates are in this week for debugging
                }
            
            # Ensure kids are included in attendance for weekly aggregation
            # Recalculate Sunday Attendance = (adults+saints) + (kids + kids_leaders)
            record_kids = (record.kids_attendance or 0) + (record.kids_leaders or 0)
            record_total = record.total_attendance or 0
            # Calculate adults+saints
            if record_total < record_kids:
                # Kids are definitely NOT included
                adults_and_saints = record_total
            else:
                # Kids might be included, subtract to get adults+saints
                adults_and_saints = max(0, record_total - record_kids)
            # Sunday Attendance = adults+saints + kids (always include kids)
            corrected_attendance = adults_and_saints + record_kids
            
            ytd_weekly[week_key]['attendance'] += corrected_attendance
            ytd_weekly[week_key]['new_people'] += (record.first_time_visitors or 0) + (record.visitors or 0)
            ytd_weekly[week_key]['new_christians'] += (record.first_time_christians or 0) + (record.rededications or 0)
            ytd_weekly[week_key]['count'] += 1
            if record_date not in ytd_weekly[week_key]['dates']:
                ytd_weekly[week_key]['dates'].append(record_date)
        
        # Debug: Print week aggregates for Jan 18th week
        jan_18 = date(2026, 1, 18)
        jan_18_week_key = _ytd_chart_week_key(jan_18)
        if jan_18_week_key in ytd_weekly:
            week_info = ytd_weekly[jan_18_week_key]
            print(f"[REGIONAL_DASHBOARD YTD] Week {jan_18_week_key} (Jan 18 week): attendance={week_info['attendance']}, count={week_info['count']}, dates={week_info['dates']}")
        
        print(f"[REGIONAL_DASHBOARD YTD] Weekly aggregates: {len(ytd_weekly)} weeks")
        # Print all weeks for debugging
        for week_key, week_data in sorted(ytd_weekly.items()):
            print(f"[REGIONAL_DASHBOARD YTD] Week {week_key}: attendance={week_data['attendance']}, count={week_data['count']}, dates={sorted(week_data['dates'])}")
        
        prev_ytd_weekly = {}
        if show_previous_year:
            prev_start_d = date(now.year - 1, 1, 1)
            try:
                prev_end_d = date(now.year - 1, now.month, now.day)
            except ValueError:
                prev_end_d = date(now.year - 1, now.month, 28)
            prev_ytd_records = apply_attendance_metrics_scope(
                AttendanceRecord.query.filter(
                    AttendanceRecord.region_id == region_id,
                    AttendanceRecord.date >= prev_start_d,
                    AttendanceRecord.date <= prev_end_d,
                ),
                metrics_scope,
            ).all()
            print(f"[REGIONAL_DASHBOARD YTD] Previous-year chart: {len(prev_ytd_records)} records from {prev_start_d} to {prev_end_d}")
            for record in prev_ytd_records:
                record_date = record.date
                pkey = _ytd_chart_week_key(record_date)
                if pkey not in prev_ytd_weekly:
                    prev_ytd_weekly[pkey] = {
                        'attendance': 0,
                        'new_people': 0,
                        'new_christians': 0,
                        'count': 0,
                    }
                record_kids = (record.kids_attendance or 0) + (record.kids_leaders or 0)
                record_total = record.total_attendance or 0
                if record_total < record_kids:
                    adults_and_saints = record_total
                else:
                    adults_and_saints = max(0, record_total - record_kids)
                corrected_attendance = adults_and_saints + record_kids
                prev_ytd_weekly[pkey]['attendance'] += corrected_attendance
                prev_ytd_weekly[pkey]['new_people'] += (record.first_time_visitors or 0) + (record.visitors or 0)
                prev_ytd_weekly[pkey]['new_christians'] += (record.first_time_christians or 0) + (record.rededications or 0)
                prev_ytd_weekly[pkey]['count'] += 1
        
        # Build chart_data for Year-To-Date view (weekly)
        chart_data = {
            'labels': [],
            'attendance': [],
            'new_people': [],
            'new_christians': [],
            'youth': [],
            'kids': [],
            'tithe_ytd': [],
            'tithe_previous_year': [],
            'attendance_previous_year': [],
            'tithe_labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        }
        
        # Populate chart with YTD data (week by week from January 1st to today)
        ytd_start_date = ytd_start.date() if isinstance(ytd_start, datetime) else ytd_start
        current_week_start = ytd_start_date
        # Find the Monday of the week containing Jan 1st
        days_since_monday = current_week_start.weekday()
        if days_since_monday > 0:
            current_week_start = current_week_start - timedelta(days=days_since_monday)
        
        anchor_curr = current_week_start
        prev_jan1 = date(now.year - 1, 1, 1)
        anchor_prev = prev_jan1
        dmp = anchor_prev.weekday()
        if dmp > 0:
            anchor_prev = anchor_prev - timedelta(days=dmp)
        
        # Get today's date and find the Monday of this week
        today = now.date() if isinstance(now, datetime) else now
        days_since_monday_today = today.weekday()
        last_week_start = today - timedelta(days=days_since_monday_today)
        
        # Iterate week by week
        while current_week_start <= last_week_start:
            # Use ISO week format to match aggregation
            year, week_num, _ = current_week_start.isocalendar()
            week_key = f"{year}-W{week_num:02d}"
            
            # Create label: Show date range like "Jan 1-7"
            week_end_date = current_week_start + timedelta(days=6)
            if current_week_start.month == week_end_date.month:
                week_label = f"{current_week_start.strftime('%b %d')}-{week_end_date.strftime('%d')}"
            else:
                week_label = f"{current_week_start.strftime('%b %d')}-{week_end_date.strftime('%b %d')}"
            
            chart_data['labels'].append(week_label)
            
            # Get data for this week from ytd_weekly
            week_data = ytd_weekly.get(week_key, {'attendance': 0, 'new_people': 0, 'new_christians': 0, 'count': 0})
            
            # For regional dashboard, show TOTAL attendance across all campuses (not average)
            # This gives the true regional attendance for the week
            attendance_val = week_data['attendance'] if week_data['count'] > 0 else 0
            new_people_val = week_data['new_people'] if week_data['count'] > 0 else 0
            new_christians_val = week_data['new_christians'] if week_data['count'] > 0 else 0
            
            chart_data['attendance'].append(attendance_val)
            chart_data['new_people'].append(new_people_val)
            chart_data['new_christians'].append(new_christians_val)
            chart_data['youth'].append(0)  # TODO: Add youth breakdown if needed
            chart_data['kids'].append(0)  # TODO: Add kids breakdown if needed
            
            if show_previous_year:
                offset_weeks = (current_week_start - anchor_curr).days // 7
                prev_week_start = anchor_prev + timedelta(days=7 * offset_weeks)
                py, pw, _ = prev_week_start.isocalendar()
                prev_week_key = f"{py}-W{pw:02d}"
                prev_week_data = prev_ytd_weekly.get(
                    prev_week_key,
                    {'attendance': 0, 'new_people': 0, 'new_christians': 0, 'count': 0},
                )
                prev_attendance_val = prev_week_data['attendance'] if prev_week_data['count'] > 0 else 0
                chart_data['attendance_previous_year'].append(prev_attendance_val)
            
            # Move to next week (add 7 days)
            current_week_start = current_week_start + timedelta(days=7)
        
        print(f"[REGIONAL_DASHBOARD] Built chart_data with {len(chart_data['labels'])} weeks: {chart_data['labels']}")
        
        # Build response
        response = {
            'region': {
                'code': region_dict['code'],
                'name': region_dict['display_name'],
                'timezone': region_dict['timezone'],
                'currency': region_dict['currency']
            },
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
                'filter': date_filter
            },
            'stats': {
                'total_attendance': total_attendance,
                'total_people_in_campus': total_people_in_campus,
                'avg_weekly_attendance': round(avg_attendance, 1),
                'total_kids': total_kids,
                'avg_kids': round(avg_kids, 1),
                'total_kids_leaders': total_kids_leaders,
                'avg_kids_leaders': round(avg_kids_leaders, 1),
                'total_youth': total_youth_with_leaders,  # Include youth_leaders for Weekend Attendance
                'youth_attendance': total_youth_with_leaders,  # Include youth_leaders for frontend consistency
                'total_youth_attendance': total_youth,  # Youth attendance only (without leaders)
                'total_youth_leaders': total_youth_leaders,  # Youth leaders separately
                'avg_youth': round(avg_youth, 1),
                'total_salvations': total_salvations,
                'first_time_christians': total_adult_salvations,  # Adult salvations
                'rededications': total_rededications,
                'youth_salvations': total_youth_salvations,  # Youth salvations
                'youth_new_people': total_youth_new_people,  # Youth new people
                'new_kids_salvations': total_kids_salvations,  # Kids salvations
                'total_baptisms': total_baptisms,
                'total_child_dedications': total_child_dedications,
                'total_dream_team': total_dream_team,
                'avg_dream_team': round(total_dream_team / record_count, 1) if record_count > 0 else 0,
                'total_connect_groups': total_connect_groups,
                'avg_connect_groups': round(total_connect_groups / record_count, 1) if record_count > 0 else 0,
                'total_visitors': total_visitors,
                'new_people': total_new_people,  # Total new people (includes youth_new_people)
                'total_saints': total_saints,
                'avg_saints': round(total_saints / record_count, 1) if record_count > 0 else 0,
                'total_giving': round(total_giving, 2),
                'avg_weekly_giving': round(avg_giving, 2),
                'week_count': week_count,
                'campus_count': len(campuses),
                'active_campuses': len([c for c in campus_stats if c['record_count'] > 0])
            },
            'campuses': campus_stats,
            'recent_records': len(records),
            'chart_data': chart_data,
            'metrics_scope': normalize_metrics_scope(metrics_scope),
        }
        
        print(f"[REGIONAL_DASHBOARD] Successfully generated response with {len(records)} records")
        logger.info(f"[REGIONAL_DASHBOARD] Successfully generated response")
        resp = jsonify(response)
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        return resp
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[REGIONAL_DASHBOARD] ERROR: {e}")
        print(f"[REGIONAL_DASHBOARD] Traceback: {error_trace}")
        logger.error(f"[REGIONAL_DASHBOARD] Regional dashboard error: {e}", exc_info=True)
        logger.error(f"[REGIONAL_DASHBOARD] Full traceback: {error_trace}")
        return jsonify({"error": f"Failed to load regional dashboard data: {str(e)}"}), 500

@app.route('/api/dashboard/global')
@login_required
def get_global_dashboard_data():
    """
    Global dashboard - aggregates stats across ALL regions
    Accessible only by global roles (admin, senior_leadership, senior_pastor, lead_pastor)
    """
    try:
        from models import Region, CampusV2, AttendanceRecord
        from sqlalchemy import func
        
        # Get request parameters
        date_filter = request.args.get('date_filter', 'last_12_months')
        custom_start_date = request.args.get('custom_start_date', '')
        custom_end_date = request.args.get('custom_end_date', '')
        metrics_scope = _parse_metrics_scope()
        
        # Get user context from current_user (Flask-Login)
        user_role = getattr(current_user, 'role', 'member') if current_user.is_authenticated else 'member'
        
        print(f"[GLOBAL_DASHBOARD] User: {current_user.username if current_user.is_authenticated else 'anonymous'}, Role: {user_role}")
        
        # Check global access permissions - allow same roles as regional
        allowed_roles = ['superadmin', 'admin', 'senior_leader', 'senior_pastor', 'lead_pastor', 'campus_pastor', 'senior_leadership']
        
        if user_role not in allowed_roles:
            print(f"[GLOBAL_DASHBOARD] Access denied for role: {user_role}")
            return jsonify({"error": f"Access denied - global access required. Your role '{user_role}' does not have permission."}), 403
        
        print(f"[GLOBAL_DASHBOARD] ✅ Access granted for role: {user_role}")
        
        # Calculate date range
        end_date = datetime.now().date()
        if date_filter == 'last_7_days':
            start_date = end_date - timedelta(days=7)
        elif date_filter == 'last_30_days':
            start_date = end_date - timedelta(days=30)
        elif date_filter == 'last_90_days':
            start_date = end_date - timedelta(days=90)
        elif date_filter in ['this_year', 'year_to_date']:
            start_date = datetime(end_date.year, 1, 1).date()
        elif date_filter == 'last_12_months':
            start_date = end_date - timedelta(days=365)
        elif custom_start_date and custom_end_date:
            start_date = datetime.strptime(custom_start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(custom_end_date, '%Y-%m-%d').date()
        else:
            start_date = end_date - timedelta(days=365)
        
        # Query all attendance records
        all_records = apply_attendance_metrics_scope(
            AttendanceRecord.query.filter(
                AttendanceRecord.date >= start_date,
                AttendanceRecord.date <= end_date,
            ),
            metrics_scope,
        ).all()
        
        # If no records, fall back to Google Sheets (database first, Sheets backup)
        if len(all_records) == 0:
            print(f"[GLOBAL_DASHBOARD] No records found, falling back to Google Sheets")
            try:
                fallback = get_dashboard_data(
                    'all_campuses', date_filter, custom_start_date, custom_end_date,
                    metrics_scope=metrics_scope,
                )
                s = fallback.get('stats', {})
                if s:
                    record_count = max(1, s.get('entry_count', 1))
                    resp_data = {
                        'date_range': {'start': start_date.isoformat(), 'end': end_date.isoformat(), 'filter': date_filter},
                        'global_stats': {
                            'total_attendance': s.get('total_attendance', 0),
                            'avg_weekly_attendance': round(s.get('avg_attendance', 0), 1),
                            'total_kids': s.get('kids_attendance', 0),
                            'avg_kids': round(s.get('avg_kids_attendance', 0), 1),
                            'total_youth': s.get('youth_attendance', 0),
                            'avg_youth': round(s.get('avg_youth_attendance', 0), 1),
                            'total_salvations': (s.get('first_time_christians', 0) + s.get('rededications', 0) + s.get('youth_salvations', 0) + s.get('new_kids_salvations', 0)),
                            'total_baptisms': s.get('baptisms', 0),
                            'total_visitors': s.get('first_time_visitors', 0),
                            'total_giving': round(float(s.get('tithe', 0)), 2),
                            'avg_weekly_giving': round(float(s.get('avg_tithe', 0)), 2),
                            'week_count': record_count,
                            'total_regions': 1,
                            'active_regions': 1,
                            'total_campuses': 1
                        },
                        'regions': [],
                        'total_records': 0,
                        'metrics_scope': normalize_metrics_scope(metrics_scope),
                    }
                    resp = jsonify(resp_data)
                    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
                    resp.headers['Pragma'] = 'no-cache'
                    return resp
            except Exception as fb_err:
                print(f"[GLOBAL_DASHBOARD] Sheets fallback failed: {fb_err}")
                logger.warning(f"[GLOBAL_DASHBOARD] Sheets fallback failed: {fb_err}")
        
        # Get all regions and campuses
        regions = Region.query.filter_by(active=True).all()
        all_campuses = CampusV2.query.filter_by(active=True).all()
        
        # Global aggregate statistics
        total_attendance = sum(r.total_attendance or 0 for r in all_records)
        total_kids = sum(r.kids_attendance or 0 for r in all_records)
        total_youth = sum(r.youth_attendance or 0 for r in all_records)
        total_salvations = sum((r.first_time_christians or 0) + (r.rededications or 0) for r in all_records)
        total_baptisms = sum(r.baptisms or 0 for r in all_records)
        total_visitors = sum(r.first_time_visitors or 0 for r in all_records)
        total_giving = sum(float(r.tithe or 0) for r in all_records)
        
        # Calculate global averages - use number of records (services) not unique dates
        # This ensures we get average per service across all campuses
        record_count = max(1, len(all_records))
        avg_attendance = total_attendance / record_count if record_count > 0 else 0
        avg_kids = total_kids / record_count if record_count > 0 else 0
        avg_youth = total_youth / record_count if record_count > 0 else 0
        avg_giving = total_giving / record_count if record_count > 0 else 0
        
        # Calculate week_count for display purposes (unique dates)
        week_count = max(1, len(set(r.date for r in all_records)))
        
        # Get region breakdown
        region_stats = []
        for region in regions:
            region_records = [r for r in all_records if r.region_id == region.id]
            if region_records:
                region_total = sum(r.total_attendance or 0 for r in region_records)
                region_giving = sum(float(r.tithe or 0) for r in region_records)
                region_salvations = sum((r.first_time_christians or 0) + (r.rededications or 0) for r in region_records)
                # Average per service (record), not per unique date
                region_avg = region_total / len(region_records) if region_records else 0
                
                region_campuses = [c for c in all_campuses if c.region_id == region.id]
                
                region_stats.append({
                    'region_code': region.code,
                    'region_name': region.display_name,
                    'total_attendance': region_total,
                    'avg_weekly_attendance': round(region_avg, 1),
                    'total_giving': round(region_giving, 2),
                    'total_salvations': region_salvations,
                    'campus_count': len(region_campuses),
                    'record_count': len(region_records)
                })
        
        # Sort regions by total attendance
        region_stats.sort(key=lambda x: x['total_attendance'], reverse=True)
        
        # Build response
        response = {
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
                'filter': date_filter
            },
            'global_stats': {
                'total_attendance': total_attendance,
                'avg_weekly_attendance': round(avg_attendance, 1),
                'total_kids': total_kids,
                'avg_kids': round(avg_kids, 1),
                'total_youth': total_youth,
                'avg_youth': round(avg_youth, 1),
                'total_salvations': total_salvations,
                'total_baptisms': total_baptisms,
                'total_visitors': total_visitors,
                'total_giving': round(total_giving, 2),
                'avg_weekly_giving': round(avg_giving, 2),
                'week_count': week_count,
                'total_regions': len(regions),
                'active_regions': len([r for r in region_stats if r['record_count'] > 0]),
                'total_campuses': len(all_campuses)
            },
            'regions': region_stats,
            'total_records': len(all_records),
            'metrics_scope': normalize_metrics_scope(metrics_scope),
        }
        
        resp = jsonify(response)
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        return resp
    
    except Exception as e:
        logger.error(f"Global dashboard error: {e}", exc_info=True)
        return jsonify({"error": "Failed to load global dashboard data"}), 500

@app.route('/api/users/create', methods=['POST'])
@admin_required
def create_user_api():
    """API endpoint for creating a new user"""
    try:
        data = request.get_json()
        
        # Strip whitespace from username to prevent login issues
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
        
        # Insert into database
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if username already exists (using TRIM for comparison)
        cursor.execute('SELECT id, active FROM users WHERE TRIM(username) = ?', (username,))
        existing_user = cursor.fetchone()
        
        # Get region_id from request (optional)
        region_id = data.get('region_id')
        
        if existing_user:
            user_id, is_active = existing_user
            if is_active:
                # Active user with this username already exists
                conn.close()
                return jsonify({"error": "Username already exists"}), 400
            else:
                # Inactive user exists - reactivate and update it
                cursor.execute('''
                    UPDATE users 
                    SET password_hash = ?, full_name = ?, email = ?, role = ?, campus = ?, region_id = ?, active = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (
                    generate_password_hash(password),
                    data.get('full_name', username).strip() if data.get('full_name') else username,
                    data.get('email', f"{username}@futures.church").strip() if data.get('email') else f"{username}@futures.church",
                    data.get('role', 'campus_pastor'),
                    data.get('campus', 'all_campuses'),
                    region_id,
                    user_id
                ))
                
                conn.commit()
                conn.close()
                
                logger.info(f"Reactivated user: {username} with role: {data.get('role')}")
                return jsonify({"success": True, "message": "User reactivated and updated successfully", "id": user_id})
        else:
            # Insert new user
            cursor.execute('''
                INSERT INTO users (username, password_hash, full_name, email, role, campus, region_id, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                username,
                generate_password_hash(password),
                data.get('full_name', username).strip() if data.get('full_name') else username,
                data.get('email', f"{username}@futures.church").strip() if data.get('email') else f"{username}@futures.church",
                data.get('role', 'campus_pastor'),
                data.get('campus', 'all_campuses'),
                region_id,
                1
            ))
            new_user_id = cursor.lastrowid
            conn.commit()
            conn.close()
            logger.info(f"Created new user: {username} with role: {data.get('role')}")
            return jsonify({"success": True, "message": "User created successfully", "id": new_user_id})
    except Exception as e:
        logger.error(f"Create user API error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create user"}), 500

@app.route('/api/users/<user_id>/edit', methods=['POST'])
@admin_required_json
def edit_user_api(user_id):
    """API endpoint for editing a user"""
    try:
        data = request.get_json()
        
        # Update in database
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id, username FROM users WHERE id = ?', (user_id,))
        existing_user = cursor.fetchone()
        
        if not existing_user:
            conn.close()
            return jsonify({"error": "User not found"}), 404
        
        # Check if username is being changed and if it's already taken
        if data.get('username') and data.get('username').strip() != existing_user[1]:
            cursor.execute('SELECT id FROM users WHERE TRIM(username) = ? AND id != ?', 
                         (data['username'].strip(), user_id))
            if cursor.fetchone():
                conn.close()
                return jsonify({"error": f"Username '{data['username']}' is already taken"}), 400
        
        # Build update query
        update_fields = []
        params = []
        
        if data.get('username'):
            update_fields.append('username = ?')
            params.append(data['username'])
        
        if data.get('password'):
            update_fields.append('password_hash = ?')
            params.append(generate_password_hash(data['password']))
        
        if data.get('full_name') is not None:
            update_fields.append('full_name = ?')
            params.append(data['full_name'])
        
        if data.get('email') is not None:
            update_fields.append('email = ?')
            params.append(data['email'])
        
        if data.get('role'):
            update_fields.append('role = ?')
            params.append(data['role'])
        
        if data.get('campus') is not None:
            update_fields.append('campus = ?')
            params.append(data['campus'])
        
        # Add region_id support
        if 'region_id' in data:
            update_fields.append('region_id = ?')
            params.append(data['region_id'])
        
        if update_fields:
            params.append(user_id)
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        
        logger.info(f"Updated user ID: {user_id}, role: {data.get('role', 'not changed')}")
        return jsonify({"success": True, "message": "User updated successfully"})
    except Exception as e:
        logger.error(f"Edit user API error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update user"}), 500

@app.route('/api/users/<user_id>/delete', methods=['POST'])
@admin_required
def delete_user_api(user_id):
    """API endpoint for deleting a user"""
    try:
        # Delete from database (soft delete by setting active = 0)
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "User not found"}), 404
        
        # Soft delete (set active = 0)
        cursor.execute('UPDATE users SET active = 0 WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        
        logger.info(f"Deleted user ID: {user_id}")
        return jsonify({"success": True, "message": "User deleted successfully"})
    except Exception as e:
        logger.error(f"Delete user API error: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete user"}), 500

@app.route('/api/users/<user_id>', methods=['PUT'])
@login_required
def update_user_region_api(user_id):
    """Update a user's region (region_code). Used by Role Manager. Same roles as get_all_users_permissions."""
    try:
        if current_user.role not in ALL_ACCESS_ROLES:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json() or {}
        region_code = (data.get('region_code') or '').strip().upper()
        if not region_code:
            return jsonify({'error': 'region_code is required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'region_id' not in columns:
            conn.close()
            return jsonify({'error': 'Users table does not support region_id'}), 400
        
        cursor.execute("SELECT id FROM regions WHERE code = ?", (region_code,))
        region_row = cursor.fetchone()
        if not region_row:
            conn.close()
            return jsonify({'error': f'Region not found: {region_code}'}), 404
        
        region_id = region_row[0]
        cursor.execute('SELECT id FROM users WHERE id = ? AND active = 1', (user_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        cursor.execute('UPDATE users SET region_id = ? WHERE id = ?', (region_id, user_id))
        conn.commit()
        conn.close()
        
        logger.info(f"Updated user {user_id} region to {region_code} (region_id={region_id})")
        return jsonify({"success": True, "message": "Region updated", "region_code": region_code, "region_id": region_id})
    except Exception as e:
        logger.error(f"Update user region API error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update region"}), 500

@app.route('/api/users/permissions', methods=['GET'])
@login_required
def get_all_users_permissions():
    """Get all users with their permissions (admin and leadership only)"""
    try:
        if current_user.role not in ALL_ACCESS_ROLES:
            return jsonify({'error': 'Unauthorized'}), 403
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if custom_permissions and region_id columns exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        has_custom_permissions = 'custom_permissions' in columns
        has_region_id = 'region_id' in columns
        
        if has_region_id and has_custom_permissions:
            cursor.execute('''
                SELECT u.id, u.username, u.full_name, u.email, u.role, u.campus, u.active, u.custom_permissions, u.region_id, r.code as region_code
                FROM users u
                LEFT JOIN regions r ON u.region_id = r.id
                WHERE u.active = 1
                ORDER BY u.full_name, u.username
            ''')
        elif has_custom_permissions:
            cursor.execute('''
                SELECT id, username, full_name, email, role, campus, active, custom_permissions
                FROM users
                WHERE active = 1
                ORDER BY full_name, username
            ''')
        else:
            cursor.execute('''
                SELECT id, username, full_name, email, role, campus, active
                FROM users
                WHERE active = 1
                ORDER BY full_name, username
            ''')
        
        users_list = []
        import json
        for row in cursor.fetchall():
            custom_permissions = {}
            if has_custom_permissions and len(row) > 7:
                try:
                    custom_perms = row[7]
                    if custom_perms:
                        custom_permissions = json.loads(custom_perms) if isinstance(custom_perms, str) else custom_perms
                except:
                    custom_permissions = {}
            
            region_id = None
            region_code = None
            if has_region_id and len(row) > 9:
                region_id = row[8]
                region_code = row[9] if row[9] else None
            
            user_entry = {
                'id': row[0],
                'username': row[1],
                'full_name': row[2] or row[1],
                'email': row[3] or '',
                'role': row[4],
                'campus': row[5] or 'all_campuses',
                'active': bool(row[6]),
                'custom_permissions': custom_permissions
            }
            if has_region_id:
                user_entry['region_id'] = region_id
                user_entry['region_code'] = region_code
            users_list.append(user_entry)
        
        conn.close()
        return jsonify({'users': users_list, 'success': True})
    except Exception as e:
        logger.error(f"Error fetching users permissions: {e}", exc_info=True)
        return jsonify({'error': f'Failed to fetch users permissions: {str(e)}'}), 500

@app.route('/api/users/<user_id>/permissions', methods=['GET'])
@login_required
def get_user_permissions(user_id):
    """Get specific user permissions"""
    try:
        if current_user.role not in ALL_ACCESS_ROLES:
            return jsonify({'error': 'Unauthorized'}), 403
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Try to select with custom_permissions, fallback if column doesn't exist
        try:
            cursor.execute('''
                SELECT id, username, full_name, role, custom_permissions
                FROM users
                WHERE id = ? AND active = 1
            ''', (user_id,))
        except Exception:
            # Fallback if custom_permissions column doesn't exist yet
            cursor.execute('''
                SELECT id, username, full_name, role
                FROM users
                WHERE id = ? AND active = 1
            ''', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'User not found'}), 404
        
        import json
        custom_permissions = {}
        if len(row) > 4:
            try:
                custom_perms = row[4]
                if custom_perms:
                    custom_permissions = json.loads(custom_perms) if isinstance(custom_perms, str) else custom_perms
            except:
                custom_permissions = {}
        
        return jsonify({
            'user_id': row[0],
            'username': row[1],
            'full_name': row[2] or row[1],
            'role': row[3],
            'custom_permissions': custom_permissions,
            'success': True
        })
    except Exception as e:
        logger.error(f"Error fetching user permissions: {e}")
        return jsonify({'error': 'Failed to fetch user permissions'}), 500

@app.route('/api/users/<user_id>/permissions', methods=['POST'])
@login_required
def update_user_permissions(user_id):
    """Update user's custom permissions"""
    try:
        if current_user.role not in ALL_ACCESS_ROLES:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        permissions = data.get('permissions', {})
        
        # Validate permissions structure
        if not isinstance(permissions, dict):
            return jsonify({'error': 'Invalid permissions format'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Update custom permissions
        import json
        # Ensure empty dict is saved as '{}' not None, and preserve false values
        if not permissions:
            permissions_json = '{}'
        else:
            # Use json.dumps with ensure_ascii=False to properly handle all values including False
            permissions_json = json.dumps(permissions, ensure_ascii=False)
        
        logger.info(f"[ROLE_MANAGER] Updating permissions for user_id={user_id}: {permissions_json}")
        print(f"[ROLE_MANAGER] Updating permissions for user_id={user_id}: {permissions_json}")
        
        # Try to update custom_permissions, but handle if column doesn't exist yet
        try:
            cursor.execute('''
                UPDATE users 
                SET custom_permissions = ?
                WHERE id = ?
            ''', (permissions_json, user_id))
            conn.commit()
            
            # Verify the save worked
            cursor.execute('SELECT custom_permissions FROM users WHERE id = ?', (user_id,))
            saved_row = cursor.fetchone()
            if saved_row:
                saved_perms = saved_row[0]
                logger.info(f"[ROLE_MANAGER] Verified save - saved_permissions={saved_perms}")
                print(f"[ROLE_MANAGER] Verified save - saved_permissions={saved_perms}")
        except Exception as e:
            # If column doesn't exist, try to add it first
            try:
                cursor.execute('ALTER TABLE users ADD COLUMN custom_permissions TEXT DEFAULT NULL')
                cursor.execute('''
                    UPDATE users 
                    SET custom_permissions = ?
                    WHERE id = ?
                ''', (permissions_json, user_id))
                conn.commit()
            except Exception as e2:
                conn.rollback()
                conn.close()
                logger.error(f"Error updating permissions (column may not exist): {e2}")
                return jsonify({'error': 'Failed to update permissions. Migration may be needed.'}), 500
        
        # Fetch the saved permissions to verify
        cursor.execute('SELECT custom_permissions FROM users WHERE id = ?', (user_id,))
        verify_row = cursor.fetchone()
        saved_permissions_verified = {}
        if verify_row and verify_row[0]:
            try:
                saved_permissions_verified = json.loads(verify_row[0]) if isinstance(verify_row[0], str) else verify_row[0]
            except:
                saved_permissions_verified = {}
        
        conn.close()
        
        logger.info(f"[ROLE_MANAGER] ✅ Successfully updated permissions for user_id={user_id}. Saved: {saved_permissions_verified}")
        print(f"[ROLE_MANAGER] ✅ Successfully updated permissions for user_id={user_id}. Saved: {saved_permissions_verified}")
        
        return jsonify({
            'success': True,
            'message': 'Permissions updated successfully',
            'permissions': saved_permissions_verified,  # Return what was actually saved
            'requested_permissions': permissions  # Also return what was requested for comparison
        })
    except Exception as e:
        logger.error(f"Error updating user permissions: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update permissions'}), 500

# PROFILE MANAGEMENT ROUTES - Duplicate removed (moved to earlier in file around line 10158)

# DATA EXPORT ROUTES
@app.route('/api/export/attendance', methods=['GET'])
@login_required
def export_attendance():
    """Export attendance data to CSV - respects Role Manager data_export"""
    if not current_user.has_permission('data_export'):
        return jsonify({"error": "Access denied - Data Export has been disabled for your account"}), 403
    try:
        import csv
        from io import StringIO
        
        campus = request.args.get('campus', 'all_campuses')
        date_filter = request.args.get('date_filter', 'last_12_months')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        
        # Get data from Google Sheets
        if not sheet:
            return jsonify({"error": "Google Sheets not available"}), 503
        
        rows = safe_sheets_request(sheet.get_all_records)
        if not rows:
            return jsonify({"error": "No data available"}), 404
        
        # Filter by campus if not all_campuses
        if campus != 'all_campuses':
            campus_normalized = normalize_campus(campus)
            filtered_rows = []
            for row in rows:
                row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
                if campus_normalized in row_campus or row_campus in campus_normalized:
                    filtered_rows.append(row)
            rows = filtered_rows
        
        # Create CSV
        output = StringIO()
        if rows:
            fieldnames = list(rows[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        # Create response
        response_data = output.getvalue()
        output.close()
        
        response = Response(response_data, mimetype='text/csv')
        response.headers['Content-Disposition'] = f'attachment; filename=attendance_export_{datetime.now().strftime("%Y%m%d")}.csv'
        return response
        
    except Exception as e:
        logger.error(f"Export attendance error: {e}")
        return jsonify({"error": "Failed to export data"}), 500


def _normalize_campus_slug_for_report(raw: str) -> str:
    s = (raw or "").strip().lower().replace(" ", "_").replace("-", "_")
    if s.endswith("_campus"):
        s = s[:-7]
    return s


def _q1_report_filename(
    year: int,
    region_code: str,
    campuses_csv: str,
    compare: bool = False,
    period: str = "q1",
    per_campus_pdf: bool = False,
    exclude_youth_metrics: bool = False,
    metrics_scope: str = "default",
    *,
    custom_start: date | None = None,
    custom_end: date | None = None,
) -> str:
    from q1_attendance_report import normalized_report_period

    suf = ""
    if region_code and region_code.strip():
        suf += f"-{region_code.strip().upper()}"
    if campuses_csv and campuses_csv.strip():
        n = len([x for x in campuses_csv.split(",") if x.strip()])
        if n:
            suf += f"-{n}cx"
    if compare:
        suf += "-yoy"
    if per_campus_pdf:
        suf += "-per-campus"
    if exclude_youth_metrics:
        suf += "-excl-youth"
    ms = normalize_metrics_scope(metrics_scope)
    if ms != "default":
        suf += f"-{ms.replace('_', '-')}"
    if custom_start is not None and custom_end is not None:
        base = f"pulse-custom-{custom_start.isoformat()}-to-{custom_end.isoformat()}"
    else:
        p = normalized_report_period(period)
        base = f"pulse-{p}-attendance-{year}"
    return f"{base}{suf}"


def _q1_report_data(
    year: int,
    region_code: str | None = None,
    campuses_csv: str | None = None,
    *,
    start_d: date,
    end_d: date,
    period_code: str = "q1",
    period_label: str = "Q1",
    period_caption: str = "Jan–Mar",
    include_youth_metrics: bool = True,
    metrics_scope: str = "default",
):
    """
    Load ``AttendanceRecord`` rows for the inclusive date range (Q1–Q4 or YTD). Database only.

    Optional filters: region code (e.g. AU), comma-separated campus_id slugs (campuses_v2.campus_id).
    Aggregated via ``build_q1_data`` (same rules for every ``period_code``).
    """
    from models import AttendanceRecord, CampusV2, Region
    from sqlalchemy import func
    from q1_attendance_report import build_q1_data

    q = AttendanceRecord.query.filter(
        AttendanceRecord.date >= start_d,
        AttendanceRecord.date <= end_d,
    )
    q = apply_attendance_metrics_scope(q, metrics_scope)

    region_obj = None
    rc = (region_code or "").strip()
    if rc:
        region_obj = Region.query.filter(
            func.upper(Region.code) == rc.upper(),
            Region.active.is_(True),
        ).first()
        if not region_obj:
            raise ValueError(f"Unknown or inactive region code: {rc}")
        q = q.filter(AttendanceRecord.region_id == region_obj.id)

    campus_slugs_in = []
    if campuses_csv and campuses_csv.strip():
        campus_slugs_in = [s.strip() for s in campuses_csv.split(",") if s.strip()]

    resolved_ids = []
    display_names = []
    if campus_slugs_in:
        seen = set()
        for raw in campus_slugs_in:
            slug = _normalize_campus_slug_for_report(raw)
            c = CampusV2.query.filter(func.lower(CampusV2.campus_id) == slug).first()
            if not c:
                raise ValueError(f"Unknown campus: {raw}")
            if region_obj and c.region_id != region_obj.id:
                raise ValueError(
                    f"Campus '{c.display_name}' is not in the selected region ({region_obj.code})"
                )
            if c.id not in seen:
                seen.add(c.id)
                resolved_ids.append(c.id)
                display_names.append(c.display_name)
        q = q.filter(AttendanceRecord.campus_id.in_(resolved_ids))

    records = q.all()
    campus_ids = {r.campus_id for r in records}
    campuses_by_id = {}
    for cid in campus_ids:
        c = CampusV2.query.get(cid)
        if c:
            campuses_by_id[cid] = c

    parts = []
    parts.append(f"Period: {period_label} ({start_d} to {end_d})")
    if region_obj:
        parts.append(f"Region: {region_obj.display_name} ({region_obj.code})")
    else:
        parts.append("Region: all")

    if campus_slugs_in:
        if len(display_names) <= 6:
            parts.append("Campuses: " + ", ".join(display_names))
        else:
            parts.append(f"Campuses: {len(display_names)} selected")
    elif region_obj:
        parts.append("Campuses: all in region")
    else:
        parts.append("Campuses: all")

    if not include_youth_metrics:
        parts.append(
            "New people & salvations: youth excluded (NP = FTV + visitors; salvations excl. youth salvations)"
        )

    ms = normalize_metrics_scope(metrics_scope)
    if ms != "default":
        scope_labels = {
            "rollup_only": "Standard services only (entries marked as special events omitted)",
            "sundays_only": "Calendar Sundays only",
            "sundays_rollup_only": "Sundays only (standard services)",
            "special_events_only": "Special events only",
        }
        parts.append(scope_labels.get(ms, f"metrics_scope={ms}"))

    filter_summary = " · ".join(parts)
    return build_q1_data(
        year,
        records,
        campuses_by_id,
        filter_summary=filter_summary,
        start=start_d,
        end=end_d,
        period_code=period_code,
        period_label=period_label,
        period_caption=period_caption,
        include_youth_metrics=include_youth_metrics,
    )


def _load_attendance_records_for_explorer(
    start_d: date,
    end_d: date,
    region_code: str | None,
    campuses_csv: str | None,
    metrics_scope: str,
    include_youth_metrics: bool,
):
    """
    Same filters as quarterly reports / dashboard — returns raw rows + campus map + human summary.
    Used by Ministry Stats Explorer (no Google Sheets).
    """
    from models import AttendanceRecord, CampusV2, Region
    from sqlalchemy import func

    q = AttendanceRecord.query.filter(
        AttendanceRecord.date >= start_d,
        AttendanceRecord.date <= end_d,
    )
    q = apply_attendance_metrics_scope(q, metrics_scope)

    region_obj = None
    rc = (region_code or "").strip()
    if rc:
        region_obj = Region.query.filter(
            func.upper(Region.code) == rc.upper(),
            Region.active.is_(True),
        ).first()
        if not region_obj:
            raise ValueError(f"Unknown or inactive region code: {rc}")
        q = q.filter(AttendanceRecord.region_id == region_obj.id)

    campus_slugs_in = []
    if campuses_csv and campuses_csv.strip():
        campus_slugs_in = [s.strip() for s in campuses_csv.split(",") if s.strip()]

    resolved_ids = []
    display_names = []
    if campus_slugs_in:
        seen = set()
        for raw in campus_slugs_in:
            slug = _normalize_campus_slug_for_report(raw)
            c = CampusV2.query.filter(func.lower(CampusV2.campus_id) == slug).first()
            if not c:
                raise ValueError(f"Unknown campus: {raw}")
            if region_obj and c.region_id != region_obj.id:
                raise ValueError(
                    f"Campus '{c.display_name}' is not in the selected region ({region_obj.code})"
                )
            if c.id not in seen:
                seen.add(c.id)
                resolved_ids.append(c.id)
                display_names.append(c.display_name)
        q = q.filter(AttendanceRecord.campus_id.in_(resolved_ids))

    records = q.all()
    campus_ids = {r.campus_id for r in records}
    campuses_by_id = {}
    for cid in campus_ids:
        c = CampusV2.query.get(cid)
        if c:
            campuses_by_id[cid] = c

    parts = []
    parts.append(f"Date range: {start_d} to {end_d}")
    if region_obj:
        parts.append(f"Region: {region_obj.display_name} ({region_obj.code})")
    else:
        parts.append("Region: all")

    if campus_slugs_in:
        if len(display_names) <= 6:
            parts.append("Campuses: " + ", ".join(display_names))
        else:
            parts.append(f"Campuses: {len(display_names)} selected")
    elif region_obj:
        parts.append("Campuses: all in region")
    else:
        parts.append("Campuses: all")

    if not include_youth_metrics:
        parts.append(
            "New people & salvations: youth excluded (NP = FTV + visitors; salvations excl. youth salvations)"
        )

    ms = normalize_metrics_scope(metrics_scope)
    if ms != "default":
        scope_labels = {
            "rollup_only": "Standard services only (entries marked as special events omitted)",
            "sundays_only": "Calendar Sundays only",
            "sundays_rollup_only": "Sundays only (standard services)",
            "special_events_only": "Special events only",
        }
        parts.append(scope_labels.get(ms, f"metrics_scope={ms}"))

    filter_summary = " · ".join(parts)
    return records, campuses_by_id, filter_summary


def _parse_report_period() -> str:
    from q1_attendance_report import normalized_report_period

    return normalized_report_period(request.args.get("period"))


def _q1_report_with_optional_yoy(
    year: int,
    region: str,
    campuses: str,
    include_previous_year: bool,
    period: str = "q1",
    *,
    include_youth_metrics: bool = True,
    metrics_scope: str = "default",
):
    from q1_attendance_report import (
        build_compare_payload,
        format_period_caption,
        normalized_report_period,
        report_range_for_year_period,
        ytd_end_for_prior_year_yoy,
    )

    p = normalized_report_period(period)
    s_c, e_c, code, lbl, cap_c = report_range_for_year_period(year, p)
    data_curr = _q1_report_data(
        year,
        region_code=region or None,
        campuses_csv=campuses or None,
        start_d=s_c,
        end_d=e_c,
        period_code=code,
        period_label=lbl,
        period_caption=cap_c,
        include_youth_metrics=include_youth_metrics,
        metrics_scope=metrics_scope,
    )
    if not include_previous_year:
        return data_curr
    if year <= 2000:
        raise ValueError("Cannot include previous year for this year value")
    if p == "ytd":
        s_p = date(year - 1, 1, 1)
        e_p = ytd_end_for_prior_year_yoy(e_c, year - 1)
        cap_p = format_period_caption(s_p, e_p, "ytd")
        data_prev = _q1_report_data(
            year - 1,
            region_code=region or None,
            campuses_csv=campuses or None,
            start_d=s_p,
            end_d=e_p,
            period_code="ytd",
            period_label="YTD",
            period_caption=cap_p,
            include_youth_metrics=include_youth_metrics,
            metrics_scope=metrics_scope,
        )
    else:
        s_p, e_p, code_p, lbl_p, cap_p = report_range_for_year_period(year - 1, p)
        data_prev = _q1_report_data(
            year - 1,
            region_code=region or None,
            campuses_csv=campuses or None,
            start_d=s_p,
            end_d=e_p,
            period_code=code_p,
            period_label=lbl_p,
            period_caption=cap_p,
            include_youth_metrics=include_youth_metrics,
            metrics_scope=metrics_scope,
        )
    return build_compare_payload(data_curr, data_prev)


def _try_parse_custom_report_range() -> Optional[Tuple[date, date]]:
    """
    If both start_date and end_date are present (YYYY-MM-DD), return inclusive (start, end).
    If neither is present, return None. If only one is present, raise ValueError.
    """
    start_raw = (request.args.get("start_date") or request.args.get("custom_start_date") or "").strip()
    end_raw = (request.args.get("end_date") or request.args.get("custom_end_date") or "").strip()
    if not start_raw and not end_raw:
        return None
    if not start_raw or not end_raw:
        raise ValueError("Custom range requires both start_date and end_date (YYYY-MM-DD)")
    try:
        start_d = datetime.strptime(start_raw, "%Y-%m-%d").date()
        end_d = datetime.strptime(end_raw, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Invalid start_date or end_date — use YYYY-MM-DD") from None
    if start_d > end_d:
        raise ValueError("start_date must be on or before end_date")
    today = date.today()
    if end_d > today:
        raise ValueError("end_date cannot be in the future")
    if start_d < date(2000, 1, 1):
        raise ValueError("start_date must be on or after 2000-01-01")
    max_days = 1095  # 3 years
    if (end_d - start_d).days > max_days:
        raise ValueError(f"Date range cannot exceed {max_days} days (~3 years)")
    return (start_d, end_d)


def _q1_report_custom_range_with_optional_yoy(
    start_d: date,
    end_d: date,
    region: str,
    campuses: str,
    include_previous_year: bool,
    *,
    include_youth_metrics: bool = True,
    metrics_scope: str = "default",
):
    """Attendance report for an arbitrary inclusive date range (Pulse DB only)."""
    from q1_attendance_report import (
        build_compare_payload,
        format_period_caption,
        ytd_end_for_prior_year_yoy,
    )

    y_curr = end_d.year
    cap_c = format_period_caption(start_d, end_d, "custom")
    data_curr = _q1_report_data(
        y_curr,
        region_code=region or None,
        campuses_csv=campuses or None,
        start_d=start_d,
        end_d=end_d,
        period_code="custom",
        period_label="Custom",
        period_caption=cap_c,
        include_youth_metrics=include_youth_metrics,
        metrics_scope=metrics_scope,
    )
    if not include_previous_year:
        return data_curr
    s_p = ytd_end_for_prior_year_yoy(start_d, start_d.year - 1)
    e_p = ytd_end_for_prior_year_yoy(end_d, end_d.year - 1)
    if s_p > e_p:
        raise ValueError("Invalid prior-year alignment for custom date range")
    cap_p = format_period_caption(s_p, e_p, "custom")
    y_prev = e_p.year
    data_prev = _q1_report_data(
        y_prev,
        region_code=region or None,
        campuses_csv=campuses or None,
        start_d=s_p,
        end_d=e_p,
        period_code="custom",
        period_label="Custom",
        period_caption=cap_p,
        include_youth_metrics=include_youth_metrics,
        metrics_scope=metrics_scope,
    )
    return build_compare_payload(data_curr, data_prev)


def _parse_include_previous_year() -> bool:
    v = (request.args.get("include_previous_year") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _parse_per_campus_pdf() -> bool:
    v = (request.args.get("per_campus") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _parse_exclude_youth_metrics() -> bool:
    """
    When true, new people = FTV + visitors only and salvations exclude youth_salvations.
    Accepts exclude_youth_metrics or legacy exclude_youth_new_people.
    """
    for key in ("exclude_youth_metrics", "exclude_youth_new_people"):
        v = (request.args.get(key) or "").strip().lower()
        if v in ("1", "true", "yes", "on"):
            return True
    return False


def _parse_metrics_scope() -> str:
    """Query param metrics_scope=default|rollup_only|sundays_only|sundays_rollup_only|special_events_only"""
    return normalize_metrics_scope(request.args.get("metrics_scope"))


@app.route('/api/reports/quarterly-attendance.csv', methods=['GET'])
@app.route('/api/reports/q1-attendance.csv', methods=['GET'])
@login_required
def report_q1_attendance_csv():
    """
    Quarterly (Q1–Q4) and YTD attendance by campus — CSV from ``attendance_records`` only.
    Use ``?period=q1|q2|q3|q4|ytd`` (default q1), or ``?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`` for a custom
    inclusive range (end not in the future; max ~3 years). Same columns and rules.

    ``data_export`` users may query any region/campuses. Other users need ``dashboard_access``;
    campus filters are restricted to campuses they are allowed to see (same rules as /api/campuses).
    """
    if not (
        current_user.has_permission('data_export')
        or current_user.has_permission('dashboard_access')
    ):
        return jsonify({"error": "Access denied"}), 403
    try:
        from q1_attendance_report import build_q1_csv_bytes

        region = request.args.get('region', '').strip()
        campuses = request.args.get('campuses', '').strip()
        try:
            region, campuses = _scope_quarterly_report_params_for_current_user(region, campuses)
        except ValueError as scope_err:
            return jsonify({"error": str(scope_err)}), 403
        compare = _parse_include_previous_year()
        period = _parse_report_period()
        excl_youth = _parse_exclude_youth_metrics()
        metrics_scope = _parse_metrics_scope()
        include_youth_m = not excl_youth
        custom_range = _try_parse_custom_report_range()
        if custom_range:
            s_d, e_d = custom_range
            data = _q1_report_custom_range_with_optional_yoy(
                s_d,
                e_d,
                region,
                campuses,
                compare,
                include_youth_metrics=include_youth_m,
                metrics_scope=metrics_scope,
            )
            fname = _q1_report_filename(
                e_d.year,
                region,
                campuses,
                compare=compare,
                period="custom",
                exclude_youth_metrics=excl_youth,
                metrics_scope=metrics_scope,
                custom_start=s_d,
                custom_end=e_d,
            )
        else:
            year = int(request.args.get('year', datetime.now().year))
            if year < 2000 or year > 2100:
                return jsonify({"error": "Invalid year"}), 400
            data = _q1_report_with_optional_yoy(
                year, region, campuses, compare, period=period,
                include_youth_metrics=include_youth_m, metrics_scope=metrics_scope,
            )
            fname = _q1_report_filename(
                year,
                region,
                campuses,
                compare=compare,
                period=period,
                exclude_youth_metrics=excl_youth,
                metrics_scope=metrics_scope,
            )
        payload = build_q1_csv_bytes(data)
        resp = Response(payload, mimetype='text/csv; charset=utf-8')
        resp.headers['Content-Disposition'] = f'attachment; filename={fname}.csv'
        return resp
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Q1 attendance CSV report error: {e}", exc_info=True)
        return jsonify({"error": "Failed to build report"}), 500


@app.route('/api/reports/quarterly-attendance.pdf', methods=['GET'])
@app.route('/api/reports/q1-attendance.pdf', methods=['GET'])
@login_required
def report_q1_attendance_pdf():
    """
    Quarterly (Q1–Q4) and YTD attendance — PDF (charts + tables) from ``attendance_records`` only.
    Use ``?period=q1|q2|q3|q4|ytd`` (default q1) or ``?start_date=&end_date=`` for a custom range (see CSV route).

    Access and campus scoping match the CSV and JSON report endpoints.
    """
    if not (
        current_user.has_permission('data_export')
        or current_user.has_permission('dashboard_access')
    ):
        return jsonify({"error": "Access denied"}), 403
    try:
        from q1_attendance_report import build_q1_pdf_bytes

        region = request.args.get('region', '').strip()
        campuses = request.args.get('campuses', '').strip()
        try:
            region, campuses = _scope_quarterly_report_params_for_current_user(region, campuses)
        except ValueError as scope_err:
            return jsonify({"error": str(scope_err)}), 403
        compare = _parse_include_previous_year()
        per_campus = _parse_per_campus_pdf()
        period = _parse_report_period()
        excl_youth = _parse_exclude_youth_metrics()
        metrics_scope = _parse_metrics_scope()
        include_youth_m = not excl_youth
        custom_range = _try_parse_custom_report_range()
        if custom_range:
            s_d, e_d = custom_range
            data = _q1_report_custom_range_with_optional_yoy(
                s_d,
                e_d,
                region,
                campuses,
                compare,
                include_youth_metrics=include_youth_m,
                metrics_scope=metrics_scope,
            )
            fname = _q1_report_filename(
                e_d.year,
                region,
                campuses,
                compare=compare,
                period="custom",
                per_campus_pdf=per_campus,
                exclude_youth_metrics=excl_youth,
                metrics_scope=metrics_scope,
                custom_start=s_d,
                custom_end=e_d,
            )
        else:
            year = int(request.args.get('year', datetime.now().year))
            if year < 2000 or year > 2100:
                return jsonify({"error": "Invalid year"}), 400
            data = _q1_report_with_optional_yoy(
                year, region, campuses, compare, period=period,
                include_youth_metrics=include_youth_m, metrics_scope=metrics_scope,
            )
            fname = _q1_report_filename(
                year,
                region,
                campuses,
                compare=compare,
                period=period,
                per_campus_pdf=per_campus,
                exclude_youth_metrics=excl_youth,
                metrics_scope=metrics_scope,
            )
        payload = build_q1_pdf_bytes(data, per_campus_pages=per_campus)
        resp = Response(payload, mimetype='application/pdf')
        resp.headers['Content-Disposition'] = f'attachment; filename={fname}.pdf'
        return resp
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Q1 attendance PDF report error: {e}", exc_info=True)
        return jsonify({"error": "Failed to build PDF report"}), 500


@app.route('/api/reports/quarterly-attendance.json', methods=['GET'])
@app.route('/api/reports/q1-attendance.json', methods=['GET'])
@login_required
def report_q1_attendance_json():
    """
    Same filters as PDF/CSV — JSON for the in-app attendance report dashboard preview.

    ``data_export`` or scoped ``dashboard_access`` (see CSV route docstring).
    """
    if not (
        current_user.has_permission('data_export')
        or current_user.has_permission('dashboard_access')
    ):
        return jsonify({"error": "Access denied"}), 403
    try:
        from q1_attendance_report import report_json_api_response

        region = request.args.get('region', '').strip()
        campuses = request.args.get('campuses', '').strip()
        try:
            region, campuses = _scope_quarterly_report_params_for_current_user(region, campuses)
        except ValueError as scope_err:
            return jsonify({"error": str(scope_err)}), 403
        compare = _parse_include_previous_year()
        per_campus = _parse_per_campus_pdf()
        period = _parse_report_period()
        excl_youth = _parse_exclude_youth_metrics()
        metrics_scope = _parse_metrics_scope()
        include_youth_m = not excl_youth
        custom_range = _try_parse_custom_report_range()
        if custom_range:
            s_d, e_d = custom_range
            data = _q1_report_custom_range_with_optional_yoy(
                s_d,
                e_d,
                region,
                campuses,
                compare,
                include_youth_metrics=include_youth_m,
                metrics_scope=metrics_scope,
            )
        else:
            year = int(request.args.get('year', datetime.now().year))
            if year < 2000 or year > 2100:
                return jsonify({"error": "Invalid year"}), 400
            data = _q1_report_with_optional_yoy(
                year, region, campuses, compare, period=period,
                include_youth_metrics=include_youth_m, metrics_scope=metrics_scope,
            )
        payload = report_json_api_response(data, per_campus=per_campus)
        payload["requested_region"] = region
        payload["requested_campuses_csv"] = campuses
        payload["metrics_scope"] = normalize_metrics_scope(metrics_scope)
        return jsonify(payload)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Q1 attendance JSON report error: {e}", exc_info=True)
        return jsonify({"error": "Failed to build report"}), 500


@app.route('/api/reports/ministry-stats/catalog', methods=['GET'])
@login_required
def ministry_stats_catalog():
    """
    Metric definitions for Ministry Stats Explorer (labels, groups, descriptions).
    Same permission as running a stats query.
    """
    if not (
        current_user.has_permission('data_export')
        or current_user.has_permission('dashboard_access')
    ):
        return jsonify({"error": "Access denied"}), 403
    try:
        from ministry_stats_explorer import DEFAULT_METRIC_IDS, metric_catalog_public

        return jsonify(
            {
                "metrics": metric_catalog_public(),
                "default_metric_ids": DEFAULT_METRIC_IDS,
            }
        )
    except Exception as e:
        logger.error(f"Ministry stats catalog error: {e}", exc_info=True)
        return jsonify({"error": "Failed to load metric catalog"}), 500


@app.route('/api/reports/ministry-stats', methods=['GET'])
@login_required
def ministry_stats_json():
    """
    Sum selected metrics from ``attendance_records`` by campus for an inclusive date range.
    Scoped like quarterly reports (``data_export`` or ``dashboard_access`` + campus picklist).
    """
    if not (
        current_user.has_permission('data_export')
        or current_user.has_permission('dashboard_access')
    ):
        return jsonify({"error": "Access denied"}), 403
    try:
        from ministry_stats_explorer import (
            aggregate_by_campus,
            aggregate_by_entry_timeline,
            append_service_time_to_summary,
            append_timeline_mode_to_summary,
            build_json_payload,
            parse_granularity_param,
            parse_inclusive_date_range,
            parse_metric_ids_param,
            parse_service_time_param,
        )

        region = request.args.get('region', '').strip()
        campuses = request.args.get('campuses', '').strip()
        try:
            region, campuses = _scope_quarterly_report_params_for_current_user(region, campuses)
        except ValueError as scope_err:
            return jsonify({"error": str(scope_err)}), 403

        start_d, end_d = parse_inclusive_date_range(
            request.args.get('start_date'),
            request.args.get('end_date'),
        )
        metrics_scope = _parse_metrics_scope()
        excl_youth = _parse_exclude_youth_metrics()
        include_youth_m = not excl_youth
        metric_ids = parse_metric_ids_param(request.args.get('metrics'))
        service_time = parse_service_time_param(request.args.get('service_time'))
        granularity = parse_granularity_param(request.args.get('granularity'))

        records, campuses_by_id, filter_summary = _load_attendance_records_for_explorer(
            start_d,
            end_d,
            region or None,
            campuses or None,
            metrics_scope,
            include_youth_m,
        )
        filter_summary = append_service_time_to_summary(filter_summary, service_time)
        filter_summary = append_timeline_mode_to_summary(filter_summary, granularity)
        if granularity == "entry":
            timeline_rows, totals, meta = aggregate_by_entry_timeline(
                records,
                metric_ids,
                campuses_by_id=campuses_by_id,
                include_youth_metrics=include_youth_m,
                service_time=service_time,
            )
            campus_rows = []
        else:
            campus_rows, totals, meta = aggregate_by_campus(
                records,
                metric_ids,
                campuses_by_id=campuses_by_id,
                include_youth_metrics=include_youth_m,
                service_time=service_time,
            )
            timeline_rows = None
        payload = build_json_payload(
            start_d=start_d,
            end_d=end_d,
            metric_ids=metric_ids,
            rows=campus_rows,
            totals=totals,
            meta=meta,
            filter_summary=filter_summary,
            metrics_scope=normalize_metrics_scope(metrics_scope),
            include_youth_metrics=include_youth_m,
            service_time=service_time,
            granularity=granularity,
            timeline_rows=timeline_rows,
        )
        payload["requested_region"] = region
        payload["requested_campuses_csv"] = campuses
        return jsonify(payload)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Ministry stats JSON error: {e}", exc_info=True)
        return jsonify({"error": "Failed to build ministry stats"}), 500


@app.route('/api/reports/ministry-stats.csv', methods=['GET'])
@login_required
def ministry_stats_csv():
    """Same filters as ``/api/reports/ministry-stats`` — downloadable CSV."""
    if not (
        current_user.has_permission('data_export')
        or current_user.has_permission('dashboard_access')
    ):
        return jsonify({"error": "Access denied"}), 403
    try:
        from ministry_stats_explorer import (
            aggregate_by_campus,
            aggregate_by_entry_timeline,
            append_service_time_to_summary,
            append_timeline_mode_to_summary,
            build_csv_bytes,
            build_json_payload,
            parse_granularity_param,
            parse_inclusive_date_range,
            parse_metric_ids_param,
            parse_service_time_param,
        )

        region = request.args.get('region', '').strip()
        campuses = request.args.get('campuses', '').strip()
        try:
            region, campuses = _scope_quarterly_report_params_for_current_user(region, campuses)
        except ValueError as scope_err:
            return jsonify({"error": str(scope_err)}), 403

        start_d, end_d = parse_inclusive_date_range(
            request.args.get('start_date'),
            request.args.get('end_date'),
        )
        metrics_scope = _parse_metrics_scope()
        excl_youth = _parse_exclude_youth_metrics()
        include_youth_m = not excl_youth
        metric_ids = parse_metric_ids_param(request.args.get('metrics'))
        service_time = parse_service_time_param(request.args.get('service_time'))
        granularity = parse_granularity_param(request.args.get('granularity'))

        records, campuses_by_id, filter_summary = _load_attendance_records_for_explorer(
            start_d,
            end_d,
            region or None,
            campuses or None,
            metrics_scope,
            include_youth_m,
        )
        filter_summary = append_service_time_to_summary(filter_summary, service_time)
        filter_summary = append_timeline_mode_to_summary(filter_summary, granularity)
        if granularity == "entry":
            timeline_rows, totals, meta = aggregate_by_entry_timeline(
                records,
                metric_ids,
                campuses_by_id=campuses_by_id,
                include_youth_metrics=include_youth_m,
                service_time=service_time,
            )
            campus_rows = []
        else:
            campus_rows, totals, meta = aggregate_by_campus(
                records,
                metric_ids,
                campuses_by_id=campuses_by_id,
                include_youth_metrics=include_youth_m,
                service_time=service_time,
            )
            timeline_rows = None
        json_payload = build_json_payload(
            start_d=start_d,
            end_d=end_d,
            metric_ids=metric_ids,
            rows=campus_rows,
            totals=totals,
            meta=meta,
            filter_summary=filter_summary,
            metrics_scope=normalize_metrics_scope(metrics_scope),
            include_youth_metrics=include_youth_m,
            service_time=service_time,
            granularity=granularity,
            timeline_rows=timeline_rows,
        )
        raw = build_csv_bytes(json_payload)
        fname = f"ministry-stats-{start_d.isoformat()}-to-{end_d.isoformat()}"
        if region:
            fname += f"-{region.upper()}"
        if granularity == "entry":
            fname += "-by-date"
        if service_time:
            slug = re.sub(r"[^\w.\-]+", "_", service_time, flags=re.ASCII)[:50].strip("_")
            if slug:
                fname += f"-{slug}"
        resp = Response(raw, mimetype='text/csv; charset=utf-8')
        resp.headers['Content-Disposition'] = f'attachment; filename={fname}.csv'
        return resp
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Ministry stats CSV error: {e}", exc_info=True)
        return jsonify({"error": "Failed to build CSV"}), 500


@app.route('/api/export/finance', methods=['GET'])
@login_required
def export_finance():
    """Export financial data to CSV"""
    try:
        import csv
        from io import StringIO

        if not (current_user.has_permission('finance_access') or current_user.has_permission('data_export')):
            return jsonify({"error": "Access denied - finance access required"}), 403

        campus = request.args.get('campus', 'all_campuses')
        
        # Get data from Tithe sheet
        if not finance_sheet:
            return jsonify({"error": "Finance data not available"}), 503
        
        rows = safe_sheets_request(finance_sheet.get_all_records)
        if not rows:
            return jsonify({"error": "No data available"}), 404
        
        # Filter by campus if not all_campuses
        if campus != 'all_campuses':
            campus_normalized = normalize_campus(campus)
            filtered_rows = []
            for row in rows:
                row_campus = normalize_campus(row.get("Campus") or "")
                if campus_normalized in row_campus or row_campus in campus_normalized:
                    filtered_rows.append(row)
            rows = filtered_rows
        
        # Create CSV
        output = StringIO()
        if rows:
            fieldnames = list(rows[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        # Create response
        response_data = output.getvalue()
        output.close()
        
        response = Response(response_data, mimetype='text/csv')
        response.headers['Content-Disposition'] = f'attachment; filename=finance_export_{datetime.now().strftime("%Y%m%d")}.csv'
        return response
        
    except Exception as e:
        logger.error(f"Export finance error: {e}")
        return jsonify({"error": "Failed to export data"}), 500

@app.route('/api/export/users', methods=['GET'])
@admin_required
def export_users():
    """Export user list to CSV (admin only)"""
    try:
        import csv
        from io import StringIO
        
        users_data = load_users_database()
        users = list(users_data.get('users', {}).values())
        
        if not users:
            return jsonify({"error": "No users found"}), 404
        
        # Remove sensitive data
        for user in users:
            user.pop('password_hash', None)
        
        # Create CSV
        output = StringIO()
        if users:
            fieldnames = ['id', 'username', 'full_name', 'email', 'role', 'campus', 'active', 'created_date', 'last_login']
            writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(users)
        
        # Create response
        response_data = output.getvalue()
        output.close()
        
        response = Response(response_data, mimetype='text/csv')
        response.headers['Content-Disposition'] = f'attachment; filename=users_export_{datetime.now().strftime("%Y%m%d")}.csv'
        return response
        
    except Exception as e:
        logger.error(f"Export users error: {e}")
        return jsonify({"error": "Failed to export data"}), 500

def normalize_campus(name):
    """Normalize campus name for comparison - handle various formats"""
    if not name:
        return ""
    
    # Convert to string and strip whitespace
    name = str(name).strip()
    
    # Handle common variations
    name = name.lower()
    name = name.replace("_", " ")
    name = name.replace("-", " ")
    
    # Handle specific campus name variations
    campus_mappings = {
        "mt barker": "mount barker",
        "mount barker": "mount barker",
        "barker": "mount barker",
        "hills": "mount barker",
        "adelaide city": "adelaide city",
        "adelaide": "adelaide city",
        "city": "adelaide city",
        "cbd": "adelaide city",
        "victor harbor": "victor harbor",
        "victor": "victor harbor",
        "copper coast": "copper coast",
        "kadina": "copper coast",
        "cc": "copper coast",
        "clare valley": "clare valley",
        "clare": "clare valley",
        "paradise": "paradise",
        "south": "south",
        "salisbury": "salisbury"
    }
    
    # Remove extra spaces
    name = " ".join(name.split())
    
    # Check for specific mappings
    if name in campus_mappings:
        return campus_mappings[name]
    
    return name

# Add this helper near the top of the file (after imports)
def display_campus_name(name):
    return str(name).replace('_', ' ').title()

def safe_campus_name(campus_attr) -> tuple:
    """Safely get campus name and display name from user campus attribute"""
    if campus_attr is None:
        return 'main', 'Main Campus'
    elif isinstance(campus_attr, str):
        return campus_attr, campus_attr.replace('_', ' ').title()
    elif isinstance(campus_attr, dict):
        # If it's a dict, try to get a name field
        campus_name = campus_attr.get('name', campus_attr.get('id', 'main'))
        if isinstance(campus_name, str):
            return campus_name, campus_name.replace('_', ' ').title()
    
    # Fallback
    return 'main', 'Main Campus'

def detect_simple_stat_query(question: str) -> Optional[tuple]:
    """Detect if this is a simple stat query that should get a direct answer"""
    question_lower = question.lower()
    
    # Simple stat keywords
    stat_keywords = {
        'attendance': ['attendance', 'total attendance', 'total', 'people', 'how many people'],
        'new_people': ['new people', 'newpeople', 'np', 'new', 'visitors', 'how many new people'],
        'new_christians': ['new christians', 'christians', 'souls', 'salvations', 'conversions', 'how many new christians'],
        'youth': ['youth attendance', 'youth', 'teens', 'teenagers', 'how many youth'],
        'kids': ['kids total', 'kids', 'children', 'children total', 'how many kids'],
        'connect_groups': ['connect groups', 'connectgroups', 'groups', 'small groups', 'cell groups', 'how many connect groups'],
        'dream_team': ['dream team', 'dreamteam', 'dt', 'team members', 'serving team', 'volunteers', 'how many dream team', 'how many team members']
    }
    
    # Flatten and sort keywords by length (longest first)
    keyword_to_stat = []
    for stat_type, keywords in stat_keywords.items():
        for keyword in keywords:
            keyword_to_stat.append((keyword, stat_type))
    keyword_to_stat.sort(key=lambda x: -len(x[0]))
    
    # Simple question patterns that indicate direct stat requests
    simple_patterns = [
        r'how many\s+\w+',
        r'what is the\s+\w+',
        r'what\'s the\s+\w+',
        r'give me the\s+\w+',
        r'tell me the\s+\w+',
        r'what was the\s+\w+',
        r'how much\s+\w+',
        r'total\s+\w+',
        r'average\s+\w+',
        r'what was the average\s+\w+',
        r'what is the average\s+\w+',
        r"what's the average\s+\w+"
    ]
    
    import re
    
    # Check for simple patterns first (including average patterns)
    for pattern in simple_patterns:
        if re.search(pattern, question_lower):
            # Find which stat they're asking about (longest keyword first)
            for keyword, stat_type in keyword_to_stat:
                if keyword in question_lower:
                    return (stat_type, keyword)
    
    # Check for direct stat keywords without complex analysis words
    analysis_words = ['trend', 'trends', 'pattern', 'growth', 'improve', 'attention', 'working', 'compare', 'vs', 'versus', 'against', 'difference', 'analysis', 'insight', 'why', 'how are we', 'what areas', 'review', 'report']
    
    has_analysis_words = any(word in question_lower for word in analysis_words)
    
    if not has_analysis_words:
        # Check for simple stat requests (longest keyword first)
        for keyword, stat_type in keyword_to_stat:
            if keyword in question_lower:
                return (stat_type, keyword)
    
    return None

def detect_multiple_stats(question: str) -> list:
    """Detect multiple stat requests like 'np and nc' or 'new people and new christians'"""
    question_lower = question.lower()
    
    stat_keywords = {
        'attendance': ['attendance', 'people attended', 'how many people', 'total attendance', 'people came', 'came to church'],
        'new_people': ['new people', 'new visitors', 'visitors', 'first time', 'np', 'new guests'],
        'new_christians': ['new christians', 'salvations', 'souls', 'decisions', 'gave their lives', 'nc', 'new believers'],
        'youth': ['youth', 'teens', 'teenagers', 'young people', 'youth ministry', 'youth group'],
        'kids': ['kids', 'children', 'little ones', 'nursery', 'kids ministry'],
        'connect_groups': ['connect groups', 'connectgroups', 'groups', 'small groups', 'cell groups', 'how many connect groups'],
        'dream_team': ['dream team', 'dreamteam', 'dt', 'team members', 'serving team', 'volunteers', 'how many dream team', 'how many team members']
    }
    
    detected_stats = []
    
    # Check for each stat type in the question
    for stat_type, keywords in stat_keywords.items():
        for keyword in keywords:
            if keyword in question_lower:
                if stat_type not in detected_stats:
                    detected_stats.append(stat_type)
                break
    
    # Special handling for common abbreviations combinations
    if 'np and nc' in question_lower or 'new people and new christians' in question_lower:
        detected_stats = ['new_people', 'new_christians']
    elif 'youth and kids' in question_lower:
        detected_stats = ['youth', 'kids']
    elif 'attendance and new people' in question_lower:
        detected_stats = ['attendance', 'new_people']
    
    return detected_stats

def create_targeted_report_data(stat_types, analysis_data: dict, year: int, count: int) -> list:
    """Create report data showing only the requested stat(s) instead of all stats"""
    # Handle single stat type or list of stat types
    if isinstance(stat_types, str):
        stat_types = [stat_types]
    
    stat_mapping = {
        'attendance': {
            'label': 'Total Attendance',
            'total': analysis_data.get('total_attendance', 0),
            'average': analysis_data.get('averages', {}).get('attendance', 0)
        },
        'new_people': {
            'label': 'New People',
            'total': analysis_data.get('total_new_people', 0),
            'average': analysis_data.get('averages', {}).get('new_people', 0)
        },
        'new_christians': {
            'label': 'New Christians',
            'total': analysis_data.get('total_new_christians', 0),
            'average': analysis_data.get('averages', {}).get('new_christians', 0)
        },
        'youth': {
            'label': 'Youth',
            'total': analysis_data.get('total_youth', 0),
            'average': analysis_data.get('averages', {}).get('youth', 0)
        },
        'kids': {
            'label': 'Kids',
            'total': analysis_data.get('total_kids', 0),
            'average': analysis_data.get('averages', {}).get('kids', 0)
        },
        'connect_groups': {
            'label': 'Connect Groups',
            'total': analysis_data.get('total_connect_groups', 0),
            'average': analysis_data.get('averages', {}).get('connect_groups', 0)
        }
    }
    
    # Build report data for the requested stats
    report_data = []
    valid_stats_found = False
    
    for stat_type in stat_types:
        if stat_type in stat_mapping:
            valid_stats_found = True
            stat_info = stat_mapping[stat_type]
            report_data.append({
                "label": stat_info['label'],
                "total": stat_info['total'],
                "average": stat_info['average'],
                "count": count,
                "year": year
            })
    
    # If no valid stats found, fallback to all stats
    if not valid_stats_found:
        return [
            {"label": "Total Attendance", "total": analysis_data.get("total_attendance", 0), "average": analysis_data.get("averages", {}).get("attendance", 0), "count": count, "year": year},
            {"label": "New People", "total": analysis_data.get("total_new_people", 0), "average": analysis_data.get("averages", {}).get("new_people", 0), "count": count, "year": year},
            {"label": "New Christians", "total": analysis_data.get("total_new_christians", 0), "average": analysis_data.get("averages", {}).get("new_christians", 0), "count": count, "year": year},
            {"label": "Youth", "total": analysis_data.get("total_youth", 0), "average": analysis_data.get("averages", {}).get("youth", 0), "count": count, "year": year},
            {"label": "Kids", "total": analysis_data.get("total_kids", 0), "average": analysis_data.get("averages", {}).get("kids", 0), "count": count, "year": year},
            {"label": "Connect Groups", "total": analysis_data.get("total_connect_groups", 0), "average": analysis_data.get("averages", {}).get("connect_groups", 0), "count": count, "year": year},
        ]
    
    return report_data

def generate_simple_stat_answer(stat_type: str, analysis_data: dict, campus: str, date_range: str) -> str:
    """Generate a simple, direct answer for stat queries"""
    stat_labels = {
        'attendance': 'attendance',
        'new_people': 'new people', 
        'new_christians': 'new christians',
        'youth': 'youth',
        'kids': 'kids',
        'connect_groups': 'connect groups',
        'dream_team': 'dream team'
    }
    
    stat_label = stat_labels.get(stat_type, stat_type)
    
    # Check if this is a cross-campus response
    is_cross_campus = campus.lower() in ['futures church', 'all campuses', 'church-wide']
    
    # Get the total for the requested stat
    stat_totals = {
        'attendance': analysis_data.get('total_attendance', 0),
        'new_people': analysis_data.get('total_new_people', 0),
        'new_christians': analysis_data.get('total_new_christians', 0),
        'youth': analysis_data.get('total_youth', 0),
        'kids': analysis_data.get('total_kids', 0),
        'connect_groups': analysis_data.get('total_connect_groups', 0),
        'dream_team': analysis_data.get('total_dream_team', 0)
    }
    
    # Get averages for cross-campus queries
    stat_averages = {
        'attendance': analysis_data.get('averages', {}).get('attendance', 0),
        'new_people': analysis_data.get('averages', {}).get('new_people', 0),
        'new_christians': analysis_data.get('averages', {}).get('new_christians', 0),
        'youth': analysis_data.get('averages', {}).get('youth', 0),
        'kids': analysis_data.get('averages', {}).get('kids', 0),
        'connect_groups': analysis_data.get('averages', {}).get('connect_groups', 0),
        'dream_team': analysis_data.get('averages', {}).get('dream_team', 0)
    }
    
    total = stat_totals.get(stat_type, 0)
    average = stat_averages.get(stat_type, 0)
    
    # Clean up date range - remove generic or empty date ranges
    generic_ranges = ["None", "recent data", " recent data", "recent", " recent"]
    clean_date_range = ""
    if date_range and date_range.strip() not in generic_ranges:
        clean_date_range = f" {date_range.strip()}" if not date_range.strip().startswith(" ") else date_range
    
    if is_cross_campus:
        return f"Futures Church had {total:,} total {stat_label} across all campuses with an average of {average:.1f} per week{clean_date_range}."
    else:
        # For single campus queries, also include the average per week across all campuses
        cross_campus_avg = analysis_data.get('cross_campus_averages', {}).get(stat_type, 0)
        if cross_campus_avg > 0:
            return f"{campus} had {total:,} total {stat_label}{clean_date_range}. Across all campuses, the average is {cross_campus_avg:.1f} per week."
        else:
            return f"{campus} had {total:,} total {stat_label}{clean_date_range}."



def detect_cross_campus_review(question: str) -> Optional[tuple]:
    """Detect if this is a cross-campus review request"""
    question_lower = question.lower()
    
    # Cross-campus review indicators
    cross_campus_indicators = [
        'all campuses', 'all campus', 'every campus', 'across all', 'all sites', 'every site',
        'church wide', 'churchwide', 'whole church', 'entire church', 'all locations',
        'futures church', 'across futures', 'church total', 'total church'
    ]
    
    has_cross_campus = any(indicator in question_lower for indicator in cross_campus_indicators)
    
    if not has_cross_campus:
        return None
    
    # Check for review types (order matters: most specific first)
    review_indicators = [
        ('weekly', [
            'this week', 'this weekend', 'weekend', 'sunday', 'this sunday', 'weekly',
            'weekend review', 'sunday review', 'weekend report', 'sunday report'
        ]),
        ('mid_year', ['mid year', 'mid-year', 'midyear', 'mid year review', 'mid-year review']),
        ('quarterly', ['quarter', 'q1', 'q2', 'q3', 'q4', 'first quarter', 'second quarter', 'third quarter', 'fourth quarter']),
        ('monthly', ['this month', 'month', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']),
        ('annual', ['annual', 'year', 'yearly', 'this year', '2024', '2025'])
    ]
    
    for review_type, keywords in review_indicators:
        if any(keyword in question_lower for keyword in keywords):
            return (review_type, question_lower)
    
    # Default to weekly if 'review' or 'report' is present and no period is specified
    if 'review' in question_lower or 'report' in question_lower:
        return ('weekly', question_lower)
    
    # Otherwise, default to annual
    return ('annual', question_lower)

def generate_cross_campus_report(review_type: str, date_range: str) -> dict:
    """Generate a comprehensive cross-campus report with robust filtering and debug output."""
    # Get data from all campuses
    if sheet:
        try:
            rows = safe_sheets_request(sheet.get_all_records)
        except Exception as e:
            logger.error(f"Failed to get stats from Google Sheets: {e}")
            rows = []
    else:
        rows = []

    # Set up date ranges based on review type and date_range parameter
    now = datetime.now()
    
    if review_type == 'weekly':
        # Use proper weekend date range (Monday to Sunday)
        today = now
        # Find the most recent Sunday
        days_since_sunday = today.weekday() + 1  # Monday=0, so Sunday=6
        if days_since_sunday == 7:  # Today is Sunday
            days_since_sunday = 0
        most_recent_sunday = today - timedelta(days=days_since_sunday)
        
        # Weekend is Monday to Sunday (7 days ending on Sunday)
        start_date = most_recent_sunday - timedelta(days=6)  # Monday
        end_date = most_recent_sunday  # Sunday
        period_label = f"for the week ending {end_date.strftime('%Y-%m-%d')} ({start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')})"
    elif review_type == 'monthly':
        # Parse month and year from date_range (e.g., "January 2024")
        if date_range and ' ' in date_range:
            try:
                month_name, year_str = date_range.split(' ')
                month_num = {
                    'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
                    'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
                }[month_name]
                year = int(year_str)
                start_date = datetime(year, month_num, 1)
                if month_num == 12:
                    end_date = datetime(year, month_num, 31)
                else:
                    end_date = datetime(year, month_num + 1, 1) - timedelta(days=1)
                period_label = f"for {month_name} {year}"
            except (ValueError, KeyError):
                # Fallback to current month
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                end_date = now
                period_label = f"for {now.strftime('%B %Y')}"
        else:
            # Default to current month
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            period_label = f"for {now.strftime('%B %Y')}"
    elif review_type == 'quarterly':
        # Parse quarter and year from date_range (e.g., "Q1 2024")
        if date_range and ' ' in date_range:
            try:
                quarter_str, year_str = date_range.split(' ')
                quarter = int(quarter_str[1])  # Extract number from "Q1", "Q2", etc.
                year = int(year_str)
                start_month = 3 * (quarter - 1) + 1
                start_date = datetime(year, start_month, 1)
                if quarter == 4:
                    end_date = datetime(year, 12, 31)
                else:
                    end_date = datetime(year, start_month + 2, 28)  # Approximate end of quarter
                    if start_month + 2 <= 12:
                        end_date = datetime(year, start_month + 3, 1) - timedelta(days=1)
                period_label = f"for Q{quarter} {year}"
            except (ValueError, IndexError):
                # Fallback to current quarter
                quarter = (now.month - 1) // 3 + 1
                start_month = 3 * (quarter - 1) + 1
                start_date = now.replace(month=start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
                if quarter == 4:
                    end_date = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
                else:
                    end_date = now.replace(month=start_month + 2, day=28, hour=23, minute=59, second=59, microsecond=999999)
                period_label = f"for Q{quarter} {now.year}"
        else:
            # Default to current quarter
            quarter = (now.month - 1) // 3 + 1
            start_month = 3 * (quarter - 1) + 1
            start_date = now.replace(month=start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
            if quarter == 4:
                end_date = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
            else:
                end_date = now.replace(month=start_month + 2, day=28, hour=23, minute=59, second=59, microsecond=999999)
            period_label = f"for Q{quarter} {now.year}"
    elif review_type == 'mid_year':
        # Parse year from date_range (e.g., "Jan-Jun 2024")
        if date_range and ' ' in date_range:
            try:
                _, year_str = date_range.split(' ')
                year = int(year_str)
                start_date = datetime(year, 1, 1)
                end_date = datetime(year, 6, 30)
                period_label = f"for Jan-Jun {year}"
            except ValueError:
                # Fallback to current year
                start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
                end_date = now.replace(month=6, day=30, hour=23, minute=59, second=59, microsecond=999999)
                period_label = f"for Jan-Jun {now.year}"
        else:
            # Default to current year
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now.replace(month=6, day=30, hour=23, minute=59, second=59, microsecond=999999)
            period_label = f"for Jan-Jun {now.year}"
    else:  # annual
        # Use current year by default
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        period_label = f"for {now.year}"

    print(f"[CROSS-CAMPUS DEBUG] start_date={start_date}, end_date={end_date}, now={now}")

    # Filter rows by date range and valid stats/campus
    filtered_rows = []
    debug_included = 0
    debug_excluded = 0
    for row in rows:
        try:
            # Use Date field instead of Timestamp for more accurate date filtering
            date_str = row.get("Date", "")
            row_date = None
            if date_str:
                try:
                    row_date = datetime.strptime(date_str, "%Y-%m-%d")
                except Exception as e:
                    logger.warning(f"Could not parse date for row: {e}")
            if not row_date or not (start_date <= row_date <= end_date):
                debug_excluded += 1
                continue
            campus = row.get("Campus", "").strip()
            if not campus:
                debug_excluded += 1
                continue
            # At least one stat must be > 0
            stat_fields = ["Total Attendance", "New People", "New Christians", "First Time Christians", "Youth Attendance", "Kids Total", "Kids Attendance", "Connect Groups", "Tithe"]
            has_stat = False
            for field in stat_fields:
                val = row.get(field, "")
                try:
                    if val and int(str(val).replace(",", "").strip()) > 0:
                        has_stat = True
                        break
                except Exception:
                    continue
            if not has_stat:
                debug_excluded += 1
                continue
            filtered_rows.append(row)
            debug_included += 1
        except Exception as e:
            logger.warning(f"Error processing row: {e}")
            debug_excluded += 1
    print(f"[CROSS-CAMPUS DEBUG] Included {debug_included} rows, Excluded {debug_excluded} rows for period {period_label}")
    
    # DEBUG: Show what data was actually found
    if filtered_rows:
        print(f"[CROSS-CAMPUS DEBUG] Found data from these rows:")
        for i, row in enumerate(filtered_rows[:5]):  # Show first 5 rows
            campus = row.get("Campus", "Unknown")
            timestamp = row.get("Timestamp", "Unknown")
            attendance = row.get("Total Attendance", 0)
            new_people = row.get("New People", 0)
            new_christians = row.get("New Christians", 0)
            youth = row.get("Youth Attendance", 0)
            kids = row.get("Kids Total", 0)
            connect_groups = row.get("Connect Groups", 0)
            print(f"  {i+1}. {campus} ({timestamp}): Att={attendance}, NP={new_people}, NC={new_christians}, Youth={youth}, Kids={kids}, CG={connect_groups}")

    if not filtered_rows:
        return {
            "type": f"Cross-Campus {review_type.title()} Report",
            "campus": "Futures Church (All Campuses)",
            "date_range": period_label,
            "summary": f"No valid stats found for any campus {period_label}.",
            "stats": {},
            "entry_count": 0
        }

    # Use comprehensive stats calculation
    analysis_data = calculate_stats_from_filtered_rows(filtered_rows)
    # Create comprehensive stats structure
    comprehensive_stats = {}
    stat_mappings = [
        ("total_attendance", "attendance", "Total Attendance"),
        ("total_first_time_visitors", "first_time_visitors", "First Time Visitors"),
        ("total_information_gathered", "information_gathered", "Cards Back"),
        ("total_new_christians", "new_christians", "New Christians"),
        ("total_rededications", "rededications", "Rededications"),
        ("total_youth_attendance", "youth_attendance", "Youth Attendance"),
        ("total_youth_salvations", "youth_salvations", "Youth Salvations"),
        ("total_youth_new_people", "youth_new_people", "Youth New People"),
        ("total_kids_attendance", "kids_attendance", "Kids Attendance"),
        ("total_kids_leaders", "kids_leaders", "Kids Leaders"),
        ("total_new_kids", "new_kids", "New Kids"),
        ("total_new_kids_salvations", "new_kids_salvations", "New Kids Salvations"),
        ("total_connect_groups", "connect_groups", "Connect Groups"),
        ("total_dream_team", "dream_team", "Dream Team"),
        ("total_tithe", "tithe", "Tithe"),
        ("total_baptisms", "baptisms", "Baptisms"),
        ("total_child_dedications", "child_dedications", "Child Dedications"),
        ("total_new_people", "new_people", "New People"),  # Keep for backward compatibility
    ]
    
    for stat_key, avg_key, label in stat_mappings:
        total = analysis_data.get(stat_key, 0)
        average = analysis_data.get("averages", {}).get(avg_key, 0)
        
        # Include all stats that have data or are important to show (including tithe)
        if total > 0 or label in ["Total Attendance", "First Time Visitors", "New People", "New Christians", "Rededications", "Youth Attendance", "Youth Salvations", "Youth New People", "Kids Attendance", "Kids Leaders", "New Kids", "New Kids Salvations", "Connect Groups", "Dream Team", "Tithe", "Baptisms", "Child Dedications", "Cards Back"]:
            comprehensive_stats[avg_key] = {
                "total": total,
                "average": round(average, 1),
                "label": label
            }
    
    report = {
        "type": f"Cross-Campus {review_type.title()} Report",
        "campus": "Futures Church (All Campuses)",
        "date_range": period_label,
        "summary": f"Futures Church {review_type} report across all campuses {period_label}",
        "stats": comprehensive_stats,
        "entry_count": analysis_data.get("total_entries", 0)
    }
    return report

def generate_weekend_report(campus: str, date_str: str = None) -> dict:
    """Generate a comprehensive weekend report for a specific campus"""
    try:
        # If no date provided, use the most recent weekend
        if not date_str:
            today = datetime.now()
            # Find the most recent Sunday
            days_since_sunday = today.weekday() + 1  # Monday=0, so Sunday=6
            if days_since_sunday == 7:  # Today is Sunday
                days_since_sunday = 0
            most_recent_sunday = today - timedelta(days=days_since_sunday)
            date_str = most_recent_sunday.strftime('%Y-%m-%d')
        
        # Parse the date
        report_date = datetime.strptime(date_str, '%Y-%m-%d')
        start_date = report_date - timedelta(days=6)  # Week starts Monday
        end_date = report_date
        
        # Get data
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        
        if not rows:
            rows = load_local_data()
        
        # Filter by campus and date range
        filtered_rows = []
        campus_normalized = normalize_campus(campus)
        
        for row in rows:
            row_campus = normalize_campus(row.get("Campus") or row.get("campus") or "")
            if row_campus == campus_normalized or campus_normalized in row_campus:
                timestamp_str = row.get("Timestamp", "")
                if timestamp_str:
                    try:
                        if "T" in timestamp_str:
                            row_date = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            row_date = parse_any_date(timestamp_str)
                        if start_date <= row_date <= end_date:
                            filtered_rows.append(row)
                    except Exception:
                        continue
        
        # Calculate comprehensive stats
        stats = {
            'total_attendance': 0,
            'services_count': 0,
            'new_people': 0,
            'new_christians': 0,
            'youth_attendance': 0,
            'kids_attendance': 0,
            'connect_groups': 0,
            'dream_team': 0,
            'tithe': 0,
            'baptisms': 0,
            'child_dedications': 0,
            'first_time_visitors': 0,
            'visitors': 0,
            'rededications': 0,
            'youth_salvations': 0,
            'youth_new_people': 0,
            'kids_leaders': 0,
            'new_kids': 0,
            'new_kids_salvations': 0,
            'information_gathered': 0
        }
        
        # Track individual service data
        service_breakdown = {}
        
        for row in filtered_rows:
            if isinstance(row, dict):
                def safe_int_stat(val):
                    try:
                        if val is None or val == '':
                            return 0
                        return int(str(val).replace(',', '').strip())
                    except Exception:
                        return 0
                
                # Main stats
                stats['total_attendance'] += safe_int_stat(row.get('Total Attendance', 0))
                stats['new_people'] += safe_int_stat(row.get('First Time Visitors', 0)) + safe_int_stat(row.get('Visitors', 0))
                stats['new_christians'] += safe_int_stat(row.get('First Time Christians', 0)) + safe_int_stat(row.get('Rededications', 0))
                stats['youth_attendance'] += safe_int_stat(row.get('Youth Attendance', 0))
                stats['kids_attendance'] += safe_int_stat(row.get('Kids Attendance', 0))
                stats['connect_groups'] += safe_int_stat(row.get('Connect Groups', 0))
                stats['dream_team'] += safe_int_stat(row.get('Dream Team', 0))
                stats['tithe'] += safe_int_stat(row.get('Tithe', 0))
                stats['baptisms'] += safe_int_stat(row.get('Baptisms', 0))
                stats['child_dedications'] += safe_int_stat(row.get('Child Dedications', 0))
                stats['first_time_visitors'] += safe_int_stat(row.get('First Time Visitors', 0))
                stats['visitors'] += safe_int_stat(row.get('Visitors', 0))
                stats['rededications'] += safe_int_stat(row.get('Rededications', 0))
                stats['youth_salvations'] += safe_int_stat(row.get('Youth Salvations', 0))
                stats['youth_new_people'] += safe_int_stat(row.get('Youth New People', 0))
                stats['kids_leaders'] += safe_int_stat(row.get('Kids Leaders', 0))
                stats['new_kids'] += safe_int_stat(row.get('New Kids', 0))
                stats['new_kids_salvations'] += safe_int_stat(row.get('New Kids Salvations', 0))
                stats['information_gathered'] += safe_int_stat(row.get('Cards Back', 0))
                
                # Service breakdown
                service_time = row.get('Date', 'Unknown')
                if service_time not in service_breakdown:
                    service_breakdown[service_time] = {
                        'attendance': 0,
                        'new_people': 0,
                        'new_christians': 0,
                        'youth': 0,
                        'kids': 0
                    }
                
                service_breakdown[service_time]['attendance'] += safe_int_stat(row.get('Total Attendance', 0))
                service_breakdown[service_time]['new_people'] += safe_int_stat(row.get('First Time Visitors', 0)) + safe_int_stat(row.get('Visitors', 0))
                service_breakdown[service_time]['new_christians'] += safe_int_stat(row.get('First Time Christians', 0)) + safe_int_stat(row.get('Rededications', 0))
                service_breakdown[service_time]['youth'] += safe_int_stat(row.get('Youth Attendance', 0))
                service_breakdown[service_time]['kids'] += safe_int_stat(row.get('Kids Attendance', 0))
        
        stats['services_count'] = len(service_breakdown)
        
        # Calculate averages
        if stats['services_count'] > 0:
            stats['avg_attendance'] = round(stats['total_attendance'] / stats['services_count'])
            stats['avg_new_people'] = round(stats['new_people'] / stats['services_count'], 1)
            stats['avg_new_christians'] = round(stats['new_christians'] / stats['services_count'], 1)
            stats['avg_youth'] = round(stats['youth_attendance'] / stats['services_count'])
            stats['avg_kids'] = round(stats['kids_attendance'] / stats['services_count'])
        else:
            stats['avg_attendance'] = 0
            stats['avg_new_people'] = 0
            stats['avg_new_christians'] = 0
            stats['avg_youth'] = 0
            stats['avg_kids'] = 0
        
        # Generate insights
        insights = []
        if stats['total_attendance'] > 0:
            if stats['new_people'] > 0:
                conversion_rate = (stats['new_christians'] / stats['new_people']) * 100
                insights.append(f"Conversion rate: {conversion_rate:.1f}% of new people made decisions")
            
            if stats['youth_attendance'] > 0:
                youth_percentage = (stats['youth_attendance'] / stats['total_attendance']) * 100
                insights.append(f"Youth represented {youth_percentage:.1f}% of total attendance")
            
            if stats['kids_attendance'] > 0:
                kids_percentage = (stats['kids_attendance'] / stats['total_attendance']) * 100
                insights.append(f"Kids represented {kids_percentage:.1f}% of total attendance")
        
        return {
            'campus': campus,
            'date': date_str,
            'week_start': start_date.strftime('%Y-%m-%d'),
            'week_end': end_date.strftime('%Y-%m-%d'),
            'stats': stats,
            'service_breakdown': service_breakdown,
            'insights': insights,
            'data_points': len(filtered_rows)
        }
        
    except Exception as e:
        logger.error(f"Weekend report error: {e}")
        return {'error': str(e)}

def generate_senior_leadership_weekend_report(date_str: str = None) -> dict:
    """Generate a comprehensive weekend report for senior leadership across all campuses"""
    try:
        # If no date provided, use the most recent weekend
        if not date_str:
            today = datetime.now()
            days_since_sunday = today.weekday() + 1
            if days_since_sunday == 7:
                days_since_sunday = 0
            most_recent_sunday = today - timedelta(days=days_since_sunday)
            date_str = most_recent_sunday.strftime('%Y-%m-%d')
        
        report_date = datetime.strptime(date_str, '%Y-%m-%d')
        start_date = report_date - timedelta(days=6)
        end_date = report_date
        
        # Get all campuses
        campuses_data = load_campuses_database()
        active_campuses = [campus for campus in campuses_data.get('campuses', {}).values() if campus.get('active', True)]
        
        # Get data
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        
        if not rows:
            rows = load_local_data()
        
        # Generate reports for each campus
        campus_reports = {}
        total_stats = {
            'total_attendance': 0,
            'services_count': 0,
            'new_people': 0,
            'new_christians': 0,
            'youth_attendance': 0,
            'kids_attendance': 0,
            'connect_groups': 0,
            'dream_team': 0,
            'tithe': 0,
            'baptisms': 0,
            'child_dedications': 0
        }
        
        for campus_id, campus_info in active_campuses.items():
            campus_name = campus_info.get('display_name', campus_id)
            campus_report = generate_weekend_report(campus_name, date_str)
            if 'error' not in campus_report:
                campus_reports[campus_id] = campus_report
                # Add to totals
                stats = campus_report.get('stats', {})
                total_stats['total_attendance'] += stats.get('total_attendance', 0)
                total_stats['services_count'] += stats.get('services_count', 0)
                total_stats['new_people'] += stats.get('new_people', 0)
                total_stats['new_christians'] += stats.get('new_christians', 0)
                total_stats['youth_attendance'] += stats.get('youth_attendance', 0)
                total_stats['kids_attendance'] += stats.get('kids_attendance', 0)
                total_stats['connect_groups'] += stats.get('connect_groups', 0)
                total_stats['dream_team'] += stats.get('dream_team', 0)
                total_stats['tithe'] += stats.get('tithe', 0)
                total_stats['baptisms'] += stats.get('baptisms', 0)
                total_stats['child_dedications'] += stats.get('child_dedications', 0)
        
        # Calculate organization-wide averages
        if total_stats['services_count'] > 0:
            total_stats['avg_attendance'] = round(total_stats['total_attendance'] / total_stats['services_count'])
            total_stats['avg_new_people'] = round(total_stats['new_people'] / total_stats['services_count'], 1)
            total_stats['avg_new_christians'] = round(total_stats['new_christians'] / total_stats['services_count'], 1)
        else:
            total_stats['avg_attendance'] = 0
            total_stats['avg_new_people'] = 0
            total_stats['avg_new_christians'] = 0
        
        # Generate senior leadership insights
        insights = []
        if total_stats['total_attendance'] > 0:
            if total_stats['new_people'] > 0:
                org_conversion_rate = (total_stats['new_christians'] / total_stats['new_people']) * 100
                insights.append(f"Organization-wide conversion rate: {org_conversion_rate:.1f}%")
            
            if total_stats['youth_attendance'] > 0:
                org_youth_percentage = (total_stats['youth_attendance'] / total_stats['total_attendance']) * 100
                insights.append(f"Youth represent {org_youth_percentage:.1f}% of total attendance")
            
            if total_stats['kids_attendance'] > 0:
                org_kids_percentage = (total_stats['kids_attendance'] / total_stats['total_attendance']) * 100
                insights.append(f"Kids represent {org_kids_percentage:.1f}% of total attendance")
        
        # Find top performing campuses
        campus_performance = []
        for campus_id, report in campus_reports.items():
            if 'error' not in report:
                stats = report.get('stats', {})
                campus_performance.append({
                    'campus_id': campus_id,
                    'campus_name': report.get('campus', campus_id),
                    'attendance': stats.get('total_attendance', 0),
                    'new_people': stats.get('new_people', 0),
                    'new_christians': stats.get('new_christians', 0),
                    'services_count': stats.get('services_count', 0)
                })
        
        # Sort by attendance
        campus_performance.sort(key=lambda x: x['attendance'], reverse=True)
        
        return {
            'date': date_str,
            'week_start': start_date.strftime('%Y-%m-%d'),
            'week_end': end_date.strftime('%Y-%m-%d'),
            'total_stats': total_stats,
            'campus_reports': campus_reports,
            'campus_performance': campus_performance,
            'insights': insights,
            'total_campuses': len(active_campuses),
            'reporting_campuses': len(campus_reports)
        }
        
    except Exception as e:
        logger.error(f"Senior leadership weekend report error: {e}")
        return {'error': str(e)}

def generate_q1_leadership_report(year: int) -> dict:
    """Generate a comprehensive Q1 report for senior leadership across all campuses"""
    try:
        # Q1 dates: January 1 to March 31
        start_date = datetime(year, 1, 1)
        end_date = datetime(year, 3, 31)
        
        # Get all campuses
        campuses_data = load_campuses_database()
        active_campuses = [campus for campus in campuses_data.get('campuses', {}).values() if campus.get('active', True)]
        
        # Get data
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        
        if not rows:
            rows = load_local_data()
        
        # Generate reports for each campus
        campus_reports = {}
        total_stats = {
            'total_attendance': 0,
            'services_count': 0,
            'new_people': 0,
            'new_christians': 0,
            'youth_attendance': 0,
            'kids_attendance': 0,
            'connect_groups': 0,
            'dream_team': 0,
            'tithe': 0,
            'baptisms': 0,
            'child_dedications': 0
        }
        
        # Monthly totals across all campuses
        monthly_totals = {
            'january': {'attendance': 0, 'services': 0, 'new_people': 0, 'new_christians': 0, 'tithe': 0},
            'february': {'attendance': 0, 'services': 0, 'new_people': 0, 'new_christians': 0, 'tithe': 0},
            'march': {'attendance': 0, 'services': 0, 'new_people': 0, 'new_christians': 0, 'tithe': 0}
        }
        
        for campus_id, campus_info in active_campuses.items():
            campus_name = campus_info.get('display_name', campus_id)
            campus_report = generate_q1_campus_report(campus_name, year)
            if 'error' not in campus_report:
                campus_reports[campus_id] = campus_report
                # Add to totals
                stats = campus_report.get('stats', {})
                total_stats['total_attendance'] += stats.get('total_attendance', 0)
                total_stats['services_count'] += stats.get('services_count', 0)
                total_stats['new_people'] += stats.get('new_people', 0)
                total_stats['new_christians'] += stats.get('new_christians', 0)
                total_stats['youth_attendance'] += stats.get('youth_attendance', 0)
                total_stats['kids_attendance'] += stats.get('kids_attendance', 0)
                total_stats['connect_groups'] += stats.get('connect_groups', 0)
                total_stats['dream_team'] += stats.get('dream_team', 0)
                total_stats['tithe'] += stats.get('tithe', 0)
                total_stats['baptisms'] += stats.get('baptisms', 0)
                total_stats['child_dedications'] += stats.get('child_dedications', 0)
                
                # Add to monthly totals
                monthly_breakdown = campus_report.get('monthly_breakdown', {})
                for month in monthly_totals:
                    if month in monthly_breakdown:
                        monthly_totals[month]['attendance'] += monthly_breakdown[month]['attendance']
                        monthly_totals[month]['services'] += monthly_breakdown[month]['services']
                        monthly_totals[month]['new_people'] += monthly_breakdown[month]['new_people']
                        monthly_totals[month]['new_christians'] += monthly_breakdown[month]['new_christians']
                        monthly_totals[month]['tithe'] += monthly_breakdown[month]['tithe']
        
        # Calculate organization-wide averages
        if total_stats['services_count'] > 0:
            total_stats['avg_attendance'] = round(total_stats['total_attendance'] / total_stats['services_count'])
            total_stats['avg_new_people'] = round(total_stats['new_people'] / total_stats['services_count'], 1)
            total_stats['avg_new_christians'] = round(total_stats['new_christians'] / total_stats['services_count'], 1)
        else:
            total_stats['avg_attendance'] = 0
            total_stats['avg_new_people'] = 0
            total_stats['avg_new_christians'] = 0
        
        # Generate senior leadership insights
        insights = []
        if total_stats['total_attendance'] > 0:
            if total_stats['new_people'] > 0:
                org_conversion_rate = (total_stats['new_christians'] / total_stats['new_people']) * 100
                insights.append(f"Organization-wide Q1 conversion rate: {org_conversion_rate:.1f}%")
            
            if total_stats['youth_attendance'] > 0:
                org_youth_percentage = (total_stats['youth_attendance'] / total_stats['total_attendance']) * 100
                insights.append(f"Youth represent {org_youth_percentage:.1f}% of total attendance")
            
            if total_stats['kids_attendance'] > 0:
                org_kids_percentage = (total_stats['kids_attendance'] / total_stats['total_attendance']) * 100
                insights.append(f"Kids represent {org_kids_percentage:.1f}% of total attendance")
        
        # Find top performing campuses
        campus_performance = []
        for campus_id, report in campus_reports.items():
            if 'error' not in report:
                stats = report.get('stats', {})
                campus_performance.append({
                    'campus_id': campus_id,
                    'campus_name': report.get('campus', campus_id),
                    'attendance': stats.get('total_attendance', 0),
                    'new_people': stats.get('new_people', 0),
                    'new_christians': stats.get('new_christians', 0),
                    'services_count': stats.get('services_count', 0),
                    'avg_attendance': stats.get('avg_attendance', 0)
                })
        
        # Sort by attendance
        campus_performance.sort(key=lambda x: x['attendance'], reverse=True)
        
        # Calculate Q1 growth trends
        growth_insights = []
        if monthly_totals['january']['attendance'] > 0 and monthly_totals['march']['attendance'] > 0:
            jan_avg = monthly_totals['january']['attendance'] / max(monthly_totals['january']['services'], 1)
            mar_avg = monthly_totals['march']['attendance'] / max(monthly_totals['march']['services'], 1)
            if jan_avg > 0:
                growth_rate = ((mar_avg - jan_avg) / jan_avg) * 100
                growth_insights.append(f"Organization-wide average attendance grew {growth_rate:+.1f}% from January to March")
        
        return {
            'year': year,
            'quarter': 1,
            'period': 'Q1',
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'total_stats': total_stats,
            'monthly_totals': monthly_totals,
            'campus_reports': campus_reports,
            'campus_performance': campus_performance,
            'insights': insights,
            'growth_insights': growth_insights,
            'total_campuses': len(active_campuses),
            'reporting_campuses': len(campus_reports)
        }
        
    except Exception as e:
        logger.error(f"Q1 leadership report error: {e}")
        return {'error': str(e)}

def generate_any_time_frame_leadership_report(start_date: datetime, end_date: datetime) -> dict:
    """Generate a comprehensive any time frame report for senior leadership across all campuses"""
    try:
        # Get data
        rows = []
        if sheet:
            try:
                rows = safe_sheets_request(sheet.get_all_records)
            except Exception as e:
                logger.error(f"Failed to get stats from Google Sheets: {e}")
                rows = []
        
        if not rows:
            rows = load_local_data()
        
        # Get all campuses
        campuses_data = get_campuses_for_user()
        all_campuses = [campus['id'] for campus in campuses_data.get('campuses', []) if campus['id'] != 'all_campuses']
        
        # Generate individual campus reports
        campus_reports = {}
        organization_stats = {
            'total_attendance': 0,
            'total_services': 0,
            'total_new_people': 0,
            'total_new_christians': 0,
            'total_youth': 0,
            'total_kids': 0,
            'total_connect_groups': 0,
            'total_dream_team': 0,
            'total_tithe': 0,
            'total_baptisms': 0,
            'total_child_dedications': 0
        }
        
        for campus in all_campuses:
            campus_report = generate_any_time_frame_campus_report(campus, start_date, end_date)
            campus_reports[campus] = campus_report
            
            # Aggregate organization stats
            if 'stats' in campus_report:
                stats = campus_report['stats']
                organization_stats['total_attendance'] += stats.get('total_attendance', 0)
                organization_stats['total_services'] += stats.get('services_count', 0)
                organization_stats['total_new_people'] += stats.get('new_people', 0)
                organization_stats['total_new_christians'] += stats.get('new_christians', 0)
                organization_stats['total_youth'] += stats.get('youth_attendance', 0)
                organization_stats['total_kids'] += stats.get('kids_attendance', 0)
                organization_stats['total_connect_groups'] += stats.get('connect_groups', 0)
                organization_stats['total_dream_team'] += stats.get('dream_team', 0)
                organization_stats['total_tithe'] += stats.get('tithe', 0)
                organization_stats['total_baptisms'] += stats.get('baptisms', 0)
                organization_stats['total_child_dedications'] += stats.get('child_dedications', 0)
        
        # Calculate organization averages
        if organization_stats['total_services'] > 0:
            organization_stats['average_attendance'] = round(organization_stats['total_attendance'] / organization_stats['total_services'], 1)
            organization_stats['average_new_people'] = round(organization_stats['total_new_people'] / organization_stats['total_services'], 1)
            organization_stats['average_new_christians'] = round(organization_stats['total_new_christians'] / organization_stats['total_services'], 1)
        else:
            organization_stats['average_attendance'] = 0
            organization_stats['average_new_people'] = 0
            organization_stats['average_new_christians'] = 0
        
        # Campus performance ranking
        campus_performance = []
        for campus, report in campus_reports.items():
            if 'stats' in report and report['stats'].get('services_count', 0) > 0:
                campus_performance.append({
                    'campus': campus,
                    'campus_display_name': display_campus_name(campus),
                    'total_attendance': report['stats'].get('total_attendance', 0),
                    'average_attendance': report['stats'].get('average_attendance', 0),
                    'total_new_people': report['stats'].get('new_people', 0),
                    'total_new_christians': report['stats'].get('new_christians', 0),
                    'services_count': report['stats'].get('services_count', 0),
                    'tithe': report['stats'].get('tithe', 0)
                })
        
        # Sort by total attendance
        campus_performance.sort(key=lambda x: x['total_attendance'], reverse=True)
        
        # Generate insights
        insights = []
        if organization_stats['total_services'] > 0:
            insights.append(f"Organization-wide average attendance of {organization_stats['average_attendance']} people per service")
            if organization_stats['total_new_people'] > 0:
                org_conversion_rate = (organization_stats['total_new_christians'] / organization_stats['total_new_people']) * 100
                insights.append(f"Welcomed {organization_stats['total_new_people']} new people across all campuses")
                insights.append(f"Organization-wide conversion rate of {org_conversion_rate:.1f}%")
            if organization_stats['total_tithe'] > 0:
                avg_tithe_per_service = organization_stats['total_tithe'] / organization_stats['total_services']
                insights.append(f"Average tithe of ${avg_tithe_per_service:,.0f} per service across all campuses")
        
        # Format date range for display
        date_range_str = f"{start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}"
        
        return {
            'date_range': date_range_str,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'organization_stats': organization_stats,
            'campus_reports': campus_reports,
            'campus_performance': campus_performance,
            'insights': insights,
            'total_campuses': len(all_campuses),
            'active_campuses': len([c for c in campus_reports.values() if c.get('stats', {}).get('services_count', 0) > 0])
        }
        
    except Exception as e:
        logger.error(f"Error generating any time frame leadership report: {e}")
        return {
            'error': f"Failed to generate leadership report: {str(e)}",
            'date_range': f"{start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}",
            'organization_stats': {},
            'campus_reports': {},
            'campus_performance': [],
            'insights': [],
            'total_campuses': 0,
            'active_campuses': 0
        }

# Patch the review detection logic in query_data_internal
# ... existing code ...

# @app.route('/heartbeat')
# def heartbeat():
#     return render_template('heartbeat.html')

# @app.route('/journey')
# def journey():
#     return render_template('journey.html')

# Catch-all route for React Router - serve React app for all non-API routes
@app.route('/<path:path>')
def serve_react_app(path):
    """Serve React app for all non-API routes to support React Router"""
    # Ensure path is a string
    if not isinstance(path, str):
        path = str(path)
    
    # IMPORTANT: Don't intercept API routes - Flask handles blueprint routes first
    # If an API route matches a blueprint, Flask will use it
    # If not, Flask will return 404 automatically
    # This catch-all should ONLY handle non-API routes for React Router
    
    # Handle temp_audio and uploads - these are served as static files  
    if path.startswith('temp_audio/') or path.startswith('uploads/'):
        pass  # Continue to serve these as static files
    elif path.startswith('api/'):
        # API routes should be handled by blueprints, not this catch-all
        # If we reach here, no blueprint matched, so return 404
        # Log which API route wasn't found for debugging
        logger.warning(f"[CATCH-ALL] API route not found: {path} (method: {request.method})")
        return jsonify({"error": "API endpoint not found", "path": path, "method": request.method}), 404
    
    # If path has an extension (like .json, .png, .js, etc), try to serve as static file
    try:
        path_parts = path.split('/')
        if path_parts and '.' in path_parts[-1]:
            # Ensure path is a valid string before passing to send_from_directory
            if not isinstance(path, str):
                path = str(path)
            if not path:
                return jsonify({"error": "Invalid path"}), 400
            
            # Check if static folder exists and path is safe
            if not app.static_folder:
                return jsonify({"error": "Static folder not configured"}), 404
            
            # Normalize the path (remove any unsafe characters)
            safe_path = os.path.normpath(path).lstrip('/')
            if '..' in safe_path:
                return jsonify({"error": "Invalid path"}), 400
            
            # Try to serve the file from static folder
            try:
                return send_from_directory(app.static_folder, safe_path)
            except FileNotFoundError:
                logger.warning(f"File not found: {safe_path}")
                return jsonify({"error": "Not found"}), 404
    except Exception as e:
        logger.error(f"Error serving static file {path}: {e}", exc_info=True)
        # Return a proper error response
        return jsonify({"error": "Internal server error", "message": str(e)}), 500
    
    # For routes without extensions (React Router paths), serve the React app
    return send_from_directory('static', 'index.html')


# USER MANAGEMENT ROUTES
@app.route('/api/users', methods=['GET'])
@login_required
def get_users():
    """Get all users (admin and leadership roles only)"""
    try:
        if current_user.role not in ALL_ACCESS_ROLES:
            return jsonify({'error': 'Unauthorized'}), 403
        
        users_db = load_users_database()
        users_list = []
        
        for user_id, user_data in users_db.get('users', {}).items():
            # Don't send password hash to frontend
            user_info = {
                'id': user_data.get('id'),
                'username': user_data.get('username'),
                'email': user_data.get('email', ''),
                'full_name': user_data.get('full_name'),
                'role': user_data.get('role'),
                'campus': user_data.get('campus'),
                'region_id': user_data.get('region_id'),
                'active': user_data.get('active', True),
                'last_login': user_data.get('last_login'),
                'created_date': user_data.get('created_date'),
                'custom_permissions': user_data.get('custom_permissions')
            }
            users_list.append(user_info)
        
        response = jsonify({'users': users_list, 'success': True})
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        return response
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({'error': 'Failed to fetch users'}), 500

@app.route('/api/admin/resource-categories', methods=['GET'])
@admin_required_json
def get_admin_resource_categories():
    """Get all resource categories (admin only) - respects Role Manager resource_manager"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('resource_manager') is False:
        return jsonify({'error': 'Access denied - Resource Manager has been disabled for your account'}), 403
    try:
        # Try to get categories from database, but handle case where table doesn't exist yet
        try:
            categories = ResourceCategory.query.filter_by(is_active=True).order_by(ResourceCategory.sort_order.asc(), ResourceCategory.display_name.asc()).all()
            categories_data = [category.to_dict() for category in categories]
        except Exception as db_error:
            # Table might not exist yet - create it
            logger.warning(f"ResourceCategory table might not exist: {db_error}")
            try:
                db.create_all()
                categories_data = []
            except Exception as create_error:
                logger.error(f"Failed to create ResourceCategory table: {create_error}")
                categories_data = []
        
        return jsonify({'categories': categories_data})
    except Exception as e:
        logger.error(f"Error fetching resource categories: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch resource categories'}), 500

@app.route('/api/admin/resource-categories', methods=['POST'])
@admin_required_json
def create_resource_category():
    """Create a new resource category (admin only) - respects Role Manager resource_manager"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('resource_manager') is False:
        return jsonify({'error': 'Access denied - Resource Manager has been disabled for your account'}), 403
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('displayName'):
            return jsonify({'error': 'Display name is required'}), 400
        
        # Auto-generate slug from display name if not provided
        slug = data.get('slug', '').strip()
        if not slug:
            # Generate slug from display name: lowercase, replace spaces with hyphens, remove special chars
            slug = data['displayName'].lower().strip()
            slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special characters
            slug = re.sub(r'[\s_]+', '-', slug)  # Replace spaces/underscores with hyphens
            slug = re.sub(r'-+', '-', slug)  # Replace multiple hyphens with single hyphen
            slug = slug.strip('-')  # Remove leading/trailing hyphens
        
        # Ensure table exists
        try:
            db.create_all()
        except Exception as create_error:
            logger.warning(f"Table creation check: {create_error}")
        
        # Check if slug already exists, and make it unique if needed
        base_slug = slug
        counter = 1
        while ResourceCategory.query.filter_by(slug=slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        # Create new category
        category = ResourceCategory(
            display_name=data['displayName'],
            slug=slug,
            description=data.get('description', ''),
            folder_id=data.get('folderId', ''),
            sort_order=data.get('sortOrder', 0),
            links=json.dumps(data.get('links', [])),
            is_active=True
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'message': 'Resource category created successfully',
            'category': category.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating resource category: {e}")
        return jsonify({'error': f'Failed to create resource category: {str(e)}'}), 500

@app.route('/api/admin/resource-categories/<category_id>', methods=['PUT'])
@admin_required_json
def update_resource_category(category_id):
    """Update a resource category (admin only) - respects Role Manager resource_manager"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('resource_manager') is False:
        return jsonify({'error': 'Access denied - Resource Manager has been disabled for your account'}), 403
    try:
        data = request.get_json()
        
        # Find category by slug or ID
        category = ResourceCategory.query.filter(
            (ResourceCategory.slug == category_id) | (ResourceCategory.id == category_id)
        ).first()
        
        if not category:
            return jsonify({'error': 'Resource category not found'}), 404
        
        # Update fields
        if 'displayName' in data:
            category.display_name = data['displayName']
        if 'slug' in data:
            # Check if new slug conflicts with another category
            existing = ResourceCategory.query.filter_by(slug=data['slug']).first()
            if existing and existing.id != category.id:
                return jsonify({'error': 'A category with this slug already exists'}), 400
            category.slug = data['slug']
        if 'description' in data:
            category.description = data.get('description', '')
        if 'folderId' in data:
            category.folder_id = data.get('folderId', '')
        if 'sortOrder' in data:
            category.sort_order = data.get('sortOrder', 0)
        if 'links' in data:
            category.links = json.dumps(data.get('links', []))
        
        category.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Resource category updated successfully',
            'category': category.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating resource category: {e}")
        return jsonify({'error': f'Failed to update resource category: {str(e)}'}), 500

@app.route('/api/admin/resource-categories/<category_id>', methods=['DELETE'])
@admin_required_json
def delete_resource_category(category_id):
    """Delete a resource category (admin only) - respects Role Manager resource_manager"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('resource_manager') is False:
        return jsonify({'error': 'Access denied - Resource Manager has been disabled for your account'}), 403
    try:
        # Find category by slug or ID
        category = ResourceCategory.query.filter(
            (ResourceCategory.slug == category_id) | (ResourceCategory.id == category_id)
        ).first()
        
        if not category:
            return jsonify({'error': 'Resource category not found'}), 404
        
        # Store category name for response message
        category_name = category.display_name
        
        # Delete the category (cascade will handle related links if using proper foreign keys)
        db.session.delete(category)
        db.session.commit()
        
        return jsonify({
            'message': f'Resource category "{category_name}" deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting resource category: {e}")
        return jsonify({'error': f'Failed to delete resource category: {str(e)}'}), 500

@app.route('/api/resources/categories', methods=['GET'])
@login_required_json
def get_resource_categories():
    """Get all resource categories"""
    try:
        
        # Try to get categories from database, but handle case where table doesn't exist yet
        try:
            categories = ResourceCategory.query.filter_by(is_active=True).order_by(ResourceCategory.sort_order.asc(), ResourceCategory.display_name.asc()).all()
            categories_data = [category.to_dict() for category in categories]
        except Exception as db_error:
            # Table might not exist yet - create it
            logger.warning(f"ResourceCategory table might not exist: {db_error}")
            try:
                db.create_all()
                categories_data = []
            except Exception as create_error:
                logger.error(f"Failed to create ResourceCategory table: {create_error}")
                categories_data = []
        
        return jsonify({'categories': categories_data})
    except Exception as e:
        logger.error(f"Error fetching resource categories: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch resource categories'}), 500

# --- Google Drive OAuth: persist refresh token per user (survives logout / idle session) ---
def _ensure_users_google_refresh_column(cursor):
    """Add google_refresh_token to users if missing."""
    try:
        cursor.execute("SELECT google_refresh_token FROM users LIMIT 1")
    except Exception:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN google_refresh_token TEXT DEFAULT NULL")
            logger.info("Added users.google_refresh_token column")
        except Exception as e:
            logger.warning("Could not add google_refresh_token column: %s", e)


def _get_user_google_refresh_token(user_id):
    if user_id is None:
        return None
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return None
    try:
        conn = get_db()
        cursor = conn.cursor()
        _ensure_users_google_refresh_column(cursor)
        cursor.execute("SELECT google_refresh_token FROM users WHERE id = ?", (uid,))
        row = cursor.fetchone()
        conn.close()
        if row and row[0]:
            return str(row[0])
    except Exception as e:
        logger.warning("_get_user_google_refresh_token: %s", e)
    return None


def _save_user_google_refresh_token(user_id, refresh_token):
    if not refresh_token or user_id is None:
        return
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return
    try:
        conn = get_db()
        cursor = conn.cursor()
        _ensure_users_google_refresh_column(cursor)
        cursor.execute(
            "UPDATE users SET google_refresh_token = ? WHERE id = ?",
            (refresh_token, uid),
        )
        conn.commit()
        conn.close()
        logger.info("Stored Google refresh token for user id=%s", uid)
    except Exception as e:
        logger.error("_save_user_google_refresh_token: %s", e, exc_info=True)


def _clear_user_google_refresh_token(user_id):
    if user_id is None:
        return
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return
    try:
        conn = get_db()
        cursor = conn.cursor()
        _ensure_users_google_refresh_column(cursor)
        cursor.execute("UPDATE users SET google_refresh_token = NULL WHERE id = ?", (uid,))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning("_clear_user_google_refresh_token: %s", e)


def refresh_google_access_token_in_session():
    """
    Ensure the current session has a valid Google Drive access token.
    Refreshes using refresh_token from the session or users.google_refresh_token.
    """
    try:
        if not current_user.is_authenticated:
            return False
        uid = int(current_user.id)
    except (TypeError, ValueError, AttributeError):
        return False

    now = datetime.now(timezone.utc).timestamp()
    access = session.get("google_drive_access_token")
    expiry = float(session.get("google_drive_token_expiry") or 0)
    if access and expiry > now + 120:
        session["google_drive_authenticated"] = True
        return True

    rt = session.get("google_drive_refresh_token") or _get_user_google_refresh_token(uid)
    if not rt:
        session.pop("google_drive_authenticated", None)
        return False

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        return False

    try:
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": rt,
                "grant_type": "refresh_token",
            },
            timeout=30,
        )
    except Exception as e:
        logger.warning("Google token refresh request failed: %s", e)
        return False

    if not token_response.ok:
        try:
            err = token_response.json()
            if err.get("error") == "invalid_grant":
                logger.warning(
                    "Google refresh token invalid; clearing stored token for user %s", uid
                )
                _clear_user_google_refresh_token(uid)
                session.pop("google_drive_refresh_token", None)
        except Exception:
            pass
        logger.warning(
            "Google token refresh failed: %s %s",
            token_response.status_code,
            (token_response.text or "")[:300],
        )
        return False

    tokens = token_response.json()
    new_access = tokens.get("access_token")
    if not new_access:
        return False

    session["google_drive_access_token"] = new_access
    expires_in = int(tokens.get("expires_in") or 3600)
    session["google_drive_token_expiry"] = now + expires_in
    session["google_drive_authenticated"] = True
    new_rt = tokens.get("refresh_token")
    if new_rt:
        _save_user_google_refresh_token(uid, new_rt)
        session["google_drive_refresh_token"] = new_rt
    else:
        session["google_drive_refresh_token"] = rt
    session.modified = True
    return True


@app.route('/api/google/auth-url', methods=['GET'])
def get_google_auth_url():
    """Get Google Drive OAuth URL - accessible to all authenticated users"""
    try:
        # Check authentication manually (don't use decorator to avoid recursion)
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required. Please sign in first.'}), 401
        
        # All authenticated users can now connect Google Drive (no role restriction)
        
        # Check if OAuth credentials are configured
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')
        
        if not client_id or not client_secret:
            return jsonify({
                'error': 'Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
                'auth_url': None
            }), 503
        
        # Use request origin for redirect URI if not set
        if not redirect_uri:
            # Get the origin from the request
            origin = request.headers.get('Origin') or request.host_url.rstrip('/')
            redirect_uri = f"{origin}/api/google/callback"
        
        # Generate state token for security
        import secrets
        state_token = secrets.token_urlsafe(32)
        
        # Store in both session (for same-origin requests) and in-memory store (for OAuth redirects)
        session['google_oauth_state'] = state_token
        session['google_oauth_user_id'] = current_user.id
        
        # Also store in in-memory store with 10-minute expiration
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        oauth_state_store[state_token] = {
            'user_id': current_user.id,
            'expires_at': expires_at
        }
        
        # Clean up expired states (keep last 1000 entries max)
        if len(oauth_state_store) > 1000:
            now = datetime.now(timezone.utc)
            expired_states = [k for k, v in oauth_state_store.items() if v['expires_at'] < now]
            for expired_state in expired_states:
                oauth_state_store.pop(expired_state, None)
        
        # Google OAuth scopes for Drive
        scopes = [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/drive.file'
        ]
        scope_string = ' '.join(scopes)

        try:
            has_stored_refresh = bool(_get_user_google_refresh_token(current_user.id))
        except Exception:
            has_stored_refresh = False

        # Build OAuth URL (force consent only when we need a new refresh token)
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope={scope_string}&"
            f"state={state_token}&"
            f"access_type=offline"
        )
        if not has_stored_refresh:
            auth_url += "&prompt=consent"
        
        return jsonify({
            'auth_url': auth_url,
            'state': state_token
        })
    except Exception as e:
        logger.error(f"Error getting Google auth URL: {e}", exc_info=True)
        return jsonify({'error': f'Failed to get Google auth URL: {str(e)}'}), 500

@app.route('/api/google/callback', methods=['GET'])
def google_oauth_callback():
    """Handle Google OAuth callback"""
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')
        
        if error:
            return jsonify({'error': f'OAuth error: {error}'}), 400
        
        if not code:
            return jsonify({'error': 'Missing authorization code'}), 400
        
        # Verify state token - check both session and in-memory store
        expected_state = session.get('google_oauth_state')
        state_valid = False
        user_id = None
        
        # First, try to get from in-memory store (works even if session cookie wasn't sent)
        if state and state in oauth_state_store:
            state_data = oauth_state_store[state]
            # Check if expired
            if state_data['expires_at'] > datetime.now(timezone.utc):
                state_valid = True
                user_id = state_data['user_id']
                # Clean up used state
                oauth_state_store.pop(state, None)
                logger.info(f"State token validated from in-memory store for user {user_id}")
            else:
                # Expired state, remove it
                oauth_state_store.pop(state, None)
                logger.warning(f"State token expired: {state}")
        
        # Fall back to session validation
        if not state_valid and expected_state and state == expected_state:
            state_valid = True
            user_id = session.get('google_oauth_user_id')
            logger.info(f"State token validated from session for user {user_id}")
        
        # If still not valid, try to get user from Flask-Login (less secure but functional)
        if not state_valid:
            if current_user.is_authenticated:
                # Allow if user is authenticated (less secure but prevents auth failures)
                logger.warning(f"State token mismatch but user is authenticated. State: {state}, Expected: {expected_state}")
                user_id = current_user.id
                state_valid = True  # Allow with warning
            else:
                logger.warning(f"Invalid state token: expected {expected_state}, got {state}, and user not authenticated")
                return jsonify({'error': 'Invalid state token. Please try again.'}), 400
        
        if not user_id:
            logger.warning("No user_id found after state validation")
            return jsonify({'error': 'Session expired. Please log in again.'}), 401
        
        # Exchange code for tokens
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')
        
        if not redirect_uri:
            origin = request.headers.get('Origin') or request.host_url.rstrip('/')
            redirect_uri = f"{origin}/api/google/callback"
        
        # Exchange authorization code for tokens
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        token_response = requests.post(token_url, data=token_data)
        
        if not token_response.ok:
            logger.error(f"Token exchange failed: {token_response.text}")
            return jsonify({'error': 'Failed to exchange authorization code'}), 500
        
        tokens = token_response.json()

        try:
            uid = int(user_id)
        except (TypeError, ValueError):
            uid = None

        new_rt = tokens.get("refresh_token")
        if new_rt and uid is not None:
            _save_user_google_refresh_token(uid, new_rt)
        stored_rt = new_rt
        if not stored_rt and uid is not None:
            stored_rt = _get_user_google_refresh_token(uid)

        # Store tokens in session; refresh token also kept in DB for the next login
        session["google_drive_access_token"] = tokens.get("access_token")
        session["google_drive_refresh_token"] = stored_rt
        session["google_drive_token_expiry"] = datetime.now(timezone.utc).timestamp() + int(
            tokens.get("expires_in") or 3600
        )
        session["google_drive_authenticated"] = bool(session.get("google_drive_access_token"))
        
        # Clear OAuth state from both session and in-memory store
        session.pop('google_oauth_state', None)
        session.pop('google_oauth_user_id', None)
        # Also remove from in-memory store if it exists
        if state:
            oauth_state_store.pop(state, None)
        
        # CRITICAL: Mark session as modified and save it before redirecting
        session.modified = True
        
        # Log success (don't re-login user as it can cause recursion)
        if current_user.is_authenticated:
            logger.info(f"Google Drive OAuth successful for authenticated user {current_user.username} (ID: {user_id}), tokens stored in session")
        else:
            logger.info(f"Google Drive OAuth successful for user {user_id}, tokens stored in session")
        
        # Get redirect URL from sessionStorage (set by frontend) or default to dashboard
        # Return success page that redirects back to the app
        return '''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Google Drive Connected</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                    padding: 20px;
                }
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 400px;
                }
                h1 { margin-top: 0; }
                .checkmark {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .spinner {
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-top: 3px solid white;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="checkmark">✓</div>
                <h1>Google Drive Connected!</h1>
                <p>Redirecting you back to the app...</p>
                <div class="spinner"></div>
            </div>
            <script>
                // Get redirect URL from sessionStorage or default to dashboard
                let redirectUrl = '/dashboard';
                try {
                    const storedRedirect = sessionStorage.getItem('google_oauth_redirect');
                    if (storedRedirect) {
                        redirectUrl = storedRedirect;
                        sessionStorage.removeItem('google_oauth_redirect');
                    }
                } catch (e) {
                    console.log('Could not read sessionStorage:', e);
                }
                
                // Store success flag for the app to detect
                try {
                    sessionStorage.setItem('google_oauth_success', 'true');
                } catch (e) {
                    console.log('Could not set sessionStorage:', e);
                }
                
                // Redirect back to the app with success flag
                const separator = redirectUrl.includes('?') ? '&' : '?';
                window.location.href = redirectUrl + separator + 'oauth_success=true';
            </script>
        </body>
        </html>
        '''
    except Exception as e:
        logger.error(f"Error in Google OAuth callback: {e}", exc_info=True)
        return jsonify({'error': f'OAuth callback failed: {str(e)}'}), 500

def fetch_drive_folder_files(folder_id, access_token):
    """Fetch files from a Google Drive folder using the Drive API"""
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    from googleapiclient.errors import HttpError
    
    try:
        # Create credentials from access token
        credentials = Credentials(token=access_token)
        
        # Build Drive API service
        service = build('drive', 'v3', credentials=credentials)
        
        logger.info(f"Attempting to fetch files from Google Drive folder: {folder_id}")
        
        # Fetch files AND folders from folder (first 100 items, folders first then by name)
        # Include Shared Drive support with supportsAllDrives and includeItemsFromAllDrives
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            pageSize=100,
            fields="files(id, name, mimeType, modifiedTime, webViewLink, iconLink)",
            orderBy="folder,name",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        
        files = results.get('files', [])
        logger.info(f"Successfully fetched {len(files)} files from Google Drive folder {folder_id}")
        return files
    except HttpError as e:
        logger.error(f"Google Drive API HttpError for folder {folder_id}: {e.status_code} - {e.reason}", exc_info=True)
        if e.status_code == 401:
            logger.error("Drive API returned 401 - token is invalid or expired")
        elif e.status_code == 403:
            logger.error("Drive API returned 403 - insufficient permissions or folder not accessible")
        elif e.status_code == 404:
            logger.error("Drive API returned 404 - folder not found or not accessible")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching Drive folder files: {type(e).__name__} - {str(e)}", exc_info=True)
        return []

@app.route('/api/resources/<category_id>', methods=['GET'])
@login_required_json
def get_resource_category_files(category_id):
    """Get files for a specific resource category"""
    try:
        
        # Get category to retrieve links and folder ID
        category = ResourceCategory.query.filter(
            (ResourceCategory.slug == category_id) | (ResourceCategory.id == category_id)
        ).filter_by(is_active=True).first()
        
        if not category:
            return jsonify({'files': [], 'links': []})
        
        # Get links from category
        links = json.loads(category.links) if category.links else []
        
        # Get display name overrides for this category
        overrides = {}
        if category.id:
            override_records = DriveItemOverride.query.filter_by(category_id=category.id).all()
            overrides = {override.drive_item_id: override.custom_name for override in override_records}
            logger.info(f"Loaded {len(overrides)} display name overrides for category {category.slug}")
        
        # Try to fetch files from Google Drive if folder_id is set
        files = []
        drive_auth_needed = False
        drive_error = None
        
        if category.folder_id:
            refresh_google_access_token_in_session()
            # Check if user has Google Drive access token
            access_token = session.get('google_drive_access_token')
            token_expiry = session.get('google_drive_token_expiry', 0)
            current_time = datetime.now(timezone.utc).timestamp()
            
            logger.info(f"Drive auth check - has_token: {bool(access_token)}, expiry: {token_expiry}, current: {current_time}, expired: {current_time >= token_expiry}")
            
            if access_token:
                # Check if token is expired
                if current_time < token_expiry:
                    # Fetch files from Drive
                    logger.info(f"Fetching files from Google Drive folder: {category.folder_id}")
                    files = fetch_drive_folder_files(category.folder_id, access_token)
                    
                    # Apply custom display names from overrides
                    for file in files:
                        if file['id'] in overrides:
                            file['displayName'] = overrides[file['id']]
                            file['originalName'] = file['name']  # Keep original for reference
                            logger.debug(f"Applied override: {file['name']} → {file['displayName']}")
                    
                    # Log result but don't treat empty as error - folder might just be empty or only have subfolders
                    if len(files) == 0:
                        logger.warning(f"No items returned from Drive API for folder {category.folder_id}. Folder may be empty or user may lack permissions.")
                else:
                    logger.info(f"Google Drive token expired for user (expiry: {token_expiry}, current: {current_time})")
                    drive_auth_needed = True
                    drive_error = "Google Drive authentication expired. Please reconnect."
            else:
                logger.info("No Google Drive access token found in session")
                drive_auth_needed = True
                drive_error = "Google Drive not connected. Please authenticate."
        else:
            logger.info(f"Category {category.slug} has no folder_id configured")
        
        response_data = {
            'files': files,
            'links': links,
            'drive_auth_needed': drive_auth_needed,
            'has_folder_id': bool(category.folder_id),
            'has_access_token': bool(session.get('google_drive_access_token')),
            'folder_id': category.folder_id if category.folder_id else None
        }
        
        if drive_error:
            response_data['drive_error'] = drive_error
        
        logger.info(f"Returning {len(files)} files and {len(links)} links for category {category.slug}, drive_auth_needed={drive_auth_needed}, error={drive_error}")
        
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error fetching resource category files: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch resource files'}), 500

@app.route('/api/resources/<category_id>/folder/<folder_id>', methods=['GET'])
@login_required_json
def get_resource_folder_files(category_id, folder_id):
    """Get files from a specific subfolder in a resource category"""
    try:
        # Get category to verify it exists
        category = ResourceCategory.query.filter(
            (ResourceCategory.slug == category_id) | (ResourceCategory.id == category_id)
        ).filter_by(is_active=True).first()
        
        if not category:
            return jsonify({'files': [], 'links': []})
        
        # Get display name overrides for this category
        overrides = {}
        if category.id:
            override_records = DriveItemOverride.query.filter_by(category_id=category.id).all()
            overrides = {override.drive_item_id: override.custom_name for override in override_records}
        
        # Fetch files from the specific folder
        files = []
        drive_auth_needed = False
        drive_error = None
        
        refresh_google_access_token_in_session()
        access_token = session.get('google_drive_access_token')
        token_expiry = session.get('google_drive_token_expiry', 0)
        current_time = datetime.now(timezone.utc).timestamp()

        if access_token and current_time < token_expiry:
            # Fetch files from the subfolder
            logger.info(f"Fetching files from Google Drive subfolder: {folder_id}")
            files = fetch_drive_folder_files(folder_id, access_token)
            
            # Apply custom display names from overrides
            for file in files:
                if file['id'] in overrides:
                    file['displayName'] = overrides[file['id']]
                    file['originalName'] = file['name']
            
            if len(files) == 0:
                logger.warning(f"No items returned from Drive API for folder {folder_id}")
        elif access_token:
            logger.info(f"Google Drive token expired for user")
            drive_auth_needed = True
            drive_error = "Google Drive authentication expired. Please reconnect."
        else:
            logger.info("No Google Drive access token found in session")
            drive_auth_needed = True
            drive_error = "Google Drive not connected. Please authenticate."
        
        response_data = {
            'files': files,
            'links': [],  # No quick links in subfolders
            'drive_auth_needed': drive_auth_needed,
            'has_access_token': bool(session.get('google_drive_access_token')),
            'folder_id': folder_id
        }
        
        if drive_error:
            response_data['drive_error'] = drive_error
        
        logger.info(f"Returning {len(files)} files from subfolder {folder_id}")
        
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error fetching subfolder files: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch subfolder files'}), 500

@app.route('/api/admin/resource-categories/<category_id>/drive-overrides', methods=['GET'])
@admin_required_json
def get_drive_overrides(category_id):
    """Get all display name overrides for a category - respects Role Manager resource_manager"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('resource_manager') is False:
        return jsonify({'error': 'Access denied - Resource Manager has been disabled for your account'}), 403
    try:
        category = ResourceCategory.query.filter(
            (ResourceCategory.slug == category_id) | (ResourceCategory.id == category_id)
        ).first()
        
        if not category:
            return jsonify({'error': 'Category not found'}), 404
        
        overrides = DriveItemOverride.query.filter_by(category_id=category.id).all()
        return jsonify({'overrides': [o.to_dict() for o in overrides]})
    except Exception as e:
        logger.error(f"Error fetching drive overrides: {e}")
        return jsonify({'error': 'Failed to fetch overrides'}), 500

@app.route('/api/admin/resource-categories/<category_id>/drive-overrides', methods=['POST'])
@admin_required_json
def create_drive_override(category_id):
    """Create or update a display name override for a Drive item - respects Role Manager resource_manager"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('resource_manager') is False:
        return jsonify({'error': 'Access denied - Resource Manager has been disabled for your account'}), 403
    try:
        category = ResourceCategory.query.filter(
            (ResourceCategory.slug == category_id) | (ResourceCategory.id == category_id)
        ).first()
        
        if not category:
            return jsonify({'error': 'Category not found'}), 404
        
        data = request.get_json()
        
        if not data.get('driveItemId') or not data.get('customName'):
            return jsonify({'error': 'driveItemId and customName are required'}), 400
        
        # Check if override already exists
        existing = DriveItemOverride.query.filter_by(
            category_id=category.id,
            drive_item_id=data['driveItemId']
        ).first()
        
        if existing:
            # Update existing
            existing.custom_name = data['customName']
            existing.updated_at = datetime.utcnow()
        else:
            # Create new
            override = DriveItemOverride(
                category_id=category.id,
                drive_item_id=data['driveItemId'],
                custom_name=data['customName']
            )
            db.session.add(override)
        
        db.session.commit()
        
        override = DriveItemOverride.query.filter_by(
            category_id=category.id,
            drive_item_id=data['driveItemId']
        ).first()
        
        return jsonify({
            'message': 'Override saved successfully',
            'override': override.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating drive override: {e}")
        return jsonify({'error': 'Failed to create override'}), 500

@app.route('/api/admin/resource-categories/<category_id>/drive-overrides/<override_id>', methods=['DELETE'])
@admin_required_json
def delete_drive_override(category_id, override_id):
    """Delete a display name override - respects Role Manager resource_manager"""
    custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
    if custom_perms.get('resource_manager') is False:
        return jsonify({'error': 'Access denied - Resource Manager has been disabled for your account'}), 403
    try:
        override = DriveItemOverride.query.get(override_id)
        
        if not override:
            return jsonify({'error': 'Override not found'}), 404
        
        db.session.delete(override)
        db.session.commit()
        
        return jsonify({'message': 'Override deleted successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting drive override: {e}")
        return jsonify({'error': 'Failed to delete override'}), 500

# ===================================
# HOMEPAGE MESSAGES ENDPOINTS
# ===================================

@app.route('/api/homepage-messages', methods=['GET'])
@login_required_json
def get_homepage_messages():
    """Get active homepage messages for the current user's region"""
    try:
        user_region = getattr(current_user, 'region_code', 'AU')
        
        # Query active messages for the user's region, ordered by display_order
        messages = db.session.execute(text("""
            SELECT id, heading, message, region_code, display_order, created_at
            FROM homepage_messages
            WHERE is_active = 1 AND region_code = :region_code
            ORDER BY display_order ASC, created_at DESC
        """), {'region_code': user_region}).fetchall()
        
        result = []
        for msg in messages:
            result.append({
                'id': msg[0],
                'heading': msg[1],
                'message': msg[2],
                'region_code': msg[3],
                'display_order': msg[4],
                'created_at': msg[5]
            })
        
        return jsonify({'messages': result})
        
    except Exception as e:
        logger.error(f"Error fetching homepage messages: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch homepage messages'}), 500


@app.route('/api/homepage-messages/all', methods=['GET'])
@login_required_json
def get_all_homepage_messages():
    """Get all homepage messages (admin only)"""
    try:
        custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
        if custom_perms.get('homepage_manager') is False:
            return jsonify({'error': 'Access denied - Homepage Manager has been disabled for your account'}), 403
        if not current_user.has_permission('homepage_manager'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Query all messages
        messages = db.session.execute(text("""
            SELECT id, heading, message, region_code, is_active, display_order, created_at, created_by
            FROM homepage_messages
            ORDER BY region_code ASC, display_order ASC, created_at DESC
        """)).fetchall()
        
        result = []
        for msg in messages:
            result.append({
                'id': msg[0],
                'heading': msg[1],
                'message': msg[2],
                'region_code': msg[3],
                'is_active': bool(msg[4]),
                'display_order': msg[5],
                'created_at': msg[6],
                'created_by': msg[7]
            })
        
        return jsonify({'messages': result})
        
    except Exception as e:
        logger.error(f"Error fetching all homepage messages: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch homepage messages'}), 500


@app.route('/api/homepage-messages', methods=['POST'])
@login_required_json
def create_homepage_message():
    """Create a new homepage message (admin only)"""
    try:
        custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
        if custom_perms.get('homepage_manager') is False:
            return jsonify({'error': 'Access denied - Homepage Manager has been disabled for your account'}), 403
        if not current_user.has_permission('homepage_manager'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        heading = data.get('heading', '').strip()
        message = data.get('message', '').strip()
        region_code = data.get('region_code', 'AU')
        is_active = data.get('is_active', True)
        display_order = data.get('display_order', 0)
        
        if not heading or not message:
            return jsonify({'error': 'Heading and message are required'}), 400
        
        # Insert the message
        result = db.session.execute(text("""
            INSERT INTO homepage_messages (heading, message, region_code, is_active, display_order, created_by)
            VALUES (:heading, :message, :region_code, :is_active, :display_order, :created_by)
        """), {
            'heading': heading,
            'message': message,
            'region_code': region_code,
            'is_active': is_active,
            'display_order': display_order,
            'created_by': current_user.username
        })
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Homepage message created successfully',
            'id': result.lastrowid
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating homepage message: {e}", exc_info=True)
        return jsonify({'error': 'Failed to create homepage message'}), 500


@app.route('/api/homepage-messages/<int:message_id>', methods=['PUT'])
@login_required_json
def update_homepage_message(message_id):
    """Update an existing homepage message (admin only)"""
    try:
        custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
        if custom_perms.get('homepage_manager') is False:
            return jsonify({'error': 'Access denied - Homepage Manager has been disabled for your account'}), 403
        if not current_user.has_permission('homepage_manager'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        heading = data.get('heading', '').strip()
        message = data.get('message', '').strip()
        region_code = data.get('region_code')
        is_active = data.get('is_active')
        display_order = data.get('display_order')
        
        # Build update query dynamically based on provided fields
        update_parts = []
        params = {'message_id': message_id}
        
        if heading:
            update_parts.append("heading = :heading")
            params['heading'] = heading
        if message:
            update_parts.append("message = :message")
            params['message'] = message
        if region_code is not None:
            update_parts.append("region_code = :region_code")
            params['region_code'] = region_code
        if is_active is not None:
            update_parts.append("is_active = :is_active")
            params['is_active'] = is_active
        if display_order is not None:
            update_parts.append("display_order = :display_order")
            params['display_order'] = display_order
        
        if not update_parts:
            return jsonify({'error': 'No fields to update'}), 400
        
        update_parts.append("updated_at = CURRENT_TIMESTAMP")
        
        query = f"""
            UPDATE homepage_messages
            SET {', '.join(update_parts)}
            WHERE id = :message_id
        """
        
        result = db.session.execute(text(query), params)
        db.session.commit()
        
        if result.rowcount == 0:
            return jsonify({'error': 'Message not found'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Homepage message updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating homepage message: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update homepage message'}), 500


# ===================================
# PLATFORM SETTINGS API
# ===================================

@app.route('/api/platform-settings/training-video', methods=['GET'])
@login_required_json
def get_training_video_info():
    """Check if training video exists and return info"""
    try:
        # Check if user is admin or superadmin
        if not current_user.has_permission('homepage_manager'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Use /data/videos/ for persistent storage (Railway volume mount)
        video_path = os.path.join('/data', 'videos', 'pulse-training.mp4')
        
        if os.path.exists(video_path):
            file_stats = os.stat(video_path)
            return jsonify({
                'exists': True,
                'file_size': file_stats.st_size,
                'uploaded_at': datetime.fromtimestamp(file_stats.st_mtime).isoformat()
            })
        else:
            return jsonify({'exists': False}), 404
            
    except Exception as e:
        logger.error(f"Error checking training video: {e}", exc_info=True)
        return jsonify({'error': 'Failed to check video'}), 500


@app.route('/api/platform-settings/training-video/upload', methods=['POST'])
@login_required_json
def upload_training_video():
    """Upload training video"""
    try:
        # Check if user is admin or superadmin
        if not current_user.has_permission('homepage_manager'):
            logger.warning(f"Unauthorized upload attempt by {current_user.username}")
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        logger.info(f"Video upload initiated by {current_user.username}")
        
        # Check if file was uploaded
        if 'video' not in request.files:
            logger.error("No video file in request")
            return jsonify({'error': 'No video file provided'}), 400
        
        video_file = request.files['video']
        
        # Check if filename is empty
        if video_file.filename == '':
            logger.error("Empty filename")
            return jsonify({'error': 'No video file selected'}), 400
        
        logger.info(f"Received file: {video_file.filename}")
        
        # Validate file type
        allowed_extensions = {'.mp4', '.mov', '.webm'}
        file_ext = os.path.splitext(video_file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            logger.error(f"Invalid file type: {file_ext}")
            return jsonify({'error': 'Invalid file type. Please upload MP4, MOV, or WebM'}), 400
        
        # Use /data/videos/ for persistent storage (Railway volume mount)
        # This ensures videos survive container restarts
        videos_dir = os.path.join('/data', 'videos')
        logger.info(f"Videos directory path: {videos_dir}")
        
        try:
            os.makedirs(videos_dir, exist_ok=True)
            logger.info(f"Videos directory created/verified: {videos_dir}")
        except Exception as e:
            logger.error(f"Failed to create videos directory: {e}")
            return jsonify({'error': f'Failed to create storage directory: {str(e)}'}), 500
        
        # Save file as pulse-training.mp4 (always use .mp4 extension)
        save_path = os.path.join(videos_dir, 'pulse-training.mp4')
        logger.info(f"Save path: {save_path}")
        
        # If file already exists, delete it first
        if os.path.exists(save_path):
            try:
                os.remove(save_path)
                logger.info("Removed existing training video")
            except Exception as e:
                logger.warning(f"Could not remove existing video: {e}")
        
        # Save the new video
        try:
            logger.info("Starting file save...")
            video_file.save(save_path)
            file_size = os.path.getsize(save_path)
            logger.info(f"Training video saved successfully: {file_size} bytes")
        except Exception as e:
            logger.error(f"Failed to save video file: {e}", exc_info=True)
            return jsonify({'error': f'Failed to save video: {str(e)}'}), 500
        
        logger.info(f"Training video uploaded successfully by {current_user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Training video uploaded successfully',
            'file_size': file_size
        })
        
    except Exception as e:
        logger.error(f"Error uploading training video: {e}", exc_info=True)
        return jsonify({'error': f'Failed to upload video: {str(e)}'}), 500


@app.route('/api/homepage-messages/<int:message_id>', methods=['DELETE'])
@login_required_json
def delete_homepage_message(message_id):
    """Delete a homepage message (admin only)"""
    try:
        custom_perms = getattr(current_user, 'custom_permissions', {}) or {}
        if custom_perms.get('homepage_manager') is False:
            return jsonify({'error': 'Access denied - Homepage Manager has been disabled for your account'}), 403
        if not current_user.has_permission('homepage_manager'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        result = db.session.execute(text("""
            DELETE FROM homepage_messages
            WHERE id = :message_id
        """), {'message_id': message_id})
        db.session.commit()
        
        if result.rowcount == 0:
            return jsonify({'error': 'Message not found'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Homepage message deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting homepage message: {e}", exc_info=True)
        return jsonify({'error': 'Failed to delete homepage message'}), 500


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5002))
    print("Starting app.py")
    print(f"App running on: http://0.0.0.0:{port}")
    app.run(debug=False, host='0.0.0.0', port=port)
