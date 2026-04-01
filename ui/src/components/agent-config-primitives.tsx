import { useState, useRef, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import i18n from "../i18n";
import { normalizeLanguage } from "../i18n/formatters";
import { getAgentRoleLabel } from "../i18n/label-helpers";
import { useAppLocale } from "../i18n/useAppLocale";
import enAgents from "../i18n/locales/en/agents.json";
import zhCnAgents from "../i18n/locales/zh-CN/agents.json";

type AgentsMessages = typeof enAgents;

const agentsMessagesByLanguage = {
  en: enAgents,
  "zh-CN": zhCnAgents,
} as const;

function currentLanguage() {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

function interpolate(template: string, values: Record<string, string | number> = {}) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function getAgentsMessages(language: string): AgentsMessages {
  return agentsMessagesByLanguage[normalizeLanguage(language)];
}

type AgentAdapterLabelOptions = {
  compact?: boolean;
};

export function getAgentAdapterLabel(
  adapterType: string,
  language: string,
  options?: AgentAdapterLabelOptions,
): string | undefined {
  const messages = getAgentsMessages(language);
  const labels = (options?.compact ? messages.adaptersCompact : messages.adapters) as Record<string, string>;
  return labels[adapterType];
}

export function getAgentOverviewAdapterLabel(adapterType: string, language: string): string | undefined {
  return getAgentAdapterLabel(adapterType, language, { compact: true });
}

export function getAgentConfigHelpText(key: string, language: string): string | undefined {
  const helpText = getAgentsMessages(language).config.help as Record<string, string>;
  return helpText[key];
}

export function formatAgentCountLabel(count: number, language: string): string {
  const messages = getAgentsMessages(language).pages.agents.count;
  return interpolate(count === 1 ? messages.one : messages.other, { count });
}

export function formatLiveRunLabel(liveCount: number, language: string): string {
  const messages = getAgentsMessages(language).pages.agents.live;
  return interpolate(liveCount === 1 ? messages.one : messages.other, { count: liveCount });
}

function createLocalizedRecord(
  validKeys: readonly string[],
  resolver: (key: string, language: string) => string | undefined,
): Record<string, string | undefined> {
  const knownKeys = new Set(validKeys);

  return new Proxy(
    {},
    {
      get: (_target, property) => {
        if (typeof property !== "string") {
          return undefined;
        }
        if (!knownKeys.has(property)) {
          return undefined;
        }
        return resolver(property, currentLanguage());
      },
    },
  ) as Record<string, string | undefined>;
}

/* ---- Help text for (?) tooltips ---- */
export const help = createLocalizedRecord(Object.keys(enAgents.config.help), getAgentConfigHelpText);
export const adapterLabels = createLocalizedRecord(Object.keys(enAgents.adapters), getAgentAdapterLabel);
export const roleLabels = createLocalizedRecord(
  ["ceo", "cto", "cmo", "cfo", "engineer", "designer", "pm", "qa", "devops", "researcher", "general"],
  (role, language) => getAgentRoleLabel(role, language),
);

/* ---- Primitive components ---- */

export function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  toggleTestId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  toggleTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      <button
        data-slot="toggle"
        data-testid={toggleTestId}
        type="button"
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-green-600" : "bg-muted"
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

export function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  numberPrefix,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  numberPrefix?: string;
  showNumber: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <button
          data-slot="toggle"
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
            checked ? "bg-green-600" : "bg-muted"
          )}
          onClick={() => onCheckedChange(!checked)}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
              checked ? "translate-x-4.5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
      {showNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {numberPrefix && <span>{numberPrefix}</span>}
          <input
            type="number"
            className="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(bordered && "border-t border-border")}>
      <button
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function AutoExpandTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

/**
 * Text input that manages internal draft state.
 * Calls `onCommit` on blur (and optionally on every change if `immediate` is set).
 */
export function DraftInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      {...props}
    />
  );
}

/**
 * Auto-expanding textarea with draft state and blur-commit.
 */
export function DraftTextarea({
  value,
  onCommit,
  immediate,
  placeholder,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  placeholder?: string;
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [draft, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      style={{ minHeight }}
    />
  );
}

/**
 * Number input with draft state and blur-commit.
 */
export function DraftNumberInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: number;
  onCommit: (v: number) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type">) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(Number(e.target.value) || 0);
      }}
      onBlur={() => {
        const num = Number(draft) || 0;
        if (num !== value) onCommit(num);
      }}
      {...props}
    />
  );
}

/**
 * "Choose" button that opens a dialog explaining the user must manually
 * type the path due to browser security limitations.
 */
export function ChoosePathButton() {
  const [open, setOpen] = useState(false);
  const { language } = useAppLocale();
  const dialog = getAgentsMessages(language).config.choosePathDialog;

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
        onClick={() => setOpen(true)}
      >
        {dialog.choose}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.title}</DialogTitle>
            <DialogDescription>{dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section className="space-y-1.5">
              <p className="font-medium">{dialog.sections.macos}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {dialog.steps.macos.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                {dialog.examples.macos}
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">{dialog.sections.windows}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {dialog.steps.windows.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                {dialog.examples.windows}
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">{dialog.sections.terminal}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {dialog.steps.terminal.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {dialog.ok}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Label + input rendered on the same line (inline layout for compact fields).
 */
export function InlineField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      <div className="w-24 ml-auto">{children}</div>
    </div>
  );
}
