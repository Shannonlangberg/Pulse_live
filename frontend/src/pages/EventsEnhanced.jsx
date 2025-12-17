import React, { useState, useEffect } from 'react';
import { 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  XMarkIcon,
  PlusIcon,
  FunnelIcon,
  ListBulletIcon,
  Squares2X2Icon,
  UserGroupIcon,
  TagIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';

const EventsEnhanced = () => {
  // State management
  const [activeTab, setActiveTab] = useState('list'); // list, calendar, registrations
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [campusFilter, setCampusFilter] = useState('all_campuses');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, upcoming, past, draft, published, cancelled
  const [ministryFilter, setMinistryFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('upcoming'); // upcoming, this_week, this_month, past, all
  const [tagFilter, setTagFilter] = useState('');
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month'); // month, week, day
  
  // Event details modal
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventDetailTab, setEventDetailTab] = useState('overview'); // overview, registrations, teams, resources
  
  // Event form modal
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  
  // Quick filters
  const quickFilters = [
    { id: 'upcoming', label: 'Upcoming', value: 'upcoming' },
    { id: 'this_week', label: 'This Week', value: 'this_week' },
    { id: 'this_month', label: 'This Month', value: 'this_month' },
    { id: 'past', label: 'Past', value: 'past' },
    { id: 'drafts', label: 'Drafts', value: 'draft' }
  ];

  useEffect(() => {
    fetchCampuses();
    fetchCategories();
    fetchEvents();
  }, [campusFilter, categoryFilter, statusFilter, ministryFilter, dateRangeFilter, tagFilter]);

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

  const fetchEvents = async () => {
    try {
      setLoading(true);
      let url = '/api/events?upcoming=all';
      
      // Apply filters
      if (campusFilter !== 'all_campuses') {
        url += `&campus=${campusFilter}`;
      }
      if (categoryFilter !== 'all') {
        url += `&category=${categoryFilter}`;
      }
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        let filteredEvents = data.events || [];
        
        // Apply additional client-side filters
        const now = new Date();
        
        if (dateRangeFilter === 'upcoming') {
          filteredEvents = filteredEvents.filter(e => {
            const eventDate = e.start_datetime || e.start_time;
            return eventDate && new Date(eventDate) > now;
          });
        } else if (dateRangeFilter === 'this_week') {
          const weekStart = startOfWeek(now);
          const weekEnd = endOfWeek(now);
          filteredEvents = filteredEvents.filter(e => {
            const eventDate = e.start_datetime || e.start_time;
            if (!eventDate) return false;
            const date = parseISO(eventDate);
            return date >= weekStart && date <= weekEnd;
          });
        } else if (dateRangeFilter === 'this_month') {
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          filteredEvents = filteredEvents.filter(e => {
            const eventDate = e.start_datetime || e.start_time;
            if (!eventDate) return false;
            const date = parseISO(eventDate);
            return date >= monthStart && date <= monthEnd;
          });
        } else if (dateRangeFilter === 'past') {
          filteredEvents = filteredEvents.filter(e => {
            const eventDate = e.start_datetime || e.start_time;
            return eventDate && new Date(eventDate) < now;
          });
        } else if (dateRangeFilter === 'draft') {
          filteredEvents = filteredEvents.filter(e => e.status === 'draft');
        }
        
        // Filter by ministry
        if (ministryFilter !== 'all') {
          filteredEvents = filteredEvents.filter(e => e.ministry === ministryFilter);
        }
        
        // Filter by tag
        if (tagFilter) {
          filteredEvents = filteredEvents.filter(e => {
            const tags = e.tags || [];
            return tags.some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase()));
          });
        }
        
        setEvents(filteredEvents);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (filterValue) => {
    setDateRangeFilter(filterValue);
    if (filterValue === 'draft') {
      setStatusFilter('draft');
    }
  };

  const openEventDetails = async (event) => {
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedEvent(data.event);
        setShowEventModal(true);
        setEventDetailTab('overview');
      } else {
        // Fallback to basic event data
        setSelectedEvent(event);
        setShowEventModal(true);
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
      setSelectedEvent(event);
      setShowEventModal(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = parseISO(dateString);
    return {
      weekday: format(date, 'EEEE'),
      month: format(date, 'MMM'),
      day: format(date, 'd'),
      year: format(date, 'yyyy'),
      time: format(date, 'h:mm a'),
      full: format(date, 'PPpp')
    };
  };

  // Calendar helpers
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = event.start_datetime || event.start_time;
      if (!eventDate) return false;
      return isSameDay(parseISO(eventDate), date);
    });
  };

  // Extract unique ministries and tags from events
  const ministries = [...new Set(events.map(e => e.ministry).filter(Boolean))];
  const allTags = events.flatMap(e => e.tags || []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Events</h1>
              <p className="text-white/80">Plan, publish and track events across all campuses.</p>
            </div>
            <button
              onClick={() => {
                setEditingEvent(null);
                setShowEventForm(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-all backdrop-blur-sm"
            >
              <PlusIcon className="w-5 h-5" />
              New Event
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Filter Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {quickFilters.map(filter => (
            <button
              key={filter.id}
              onClick={() => handleQuickFilter(filter.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                dateRangeFilter === filter.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'list'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <ListBulletIcon className="w-5 h-5" />
              List
            </div>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'calendar'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Calendar
            </div>
          </button>
          <button
            onClick={() => setActiveTab('registrations')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'registrations'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5" />
              Registrations
            </div>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
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
                className="w-full appearance-none bg-slate-700/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full appearance-none bg-slate-700/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none bg-slate-700/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Additional Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Ministry Filter */}
            {ministries.length > 0 && (
              <div className="relative">
                <select
                  value={ministryFilter}
                  onChange={(e) => setMinistryFilter(e.target.value)}
                  className="w-full appearance-none bg-slate-700/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Ministries</option>
                  {ministries.map(ministry => (
                    <option key={ministry} value={ministry}>
                      {ministry}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* Tag Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by tag..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Content based on active tab */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <ArrowPathIcon className="w-8 h-8 text-white animate-spin" />
          </div>
        ) : activeTab === 'list' ? (
          <ListView events={events} onEventClick={openEventDetails} campuses={campuses} formatDate={formatDate} />
        ) : activeTab === 'calendar' ? (
          <CalendarView
            events={events}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            getCalendarDays={getCalendarDays}
            getEventsForDate={getEventsForDate}
            onEventClick={openEventDetails}
            formatDate={formatDate}
          />
        ) : (
          <RegistrationsView events={events} onEventClick={openEventDetails} />
        )}
      </div>

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
          activeTab={eventDetailTab}
          onTabChange={setEventDetailTab}
          formatDate={formatDate}
          campuses={campuses}
        />
      )}

      {/* Event Form Modal */}
      {showEventForm && (
        <EventFormModal
          event={editingEvent}
          categories={categories}
          campuses={campuses}
          onClose={() => {
            setShowEventForm(false);
            setEditingEvent(null);
          }}
          onSave={() => {
            setShowEventForm(false);
            setEditingEvent(null);
            fetchEvents(); // Refresh events list
          }}
        />
      )}
    </div>
  );
};

// List View Component
const ListView = ({ events, onEventClick, campuses, formatDate }) => {
  const [sortBy, setSortBy] = useState('date'); // date, name, campus, status
  const [sortOrder, setSortOrder] = useState('asc');

  const sortedEvents = [...events].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'name':
        aVal = a.title?.toLowerCase() || '';
        bVal = b.title?.toLowerCase() || '';
        break;
      case 'campus':
        aVal = a.campus || '';
        bVal = b.campus || '';
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'date':
      default:
        aVal = a.start_datetime || a.start_time || '';
        bVal = b.start_datetime || b.start_time || '';
        break;
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const getStatusBadge = (status) => {
    const styles = {
      published: 'bg-green-500/20 text-green-400 border-green-500/30',
      draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    };
    return styles[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  if (sortedEvents.length === 0) {
    return (
      <div className="text-center py-20">
        <CalendarIcon className="h-20 w-20 text-slate-600 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-white mb-2">No Events Found</h3>
        <p className="text-slate-400">No events match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-slate-400">Sort by:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white"
        >
          <option value="date">Date</option>
          <option value="name">Name</option>
          <option value="campus">Campus</option>
          <option value="status">Status</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Events Table */}
      <div className="bg-slate-800/50 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Event Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Campus</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Ministry</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Date & Time</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Registrations</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Visibility</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sortedEvents.map((event) => {
              const dateInfo = formatDate(event.start_datetime || event.start_time);
              const hasRecurrence = !!event.recurrence_rule;
              
              return (
                <tr
                  key={event.id}
                  className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                  onClick={() => onEventClick(event)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{event.title}</span>
                      {hasRecurrence && (
                        <ArrowPathIcon className="w-4 h-4 text-blue-400" title="Recurring event" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {campuses.find(c => c.id === event.campus)?.name || event.campus}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {event.ministry || '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {dateInfo ? (
                      <div>
                        <div>{dateInfo.weekday}, {dateInfo.month} {dateInfo.day}</div>
                        <div className="text-sm text-slate-400">{dateInfo.time}</div>
                      </div>
                    ) : (
                      'TBD'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusBadge(event.status || 'draft')}`}>
                      {(event.status || 'draft').charAt(0).toUpperCase() + (event.status || 'draft').slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {event.registration_required ? (
                      <span>
                        {event.registration_count || 0} / {event.capacity || '∞'}
                      </span>
                    ) : (
                      <span className="text-slate-500">No registration</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    <span className="text-xs capitalize">{event.visibility || 'public'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Calendar View Component
const CalendarView = ({ events, currentMonth, setCurrentMonth, getCalendarDays, getEventsForDate, onEventClick, formatDate }) => {
  const days = getCalendarDays();
  const monthStart = startOfMonth(currentMonth);

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-white/10 p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
        >
          <ChevronDownIcon className="w-5 h-5 text-white rotate-90" />
        </button>
        <h2 className="text-2xl font-bold text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
        >
          <ChevronDownIcon className="w-5 h-5 text-white -rotate-90" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-semibold text-slate-400">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, idx) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              className={`min-h-[100px] p-2 border border-white/10 rounded-lg ${
                isCurrentMonth ? 'bg-slate-700/30' : 'bg-slate-800/30 opacity-50'
              } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className={`text-sm font-medium mb-1 ${isCurrentMonth ? 'text-white' : 'text-slate-500'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="text-xs px-2 py-1 bg-blue-500/30 hover:bg-blue-500/50 text-white rounded cursor-pointer truncate"
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-slate-400 px-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Registrations View Component
const RegistrationsView = ({ events, onEventClick }) => {
  const eventsWithRegistrations = events.filter(e => e.registration_required && e.registration_count > 0);

  if (eventsWithRegistrations.length === 0) {
    return (
      <div className="text-center py-20">
        <UserGroupIcon className="h-20 w-20 text-slate-600 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-white mb-2">No Registrations</h3>
        <p className="text-slate-400">No events with registrations found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {eventsWithRegistrations.map(event => (
        <div
          key={event.id}
          className="bg-slate-800/50 rounded-2xl p-6 border border-white/10 hover:border-blue-500/50 transition-all cursor-pointer"
          onClick={() => onEventClick(event)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{event.title}</h3>
              <div className="flex items-center gap-4 text-slate-300">
                <span>{event.registration_count || 0} registered</span>
                {event.capacity && (
                  <span>Capacity: {event.capacity}</span>
                )}
                {event.waitlist_count > 0 && (
                  <span className="text-yellow-400">{event.waitlist_count} waitlisted</span>
                )}
              </div>
            </div>
            <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
              View Details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Event Details Modal Component
const EventDetailsModal = ({ event, onClose, activeTab, onTabChange, formatDate, campuses }) => {
  const [registrations, setRegistrations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'registrations' || activeTab === 'teams' || activeTab === 'resources') {
      fetchTabData();
    }
  }, [activeTab, event.id]);

  const fetchTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'registrations') {
        const response = await fetch(`/api/events/${event.id}/registrations`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setRegistrations(data.registrations || []);
        }
      } else if (activeTab === 'teams') {
        const response = await fetch(`/api/events/${event.id}/teams`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setTeams(data.team_assignments || []);
        }
      } else if (activeTab === 'resources') {
        const response = await fetch(`/api/events/${event.id}/resources`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setResources(data.resource_bookings || []);
        }
      }
    } catch (error) {
      console.error('Error fetching tab data:', error);
    } finally {
      setLoading(false);
    }
  };

  const dateInfo = formatDate(event.start_datetime || event.start_time);
  const endDateInfo = formatDate(event.end_datetime || event.end_time);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-2">{event.title}</h2>
            {event.category && (
              <p className="text-slate-400 text-sm mb-4">{event.category.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <XMarkIcon className="w-6 h-6 text-white/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          {['overview', 'registrations', 'teams', 'resources'].map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-6 py-3 font-semibold transition-all capitalize ${
                activeTab === tab
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[300px]">
          {activeTab === 'overview' && (
            <EventOverviewTab event={event} dateInfo={dateInfo} endDateInfo={endDateInfo} campuses={campuses} />
          )}
          {activeTab === 'registrations' && (
            <RegistrationsTab registrations={registrations} loading={loading} eventId={event.id} />
          )}
          {activeTab === 'teams' && (
            <TeamsTab teams={teams} loading={loading} eventId={event.id} />
          )}
          {activeTab === 'resources' && (
            <ResourcesTab resources={resources} loading={loading} eventId={event.id} />
          )}
        </div>
      </div>
    </div>
  );
};

// Tab Components
const EventOverviewTab = ({ event, dateInfo, endDateInfo, campuses }) => (
  <div className="space-y-6">
    {/* Date & Time */}
    {dateInfo && (
      <div className="flex items-center gap-4">
        <div className="bg-blue-500/20 rounded-xl px-6 py-4 border border-blue-500/30">
          <div className="text-blue-400 font-bold text-sm uppercase mb-1">{dateInfo.weekday}</div>
          <div className="text-white text-3xl font-bold">{dateInfo.day}</div>
          <div className="text-slate-400 text-xs uppercase">{dateInfo.month} {dateInfo.year}</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center text-white mb-2">
            <ClockIcon className="h-5 w-5 mr-2 text-blue-400" />
            <span className="font-semibold">{dateInfo.time}</span>
            {endDateInfo && (
              <span className="text-slate-400 ml-2">- {endDateInfo.time}</span>
            )}
          </div>
          {event.location && (
            <div className="flex items-center text-slate-300">
              <MapPinIcon className="h-5 w-5 mr-2 text-green-400" />
              <span>{event.location}</span>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Description */}
    {event.description && (
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{event.description}</p>
      </div>
    )}

    {/* Details Grid */}
    <div className="grid grid-cols-2 gap-4">
      <div>
        <span className="text-slate-400 text-sm">Campus</span>
        <p className="text-white">{campuses.find(c => c.id === event.campus)?.name || event.campus}</p>
      </div>
      {event.ministry && (
        <div>
          <span className="text-slate-400 text-sm">Ministry</span>
          <p className="text-white">{event.ministry}</p>
        </div>
      )}
      <div>
        <span className="text-slate-400 text-sm">Status</span>
        <p className="text-white capitalize">{event.status || 'draft'}</p>
      </div>
      <div>
        <span className="text-slate-400 text-sm">Visibility</span>
        <p className="text-white capitalize">{event.visibility || 'public'}</p>
      </div>
    </div>

    {/* Registration Summary */}
    {event.registration_required && (
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-2">Registration Summary</h3>
        <div className="flex items-center gap-4">
          <span className="text-slate-300">
            {event.registration_count || 0} registered
            {event.capacity && ` / ${event.capacity} capacity`}
          </span>
          {event.waitlist_count > 0 && (
            <span className="text-yellow-400">{event.waitlist_count} waitlisted</span>
          )}
        </div>
      </div>
    )}
  </div>
);

const RegistrationsTab = ({ registrations, loading, eventId }) => {
  if (loading) {
    return <div className="text-center text-white py-10">Loading registrations...</div>;
  }

  if (registrations.length === 0) {
    return (
      <div className="text-center py-10">
        <UserGroupIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No registrations yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">
          {registrations.length} Registration{registrations.length !== 1 ? 's' : ''}
        </h3>
        <a
          href={`/api/events/${eventId}/registrations/export`}
          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm"
        >
          Export CSV
        </a>
      </div>
      <div className="bg-slate-800/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Phone</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-white">Guests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {registrations.map(reg => (
              <tr key={reg.id}>
                <td className="px-4 py-3 text-white">{reg.name}</td>
                <td className="px-4 py-3 text-slate-300">{reg.email}</td>
                <td className="px-4 py-3 text-slate-300">{reg.phone || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs capitalize ${
                    reg.status === 'registered' ? 'bg-green-500/20 text-green-400' :
                    reg.status === 'waitlisted' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {reg.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{reg.guest_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TeamsTab = ({ teams, loading, eventId }) => {
  if (loading) {
    return <div className="text-center text-white py-10">Loading teams...</div>;
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-10">
        <UserGroupIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No team assignments yet.</p>
      </div>
    );
  }

  // Group by team name
  const teamsByGroup = teams.reduce((acc, assignment) => {
    if (!acc[assignment.team_name]) {
      acc[assignment.team_name] = [];
    }
    acc[assignment.team_name].push(assignment);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(teamsByGroup).map(([teamName, assignments]) => (
        <div key={teamName} className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-3">{teamName}</h3>
          <div className="space-y-2">
            {assignments.map(assignment => (
              <div key={assignment.id} className="flex items-center justify-between">
                <div>
                  <p className="text-white">{assignment.person_name}</p>
                  {assignment.role && (
                    <p className="text-sm text-slate-400">{assignment.role}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const ResourcesTab = ({ resources, loading, eventId }) => {
  if (loading) {
    return <div className="text-center text-white py-10">Loading resources...</div>;
  }

  if (resources.length === 0) {
    return (
      <div className="text-center py-10">
        <BuildingOfficeIcon className="h-16 w-16 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No resource bookings yet.</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      requested: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      declined: 'bg-red-500/20 text-red-400 border-red-500/30',
      conflict: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="space-y-4">
      {resources.map(booking => (
        <div key={booking.id} className="bg-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold text-white">{booking.resource_name}</h3>
              <p className="text-sm text-slate-400">{booking.resource_type}</p>
            </div>
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(booking.status)}`}>
              {booking.status}
            </span>
          </div>
          <div className="text-sm text-slate-300">
            <p>Quantity: {booking.quantity}</p>
            {booking.notes && <p className="mt-2">{booking.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

// Event Form Modal Component
const EventFormModal = ({ event, categories, campuses, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    campus: 'all_campuses',
    location: '',
    start_datetime: '',
    end_datetime: '',
    is_all_day: false,
    ministry: '',
    status: 'draft',
    visibility: 'public',
    capacity: '',
    registration_required: false,
    price: '',
    requires_payment: false,
    stripe_price_id: '',
    recurrence_rule: '',
    tags: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (event) {
      // Populate form with event data
      const startTime = event.start_datetime || event.start_time;
      const endTime = event.end_datetime || event.end_time;
      
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
        category_id: event.category_id || event.category?.id || '',
        campus: event.campus || 'all_campuses',
        location: event.location || '',
        start_datetime: formatForInput(startTime),
        end_datetime: formatForInput(endTime),
        is_all_day: event.is_all_day || false,
        ministry: event.ministry || '',
        status: event.status || 'draft',
        visibility: event.visibility || 'public',
        capacity: event.capacity || '',
        registration_required: event.registration_required || false,
        price: event.price || '',
        requires_payment: event.requires_payment || false,
        stripe_price_id: event.stripe_price_id || '',
        recurrence_rule: event.recurrence_rule || '',
        tags: event.tags || []
      });
    }
  }, [event]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = event ? `/api/events/${event.id}` : '/api/events';
      const method = event ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        start_datetime: formData.start_datetime ? new Date(formData.start_datetime).toISOString() : null,
        end_datetime: formData.end_datetime ? new Date(formData.end_datetime).toISOString() : null,
        price: formData.price ? parseFloat(formData.price) : null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        category_id: parseInt(formData.category_id) || null
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSave();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save event');
      }
    } catch (error) {
      console.error('Error saving event:', error);
      setError('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const ministries = ['Kids', 'Youth', 'Sunday Services', 'Prayer', 'Courses', 'Leadership', 'Worship', 'Other'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">
            {event ? 'Edit Event' : 'Create New Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <XMarkIcon className="w-6 h-6 text-white/60" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
              className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leadership Summit 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Category *
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Campus
              </label>
              <select
                name="campus"
                value={formData.campus}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_all_day"
              checked={formData.is_all_day}
              onChange={handleInputChange}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            <label className="text-white/80">All-day event</label>
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
              className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Main Auditorium, 123 Main St"
            />
          </div>

          {/* Ministry */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Ministry
            </label>
            <select
              name="ministry"
              value={formData.ministry}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select ministry</option>
              {ministries.map(ministry => (
                <option key={ministry} value={ministry}>
                  {ministry}
                </option>
              ))}
            </select>
          </div>

          {/* Status & Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Visibility
              </label>
              <select
                name="visibility"
                value={formData.visibility}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="leaders_only">Leaders Only</option>
              </select>
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
              className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Event description..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-300"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Registration */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                name="registration_required"
                checked={formData.registration_required}
                onChange={handleInputChange}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
              />
              <label className="text-white/80 font-medium">Registration Required</label>
            </div>

            {formData.registration_required && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Capacity (optional)
                </label>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="100"
                />
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                name="requires_payment"
                checked={formData.requires_payment}
                onChange={handleInputChange}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
              />
              <label className="text-white/80 font-medium">Requires Payment</label>
            </div>

            {formData.requires_payment && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="price_xxxxx"
                  />
                </div>
              </>
            )}
          </div>

          {/* Recurrence (simple for now) */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Recurrence Rule (iCal RRULE format, optional)
            </label>
            <input
              type="text"
              name="recurrence_rule"
              value={formData.recurrence_rule}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
            />
            <p className="text-xs text-slate-400 mt-1">
              Leave empty for one-time events. Use iCal RRULE format for recurring events.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : (event ? 'Update Event' : 'Create Event')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventsEnhanced;

