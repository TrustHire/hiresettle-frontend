'use client';

/**
 * ShareEngagementModal
 *
 * Shows a copyable deep link to an engagement plus a QR code of the same URL,
 * so a company can hand the engagement to its recruiter (or vice versa).
 * Visitors who aren't signed in are sent to login by the middleware and then
 * returned to this URL via `callbackUrl`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';
import { encodeQr, qrToSvgPath } from '@/lib/utils/qr';

interface Props {
  engagementId: string;
  isOpen: boolean;
  onClose: () => void;
}

const QR_BORDER = 4;

export function ShareEngagementModal({ engagementId, isOpen, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUrl(`${window.location.origin}/dashboard/engagements/${encodeURIComponent(engagementId)}`);
  }, [engagementId]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const qr = useMemo(() => {
    if (!url) return null;
    try {
      const modules = encodeQr(url);
      return { path: qrToSvgPath(modules, QR_BORDER), size: modules.length + QR_BORDER * 2 };
    } catch {
      return null;
    }
  }, [url]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await copyToClipboard(url);
      setCopied(true);
      toast.success('Engagement link copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-engagement-title"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 id="share-engagement-title" className="text-base font-semibold text-gray-900">
            Share engagement
          </h2>
          <button
            onClick={onClose}
            className="p-1 -mr-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close share dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Send this link to the counterparty or let them scan the code. They&apos;ll be asked
          to sign in with Freighter first if needed.
        </p>

        {qr && (
          <div className="flex justify-center mb-4">
            <svg
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              className="w-48 h-48 rounded-xl border border-gray-100"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR code for ${url}`}
            >
              <rect width={qr.size} height={qr.size} fill="#ffffff" />
              <path d={qr.path} fill="#111827" />
            </svg>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="input font-mono text-xs py-2"
            aria-label="Engagement link"
          />
          <button onClick={handleCopy} className="btn-secondary text-xs flex-shrink-0" disabled={!url}>
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
