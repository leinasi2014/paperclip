import { AGENT_ROLE_LABELS, type AgentRole } from "@paperclipai/shared";
import { normalizeLanguage } from "./formatters";

const zhCnAgentRoleLabels: Record<AgentRole, string> = {
  ceo: "首席执行官",
  cto: "首席技术官",
  cmo: "首席营销官",
  cfo: "首席财务官",
  engineer: "工程师",
  designer: "设计师",
  pm: "产品经理",
  qa: "测试",
  devops: "运维",
  researcher: "研究员",
  general: "通用",
};

function isAgentRole(value: string): value is AgentRole {
  return value in AGENT_ROLE_LABELS;
}

export function getAgentRoleLabel(role: string, language: string): string {
  const normalizedRole = role.toLowerCase();
  if (!isAgentRole(normalizedRole)) {
    return role;
  }

  if (normalizeLanguage(language) === "zh-CN") {
    return zhCnAgentRoleLabels[normalizedRole];
  }

  return AGENT_ROLE_LABELS[normalizedRole];
}
