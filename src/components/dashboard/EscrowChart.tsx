"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { addMonths, format, startOfMonth } from "date-fns";
import type { Engagement } from "@/types";

/**
 * Escrowed vs released USDC by month.
 *
 * Rendered as a hand-rolled inline SVG bar chart — no chart dependency, so it
 * adds nothing to the bundle beyond this file.
 *
 * - "In escrow" is the USDC still locked at the end of each month
 *   (cumulative deposits − cumulative releases − cancellation refunds).
 * - "Released" is the USDC paid out to recruiters during that month.
 */

const MAX_MONTHS = 12;
const MIN_MONTHS = 6;

interface MonthPoint {
  key: string;
  label: string;
  escrowed: number;
  released: number;
}

function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

function toBigInt(value: string | null | undefined): bigint {
  try {
    return BigInt(value ?? "0");
  } catch {
    return BigInt(0);
  }
}

function stroopsToNumber(value: bigint): number {
  return Number(value) / 10_000_000;
}

function addTo(map: Map<string, bigint>, key: string, value: bigint) {
  if (value === BigInt(0)) return;
  map.set(key, (map.get(key) ?? BigInt(0)) + value);
}

export function buildEscrowSeries(
  engagements: Engagement[],
  now: Date = new Date(),
): MonthPoint[] {
  if (engagements.length === 0) return [];

  const deposits = new Map<string, bigint>();
  const releases = new Map<string, bigint>();
  const refunds = new Map<string, bigint>();
  let earliest = startOfMonth(now);

  for (const eng of engagements) {
    const created = new Date(eng.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    if (created < earliest) earliest = startOfMonth(created);

    const total = toBigInt(eng.totalAmount);
    const releasedTotal = toBigInt(eng.releasedAmount);
    addTo(deposits, monthKey(created), total);

    // Attribute releases to the month each milestone was confirmed.
    let attributed = BigInt(0);
    for (const ms of eng.milestones ?? []) {
      if (
        !ms.confirmedAt ||
        (ms.status !== "Confirmed" && ms.status !== "Resolved")
      ) {
        continue;
      }
      const confirmed = new Date(ms.confirmedAt);
      if (Number.isNaN(confirmed.getTime())) continue;
      const amount = ms.paymentReleased
        ? toBigInt(ms.paymentReleased)
        : (total * BigInt(Math.round(ms.paymentPercent))) / BigInt(100);
      addTo(releases, monthKey(confirmed), amount);
      attributed += amount;
    }

    // Anything released that we couldn't pin to a milestone date lands on
    // the engagement's last update.
    const updated = new Date(eng.updatedAt);
    const updatedKey = Number.isNaN(updated.getTime())
      ? monthKey(created)
      : monthKey(updated);
    if (releasedTotal > attributed) {
      addTo(releases, updatedKey, releasedTotal - attributed);
      attributed = releasedTotal;
    }

    // Cancelled engagements return the remaining escrow to the company.
    if (eng.status === "Cancelled" && total > attributed) {
      addTo(refunds, updatedKey, total - attributed);
    }
  }

  const current = startOfMonth(now);
  let start = earliest;
  if (addMonths(start, MAX_MONTHS - 1) < current) {
    start = addMonths(current, -(MAX_MONTHS - 1));
  }
  if (addMonths(start, MIN_MONTHS - 1) > current) {
    start = addMonths(current, -(MIN_MONTHS - 1));
  }
  const startKey = monthKey(start);

  // Balance carried in from months before the visible window.
  let balance = BigInt(0);
  const allKeys = new Set([
    ...deposits.keys(),
    ...releases.keys(),
    ...refunds.keys(),
  ]);
  for (const key of allKeys) {
    if (key < startKey) {
      balance +=
        (deposits.get(key) ?? BigInt(0)) -
        (releases.get(key) ?? BigInt(0)) -
        (refunds.get(key) ?? BigInt(0));
    }
  }

  const points: MonthPoint[] = [];
  for (let m = start; m <= current; m = addMonths(m, 1)) {
    const key = monthKey(m);
    const released = releases.get(key) ?? BigInt(0);
    balance +=
      (deposits.get(key) ?? BigInt(0)) - released - (refunds.get(key) ?? BigInt(0));
    points.push({
      key,
      label: format(m, "MMM"),
      escrowed: stroopsToNumber(balance < BigInt(0) ? BigInt(0) : balance),
      released: stroopsToNumber(released),
    });
  }
  return points;
}

/** Round the axis maximum up to a "nice" number (1, 2, 2.5, 5 × 10^n). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function compactUsd(value: number): string {
  if (value >= 1_000_000) return `$${+(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${+(value / 1_000).toFixed(1)}k`;
  return `$${+value.toFixed(0)}`;
}

function fullUsd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Chart geometry (SVG user units; the SVG scales to its container width).
const W = 640;
const H = 220;
const PAD_L = 48;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;
const TICKS = 4;

export function EscrowChart({ engagements }: { engagements: Engagement[] }) {
  const points = useMemo(() => buildEscrowSeries(engagements), [engagements]);
  const hasData = points.some((p) => p.escrowed > 0 || p.released > 0);

  const max = niceMax(
    Math.max(0, ...points.map((p) => Math.max(p.escrowed, p.released))),
  );
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const groupW = points.length > 0 ? plotW / points.length : plotW;
  const barW = Math.min(18, groupW * 0.3);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900">
          Escrow over time
        </h2>
        {hasData && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-600" />
              In escrow
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
              Released
            </span>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No escrow activity yet.</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Escrowed and released USDC will appear here by month once you
            have engagements.
          </p>
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label="Bar chart of USDC in escrow and released per month"
          >
            {/* Grid + y-axis labels */}
            {Array.from({ length: TICKS + 1 }).map((_, i) => {
              const value = (max / TICKS) * i;
              const ty = y(value);
              return (
                <g key={i}>
                  <line
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={ty}
                    y2={ty}
                    className="stroke-gray-100"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD_L - 6}
                    y={ty}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-gray-400"
                    fontSize={10}
                  >
                    {compactUsd(value)}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {points.map((p, i) => {
              const cx = PAD_L + groupW * i + groupW / 2;
              const escrowY = y(p.escrowed);
              const releasedY = y(p.released);
              return (
                <g key={p.key}>
                  <rect
                    x={cx - barW - 1}
                    y={escrowY}
                    width={barW}
                    height={PAD_T + plotH - escrowY}
                    rx={2}
                    className="fill-brand-600"
                  >
                    <title>{`${p.label}: ${fullUsd(p.escrowed)} in escrow`}</title>
                  </rect>
                  <rect
                    x={cx + 1}
                    y={releasedY}
                    width={barW}
                    height={PAD_T + plotH - releasedY}
                    rx={2}
                    className="fill-sky-400"
                  >
                    <title>{`${p.label}: ${fullUsd(p.released)} released`}</title>
                  </rect>
                  <text
                    x={cx}
                    y={H - 6}
                    textAnchor="middle"
                    className="fill-gray-400"
                    fontSize={10}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Screen-reader data table */}
          <table className="sr-only">
            <caption>USDC in escrow and released by month</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">In escrow</th>
                <th scope="col">Released</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.key}</th>
                  <td>{fullUsd(p.escrowed)}</td>
                  <td>{fullUsd(p.released)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
