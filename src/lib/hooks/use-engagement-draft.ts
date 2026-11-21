'use client';

/**
 * useEngagementDraft
 *
 * Persists and restores the "create engagement" form state in localStorage.
 * Each wallet address gets its own draft key so users on a shared machine
 * don't clobber each other.
 *
 * Usage:
 *   const draft = useEngagementDraft(address);
 *   draft.save(formState);    // call debounced on every field change
 *   draft.load()              // returns the saved draft or null
 *   draft.discard()           // removes the key from localStorage
 */

import { useCallback, useRef } from 'react';
import type { MilestoneInput } from '@/types';

export interface EngagementDraft {
  recruiterAddress: string;
  arbiterAddress:   string;
  totalUsdc:        string;
  jobTitle:         string;
  jobDescription:   string;
  salaryRange:      string;
  location:         string;
  milestones:       MilestoneInput[];
  savedAt:          string; // ISO timestamp shown in the restore banner
}

const DEBOUNCE_MS = 800;

function draftKey(address: string): string {
  return `hiresettle:engagement_draft:${address}`;
}

export function useEngagementDraft(address: string | null | undefined) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Read the draft from localStorage — returns null when absent or unparseable. */
  const load = useCallback((): EngagementDraft | null => {
    if (!address || typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(draftKey(address));
      if (!raw) return null;
      return JSON.parse(raw) as EngagementDraft;
    } catch {
      return null;
    }
  }, [address]);

  /**
   * Debounced save — called on every field change.
   * The actual write is deferred by DEBOUNCE_MS so rapid typing
   * doesn't thrash localStorage.
   */
  const save = useCallback((draft: Omit<EngagementDraft, 'savedAt'>) => {
    if (!address || typeof window === 'undefined') return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const full: EngagementDraft = { ...draft, savedAt: new Date().toISOString() };
        localStorage.setItem(draftKey(address), JSON.stringify(full));
      } catch {
        // localStorage may be full or blocked — fail silently
      }
    }, DEBOUNCE_MS);
  }, [address]);

  /** Flush any pending debounced write immediately. */
  const flush = useCallback((draft: Omit<EngagementDraft, 'savedAt'>) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!address || typeof window === 'undefined') return;
    try {
      const full: EngagementDraft = { ...draft, savedAt: new Date().toISOString() };
      localStorage.setItem(draftKey(address), JSON.stringify(full));
    } catch {
      // fail silently
    }
  }, [address]);

  /** Remove the draft from localStorage (call after successful submission). */
  const discard = useCallback(() => {
    if (!address || typeof window === 'undefined') return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      localStorage.removeItem(draftKey(address));
    } catch {
      // fail silently
    }
  }, [address]);

  return { load, save, flush, discard };
}
