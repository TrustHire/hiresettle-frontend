'use client';
import { Copy } from 'lucide-react';
import { shortAddress, copyToClipboard, formatDate } from '@/lib/utils';
import type { Engagement } from '@/types';

export function EngagementMeta({ engagement: e }: { engagement: Engagement }) {
  const addressRows = [
    { label: 'Company',    value: e.companyAddress },
    { label: 'Recruiter',  value: e.recruiterAddress },
    { label: 'Arbiter',    value: e.arbiterAddress },
    { label: 'USDC contract', value: e.tokenAddress },
    { label: 'Creation tx',  value: e.txHash },
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

      {/* On-chain addresses */}
      <div className="space-y-2.5">
        {[
          { label: 'Created', value: null, display: formatDate(e.createdAt) },
          ...addressRows,
        ].map(({ label, value, display }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-gray-400 w-32 flex-shrink-0">{label}</span>
            {value ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-gray-700 truncate">{shortAddress(value, 6)}</span>
                <button onClick={() => copyToClipboard(value)}
                  className="text-gray-300 hover:text-gray-600 flex-shrink-0">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-gray-700">{display ?? '—'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
