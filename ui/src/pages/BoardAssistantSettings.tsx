import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Brain,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  BoardAssistantBindingSessionCreateResult,
  BoardAssistantMemory,
  BoardAssistantMemoryProposal,
  BoardAssistantRequest,
  BoardAssistantThread,
  PatchBoardAssistantSettings,
} from "@paperclipai/shared";
import { BOARD_ASSISTANT_THREAD_MODES } from "@paperclipai/shared";
import { boardAssistantApi } from "@/api/boardAssistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  BindingStepIndicator,
  BindingSessionCard,
  CollapsibleJsonCard,
  formatDateTime,
  InlineErrorNotice,
  MemoryListItem,
  RequestListItem,
  StatCard,
  statusVariant,
  stringifyPayload,
  StructuredTaskCard,
  ThreadConversation,
  ThreadListItem,
  ToggleRow,
} from "./board-assistant/components";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";

const PENDING_STATUSES = new Set(["received", "clarifying", "proposed", "blocked"]);
const ACTIONABLE_REQUEST_STATUSES = new Set(["proposed", "blocked"]);

type AutoExecutionMode = NonNullable<PatchBoardAssistantSettings["autoExecutionMode"]>;

export function BoardAssistantSettings() {
  const { t } = useTranslation("settings");
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdBindingSession, setCreatedBindingSession] = useState<BoardAssistantBindingSessionCreateResult | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [threadDraft, setThreadDraft] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: t("breadcrumbs.settings") },
      { label: t("boardAssistant.breadcrumb") },
    ]);
  }, [setBreadcrumbs, t]);

  const settingsQuery = useQuery({
    queryKey: queryKeys.boardAssistant.settings,
    queryFn: () => boardAssistantApi.getSettings(),
  });
  const bindingQuery = useQuery({
    queryKey: queryKeys.boardAssistant.activeBinding,
    queryFn: () => boardAssistantApi.getActiveBinding(),
    refetchInterval: 15_000,
  });
  const latestBindingSessionQuery = useQuery({
    queryKey: queryKeys.boardAssistant.latestBindingSession("wechat"),
    queryFn: () => boardAssistantApi.getLatestBindingSession("wechat"),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "active" || status === "cancelled" || status === "revoked" ? false : 5_000;
    },
  });
  const requestsQuery = useQuery({
    queryKey: queryKeys.boardAssistant.requests,
    queryFn: () => boardAssistantApi.listRequests(),
    refetchInterval: 15_000,
  });
  const requestDetailQuery = useQuery({
    queryKey: selectedRequestId ? queryKeys.boardAssistant.requestDetail(selectedRequestId) : ["board-assistant", "request-detail", "idle"],
    queryFn: () => boardAssistantApi.getRequest(selectedRequestId!),
    enabled: Boolean(selectedRequestId),
  });
  const memoryProposalsQuery = useQuery({
    queryKey: queryKeys.boardAssistant.memoryProposals,
    queryFn: () => boardAssistantApi.listMemoryProposals(),
    refetchInterval: 30_000,
  });
  const memoriesQuery = useQuery({
    queryKey: queryKeys.boardAssistant.memories,
    queryFn: () => boardAssistantApi.listMemories(),
    refetchInterval: 30_000,
  });
  const threadsQuery = useQuery({
    queryKey: queryKeys.boardAssistant.threads,
    queryFn: () => boardAssistantApi.listThreads(),
    refetchInterval: 30_000,
  });
  const threadMessagesQuery = useQuery({
    queryKey: selectedThreadId ? queryKeys.boardAssistant.threadMessages(selectedThreadId) : ["board-assistant", "thread-messages", "idle"],
    queryFn: () => boardAssistantApi.listThreadMessages(selectedThreadId!),
    enabled: Boolean(selectedThreadId),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!selectedRequestId && requestsQuery.data?.length) {
      setSelectedRequestId(requestsQuery.data[0].id);
    } else if (selectedRequestId && requestsQuery.data && !requestsQuery.data.some((item) => item.id === selectedRequestId)) {
      setSelectedRequestId(requestsQuery.data[0]?.id ?? null);
    }
  }, [requestsQuery.data, selectedRequestId]);

  useEffect(() => {
    if (!selectedProposalId && memoryProposalsQuery.data?.length) {
      setSelectedProposalId(memoryProposalsQuery.data[0].id);
    } else if (
      selectedProposalId &&
      memoryProposalsQuery.data &&
      !memoryProposalsQuery.data.some((item) => item.id === selectedProposalId)
    ) {
      setSelectedProposalId(memoryProposalsQuery.data[0]?.id ?? null);
    }
  }, [memoryProposalsQuery.data, selectedProposalId]);

  useEffect(() => {
    if (!selectedMemoryId && memoriesQuery.data?.length) {
      setSelectedMemoryId(memoriesQuery.data[0].id);
    } else if (selectedMemoryId && memoriesQuery.data && !memoriesQuery.data.some((item) => item.id === selectedMemoryId)) {
      setSelectedMemoryId(memoriesQuery.data[0]?.id ?? null);
    }
  }, [memoriesQuery.data, selectedMemoryId]);

  useEffect(() => {
    if (!selectedThreadId && threadsQuery.data?.length) {
      setSelectedThreadId(threadsQuery.data[0].id);
    } else if (selectedThreadId && threadsQuery.data && !threadsQuery.data.some((item) => item.id === selectedThreadId)) {
      setSelectedThreadId(threadsQuery.data[0]?.id ?? null);
    }
  }, [threadsQuery.data, selectedThreadId]);

  useEffect(() => {
    setThreadDraft("");
  }, [selectedThreadId]);

  const invalidateCoreQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.settings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.activeBinding }),
      queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.requests }),
      queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.memories }),
      queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.memoryProposals }),
      queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.threads }),
    ]);
    if (selectedRequestId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.requestDetail(selectedRequestId) });
    }
    if (selectedThreadId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.threadMessages(selectedThreadId) });
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.latestBindingSession("wechat") });
  };

  const patchMutation = useMutation({
    mutationFn: async (patch: PatchBoardAssistantSettings) => boardAssistantApi.updateSettings(patch),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.update"));
    },
  });

  const createBindingMutation = useMutation({
    mutationFn: () => boardAssistantApi.createBindingSession({ channel: "wechat" }),
    onSuccess: (result) => {
      setActionError(null);
      setCreatedBindingSession(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardAssistant.latestBindingSession("wechat") });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.createBinding"));
    },
  });

  const confirmBindingMutation = useMutation({
    mutationFn: (sessionId: string) => boardAssistantApi.confirmBindingSession(sessionId),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.confirmBinding"));
    },
  });

  const revokeBindingMutation = useMutation({
    mutationFn: (bindingId: string) => boardAssistantApi.revokeBinding(bindingId),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.revokeBinding"));
    },
  });

  const confirmRequestMutation = useMutation({
    mutationFn: ({ requestId, notes }: { requestId: string; notes: string }) =>
      boardAssistantApi.confirmRequest(requestId, { notes: notes || undefined }),
    onSuccess: async () => {
      setActionError(null);
      setConfirmNotes("");
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.confirmRequest"));
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      boardAssistantApi.rejectRequest(requestId, { reason: reason || undefined }),
    onSuccess: async () => {
      setActionError(null);
      setRejectReason("");
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.rejectRequest"));
    },
  });

  const rewakeTargetMutation = useMutation({
    mutationFn: (targetId: string) => boardAssistantApi.rewakeRequestTarget(targetId),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.confirmRequest"));
    },
  });

  const cancelTargetMutation = useMutation({
    mutationFn: (targetId: string) => boardAssistantApi.cancelRequestTarget(targetId),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.rejectRequest"));
    },
  });

  const approveProposalMutation = useMutation({
    mutationFn: (proposalId: string) => boardAssistantApi.approveMemoryProposal(proposalId),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.approveMemory"));
    },
  });

  const rejectProposalMutation = useMutation({
    mutationFn: (proposalId: string) => boardAssistantApi.rejectMemoryProposal(proposalId),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.rejectMemory"));
    },
  });

  const suppressMemoryMutation = useMutation({
    mutationFn: ({ memoryId, suppress }: { memoryId: string; suppress: boolean }) =>
      boardAssistantApi.suppressMemory(memoryId, { suppress }),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.suppressMemory"));
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (memoryId: string) => boardAssistantApi.deleteMemory(memoryId),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.deleteMemory"));
    },
  });

  const updateThreadModeMutation = useMutation({
    mutationFn: ({ threadId, mode }: { threadId: string; mode: typeof BOARD_ASSISTANT_THREAD_MODES[number] }) =>
      boardAssistantApi.updateThreadMode(threadId, { mode }),
    onSuccess: async () => {
      setActionError(null);
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.updateThreadMode"));
    },
  });

  const sendThreadMessageMutation = useMutation({
    mutationFn: ({ threadId, content }: { threadId: string; content: string }) =>
      boardAssistantApi.sendThreadMessage(threadId, { content, metadata: {} }),
    onSuccess: async () => {
      setActionError(null);
      setThreadDraft("");
      await invalidateCoreQueries();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("boardAssistant.errors.sendThreadMessage"));
    },
  });

  const settings = settingsQuery.data;
  const requests = requestsQuery.data ?? [];
  const pendingRequests = useMemo(
    () => requests.filter((request) => PENDING_STATUSES.has(request.status)).length,
    [requests],
  );
  const selectedProposal = useMemo(() => (memoryProposalsQuery.data ?? []).find((item) => item.id === selectedProposalId) ?? null, [memoryProposalsQuery.data, selectedProposalId]);
  const selectedMemory = useMemo(() => (memoriesQuery.data ?? []).find((item) => item.id === selectedMemoryId) ?? null, [memoriesQuery.data, selectedMemoryId]);
  const selectedThread = useMemo(() => (threadsQuery.data ?? []).find((item) => item.id === selectedThreadId) ?? null, [threadsQuery.data, selectedThreadId]);
  const ascendingThreadMessages = useMemo(() => {
    const rows = threadMessagesQuery.data ?? [];
    return [...rows].reverse();
  }, [threadMessagesQuery.data]);
  const requestCardLabels = useMemo(() => ({
    task: t("boardAssistant.requests.card.task"),
    target: t("boardAssistant.requests.card.target"),
    suggestedAction: t("boardAssistant.requests.card.suggestedAction"),
    riskLevel: t("boardAssistant.requests.card.riskLevel"),
    executionMode: t("boardAssistant.requests.card.executionMode"),
    createsFormalObject: t("boardAssistant.requests.card.createsFormalObject"),
    rationale: t("boardAssistant.requests.card.rationale"),
    plannedCalls: t("boardAssistant.requests.card.plannedCalls"),
    pendingConfirmation: t("boardAssistant.requests.card.pendingConfirmation"),
    expectedOutput: t("boardAssistant.requests.card.expectedOutput"),
    yes: t("boardAssistant.shared.yes"),
    no: t("boardAssistant.shared.no"),
    empty: t("boardAssistant.shared.empty"),
  }), [t]);
  const threadModeLabelMap = useMemo(() => ({
    observe: t("boardAssistant.threads.modeOptions.observe"),
    joint_speaking: t("boardAssistant.threads.modeOptions.joint_speaking"),
    takeover: t("boardAssistant.threads.modeOptions.takeover"),
  }), [t]);

  const patch = (input: PatchBoardAssistantSettings) => patchMutation.mutate(input);
  const onModeChange = (value: AutoExecutionMode) => patch({ autoExecutionMode: value });

  if (settingsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("boardAssistant.loading")}</div>;
  }

  if (settingsQuery.error || !settings) {
    return (
      <div className="text-sm text-destructive">
        {settingsQuery.error instanceof Error ? settingsQuery.error.message : t("boardAssistant.errors.load")}
      </div>
    );
  }

  const bindingSession = latestBindingSessionQuery.data ?? createdBindingSession?.session ?? null;
  const actionableRequest = requestDetailQuery.data?.request && ACTIONABLE_REQUEST_STATUSES.has(requestDetailQuery.data.request.status) ? requestDetailQuery.data.request : null;
  const canSendThreadMessage = selectedThread?.threadKind === "internal";
  const pendingMemoryCount = (memoryProposalsQuery.data ?? []).filter((item) => item.status === "pending").length;
  const requestsError = requestsQuery.error instanceof Error ? requestsQuery.error.message : null, requestDetailError = requestDetailQuery.error instanceof Error ? requestDetailQuery.error.message : null, bindingSessionError = latestBindingSessionQuery.error instanceof Error ? latestBindingSessionQuery.error.message : null;
  const memoryProposalsError = memoryProposalsQuery.error instanceof Error ? memoryProposalsQuery.error.message : null, memoriesError = memoriesQuery.error instanceof Error ? memoriesQuery.error.message : null, threadsError = threadsQuery.error instanceof Error ? threadsQuery.error.message : null, threadMessagesError = threadMessagesQuery.error instanceof Error ? threadMessagesQuery.error.message : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("boardAssistant.title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("boardAssistant.description")}</p>
      </div>

      <InlineErrorNotice message={actionError} />

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{t("boardAssistant.sections.controls")}</h2>
          <p className="text-sm text-muted-foreground">{t("boardAssistant.sections.controlsHint")}</p>
        </div>

        <ToggleRow
          title={t("boardAssistant.enabled.title")}
          description={t("boardAssistant.enabled.description")}
          checked={settings.enabled === true}
          disabled={patchMutation.isPending}
          onToggle={() => patch({ enabled: !settings.enabled })}
          label={t("boardAssistant.enabled.toggleLabel")}
        />

        <div className="grid gap-2">
          <label className="text-sm font-semibold" htmlFor="board-assistant-auto-mode">
            {t("boardAssistant.autoExecution.title")}
          </label>
          <p className="text-sm text-muted-foreground">{t("boardAssistant.autoExecution.description")}</p>
          <select
            id="board-assistant-auto-mode"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            value={settings.autoExecutionMode}
            disabled={patchMutation.isPending}
            onChange={(event) => onModeChange(event.target.value as AutoExecutionMode)}
          >
            <option value="manual_confirm">{t("boardAssistant.autoExecution.options.manual_confirm")}</option>
            <option value="low_risk_auto">{t("boardAssistant.autoExecution.options.low_risk_auto")}</option>
            <option value="enhanced_auto">{t("boardAssistant.autoExecution.options.enhanced_auto")}</option>
          </select>
        </div>

        <ToggleRow
          title={t("boardAssistant.proactiveBriefing.title")}
          description={t("boardAssistant.proactiveBriefing.description")}
          checked={settings.allowProactiveBriefing === true}
          disabled={patchMutation.isPending}
          onToggle={() => patch({ allowProactiveBriefing: !settings.allowProactiveBriefing })}
          label={t("boardAssistant.proactiveBriefing.toggleLabel")}
        />

        <ToggleRow
          title={t("boardAssistant.queryGroup.title")}
          description={t("boardAssistant.queryGroup.description")}
          checked={settings.allowAllActiveCompaniesQueryGroup === true}
          disabled={patchMutation.isPending}
          onToggle={() => patch({ allowAllActiveCompaniesQueryGroup: !settings.allowAllActiveCompaniesQueryGroup })}
          label={t("boardAssistant.queryGroup.toggleLabel")}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title={t("boardAssistant.summary.bindingTitle")}
          value={bindingQuery.data ? t("boardAssistant.summary.bound") : t("boardAssistant.summary.unbound")}
          hint={bindingQuery.data?.externalDisplayName || bindingQuery.data?.externalUserId || t("boardAssistant.summary.bindingHint")}
          icon={Link2}
        />
        <StatCard
          title={t("boardAssistant.summary.pendingTitle")}
          value={String(pendingRequests)}
          hint={t("boardAssistant.summary.pendingHint")}
          icon={ShieldCheck}
        />
        <StatCard
          title={t("boardAssistant.summary.memoryTitle")}
          value={String(pendingMemoryCount)}
          hint={t("boardAssistant.summary.memoryHint")}
          icon={Brain}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t("boardAssistant.sections.binding")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{t("boardAssistant.binding.hint")}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => createBindingMutation.mutate()}
                disabled={createBindingMutation.isPending}
              >
                {createBindingMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {t("boardAssistant.binding.create")}
              </Button>
            </div>

            <BindingStepIndicator
              session={bindingSession}
              labels={[
                t("boardAssistant.binding.steps.create"),
                t("boardAssistant.binding.steps.channel"),
                t("boardAssistant.binding.steps.confirm"),
              ]}
            />

            {bindingQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("boardAssistant.binding.loading")}</p>
            ) : bindingQuery.error ? (
              <p className="text-sm text-destructive">
                {bindingQuery.error instanceof Error ? bindingQuery.error.message : t("boardAssistant.binding.loadError")}
              </p>
            ) : bindingQuery.data ? (
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="uppercase">{bindingQuery.data.channel}</Badge>
                  <Badge variant={statusVariant(bindingQuery.data.status)}>{bindingQuery.data.status}</Badge>
                </div>
                <div className="mt-3 text-sm font-medium">
                  {bindingQuery.data.externalDisplayName || bindingQuery.data.externalUserId}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {bindingQuery.data.externalThreadId || t("boardAssistant.binding.noThread")}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revokeBindingMutation.mutate(bindingQuery.data!.id)}
                    disabled={revokeBindingMutation.isPending}
                  >
                    <Unplug className="h-4 w-4" />
                    {t("boardAssistant.binding.revoke")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("boardAssistant.binding.emptyTitle")}</div>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li>{t("boardAssistant.binding.emptySteps.create")}</li>
                    <li>{t("boardAssistant.binding.emptySteps.channel")}</li>
                    <li>{t("boardAssistant.binding.emptySteps.confirm")}</li>
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">{t("boardAssistant.binding.sessionTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("boardAssistant.binding.sessionHint")}</p>
            </div>
            <InlineErrorNotice message={bindingSessionError} />
            <BindingSessionCard
              session={bindingSession}
              bindingToken={createdBindingSession?.session.id === bindingSession?.id ? (createdBindingSession?.bindingToken ?? null) : null}
              labels={{
                empty: t("boardAssistant.binding.sessionEmpty"),
                bindingCode: t("boardAssistant.binding.bindingCode"),
                expiresAt: t("boardAssistant.binding.expiresAt"),
                bindingToken: t("boardAssistant.binding.bindingToken"),
                refresh: t("boardAssistant.binding.refresh"),
                confirm: t("boardAssistant.binding.confirm"),
                sharedEmpty: t("boardAssistant.shared.empty"),
                sharedCopy: t("boardAssistant.shared.copy"),
                sharedCopied: t("boardAssistant.shared.copied"),
              }}
              refreshing={latestBindingSessionQuery.isFetching}
              confirming={confirmBindingMutation.isPending}
              onRefresh={() => latestBindingSessionQuery.refetch()}
              onConfirm={(sessionId) => confirmBindingMutation.mutate(sessionId)}
            />
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="requests">{t("boardAssistant.tabs.requests")}</TabsTrigger>
          <TabsTrigger value="memory">{t("boardAssistant.tabs.memory")}</TabsTrigger>
          <TabsTrigger value="threads">{t("boardAssistant.tabs.threads")}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <section className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">{t("boardAssistant.requests.title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("boardAssistant.requests.hint")}</p>
                </div>
                <InlineErrorNotice message={requestsError} />
                <div className="space-y-2">
                  {requests.map((request) => (
                    <RequestListItem
                      key={request.id}
                      request={request}
                      selected={request.id === selectedRequestId}
                      onSelect={() => setSelectedRequestId(request.id)}
                    />
                  ))}
                  {requests.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      {t("boardAssistant.requests.empty")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                {requestDetailError ? (
                  <InlineErrorNotice message={requestDetailError} />
                ) : !requestDetailQuery.data ? (
                  <p className="text-sm text-muted-foreground">{t("boardAssistant.requests.selectHint")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(requestDetailQuery.data.request.status)}>
                            {requestDetailQuery.data.request.status}
                          </Badge>
                          {requestDetailQuery.data.request.targetKind && (
                            <Badge variant="outline">{requestDetailQuery.data.request.targetKind}</Badge>
                          )}
                          {requestDetailQuery.data.request.proposedAction && (
                            <Badge variant="outline">{requestDetailQuery.data.request.proposedAction}</Badge>
                          )}
                        </div>
                        <h2 className="text-base font-semibold">
                          {requestDetailQuery.data.request.summary || t("boardAssistant.requests.untitled")}
                        </h2>
                        <p className="text-sm text-muted-foreground">{requestDetailQuery.data.request.messageText || "—"}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{formatDateTime(requestDetailQuery.data.request.createdAt)}</div>
                        <div>{requestDetailQuery.data.request.targetRef || "—"}</div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <StructuredTaskCard
                        payload={requestDetailQuery.data.request.cardPayload}
                        labels={requestCardLabels}
                      />
                      <CollapsibleJsonCard
                        title={t("boardAssistant.requests.proposedPayload")}
                        value={requestDetailQuery.data.request.proposedPayload}
                        emptyLabel={t("boardAssistant.shared.empty")}
                        expandLabel={t("boardAssistant.shared.expand")}
                        collapseLabel={t("boardAssistant.shared.collapse")}
                      />
                    </div>

                    <CollapsibleJsonCard
                      title={t("boardAssistant.requests.cardPayload")}
                      value={requestDetailQuery.data.request.cardPayload}
                      emptyLabel={t("boardAssistant.shared.empty")}
                      expandLabel={t("boardAssistant.shared.expand")}
                      collapseLabel={t("boardAssistant.shared.collapse")}
                    />

                    {requestDetailQuery.data.destructivePreview && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                        <div className="text-sm font-semibold text-destructive">
                          {t("boardAssistant.requests.destructivePreview")}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {requestDetailQuery.data.destructivePreview.impactSummary}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                          <div>
                            {t("boardAssistant.requests.activeRuns")}: {requestDetailQuery.data.destructivePreview.activeRunCount}
                          </div>
                          <div>
                            {t("boardAssistant.requests.entityCounts")}:{" "}
                            {stringifyPayload(requestDetailQuery.data.destructivePreview.entityCounts)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-sm font-semibold">{t("boardAssistant.requests.targets")}</div>
                      {requestDetailQuery.data.targets.length > 0 ? (
                        <div className="space-y-2">
                          {requestDetailQuery.data.targets.map((target) => (
                            <div key={target.id} className="rounded-lg border border-border px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={statusVariant(target.status)}>{target.status}</Badge>
                                <Badge variant="outline">{target.targetKind}</Badge>
                                <span className="text-sm">{target.targetRef}</span>
                              </div>
                              {target.summary && (
                                <div className="mt-2 text-sm text-muted-foreground">{target.summary}</div>
                              )}
                              {target.status === "blocked" && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => rewakeTargetMutation.mutate(target.id)}
                                    disabled={rewakeTargetMutation.isPending}
                                  >
                                    {t("boardAssistant.requests.rewake")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => cancelTargetMutation.mutate(target.id)}
                                    disabled={cancelTargetMutation.isPending}
                                  >
                                    {t("boardAssistant.requests.cancelTarget")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                          {t("boardAssistant.requests.noTargets")}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 rounded-lg border border-border p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="space-y-3">
                        {!actionableRequest && (
                          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            {t("boardAssistant.requests.notActionable")}
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="board-assistant-confirm-notes">
                            {t("boardAssistant.requests.confirmNotes")}
                          </label>
                          <Textarea
                            id="board-assistant-confirm-notes"
                            value={confirmNotes}
                            onChange={(event) => setConfirmNotes(event.target.value)}
                            placeholder={t("boardAssistant.requests.confirmNotesPlaceholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="board-assistant-reject-reason">
                            {t("boardAssistant.requests.rejectReason")}
                          </label>
                          <Input
                            id="board-assistant-reject-reason"
                            value={rejectReason}
                            onChange={(event) => setRejectReason(event.target.value)}
                            placeholder={t("boardAssistant.requests.rejectReasonPlaceholder")}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 lg:justify-end">
                        <Button
                          onClick={() =>
                            actionableRequest && confirmRequestMutation.mutate({ requestId: actionableRequest.id, notes: confirmNotes })
                          }
                          disabled={!actionableRequest || confirmRequestMutation.isPending}
                        >
                          {t("boardAssistant.requests.confirm")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            actionableRequest && rejectRequestMutation.mutate({ requestId: actionableRequest.id, reason: rejectReason })
                          }
                          disabled={!actionableRequest || rejectRequestMutation.isPending}
                        >
                          {t("boardAssistant.requests.reject")}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="memory">
          <section className="grid gap-4 lg:grid-cols-[20rem_20rem_minmax(0,1fr)]">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">{t("boardAssistant.memory.proposalsTitle")}</h2>
                  <p className="text-sm text-muted-foreground">{t("boardAssistant.memory.proposalsHint")}</p>
                </div>
                <InlineErrorNotice message={memoryProposalsError} />
                <div className="space-y-2">
                  {(memoryProposalsQuery.data ?? []).map((proposal: BoardAssistantMemoryProposal) => (
                    <MemoryListItem
                      key={proposal.id}
                      title={proposal.summary}
                      subtitle={proposal.memoryKind}
                      status={proposal.status}
                      confidence={proposal.confidence}
                      selected={proposal.id === selectedProposalId}
                      onSelect={() => setSelectedProposalId(proposal.id)}
                    />
                  ))}
                  {(memoryProposalsQuery.data ?? []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      {t("boardAssistant.memory.proposalsEmpty")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">{t("boardAssistant.memory.memoriesTitle")}</h2>
                  <p className="text-sm text-muted-foreground">{t("boardAssistant.memory.memoriesHint")}</p>
                </div>
                <InlineErrorNotice message={memoriesError} />
                <div className="space-y-2">
                  {(memoriesQuery.data ?? []).map((memory: BoardAssistantMemory) => (
                    <MemoryListItem
                      key={memory.id}
                      title={memory.summary}
                      subtitle={memory.memoryKind}
                      status={memory.status}
                      confidence={memory.confidence}
                      selected={memory.id === selectedMemoryId}
                      onSelect={() => setSelectedMemoryId(memory.id)}
                    />
                  ))}
                  {(memoriesQuery.data ?? []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      {t("boardAssistant.memory.memoriesEmpty")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">{t("boardAssistant.memory.detailTitle")}</h2>
                  <p className="text-sm text-muted-foreground">{t("boardAssistant.memory.detailHint")}</p>
                </div>

                {selectedProposal ? (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(selectedProposal.status)}>{selectedProposal.status}</Badge>
                      <Badge variant="outline">{selectedProposal.memoryKind}</Badge>
                    </div>
                    <div className="text-base font-semibold">{selectedProposal.summary}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("boardAssistant.memory.visibility")}: {selectedProposal.visibilityPolicy}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("boardAssistant.memory.sourceRefs")}: {selectedProposal.sourceRefs.join(", ") || "—"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveProposalMutation.mutate(selectedProposal.id)}
                        disabled={approveProposalMutation.isPending || selectedProposal.status !== "pending"}
                      >
                        {t("boardAssistant.memory.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectProposalMutation.mutate(selectedProposal.id)}
                        disabled={rejectProposalMutation.isPending || selectedProposal.status !== "pending"}
                      >
                        {t("boardAssistant.memory.reject")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    {t("boardAssistant.memory.noProposalSelected")}
                  </div>
                )}

                {selectedMemory ? (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(selectedMemory.status)}>{selectedMemory.status}</Badge>
                      <Badge variant="outline">{selectedMemory.memoryKind}</Badge>
                    </div>
                    <div className="text-base font-semibold">{selectedMemory.summary}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("boardAssistant.memory.visibility")}: {selectedMemory.visibilityPolicy}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("boardAssistant.memory.sourceRefs")}: {selectedMemory.sourceRefs.join(", ") || "—"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          suppressMemoryMutation.mutate({
                            memoryId: selectedMemory.id,
                            suppress: selectedMemory.status !== "suppressed",
                          })
                        }
                        disabled={suppressMemoryMutation.isPending || selectedMemory.status === "deleted"}
                      >
                        {selectedMemory.status === "suppressed"
                          ? t("boardAssistant.memory.restore")
                          : t("boardAssistant.memory.suppress")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMemoryMutation.mutate(selectedMemory.id)}
                        disabled={deleteMemoryMutation.isPending || selectedMemory.status === "deleted"}
                      >
                        {t("boardAssistant.memory.delete")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    {t("boardAssistant.memory.noMemorySelected")}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="threads">
          <section className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">{t("boardAssistant.threads.title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("boardAssistant.threads.hint")}</p>
                </div>
                <InlineErrorNotice message={threadsError} />
                <div className="space-y-2">
                  {(threadsQuery.data ?? []).map((thread) => (
                    <ThreadListItem
                      key={thread.id}
                      thread={thread}
                      selected={thread.id === selectedThreadId}
                      onSelect={() => setSelectedThreadId(thread.id)}
                    />
                  ))}
                  {(threadsQuery.data ?? []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      {t("boardAssistant.threads.empty")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                {threadMessagesError ? (
                  <InlineErrorNotice message={threadMessagesError} />
                ) : !selectedThread ? (
                  <p className="text-sm text-muted-foreground">{t("boardAssistant.threads.selectHint")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{selectedThread.threadKind}</Badge>
                          <Badge variant="outline">{selectedThread.mode}</Badge>
                          {selectedThread.channel && <Badge variant="outline">{selectedThread.channel}</Badge>}
                        </div>
                        <h2 className="text-base font-semibold">
                          {selectedThread.subjectId || selectedThread.externalThreadId || selectedThread.id}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedThread.activeContextSummary || t("boardAssistant.threads.noSummary")}
                        </p>
                      </div>
                      <div className="min-w-[12rem] space-y-2">
                        <label className="text-sm font-medium" htmlFor="board-assistant-thread-mode">
                          {t("boardAssistant.threads.mode")}
                        </label>
                        <select
                          id="board-assistant-thread-mode"
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                          value={selectedThread.mode}
                          onChange={(event) =>
                            updateThreadModeMutation.mutate({
                              threadId: selectedThread.id,
                              mode: event.target.value as typeof BOARD_ASSISTANT_THREAD_MODES[number],
                            })
                          }
                          disabled={updateThreadModeMutation.isPending || selectedThread.threadKind !== "internal"}
                        >
                          {BOARD_ASSISTANT_THREAD_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {threadModeLabelMap[mode]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <ThreadConversation
                      messagesTitle={t("boardAssistant.threads.messagesTitle")}
                      messagesEmpty={t("boardAssistant.threads.messagesEmpty")}
                      messages={ascendingThreadMessages}
                      canReply={canSendThreadMessage}
                      replyTitle={t("boardAssistant.threads.replyTitle")}
                      replyHint={t("boardAssistant.threads.replyHint")}
                      replyDisabled={t("boardAssistant.threads.replyDisabled")}
                      replyPlaceholder={t("boardAssistant.threads.replyPlaceholder")}
                      sendLabel={t("boardAssistant.threads.send")}
                      draft={threadDraft}
                      sending={sendThreadMessageMutation.isPending}
                      onDraftChange={setThreadDraft}
                      onSend={() =>
                        selectedThread &&
                        sendThreadMessageMutation.mutate({
                          threadId: selectedThread.id,
                          content: threadDraft.trim(),
                        })
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
