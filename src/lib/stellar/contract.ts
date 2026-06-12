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
): Promise<string> {
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

  const simulation = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation error: ${simulation.error}`);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, simulation).build();
  const signedXdr = await signTx(assembled.toXDR(), NETWORK_PASSPHRASE);
  const { Transaction } = await import('@stellar/stellar-sdk');
  const response = await rpc.sendTransaction(new Transaction(signedXdr));

  if (response.status === 'ERROR') {
    throw new Error(`Submission error: ${response.errorResult?.toXDR()}`);
  }

  return waitForConfirmation(response.hash);
}

async function waitForConfirmation(txHash: string): Promise<string> {
  const rpc = getRpc();
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await rpc.getTransaction(txHash);
    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return txHash;
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${txHash}`);
    }
    attempts++;
  }
  throw new Error(`Transaction not confirmed after ${attempts} attempts: ${txHash}`);
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

export async function createEngagement(params: CreateEngagementParams): Promise<string> {
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
  ]);
}

/** Unlock a Retention milestone after its time window has elapsed */
export async function unlockMilestone(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'unlock_milestone', [
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
  ]);
}

/** Recruiter submits an IPFS proof hash for a milestone */
export async function submitProof(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
  proofHash: string;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'submit_proof', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
    nativeToScVal(params.proofHash, { type: 'string' }),
  ]);
}

/** Company confirms a ProofSubmitted milestone — releases payment */
export async function confirmMilestone(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'confirm_milestone', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
  ]);
}

/** Company raises a dispute on a ProofSubmitted milestone */
export async function raiseDispute(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'raise_dispute', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
  ]);
}

/** Arbiter resolves a disputed milestone */
export async function resolveDispute(params: {
  callerAddress: string;
  engagementId: string;
  milestoneIndex: number;
  approve: boolean;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'resolve_dispute', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
    nativeToScVal(params.milestoneIndex, { type: 'u32' }),
    nativeToScVal(params.approve, { type: 'bool' }),
  ]);
}

/** Company requests a replacement after a candidate leaves */
export async function requestReplacement(params: {
  callerAddress: string;
  engagementId: string;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'request_replacement', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
  ]);
}

/** Company cancels an engagement before placement is confirmed */
export async function cancelEngagement(params: {
  callerAddress: string;
  engagementId: string;
}): Promise<string> {
  return invokeContract(params.callerAddress, 'cancel_engagement', [
    new Address(params.callerAddress).toScVal(),
    nativeToScVal(params.engagementId, { type: 'string' }),
  ]);
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
