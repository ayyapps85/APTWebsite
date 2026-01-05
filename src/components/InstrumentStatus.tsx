'use client';

import { useState, useEffect } from 'react';
import { Instrument } from '@/data/instruments';
import { Member, membersList } from '@/data/members';
import { FirebaseService } from '@/lib/firebase-service';

interface InstrumentStatusProps {
  initialInstruments: Instrument[];
}

export default function InstrumentStatus({ initialInstruments }: InstrumentStatusProps) {
  const [instruments, setInstruments] = useState<Instrument[]>(initialInstruments);
  const [activeTab, setActiveTab] = useState<'available' | 'checkedOut'>('available');
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInstrumentsFromFirebase();
  }, []);

  const loadInstrumentsFromFirebase = async () => {
    try {
      setLoading(true);
      const firebaseInstruments = await FirebaseService.getAllInstruments();
      const mappedInstruments = firebaseInstruments.map((firebase: any) => ({
        id: firebase.id,
        name: firebase.name,
        type: firebase.type,
        image: firebase.image,
        isCheckedOut: firebase.status === 'checked_out',
        checkedOutBy: firebase.checkedOutBy,
        checkedOutAt: firebase.updatedAt
      }));
      setInstruments(mappedInstruments);
    } catch (error) {
      console.error('Failed to load from Firebase:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableInstruments = instruments.filter(item => !item.isCheckedOut);
  const checkedOutInstruments = instruments.filter(item => item.isCheckedOut);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length > 0) {
      const filtered = membersList.filter(member => 
        member.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredMembers(filtered);
    } else {
      setFilteredMembers([]);
    }
  };

  const handleCheckout = async (member: Member) => {
    if (!selectedInstrument) return;
    
    try {
      setLoading(true);
      await FirebaseService.updateInstrumentStatus(
        selectedInstrument.id,
        'checked_out',
        member.name
      );
      
      const updatedInstruments = instruments.map(inst => {
        if (inst.id === selectedInstrument.id) {
          return {
            ...inst,
            isCheckedOut: true,
            checkedOutBy: member.name,
            checkedOutAt: new Date().toISOString()
          };
        }
        return inst;
      });
      
      setInstruments(updatedInstruments);
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setLoading(false);
      setSelectedInstrument(null);
      setSearchQuery('');
      setFilteredMembers([]);
    }
  };

  const handleCheckIn = async (instrument: Instrument) => {
    try {
      setLoading(true);
      await FirebaseService.updateInstrumentStatus(
        instrument.id,
        'available',
        null
      );
      
      const updatedInstruments = instruments.map(item => 
        item.id === instrument.id ? {
          ...item,
          isCheckedOut: false,
          checkedOutBy: null,
          checkedOutAt: null
        } : item
      );
      setInstruments(updatedInstruments);
    } catch (error) {
      console.error('Check-in failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysCheckedOut = (checkedOutAt: any) => {
    if (!checkedOutAt) return '0 days';
    
    let date;
    if (checkedOutAt.seconds) {
      // Firebase Timestamp
      date = new Date(checkedOutAt.seconds * 1000);
    } else if (typeof checkedOutAt === 'string') {
      // ISO string
      date = new Date(checkedOutAt);
    } else {
      // Already a Date object
      date = new Date(checkedOutAt);
    }
    
    if (isNaN(date.getTime())) return '0 days';
    
    const days = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-8">APT Instrument Status</h1>
      {loading && (
        <div className="text-center mb-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-2 mb-6">
        <div className="flex">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'available' 
                ? 'bg-green-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Available ({availableInstruments.length})
          </button>
          <button
            onClick={() => setActiveTab('checkedOut')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'checkedOut' 
                ? 'bg-red-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Checked Out ({checkedOutInstruments.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {(activeTab === 'available' ? availableInstruments : checkedOutInstruments).map((instrument) => (
          <div key={instrument.id} className="bg-white rounded-lg shadow-md overflow-hidden relative">
            <div className="relative">
              <img 
                src={instrument.image} 
                alt={instrument.name}
                className="w-full h-48 object-cover"
              />
              {!instrument.isCheckedOut ? (
                <div className="absolute top-2 right-2 bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center">
                  ✓
                </div>
              ) : (
                <button
                  onClick={() => handleCheckIn(instrument)}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                >
                  ✓
                </button>
              )}
            </div>
            
            <div className="p-4">
              <h3 className="font-bold text-lg mb-2">{instrument.name}</h3>
              
              {instrument.isCheckedOut ? (
                <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-red-500">
                  <div className="flex items-center mb-2">
                    <span className="text-sm mr-2">👤</span>
                    <span className="text-red-600 font-semibold">{instrument.checkedOutBy}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm mr-2">📅</span>
                    <span className="text-orange-600 font-semibold">
                      {instrument.checkedOutAt && getDaysCheckedOut(instrument.checkedOutAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedInstrument(instrument)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Check Out
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedInstrument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Check Out: {selectedInstrument.name}</h2>
              <button
                onClick={() => {
                  setSelectedInstrument(null);
                  setSearchQuery('');
                  setFilteredMembers([]);
                }}
                className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center"
              >
                ×
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Search member name..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full p-3 border-2 border-blue-500 rounded-lg mb-4 bg-blue-50"
              autoFocus
            />
            
            <div className="max-h-48 overflow-y-auto">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleCheckout(member)}
                  className="w-full flex items-center p-2 hover:bg-gray-100 rounded-lg border-b border-gray-200"
                >
                  <div className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3 text-sm font-bold">
                    {member.name.charAt(0)}
                  </div>
                  <span className="text-gray-800">{member.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}