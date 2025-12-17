"""
RBAC (Role-Based Access Control) Utilities
Provides decorators and functions for permission checking and campus scoping
"""

import functools
import yaml
import os
from typing import List, Dict, Any, Optional, Union
from flask import request, jsonify, current_app, g
from functools import wraps

# Load RBAC configuration
def load_rbac_config():
    """Load RBAC configuration from YAML file"""
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'roles.yaml')
    try:
        with open(config_path, 'r') as file:
            return yaml.safe_load(file)
    except FileNotFoundError:
        # Return default config if file doesn't exist
        return {
            'roles': {},
            'resources': {},
            'campus_scoping': {'enabled': False, 'resources': []}
        }

# Global RBAC config
RBAC_CONFIG = load_rbac_config()

class RBACManager:
    """Manages RBAC operations and permission checking"""
    
    def __init__(self):
        self.config = RBAC_CONFIG
        self.roles = self.config.get('roles', {})
        self.resources = self.config.get('resources', {})
        self.campus_scoping = self.config.get('campus_scoping', {})
    
    def has_permission(self, user_role: str, resource: str, action: str, custom_permissions: Optional[Dict] = None) -> bool:
        """Check if a user role has permission for a specific resource and action
        
        Args:
            user_role: The user's role
            resource: The resource being accessed
            action: The action being performed
            custom_permissions: Optional dict of custom permissions that override role defaults
        """
        # First check custom permissions if provided
        if custom_permissions is not None:
            # Custom permissions are stored as feature names (e.g., 'home', 'dashboard', 'tv_manager')
            # If a feature is in custom_permissions and set to True, user has access
            if resource in custom_permissions:
                return bool(custom_permissions[resource])
            # If explicitly set to False, deny access
            if resource in custom_permissions and custom_permissions[resource] is False:
                return False
        
        if not self.config:
            return True  # No RBAC config means allow all
        
        role_permissions = self.roles.get(user_role, {}).get('permissions', {})
        
        # Check for wildcard permission
        if '*' in role_permissions.get(resource, []):
            return True
        
        # Check for specific action permission
        if action in role_permissions.get(resource, []):
            return True
        
        # Check for action patterns (e.g., "view_own" matches "view")
        for perm in role_permissions.get(resource, []):
            if perm.startswith(action + '_'):
                return True
        
        return False
    
    def has_feature_access(self, user_role: str, feature: str, custom_permissions: Optional[Dict] = None) -> bool:
        """Check if a user has access to a specific feature/page
        
        Args:
            user_role: The user's role
            feature: The feature name (e.g., 'home', 'dashboard', 'tv_manager')
            custom_permissions: Optional dict of custom permissions
        """
        # First check custom permissions if provided
        if custom_permissions is not None:
            if feature in custom_permissions:
                return bool(custom_permissions[feature])
            if feature in custom_permissions and custom_permissions[feature] is False:
                return False
        
        # Map features to resources for role-based checking
        # For now, if no custom permission, check role defaults
        # This will be enhanced based on how features map to resources
        return True  # Default to allowing if no explicit deny
    
    def get_user_permissions(self, user_role: str) -> Dict[str, List[str]]:
        """Get all permissions for a specific user role"""
        if not self.config:
            return {}
        
        return self.roles.get(user_role, {}).get('permissions', {})
    
    def is_campus_scoped(self, resource: str) -> bool:
        """Check if a resource should be campus-scoped"""
        if not self.campus_scoping.get('enabled'):
            return False
        
        return resource in self.campus_scoping.get('resources', [])
    
    def can_cross_campus(self, user_role: str) -> bool:
        """Check if a user role can see data from all campuses"""
        cross_campus_roles = self.campus_scoping.get('cross_campus_roles', [])
        return user_role in cross_campus_roles

# Global RBAC manager instance
rbac_manager = RBACManager()

def require_perm(resource: str, action: str):
    """
    Decorator to require specific permissions for an endpoint
    
    Args:
        resource: The resource being accessed (e.g., 'groups', 'beacons')
        action: The action being performed (e.g., 'view', 'edit', '*')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current user from session
            user_role = getattr(g, 'user_role', 'member')
            
            # Check if RBAC is enabled
            if not rbac_manager.config:
                return f(*args, **kwargs)
            
            # Check permission
            if not rbac_manager.has_permission(user_role, resource, action):
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def scoped_query(resource: str):
    """
    Decorator to automatically scope queries by campus for campus-scoped resources
    
    Args:
        resource: The resource being queried
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current user info
            user_role = getattr(g, 'user_role', 'member')
            user_campus = getattr(g, 'user_campus', None)
            
            # Check if resource should be campus-scoped
            if not rbac_manager.is_campus_scoped(resource):
                return f(*args, **kwargs)
            
            # Check if user can cross campus boundaries
            if rbac_manager.can_cross_campus(user_role):
                return f(*args, **kwargs)
            
            # Add campus filter to kwargs
            if user_campus and user_campus != 'all_campuses':
                kwargs['campus_filter'] = user_campus
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_user_context():
    """Get current user context for RBAC operations"""
    return {
        'role': getattr(g, 'user_role', 'member'),
        'campus': getattr(g, 'user_campus', None),
        'user_id': getattr(g, 'user_id', None)
    }

def check_feature_flag(flag_name: str) -> bool:
    """Check if a feature flag is enabled"""
    try:
        from config.feature_flags import FeatureFlags
        return FeatureFlags.is_enabled(flag_name)
    except ImportError:
        return True  # Default to enabled if feature flags not available

def require_feature_flag(flag_name: str):
    """
    Decorator to require a feature flag to be enabled
    
    Args:
        flag_name: The name of the feature flag to check
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not check_feature_flag(flag_name):
                return jsonify({'error': 'Feature not available'}), 404
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Utility functions for common permission checks
def can_view_resource(user_role: str, resource: str) -> bool:
    """Check if user can view a resource"""
    return rbac_manager.has_permission(user_role, resource, 'view')

def can_edit_resource(user_role: str, resource: str) -> bool:
    """Check if user can edit a resource"""
    return rbac_manager.has_permission(user_role, resource, 'edit')

def can_create_resource(user_role: str, resource: str) -> bool:
    """Check if user can create a resource"""
    return rbac_manager.has_permission(user_role, resource, 'create')

def can_delete_resource(user_role: str, resource: str) -> bool:
    """Check if user can delete a resource"""
    return rbac_manager.has_permission(user_role, resource, 'delete')

def can_manage_resource(user_role: str, resource: str) -> bool:
    """Check if user has full management access to a resource"""
    return rbac_manager.has_permission(user_role, resource, '*')
