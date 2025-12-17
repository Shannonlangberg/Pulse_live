import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  MapPinIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

const EventsManager = () => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [campusFilter, setCampusFilter] = useState('all_campuses');
  const [statusFilter, setStatusFilter] = useState('all'); // all, upcoming, past
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedEventForRegistrations, setSelectedEventForRegistrations] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [beaconZones, setBeaconZones] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    short_description: '',
    category_id: '',
    campus: 'all_campuses',
    location: '',
    start_datetime: '',
    end_datetime: '',
    price: '',
    requires_payment: false,
    stripe_price_id: '',
    max_capacity: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    image_url: '',
    additional_info: '',
    beacon_zone_id: ''
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchEvents();
    fetchCategories();
    fetchCampuses();
    fetchBeaconZones();
  }, [campusFilter, statusFilter]);

  const fetchBeaconZones = async () => {
    try {
      const response = await fetch('/api/beacon_zones', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // API returns 'zones' not 'beacon_zones'
        setBeaconZones(data.zones || data.beacon_zones || []);
      } else if (response.status === 403) {
        // Permission denied - just log and continue without beacon zones
        console.log('Beacon zones not available (permission denied)');
        setBeaconZones([]);
      }
    } catch (error) {
      // Silently fail - beacon zones are optional
      console.log('Beacon zones not available');
      setBeaconZones([]);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/campuses', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCampuses(data.campuses || []);
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/events/categories', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      const response = await fetch('/api/events/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: '',
          color: '#6366f1'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Add new category to list
        setCategories([...categories, data.category]);
        // Set the new category as selected
        setFormData(prev => ({
          ...prev,
          category_id: data.category.id
        }));
        // Close modal and reset
        setShowCategoryModal(false);
        setNewCategoryName('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Failed to create category');
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      let url = '/api/events?upcoming=all';
      if (campusFilter !== 'all_campuses') {
        url += `&campus=${campusFilter}`;
      }

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        let filtered = data.events || [];
        
        // Filter by status
        const now = new Date();
        if (statusFilter === 'upcoming') {
          filtered = filtered.filter(e => new Date(e.start_datetime || e.start_time) > now);
        } else if (statusFilter === 'past') {
          filtered = filtered.filter(e => new Date(e.start_datetime || e.start_time) < now);
        }
        
        setEvents(filtered);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('Uploading image:', file.name, file.type, file.size);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log('Sending upload request to /api/events/upload-image');

      const response = await fetch('/api/events/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('Upload response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('Upload successful, received data:', data);
        if (data.image_url) {
          console.log('Setting image_url in formData and imagePreview to:', data.image_url);
          setFormData(prev => {
            const updated = { ...prev, image_url: data.image_url };
            console.log('Updated formData:', updated);
            return updated;
          });
          setImagePreview(data.image_url);
          console.log('Image preview state set to:', data.image_url);
          
          // Test if image loads
          const testImg = new Image();
          testImg.onload = () => {
            console.log('Image test load successful:', data.image_url);
          };
          testImg.onerror = () => {
            console.error('Image test load failed:', data.image_url);
            alert(`Warning: Image uploaded but may not be accessible at ${data.image_url}`);
          };
          testImg.src = data.image_url;
        } else {
          console.error('No image_url in response:', data);
          alert('Upload succeeded but no image URL returned');
        }
      } else {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        let errorMessage = 'Failed to upload image';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error.message || error}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = { target: { files: [file] } };
      handleImageUpload(fakeEvent);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
    setImagePreview(null);
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      short_description: '',
      category_id: '',
      campus: 'all_campuses',
      location: '',
      start_datetime: '',
      end_datetime: '',
      price: '',
      requires_payment: false,
      stripe_price_id: '',
      max_capacity: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      image_url: '',
      additional_info: '',
      beacon_zone_id: ''
    });
    setImagePreview(null);
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    const startTime = event.start_datetime || event.start_time;
    const endTime = event.end_datetime || event.end_time;
    
    // Format datetime for input field (YYYY-MM-DDTHH:mm)
    const formatForInput = (isoString) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setFormData({
      title: event.title || '',
      description: event.description || '',
      short_description: event.short_description || '',
      category_id: event.category_id || event.category?.id || '',
      campus: event.campus || 'all_campuses',
      location: event.location || '',
      start_datetime: formatForInput(startTime),
      end_datetime: formatForInput(endTime),
      price: event.price || '',
      requires_payment: event.requires_payment || false,
      stripe_price_id: event.stripe_price_id || '',
      max_capacity: event.max_capacity || '',
      contact_person: event.contact_person || '',
      contact_email: event.contact_email || '',
      contact_phone: event.contact_phone || '',
      image_url: event.image_url || '',
      additional_info: event.additional_info || '',
      beacon_zone_id: event.beacon_zone_id || ''
    });
    setImagePreview(event.image_url || null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingEvent 
        ? `/api/events/${editingEvent.id}`
        : '/api/events';
      
      const method = editingEvent ? 'PUT' : 'POST';
      
      // Convert datetime to ISO format
      const payload = {
        ...formData,
        start_datetime: formData.start_datetime ? new Date(formData.start_datetime).toISOString() : null,
        end_datetime: formData.end_datetime ? new Date(formData.end_datetime).toISOString() : null,
        price: formData.price ? parseFloat(formData.price) : null,
        max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : null,
        category_id: parseInt(formData.category_id) || null,
        beacon_zone_id: formData.beacon_zone_id ? parseInt(formData.beacon_zone_id) : null,
        image_url: formData.image_url || null  // Explicitly include image_url
      };

      console.log('Submitting event with payload:', payload);
      console.log('Image URL being sent:', payload.image_url);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowModal(false);
        fetchEvents();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save event');
      }
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event');
    }
  };

  const handleDelete = async (event) => {
    if (!confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchEvents();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
  };

  const viewRegistrations = async (event) => {
    setSelectedEventForRegistrations(event);
    setLoadingRegistrations(true);
    try {
      const response = await fetch(`/api/events/${event.id}/registrations`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRegistrations(data.registrations || []);
      } else {
        alert('Failed to load registrations');
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
      alert('Failed to load registrations');
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const exportRegistrations = async () => {
    if (!selectedEventForRegistrations) return;
    try {
      const response = await fetch(`/api/events/${selectedEventForRegistrations.id}/registrations/export`, {
        credentials: 'include'
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registrations-${selectedEventForRegistrations.id}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to export registrations');
      }
    } catch (error) {
      console.error('Error exporting registrations:', error);
      alert('Failed to export registrations');
    }
  };

  const filteredEvents = events;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Events Manager</h1>
            <p className="text-white/60">Manage church events - synced with Futures App</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            <PlusIcon className="w-5 h-5" />
            New Event
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex gap-3 flex-wrap">
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all_campuses">All Campuses</option>
            {campuses
              .filter(c => c.id !== 'all_campuses')
              .map(campus => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Events</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center text-white/60 py-20">Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center text-white/60 py-20">
            No events found. Click "New Event" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const dateInfo = formatDate(event.start_datetime || event.start_time);
              return (
                <div
                  key={event.id}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                >
                  {/* Event Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-16 h-16 object-cover rounded-xl"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <div className={`p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl ${event.image_url ? 'hidden' : ''}`}>
                        <CalendarIcon className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1 line-clamp-2">
                          {event.title}
                        </h3>
                        {event.category && (
                          <p className="text-sm text-white/60">{event.category.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => viewRegistrations(event)}
                        className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-all"
                        title="View Registrations"
                      >
                        <UserGroupIcon className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => openEditModal(event)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                      >
                        <PencilIcon className="w-4 h-4 text-white/80" />
                      </button>
                      <button
                        onClick={() => handleDelete(event)}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all"
                      >
                        <TrashIcon className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Event Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <ClockIcon className="w-4 h-4 text-yellow-400" />
                      <span>{dateInfo.date} at {dateInfo.time}</span>
                    </div>
                    
                    {event.location && (
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <MapPinIcon className="w-4 h-4 text-green-400" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {event.campus && event.campus !== 'all_campuses' && (
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <span className="text-xs bg-white/10 px-2 py-1 rounded">
                          {campuses.find(c => c.id === event.campus)?.name || event.campus}
                        </span>
                      </div>
                    )}

                    {event.requires_payment && event.price && (
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <CurrencyDollarIcon className="w-4 h-4 text-green-400" />
                        <span className="font-semibold">${parseFloat(event.price).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p className="text-slate-300 text-sm mb-4 line-clamp-3">
                      {event.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <XMarkIcon className="w-6 h-6 text-white/60" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Image Upload Section */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Event Image
                </label>
                <div
                  onDrop={handleImageDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    imagePreview
                      ? 'border-white/20 bg-white/5'
                      : 'border-white/10 bg-white/5 hover:border-purple-500/50'
                  }`}
                >
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Event preview"
                        className="max-h-64 mx-auto rounded-lg object-cover"
                        onError={(e) => {
                          console.error('Failed to load image preview:', imagePreview, e);
                          alert(`Failed to load image: ${imagePreview}. Please check if the image file exists.`);
                          setImagePreview(null);
                        }}
                        onLoad={() => {
                          console.log('Image preview loaded successfully:', imagePreview);
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-white/60 mb-4">
                        <svg className="mx-auto h-12 w-12 text-white/40" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="text-white/80 mb-2">
                        Drag & drop an image here, or{' '}
                        <button
                          type="button"
                          onClick={() => {
                            console.log('Browse button clicked');
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            } else {
                              console.error('File input ref is null');
                            }
                          }}
                          className="text-purple-400 hover:text-purple-300 cursor-pointer underline bg-transparent border-none p-0"
                          disabled={uploadingImage}
                        >
                          browse
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            console.log('File input changed:', e.target.files);
                            if (e.target.files && e.target.files.length > 0) {
                              handleImageUpload(e);
                            } else {
                              console.log('No file selected in onChange');
                            }
                          }}
                          onClick={(e) => {
                            console.log('File input clicked');
                            // Reset value to allow re-uploading same file
                            e.target.value = '';
                          }}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                      </p>
                      <p className="text-xs text-white/50">
                        PNG, JPG, GIF or WEBP (max 5MB)
                      </p>
                      {uploadingImage && (
                        <div className="mt-4">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                          <p className="text-sm text-white/60 mt-2">Uploading image...</p>
                        </div>
                      )}
                      {!uploadingImage && !imagePreview && (
                        <p className="text-xs text-white/40 mt-2">
                          Click "browse" or drag an image here
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  placeholder="Leadership Summit 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Category *
                  </label>
                  <div className="flex gap-2">
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleInputChange}
                      required
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id} className="bg-slate-800">
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
                      title="Add new category"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Campus
                  </label>
                  <select
                    name="campus"
                    value={formData.campus}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="all_campuses">All Campuses</option>
                    {campuses
                      .filter(c => c.id !== 'all_campuses')
                      .map(campus => (
                        <option key={campus.id} value={campus.id} className="bg-slate-800">
                          {campus.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="start_datetime"
                    value={formData.start_datetime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    name="end_datetime"
                    value={formData.end_datetime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  placeholder="Main Auditorium, 123 Main St"
                />
              </div>

              {/* Beacon Zone for Attendance Tracking */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Bluetooth Beacon (for automatic attendance tracking)
                </label>
                <select
                  name="beacon_zone_id"
                  value={formData.beacon_zone_id}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">No beacon (manual attendance only)</option>
                  {beaconZones
                    .filter(zone => !formData.campus || formData.campus === 'all_campuses' || zone.campus === formData.campus)
                    .map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.zone_name} ({zone.campus})
                      </option>
                    ))}
                </select>
                <p className="text-xs text-white/50 mt-1">
                  Link a beacon to automatically track attendance when people arrive at the event
                </p>
              </div>

              {/* Payment Fields */}
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Payment Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="requires_payment"
                      checked={formData.requires_payment}
                      onChange={handleInputChange}
                      className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
                    />
                    <label className="text-white/80">This event requires payment</label>
                  </div>

                  {formData.requires_payment && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          placeholder="25.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Stripe Price ID (optional)
                        </label>
                        <input
                          type="text"
                          name="stripe_price_id"
                          value={formData.stripe_price_id}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          placeholder="price_xxxxx"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  placeholder="Event description..."
                />
              </div>

              {/* Additional Info */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Additional Info
                </label>
                <textarea
                  name="additional_info"
                  value={formData.additional_info}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  placeholder="What to bring, parking info, etc..."
                />
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Max Capacity */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Max Capacity
                </label>
                <input
                  type="number"
                  name="max_capacity"
                  value={formData.max_capacity}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  placeholder="100"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registrations Modal */}
      {selectedEventForRegistrations && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Registrations: {selectedEventForRegistrations.title}
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  {registrations.length} registration{registrations.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportRegistrations}
                  className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-all"
                  title="Export CSV"
                >
                  <ArrowDownTrayIcon className="w-5 h-5 text-green-400" />
                </button>
                <button
                  onClick={() => {
                    setSelectedEventForRegistrations(null);
                    setRegistrations([]);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <XMarkIcon className="w-6 h-6 text-white/60" />
                </button>
              </div>
            </div>

            {loadingRegistrations ? (
              <div className="text-center text-white/60 py-20">Loading registrations...</div>
            ) : registrations.length === 0 ? (
              <div className="text-center text-white/60 py-20">
                No registrations yet for this event.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Guests</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-white">{reg.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-300">{reg.email || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-300">{reg.phone || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            reg.status === 'registered' ? 'bg-green-500/20 text-green-400' :
                            reg.status === 'waitlisted' ? 'bg-yellow-500/20 text-yellow-400' :
                            reg.status === 'attended' ? 'bg-blue-500/20 text-blue-400' :
                            reg.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {reg.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{reg.guest_count || 0}</td>
                        <td className="px-4 py-3 text-slate-300 text-sm">
                          {reg.created_at ? new Date(reg.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Create New Category</h2>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <XMarkIcon className="w-6 h-6 text-white/60" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g., Conference, Workshop, Social"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  Create Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsManager;

