import React from 'react';

/**
 * Safe Splash Screen - A completely static screen that:
 * - Has NO dependencies on auth, API, backend, or native services
 * - Shows immediately when app starts
 * - Contains only static content (logo + spinner)
 * - Is used during initial app boot before any logic runs
 */
export const SafeSplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[9999]">
      {/* Static logo/branding - no external dependencies */}
      <div className="flex flex-col items-center gap-6">
        {/* App icon using inline SVG to avoid external dependencies */}
        <div className="w-24 h-24 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <svg 
            className="w-14 h-14 text-primary-foreground" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
        </div>

        {/* App name */}
        <h1 className="text-2xl font-bold text-foreground">GigaServ</h1>

        {/* Simple CSS spinner - no JS animation dependencies */}
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />

        {/* Loading text */}
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

export default SafeSplashScreen;
