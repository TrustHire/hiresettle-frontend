'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, X, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { uploadApi } from '@/lib/api/services';
import { cn } from '@/lib/utils';

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'https://ipfs.io';

interface Props {
  onHashReady: (hash: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number; fileName: string }
  | { status: 'done'; cid: string; fileName: string }
  | { status: 'error'; message: string };

export function ProofSubmitForm({ onHashReady, onCancel, disabled }: Props) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [manualHash, setManualHash] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setUploadState({ status: 'uploading', progress: 0, fileName: file.name });
    try {
      const { cid } = await uploadApi.uploadProof(file, (pct) => {
        setUploadState({ status: 'uploading', progress: pct, fileName: file.name });
      });
      setUploadState({ status: 'done', cid, fileName: file.name });
      setManualHash(''); // clear manual field — CID takes precedence
    } catch (err: any) {
      setUploadState({
        status: 'error',
        message: err?.response?.data?.message ?? err?.message ?? 'Upload failed',
      });
    }
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    upload(files[0]);
  }, [upload]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const resolvedHash =
    uploadState.status === 'done'
      ? `ipfs://${uploadState.cid}`
      : manualHash.trim();

  const canSubmit = !!resolvedHash && !disabled && uploadState.status !== 'uploading';

  return (
    <div className="w-full space-y-3">
      {/* Drop zone — hidden once a CID is ready */}
      {uploadState.status !== 'done' && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload proof file"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors',
            dragOver
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-200 hover:border-brand-400 hover:bg-gray-50',
            uploadState.status === 'uploading' && 'pointer-events-none opacity-60',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
            accept="*/*"
          />

          {uploadState.status === 'uploading' ? (
            <UploadProgress
              progress={uploadState.progress}
              fileName={uploadState.fileName}
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-gray-400 select-none">
              <Upload className="w-6 h-6" />
              <p className="text-xs">
                Drag & drop a file, or <span className="text-brand-600 underline">browse</span>
              </p>
              <p className="text-[10px]">Any file type · pinned via backend</p>
            </div>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadState.status === 'error' && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {uploadState.message}
          <button
            onClick={() => setUploadState({ status: 'idle' })}
            className="ml-auto text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CID preview */}
      {uploadState.status === 'done' && (
        <CidPreview
          cid={uploadState.cid}
          fileName={uploadState.fileName}
          onReset={() => setUploadState({ status: 'idle' })}
        />
      )}

      {/* Manual hash fallback */}
      {uploadState.status !== 'done' && (
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wide">
            Or enter a hash / URL manually
          </label>
          <input
            type="text"
            placeholder="ipfs://Qm… or https://…"
            value={manualHash}
            onChange={(e) => setManualHash(e.target.value)}
            disabled={uploadState.status === 'uploading' || disabled}
            className="input w-full text-xs font-mono"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onHashReady(resolvedHash)}
          disabled={!canSubmit}
          className="btn-primary text-xs flex-1"
        >
          Submit proof
        </button>
        <button onClick={onCancel} className="btn-ghost text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UploadProgress({ progress, fileName }: { progress: number; fileName: string }) {
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="truncate max-w-[180px]">{fileName}</span>
        <span className="ml-auto tabular-nums">{progress}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all duration-200"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

function CidPreview({
  cid, fileName, onReset,
}: {
  cid: string;
  fileName: string;
  onReset: () => void;
}) {
  const url = `${IPFS_GATEWAY}/ipfs/${cid}`;
  const short = `${cid.slice(0, 16)}…${cid.slice(-6)}`;

  return (
    <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs">
      <FileText className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-green-800 truncate">{fileName}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-brand-600 hover:underline flex items-center gap-0.5"
          title={cid}
        >
          {short}
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      </div>
      <button
        onClick={onReset}
        className="text-green-400 hover:text-green-600"
        aria-label="Remove file and upload a different one"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
