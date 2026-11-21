import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Address,
  Keypair,
  Networks,
  SorobanRpc,
  scValToNative,
  type xdr,
} from '@stellar/stellar-sdk';

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      assembleTransaction: vi.fn(),
    },
  };
});

vi.mock('./freighter', () => ({
  signTx: vi.fn(),
}));

import { signTx } from './freighter';

type ContractModule = typeof import('./contract');

const contractId = Address.contract(Buffer.alloc(32, 1)).toString();
const caller = Keypair.random().publicKey();
const recruiter = Keypair.random().publicKey();
const arbiter = Keypair.random().publicKey();
const token = Address.contract(Buffer.alloc(32, 2)).toString();

let contract: ContractModule;

const account = {
  accountId: () => caller,
  sequenceNumber: () => '100',
  incrementSequenceNumber: () => {},
};

function invokeArgs(tx: any): xdr.ScVal[] {
  return tx.operations[0].func.value().args();
}

function nativeArgs(tx: any): any[] {
  return invokeArgs(tx).map((arg) => scValToNative(arg));
}

describe('Soroban contract argument encoding', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL = 'https://rpc.example';
    process.env.NEXT_PUBLIC_CONTRACT_ID = contractId;
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    contract = await import('./contract');
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(signTx).mockReset();

    vi.spyOn(SorobanRpc.Server.prototype, 'getAccount').mockResolvedValue(account as any);
    vi.spyOn(SorobanRpc.Server.prototype, 'simulateTransaction').mockImplementation(async (tx: any) => {
      (globalThis as any).__lastTx = tx;
      return {
        minResourceFee: '100',
        latestLedger: 1,
        result: { retval: Address.contract(Buffer.alloc(32, 3)).toScVal() },
      } as any;
    });
    vi.spyOn(SorobanRpc.Server.prototype, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'abc123',
    } as any);
    vi.spyOn(SorobanRpc.Server.prototype, 'getTransaction').mockResolvedValue({
      status: SorobanRpc.Api.GetTransactionStatus.SUCCESS,
    } as any);
    vi.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(false);
    vi.mocked(SorobanRpc.assembleTransaction).mockImplementation((tx: any) => ({
      build: () => tx,
    }) as any);
    vi.mocked(signTx).mockImplementation(async (signedXdr) => signedXdr);
  });

  it('encodes create_engagement nested milestone maps and arguments', async () => {
    await contract.createEngagement({
      callerAddress: caller,
      engagementId: 'eng-1',
      recruiter,
      arbiter,
      tokenAddress: token,
      totalAmount: 12500000n,
      jobTitle: 'Backend Engineer',
      milestones: [
        { name: 'Placement', paymentPercent: 70, kind: 'PLACEMENT' },
        { name: 'Retention', paymentPercent: 30, kind: 'RETENTION' },
      ],
      retentionDays: [90],
    });

    const tx = (globalThis as any).__lastTx;
    expect(Address.fromScAddress(tx.operations[0].func.value().contractAddress()).toString()).toBe(contractId);
    expect(tx.operations[0].func.value().functionName()).toBe('create_engagement');
    const args = nativeArgs(tx);

    expect(args.slice(0, 7)).toEqual([
      'eng-1',
      caller,
      recruiter,
      arbiter,
      token,
      12500000n,
      'Backend Engineer',
    ]);
    expect(args[7]).toEqual([
      expect.objectContaining({
        name: 'Placement',
        payment_percent: 70,
        kind: ['Placement'],
        valid_after_ledger: 0,
        proof_hash: '',
        status: ['Pending'],
      }),
      expect.objectContaining({
        name: 'Retention',
        payment_percent: 30,
        kind: ['Retention'],
        valid_after_ledger: 0,
        proof_hash: '',
        status: ['Pending'],
      }),
    ]);
    expect(args[8]).toEqual([90]);
  });

  it.each([
    {
      name: 'unlock_milestone',
        invoke: (onStatus: any) =>
        contract.unlockMilestone({ callerAddress: caller, engagementId: 'eng-1', milestoneIndex: 2 }, onStatus),
      expected: ['eng-1', 2],
    },
    {
      name: 'submit_proof',
      invoke: (onStatus: any) =>
        contract.submitProof({ callerAddress: caller, engagementId: 'eng-1', milestoneIndex: 3, proofHash: 'ipfs://proof' }, onStatus),
      expected: [caller, 'eng-1', 3, 'ipfs://proof'],
    },
    {
      name: 'confirm_milestone',
      invoke: (onStatus: any) =>
        contract.confirmMilestone({ callerAddress: caller, engagementId: 'eng-1', milestoneIndex: 1 }, onStatus),
      expected: [caller, 'eng-1', 1],
    },
    {
      name: 'raise_dispute',
      invoke: (onStatus: any) =>
        contract.raiseDispute({ callerAddress: caller, engagementId: 'eng-1', milestoneIndex: 1 }, onStatus),
      expected: [caller, 'eng-1', 1],
    },
    {
      name: 'resolve_dispute',
      invoke: (onStatus: any) =>
        contract.resolveDispute({ callerAddress: caller, engagementId: 'eng-1', milestoneIndex: 1, approve: true }, onStatus),
      expected: [caller, 'eng-1', 1, true],
    },
    {
      name: 'request_replacement',
      invoke: (onStatus: any) =>
        contract.requestReplacement({ callerAddress: caller, engagementId: 'eng-1' }, onStatus),
      expected: [caller, 'eng-1'],
    },
    {
      name: 'cancel_engagement',
      invoke: (onStatus: any) =>
        contract.cancelEngagement({ callerAddress: caller, engagementId: 'eng-1' }, onStatus),
      expected: [caller, 'eng-1'],
    },
  ])('encodes $name arguments', async ({ name, invoke, expected }) => {
    await invoke(undefined);

    const tx = (globalThis as any).__lastTx;
    expect(tx.operations[0].func.value().functionName()).toBe(name);
    expect(nativeArgs(tx)).toEqual(expected);
  });
});

describe('Soroban transaction status sequence', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL = 'https://rpc.example';
    process.env.NEXT_PUBLIC_CONTRACT_ID = contractId;
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    contract = await import('./contract');
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(signTx).mockReset();

    vi.spyOn(SorobanRpc.Server.prototype, 'getAccount').mockResolvedValue(account as any);
    vi.spyOn(SorobanRpc.Server.prototype, 'simulateTransaction').mockResolvedValue({
      minResourceFee: '100',
      latestLedger: 1,
    } as any);
    vi.spyOn(SorobanRpc.Server.prototype, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'abc123',
    } as any);
    vi.spyOn(SorobanRpc.Server.prototype, 'getTransaction').mockResolvedValue({
      status: SorobanRpc.Api.GetTransactionStatus.SUCCESS,
    } as any);
    vi.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(false);
    vi.mocked(SorobanRpc.assembleTransaction).mockImplementation((tx: any) => ({
      build: () => tx,
    }) as any);
    vi.mocked(signTx).mockImplementation(async (signedXdr) => signedXdr);
  });

  const cancel = (events: ContractModule['TxStatusEvent'][]) =>
    contract.cancelEngagement(
      { callerAddress: caller, engagementId: 'eng-1' },
      (event) => events.push(event),
    );

  it('reports every success step in order', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    await cancel(events);

    expect(events).toEqual([
      { step: 'simulating', status: 'active' },
      { step: 'simulating', status: 'done' },
      { step: 'awaiting_signature', status: 'active' },
      { step: 'awaiting_signature', status: 'done' },
      { step: 'submitting', status: 'active' },
      { step: 'submitting', status: 'done', txHash: 'abc123' },
      { step: 'confirming', status: 'active', txHash: 'abc123' },
      { step: 'confirming', status: 'done', txHash: 'abc123' },
      { step: 'done', status: 'done', txHash: 'abc123' },
    ]);
  });

  it('reports simulation exception failure', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(SorobanRpc.Server.prototype.simulateTransaction).mockRejectedValueOnce(new Error('RPC unavailable'));

    await expect(cancel(events)).rejects.toThrow('RPC unavailable');
    expect(events).toEqual([
      { step: 'simulating', status: 'active' },
      { step: 'simulating', status: 'error', error: 'RPC unavailable' },
    ]);
  });

  it('reports simulation error response failure', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(SorobanRpc.Api.isSimulationError).mockReturnValue(true);
    vi.mocked(SorobanRpc.Server.prototype.simulateTransaction).mockResolvedValueOnce({
      error: 'bad argument',
    } as any);

    await expect(cancel(events)).rejects.toThrow('Simulation error: bad argument');
    expect(events).toEqual([
      { step: 'simulating', status: 'active' },
      { step: 'simulating', status: 'error', error: 'Simulation error: bad argument' },
    ]);
  });

  it('reports signature rejection', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(signTx).mockRejectedValueOnce(new Error('User rejected'));

    await expect(cancel(events)).rejects.toThrow('User rejected');
    expect(events.slice(-2)).toEqual([
      { step: 'awaiting_signature', status: 'active' },
      { step: 'awaiting_signature', status: 'error', error: 'User rejected' },
    ]);
  });

  it('reports submission exception failure', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(SorobanRpc.Server.prototype.sendTransaction).mockRejectedValueOnce(new Error('Network down'));

    await expect(cancel(events)).rejects.toThrow('Network down');
    expect(events.slice(-2)).toEqual([
      { step: 'submitting', status: 'active' },
      { step: 'submitting', status: 'error', error: 'Network down' },
    ]);
  });

  it('reports submission error response failure', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(SorobanRpc.Server.prototype.sendTransaction).mockResolvedValueOnce({
      status: 'ERROR',
      errorResult: { toXDR: () => 'tx-too-early' },
    } as any);

    await expect(cancel(events)).rejects.toThrow('Submission error');
    expect(events.at(-1)).toEqual({
      step: 'submitting',
      status: 'error',
      error: 'Submission error: tx-too-early',
    });
  });

  it('reports transaction confirmation failure', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(SorobanRpc.Server.prototype.getTransaction).mockResolvedValue({
      status: SorobanRpc.Api.GetTransactionStatus.FAILED,
    } as any);

    await expect(cancel(events)).rejects.toThrow('Transaction failed: abc123');
    expect(events.slice(-2)).toEqual([
      { step: 'confirming', status: 'active', txHash: 'abc123' },
      { step: 'confirming', status: 'error', txHash: 'abc123', error: 'Transaction failed: abc123' },
    ]);
  });

  it('reports pending confirmation timeout', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(SorobanRpc.Server.prototype.getTransaction).mockResolvedValue({
      status: SorobanRpc.Api.GetTransactionStatus.NOT_FOUND,
    } as any);

    await expect(contract.waitForConfirmation(
      'abc123',
      (event) => events.push(event),
      1,
    )).rejects.toBeInstanceOf(contract.TransactionPendingError);
    expect(events).toEqual([
      { step: 'confirming', status: 'active', txHash: 'abc123' },
      { step: 'confirming', status: 'pending', txHash: 'abc123' },
    ]);
  });

  it('emits no status event when account loading fails', async () => {
    const events: ContractModule['TxStatusEvent'][] = [];
    vi.mocked(SorobanRpc.Server.prototype.getAccount).mockRejectedValueOnce(new Error('account unavailable'));

    await expect(cancel(events)).rejects.toThrow('account unavailable');
    expect(events).toEqual([]);
  });
});

