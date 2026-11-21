declare global {
  interface Window {
    __E2E_FREIGHTER_ADDRESS__?: string;
  }
}

const FALLBACK_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function activeAddress(): string {
  return typeof window === 'undefined'
    ? FALLBACK_ADDRESS
    : window.__E2E_FREIGHTER_ADDRESS__ ?? FALLBACK_ADDRESS;
}

export async function isConnected(): Promise<boolean> {
  return true;
}

export async function getPublicKey(): Promise<string> {
  return activeAddress();
}

export async function requestAccess(): Promise<string> {
  return activeAddress();
}

export async function signTransaction(xdr: string): Promise<string> {
  return xdr;
}

export async function getNetwork(): Promise<string> {
  return 'TESTNET';
}
