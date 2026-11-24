'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Deterministic identicon for a Stellar address.
 *
 * Generated entirely client-side from the address string — no network
 * requests. The same address always renders the same 5×5, horizontally
 * mirrored pattern and colour, so parties are recognisable at a glance.
 */

const GRID = 5;

/** 32-bit FNV-1a hash, seeded so we can derive several independent values. */
function fnv1a(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

interface Identicon {
  cells: boolean[];
  fg: string;
  bg: string;
}

export function buildIdenticon(address: string): Identicon {
  const half = Math.ceil(GRID / 2);
  // Two hashes give us 64 bits — enough for 15 pattern bits + colour.
  const h1 = fnv1a(address);
  const h2 = fnv1a(address, h1 ^ 0x9e3779b9);

  const cells: boolean[] = new Array(GRID * GRID).fill(false);
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < half; col++) {
      const bit = row * half + col;
      const on = ((h1 >>> bit) & 1) === 1;
      cells[row * GRID + col] = on;
      cells[row * GRID + (GRID - 1 - col)] = on;
    }
  }

  const hue = h2 % 360;
  const sat = 55 + ((h2 >>> 9) % 20);   // 55–74 %
  const light = 42 + ((h2 >>> 17) % 12); // 42–53 %

  return {
    cells,
    fg: `hsl(${hue} ${sat}% ${light}%)`,
    bg: `hsl(${hue} ${sat}% 94%)`,
  };
}

interface Props {
  address: string | null | undefined;
  /** Rendered size in pixels. Defaults to 20. */
  size?: number;
  className?: string;
}

export function AddressAvatar({ address, size = 20, className }: Props) {
  const icon = useMemo(() => (address ? buildIdenticon(address) : null), [address]);

  if (!icon) {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-block rounded-full bg-gray-200 flex-shrink-0', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID + 1} ${GRID + 1}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn('rounded-full flex-shrink-0', className)}
    >
      <rect width={GRID + 1} height={GRID + 1} fill={icon.bg} />
      {icon.cells.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={0.5 + (i % GRID)}
            y={0.5 + Math.floor(i / GRID)}
            width={1}
            height={1}
            fill={icon.fg}
          />
        ) : null,
      )}
    </svg>
  );
}
