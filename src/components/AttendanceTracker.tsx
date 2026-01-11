'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleSheetsService } from '@/lib/google-sheets-service';
import { GoogleOAuthService } from '@/lib/google-oauth';
import { adults2025 } from '@/data/2025Adults';
import { kidsTeens2025 } from '@/data/2025KidsTeens';
import { coreAdults } from '@/data/CoreAdults';
import { coreTeensKids } from '@/data/CoreTeensKids';

interface Member {
  id: string;
  name: string;
}

interface AttendanceRecord {
  memberName: string;
  status: string;
}

interface AbsenceReport {
  memberName: string;
  section: string;
  totalAbsences: number;
  consecutiveAbsences: number;
  lastAbsentDate: string;
}

export default function AttendanceTracker() {
  const [selectedSection, setSelectedSection] = useState('2025 Adults');
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthReady, setOauthReady] = useState(false);
  const [oauthInitialized, setOauthInitialized] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [absenceReport, setAbsenceReport] = useState<AbsenceReport[]>([]);
  const [hasToken, setHasToken] = useState(false);
  const { user } = useAuth();

  const sections = {
    '2025 Adults': adults2025.map((name, index) => ({ id: `2025adults-${index + 1}`, name })),
    '2025 Kids Teens': kidsTeens2025.map((name, index) => ({ id: `2025kidsteens-${index + 1}`, name })),
    'Core Adults': coreAdults.map((name, index) => ({ id: `coreadults-${index + 1}`, name })),
    'Core Teens Kids': coreTeensKids.map((name, index) => ({ id: `coreteenskids-${index + 1}`, name })),
  };

  useEffect(() => {
    if (!oauthInitialized) {
      setOauthInitialized(true);
      GoogleOAuthService.initialize().then(() => {
        setOauthReady(true);
        // Check if we have a stored token
        const token = localStorage.getItem('google_access_token');
        setHasToken(!!token);
      });
    }
  }, []);

  useEffect(() => {
    if (oauthReady) {
      loadTodayAttendance();
      
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
            loadTodayAttendance();
            setTimeout(() => { isRefreshing = false; }, 1000);
          }
        }
      };
      
      document.addEventListener('touchstart', handleTouchStart);
      document.addEventListener('touchmove', handleTouchMove);
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, [selectedSection, oauthReady]);

  // Auto-absence at 7:49 PM EST
  useEffect(() => {
    const checkAutoAbsence = async () => {
      const now = new Date();
      const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const currentHour = estTime.getHours();
      const currentMinute = estTime.getMinutes();
      
      // Check if it's exactly 7:49 PM EST
      if (currentHour === 19 && currentMinute === 49 && oauthReady && user) {
        console.log('Auto-absence triggered at 7:49 PM EST');
        try {
          const accessToken = await GoogleOAuthService.getAccessToken();
          if (!accessToken) return;
          
          // Only run auto-absence for sections that had attendance activity today
          const allSections = Object.keys(sections);
          for (const section of allSections) {
            const todayRecords = await GoogleSheetsService.getTodayAttendance(section, accessToken);
            
            console.log(`Section ${section}: ${todayRecords.length} attendance records today`);
            
            // Only mark absent if there were some attendance records today (indicating a meeting)
            if (todayRecords.length > 0) {
              const presentMembers = new Set(todayRecords.map((r: any) => r.memberName));
              const sectionMembers = sections[section as keyof typeof sections];
              
              console.log(`Section ${section}: ${presentMembers.size} present, ${sectionMembers.length - presentMembers.size} to mark absent`);
              
              // Mark absent members who haven't been marked present
              for (const member of sectionMembers) {
                if (!presentMembers.has(member.name)) {
                  console.log(`Marking ${member.name} as absent in ${section}`);
                  await GoogleSheetsService.appendAttendanceRecord({
                    date: new Date().toISOString().split('T')[0],
                    section: section,
                    memberName: member.name,
                    status: 'absent',
                    recordedBy: 'System Auto-Absence'
                  }, accessToken);
                }
              }
            }
          }
        } catch (error) {
          console.error('Auto-absence error:', error);
        }
      }
    };
    
    // Check every minute to catch the exact time
    const interval = setInterval(checkAutoAbsence, 60 * 1000);
    // Also check immediately
    checkAutoAbsence();
    
    return () => clearInterval(interval);
  }, [oauthReady, user]);

  const connectToSheets = async () => {
    try {
      const token = await GoogleOAuthService.getAccessToken();
      if (token) {
        setHasToken(true);
        loadTodayAttendance();
      }
    } catch (error) {
      console.error('Failed to connect to Google Sheets:', error);
    }
  };

  const loadTodayAttendance = async () => {
    try {
      setLoading(true);
      const { GoogleSignInService } = await import('@/lib/google-signin');
      const accessToken = GoogleSignInService.getAccessToken();
      if (!accessToken) {
        console.log('No access token - user needs to sign in');
        return;
      }
      
      const records = await GoogleSheetsService.getTodayAttendance(selectedSection, accessToken);
      const statusMap: Record<string, string> = {};
      records.forEach((record: AttendanceRecord) => {
        statusMap[record.memberName] = record.status;
      });
      setAttendanceStatus(statusMap);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAbsenceReport = async () => {
    try {
      setLoading(true);
      const accessToken = await GoogleOAuthService.getAccessToken();
      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      const allData = await GoogleSheetsService.getAllAttendanceData(accessToken);
      console.log('All attendance data:', allData);
      console.log('Selected section:', selectedSection);
      
      const report: AbsenceReport[] = [];
      
      // Calculate date range (current day to 60 days prior)
      const currentDate = new Date();
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(currentDate.getDate() - 60);
      
      // Filter data to last 60 days and selected section only
      const recentData = allData.filter((record: any) => {
        const recordDate = new Date(record.date);
        const isInDateRange = recordDate >= sixtyDaysAgo && recordDate <= currentDate;
        const isSameSection = record.section === selectedSection;
        console.log(`Record: ${record.memberName}, Section: ${record.section}, Date: ${record.date}, InRange: ${isInDateRange}, SameSection: ${isSameSection}`);
        return isInDateRange && isSameSection;
      });
      
      console.log('Filtered recent data:', recentData);
      
      // Group by member and section
      const memberData: Record<string, any[]> = {};
      recentData.forEach((record: any) => {
        const key = `${record.memberName}-${record.section}`;
        if (!memberData[key]) {
          memberData[key] = [];
        }
        memberData[key].push(record);
      });

      console.log('Member data grouped:', memberData);

      // Calculate absence statistics
      Object.entries(memberData).forEach(([key, records]) => {
        const [memberName, section] = key.split('-');
        
        // Group records by date to count unique absent days
        const recordsByDate: Record<string, any[]> = {};
        records.forEach(record => {
          if (!recordsByDate[record.date]) {
            recordsByDate[record.date] = [];
          }
          recordsByDate[record.date].push(record);
        });
        
        // Count days where member was absent (regardless of how many times marked absent that day)
        const absentDays = Object.entries(recordsByDate).filter(([date, dayRecords]) => {
          return dayRecords.some(r => r.status === 'absent');
        });
        
        const totalAbsences = absentDays.length;
        
        console.log(`${memberName}: ${totalAbsences} absent days`);
        
        // Only include members with 1 or more absent days
        if (totalAbsences >= 1) {
          // Get the most recent absent date
          const lastAbsentDate = absentDays[absentDays.length - 1][0];
          
          // Calculate consecutive absent days from the end
          let consecutiveAbsences = 0;
          const sortedDates = Object.keys(recordsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          for (const date of sortedDates) {
            const dayRecords = recordsByDate[date];
            if (dayRecords.some(r => r.status === 'absent')) {
              consecutiveAbsences++;
            } else {
              break;
            }
          }

          report.push({
            memberName,
            section,
            totalAbsences,
            consecutiveAbsences,
            lastAbsentDate
          });
        }
      });

      console.log('Final report:', report);
      // Sort by total absences descending
      report.sort((a, b) => b.totalAbsences - a.totalAbsences);
      setAbsenceReport(report);
      setShowReport(true);
    } catch (error) {
      console.error('Error generating absence report:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = async (member: Member) => {
    if (!user) return;

    try {
      const accessToken = await GoogleOAuthService.getAccessToken();
      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      const currentStatus = attendanceStatus[member.name];
      const newStatus = currentStatus === 'present' ? 'absent' : 'present';
      
      await GoogleSheetsService.appendAttendanceRecord({
        date: new Date().toISOString().split('T')[0],
        section: selectedSection,
        memberName: member.name,
        status: newStatus,
        recordedBy: user.email || 'Unknown'
      }, accessToken);

      setAttendanceStatus(prev => ({
        ...prev,
        [member.name]: newStatus
      }));
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  const getFilteredMembers = () => {
    return sections[selectedSection as keyof typeof sections] || [];
  };

  const getStatusCounts = () => {
    const sectionMembers = getFilteredMembers();
    const present = sectionMembers.filter(member => 
      attendanceStatus[member.name] === 'present'
    ).length;
    const absent = sectionMembers.length - present;
    return { present, absent };
  };

  const resetAttendance = () => {
    setAttendanceStatus({});
  };

  const counts = getStatusCounts();

  if (showReport) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-red-600">{`Absence Report - ${selectedSection}`}</h2>
            <button
              onClick={() => setShowReport(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Back to Attendance
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 border">Member Name</th>
                  <th className="text-left p-2 border">Section</th>
                  <th className="text-center p-2 border">Total Absences</th>
                  <th className="text-center p-2 border">Consecutive Absences</th>
                  <th className="text-center p-2 border">Last Absent Date</th>
                </tr>
              </thead>
              <tbody>
                {absenceReport.map((item, index) => (
                  <tr key={index} className={item.totalAbsences > 2 ? 'bg-red-50' : ''}>
                    <td className="p-2 border font-semibold">{item.memberName}</td>
                    <td className="p-2 border">{item.section}</td>
                    <td className="p-2 border text-center">
                      <span className={`px-2 py-1 rounded ${item.totalAbsences > 2 ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                        {item.totalAbsences}
                      </span>
                    </td>
                    <td className="p-2 border text-center">
                      <span className={`px-2 py-1 rounded ${item.consecutiveAbsences > 1 ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-800'}`}>
                        {item.consecutiveAbsences}
                      </span>
                    </td>
                    <td className="p-2 border text-center">{item.lastAbsentDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {absenceReport.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No absence records found.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {loading && (
        <div className="text-center mb-2">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {!hasToken && oauthReady && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-center">
          <p className="text-yellow-800 mb-2">Connect to Google Sheets to track attendance</p>
          <button
            onClick={connectToSheets}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            📊 Connect to Google Sheets
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-3 mb-2">
        {/* Section Tabs */}
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(sections).map((section) => (
            <button
              key={section}
              onClick={() => setSelectedSection(section)}
              className={`px-2 py-2 rounded-lg transition-colors text-xs leading-tight text-center ${
                selectedSection === section
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {section}
            </button>
          ))}
        </div>
      </div>

      {/* Counts and Buttons */}
      <div className="bg-white rounded-lg shadow-md p-2 mb-2">
        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <span className="text-green-600 font-semibold">Present: {counts.present}</span>
            <span className="text-red-600 font-semibold">Absent: {counts.absent}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateAbsenceReport}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg transition-colors text-sm"
            >
              📊 Absence Report
            </button>
            <button
              onClick={resetAttendance}
              className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-lg transition-colors text-sm"
            >
              🔄 Reset
            </button>
          </div>
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Absent Members */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-bold text-red-600 mb-2 text-center">Absent</h2>
          <div className="space-y-2">
            {getFilteredMembers()
              .filter(member => attendanceStatus[member.name] !== 'present')
              .map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleAttendance(member)}
                  className="w-full flex justify-between items-center p-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm"
                >
                  <span className="text-red-800">{member.name}</span>
                  <span className="text-red-600">❌</span>
                </button>
              ))}
          </div>
        </div>

        {/* Present Members */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-bold text-green-600 mb-2 text-center">Present</h2>
          <div className="space-y-2">
            {getFilteredMembers()
              .filter(member => attendanceStatus[member.name] === 'present')
              .map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleAttendance(member)}
                  className="w-full flex justify-between items-center p-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-sm"
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