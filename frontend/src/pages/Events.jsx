import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  XMarkIcon,
  PlusIcon,
  ArchiveBoxIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// Wrapper component to provide Stripe Elements context
const EventsWrapper = () => {
  if (!stripePromise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <p className="text-xl mb-2">Payment processing is not available</p>
          <p className="text-slate-400">Please contact the church office to register for paid events.</p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <Events />
    </Elements>
  );
};

const Events = () => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [campusFilter, setCampusFilter] = useState('all_campuses');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [campuses, setCampuses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showArchiveDeleteModal, setShowArchiveDeleteModal] = useState(false);
  const [eventToManage, setEventToManage] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [registrationData, setRegistrationData] = useState({
    email: '',
    name: '',
    phone: '',
    guest_count: 0
  });
  const [registering, setRegistering] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    fetchUserSession();
    fetchCampuses();
    fetchEvents();
  }, [campusFilter, categoryFilter]);

  const fetchUserSession = async () => {
    try {
      const response = await fetch('/api/session', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUserRole(data.role || 'user');
        }
      }
    } catch (error) {
      console.error('Error fetching user session:', error);
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

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // Use 'all' to show all events, not just upcoming ones
      let url = `/api/events?upcoming=all`;
      if (campusFilter !== 'all_campuses') {
        url += `&campus=${campusFilter}`;
      }
      if (categoryFilter !== 'all') {
        url += `&category=${categoryFilter}`;
      }

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const eventsList = data.events || [];
        // Debug: Log events with images
        eventsList.forEach(event => {
          if (event.image_url) {
            console.log(`Event "${event.title}" has image_url:`, event.image_url);
          }
        });
        setEvents(eventsList);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      day: date.getDate(),
      year: date.getFullYear(),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = searchTerm === '' || 
      event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Extract unique categories from events
  useEffect(() => {
    const uniqueCategories = [...new Set(events.map(e => e.category?.name).filter(Boolean))];
    setCategories(uniqueCategories);
  }, [events]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Events</h1>
              <p className="text-white/80">Upcoming church events and gatherings</p>
            </div>
            {(userRole === 'admin' || userRole === 'senior_leadership' || userRole === 'senior_leader' || userRole === 'senior_pastor' || userRole === 'lead_pastor') && (
              <button
                onClick={() => navigate('/events/manage')}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
              >
                <PlusIcon className="h-5 w-5" />
                Manage Events
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters & Search */}
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Campus Filter */}
            <div className="relative">
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="appearance-none bg-slate-700/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="appearance-none bg-slate-700/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white text-xl">Loading events...</div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <CalendarIcon className="h-20 w-20 text-slate-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">No Events Found</h3>
            <p className="text-slate-400">No upcoming events match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const dateInfo = formatDate(event.start_datetime || event.start_time);
              return (
                <div
                  key={event.id}
                  className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20"
                >
                  {/* Event Image */}
                  {event.image_url ? (
                    <div className="w-full h-48 overflow-hidden bg-slate-700/50">
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Failed to load event card image:', event.image_url, event);
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('Event card image loaded:', event.image_url);
                        }}
                      />
                    </div>
                  ) : null}
                  
                  <div className="p-6">
                  {/* Date Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-blue-500/20 rounded-xl px-4 py-2 border border-blue-500/30">
                      <div className="text-blue-400 font-bold text-sm uppercase">{dateInfo.weekday}</div>
                      <div className="text-white text-2xl font-bold">{dateInfo.day}</div>
                      <div className="text-slate-400 text-xs uppercase">{dateInfo.month} {dateInfo.year}</div>
                    </div>
                    {event.requires_payment && event.price && (
                      <div className="bg-green-500/20 rounded-lg px-3 py-1 border border-green-500/30">
                        <span className="text-green-400 font-semibold text-sm">
                          ${parseFloat(event.price).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Event Title */}
                  <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                    {event.title}
                  </h3>

                  {/* Event Details */}
                  <div className="space-y-2 mb-4">
                    {(event.start_datetime || event.start_time) && (
                      <div className="flex items-center text-slate-400 text-sm">
                        <ClockIcon className="h-4 w-4 mr-2" />
                        {dateInfo.time}
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center text-slate-400 text-sm">
                        <MapPinIcon className="h-4 w-4 mr-2" />
                        {event.location}
                      </div>
                    )}
                    {event.campus && event.campus !== 'all_campuses' && (
                      <div className="flex items-center text-slate-400 text-sm">
                        <span className="text-xs bg-slate-700/50 rounded px-2 py-1">
                          {campuses.find(c => c.id === event.campus)?.name || event.campus}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p className="text-slate-300 text-sm mb-4 line-clamp-3">
                      {event.description}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventModal(true);
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-semibold hover:scale-105 transition-transform duration-200"
                    >
                      View Details
                    </button>
                    {(userRole === 'admin' || userRole === 'senior_leadership' || userRole === 'senior_leader' || userRole === 'senior_pastor' || userRole === 'lead_pastor') && (
                      <button
                        onClick={() => {
                          setEventToManage(event);
                          setShowArchiveDeleteModal(true);
                        }}
                        className="px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-xl transition-all duration-200"
                        title="Archive or Delete Event"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {!loading && filteredEvents.length > 0 && (
          <div className="mt-8 text-center text-slate-400">
            Showing {filteredEvents.length} of {events.length} upcoming events
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {selectedEvent.title}
                </h2>
                {selectedEvent.category && (
                  <p className="text-slate-400 text-sm mb-4">
                    {selectedEvent.category.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <XMarkIcon className="w-6 h-6 text-white/60" />
              </button>
            </div>

            {/* Event Image */}
            {selectedEvent.image_url ? (
              <div className="mb-6 w-full h-64 overflow-hidden rounded-xl bg-slate-700/50">
                <img
                  src={selectedEvent.image_url}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Failed to load event image:', selectedEvent.image_url);
                    e.target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Event image loaded successfully:', selectedEvent.image_url);
                  }}
                />
              </div>
            ) : (
              <div className="mb-6 text-slate-400 text-sm">
                Debug: No image_url found. Event data: {JSON.stringify({id: selectedEvent.id, title: selectedEvent.title, has_image_url: !!selectedEvent.image_url})}
              </div>
            )}

            {/* Event Date & Time */}
            {selectedEvent.start_datetime || selectedEvent.start_time ? (
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-blue-500/20 rounded-xl px-6 py-4 border border-blue-500/30">
                    <div className="text-blue-400 font-bold text-sm uppercase mb-1">
                      {formatDate(selectedEvent.start_datetime || selectedEvent.start_time).weekday}
                    </div>
                    <div className="text-white text-3xl font-bold">
                      {formatDate(selectedEvent.start_datetime || selectedEvent.start_time).day}
                    </div>
                    <div className="text-slate-400 text-xs uppercase">
                      {formatDate(selectedEvent.start_datetime || selectedEvent.start_time).month} {formatDate(selectedEvent.start_datetime || selectedEvent.start_time).year}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center text-white mb-2">
                      <ClockIcon className="h-5 w-5 mr-2 text-blue-400" />
                      <span className="font-semibold">
                        {formatDate(selectedEvent.start_datetime || selectedEvent.start_time).time}
                      </span>
                      {(selectedEvent.end_datetime || selectedEvent.end_time) && (
                        <span className="text-slate-400 ml-2">
                          - {formatDate(selectedEvent.end_datetime || selectedEvent.end_time).time}
                        </span>
                      )}
                    </div>
                    {selectedEvent.location && (
                      <div className="flex items-center text-slate-300">
                        <MapPinIcon className="h-5 w-5 mr-2 text-green-400" />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Price */}
            {selectedEvent.requires_payment && selectedEvent.price && (
              <div className="mb-6 bg-green-500/20 rounded-xl px-4 py-3 border border-green-500/30 inline-block">
                <span className="text-green-400 font-semibold text-lg">
                  ${parseFloat(selectedEvent.price).toFixed(2)}
                </span>
              </div>
            )}

            {/* Campus */}
            {selectedEvent.campus && selectedEvent.campus !== 'all_campuses' && (
              <div className="mb-6">
                <span className="text-xs bg-slate-700/50 rounded px-3 py-2 text-slate-300">
                  {campuses.find(c => c.id === selectedEvent.campus)?.name || selectedEvent.campus}
                </span>
              </div>
            )}

            {/* Description */}
            {selectedEvent.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.description}
                </p>
              </div>
            )}

            {/* Contact Info */}
            {(selectedEvent.contact_person || selectedEvent.contact_email || selectedEvent.contact_phone) && (
              <div className="mb-6 pt-6 border-t border-white/10">
                <h3 className="text-lg font-semibold text-white mb-3">Contact Information</h3>
                <div className="space-y-2 text-slate-300">
                  {selectedEvent.contact_person && (
                    <p><span className="font-semibold">Contact:</span> {selectedEvent.contact_person}</p>
                  )}
                  {selectedEvent.contact_email && (
                    <p><span className="font-semibold">Email:</span> {selectedEvent.contact_email}</p>
                  )}
                  {selectedEvent.contact_phone && (
                    <p><span className="font-semibold">Phone:</span> {selectedEvent.contact_phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-white/10">
              {selectedEvent.requires_payment && selectedEvent.price && (
                <button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-semibold hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    setShowRegistrationModal(true);
                  }}
                  disabled={registering || paymentProcessing}
                >
                  {paymentProcessing ? 'Processing...' : `Register & Pay $${parseFloat(selectedEvent.price).toFixed(2)}`}
                </button>
              )}
              {(!selectedEvent.requires_payment || !selectedEvent.price) && (
                <button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-semibold hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    setShowRegistrationModal(true);
                  }}
                  disabled={registering}
                >
                  {registering ? 'Registering...' : 'RSVP'}
                </button>
              )}
              <button
                onClick={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                }}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {showRegistrationModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {selectedEvent.requires_payment && selectedEvent.price ? 'Register & Pay' : 'RSVP'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {selectedEvent.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRegistrationModal(false);
                  setRegistrationData({ email: '', name: '', phone: '', guest_count: 0 });
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <XMarkIcon className="w-6 h-6 text-white/60" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                
                if (!registrationData.email) {
                  alert('Email is required');
                  return;
                }

                try {
                  setRegistering(true);

                  // Check if event requires payment
                  if (selectedEvent.requires_payment && selectedEvent.price) {
                    setPaymentProcessing(true);
                    
                    // Step 1: Create payment intent
                    const paymentResponse = await fetch(`/api/events/${selectedEvent.id}/create-payment-intent`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        email: registrationData.email,
                        guest_count: parseInt(registrationData.guest_count) || 0
                      })
                    });

                    if (!paymentResponse.ok) {
                      const error = await paymentResponse.json();
                      throw new Error(error.error || 'Failed to create payment intent');
                    }

                    const paymentData = await paymentResponse.json();

                    // Step 2: Process payment with Stripe
                    if (!stripe || !elements) {
                      throw new Error('Payment system is not ready. Please refresh the page.');
                    }

                    const cardElement = elements.getElement(CardElement);
                    if (!cardElement) {
                      throw new Error('Card element not found. Please refresh the page.');
                    }

                    // Confirm payment with card
                    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
                      paymentData.client_secret,
                      {
                        payment_method: {
                          card: cardElement,
                          billing_details: {
                            email: registrationData.email,
                            name: registrationData.name || registrationData.email.split('@')[0],
                          },
                        },
                      }
                    );

                    if (stripeError) {
                      throw new Error(stripeError.message || 'Payment failed. Please try again.');
                    }

                    if (paymentIntent.status !== 'succeeded') {
                      throw new Error('Payment was not completed. Please try again.');
                    }

                    // Step 3: Register with payment intent ID
                    const registerResponse = await fetch(`/api/events/${selectedEvent.id}/register`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        ...registrationData,
                        payment_intent_id: paymentData.payment_intent_id
                      })
                    });

                    if (!registerResponse.ok) {
                      const error = await registerResponse.json();
                      throw new Error(error.error || 'Registration failed');
                    }

                    // Success!
                    alert(
                      `Registration successful!\n\n` +
                      `Amount paid: $${paymentData.amount.toFixed(2)}\n` +
                      `You're registered for ${selectedEvent.title}!\n` +
                      `A confirmation email has been sent.`
                    );

                    // Close modals
                    setShowRegistrationModal(false);
                    setShowEventModal(false);
                    setSelectedEvent(null);
                    setRegistrationData({ email: '', name: '', phone: '', guest_count: 0 });
                    fetchEvents();
                  } else {
                    // Free event - use RSVP endpoint
                    const rsvpResponse = await fetch(`/api/events/${selectedEvent.id}/rsvp`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        email: registrationData.email,
                        name: registrationData.name,
                        phone: registrationData.phone,
                        status: 'going',
                        guest_count: parseInt(registrationData.guest_count) || 0
                      })
                    });

                    if (!rsvpResponse.ok) {
                      const error = await rsvpResponse.json();
                      throw new Error(error.error || 'RSVP failed');
                    }

                    alert('RSVP successful! You\'re registered for this event.');
                  }

                  // Success - close modals and refresh events
                  setShowRegistrationModal(false);
                  setShowEventModal(false);
                  setSelectedEvent(null);
                  setRegistrationData({ email: '', name: '', phone: '', guest_count: 0 });
                  fetchEvents();
                } catch (error) {
                  console.error('Registration error:', error);
                  alert(error.message || 'Failed to register. Please try again.');
                } finally {
                  setRegistering(false);
                  setPaymentProcessing(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={registrationData.email}
                  onChange={(e) => setRegistrationData({ ...registrationData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={registrationData.name}
                  onChange={(e) => setRegistrationData({ ...registrationData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={registrationData.phone}
                  onChange={(e) => setRegistrationData({ ...registrationData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your phone number"
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Number of Guests
                </label>
                <input
                  type="number"
                  min="0"
                  value={registrationData.guest_count}
                  onChange={(e) => setRegistrationData({ ...registrationData, guest_count: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              {selectedEvent.requires_payment && selectedEvent.price && (
                <>
                  <div className="bg-green-500/20 rounded-xl px-4 py-3 border border-green-500/30 mb-4">
                    <p className="text-green-400 text-sm font-semibold">
                      Total: ${(parseFloat(selectedEvent.price) * (1 + (parseInt(registrationData.guest_count) || 0))).toFixed(2)}
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-white text-sm font-medium mb-2">
                      Card Details <span className="text-red-400">*</span>
                    </label>
                    <div className="bg-slate-700/50 border border-white/10 rounded-xl p-4">
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#ffffff',
                              '::placeholder': {
                                color: '#9ca3af',
                              },
                            },
                            invalid: {
                              color: '#ef4444',
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={registering || paymentProcessing}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-semibold hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paymentProcessing ? 'Processing Payment...' : registering ? 'Registering...' : selectedEvent.requires_payment && selectedEvent.price ? 'Pay & Register' : 'RSVP'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegistrationModal(false);
                    setRegistrationData({ email: '', name: '', phone: '', guest_count: 0 });
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

      {/* Archive/Delete Modal */}
      {showArchiveDeleteModal && eventToManage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Manage Event</h2>
                <p className="text-slate-400 text-sm">{eventToManage.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowArchiveDeleteModal(false);
                  setEventToManage(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <XMarkIcon className="w-6 h-6 text-white/60" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-slate-300">
                What would you like to do with this event?
              </p>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-white/10">
                <p className="text-slate-400 text-sm mb-2">
                  <strong className="text-white">Archive:</strong> Hide the event from public view but keep it for historical records and attendance tracking.
                </p>
                <p className="text-slate-400 text-sm">
                  <strong className="text-white">Delete:</strong> Permanently remove the event (cannot be undone).
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/events/${eventToManage.id}`, {
                      method: 'DELETE',
                      credentials: 'include'
                    });
                    if (response.ok) {
                      alert('Event archived successfully');
                      setShowArchiveDeleteModal(false);
                      setEventToManage(null);
                      fetchEvents();
                    } else {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to archive event');
                    }
                  } catch (error) {
                    console.error('Archive error:', error);
                    alert(error.message || 'Failed to archive event. Please try again.');
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-3 rounded-xl font-semibold transition-all duration-200 border border-blue-500/30"
              >
                <ArchiveBoxIcon className="h-5 w-5" />
                Archive
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Are you sure you want to permanently delete "${eventToManage.title}"? This action cannot be undone.`)) {
                    return;
                  }
                  try {
                    const response = await fetch(`/api/events/${eventToManage.id}`, {
                      method: 'DELETE',
                      credentials: 'include'
                    });
                    if (response.ok) {
                      alert('Event deleted successfully');
                      setShowArchiveDeleteModal(false);
                      setEventToManage(null);
                      fetchEvents();
                    } else {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to delete event');
                    }
                  } catch (error) {
                    console.error('Delete error:', error);
                    alert(error.message || 'Failed to delete event. Please try again.');
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-3 rounded-xl font-semibold transition-all duration-200 border border-red-500/30"
              >
                <TrashIcon className="h-5 w-5" />
                Delete
              </button>
              <button
                onClick={() => {
                  setShowArchiveDeleteModal(false);
                  setEventToManage(null);
                }}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsWrapper;

