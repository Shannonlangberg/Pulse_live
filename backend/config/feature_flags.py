import os


# Feature Flags Configuration
# Controls which features are enabled in the system


def _as_bool(value, default):
    """
    Convert an environment variable value to bool.
    
    Args:
        value: The raw string value
        default: The default boolean if value is None
    """
    if value is None:
        return default
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


class FeatureFlags:
    """Feature flags for controlling system functionality"""
    
    # Devotions Management
    DEVOTIONS_ADMIN_ENABLED = _as_bool(os.environ.get('DEVOTIONS_ADMIN_ENABLED'), True)
    
    # Connect Groups for Staff
    GROUPS_FOR_STAFF_ENABLED = _as_bool(os.environ.get('GROUPS_FOR_STAFF_ENABLED'), True)
    
    # Beacon Management
    BEACON_MGMT_ENABLED = _as_bool(os.environ.get('BEACON_MGMT_ENABLED'), False)
    
    # Heartbeat dashboards and endpoints
    HEARTBEAT_ENABLED = _as_bool(os.environ.get('HEARTBEAT_ENABLED'), False)
    
    # People directory and management
    PEOPLE_ENABLED = _as_bool(os.environ.get('PEOPLE_ENABLED'), True)
    
    # RBAC System
    RBAC_ENABLED = _as_bool(os.environ.get('RBAC_ENABLED'), True)
    
    # Campus Scoping
    CAMPUS_SCOPING_ENABLED = _as_bool(os.environ.get('CAMPUS_SCOPING_ENABLED'), True)
    
    @classmethod
    def get_all_flags(cls):
        """Get all feature flags as a dictionary"""
        return {
            'DEVOTIONS_ADMIN_ENABLED': cls.DEVOTIONS_ADMIN_ENABLED,
            'GROUPS_FOR_STAFF_ENABLED': cls.GROUPS_FOR_STAFF_ENABLED,
            'BEACON_MGMT_ENABLED': cls.BEACON_MGMT_ENABLED,
            'HEARTBEAT_ENABLED': cls.HEARTBEAT_ENABLED,
            'PEOPLE_ENABLED': cls.PEOPLE_ENABLED,
            'RBAC_ENABLED': cls.RBAC_ENABLED,
            'CAMPUS_SCOPING_ENABLED': cls.CAMPUS_SCOPING_ENABLED
        }
    
    @classmethod
    def is_enabled(cls, flag_name):
        """Check if a specific feature flag is enabled"""
        return getattr(cls, flag_name, False)
