import type {
  DepartmentBudgetStatus,
  DepartmentStatus,
  MinisterIntakeResponse,
  TemporaryWorkerStatus,
} from "../constants/department.js";

export interface Department {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  mission: string | null;
  status: DepartmentStatus;
  ministerAgentId: string | null;
  maxConcurrentTemporaryWorkers: number;
  temporaryWorkerTtlMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentBudgetEnvelope {
  id: string;
  departmentId: string;
  companyId: string;
  monthlyLimitCents: number;
  reservedCents: number;
  spentCents: number;
  status: DepartmentBudgetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MinisterIntakeDecision {
  id: string;
  departmentId: string;
  issueId: string;
  ministerAgentId: string;
  response: MinisterIntakeResponse;
  reason: string | null;
  createdAt: Date;
}

export interface TemporaryWorker {
  id: string;
  companyId: string;
  departmentId: string;
  ownerMinisterAgentId: string;
  sourceIssueId: string;
  name: string;
  status: TemporaryWorkerStatus;
  ttlExpiresAt: Date;
  statusReason: string | null;
  resumeRequestedAt: Date | null;
  terminatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
