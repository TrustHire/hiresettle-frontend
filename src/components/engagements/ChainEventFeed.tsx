'use client';

import { useState } from 'react';
import { ExternalLink, Copy, Check, Activity } from 'lucide-react';
import { explorerTxUrl, shortAddress, copyToClipboard, timeAgo } from '@/lib/utils';
import type { ChainEvent } from '@/types';

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handle}
      title="Copy tx hash"
      aria-label="Copy tx hash"
      className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0"
    >
      {copied
        ? <Check className="w-3 h-3 text-green-500" />
        : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Human-readable event name ─────────────────────────────────────────────────

function eventLabel(name: string): string {
  const map: Record<string, string> = {
    EngagementCreated:     'Engagement created',
    MilestoneUnlocked:     'Milestone unlocked',
    ProofSubmitted:        'Proof submitted',
    MilestoneConfirmed:    'Milestone confirmed',
    DisputeRaised:         'Dispute raised',
    DisputeResolved:       'Dispute resolved',
    ReplacementRequested:  'Replacement requested',
    ReplacementApproved:   'Replacement approved',
  };
  return map[name] ?? name;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  events: ChainEvent[];
}

export function ChainEventFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">On-chain activity</h2>
        <p className="text-sm text-gray-400 text-center py-4">No on-chain events recorded yet.</p>
      </div>
    );
  }

  // Show newest first
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">On-chain activity</h2>

      <ul className="divide-y divide-gray-50">
        {sorted.map((event) => (
          <li key={event.id} className="py-3 flex items-start gap-3">
            {/* Icon */}
            <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Activity className="w-3 h-3 text-brand-600" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900">{eventLabel(event.eventName)}</p>

              {/* Tx hash row */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-400">Ledger {event.ledger.toLocaleString()} ·</span>
                <span className="font-mono text-[10px] text-gray-500">
                  {shortAddress(event.txHash, 6)}
                </span>
                <CopyButton value={event.txHash} />
                <a
                  href={explorerTxUrl(event.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  title="View on stellar.expert"
                  aria-label="View transaction on stellar.expert"
                  className="text-gray-300 hover:text-brand-600 transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Timestamp */}
            <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
              {timeAgo(event.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
