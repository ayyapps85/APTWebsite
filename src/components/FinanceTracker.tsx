'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleOAuthService } from '@/lib/google-oauth';
import { FinanceSheetsService } from '@/lib/finance-sheets-service';
import { adults2025 } from '@/data/2025Adults';
import { kidsTeens2025 } from '@/data/2025KidsTeens';
import { coreAdults } from '@/data/CoreAdults';
import { coreTeensKids } from '@/data/CoreTeensKids';

interface Member {
  id: string;
  name: string;
}

interface PaymentRecord {
  memberName: string;
  status: string;
}

export default function FinanceTracker() {
  const [selectedSection, setSelectedSection] = useState('2025Adults');
  const [paymentStatus, setPaymentStatus] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthReady, setOauthReady] = useState(false);
  const { user } = useAuth();

  const sections = {
    '2025Adults': adults2025.map((name, index) => ({ id: `2025adults-${index + 1}`, name })),
    '2025KidsTeens': kidsTeens2025.map((name, index) => ({ id: `2025kidsteens-${index + 1}`, name })),
    'Core Adults': coreAdults.map((name, index) => ({ id: `coreadults-${index + 1}`, name })),
    'Core Teens Kids': coreTeensKids.map((name, index) => ({ id: `coreteenskids-${index + 1}`, name })),
  };

  useEffect(() => {
    GoogleOAuthService.initialize().then(() => {
      setOauthReady(true);
    });
  }, []);

  useEffect(() => {
    if (oauthReady) {
      loadPaymentStatus();
    }
  }, [selectedSection, oauthReady]);

  const loadPaymentStatus = async () => {
    try {
      setLoading(true);
      const accessToken = await GoogleOAuthService.getAccessToken();
      if (!accessToken) {
        console.error('No access token available');
        return;
      }
      
      const records = await FinanceSheetsService.getPaymentStatus(selectedSection, accessToken);
      const statusMap: Record<string, string> = {};
      records.forEach((record: PaymentRecord) => {
        statusMap[record.memberName] = record.status;
      });
      setPaymentStatus(statusMap);
    } catch (error) {
      console.error('Error loading payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentStatus = async (member: Member) => {
    if (!user) return;

    try {
      const accessToken = await GoogleOAuthService.getAccessToken();
      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      const currentStatus = paymentStatus[member.name];
      const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
      
      await FinanceSheetsService.updatePaymentStatus({
        memberName: member.name,
        section: selectedSection,
        status: newStatus,
        updatedBy: user.email || 'Unknown'
      }, accessToken);

      setPaymentStatus(prev => ({
        ...prev,
        [member.name]: newStatus
      }));
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const getFilteredMembers = () => {
    return sections[selectedSection as keyof typeof sections] || [];
  };

  const getStatusCounts = () => {
    const sectionMembers = getFilteredMembers();
    const paid = sectionMembers.filter(member => 
      paymentStatus[member.name] === 'paid'
    ).length;
    const unpaid = sectionMembers.length - paid;
    return { paid, unpaid };
  };

  const resetPaymentStatus = () => {
    setPaymentStatus({});
  };

  const counts = getStatusCounts();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-8">Finance Tracker</h1>
      
      {loading && (
        <div className="text-center mb-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        {!oauthReady && (
          <div className="text-center mb-4">
            <p className="text-gray-600">Initializing Google Sheets access...</p>
          </div>
        )}
        
        {/* Section Tabs and Controls */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2 overflow-x-auto">
            {Object.keys(sections).map((section) => (
              <button
                key={section}
                onClick={() => setSelectedSection(section)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  selectedSection === section
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {section}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="flex gap-4">
              <span className="text-green-600 font-semibold">Paid: {counts.paid}</span>
              <span className="text-red-600 font-semibold">Unpaid: {counts.unpaid}</span>
            </div>
            <button
              onClick={resetPaymentStatus}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              🔄 Reset
            </button>
          </div>
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unpaid Members */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-bold text-red-600 mb-2 text-center">Unpaid</h2>
          <div className="space-y-2">
            {getFilteredMembers()
              .filter(member => paymentStatus[member.name] !== 'paid')
              .map((member) => (
                <button
                  key={member.id}
                  onClick={() => togglePaymentStatus(member)}
                  className="w-full flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <span className="text-red-800">{member.name}</span>
                  <span className="text-red-600">❌</span>
                </button>
              ))}
          </div>
        </div>

        {/* Paid Members */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-bold text-green-600 mb-2 text-center">Paid</h2>
          <div className="space-y-2">
            {getFilteredMembers()
              .filter(member => paymentStatus[member.name] === 'paid')
              .map((member) => (
                <button
                  key={member.id}
                  onClick={() => togglePaymentStatus(member)}
                  className="w-full flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <span className="text-green-800 font-semibold">{member.name}</span>
                  <span className="text-green-600">✅</span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}