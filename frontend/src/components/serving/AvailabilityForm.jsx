import React, { useState, useEffect } from 'react';
import { CalendarIcon, ClockIcon, UserGroupIcon, CheckIcon } from '@heroicons/react/24/outline';

const AvailabilityForm = () => {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    preferred_days: [],
    preferred_times: [],
    preferred_teams: [],
    unavailable_dates: [],
    max_hours_per_week: '',
    max_servings_per_month: '',
    notes: ''
  });

  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  const timeSlots = [
    { value: 'morning', label: 'Morning (6 AM - 12 PM)' },
    { value: 'afternoon', label: 'Afternoon (12 PM - 6 PM)' },
    { value: 'evening', label: 'Evening (6 PM - 12 AM)' }
  ];

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/serving/availability', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }
      
      const data = await response.json();
      if (data.availability.length > 0) {
        setAvailability(data.availability[0]);
        setFormData({
          start_date: data.availability[0].start_date,
          end_date: data.availability[0].end_date || '',
          preferred_days: data.availability[0].preferred_days || [],
          preferred_times: data.availability[0].preferred_times || [],
          preferred_teams: data.availability[0].preferred_teams || [],
          unavailable_dates: data.availability[0].unavailable_dates || [],
          max_hours_per_week: data.availability[0].max_hours_per_week || '',
          max_servings_per_month: data.availability[0].max_servings_per_month || '',
          notes: data.availability[0].notes || ''
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await fetch('/api/serving/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save availability');
      }
      
      const data = await response.json();
      setAvailability(data.availability);
      setShowForm(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...prev.preferred_days, day]
    }));
  };

  const toggleTime = (time) => {
    setFormData(prev => ({
      ...prev,
      preferred_times: prev.preferred_times.includes(time)
        ? prev.preferred_times.filter(t => t !== time)
        : [...prev.preferred_times, time]
    }));
  };

  const addUnavailableDate = () => {
    const date = prompt('Enter unavailable date (YYYY-MM-DD):');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormData(prev => ({
        ...prev,
        unavailable_dates: [...prev.unavailable_dates, date]
      }));
    }
  };

  const removeUnavailableDate = (date) => {
    setFormData(prev => ({
      ...prev,
      unavailable_dates: prev.unavailable_dates.filter(d => d !== date)
    }));
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-slate-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">My Availability</h3>
            <p className="text-sm text-slate-400">Set your serving availability and preferences</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {showForm ? (
              <>
                <CheckIcon className="h-5 w-5 text-white" />
                <span className="text-white font-medium">Done</span>
              </>
            ) : (
              <>
                <CalendarIcon className="h-5 w-5 text-white" />
                <span className="text-white font-medium">Edit Availability</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-slate-400 mb-1">
                  Available From
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-slate-400 mb-1">
                  Available Until (Optional)
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty for ongoing availability"
                />
              </div>
            </div>

            {/* Preferred Days */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">
                Preferred Days
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {daysOfWeek.map((day) => (
                  <label key={day.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.preferred_days.includes(day.value)}
                      onChange={() => toggleDay(day.value)}
                      className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                    />
                    <span className="text-sm text-slate-300">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preferred Times */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">
                Preferred Times
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {timeSlots.map((time) => (
                  <label key={time.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.preferred_times.includes(time.value)}
                      onChange={() => toggleTime(time.value)}
                      className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                    />
                    <span className="text-sm text-slate-300">{time.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="max-hours" className="block text-sm font-medium text-slate-400 mb-1">
                  Max Hours Per Week (Optional)
                </label>
                <input
                  type="number"
                  id="max-hours"
                  value={formData.max_hours_per_week}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_hours_per_week: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 10"
                  min="0"
                  step="0.5"
                />
              </div>
              
              <div>
                <label htmlFor="max-servings" className="block text-sm font-medium text-slate-400 mb-1">
                  Max Servings Per Month (Optional)
                </label>
                <input
                  type="number"
                  id="max-servings"
                  value={formData.max_servings_per_month}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_servings_per_month: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 8"
                  min="0"
                />
              </div>
            </div>

            {/* Unavailable Dates */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">
                Unavailable Dates
              </label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={addUnavailableDate}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm transition-colors"
                >
                  + Add Unavailable Date
                </button>
                
                {formData.unavailable_dates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.unavailable_dates.map((date) => (
                      <span
                        key={date}
                        className="inline-flex items-center space-x-2 px-3 py-1 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300 text-sm"
                      >
                        <span>{new Date(date).toLocaleDateString()}</span>
                        <button
                          type="button"
                          onClick={() => removeUnavailableDate(date)}
                          className="text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-400 mb-1">
                Additional Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any special considerations or preferences..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg transition-colors text-white font-medium flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-5 w-5" />
                    <span>Save Availability</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Display Current Availability */
          <div className="space-y-6">
            {availability ? (
              <>
                {/* Current Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h4 className="font-medium text-white mb-3 flex items-center">
                      <CalendarIcon className="h-5 w-5 text-blue-400 mr-2" />
                      Availability Period
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">From:</span>
                        <span className="text-white">{new Date(availability.start_date).toLocaleDateString()}</span>
                      </div>
                      {availability.end_date && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Until:</span>
                          <span className="text-white">{new Date(availability.end_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h4 className="font-medium text-white mb-3 flex items-center">
                      <ClockIcon className="h-5 w-5 text-green-400 mr-2" />
                      Preferences
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Preferred Days:</span>
                        <span className="text-white">{availability.preferred_days?.length || 0} selected</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Preferred Times:</span>
                        <span className="text-white">{availability.preferred_times?.length || 0} selected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-3">Details</h4>
                  <div className="space-y-3 text-sm">
                    {availability.preferred_days?.length > 0 && (
                      <div>
                        <span className="text-slate-400">Preferred Days: </span>
                        <span className="text-white">
                          {availability.preferred_days.map(day => 
                            daysOfWeek.find(d => d.value === day)?.label
                          ).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {availability.preferred_times?.length > 0 && (
                      <div>
                        <span className="text-slate-400">Preferred Times: </span>
                        <span className="text-white">
                          {availability.preferred_times.map(time => 
                            timeSlots.find(t => t.value === time)?.label
                          ).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {availability.max_hours_per_week && (
                      <div>
                        <span className="text-slate-400">Max Hours Per Week: </span>
                        <span className="text-white">{availability.max_hours_per_week}</span>
                      </div>
                    )}
                    
                    {availability.max_servings_per_month && (
                      <div>
                        <span className="text-slate-400">Max Servings Per Month: </span>
                        <span className="text-white">{availability.max_servings_per_month}</span>
                      </div>
                    )}
                    
                    {availability.unavailable_dates?.length > 0 && (
                      <div>
                        <span className="text-slate-400">Unavailable Dates: </span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {availability.unavailable_dates.map(date => (
                            <span key={date} className="px-2 py-1 bg-red-900/20 border border-red-500/50 rounded text-red-300 text-xs">
                              {new Date(date).toLocaleDateString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {availability.notes && (
                      <div>
                        <span className="text-slate-400">Notes: </span>
                        <span className="text-white">{availability.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-400 mb-2">No availability set</h4>
                <p className="text-slate-500">Set your availability preferences to help team leaders schedule you effectively.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailabilityForm;
