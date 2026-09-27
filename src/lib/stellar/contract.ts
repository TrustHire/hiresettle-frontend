/**
 * lib/stellar/contract.ts
 *
 * Builds Soroban transactions for every HireSettle contract function.
 * Flow: build → simulate → assemble → sign via Freighter → submit → poll
 */

import {
  Networks,
  SorobanRpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
} from '@stellar/stellar-sdk';
import { signTx } from './freighter';

const RPC_URL     = process.env.NEXT_PUBLIC_STELLAR_RPC_URL!;
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;
const NETWORK     = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

// ----------------------------------------------------------
// Transaction progress types (exported for UI consumers)
// ----------------------------------------------------------

/** The ordered steps of every Soroban transaction. */
export type TxStepId =
  | 'simulating'
  | 'awaiting_signature'
  | 'submitting'
  | 'confirming'
  | 'done';

export type TxStepStatus = 'idle' | 'active' | 'done' | 'error';

export interface TxStep {
  id: TxStepId;
  label: string;
  status: TxStepStatus;
}

export interface TxStatusEvent {
  /** Which step just changed. */
  step: TxStepId;
  /** New status for that step. */
  status: TxStepStatus;
  /** Set once the tx has been sent — used to build an explorer link. */
  txHash?: string;
  /** Set on error — the human-readable message. */
  error?: string;
}

/** Callback signature callers pass to any contract write function. */
export type OnStatusFn = (event: TxStatusEvent) => void;

/** Returns the initial step list so the UI can render the skeleton immediately. */
export function initialTxSteps(): TxStep[] {
  return [
    { id: 'simulating',         label: 'Simulating',        status: 'idle' },
    { id: 'awaiting_signature', label: 'Awaiting signature', status: 'idle' },
    { id: 'submitting',         label: 'Submitting',         status: 'idle' },
    { id: 'confirming',         label: 'Confirming',         status: 'idle' },
    { id: 'done',               label: 'Done',               status: 'idle' },
  ];
}

let _rpc: SorobanRpc.Server;
function getRpc() {
  if (!_rpc) _rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: true });
  return _rpc;
}

// ----------------------------------------------------------
// Core helpers
// ----------------------------------------------------------

async function invokeContract(
  callerAddress: string,
  method: string,
  args: xdr.ScVal[],
  onStatus?: OnStatusFn,
): Promise<string> {
  const notify = (step: TxStepId, status: TxStepStatus, extra?: Pick<TxStatusEvent, 'txHash' | 'error'>) => {
    onStatus?.({ step, status, ...extra });
  };

  const rpc = getRpc();
  const contract = new Contract(CONTRACT_ID);
  const account = await rpc.getAccount(callerAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Step 1 — Simulate
  notify('simulating', 'active');
  let simulation: Awaited<ReturnType<typeof rpc.simulateTransaction>>;
  try {
    simulation = await rpc.simulateTransaction(tx);
  } catch (err: any) {
    notify('simulating', 'error', { error: err?.message ?? 'Simulation failed' });
    throw err;
  }
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    const msg = `Simulation error: ${simulation.error}`;
    notify('simulating', 'error', { error: msg });
    throw new Error(msg);
  }
  notify('simulating', 'done');

  const assembled = SorobanRpc.assembleTransaction(tx, simulation).build();

  // Step 2 — Awaiting Freighter signature
  notify('awaiting_signature', 'active');
  let signedXdr: string;
  try {
    signedXdr = await signTx(assembled.toXDR(), NETWORK_PASSPHRASE);
  } catch (err: any) {
    notify('awaiting_signature', 'error', { error: err?.message ?? 'Signature rejected' });
    throw err;
  }
  notify('awaiting_signature', 'done');

  // Step 3 — Submit
  notify('submitting', 'active');
  const { Transaction } = await import('@stellar/stellar-sdk');
  let response: Awaited<ReturnType<typeof rpc.sendTransaction>>;
  try {
    response = await rpc.sendTransaction(new Transaction(signedXdr));
  } catch (err: any) {
    notify('submitting', 'error', { error: err?.message ?? 'Submission failed' });
    throw err;
  }
  if (response.status === 'ERROR') {
    const msg = `Submission error: ${response.errorResult?.toXDR()}`;
    notify('submitting', 'error', { error: msg });
    throw new Error(msg);
  }
  notify('submitting', 'done', { txHash: response.hash });

  // Steps 4 + 5 — Confirm + Done (delegated to waitForConfirmation)
  return waitForConfirmation(response.hash, onStatus);
}

async function waitForConfirmation(txHash: string, onStatus?: OnStatusFn): Promise<string> {
  const rpc = getRpc();
  onStatus?.({ step: 'confirming', status: 'active', txHash });
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await rpc.getTransaction(txHash);
    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      onStatus?.({ step: 'confirming', status: 'done', txHash });
      onStatus?.({ step: 'done',       status: 'done', txHash });
      return txHash;
    }
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      const msg = `Transaction failed: ${txHash}`;
      onStatus?.({ step: 'confirming', status: 'error', txHash, error: msg });
      throw new Error(msg);
    }
    attempts++;
  }
  const msg = `Transaction not confirmed after ${attempts} attempts: ${txHash}`;
  onStatus?.({ step: 'confirming', status: 'error', txHash, error: msg });
  throw new Error(msg);
}

async function simulateCall(method: string, args: xdr.ScVal[]): Promise<any> {
  const rpc = getRpc();
  const contract = new Contract(CONTRACT_ID);
  const { Keypair } = await import('@stellar/stellar-sdk');
  const dummy = Keypair.random();
  const dummyAccount = {
    accountId: () => dummy.publicKey(),
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => {},
  } as any;

  const tx = new TransactionBuilder(dummyAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Read error: ${simulation.error}`);
  }
  if (SorobanRpc.Api.isSimulationSuccess(simulation) && simulation.result) {
    return scValToNative(simulation.result.retval);
  }
  return null;
}

// ----------------------------------------------------------
// Contract write functions
// ----------------------------------------------------------

export interface CreateEngagementParams {
  callerAddress: string;
  engagementId: string;
  recruiter: string;
  arbiter: string;
  tokenAddress: string;
  totalAmount: bigint;
  jobTitle: string;
  milestones: Array<{ name: string; paymentPercent: number; kind: 'PLACEMENT' | 'RETENTION' }>;
  retentionDays: number[]; // one per RETENTION milestone
}

export async function createEngagement(params: CreateEngagementParams, onStatus?: OnStatusFn): Promise<string> {
  const milestonesScVal = xdr.ScVal.scvVec(
    params.milestones.map((m) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: nativeToScVal('name', { type: 'symbol' }),
          val: nativeToScVal(m.name, { type: 'string' }),
        }),
        new xdr.ScMapEntry({
          key: nativeToScVal('payment_percent', { type: 'symbol' }),
          val: nativeToScVal(m.paymentPercent, { type: 'u32' }),
        }),
        new xdr.ScMapEntry({
          key: nativeToScVal('kind', { type: 'symbol' }),
          val: xdr.ScVal.scvVec([
            nativeToScVal(m.kind === 'PLACEMENT' ? 'Placement' : 'Retention', { type: 'symbol' }),
          ]),
        }),
        new xdr.ScMapEntry({
          key: nativeToScVal('valid_after_ledger', { type: 'symbol' }),
          val: nativeToScVal(0, { type: 'u32' }),
        }),
        new xdr.ScMapEntry({
          key: nativeToScVal('proof_hash', { type: 'symbol' }),
          val: nativeToScVal('', { type: 'string' }),
        }),
        new xdr.ScMapEntry({
          key: nativeToScVal('status', { type: 'symbol' }),
          val: xdr.ScVal.scvVec([nativeToScVal('Pending', { type: 'symbol' })]),
        }),
      ]),
    ),
  );

  const retentionDaysScVal = xdr.ScVal.scvVec(
    params.retentionDays.map((d) => nativeToScVal(d, { type: 'u32' })),
  );

  return invokeContract(params.callerAddress, 'create_engagement', [
    nativeToScVal(params.engagementId, { type: 'string' }),
    new Address(params.callerAddress).toScVal(),
    new Address(params.recruiter).toScVal(),
    new Address(params.arbiter).toScVal(),
    new Address(params.tokenAddress).toScVal(),
    nativeToScVal(params.totalAmount, { type: 'i128' }),
    nativeToScVal(params.jobTitle, { type: 'string' }),
    milestonesScVal,
    retentionDaysScVal,
  ], onStatus);
}

/** Unlock a Retention milestone after its time window has elapsed */
export async function unlockMilestone(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
}, onStatus?: OnStatusFn): Promise<string> {
  return invokeContract(params.callerAddress, 'unlock_milestone', [
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
  ], onStatus);
}

/** Recruiter submits an IPFS proof hash for a milestone */
export async function submitProof(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
  proofHash: string;
}, onStatus?: OnStatusFn): Promise<string> {
  return invokeContract(params.callerAddress, 'submit_proof', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
    nativeToScVal(params.proofHash, { type: 'string' }),
  ], onStatus);
}

/** Company confirms a ProofSubmitted milestone — releases payment */
export async function confirmMilestone(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
}, onStatus?: OnStatusFn): Promise<string> {
  return invokeContract(params.callerAddress, 'confirm_milestone', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
  ], onStatus);
}

/** Company raises a dispute on a ProofSubmitted milestone */
export async function raiseDispute(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
}, onStatus?: OnStatusFn): Promise<string> {
  return invokeContract(params.callerAddress, 'raise_dispute', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
  ], onStatus);
}

/** Arbiter resolves a disputed milestone */
export async function resolveDispute(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
  approve: boolean;
}, onStatus?: OnStatusFn): Promise<string> {
  return invokeContract(params.callerAddress, 'resolve_dispute', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
    nativeToScVal(params.approve, { type: 'bool' }),
  ], onStatus);
}

/** Company requests a replacement after a candidate leaves */
export async function requestReplacement(params: {
  callerAddress: string;
  engagementId: string;
}, onStatus?: OnStatusFn): Promise<string> {
  return invokeContract(params.callerAddress, 'request_replacement', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
  ], onStatus);
}

/** Company cancels an engagement before placement is confirmed */
export async function cancelEngagement(params: {
  callerAddress: string;
  engagementId: string;
}, onStatus?: OnStatusFn): Promise<string> {
  return invokeContract(params.callerAddress, 'cancel_engagement', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
  ], onStatus);
}

// ----------------------------------------------------------
// Read-only queries
// ----------------------------------------------------------

export async function getEscrowBalance(engagementId: string): Promise<bigint> {
  const result = await simulateCall('get_escrow_balance', [
    nativeToScVal(engagementId, { type: 'string' }),
  ]);
  return BigInt(result ?? 0);
}

export async function isMilestoneUnlockable(
  engagementId: string,
  milestoneIndex: number,
): Promise<boolean> {
  const result = await simulateCall('is_milestone_unlockable', [
    nativeToScVal(engagementId, { type: 'string' }),
    nativeToScVal(milestoneIndex, { type: 'u32' }),
  ]);
  return Boolean(result);
}
