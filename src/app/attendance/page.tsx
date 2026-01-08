'use client';

import AttendanceTracker from '@/components/AttendanceTracker';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function AttendancePage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please sign in to access attendance tracking</p>
          <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={process.env.NODE_ENV === 'production' ? '/APTWebsite/images/ATPLogo.png' : '/images/ATPLogo.png'} alt="ATP Logo" className="h-12 w-12" />
            <div className="flex items-center gap-4">
              <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
                Instruments
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-xl font-semibold">Attendance</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {user.displayName}</span>
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
      <AttendanceTracker />
    </main>
  );
}