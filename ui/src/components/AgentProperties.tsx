import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import type { Agent, AgentRuntimeState } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "./StatusBadge";
import { Identity } from "./Identity";
import { formatDate, agentUrl } from "../lib/utils";
import { Separator } from "@/components/ui/separator";
import { getAgentRoleLabel } from "../i18n/label-helpers";
import { useAppLocale } from "../i18n/useAppLocale";
import { getAgentAdapterLabel, getAgentsMessages } from "./agent-config-primitives";

interface AgentPropertiesProps {
  agent: Agent;
  runtimeState?: AgentRuntimeState;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

export function AgentProperties({ agent, runtimeState }: AgentPropertiesProps) {
  const { selectedCompanyId } = useCompany();
  const { language } = useAppLocale();
  const messages = getAgentsMessages(language);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!agent.reportsTo,
  });

  const reportsToAgent = agent.reportsTo ? agents?.find((a) => a.id === agent.reportsTo) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label={messages.properties.status}>
          <StatusBadge status={agent.status} />
        </PropertyRow>
        <PropertyRow label={messages.properties.role}>
          <span className="text-sm">{getAgentRoleLabel(agent.role, language)}</span>
        </PropertyRow>
        {agent.title && (
          <PropertyRow label={messages.properties.title}>
            <span className="text-sm">{agent.title}</span>
          </PropertyRow>
        )}
        <PropertyRow label={messages.properties.adapter}>
          <span className="text-sm font-mono">{getAgentAdapterLabel(agent.adapterType, language) ?? agent.adapterType}</span>
        </PropertyRow>
      </div>

      <Separator />

      <div className="space-y-1">
        {(runtimeState?.sessionDisplayId ?? runtimeState?.sessionId) && (
          <PropertyRow label={messages.properties.session}>
            <span className="text-xs font-mono">
              {String(runtimeState.sessionDisplayId ?? runtimeState.sessionId).slice(0, 12)}...
            </span>
          </PropertyRow>
        )}
        {runtimeState?.lastError && (
          <PropertyRow label={messages.properties.lastError}>
            <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[160px]">{runtimeState.lastError}</span>
          </PropertyRow>
        )}
        {agent.lastHeartbeatAt && (
          <PropertyRow label={messages.properties.lastHeartbeat}>
            <span className="text-sm">{formatDate(agent.lastHeartbeatAt)}</span>
          </PropertyRow>
        )}
        {agent.reportsTo && (
          <PropertyRow label={messages.properties.reportsTo}>
            {reportsToAgent ? (
              <Link to={agentUrl(reportsToAgent)} className="hover:underline">
                <Identity name={reportsToAgent.name} size="sm" />
              </Link>
            ) : (
              <span className="text-sm font-mono">{agent.reportsTo.slice(0, 8)}</span>
            )}
          </PropertyRow>
        )}
        <PropertyRow label={messages.properties.created}>
          <span className="text-sm">{formatDate(agent.createdAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
