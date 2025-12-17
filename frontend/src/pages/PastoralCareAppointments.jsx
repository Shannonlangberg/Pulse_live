import React, { useState, useEffect } from 'react';
import { CalendarIcon, ClockIcon, MapPinIcon, UserIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import ScheduleCatchUpModal from '../components/ScheduleCatchUpModal';

const PastoralCareAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('upcoming'); // 'upcoming', 'all', 'past'
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, [filter]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filter === 'upcoming') {
        params.append('upcoming_only', 'true');
      } else if (filter === 'past') {
        const endDate = new Date().toISOString();
        params.append('end_date', endDate);
      }

      const response = await fetch(`/api/pastoral-care/appointments?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const data = await response.json();
      
      // Sort by date
      const sorted = data.appointments.sort((a, b) => {
        return new Date(a.scheduled_date) - new Date(b.scheduled_date);
      });
      
      setAppointments(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleClick = (personId, personName) => {
    setSelectedPerson({ id: personId, name: personName });
    setShowScheduleModal(true);
  };

  const handleAppointmentCreated = () => {
    fetchAppointments();
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const response = await fetch(`/api/pastoral-care/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update appointment');
      }

      fetchAppointments();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const configs = {
      scheduled: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', label: 'Scheduled' },
      confirmed: { color: 'bg-green-500/20 text-green-300 border-green-500/40', label: 'Confirmed' },
      completed: { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'Completed' },
      cancelled: { color: 'bg-red-500/20 text-red-300 border-red-500/40', label: 'Cancelled' },
      no_show: { color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'No Show' }
    };

    const config = configs[status] || configs.scheduled;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getLocationIcon = (location) => {
    const icons = {
      office: '🏢',
      coffee_shop: '☕',
      home: '🏠',
      church: '⛪',
      online: '💻',
      other: '📍'
    };
    return icons[location] || '📍';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-400">Loading appointments...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <CalendarIcon className="w-10 h-10 text-blue-500" />
                Pastoral Care Appointments
              </h1>
              <p className="text-slate-400">Schedule and manage catch-ups</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'upcoming'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'past'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Past
          </button>
        </div>

        {/* Appointments List */}
        {appointments.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
            <CalendarIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No appointments found</p>
            <p className="text-slate-500 text-sm mt-2">
              {filter === 'upcoming' && 'No upcoming appointments scheduled'}
              {filter === 'all' && 'No appointments have been scheduled yet'}
              {filter === 'past' && 'No past appointments'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-white">{appointment.title}</h3>
                      {getStatusBadge(appointment.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-slate-400" />
                        <span>{appointment.person_name || 'Unknown'}</span>
                      </div>

                      {appointment.pastor_name && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Pastor:</span>
                          <span>{appointment.pastor_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-slate-400" />
                        <span>{formatDate(appointment.scheduled_date)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-slate-400" />
                        <span>
                          {formatTime(appointment.scheduled_date)} ({appointment.duration_minutes} min)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-5 h-5 text-slate-400" />
                        <span>
                          {getLocationIcon(appointment.location)} {appointment.location.replace('_', ' ')}
                        </span>
                      </div>

                      {appointment.location_details && (
                        <div className="text-sm text-slate-400">
                          {appointment.location_details}
                        </div>
                      )}
                    </div>

                    {appointment.description && (
                      <div className="mt-4 text-slate-400 text-sm">
                        {appointment.description}
                      </div>
                    )}

                    {appointment.appointment_type && (
                      <div className="mt-3">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">
                          {appointment.appointment_type.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    {appointment.status === 'scheduled' && (
                      <button
                        onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                        className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm transition-colors flex items-center gap-2"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Confirm
                      </button>
                    )}
                    {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                      <button
                        onClick={() => handleStatusChange(appointment.id, 'completed')}
                        className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm transition-colors"
                      >
                        Complete
                      </button>
                    )}
                    {appointment.status !== 'cancelled' && (
                      <button
                        onClick={() => handleStatusChange(appointment.id, 'cancelled')}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors flex items-center gap-2"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedPerson && (
        <ScheduleCatchUpModal
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedPerson(null);
          }}
          personId={selectedPerson.id}
          personName={selectedPerson.name}
          onSuccess={handleAppointmentCreated}
        />
      )}
    </div>
  );
};

export default PastoralCareAppointments;


