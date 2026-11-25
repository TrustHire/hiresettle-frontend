import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, type Locale as DateFnsLocale } from 'date-fns';
import { enUS, es, fr } from 'date-fns/locale';
import type { MilestoneStatus, EngagementStatus, ChainEvent } from '@/types';
import { DEFAULT_LOCALE, type Locale } from '../i18n/config';

export const LEDGERS_PER_DAY = Number(process.env.NEXT_PUBLIC_LEDGERS_PER_DAY) || 17280;

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/** Shorten a Stellar address: GABC...XYZ */
export function shortAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
}

export async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to fallback
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('Copy failed');
}

/** Convert stroops to human-readable USDC (7 decimal places on Stellar) */
export function stroopsToUsdc(stroops: string | bigint, decimals = 2): string {
  const v = BigInt(stroops);
  const whole = v / 10_000_000n;
  const fraction = (v % 10_000_000n).toString().padStart(7, '0');
  return parseFloat(`${whole}.${fraction}`).toFixed(decimals);
}

/**
 * Convert stroops to an exact decimal USDC string (all 7 decimal places).
 * Uses BigInt arithmetic only, so large amounts never lose precision.
 */
export function stroopsToExactUsdc(stroops: string | bigint): string {
  const v = BigInt(stroops);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const whole = abs / 10_000_000n;
  const fraction = (abs % 10_000_000n).toString().padStart(7, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Convert human-readable USDC to stroops bigint */
export function usdcToStroops(usdc: string): bigint {
  if (usdc.length === 0) {
    throw new Error('USDC amount cannot be empty.');
  }
  if (usdc.startsWith('-')) {
    throw new Error('USDC amount must not be negative.');
  }
  if (!/^\d+(?:\.\d*)?$/.test(usdc)) {
    throw new Error('USDC amount must be a valid decimal number.');
  }

  const [whole, fraction = ''] = usdc.split('.');
  if (fraction.length > 7) {
    throw new Error('USDC amount cannot have more than 7 decimal places.');
  }

  const padded = fraction.padEnd(7, '0');
  return BigInt(whole) * 10_000_000n + BigInt(padded);
}

// ── Locale-aware date formatting ──────────────────────────────────────────────

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS, es, fr };

/** Active UI locale for date formatting; kept in sync by `I18nProvider`. */
let activeDateLocale: Locale = DEFAULT_LOCALE;

export function setDateLocale(locale: Locale) {
  activeDateLocale = locale;
}

/** Format a date as a localised medium date, e.g. "Nov 24, 2026" / "24 nov 2026". */
export function formatDate(date: string | null, locale: Locale = activeDateLocale): string {
  if (!date) return '—';
  return format(new Date(date), 'PP', { locale: DATE_FNS_LOCALES[locale] });
}

export function timeAgo(date: string | null, locale: Locale = activeDateLocale): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: DATE_FNS_LOCALES[locale],
  });
}

// ── Block explorer helpers ─────────────────────────────────────────────────────

/** Stellar network slug used by stellar.expert */
function explorerNetwork(): 'testnet' | 'public' {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'public' : 'testnet';
}

/** Link to a transaction on stellar.expert */
export function explorerTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/${explorerNetwork()}/tx/${txHash}`;
}

/** Link to an account on stellar.expert */
export function explorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/${explorerNetwork()}/account/${address}`;
}

// ── CSV export ────────────────────────────────────────────────────────────────

/** Escape a single CSV cell (RFC 4180) and neutralise spreadsheet formula injection. */
export function csvEscape(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV document from a header row and data rows. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/** Serialise engagements to CSV with exact (stroop-precise) USDC amounts. */
export function engagementsToCsv(engagements: Engagement[]): string {
  const header = [
    'ID',
    'Job title',
    'Company',
    'Recruiter',
    'Arbiter',
    'Total (USDC)',
    'Released (USDC)',
    'Status',
    'Created at',
  ];
  const rows = engagements.map((e) => [
    e.id,
    e.jobTitle,
    e.companyAddress,
    e.recruiterAddress,
    e.arbiterAddress,
    stroopsToExactUsdc(e.totalAmount),
    stroopsToExactUsdc(e.releasedAmount),
    engagementStatusLabel(e.status),
    e.createdAt,
  ]);
  return toCsv(header, rows);
}

/** Trigger a browser download of CSV content. */
export function downloadCsv(fileName: string, csv: string): void {
  // Prefix a BOM so Excel detects UTF-8 correctly
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Engagement ID ─────────────────────────────────────────────────────────────

/** Generate a unique engagement ID */
export function generateEngagementId(): string {
  const date = format(new Date(), 'yyyyMMdd');
  let rand = '';

  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    } else if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
  }

  if (!rand) {
    rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  return `ENG-${date}-${rand}`;
}

/** Tailwind badge class for engagement status */
export function engagementStatusBadge(status: EngagementStatus): string {
  const map: Record<EngagementStatus, string> = {
    Active:               'badge-active',
    Completed:            'badge-completed',
    Cancelled:            'badge-cancelled',
    ReplacementRequested: 'badge-replacement',
  };
  return map[status] ?? 'badge';
}

export function engagementStatusLabel(status: EngagementStatus): string {
  const map: Record<EngagementStatus, string> = {
    Active:               'Active',
    Completed:            'Completed',
    Cancelled:            'Cancelled',
    ReplacementRequested: 'Replacement requested',
  };
  return map[status] ?? status;
}

/** Tailwind badge class for milestone status */
export function milestoneStatusBadge(status: MilestoneStatus): string {
  const map: Record<MilestoneStatus, string> = {
    Locked:        'badge-locked',
    Pending:       'badge-pending',
    ProofSubmitted:'badge-submitted',
    Confirmed:     'badge-confirmed',
    Disputed:      'badge-disputed',
    Resolved:      'badge-resolved',
  };
  return map[status] ?? 'badge';
}

export function milestoneStatusLabel(status: MilestoneStatus): string {
  const map: Record<MilestoneStatus, string> = {
    Locked:        'Locked',
    Pending:       'Pending',
    ProofSubmitted:'Proof submitted',
    Confirmed:     'Confirmed',
    Disputed:      'Disputed',
    Resolved:      'Resolved',
  };
  return map[status] ?? status;
}

/** Compute engagement completion progress % */
export function engagementProgress(milestones: { status: MilestoneStatus }[]): number {
  if (!milestones.length) return 0;
  const done = milestones.filter(
    (m) => m.status === 'Confirmed' || m.status === 'Resolved',
  ).length;
  return Math.round((done / milestones.length) * 100);
}

/** Format retention days remaining into a human string */
export function formatRetentionCountdown(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Ready to unlock';
  if (daysRemaining === 1) return '1 day remaining';
  if (daysRemaining < 7)  return `${daysRemaining} days remaining`;
  const weeks = Math.floor(daysRemaining / 7);
  const days  = daysRemaining % 7;
  if (days === 0) return `${weeks}w remaining`;
  return `${weeks}w ${days}d remaining`;
}

/**
 * Format a millisecond duration into a live countdown string.
 *
 * >= 48 h  → "Xd Yh remaining"   (coarse — caller uses static days fallback)
 * <  48 h  → "Xd Yh Zm remaining"
 * <   1 h  → "Ym Zs remaining"
 * <= 0     → "Ready to unlock"
 */
export function formatLiveCountdown(ms: number): string {
  if (ms <= 0) return 'Ready to unlock';

  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (ms >= 48 * 3600 * 1000) {
    // Coarse — signal to caller to keep using static days label
    return d > 0
      ? `${d}d ${h}h remaining`
      : `${h}h remaining`;
  }
  if (ms < 3600 * 1000) {
    return `${m}m ${s}s remaining`;
  }
  return d > 0
    ? `${d}d ${h}h ${m}m remaining`
    : `${h}h ${m}m remaining`;
}

/** Return timer pill class based on days remaining */
export function timerPillClass(daysRemaining: number, unlockable: boolean): string {
  if (unlockable || daysRemaining <= 0) return 'timer-ready';
  if (daysRemaining <= 3) return 'timer-approaching';
  return 'timer-active';
}

// ── Proof file helpers ─────────────────────────────────────────────────────────

/** Format a byte count into a human-readable string, e.g. "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${i === 0 ? value : Math.round(value * 10) / 10} ${units[i]}`;
}

/** File extensions that can execute code or install software on a machine. */
const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'cpl', 'scr', 'pif', 'msc', 'gadget',
  'ps1', 'psm1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'hta', 'jar',
  'app', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'sh', 'bash', 'zsh', 'run',
  'bin', 'dll', 'so', 'reg', 'lnk', 'iso', 'img',
]);

/** Extract the lowercased extension (without the dot) from a file name. */
function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Returns true when a proof file should be opened with a warning — either it
 * has an executable/scripting extension, or its type is unknown/opaque
 * (missing MIME type or the generic "application/octet-stream").
 */
export function isUnsafeProofFile(
  fileName?: string | null,
  mimeType?: string | null,
): boolean {
  const ext = fileName ? fileExtension(fileName) : '';
  if (ext && EXECUTABLE_EXTENSIONS.has(ext)) return true;

  const type = (mimeType ?? '').toLowerCase();
  return !type || type === 'application/octet-stream';
}
