import type {
  ApproveTemporaryWorkerResume,
  CreateTemporaryWorker,
  ExtendTemporaryWorkerTtl,
  ReconcileTemporaryWorkerTtl,
  TemporaryWorker,
  TerminateTemporaryWorker,
  UpdateTemporaryWorkerPause,
  RequestTemporaryWorkerResume,
} from "@paperclipai/shared";
import { api } from "./client";

export const temporaryWorkersApi = {
  listByDepartment: (departmentId: string) =>
    api.get<TemporaryWorker[]>(`/departments/${departmentId}/temporary-workers`),

  get: (workerId: string) => api.get<TemporaryWorker>(`/temporary-workers/${workerId}`),

  create: (departmentId: string, body: CreateTemporaryWorker) =>
    api.post<TemporaryWorker>(`/departments/${departmentId}/temporary-workers`, body),

  pause: (workerId: string, body: UpdateTemporaryWorkerPause) =>
    api.post<TemporaryWorker>(`/temporary-workers/${workerId}/pause`, body),

  requestResume: (workerId: string, body: RequestTemporaryWorkerResume) =>
    api.post<TemporaryWorker>(`/temporary-workers/${workerId}/request-resume`, body),

  approveResume: (workerId: string, body: ApproveTemporaryWorkerResume = {}) =>
    api.post<TemporaryWorker>(`/temporary-workers/${workerId}/approve-resume`, body),

  extendTtl: (workerId: string, body: ExtendTemporaryWorkerTtl) =>
    api.post<TemporaryWorker>(`/temporary-workers/${workerId}/extend-ttl`, body),

  terminate: (workerId: string, body: TerminateTemporaryWorker) =>
    api.post<TemporaryWorker>(`/temporary-workers/${workerId}/terminate`, body),

  reconcileTtl: (companyId: string, body: ReconcileTemporaryWorkerTtl = {}) =>
    api.post<{ reconciled: TemporaryWorker[] }>(`/companies/${companyId}/temporary-workers/reconcile-ttl`, body),
};
