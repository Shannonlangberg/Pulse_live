"""
Campus Scoping Utilities
Provides functions to filter data based on campus and region permissions and RBAC rules
"""

from typing import Dict, List, Any, Optional
from utils.rbac import rbac_manager, get_user_context, validate_region_access

def apply_campus_filter(query, resource: str, user_role: str = None, user_campus: str = None):
    """
    Apply campus filtering to a database query
    
    Args:
        query: SQLAlchemy query object
        resource: The resource being queried
        user_role: User's role (optional, will be fetched from context if not provided)
        user_campus: User's campus (optional, will be fetched from context if not provided)
    
    Returns:
        Filtered query object
    """
    if not user_role or not user_campus:
        context = get_user_context()
        user_role = user_role or context.get('role', 'member')
        user_campus = user_campus or context.get('campus')
    
    # Check if resource should be campus-scoped
    if not rbac_manager.is_campus_scoped(resource):
        return query
    
    # Check if user can cross campus boundaries
    if rbac_manager.can_cross_campus(user_role):
        return query
    
    # Apply campus filter
    if user_campus and user_campus != 'all_campuses':
        # Handle different model structures
        if hasattr(query.model, 'campus'):
            query = query.filter(query.model.campus == user_campus)
        elif hasattr(query.model, 'campus_id'):
            query = query.filter(query.model.campus_id == user_campus)
        elif hasattr(query.model, 'person'):
            # For models that link to Person
            query = query.join(query.model.person).filter(
                query.model.person.campus == user_campus
            )
    
    return query

def filter_by_campus(data: List[Dict], resource: str, user_role: str = None, user_campus: str = None) -> List[Dict]:
    """
    Filter a list of dictionaries by campus permissions
    
    Args:
        data: List of data dictionaries
        resource: The resource being filtered
        user_role: User's role (optional)
        user_campus: User's campus (optional)
    
    Returns:
        Filtered list of data
    """
    if not user_role or not user_campus:
        context = get_user_context()
        user_role = user_role or context.get('role', 'member')
        user_campus = user_campus or context.get('campus')
    
    # Check if resource should be campus-scoped
    if not rbac_manager.is_campus_scoped(resource):
        return data
    
    # Check if user can cross campus boundaries
    if rbac_manager.can_cross_campus(user_role):
        return data
    
    # Apply campus filter
    if user_campus and user_campus != 'all_campuses':
        filtered_data = []
        for item in data:
            # Handle different data structures
            if isinstance(item, dict):
                if item.get('campus') == user_campus:
                    filtered_data.append(item)
                elif item.get('campus_id') == user_campus:
                    filtered_data.append(item)
                elif 'person' in item and item['person'].get('campus') == user_campus:
                    filtered_data.append(item)
            else:
                # Handle SQLAlchemy model objects
                if hasattr(item, 'campus') and item.campus == user_campus:
                    filtered_data.append(item)
                elif hasattr(item, 'campus_id') and item.campus_id == user_campus:
                    filtered_data.append(item)
                elif hasattr(item, 'person') and item.person and item.person.campus == user_campus:
                    filtered_data.append(item)
        
        return filtered_data
    
    return data

def get_campus_filter_params(resource: str, user_role: str = None, user_campus: str = None) -> Dict[str, Any]:
    """
    Get campus filter parameters for building queries
    
    Args:
        resource: The resource being queried
        user_role: User's role (optional)
        user_campus: User's campus (optional)
    
    Returns:
        Dictionary with filter parameters
    """
    if not user_role or not user_campus:
        context = get_user_context()
        user_role = user_role or context.get('role', 'member')
        user_campus = user_campus or context.get('campus')
    
    filter_params = {}
    
    # Check if resource should be campus-scoped
    if not rbac_manager.is_campus_scoped(resource):
        return filter_params
    
    # Check if user can cross campus boundaries
    if rbac_manager.can_cross_campus(user_role):
        return filter_params
    
    # Add campus filter
    if user_campus and user_campus != 'all_campuses':
        filter_params['campus'] = user_campus
        filter_params['campus_id'] = user_campus
    
    return filter_params

def validate_campus_access(resource: str, target_campus: str, user_role: str = None, user_campus: str = None) -> bool:
    """
    Validate if a user can access data from a specific campus
    
    Args:
        resource: The resource being accessed
        target_campus: The campus of the target data
        user_role: User's role (optional)
        user_campus: User's campus (optional)
    
    Returns:
        True if access is allowed, False otherwise
    """
    if not user_role or not user_campus:
        context = get_user_context()
        user_role = user_role or context.get('role', 'member')
        user_campus = user_campus or context.get('campus')
    
    # Check if resource should be campus-scoped
    if not rbac_manager.is_campus_scoped(resource):
        return True
    
    # Check if user can cross campus boundaries
    if rbac_manager.can_cross_campus(user_role):
        return True
    
    # Check if user's campus matches target campus
    if user_campus == target_campus:
        return True
    
    # Check if user has access to all campuses
    if user_campus == 'all_campuses':
        return True
    
    return False

# Campus scoping for specific resources
def scope_groups_query(query, user_role: str = None, user_campus: str = None):
    """Apply campus scoping to groups queries"""
    return apply_campus_filter(query, 'groups', user_role, user_campus)

def scope_devotions_query(query, user_role: str = None, user_campus: str = None):
    """Apply campus scoping to devotions queries"""
    return apply_campus_filter(query, 'devotions_admin', user_role, user_campus)

def scope_serving_query(query, user_role: str = None, user_campus: str = None):
    """Apply campus scoping to serving queries"""
    return apply_campus_filter(query, 'serving', user_role, user_campus)

def scope_events_query(query, user_role: str = None, user_campus: str = None):
    """Apply campus scoping to events queries"""
    return apply_campus_filter(query, 'events', user_role, user_campus)

def scope_prayer_requests_query(query, user_role: str = None, user_campus: str = None):
    """Apply campus scoping to prayer requests queries"""
    return apply_campus_filter(query, 'prayer_requests', user_role, user_campus)

# Region scoping functions
def apply_region_filter(query, resource: str, user_role: str = None, user_region_id: int = None):
    """
    Apply region filtering to a database query
    
    Args:
        query: SQLAlchemy query object
        resource: The resource being queried
        user_role: User's role (optional, will be fetched from context if not provided)
        user_region_id: User's region ID (optional, will be fetched from context if not provided)
    
    Returns:
        Filtered query object
    """
    if not user_role or user_region_id is None:
        context = get_user_context()
        user_role = user_role or context.get('role', 'member')
        user_region_id = user_region_id if user_region_id is not None else context.get('region_id')
    
    # Check if resource should be region-scoped
    if not rbac_manager.is_region_scoped(resource):
        return query
    
    # Check if user can cross region boundaries
    if rbac_manager.can_cross_region(user_role):
        return query
    
    # Apply region filter
    if user_region_id is not None:
        # Handle different model structures
        if hasattr(query.model, 'region_id'):
            query = query.filter(query.model.region_id == user_region_id)
        elif hasattr(query.model, 'campus'):
            # Join with campus to filter by region
            from models import CampusV2
            query = query.join(CampusV2, query.model.campus_id == CampusV2.campus_id)
            query = query.filter(CampusV2.region_id == user_region_id)
    
    return query

def get_region_filter_params(resource: str, user_role: str = None, user_region_id: int = None) -> Dict[str, Any]:
    """
    Get region filter parameters for building queries
    
    Args:
        resource: The resource being queried
        user_role: User's role (optional)
        user_region_id: User's region ID (optional)
    
    Returns:
        Dictionary with filter parameters
    """
    if not user_role or user_region_id is None:
        context = get_user_context()
        user_role = user_role or context.get('role', 'member')
        user_region_id = user_region_id if user_region_id is not None else context.get('region_id')
    
    filter_params = {}
    
    # Check if resource should be region-scoped
    if not rbac_manager.is_region_scoped(resource):
        return filter_params
    
    # Check if user can cross region boundaries
    if rbac_manager.can_cross_region(user_role):
        return filter_params
    
    # Add region filter
    if user_region_id is not None:
        filter_params['region_id'] = user_region_id
    
    return filter_params

def filter_by_region(data: List[Dict], resource: str, user_role: str = None, user_region_id: int = None) -> List[Dict]:
    """
    Filter a list of dictionaries by region permissions
    
    Args:
        data: List of data dictionaries
        resource: The resource being filtered
        user_role: User's role (optional)
        user_region_id: User's region ID (optional)
    
    Returns:
        Filtered list of data
    """
    if not user_role or user_region_id is None:
        context = get_user_context()
        user_role = user_role or context.get('role', 'member')
        user_region_id = user_region_id if user_region_id is not None else context.get('region_id')
    
    # Check if resource should be region-scoped
    if not rbac_manager.is_region_scoped(resource):
        return data
    
    # Check if user can cross region boundaries
    if rbac_manager.can_cross_region(user_role):
        return data
    
    # Apply region filter
    if user_region_id is not None:
        filtered_data = []
        for item in data:
            # Handle different data structures
            if isinstance(item, dict):
                if item.get('region_id') == user_region_id:
                    filtered_data.append(item)
                elif 'campus' in item and item.get('campus', {}).get('region_id') == user_region_id:
                    filtered_data.append(item)
            else:
                # Handle SQLAlchemy model objects
                if hasattr(item, 'region_id') and item.region_id == user_region_id:
                    filtered_data.append(item)
                elif hasattr(item, 'campus') and item.campus and hasattr(item.campus, 'region_id') and item.campus.region_id == user_region_id:
                    filtered_data.append(item)
        
        return filtered_data
    
    return data
