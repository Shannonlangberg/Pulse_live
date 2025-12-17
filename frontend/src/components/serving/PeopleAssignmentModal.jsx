import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon,
  UserPlusIcon,
  CheckIcon,
  XMarkIcon as XIcon,
  ClockIcon,
  CalendarIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

const PeopleAssignmentModal = ({ 
  isOpen, 
  onClose, 
  onAssign, 
  teamId, 
  roleName, 
  currentAssignments = [],
  campus = 'all' 
}) => {
  const [people, setPeople] = useState([]);
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    campus: campus,
    availability: 'all',
    servingHistory: 'all',
    skills: 'all'
  });
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchPeople();
    }
  }, [isOpen]);

  useEffect(() => {
    filterPeople();
  }, [people, searchQuery, selectedFilters]);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/people');
      if (response.ok) {
        const data = await response.json();
        setPeople(data.people || []);
      }
    } catch (err) {
      console.error('Error fetching people:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterPeople = () => {
    let filtered = people;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(person => 
        person.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Campus filter
    if (selectedFilters.campus && selectedFilters.campus !== 'all') {
      filtered = filtered.filter(person => person.campus === selectedFilters.campus);
    }

    // Availability filter (mock - would check actual availability)
    if (selectedFilters.availability === 'available') {
      filtered = filtered.filter(person => !person.is_busy);
    }

    // Serving history filter
    if (selectedFilters.servingHistory === 'experienced') {
      filtered = filtered.filter(person => person.serving_hours > 10);
    }

    setFilteredPeople(filtered);
  };

  const handleAssign = () => {
    if (selectedPerson) {
      onAssign(selectedPerson);
      onClose();
      setSelectedPerson(null);
    }
  };

  const getPersonAvailability = (person) => {
    // Mock availability - would come from actual availability system
    const availability = Math.random() > 0.3 ? 'Available' : 'Busy';
    return {
      status: availability,
      color: availability === 'Available' ? 'text-green-600' : 'text-red-600'
    };
  };

  const getPersonServingHistory = (person) => {
    // Mock serving history - would come from actual serving records
    const hours = Math.floor(Math.random() * 50);
    return {
      hours,
      level: hours > 30 ? 'Experienced' : hours > 10 ? 'Intermediate' : 'New'
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-600">
          <div>
            <h2 className="text-xl font-semibold text-white">Assign People to Role</h2>
            <p className="text-sm text-slate-400">
              {roleName} in {teamId} • Select from your database
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-slate-600 bg-slate-700/50">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search people by name, email, or skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                />
              </div>
            </div>

            {/* Campus Filter */}
            <select
              value={selectedFilters.campus}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, campus: e.target.value }))}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Campuses</option>
              <option value="copper_coast">Copper Coast</option>
              <option value="mt_barker">Mt Barker</option>
              <option value="adelaide_city">Adelaide City</option>
            </select>

            {/* Availability Filter */}
            <select
              value={selectedFilters.availability}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, availability: e.target.value }))}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Availability</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
            </select>

            {/* Experience Filter */}
            <select
              value={selectedFilters.servingHistory}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, servingHistory: e.target.value }))}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Experience</option>
              <option value="experienced">Experienced</option>
              <option value="intermediate">Intermediate</option>
              <option value="new">New</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-3 gap-6 p-6 h-96 overflow-y-auto">
            {loading ? (
              <div className="col-span-3 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="col-span-3 text-center text-slate-400 py-8">
                <UserPlusIcon className="h-12 w-12 mx-auto mb-4 text-slate-500" />
                <p>No people found matching your criteria</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              filteredPeople.map((person) => {
                const availability = getPersonAvailability(person);
                const servingHistory = getPersonServingHistory(person);
                const isAssigned = currentAssignments.some(p => p.id === person.id);
                const isSelected = selectedPerson?.id === person.id;

                return (
                  <div
                    key={person.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-900/20 ring-2 ring-blue-500/50' 
                        : isAssigned 
                          ? 'border-slate-600 bg-slate-700/50 opacity-60' 
                          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50 hover:shadow-md'
                    }`}
                    onClick={() => !isAssigned && setSelectedPerson(person)}
                  >
                    {/* Person Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                          {person.first_name?.[0]}{person.last_name?.[0]}
                        </div>
                        <div>
                          <h3 className="font-medium text-white">
                            {person.first_name} {person.last_name}
                          </h3>
                          <p className="text-sm text-slate-400">{person.email}</p>
                        </div>
                      </div>
                      
                      {isAssigned && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckIcon className="h-3 w-3 mr-1" />
                          Assigned
                        </span>
                      )}
                    </div>

                    {/* Person Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Campus:</span>
                        <span className="text-slate-200">{person.campus || 'Not Set'}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Availability:</span>
                        <span className={availability.color}>{availability.status}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Experience:</span>
                        <span className="text-slate-200">{servingHistory.level}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Serving Hours:</span>
                        <span className="text-slate-200">{servingHistory.hours}h</span>
                      </div>
                    </div>

                    {/* Skills/Tags */}
                    {person.skills && person.skills.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex flex-wrap gap-1">
                          {person.skills.slice(0, 3).map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {skill}
                            </span>
                          ))}
                          {person.skills.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              +{person.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {filteredPeople.length} people found • {filteredPeople.filter(p => !currentAssignments.some(cp => cp.id === p.id)).length} available
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={handleAssign}
              disabled={!selectedPerson}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedPerson
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Assign {selectedPerson ? `(${selectedPerson.first_name} ${selectedPerson.last_name})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeopleAssignmentModal;
