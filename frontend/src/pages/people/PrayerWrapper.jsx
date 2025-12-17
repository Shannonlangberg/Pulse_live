import React, { useEffect } from 'react';
import PastoralCare from './PastoralCare';
import { useSearchParams } from 'react-router-dom';

/**
 * Wrapper component that renders Pastoral Care page with prayer tab active.
 * This ensures /prayer shows the full-featured prayer management integrated with Heartbeat.
 */
const PrayerWrapper = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Force the tab to 'prayer' immediately when component mounts
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab !== 'prayer') {
      setSearchParams({ tab: 'prayer' }, { replace: true });
    }
  }, []); // Only run on mount
  
  // Render PastoralCare directly - it will read the tab parameter
  return <PastoralCare />;
};

export default PrayerWrapper;

