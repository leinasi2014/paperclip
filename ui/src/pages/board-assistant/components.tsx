import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Copy } from "lucide-react";
import type {
  BoardAssistantBindingSession,
  BoardAssistantRequest,
  BoardAssistantThread,
  BoardAssistantThreadMessage,
} from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TaskCardShape = {
  task?: unknown;
  target?: unknown;
  suggestedAction?: unknown;
  riskLevel?: unknown;
  executionMode?: unknown;
  createsFormalObject?: unknown;
  rationale?: unknown;
  plannedCalls?: unknown;
  pendingConfirmation?: unknown;
  expectedOutput?: unknown;
};

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function stringifyPayload(value: unknown) {
  if (value == null) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function statusVariant(status: string) {
  if (status === "done" || status === "active") return "default" as const;
  if (status === "blocked" || status === "failed" || status === "revoked") return "destructive" as const;
  if (status === "pending" || status === "proposed" || status === "clarifying" || status === "pending_web_confirm") {
    return "secondary" as const;
  }
  return "outline" as const;
}

export function BindingStepIndicator({
  session,
  labels,
}: {
  session: BoardAssistantBindingSession | null;
  labels: [string, string, string];
}) {
  const activeStep = !session
    ? 0
    : session.status === "pending_channel_handshake"
      ? 1
      : session.status === "pending_web_confirm"
        ? 2
        : 3;

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {labels.map((label, index) => {
        const step = index + 1;
        const isDone = activeStep > step;
        const isActive = activeStep === step;
        return (
          <div
            key={label}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-3 text-sm",
              isActive && "border-primary bg-primary/5",
              isDone && "border-emerald-500/30 bg-emerald-500/5",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                isActive && "border-primary bg-primary text-primary-foreground",
                isDone && "border-emerald-600 bg-emerald-600 text-white",
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : step}
            </div>
            <div className="min-w-0">
              <div className="font-medium">{label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CopyableCode({
  value,
  emptyLabel,
  copyLabel,
  copiedLabel,
  variant = "code",
}: {
  value: string | null | undefined;
  emptyLabel: string;
  copyLabel: string;
  copiedLabel: string;
  variant?: "code" | "token";
}) {
  const [copied, setCopied] = useState(false);
  const displayValue = (value ?? "").trim();

  async function handleCopy() {
    if (!displayValue) return;
    await navigator.clipboard.writeText(displayValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!displayValue) {
    return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "font-mono font-semibold",
            variant === "code"
              ? "text-2xl tracking-[0.35em]"
              : "max-w-full break-all text-xs tracking-normal text-muted-foreground",
          )}
        >
          {displayValue}
        </div>
        <Button size="sm" variant="outline" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
    </div>
  );
}

export function InlineErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

export function BindingSessionCard({
  session,
  bindingToken,
  labels,
  refreshing,
  confirming,
  onRefresh,
  onConfirm,
}: {
  session: BoardAssistantBindingSession | null;
  bindingToken: string | null;
  labels: {
    empty: string;
    bindingCode: string;
    expiresAt: string;
    bindingToken: string;
    refresh: string;
    confirm: string;
    sharedEmpty: string;
    sharedCopy: string;
    sharedCopied: string;
  };
  refreshing: boolean;
  confirming: boolean;
  onRefresh: () => void;
  onConfirm: (sessionId: string) => void;
}) {
  if (!session) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="uppercase">{session.channel}</Badge>
        <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{labels.bindingCode}</div>
          <CopyableCode
            value={session.bindingCode}
            emptyLabel={labels.sharedEmpty}
            copyLabel={labels.sharedCopy}
            copiedLabel={labels.sharedCopied}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{labels.expiresAt}</div>
          <div className="text-sm">{formatDateTime(session.expiresAt)}</div>
        </div>
      </div>
      {bindingToken && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{labels.bindingToken}</div>
          <CopyableCode
            value={bindingToken}
            emptyLabel={labels.sharedEmpty}
            copyLabel={labels.sharedCopy}
            copiedLabel={labels.sharedCopied}
            variant="token"
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
          {labels.refresh}
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(session.id)}
          disabled={confirming || session.status !== "pending_web_confirm"}
        >
          {labels.confirm}
        </Button>
      </div>
    </div>
  );
}

export function CollapsibleJsonCard({
  title,
  value,
  emptyLabel = "—",
  expandLabel,
  collapseLabel,
}: {
  title: string;
  value: unknown;
  emptyLabel?: string;
  expandLabel: string;
  collapseLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = useMemo(() => stringifyPayload(value), [value]);
  const hasValue = text !== "—";

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
        {hasValue && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? collapseLabel : expandLabel}
          </Button>
        )}
      </div>
      {hasValue ? (
        <pre
          className={cn(
            "overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs transition-[max-height]",
            expanded ? "max-h-none" : "max-h-24 overflow-hidden",
          )}
        >
          {text}
        </pre>
      ) : (
        <div className="text-sm text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  );
}

export function StructuredTaskCard({
  payload,
  labels,
}: {
  payload: unknown;
  labels: {
    task: string;
    target: string;
    suggestedAction: string;
    riskLevel: string;
    executionMode: string;
    createsFormalObject: string;
    rationale: string;
    plannedCalls: string;
    pendingConfirmation: string;
    expectedOutput: string;
    yes: string;
    no: string;
    empty: string;
  };
}) {
  if (!payload || typeof payload !== "object") {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  const card = payload as TaskCardShape;
  const plannedCalls = Array.isArray(card.plannedCalls) ? card.plannedCalls : [];
  const pendingConfirmation = Array.isArray(card.pendingConfirmation) ? card.pendingConfirmation : [];
  const expectedOutput = Array.isArray(card.expectedOutput) ? card.expectedOutput : [];

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <KeyValue label={labels.task} value={card.task} />
        <KeyValue label={labels.target} value={card.target} />
        <KeyValue label={labels.suggestedAction} value={card.suggestedAction} />
        <KeyValue label={labels.riskLevel} value={card.riskLevel} />
        <KeyValue label={labels.executionMode} value={card.executionMode} />
        <KeyValue
          label={labels.createsFormalObject}
          value={typeof card.createsFormalObject === "boolean" ? (card.createsFormalObject ? labels.yes : labels.no) : null}
        />
      </div>
      <KeyValue label={labels.rationale} value={card.rationale} multiline />
      <StringList label={labels.plannedCalls} values={plannedCalls} empty={labels.empty} />
      <StringList label={labels.pendingConfirmation} values={pendingConfirmation} empty={labels.empty} />
      <StringList label={labels.expectedOutput} values={expectedOutput} empty={labels.empty} />
    </div>
  );
}

function KeyValue({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: unknown;
  multiline?: boolean;
}) {
  const display = value == null || value === "" ? "—" : String(value);
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm", multiline && "whitespace-pre-wrap")}>{display}</div>
    </div>
  );
}

function StringList({
  label,
  values,
  empty,
}: {
  label: string;
  values: unknown[];
  empty: string;
}) {
  const items = values.map((item) => String(item)).filter(Boolean);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onToggle,
  label,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        data-slot="toggle"
        aria-label={label}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-green-600" : "bg-muted",
        )}
        onClick={onToggle}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </div>
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function RequestListItem({
  request,
  selected,
  onSelect,
}: {
  request: BoardAssistantRequest;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-sm font-medium">{request.summary || request.messageText || request.id}</div>
          <div className="line-clamp-2 text-xs text-muted-foreground">{request.messageText || request.intentKind || "—"}</div>
        </div>
        <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{formatDateTime(request.createdAt)}</span>
        {request.targetKind && <span>{request.targetKind}</span>}
        {request.proposedAction && <span>{request.proposedAction}</span>}
      </div>
    </button>
  );
}

export function MemoryListItem({
  title,
  subtitle,
  status,
  confidence,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  status: string;
  confidence: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="line-clamp-2 text-sm font-medium">{title}</div>
          <div className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <Badge variant={statusVariant(status)}>{status}</Badge>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{confidence}%</div>
    </button>
  );
}

export function ThreadListItem({
  thread,
  selected,
  onSelect,
}: {
  thread: BoardAssistantThread;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-sm font-medium">
            {thread.subjectId || thread.externalThreadId || thread.id}
          </div>
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {thread.activeContextSummary || thread.threadKind}
          </div>
        </div>
        <Badge variant="outline">{thread.mode}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span>{thread.threadKind}</span>
        <span>{formatDateTime(thread.updatedAt)}</span>
      </div>
    </button>
  );
}

export function ThreadConversation({
  messagesTitle,
  messagesEmpty,
  messages,
  canReply,
  replyTitle,
  replyHint,
  replyDisabled,
  replyPlaceholder,
  sendLabel,
  draft,
  sending,
  onDraftChange,
  onSend,
}: {
  messagesTitle: string;
  messagesEmpty: string;
  messages: BoardAssistantThreadMessage[];
  canReply: boolean;
  replyTitle: string;
  replyHint: string;
  replyDisabled: string;
  replyPlaceholder: string;
  sendLabel: string;
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <div className="text-sm font-semibold">{messagesTitle}</div>
        <div className="space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-lg border border-border px-3 py-3",
                message.direction === "outbound"
                  ? "ml-auto bg-primary/10"
                  : "mr-auto bg-muted/40",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{message.authorKind}</Badge>
                <Badge variant="outline">{message.direction}</Badge>
                <span className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</span>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm">{message.content}</div>
              {Object.keys(message.metadata ?? {}).length > 0 && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs">
                  {stringifyPayload(message.metadata)}
                </pre>
              )}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {messagesEmpty}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">{replyTitle}</div>
          <p className="text-sm text-muted-foreground">{canReply ? replyHint : replyDisabled}</p>
        </div>
        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={replyPlaceholder}
          disabled={!canReply || sending}
        />
        <div className="flex justify-end">
          <Button onClick={onSend} disabled={!canReply || !draft.trim() || sending}>
            {sendLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
