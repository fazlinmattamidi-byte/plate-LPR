'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Search, Camera, Car, History } from 'lucide-react';
import { clsx } from 'clsx';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutGrid },
    { label: 'Search', href: '/search', icon: Search },
    { label: 'Scanner', href: '/scanner', icon: Camera, isCenter: true },
    { label: 'Manage', href: '/manage', icon: Car },
    { label: 'History', href: '/history', icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090a0f]/95 backdrop-blur-lg border-t border-[#252833] pb-safe">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-3 flex flex-col items-center justify-center group"
              >
                <div
                  className={clsx(
                    'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all transform group-active:scale-95',
                    isActive
                      ? 'bg-[#00d8f6] text-slate-950 shadow-[#00d8f6]/40 scale-105'
                      : 'bg-[#16181e] text-[#00d8f6] border border-[#00d8f6]/40 shadow-black/50 hover:bg-[#00d8f6]/10'
                  )}
                >
                  <Icon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span
                  className={clsx(
                    'text-[10px] font-medium mt-1 tracking-tight',
                    isActive ? 'text-[#00d8f6] font-bold' : 'text-slate-400'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center w-14 py-1 transition-colors',
                isActive ? 'text-[#00d8f6]' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon className={clsx('w-5 h-5 mb-0.5', isActive && 'stroke-[2.2]')} />
              <span className={clsx('text-[11px] font-medium', isActive && 'font-bold')}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
