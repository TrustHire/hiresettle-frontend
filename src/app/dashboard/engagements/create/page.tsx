'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import { StrKey } from '@stellar/stellar-sdk';
import { createEngagement } from '@/lib/stellar/contract';
import { engagementsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { generateEngagementId, usdcToStroops } from '@/lib/utils';
import type { MilestoneInput } from '@/types';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS!;

const DEFAULT_MILESTONES: MilestoneInput[] = [
  { name: 'Candidate Placed',  paymentPercent: 30, kind: 'PLACEMENT' },
  { name: '30-Day Retention',  paymentPercent: 40, kind: 'RETENTION', retentionDays: 30 },
  { name: '90-Day Retention',  paymentPercent: 30, kind: 'RETENTION', retentionDays: 90 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** True when s is a non-empty valid Ed25519 public key (G…). */
function isValidStellarAddress(s: string): boolean {
  return s.trim().length > 0 && StrKey.isValidEd25519PublicKey(s.trim());
}

/**
 * Returns an error message when the amount string is invalid, otherwise null.
 * Rules: must be a positive number with at most 7 decimal places.
 */
function amountError(value: string): string | null {
  if (value.trim() === '') return 'Amount is required.';
  const num = Number(value);
  if (isNaN(num) || num <= 0) return 'Amount must be a positive number.';
  // Check decimal places ≤ 7
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > 7) {
    return 'Amount may have at most 7 decimal places.';
  }
  return null;
}

/**
 * Returns an error message when retentionDays is invalid, otherwise null.
 * Must be a positive integer.
 */
function retentionDaysError(value: number | undefined): string | null {
  if (value === undefined || value === null) return 'Retention days is required.';
  if (!Number.isInteger(value) || value <= 0) return 'Must be a positive whole number.';
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CreateEngagementPage() {
  const router = useRouter();
  const { address } = useAuthStore();

  const [engagementId]   = useState(generateEngagementId);
  const [recruiterAddress, setRecruiterAddress] = useState('');
  const [arbiterAddress, setArbiterAddress]     = useState('');
  const [totalUsdc, setTotalUsdc]               = useState('');
  const [jobTitle, setJobTitle]                 = useState('');
  const [jobDescription, setJobDescription]     = useState('');
  const [salaryRange, setSalaryRange]           = useState('');
  const [location, setLocation]                 = useState('');
  const [milestones, setMilestones]             = useState<MilestoneInput[]>(DEFAULT_MILESTONES);
  const [loading, setLoading]                   = useState(false);
  const [txStep, setTxStep]                     = useState('');
  const [submitError, setSubmitError]           = useState<string | null>(null);

  // ── Derived validation ───────────────────────────────────────────────────────

  const recruiterError = useMemo<string | null>(() => {
    if (recruiterAddress.trim() === '') return null; // empty = pristine, no error yet
    if (!isValidStellarAddress(recruiterAddress)) return 'Not a valid Stellar public key (G…).';
    return null;
  }, [recruiterAddress]);

  const arbiterError = useMemo<string | null>(() => {
    if (arbiterAddress.trim() === '') return null;
    if (!isValidStellarAddress(arbiterAddress)) return 'Not a valid Stellar public key (G…).';
    return null;
  }, [arbiterAddress]);

  /** Uniqueness errors — only shown when the individual field is otherwise valid. */
  const uniquenessErrors = useMemo<{ recruiter?: string; arbiter?: string }>(() => {
    const errors: { recruiter?: string; arbiter?: string } = {};
    const r = recruiterAddress.trim();
    const ar = arbiterAddress.trim();
    const co = address?.trim() ?? '';

    if (r && isValidStellarAddress(r)) {
      if (co && r === co) errors.recruiter = 'Recruiter address must differ from your company address.';
      else if (ar && isValidStellarAddress(ar) && r === ar) errors.recruiter = 'Recruiter and arbiter addresses must be different.';
    }
    if (ar && isValidStellarAddress(ar)) {
      if (co && ar === co) errors.arbiter = 'Arbiter address must differ from your company address.';
    }
    return errors;
  }, [recruiterAddress, arbiterAddress, address]);

  const amountErr = useMemo<string | null>(() => {
    if (totalUsdc.trim() === '') return null; // pristine
    return amountError(totalUsdc);
  }, [totalUsdc]);

  const totalPercent = milestones.reduce((s, m) => s + (Number(m.paymentPercent) || 0), 0);
  const percentValid = totalPercent === 100;

  /** Per-milestone retentionDays errors, keyed by index. */
  const milestoneRetentionErrors = useMemo<Record<number, string>>(() => {
    const errs: Record<number, string> = {};
    milestones.forEach((m, i) => {
      if (m.kind === 'RETENTION') {
        const err = retentionDaysError(m.retentionDays);
        if (err) errs[i] = err;
      }
    });
    return errs;
  }, [milestones]);

  /** True only when every required field passes all rules. */
  const formIsValid = useMemo<boolean>(() => {
    if (!jobTitle.trim()) return false;
    if (!recruiterAddress.trim() || !isValidStellarAddress(recruiterAddress)) return false;
    if (!arbiterAddress.trim() || !isValidStellarAddress(arbiterAddress)) return false;
    if (Object.keys(uniquenessErrors).length > 0) return false;
    if (amountError(totalUsdc) !== null) return false;
    if (!percentValid) return false;
    if (Object.keys(milestoneRetentionErrors).length > 0) return false;
    return true;
  }, [
    jobTitle, recruiterAddress, arbiterAddress, uniquenessErrors,
    totalUsdc, percentValid, milestoneRetentionErrors,
  ]);

  // ── Milestone helpers ────────────────────────────────────────────────────────

  const retentionDays = milestones
    .filter((m) => m.kind === 'RETENTION')
    .map((m) => m.retentionDays ?? 30);

  const addMilestone = () =>
    setMilestones([...milestones, { name: '', paymentPercent: 0, kind: 'PLACEMENT' }]);

  const removeMilestone = (i: number) =>
    setMilestones(milestones.filter((_, idx) => idx !== i));

  const update = (i: number, field: keyof MilestoneInput, value: any) =>
    setMilestones(milestones.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !formIsValid) return;
    setSubmitError(null);
    setLoading(true);

    try {
      setTxStep('Building transaction…');
      const txHash = await createEngagement({
        callerAddress: address,
        engagementId,
        recruiter: recruiterAddress,
        arbiter: arbiterAddress,
        tokenAddress: USDC_ADDRESS,
        totalAmount: usdcToStroops(totalUsdc),
        jobTitle,
        milestones,
        retentionDays,
      });

      setTxStep('Saving to backend…');
      await engagementsApi.create({
        engagementId,
        companyAddress: address,
        recruiterAddress,
        arbiterAddress,
        tokenAddress: USDC_ADDRESS,
        totalAmount: usdcToStroops(totalUsdc).toString(),
        jobTitle,
        jobDescription: jobDescription || undefined,
        salaryRange: salaryRange || undefined,
        location: location || undefined,
        milestones,
        retentionDays,
        txHash,
      });

      router.push(`/dashboard/engagements/${engagementId}`);
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Transaction failed. Please try again.');
    } finally {
      setLoading(false);
      setTxStep('');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/engagements"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-xl font-semibold text-gray-900 mb-1">New engagement</h1>
      <p className="text-sm text-gray-500 mb-6">
        Lock the recruiter fee in a Soroban escrow contract. The fee releases automatically as milestones are confirmed.
      </p>

      {submitError && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>

        {/* ── Job details ── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Job details</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Engagement ID</label>
              <input value={engagementId} readOnly
                className="input bg-gray-50 text-gray-500 font-mono text-xs" />
              <p className="text-xs text-gray-400 mt-1">Auto-generated — unique on-chain identifier</p>
            </div>

            <div>
              <label className="label">Job title <span className="text-red-500">*</span></label>
              <input placeholder="e.g. Senior Software Engineer" value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)} required className="input" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Salary range</label>
                <input placeholder="$120k – $160k" value={salaryRange}
                  onChange={(e) => setSalaryRange(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Location</label>
                <input placeholder="Remote / New York" value={location}
                  onChange={(e) => setLocation(e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Description (optional)</label>
              <textarea placeholder="Role summary…" value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3} className="input resize-none" />
            </div>

            <div>
              <label className="label">Total recruiter fee (USDC) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 10000"
                value={totalUsdc}
                onChange={(e) => setTotalUsdc(e.target.value)}
                aria-invalid={amountErr !== null}
                className={`input ${amountErr ? 'border-red-400 focus:ring-red-300' : ''}`}
              />
              {amountErr && <FieldError message={amountErr} />}
            </div>
          </div>
        </div>

        {/* ── Parties ── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Parties</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Your address (company)</label>
              <input value={address ?? ''} readOnly
                className="input bg-gray-50 text-gray-500 font-mono text-xs" />
            </div>

            <div>
              <label className="label">Recruiter Stellar address <span className="text-red-500">*</span></label>
              <input
                placeholder="G..."
                value={recruiterAddress}
                onChange={(e) => setRecruiterAddress(e.target.value)}
                aria-invalid={!!(recruiterError || uniquenessErrors.recruiter)}
                className={`input font-mono text-xs ${
                  (recruiterError || uniquenessErrors.recruiter) ? 'border-red-400 focus:ring-red-300' : ''
                }`}
              />
              {recruiterError    && <FieldError message={recruiterError} />}
              {!recruiterError && uniquenessErrors.recruiter && <FieldError message={uniquenessErrors.recruiter} />}
            </div>

            <div>
              <label className="label">Arbiter Stellar address <span className="text-red-500">*</span></label>
              <input
                placeholder="G..."
                value={arbiterAddress}
                onChange={(e) => setArbiterAddress(e.target.value)}
                aria-invalid={!!(arbiterError || uniquenessErrors.arbiter)}
                className={`input font-mono text-xs ${
                  (arbiterError || uniquenessErrors.arbiter) ? 'border-red-400 focus:ring-red-300' : ''
                }`}
              />
              {arbiterError    && <FieldError message={arbiterError} />}
              {!arbiterError && uniquenessErrors.arbiter && <FieldError message={uniquenessErrors.arbiter} />}
              <p className="text-xs text-gray-400 mt-1">Resolves disputes between company and recruiter.</p>
            </div>
          </div>
        </div>

        {/* ── Milestones ── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Fee milestones</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Placement milestones unlock immediately. Retention milestones are time-locked.
              </p>
            </div>
            {/* Running total badge */}
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
              percentValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {totalPercent}% / 100%
            </span>
          </div>

          {!percentValid && (
            <FieldError
              message={
                totalPercent < 100
                  ? `Percentages must add up to 100 — ${100 - totalPercent}% still unallocated.`
                  : `Percentages must add up to 100 — currently ${totalPercent - 100}% over budget.`
              }
            />
          )}

          <div className="space-y-3 mb-4 mt-3">
            {milestones.map((m, i) => (
              <div key={i} className={`p-3 rounded-xl border bg-gray-50 ${
                milestoneRetentionErrors[i] ? 'border-red-300' : 'border-gray-100'
              }`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
                    m.kind === 'PLACEMENT' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {i + 1}
                  </div>
                  <select
                    value={m.kind}
                    onChange={(e) => update(i, 'kind', e.target.value as 'PLACEMENT' | 'RETENTION')}
                    className="input py-1.5 w-auto text-xs"
                  >
                    <option value="PLACEMENT">Placement</option>
                    <option value="RETENTION">Retention</option>
                  </select>
                  {milestones.length > 1 && (
                    <button type="button" onClick={() => removeMilestone(i)}
                      className="ml-auto p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input placeholder="Milestone name" value={m.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    required className="input flex-1 text-xs" />
                  <div className="relative w-20">
                    <input
                      type="number" min="1" max="100"
                      value={m.paymentPercent}
                      onChange={(e) => update(i, 'paymentPercent', Number(e.target.value))}
                      required className="input pr-6 text-xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  {m.kind === 'RETENTION' && (
                    <div className="relative w-24">
                      <input
                        type="number" min="1"
                        value={m.retentionDays ?? ''}
                        placeholder="days"
                        onChange={(e) => update(i, 'retentionDays', e.target.value === '' ? undefined : Number(e.target.value))}
                        aria-invalid={!!milestoneRetentionErrors[i]}
                        className={`input pr-6 text-xs ${milestoneRetentionErrors[i] ? 'border-red-400' : ''}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">d</span>
                    </div>
                  )}
                </div>

                {m.kind === 'RETENTION' && milestoneRetentionErrors[i] && (
                  <FieldError message={milestoneRetentionErrors[i]} />
                )}

                {m.kind === 'RETENTION' && !milestoneRetentionErrors[i] && (
                  <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Unlocks after {m.retentionDays ?? 30} days (~ledger {((m.retentionDays ?? 30) * 17280).toLocaleString()})
                  </p>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addMilestone} className="btn-ghost text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add milestone
          </button>
        </div>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !formIsValid}
            className="btn-primary flex-1"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{txStep || 'Processing…'}</>
            ) : (
              'Sign & lock fee in escrow'
            )}
          </button>
          <Link href="/dashboard/engagements" className="btn-secondary">Cancel</Link>
        </div>

        <p className="text-xs text-gray-400 text-center">
          This will open Freighter to sign the transaction. The recruiter fee will be locked in the contract until milestones are confirmed.
        </p>
      </form>
    </div>
  );
}

// ── Small helper component ─────────────────────────────────────────────────────

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {message}
    </p>
  );
}
