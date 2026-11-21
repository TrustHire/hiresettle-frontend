'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = 'value' }: Props) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    try {
      await copyToClipboard(value);
      setCopied(true);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      onClick={handle}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="text-gray-300 hover:text-gray-600 flex-shrink-0 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}