import React, { useEffect, useState } from 'react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 flex items-center gap-2.5 rounded-xl bg-stone-900/90 border border-amber-600/70 px-4 py-2.5 text-xs font-serif font-semibold text-amber-200 shadow-2xl backdrop-blur-md">
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
      <span>Modo Offline — sua estante e biblioteca funcionam perfeitamente sem internet.</span>
    </div>
  );
};
