import type {
  AllocateDepartmentBudget,
  AssignDepartmentMinister,
  CreateDepartment,
  Department,
  DepartmentBudgetEnvelope,
  FreezeDepartment,
  UpdateDepartment,
} from "@paperclipai/shared";
import { api } from "./client";

export const departmentsApi = {
  list: (companyId: string) =>
    api.get<Department[]>(`/companies/${companyId}/departments`),

  get: (departmentId: string) =>
    api.get<Department>(`/departments/${departmentId}`),

  create: (companyId: string, body: CreateDepartment) =>
    api.post<Department>(`/companies/${companyId}/departments`, body),

  update: (departmentId: string, body: UpdateDepartment) =>
    api.patch<Department>(`/departments/${departmentId}`, body),

  assignMinister: (departmentId: string, body: AssignDepartmentMinister) =>
    api.post<Department>(`/departments/${departmentId}/assign-minister`, body),

  removeMinister: (departmentId: string) =>
    api.post<Department>(`/departments/${departmentId}/remove-minister`, {}),

  freeze: (departmentId: string, body: FreezeDepartment) =>
    api.post<Department>(`/departments/${departmentId}/freeze`, body),

  unfreeze: (departmentId: string) =>
    api.post<Department>(`/departments/${departmentId}/unfreeze`, {}),

  getBudget: (departmentId: string) =>
    api.get<DepartmentBudgetEnvelope>(`/departments/${departmentId}/budget`),

  allocateBudget: (departmentId: string, body: AllocateDepartmentBudget) =>
    api.post<DepartmentBudgetEnvelope>(`/departments/${departmentId}/budget/allocate`, body),
};
