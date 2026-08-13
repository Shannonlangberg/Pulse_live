import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BuildingOfficeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  GlobeAltIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const CampusManagement = () => {
  const navigate = useNavigate();
  const [regions, setRegions] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampus, setEditingCampus] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [userRole, setUserRole] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    region_id: 1,
    pastor_name: '',
    pastor_email: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    service_times: [''],
    active: true,
    notes: ''
  });

  // Check user authorization first
  useEffect(() => {
    checkAuthorization();
  }, []);

  useEffect(() => {
    if (userRole && !checkingAuth) {
      fetchRegions();
      fetchCampuses();
    }
  }, [userRole, checkingAuth]);

  const checkAuthorization = async () => {
    try {
      const response = await fetch('/api/session', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const role = data.role || 'member';
        
        // Only allow admin and leadership roles to access Campus Management
        const allowedRoles = ['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor'];
        
        if (!allowedRoles.includes(role)) {
          // Redirect unauthorized users to their profile
          console.warn('[CampusManagement] Unauthorized access attempt by role:', role);
          navigate('/profile', { replace: true });
          return;
        }
        
        setUserRole(role);
        setCheckingAuth(false);
      } else {
        // Session failed - redirect to login
        navigate('/login', { replace: true });
      }
    } catch (err) {
      console.error('[CampusManagement] Authorization check failed:', err);
      navigate('/profile', { replace: true });
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await fetch('/api/v2/regions');
      if (response.ok) {
        const data = await response.json();
        setRegions(data.regions || []);
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const fetchCampuses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v2/campuses', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleServiceTimeChange = (index, value) => {
    const newServiceTimes = [...formData.service_times];
    newServiceTimes[index] = value;
    setFormData(prev => ({ ...prev, service_times: newServiceTimes }));
  };

  const addServiceTime = () => {
    setFormData(prev => ({
      ...prev,
      service_times: [...prev.service_times, '']
    }));
  };

  const removeServiceTime = (index) => {
    const newServiceTimes = formData.service_times.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, service_times: newServiceTimes }));
  };

  const openCreateModal = () => {
    setEditingCampus(null);
    setFormData({
      name: '',
      display_name: '',
      region_id: 1,
      pastor_name: '',
      pastor_email: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      service_times: [''],
      active: true,
      notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (campus) => {
    setEditingCampus(campus);
    setFormData({
      name: campus.name,
      display_name: campus.display_name,
      region_id: campus.region_id,
      pastor_name: campus.pastor_name || '',
      pastor_email: campus.pastor_email || '',
      address: campus.address || '',
      city: campus.city || '',
      state: campus.state || '',
      postal_code: campus.postal_code || '',
      country: campus.country || '',
      service_times: campus.service_times.length > 0 ? campus.service_times : [''],
      active: campus.active,
      notes: campus.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingCampus 
        ? `/api/v2/campuses/${editingCampus.campus_id}`
        : '/api/v2/campuses';
      
      const method = editingCampus ? 'PUT' : 'POST';
      
      // Filter out empty service times
      const cleanedData = {
        ...formData,
        service_times: formData.service_times.filter(t => t.trim() !== '')
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(cleanedData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchCampuses();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save campus');
      }
    } catch (error) {
      console.error('Error saving campus:', error);
      alert('Failed to save campus');
    }
  };

  const handleDelete = async (campus) => {
    if (!confirm(`Are you sure you want to delete ${campus.display_name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v2/campuses/${campus.campus_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchCampuses();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete campus');
      }
    } catch (error) {
      console.error('Error deleting campus:', error);
      alert('Failed to delete campus');
    }
  };

  const filteredCampuses = selectedRegion === 'all'
    ? campuses
    : campuses.filter(c => c.region_id === parseInt(selectedRegion));

  const getCampusesByRegion = () => {
    const grouped = {};
    regions.forEach(region => {
      grouped[region.id] = campuses.filter(c => c.region_id === region.id);
    });
    return grouped;
  };

  const campusesByRegion = getCampusesByRegion();

  // Show loading while checking authorization
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-fc-cream p-6 flex items-center justify-center">
        <div className="text-center">
          <BuildingOfficeIcon className="w-16 h-16 text-fc-copper mx-auto mb-4 animate-pulse" />
          <div className="text-fc-midnight text-xl">Checking authorization...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-fc-cream p-6 flex items-center justify-center">
        <div className="text-fc-midnight text-xl">Loading campuses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fc-cream p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-fc-midnight mb-2">Campus Management</h1>
            <p className="text-fc-brown">Manage church campuses across all regions</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fc-copper to-fc-copper text-fc-midnight rounded-xl font-semibold hover:shadow-lg hover:shadow-card transition-all"
          >
            <PlusIcon className="w-5 h-5" />
            Add Campus
          </button>
        </div>

        {/* Region Filter */}
        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={() => setSelectedRegion('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedRegion === 'all'
                ? 'bg-white/20 text-fc-midnight shadow-lg'
                : 'bg-white/5 text-fc-brown hover:bg-fc-cream2'
            }`}
          >
            All Regions ({campuses.length})
          </button>
          {regions.map(region => (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id.toString())}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedRegion === region.id.toString()
                  ? 'bg-white/20 text-fc-midnight shadow-lg'
                  : 'bg-white/5 text-fc-brown hover:bg-fc-cream2'
              }`}
            >
              <span className="flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4" />
                {region.display_name} ({campusesByRegion[region.id]?.length || 0})
                {region.coming_soon && (
                  <span className="text-xs bg-fc-copper/30 px-2 py-0.5 rounded">Coming Soon</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Campuses Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center text-fc-brown py-20">Loading campuses...</div>
        ) : filteredCampuses.length === 0 ? (
          <div className="text-center text-fc-brown py-20">
            No campuses found. Click "Add Campus" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampuses.map(campus => (
              <div
                key={campus.id}
                className="bg-white border border-fc-cream2 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all"
              >
                {/* Campus Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-gradient-to-br from-fc-wash-mint to-fc-wash-mint rounded-xl">
                      <BuildingOfficeIcon className="w-6 h-6 text-fc-copper" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-fc-midnight">{campus.display_name}</h3>
                      <p className="text-sm text-fc-brown">{campus.region.display_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(campus)}
                      className="p-2 bg-fc-cream2 hover:bg-white/20 rounded-lg transition-all"
                    >
                      <PencilIcon className="w-4 h-4 text-fc-midnight/80" />
                    </button>
                    <button
                      onClick={() => handleDelete(campus)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all"
                    >
                      <TrashIcon className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Campus Details */}
                <div className="space-y-3">
                  {campus.pastor_name && (
                    <div className="flex items-center gap-2 text-fc-brown">
                      <UserIcon className="w-4 h-4 text-fc-violet" />
                      <span className="text-sm">{campus.pastor_name}</span>
                    </div>
                  )}
                  
                  {campus.address && (
                    <div className="flex items-center gap-2 text-fc-brown">
                      <MapPinIcon className="w-4 h-4 text-green-400" />
                      <span className="text-sm">{campus.city}, {campus.state}</span>
                    </div>
                  )}

                  {campus.service_times.length > 0 && (
                    <div className="flex items-start gap-2 text-fc-brown">
                      <ClockIcon className="w-4 h-4 text-yellow-400 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {campus.service_times.map((time, idx) => (
                          <span key={idx} className="text-xs bg-fc-cream2 px-2 py-1 rounded">
                            {time}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-4 pt-4 border-t border-fc-cream2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    campus.active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-fc-brown/70'
                  }`}>
                    {campus.active ? '● Active' : '○ Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-fc-midnight">
                {editingCampus ? 'Edit Campus' : 'Add New Campus'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-fc-cream2 rounded-lg transition-all"
              >
                <XMarkIcon className="w-6 h-6 text-fc-brown" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                    Campus Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                    placeholder="Adelaide City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                    placeholder="Adelaide City"
                  />
                </div>
              </div>

              {/* Region */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                  Region *
                </label>
                <select
                  name="region_id"
                  value={formData.region_id}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                >
                  {regions.map(region => (
                    <option key={region.id} value={region.id} className="bg-white">
                      {region.display_name} {region.coming_soon ? '(Coming Soon)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pastor Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                    Pastor Name
                  </label>
                  <input
                    type="text"
                    name="pastor_name"
                    value={formData.pastor_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                    placeholder="Ps Andrew"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                    Pastor Email
                  </label>
                  <input
                    type="email"
                    name="pastor_email"
                    value={formData.pastor_email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                    placeholder="andrew@church.com"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                    placeholder="Adelaide"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                    placeholder="SA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                    placeholder="5000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                  Country
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                >
                  <option value="" className="bg-white">Select a country...</option>
                  <option value="Australia" className="bg-white">Australia</option>
                  <option value="United States" className="bg-white">United States</option>
                  <option value="Brazil" className="bg-white">Brazil</option>
                  <option value="Indonesia" className="bg-white">Indonesia</option>
                  <option value="Canada" className="bg-white">Canada</option>
                  <option value="United Kingdom" className="bg-white">United Kingdom</option>
                  <option value="New Zealand" className="bg-white">New Zealand</option>
                  <option value="South Africa" className="bg-white">South Africa</option>
                  <option value="Singapore" className="bg-white">Singapore</option>
                  <option value="Philippines" className="bg-white">Philippines</option>
                </select>
              </div>

              {/* Service Times */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                  Service Times
                </label>
                <div className="space-y-2">
                  {formData.service_times.map((time, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={time}
                        onChange={(e) => handleServiceTimeChange(index, e.target.value)}
                        className="flex-1 px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                        placeholder="9:00 AM"
                      />
                      {formData.service_times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeServiceTime(index)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all"
                        >
                          <XMarkIcon className="w-5 h-5 text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addServiceTime}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-fc-cream2 rounded-lg text-fc-brown transition-all"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Service Time
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-fc-midnight/80 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-fc-cream2 rounded-lg text-fc-midnight focus:outline-none focus:border-fc-olive"
                  placeholder="Additional notes..."
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded bg-white/5 border-fc-cream2"
                />
                <label htmlFor="active" className="text-sm font-medium text-fc-midnight/80">
                  Campus is active
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-white/5 hover:bg-fc-cream2 rounded-lg text-fc-midnight transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-fc-copper to-fc-copper hover:shadow-lg hover:shadow-card rounded-lg text-fc-midnight font-semibold transition-all"
                >
                  {editingCampus ? 'Update Campus' : 'Create Campus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusManagement;

