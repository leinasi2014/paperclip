import type {
  ApproveBoardAssistantMemoryProposal,
  BoardAssistantBinding,
  BoardAssistantBindingSession,
  BoardAssistantBindingSessionConfirmResult,
  BoardAssistantBindingSessionCreateResult,
  BoardAssistantMemory,
  BoardAssistantMemoryProposal,
  BoardAssistantRequest,
  BoardAssistantRequestDetail,
  BoardAssistantSettings,
  BoardAssistantThread,
  BoardAssistantThreadMessage,
  ConfirmBoardAssistantRequest,
  CreateBoardAssistantBindingSession,
  CreateBoardAssistantThreadMessage,
  PatchBoardAssistantSettings,
  RejectBoardAssistantMemoryProposal,
  RejectBoardAssistantRequest,
  SuppressBoardAssistantMemory,
  UpdateBoardAssistantThreadMode,
} from "@paperclipai/shared";
import { api } from "./client";

export const boardAssistantApi = {
  getSettings: () => api.get<BoardAssistantSettings>("/board-assistant/settings"),
  updateSettings: (patch: PatchBoardAssistantSettings) =>
    api.patch<BoardAssistantSettings>("/board-assistant/settings", patch),
  createBindingSession: (input: CreateBoardAssistantBindingSession) =>
    api.post<BoardAssistantBindingSessionCreateResult>("/board-assistant/bindings/sessions", input),
  getLatestBindingSession: (channel: "wechat") =>
    api.get<BoardAssistantBindingSession | null>(`/board-assistant/bindings/sessions/latest?channel=${channel}`),
  getBindingSession: (bindingSessionId: string) =>
    api.get<BoardAssistantBindingSession>(`/board-assistant/bindings/sessions/${bindingSessionId}`),
  confirmBindingSession: (bindingSessionId: string) =>
    api.post<BoardAssistantBindingSessionConfirmResult>(
      `/board-assistant/bindings/sessions/${bindingSessionId}/confirm`,
      {},
    ),
  revokeBinding: (bindingId: string) =>
    api.post<BoardAssistantBinding>("/board-assistant/bindings/revoke", { bindingId }),
  getActiveBinding: () => api.get<BoardAssistantBinding | null>("/board-assistant/bindings/active"),
  listRequests: () => api.get<BoardAssistantRequest[]>("/board-assistant/requests"),
  getRequest: (requestId: string) =>
    api.get<BoardAssistantRequestDetail>(`/board-assistant/requests/${requestId}`),
  confirmRequest: (requestId: string, body: ConfirmBoardAssistantRequest) =>
    api.post<BoardAssistantRequest>(`/board-assistant/requests/${requestId}/confirm`, body),
  rejectRequest: (requestId: string, body: RejectBoardAssistantRequest) =>
    api.post<BoardAssistantRequest>(`/board-assistant/requests/${requestId}/reject`, body),
  rewakeRequestTarget: (targetId: string) =>
    api.post(`/board-assistant/request-targets/${targetId}/rewake`, {}),
  cancelRequestTarget: (targetId: string) =>
    api.post(`/board-assistant/request-targets/${targetId}/cancel`, {}),
  listMemories: () => api.get<BoardAssistantMemory[]>("/board-assistant/memories"),
  listMemoryProposals: () =>
    api.get<BoardAssistantMemoryProposal[]>("/board-assistant/memory-proposals"),
  approveMemoryProposal: (proposalId: string, body: ApproveBoardAssistantMemoryProposal = {}) =>
    api.post<BoardAssistantMemoryProposal>(`/board-assistant/memory-proposals/${proposalId}/approve`, body),
  rejectMemoryProposal: (proposalId: string, body: RejectBoardAssistantMemoryProposal = {}) =>
    api.post<BoardAssistantMemoryProposal>(`/board-assistant/memory-proposals/${proposalId}/reject`, body),
  suppressMemory: (memoryId: string, body: SuppressBoardAssistantMemory) =>
    api.post<BoardAssistantMemory>(`/board-assistant/memories/${memoryId}/suppress`, body),
  deleteMemory: (memoryId: string) =>
    api.delete<BoardAssistantMemory>(`/board-assistant/memories/${memoryId}`),
  listThreads: () => api.get<BoardAssistantThread[]>("/board-assistant/threads"),
  listThreadMessages: (threadId: string) =>
    api.get<BoardAssistantThreadMessage[]>(`/board-assistant/threads/${threadId}/messages`),
  sendThreadMessage: (threadId: string, body: CreateBoardAssistantThreadMessage) =>
    api.post<BoardAssistantThreadMessage>(`/board-assistant/threads/${threadId}/messages`, body),
  updateThreadMode: (threadId: string, body: UpdateBoardAssistantThreadMode) =>
    api.patch<BoardAssistantThread>(`/board-assistant/threads/${threadId}/mode`, body),
};
