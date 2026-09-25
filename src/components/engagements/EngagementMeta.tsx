'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import {
  shortAddress,
  copyToClipboard,
  formatDate,
  explorerTxUrl,
  explorerAccountUrl,
} from '@/lib/utils';
import type { Engagement } from '@/types';

// ── Small reusable pieces ──────────────────────────────────────────────────────

/** Copy-to-clipboard button with a brief checkmark feedback tick. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
      className="text-gray-300 hover:text-gray-600 flex-shrink-0 transition-colors"
    >
      {copied
        ? <Check className="w-3 h-3 text-green-500" />
        : <Copy className="w-3 h-3" />}
    </button>
  );
}

/** Shortened address with copy button and explorer link. */
function AddressCell({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-gray-700 truncate">{shortAddress(value, 6)}</span>
      <CopyButton value={value} />
      <a
        href={explorerAccountUrl(value)}
        target="_blank"
        rel="noreferrer"
        title="View on stellar.expert"
        aria-label="View on stellar.expert"
        className="text-gray-300 hover:text-brand-600 flex-shrink-0 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

/** Shortened tx hash with copy button and explorer link. */
function TxCell({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-gray-700 truncate">{shortAddress(value, 6)}</span>
      <CopyButton value={value} />
      <a
        href={explorerTxUrl(value)}
        target="_blank"
        rel="noreferrer"
        title="View transaction on stellar.expert"
        aria-label="View transaction on stellar.expert"
        className="text-gray-300 hover:text-brand-600 flex-shrink-0 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

type Row =
  | { label: string; kind: 'address'; value: string }
  | { label: string; kind: 'tx';      value: string }
  | { label: string; kind: 'text';    value: string | null };

export function EngagementMeta({ engagement: e }: { engagement: Engagement }) {
  const rows: Row[] = [
    { label: 'Created',       kind: 'text',    value: formatDate(e.createdAt) },
    { label: 'Company',       kind: 'address', value: e.companyAddress },
    { label: 'Recruiter',     kind: 'address', value: e.recruiterAddress },
    { label: 'Arbiter',       kind: 'address', value: e.arbiterAddress },
    { label: 'USDC contract', kind: 'address', value: e.tokenAddress },
    ...(e.txHash
      ? [{ label: 'Creation tx', kind: 'tx' as const, value: e.txHash }]
      : []),
  ];

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Details</h2>

      {/* Off-chain metadata */}
      {(e.salaryRange || e.location || e.jobDescription) && (
        <div className="mb-4 pb-4 border-b border-gray-50 space-y-2">
          {e.salaryRange && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 w-28">Salary range</span>
              <span className="text-gray-700">{e.salaryRange}</span>
            </div>
          )}
          {e.location && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 w-28">Location</span>
              <span className="text-gray-700">{e.location}</span>
            </div>
          )}
          {e.jobDescription && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-gray-400 w-28 flex-shrink-0">Description</span>
              <span className="text-gray-700 leading-relaxed">{e.jobDescription}</span>
            </div>
          )}
        </div>
      )}

      {/* On-chain rows */}
      <div className="space-y-2.5">
        {rows.map(({ label, kind, value }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-gray-400 w-32 flex-shrink-0">{label}</span>

            {kind === 'address' && value ? (
              <AddressCell value={value} />
            ) : kind === 'tx' && value ? (
              <TxCell value={value} />
            ) : (
              <span className="text-gray-700">{value ?? '—'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
