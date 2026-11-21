import { signTransaction } from '@stellar/freighter-api';
import type { CreateEngagementInput } from '@/types';
import type { OnStatusFn, TxStep, TxStatusEvent } from '@/lib/stellar/contract';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export function initialTxSteps(): TxStep[] {
  return [
    { id: 'simulating', label: 'Simulating', status: 'idle' },
    { id: 'awaiting_signature', label: 'Awaiting signature', status: 'idle' },
    { id: 'submitting', label: 'Submitting', status: 'idle' },
    { id: 'confirming', label: 'Confirming', status: 'idle' },
    { id: 'done', label: 'Done', status: 'idle' },
  ];
}

export async function waitForConfirmation(
  txHash: string,
  onStatus?: OnStatusFn,
): Promise<string> {
  onStatus?.({ step: 'confirming', status: 'done', txHash });
  onStatus?.({ step: 'done', status: 'done', txHash });
  return txHash;
}

async function runAction(
  action: string,
  params: object,
  onStatus?: OnStatusFn,
): Promise<string> {
  const txHash = `mock-${action}-transaction`;
  onStatus?.({ step: 'simulating', status: 'active' });
  onStatus?.({ step: 'simulating', status: 'done' });
  onStatus?.({ step: 'awaiting_signature', status: 'active' });
  const signedXdr = await signTransaction('mock-transaction-xdr', {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (!signedXdr) throw new Error('Freighter did not sign the test transaction.');
  onStatus?.({ step: 'awaiting_signature', status: 'done' });

  const response = await fetch('/__e2e/contract-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      engagementId: 'engagementId' in params ? params.engagementId : undefined,
      milestoneIndex: 'milestoneIndex' in params ? params.milestoneIndex : undefined,
      proofHash: 'proofHash' in params ? params.proofHash : undefined,
    }),
  });
  if (!response.ok) throw new Error(`Mock transaction failed: ${response.status}`);

  onStatus?.({ step: 'submitting', status: 'done', txHash });
  onStatus?.({ step: 'confirming', status: 'done', txHash });
  onStatus?.({ step: 'done', status: 'done', txHash });
  return txHash;
}

export function createEngagement(
  params: CreateEngagementInput & {
    callerAddress: string;
    engagementId: string;
    recruiter: string;
    arbiter: string;
    tokenAddress: string;
  },
  onStatus?: OnStatusFn,
): Promise<string> {
  return runAction('createEngagement', params, onStatus);
}

export function submitProof(
  params: { engagementId: string; milestoneIndex: number; proofHash: string },
  onStatus?: OnStatusFn,
): Promise<string> {
  return runAction('submitProof', params, onStatus);
}

export function confirmMilestone(
  params: { engagementId: string; milestoneIndex: number },
  onStatus?: OnStatusFn,
): Promise<string> {
  return runAction('confirmMilestone', params, onStatus);
}

export function raiseDispute(
  params: { engagementId: string; milestoneIndex: number },
  onStatus?: OnStatusFn,
): Promise<string> {
  return runAction('raiseDispute', params, onStatus);
}

export function resolveDispute(
  params: { engagementId: string; milestoneIndex: number; approve: boolean },
  onStatus?: OnStatusFn,
): Promise<string> {
  return runAction('resolveDispute', params, onStatus);
}

export function unlockMilestone(
  params: { engagementId: string; milestoneIndex: number },
  onStatus?: OnStatusFn,
): Promise<string> {
  return runAction('unlockMilestone', params, onStatus);
}

export function requestReplacement(
  params: { engagementId: string },
  onStatus?: OnStatusFn,
): Promise<string> {
  return runAction('requestReplacement', params, onStatus);
}

export async function getEscrowBalance(): Promise<bigint> {
  return 0n;
}

export type { OnStatusFn, TxStep, TxStatusEvent };
