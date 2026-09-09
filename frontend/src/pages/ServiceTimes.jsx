import React, { useEffect, useState } from 'react';
import { ClockIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useSession } from '../lib/useSession';

// Manage service times for the campuses the signed-in user can access.
// /api/campuses is already scoped per-user (role, assigned campus,
// allowed_campuses), so campus pastors only ever see their own campuses here.
const ServiceTimes = () => {
  const session = useSession();
  const [campuses, setCampuses] = useState([]);
  const [times, setTimes] = useState({});        // campus_id -> [..]
  const [newTime, setNewTime] = useState({});    // campus_id -> draft text
  const [saving, setSaving] = useState({});      // campus_id -> bool
  const [saved, setSaved] = useState({});        // campus_id -> bool (flash)
  const [errors, setErrors] = useState({});      // campus_id -> message
  const [loading, setLoading] = useState(true);

  const loadCampuses = async () => {
    try {
      const res = await fetch('/api/campuses', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      const rows = (data.campuses || []).filter(c => c.id !== 'all_campuses');
      setCampuses(rows);
      const t = {};
      rows.forEach(c => { t[c.id] = Array.isArray(c.service_times) ? c.service_times : []; });
      setTimes(t);
    } catch (e) {
      console.error('Failed to load campuses', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCampuses(); }, []);

  const addTime = (campusId) => {
    const draft = (newTime[campusId] || '').trim();
    if (!draft) return;
    setTimes(prev => {
      const list = prev[campusId] || [];
      if (list.includes(draft)) return prev;
      return { ...prev, [campusId]: [...list, draft] };
    });
    setNewTime(prev => ({ ...prev, [campusId]: '' }));
  };

  const removeTime = (campusId, time) => {
    setTimes(prev => ({ ...prev, [campusId]: (prev[campusId] || []).filter(t => t !== time) }));
  };

  const save = async (campusId) => {
    setSaving(prev => ({ ...prev, [campusId]: true }));
    setErrors(prev => ({ ...prev, [campusId]: '' }));
    try {
      const res = await fetch('/api/service-times', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campus: campusId, service_times: times[campusId] || [] })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrors(prev => ({ ...prev, [campusId]: data.error || 'Failed to save service times' }));
        return;
      }
      setTimes(prev => ({ ...prev, [campusId]: data.service_times }));
      setSaved(prev => ({ ...prev, [campusId]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [campusId]: false })), 2500);
    } catch (e) {
      setErrors(prev => ({ ...prev, [campusId]: 'Failed to save service times' }));
    } finally {
      setSaving(prev => ({ ...prev, [campusId]: false }));
    }
  };

  if (!session.loading && session.authenticated && session.permissions.log_stats === false) {
    return (
      <div className="min-h-screen bg-fc-cream p-8">
        <div className="fc-card p-8 max-w-lg mx-auto text-center">
          <p className="text-fc-brown m-0">You don't have access to manage service times.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-cream">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 py-10">
        <div className="fc-label mb-2">Settings</div>
        <h1 className="fc-display fc-display-md mb-2">Service times</h1>
        <p className="text-fc-brown text-[15px] mb-8 max-w-xl">
          The services your campus runs each weekend. Stats Input builds its
          entry fields from this list, and kids counts get a matching field for
          every service automatically.
        </p>

        {loading ? (
          <div className="fc-card p-8 text-center text-fc-brown">Loading campuses…</div>
        ) : campuses.length === 0 ? (
          <div className="fc-card p-8 text-center text-fc-brown">No campuses assigned to your account.</div>
        ) : (
          <div className="space-y-6">
            {campuses.map(campus => (
              <div key={campus.id} className="fc-card p-6 border-l-[3px] border-fc-olive">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl text-fc-midnight m-0">{campus.name}</h2>
                  <ClockIcon className="w-5 h-5 text-fc-thistle" />
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {(times[campus.id] || []).length === 0 && (
                    <span className="text-sm text-fc-thistle italic">No service times set — add one below.</span>
                  )}
                  {(times[campus.id] || []).map(time => (
                    <span key={time} className="inline-flex items-center gap-1.5 bg-fc-wash-mint border border-fc-wash-mint-border rounded-full pl-3.5 pr-2 py-1.5 text-sm text-fc-midnight">
                      {time}
                      <button
                        type="button"
                        aria-label={`Remove ${time}`}
                        onClick={() => removeTime(campus.id, time)}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-fc-brown hover:bg-fc-wash-mint-border/60 transition-colors"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="fc-input !w-40"
                    placeholder="e.g. 9:00 AM"
                    value={newTime[campus.id] || ''}
                    onChange={(e) => setNewTime(prev => ({ ...prev, [campus.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTime(campus.id); } }}
                  />
                  <button type="button" onClick={() => addTime(campus.id)} className="fc-btn-secondary">
                    <PlusIcon className="w-4 h-4" /> Add
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => save(campus.id)}
                    disabled={saving[campus.id]}
                    className="fc-btn-primary"
                  >
                    {saving[campus.id] ? 'Saving…' : saved[campus.id] ? (<><CheckIcon className="w-4 h-4" /> Saved</>) : 'Save'}
                  </button>
                </div>

                {errors[campus.id] && (
                  <p className="text-fc-copper text-sm mt-3 mb-0">{errors[campus.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceTimes;
