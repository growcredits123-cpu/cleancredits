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
        <div className="flex min-h-screen">
          <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-5 flex items-center gap-2 border-b border-gray-200">
              <div className="w-8 h-8 rounded-lg bg-eco-500 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">GrowCredits</span>
              <span className="text-xs text-gray-400 ml-1">Admin</span>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
