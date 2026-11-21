import { expect, test, type Page, type Route } from '@playwright/test';
import { Keypair } from '@stellar/stellar-sdk';
import type { CreateEngagementInput, Engagement, Milestone, User } from '@/types';

const COMPANY = Keypair.random().publicKey();
const RECRUITER = Keypair.random().publicKey();
const ARBITER = Keypair.random().publicKey();
const API_PREFIX = '/api/v1';

function apiResponse(data: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: status < 400, data, timestamp: new Date().toISOString() }),
  };
}

function makeMilestone(
  engagementId: string,
  index: number,
  input: { name: string; kind: 'PLACEMENT' | 'RETENTION'; paymentPercent: number; retentionDays?: number },
): Milestone {
  const now = new Date().toISOString();
  return {
    id: `${engagementId}-${index}`,
    engagementId,
    milestoneIndex: index,
    name: input.name,
    kind: input.kind === 'RETENTION' ? 'Retention' : 'Placement',
    paymentPercent: input.paymentPercent,
    retentionDays: input.retentionDays ?? null,
    validAfterLedger: null,
    unlockEstimatedAt: null,
    proofHash: null,
    status: index === 0 ? 'Pending' : 'Locked',
    paymentReleased: null,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function mockBackend(page: Page) {
  const engagements: Engagement[] = [];

  await page.route(`**${API_PREFIX}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.slice(API_PREFIX.length);

    if (endpoint === '/auth/nonce' && request.method() === 'GET') {
      return route.fulfill(apiResponse({ nonce: 'playwright-nonce' }));
    }

    if (endpoint === '/auth/login' && request.method() === 'POST') {
      const { stellarAddress } = request.postDataJSON() as { stellarAddress: string };
      const role = stellarAddress === COMPANY ? 'COMPANY'
        : stellarAddress === RECRUITER ? 'RECRUITER' : 'ARBITER';
      const user: User = {
        id: stellarAddress,
        stellarAddress,
        email: null,
        name: role[0] + role.slice(1).toLowerCase(),
        role,
      };
      const payload = Buffer.from(JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64url');
      return route.fulfill(apiResponse({ accessToken: `e30.${payload}.test-signature`, user }));
    }

    if (endpoint === '/engagements' && request.method() === 'GET') {
      const filtered = engagements.filter((engagement) => {
        const company = url.searchParams.get('companyAddress');
        const recruiter = url.searchParams.get('recruiterAddress');
        return (!company || engagement.companyAddress === company)
          && (!recruiter || engagement.recruiterAddress === recruiter);
      });
      return route.fulfill(apiResponse({
        data: filtered,
        meta: { total: filtered.length, page: 1, limit: 10, totalPages: 1 },
      }));
    }

    if (endpoint === '/engagements' && request.method() === 'POST') {
      const input = request.postDataJSON();
      const now = new Date().toISOString();
      const engagement: Engagement = {
        id: input.engagementId,
        companyAddress: input.companyAddress,
        recruiterAddress: input.recruiterAddress,
        arbiterAddress: input.arbiterAddress,
        tokenAddress: input.tokenAddress,
        totalAmount: input.totalAmount,
        releasedAmount: '0',
        jobTitle: input.jobTitle,
        jobDescription: input.jobDescription ?? null,
        salaryRange: input.salaryRange ?? null,
        location: input.location ?? null,
        status: 'Active',
        txHash: input.txHash,
        createdLedger: 1,
        createdAt: now,
        updatedAt: now,
        milestones: (input.milestones as CreateEngagementInput['milestones']).map((milestone, index) =>
          makeMilestone(input.engagementId, index, milestone)),
      };
      engagements.push(engagement);
      return route.fulfill(apiResponse(engagement));
    }

    const detailMatch = endpoint.match(/^\/engagements\/([^/]+)$/);
    if (detailMatch && request.method() === 'GET') {
      const engagement = engagements.find((item) => item.id === detailMatch[1]);
      return engagement
        ? route.fulfill(apiResponse(engagement))
        : route.fulfill(apiResponse({ message: 'Not found' }, 404));
    }

    const disputeReasonMatch = endpoint.match(
      /^\/engagements\/([^/]+)\/milestones\/(\d+)\/dispute-reason$/,
    );
    if (disputeReasonMatch && request.method() === 'POST') {
      const engagement = engagements.find((item) => item.id === disputeReasonMatch[1]);
      const milestone = engagement?.milestones[Number(disputeReasonMatch[2])];
      if (milestone) milestone.disputeReason = request.postDataJSON().reason;
      return route.fulfill(apiResponse(null));
    }

    if (endpoint === '/notifications' && request.method() === 'GET') {
      return route.fulfill(apiResponse({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
      }));
    }

    return route.fulfill(apiResponse({ message: `Unhandled mock API route: ${endpoint}` }, 404));
  });

  await page.route('**/__e2e/contract-action', async (route) => {
    const { action, engagementId, milestoneIndex, proofHash } =
      route.request().postDataJSON();
    const engagement = engagements.find((item) => item.id === engagementId);
    const milestone = engagement?.milestones[milestoneIndex];
    if (milestone) {
      if (action === 'submitProof') {
        milestone.status = 'ProofSubmitted';
        milestone.proofHash = proofHash;
      } else if (action === 'confirmMilestone') {
        milestone.status = 'Confirmed';
        milestone.paymentReleased = '300000000';
      } else if (action === 'raiseDispute') {
        milestone.status = 'Disputed';
      }
      milestone.updatedAt = new Date().toISOString();
    }
    return route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  });
}

async function loginAs(page: Page, address: string, switchingAccounts = false) {
  if (switchingAccounts) {
    await page.evaluate((nextAddress) => {
      window.__E2E_FREIGHTER_ADDRESS__ = nextAddress;
    }, address);
    await page.getByRole('button', { name: 'Sign out' }).click();
  }

  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Connect Freighter Wallet' }).click();
  await expect(page).toHaveURL(/\/dashboard\/engagements$/);
}

async function createEngagement(page: Page, title: string) {
  await page.getByRole('link', { name: 'New engagement' }).first().click();
  await page.getByPlaceholder('e.g. Senior Software Engineer').fill(title);
  await page.getByPlaceholder('e.g. 10000').fill('10000');
  const partyAddresses = page.getByPlaceholder('G...');
  await partyAddresses.nth(0).fill(RECRUITER);
  await partyAddresses.nth(1).fill(ARBITER);
  const engagementId = await page.locator('input[readonly]').first().inputValue();
  await page.getByRole('button', { name: 'Sign & lock fee in escrow' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/engagements/${engagementId}$`));
  return engagementId;
}

async function submitProof(page: Page, engagementId: string) {
  await page.goto(`/dashboard/engagements/${engagementId}`);
  await page.getByRole('button', { name: 'Submit proof' }).click();
  await page.getByPlaceholder('ipfs://Qm... or https://...').fill('https://example.test/proof');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Transaction progress' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Proof submitted')).toBeVisible();
}

test('logs in, creates engagements, submits proof, confirms and disputes', async ({ page }) => {
  await page.addInitScript((address) => {
    window.__E2E_FREIGHTER_ADDRESS__ = address;
  }, COMPANY);
  await mockBackend(page);

  await page.goto('/auth/login');
  await expect(page.getByRole('button', { name: 'Connect Freighter Wallet' })).toBeEnabled();
  await loginAs(page, COMPANY);

  const disputeEngagementId = await createEngagement(page, 'Recruiter dispute flow');
  await loginAs(page, RECRUITER, true);
  await submitProof(page, disputeEngagementId);
  await loginAs(page, COMPANY, true);
  await page.goto(`/dashboard/engagements/${disputeEngagementId}`);
  await page.getByRole('button', { name: 'Dispute', exact: true }).click();
  await page.getByPlaceholder('Describe the issue with the submitted proof…')
    .fill('The submitted evidence does not verify the placement.');
  await page.getByRole('button', { name: 'Raise dispute' }).click();
  await expect(page.getByRole('dialog', { name: 'Transaction progress' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Disputed', { exact: true })).toBeVisible();

  const confirmEngagementId = await createEngagement(page, 'Recruiter confirmation flow');
  await loginAs(page, RECRUITER, true);
  await submitProof(page, confirmEngagementId);
  await loginAs(page, COMPANY, true);
  await page.goto(`/dashboard/engagements/${confirmEngagementId}`);
  await page.getByRole('button', { name: 'Confirm & release' }).click();
  await expect(page.getByRole('dialog', { name: 'Transaction progress' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();
});
