'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Instrument } from '@/data/instruments';
import { Member, membersList } from '@/data/members';
import { InstrumentsSheetsService } from '@/lib/instruments-sheets-service';
import { GoogleSignInService } from '@/lib/google-signin';
import { useAuth } from '@/contexts/AuthContext';

interface InstrumentStatusProps {
  initialInstruments: Instrument[];
}

export default function InstrumentStatus({ initialInstruments }: InstrumentStatusProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [instruments, setInstruments] = useState<Instrument[]>(initialInstruments);
  const [activeTab, setActiveTab] = useState<'available' | 'checkedOut'>('available');
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForceUpdate, setShowForceUpdate] = useState(false);

  // Refresh when switching tabs
  const handleTabChange = (tab: 'available' | 'checkedOut') => {
    setActiveTab(tab);
    loadInstrumentsFromSheets();
  };

  const loadInstrumentsFromSheets = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Loading instruments from sheets...');
      
      let accessToken = GoogleSignInService.getAccessToken();
      console.log('Access token available:', !!accessToken);
      
      if (!accessToken) {
        console.log('No access token available - user needs to sign in with Sheets permission');
        return;
      }
      
      console.log('Initializing instruments sheet...');
      await InstrumentsSheetsService.initializeInstruments(initialInstruments, accessToken);
      
      console.log('Loading instruments from Google Sheets...');
      const sheetsInstruments = await InstrumentsSheetsService.getAllInstruments(accessToken);
      console.log('Sheets instruments found:', sheetsInstruments.length, sheetsInstruments);
      
      const mappedInstruments = sheetsInstruments.map((sheet: any) => ({
        id: sheet.id,
        name: sheet.name,
        type: sheet.type,
        image: sheet.image,
        isCheckedOut: sheet.status === 'checked_out',
        checkedOutBy: sheet.checkedOutBy,
        checkedOutAt: sheet.checkedOutAt
      }));
      console.log('Mapped instruments:', mappedInstruments);
      setInstruments(mappedInstruments);
    } catch (error) {
      console.error('Failed to load from Google Sheets:', error);
    } finally {
      setLoading(false);
    }
  }, [initialInstruments, user]);

  useEffect(() => {
    loadInstrumentsFromSheets();
  }, [loadInstrumentsFromSheets]);

  useEffect(() => {
    // Refresh data when window gets focus (tab switching back)
    const handleFocus = () => {
      console.log('Window focused, refreshing instruments...');
      loadInstrumentsFromSheets();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Pull-to-refresh functionality
    let startY = 0;
    let isRefreshing = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        const currentY = e.touches[0].clientY;
        const pullDistance = currentY - startY;
        
        if (pullDistance > 100) {
          isRefreshing = true;
          loadInstrumentsFromSheets();
          setTimeout(() => { isRefreshing = false; }, 1000);
        }
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [loadInstrumentsFromSheets]);

  const forceUpdateSheets = async () => {
    try {
      setLoading(true);
      console.log('Force updating Google Sheets...');
      const accessToken = GoogleSignInService.getAccessToken();
      if (!accessToken) {
        console.error('No access token available');
        return;
      }
      
      await InstrumentsSheetsService.initializeInstruments(initialInstruments, accessToken);
      await loadInstrumentsFromSheets();
      setShowForceUpdate(false);
    } catch (error) {
      console.error('Force update failed:', error);
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
      const accessToken = GoogleSignInService.getAccessToken();
      if (!accessToken) {
        console.error('No access token available');
        return;
      }
      
      await InstrumentsSheetsService.updateInstrumentStatus(
        selectedInstrument.id,
        'checked_out',
        member.name,
        accessToken
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
      const accessToken = GoogleSignInService.getAccessToken();
      if (!accessToken) {
        console.error('No access token available');
        return;
      }
      
      await InstrumentsSheetsService.updateInstrumentStatus(
        instrument.id,
        'available',
        null,
        accessToken
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
    <div className="max-w-6xl mx-auto p-4">
      {loading && (
        <div className="text-center mb-2">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-gray-600 mt-1">Loading instruments...</p>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-md p-2 mb-2">
        <div className="flex">
          <button
            onClick={() => handleTabChange('available')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
              activeTab === 'available' 
                ? 'bg-green-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Available ({availableInstruments.length})
          </button>
          <button
            onClick={() => handleTabChange('checkedOut')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors text-sm ${
              activeTab === 'checkedOut' 
                ? 'bg-red-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Checked Out ({checkedOutInstruments.length})
          </button>
          {user?.email === 'ayyapps4u@gmail.com' && (
            <button
              onClick={() => setShowForceUpdate(true)}
              className="ml-2 py-2 px-3 rounded-lg font-medium transition-colors text-sm bg-orange-500 text-white hover:bg-orange-600"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {showForceUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-80">
            <h2 className="text-lg font-bold mb-3">Force Update Google Sheets?</h2>
            <p className="text-sm text-gray-600 mb-4">This will reinitialize the Google Sheet with current instrument data. Any checkout status will be lost.</p>
            <div className="flex gap-2">
              <button
                onClick={forceUpdateSheets}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
              >
                Update
              </button>
              <button
                onClick={() => setShowForceUpdate(false)}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {(activeTab === 'available' ? availableInstruments : checkedOutInstruments).map((instrument) => (
          <div key={instrument.id} className="bg-white rounded-lg shadow-md overflow-hidden relative">
            <div className="relative">
              <img 
                src={instrument.image} 
                alt={instrument.name}
                className="w-full h-24 object-cover"
                key={`${instrument.id}-${activeTab}`}
                onError={(e) => {
                  console.log('Image failed to load:', instrument.image);
                  // Try with ./images/ prefix for production
                  if (!e.currentTarget.src.startsWith('./images/')) {
                    e.currentTarget.src = instrument.image.replace('/images/', './images/');
                  }
                }}
              />
              {!instrument.isCheckedOut ? (
                <div className="absolute top-1 right-1 bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">
                  ✓
                </div>
              ) : (
                <button
                  onClick={() => handleCheckIn(instrument)}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center transition-colors text-xs"
                >
                  ✓
                </button>
              )}
            </div>
            
            <div className="p-2">
              <h3 className="font-bold text-xs mb-1 truncate">{instrument.name}</h3>
              
              {instrument.isCheckedOut ? (
                <div className="bg-gray-50 rounded p-1 border-l-2 border-red-500">
                  <div className="flex items-center mb-1">
                    <span className="text-xs mr-1">👤</span>
                    <span className="text-red-600 font-semibold text-xs truncate">{instrument.checkedOutBy}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs mr-1">📅</span>
                    <span className="text-orange-600 font-semibold text-xs">
                      {instrument.checkedOutAt && getDaysCheckedOut(instrument.checkedOutAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedInstrument(instrument)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded transition-colors text-xs"
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
          <div className="bg-white rounded-lg p-4 w-80 max-h-80">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Check Out: {selectedInstrument.name}</h2>
              <button
                onClick={() => {
                  setSelectedInstrument(null);
                  setSearchQuery('');
                  setFilteredMembers([]);
                }}
                className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-red-600"
              >
                ×
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Search member name..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full p-2 border-2 border-blue-500 rounded-lg mb-3 bg-blue-50 text-sm"
              autoFocus
            />
            
            <div className="max-h-40 overflow-y-auto">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleCheckout(member)}
                  className="w-full flex items-center p-2 hover:bg-gray-100 rounded-lg border-b border-gray-200 text-sm"
                >
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center mr-2 text-xs font-bold">
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