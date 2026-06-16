import { useState, useEffect } from 'react';
import React from 'react';

function Header() {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    setCurrentDate(formattedDate);
  }, []);

  return (
    <header className="w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 fixed top-0 z-50 transition-all duration-300">
      <div className="mx-auto h-full flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex-shrink-0 p-1 bg-slate-50 border border-slate-100 rounded-xl shadow-xs">
            <img
              className="w-9 h-9 object-contain"
              src="/logoWithoutLabel.png"
              alt="DOST Logo"
            />
          </div>

          {/* Title */}
          <h1 className="text-lg font-extrabold tracking-tight text-slate-800 font-sans">
            Budget Document Logging System
          </h1>
        </div>

        {/* Current Date Badge */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div className="text-xs font-bold tracking-widest text-slate-600 bg-slate-50/80 border border-slate-200/60 rounded-full px-4 py-1.5 shadow-2xs">
            {currentDate.toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
