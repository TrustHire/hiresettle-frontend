'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useOnline } from '@/lib/hooks/use-online';

const HEALTH_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '') + '/health';

export function OfflineBanner() {
  const online = useOnline();
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    let failures = 0;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(HEALTH_URL, { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('bad');
        failures = 0;
        if (!cancelled) setApiDown(false);
      } catch {
        failures += 1;
        if (failures >= 2 && !cancelled) setApiDown(true);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (online && !apiDown) return null;

  return (
    <div className="w-full bg-red-600 text-white text-sm px-4 py-2 flex items-center gap-2 justify-center">
      <WifiOff className="w-4 h-4" />
      <span>{online ? 'API unreachable — actions may fail.' : "You're offline."}</span>
    </div>
  );
}
