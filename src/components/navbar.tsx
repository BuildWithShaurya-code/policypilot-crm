'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Shield, Users, FileText, LayoutDashboard, LogOut, FileSpreadsheet, CalendarClock, Clock, BarChart3, Settings } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/renewals', label: 'Renewals', icon: CalendarClock },
    { href: '/follow-ups', label: 'Follow-ups', icon: Clock },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/policies', label: 'Policies', icon: FileText },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/import', label: 'Import Excel', icon: FileSpreadsheet },
  ];

  return (
    <nav
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(6, 9, 17, 0.85)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '74px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Shield size={20} color="#fff" />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
              Policy<span className="gradient-text">Pilot</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon size={16} color={isActive ? '#60a5fa' : 'currentColor'} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
              {profile?.full_name || 'PolicyPilot Administrator'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
          <Link
            href="/settings"
            className="btn-secondary"
            style={{
              padding: '8px 12px',
              fontSize: '0.8125rem',
              gap: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: pathname === '/settings' ? '#60a5fa' : 'inherit',
              borderColor: pathname === '/settings' ? 'rgba(59, 130, 246, 0.4)' : undefined,
            }}
            title="Automation & Notification Settings"
          >
            <Settings size={15} /> Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8125rem', gap: '6px' }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
