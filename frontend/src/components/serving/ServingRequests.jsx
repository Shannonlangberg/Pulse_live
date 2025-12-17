import React, { useState, useEffect } from 'react';
import { PlusIcon, ClockIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ServingRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    request_type: 'sign_up',
    team_id: '',
    schedule_id: '',
    requested_date: '',
    start_time: '',
    end_time: '',
    reason: '',
    notes: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/serving/requests', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }
      
      const data = await response.json();
      setRequests(data.requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/serving/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newRequest)
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit request');
      }
      
      const data = await response.json();
      setRequests(prev => [data.request, ...prev]);
      setShowNewRequestForm(false);
      setNewRequest({
        request_type: 'sign_up',
        team_id: '',
        schedule_id: '',
        requested_date: '',
        start_time: '',
        end_time: '',
        reason: '',
        notes: ''
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const getRequestTypeIcon = (type) => {
    switch (type) {
      case 'sign_up':
        return <PlusIcon className="h-5 w-5 text-blue-400" />;
      case 'time_off':
        return <XMarkIcon className="h-5 w-5 text-red-400" />;
      case 'swap':
        return <ClockIcon className="h-5 w-5 text-yellow-400" />;
      default:
        return <PlusIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getRequestTypeText = (type) => {
    switch (type) {
      case 'sign_up':
        return 'Sign Up';
      case 'time_off':
        return 'Time Off Request';
      case 'swap':
        return 'Swap Request';
      default:
        return type.replace('_', ' ');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-700 rounded w-1/3"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Requests</h3>
        <p className="text-red-300">{error}</p>
        <button 
          onClick={fetchRequests}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with New Request Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">My Serving Requests</h3>
          <p className="text-slate-400">Manage your serving requests and time-off</p>
        </div>
        <button
          onClick={() => setShowNewRequestForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <span className="text-white font-medium">New Request</span>
        </button>
      </div>

      {/* New Request Form */}
      {showNewRequestForm && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-white">New Request</h4>
            <button
              onClick={() => setShowNewRequestForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="request-type" className="block text-sm font-medium text-slate-400 mb-1">
                  Request Type
                </label>
                <select
                  id="request-type"
                  value={newRequest.request_type}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, request_type: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="sign_up">Sign Up to Serve</option>
                  <option value="time_off">Request Time Off</option>
                  <option value="swap">Request Swap</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="team-id" className="block text-sm font-medium text-slate-400 mb-1">
                  Team
                </label>
                <select
                  id="team-id"
                  value={newRequest.team_id}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, team_id: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a team</option>
                  {/* Team options would be populated from API */}
                  <option value="kids-team-cc">Kids Ministry - Copper Coast</option>
                  <option value="worship-team-cc">Worship Team - Copper Coast</option>
                  <option value="hospitality-team-cc">Hospitality - Copper Coast</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="requested-date" className="block text-sm font-medium text-slate-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  id="requested-date"
                  value={newRequest.requested_date}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, requested_date: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="start-time" className="block text-sm font-medium text-slate-400 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  id="start-time"
                  value={newRequest.start_time}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, start_time: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="end-time" className="block text-sm font-medium text-slate-400 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  id="end-time"
                  value={newRequest.end_time}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, end_time: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-slate-400 mb-1">
                Reason
              </label>
              <input
                type="text"
                id="reason"
                value={newRequest.reason}
                onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief reason for your request"
              />
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-400 mb-1">
                Additional Notes
              </label>
              <textarea
                id="notes"
                value={newRequest.notes}
                onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional information..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowNewRequestForm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-medium"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Request History</h3>
          <p className="text-sm text-slate-400">
            {requests.length} request{requests.length !== 1 ? 's' : ''} found
          </p>
        </div>
        
        <div className="p-6">
          {requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        {getRequestTypeIcon(request.request_type)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{getRequestTypeText(request.request_type)}</p>
                        <p className="text-sm text-slate-400">{request.team_name}</p>
                        {request.requested_date && (
                          <p className="text-sm text-slate-400">
                            {new Date(request.requested_date).toLocaleDateString()}
                            {request.start_time && request.end_time && (
                              <span> • {request.start_time} - {request.end_time}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      
                      <div className="text-right text-sm text-slate-400">
                        <p>{new Date(request.created_at).toLocaleDateString()}</p>
                        {request.approved_at && (
                          <p className="text-xs">
                            {request.status === 'approved' ? 'Approved' : 'Denied'} on{' '}
                            {new Date(request.approved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {(request.reason || request.notes) && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      {request.reason && (
                        <p className="text-sm text-slate-300 mb-2">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                      )}
                      {request.notes && (
                        <p className="text-sm text-slate-400">{request.notes}</p>
                      )}
                    </div>
                  )}
                  
                  {request.approval_notes && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <p className="text-sm text-slate-400">
                        <span className="font-medium">Response:</span> {request.approval_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <PlusIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">No requests yet</h3>
              <p className="text-slate-500">You haven't submitted any serving requests yet.</p>
              <p className="text-slate-500 mt-2">Click "New Request" above to get started!</p>
            </div>
          )}
        </div>
      </div>

      {/* Request Tips */}
      <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Request Tips</h4>
            <ul className="text-blue-300 space-y-1 text-sm">
              <li>• Submit requests at least 48 hours in advance when possible</li>
              <li>• Be specific about dates and times you're available</li>
              <li>• Include a clear reason for time-off requests</li>
              <li>• Team leaders will review and respond to your requests</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServingRequests;
