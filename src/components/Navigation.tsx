'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { hasAttendanceAccess, hasFinanceAccess } from '@/lib/auth';

export default function Navigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    ...(hasAttendanceAccess(user?.email || null) ? [{ name: 'Attendance', path: '/attendance', icon: '📋' }] : []),
    { name: 'Instruments', path: '/', icon: '🎵' },
    ...(hasFinanceAccess(user?.email || null) ? [{ name: 'Finance', path: '/finance', icon: '💰' }] : [])
  ];

  const isActive = (itemPath: string) => {
    if (itemPath === '/') {
      return pathname === '/' || pathname === '';
    }
    return pathname.startsWith(itemPath);
  };

  return (
    <header className="bg-white shadow-md border-b">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            <img 
              src={process.env.NODE_ENV === 'production' ? '/APTWebsite/images/ATPLogo.png' : '/images/ATPLogo.png'} 
              alt="ATP Logo" 
              className="h-10 w-10" 
            />
            <h1 className="text-xl font-bold text-gray-800">Atlanta Parai Team</h1>
          </div>
          
          {/* User Info and Logout */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md transition-colors text-xs"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
      
      {/* Navigation Bar */}
      <div className="bg-gray-50 border-t">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors text-sm border-b-2 ${
                  isActive(item.path)
                    ? 'text-red-600 border-red-600 bg-white'
                    : 'text-gray-600 hover:text-red-600 border-transparent hover:border-gray-300'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}