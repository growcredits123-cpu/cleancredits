import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutDashboard, Coins, MapPin, ShieldAlert, Leaf } from 'lucide-react';

export const metadata: Metadata = {
  title: 'GrowCredits Admin',
  description: 'Admin panel for GrowCredits marketplace',
};

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tokens', label: 'Issue Tokens', icon: Coins },
  { href: '/recycling', label: 'Recycling Review', icon: MapPin },
  { href: '/moderation', label: 'Moderation', icon: ShieldAlert },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
          <aside className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col md:h-screen md:sticky top-0 z-10">
            <div className="p-4 md:p-5 flex items-center gap-2 border-b border-gray-200">
              <div className="w-8 h-8 rounded-lg bg-eco-500 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">GrowCredits</span>
              <span className="text-xs text-gray-400 ml-1">Admin</span>
            </div>
            <nav className="flex md:flex-col overflow-x-auto p-2 md:p-3 space-x-2 md:space-x-0 md:space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <item.icon className="w-4 h-4 md:w-4 md:h-4" />
                  <span className="hidden sm:inline-block">{item.label}</span>
                  <span className="sm:hidden text-xs">{item.label.split(' ')[0]}</span>
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
