import { expect, type Page } from "@playwright/test";

export type BrowserCredentials = {
  email: string;
  password: string;
};

export type BrowserOnboardingInput = {
  companyName: string;
  taskTitle: string;
  agentName?: string;
};

export type CompanyRecord = {
  id: string;
  name: string;
};

export type AgentRecord = {
  id: string;
  name: string;
  role: string;
  adapterType: string;
};

export type AgentKeyRecord = {
  id: string;
  name: string;
  token: string;
  createdAt: string;
};

export type IssueRecord = {
  id: string;
  title: string;
  assigneeAgentId: string | null;
  description?: string | null;
  owningDepartmentId?: string | null;
  departmentIntakeStatus?: string | null;
  ministerDecisionResponse?: string | null;
  ministerDecisionReason?: string | null;
  isInCeoIntake?: boolean;
};

export type HeartbeatRunRecord = {
  agentId: string;
  invocationSource: string;
  status: string;
};

export type DepartmentRecord = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  mission: string | null;
  status: string;
  ministerAgentId: string | null;
  maxConcurrentTemporaryWorkers: number;
  temporaryWorkerTtlMinutes: number;
};

export type TemporaryWorkerRecord = {
  id: string;
  companyId: string;
  departmentId: string;
  ownerMinisterAgentId: string;
  sourceIssueId: string;
  name: string;
  status: string;
  ttlExpiresAt: string;
  statusReason: string | null;
  resumeRequestedAt: string | null;
  terminatedAt: string | null;
};

export type RequiredSystemPluginStatusRecord = {
  pluginKey: string;
  packageName: string;
  displayName: string;
  pluginId: string | null;
  installed: boolean;
  runtimeStatus: string;
  pluginStatus: string | null;
  companyEnabled: boolean | null;
  lastError: string | null;
  bootstrapError: string | null;
  updatedAt: string | null;
};

export type SystemPluginRolloutRecord = {
  id: string;
  pluginId: string;
  pluginKey: string;
  pluginPackageName: string;
  pluginStatus: string;
  rolloutKind: string;
  status: string;
  baseVersion: string;
  candidateVersion: string | null;
  candidateMetadata: Record<string, unknown>;
  note: string | null;
  lastError: string | null;
  requestedByUserId: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  executedAt: string | null;
  completedAt: string | null;
  restartCommand: Record<string, unknown> | null;
  rollbackCommand: Record<string, unknown> | null;
  approvals: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
};

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

type ApiRequestOptions = {
  method?: ApiMethod;
  token?: string;
  body?: unknown;
};

function resolveUrlFromEnv(value: string | undefined, fallback: string, envName: string) {
  const raw = value?.trim() || fallback;
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error(`Invalid ${envName} URL: ${raw}`);
  }
}

function resolvePortFromEnv(value: string | undefined, fallback: number, envName: string) {
  const raw = value?.trim();
  if (!raw) return fallback;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${envName} port: ${raw}`);
  }
  return port;
}

function resolveCredentialsFromEnv(
  emailEnv: string,
  passwordEnv: string,
  fallbackEmail: string,
  fallbackPassword: string,
): BrowserCredentials {
  return {
    email: process.env[emailEnv]?.trim() || fallbackEmail,
    password: process.env[passwordEnv]?.trim() || fallbackPassword,
  };
}

export function resolveE2eBaseUrl() {
  const port = resolvePortFromEnv(process.env.PAPERCLIP_E2E_PORT, 3100, "PAPERCLIP_E2E_PORT");
  return `http://127.0.0.1:${port}`;
}

export function resolveReleaseSmokeBaseUrl() {
  return resolveUrlFromEnv(
    process.env.PAPERCLIP_RELEASE_SMOKE_BASE_URL,
    "http://127.0.0.1:3232",
    "PAPERCLIP_RELEASE_SMOKE_BASE_URL",
  );
}

export function resolveReleaseSmokeCredentials() {
  return resolveCredentialsFromEnv(
    "PAPERCLIP_RELEASE_SMOKE_EMAIL",
    "PAPERCLIP_RELEASE_SMOKE_PASSWORD",
    process.env.SMOKE_ADMIN_EMAIL?.trim() || "smoke-admin@paperclip.local",
    process.env.SMOKE_ADMIN_PASSWORD?.trim() || "paperclip-smoke-password",
  );
}

export function apiOrigin(page: Page) {
  return new URL(page.url()).origin;
}

async function apiRequest<T>(page: Page, path: string, options: ApiRequestOptions = {}) {
  const method = options.method ?? "GET";
  const headers = options.token
    ? { Authorization: `Bearer ${options.token}` }
    : undefined;
  const url = `${apiOrigin(page)}/api${path}`;

  let res;
  switch (method) {
    case "POST":
      res = await page.request.post(url, { data: options.body, headers });
      break;
    case "PATCH":
      res = await page.request.patch(url, { data: options.body, headers });
      break;
    case "DELETE":
      res = await page.request.delete(url, { data: options.body, headers });
      break;
    default:
      res = await page.request.get(url, { headers });
      break;
  }

  expect(res.ok()).toBe(true);
  return (await res.json()) as T;
}

export async function signIn(page: Page, credentials: BrowserCredentials) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/);

  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });
}

export async function openOnboarding(page: Page) {
  const wizardHeading = page.getByRole("heading", { name: "Name your company" });
  await page.goto("/onboarding");

  if (await wizardHeading.isVisible()) {
    return;
  }

  const startButton = page.getByRole("button", { name: /^(Start|Add Agent)$/ }).first();
  await expect(startButton).toBeVisible({ timeout: 20_000 });
  await startButton.click();
  await expect(wizardHeading).toBeVisible({ timeout: 20_000 });
}

export async function fillOnboardingCompany(page: Page, companyName: string) {
  await page.locator('input[placeholder="Acme Corp"]').fill(companyName);
}

export async function fillOnboardingAgent(page: Page, agentName = "CEO") {
  await expect(page.locator('input[placeholder="CEO"]')).toHaveValue(agentName);
}

export async function fillOnboardingTask(page: Page, taskTitle: string) {
  const taskTitleInput = page.locator('input[placeholder="e.g. Research competitor pricing"]');
  await taskTitleInput.clear();
  await taskTitleInput.fill(taskTitle);
}

export async function advanceOnboarding(page: Page) {
  await page.getByRole("button", { name: "Next" }).click();
}

export async function completeOnboarding(page: Page, input: BrowserOnboardingInput) {
  const agentName = input.agentName ?? "CEO";

  await fillOnboardingCompany(page, input.companyName);
  await advanceOnboarding(page);

  await expect(page.getByRole("heading", { name: "Create your first agent" })).toBeVisible({
    timeout: 30_000,
  });
  await fillOnboardingAgent(page, agentName);
  await advanceOnboarding(page);

  await expect(page.getByRole("heading", { name: "Give it something to do" })).toBeVisible({
    timeout: 30_000,
  });
  await fillOnboardingTask(page, input.taskTitle);
  await advanceOnboarding(page);

  await expect(page.getByRole("heading", { name: "Ready to launch" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(input.companyName)).toBeVisible();
  await expect(page.getByText(agentName)).toBeVisible();
  await expect(page.getByText(input.taskTitle)).toBeVisible();

  await page.getByRole("button", { name: "Create & Open Issue" }).click();
  await expect(page).toHaveURL(/\/issues\//, { timeout: 30_000 });

  return { agentName };
}

export async function getCompanies(page: Page) {
  const res = await page.request.get(`${apiOrigin(page)}/api/companies`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as CompanyRecord[];
}

export async function getCompanyByName(page: Page, companyName: string) {
  const companies = await getCompanies(page);
  const company = companies.find((entry) => entry.name === companyName);
  expect(company).toBeTruthy();
  return company as CompanyRecord;
}

export async function getAgents(page: Page, companyId: string) {
  const res = await page.request.get(`${apiOrigin(page)}/api/companies/${companyId}/agents`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as AgentRecord[];
}

export async function getAgentByName(page: Page, companyId: string, agentName: string) {
  const agents = await getAgents(page, companyId);
  const agent = agents.find((entry) => entry.name === agentName);
  expect(agent).toBeTruthy();
  return agent as AgentRecord;
}

export async function getIssues(page: Page, companyId: string) {
  const res = await page.request.get(`${apiOrigin(page)}/api/companies/${companyId}/issues`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as IssueRecord[];
}

export async function getIssueByTitle(page: Page, companyId: string, title: string) {
  const issues = await getIssues(page, companyId);
  const issue = issues.find((entry) => entry.title === title);
  expect(issue).toBeTruthy();
  return issue as IssueRecord;
}

export async function getIssue(page: Page, issueId: string, token?: string) {
  return apiRequest<IssueRecord>(page, `/issues/${issueId}`, { token });
}

export async function createAgent(
  page: Page,
  companyId: string,
  body: {
    name: string;
    role?: string;
    reportsTo?: string | null;
    adapterType?: string;
    adapterConfig?: Record<string, unknown>;
  },
  token?: string,
) {
  return apiRequest<AgentRecord>(page, `/companies/${companyId}/agents`, {
    method: "POST",
    token,
    body,
  });
}

export async function createAgentKey(page: Page, agentId: string, name: string) {
  return apiRequest<AgentKeyRecord>(page, `/agents/${agentId}/keys`, {
    method: "POST",
    body: { name },
  });
}

export async function createDepartment(
  page: Page,
  companyId: string,
  body: {
    name: string;
    slug: string;
    mission?: string | null;
    maxConcurrentTemporaryWorkers?: number;
    temporaryWorkerTtlMinutes?: number;
  },
  token?: string,
) {
  return apiRequest<DepartmentRecord>(page, `/companies/${companyId}/departments`, {
    method: "POST",
    token,
    body,
  });
}

export async function assignDepartmentMinister(
  page: Page,
  departmentId: string,
  agentId: string,
  token?: string,
) {
  return apiRequest<DepartmentRecord>(page, `/departments/${departmentId}/assign-minister`, {
    method: "POST",
    token,
    body: { agentId },
  });
}

export async function getDepartment(page: Page, departmentId: string, token?: string) {
  return apiRequest<DepartmentRecord>(page, `/departments/${departmentId}`, { token });
}

export async function routeIssueToDepartment(
  page: Page,
  issueId: string,
  owningDepartmentId: string | null,
  token: string,
) {
  return apiRequest<IssueRecord>(page, `/issues/${issueId}/route-to-department`, {
    method: "POST",
    token,
    body: { owningDepartmentId },
  });
}

export async function ministerIssueIntake(
  page: Page,
  issueId: string,
  response: "accept" | "reject" | "needs_clarification",
  token: string,
  reason?: string | null,
) {
  return apiRequest<IssueRecord>(page, `/issues/${issueId}/minister-intake`, {
    method: "POST",
    token,
    body: { response, reason: reason ?? null },
  });
}

export async function getTemporaryWorkers(page: Page, departmentId: string, token?: string) {
  return apiRequest<TemporaryWorkerRecord[]>(page, `/departments/${departmentId}/temporary-workers`, { token });
}

export async function createTemporaryWorker(
  page: Page,
  departmentId: string,
  body: {
    sourceIssueId: string;
    name: string;
    ttlMinutes?: number;
  },
  token: string,
) {
  return apiRequest<TemporaryWorkerRecord>(page, `/departments/${departmentId}/temporary-workers`, {
    method: "POST",
    token,
    body,
  });
}

export async function pauseTemporaryWorker(page: Page, workerId: string, token: string, reason?: string) {
  return apiRequest<TemporaryWorkerRecord>(page, `/temporary-workers/${workerId}/pause`, {
    method: "POST",
    token,
    body: reason ? { reason } : {},
  });
}

export async function requestTemporaryWorkerResume(page: Page, workerId: string, token: string, reason?: string) {
  return apiRequest<TemporaryWorkerRecord>(page, `/temporary-workers/${workerId}/request-resume`, {
    method: "POST",
    token,
    body: reason ? { reason } : {},
  });
}

export async function approveTemporaryWorkerResume(page: Page, workerId: string, token: string) {
  return apiRequest<TemporaryWorkerRecord>(page, `/temporary-workers/${workerId}/approve-resume`, {
    method: "POST",
    token,
    body: {},
  });
}

export async function getTemporaryWorker(page: Page, workerId: string, token?: string) {
  return apiRequest<TemporaryWorkerRecord>(page, `/temporary-workers/${workerId}`, { token });
}

export async function listRequiredSystemPlugins(page: Page, companyId?: string) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  return apiRequest<RequiredSystemPluginStatusRecord[]>(page, `/system-plugins/status${query}`);
}

export async function reconcileRequiredSystemPlugins(page: Page) {
  return apiRequest<RequiredSystemPluginStatusRecord[]>(page, "/system-plugins/reconcile", {
    method: "POST",
    body: {},
  });
}

export async function waitForRequiredSystemPlugin(
  page: Page,
  pluginKey: string,
  companyId?: string,
) {
  const timeoutMs = 90_000;
  const startedAt = Date.now();
  let latest: RequiredSystemPluginStatusRecord | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const plugins = await listRequiredSystemPlugins(page, companyId);
    latest = plugins.find((entry) => entry.pluginKey === pluginKey) ?? null;
    if (latest?.installed && latest.pluginId && /^(ready|installed|degraded)$/.test(latest.runtimeStatus)) {
      return latest;
    }

    if (latest?.bootstrapError) {
      throw new Error(
        `Required system plugin ${pluginKey} bootstrap failed: ${JSON.stringify(latest)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(
    `Required system plugin ${pluginKey} not ready after ${timeoutMs}ms: ${JSON.stringify(latest)}`,
  );
}

export async function listSystemPluginRollouts(page: Page, query?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return apiRequest<SystemPluginRolloutRecord[]>(page, `/system-plugin-rollouts${suffix ? `?${suffix}` : ""}`);
}

export async function createSystemPluginRollout(
  page: Page,
  body: {
    pluginKey?: string;
    pluginId?: string;
    candidateVersion?: string | null;
    candidateMetadata?: Record<string, unknown>;
    note?: string | null;
  },
) {
  return apiRequest<SystemPluginRolloutRecord>(page, "/system-plugin-rollouts", {
    method: "POST",
    body,
  });
}

export async function getSystemPluginRollout(page: Page, rolloutId: string) {
  return apiRequest<SystemPluginRolloutRecord>(page, `/system-plugin-rollouts/${rolloutId}`);
}

export async function getInstructionBundlePaths(page: Page, agentId: string, companyId: string) {
  const res = await page.request.get(
    `${apiOrigin(page)}/api/agents/${agentId}/instructions-bundle?companyId=${companyId}`,
  );
  expect(res.ok()).toBe(true);
  const payload = (await res.json()) as { files: Array<{ path: string }> };
  return payload.files.map((entry) => entry.path).sort();
}

export async function waitForHeartbeatRun(page: Page, companyId: string, agentId: string) {
  let latestRun: HeartbeatRunRecord | null = null;

  await expect
    .poll(
      async () => {
        const res = await page.request.get(
          `${apiOrigin(page)}/api/companies/${companyId}/heartbeat-runs?agentId=${agentId}`,
        );
        expect(res.ok()).toBe(true);
        const runs = (await res.json()) as HeartbeatRunRecord[];
        latestRun = runs.find((entry) => entry.agentId === agentId) ?? null;
        return latestRun
          ? {
              invocationSource: latestRun.invocationSource,
              status: latestRun.status,
            }
          : null;
      },
      {
        timeout: 30_000,
        intervals: [1_000, 2_000, 5_000],
      },
    )
    .toEqual(
      expect.objectContaining({
        invocationSource: "assignment",
        status: expect.stringMatching(/^(queued|running|succeeded|failed)$/),
      }),
    );

  return latestRun;
}
