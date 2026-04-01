import enCommon from "./locales/en/common.json";
import enAgents from "./locales/en/agents.json";
import enApprovals from "./locales/en/approvals.json";
import enAuth from "./locales/en/auth.json";
import enCosts from "./locales/en/costs.json";
import enDashboard from "./locales/en/dashboard.json";
import enGoals from "./locales/en/goals.json";
import enInbox from "./locales/en/inbox.json";
import enIssues from "./locales/en/issues.json";
import enNotFound from "./locales/en/notFound.json";
import enPlugins from "./locales/en/plugins.json";
import enProjects from "./locales/en/projects.json";
import enSettings from "./locales/en/settings.json";
import enCompany from "./locales/en/company.json";
import enWorkspaces from "./locales/en/workspaces.json";
import zhCnCommon from "./locales/zh-CN/common.json";
import zhCnAgents from "./locales/zh-CN/agents.json";
import zhCnApprovals from "./locales/zh-CN/approvals.json";
import zhCnAuth from "./locales/zh-CN/auth.json";
import zhCnCosts from "./locales/zh-CN/costs.json";
import zhCnDashboard from "./locales/zh-CN/dashboard.json";
import zhCnGoals from "./locales/zh-CN/goals.json";
import zhCnInbox from "./locales/zh-CN/inbox.json";
import zhCnIssues from "./locales/zh-CN/issues.json";
import zhCnNotFound from "./locales/zh-CN/notFound.json";
import zhCnPlugins from "./locales/zh-CN/plugins.json";
import zhCnProjects from "./locales/zh-CN/projects.json";
import zhCnSettings from "./locales/zh-CN/settings.json";
import zhCnCompany from "./locales/zh-CN/company.json";
import zhCnWorkspaces from "./locales/zh-CN/workspaces.json";

export const resources = {
  en: {
    common: enCommon,
    agents: enAgents,
    approvals: enApprovals,
    auth: enAuth,
    costs: enCosts,
    dashboard: enDashboard,
    goals: enGoals,
    inbox: enInbox,
    issues: enIssues,
    notFound: enNotFound,
    plugins: enPlugins,
    projects: enProjects,
    settings: enSettings,
    company: enCompany,
    workspaces: enWorkspaces,
  },
  "zh-CN": {
    common: zhCnCommon,
    agents: zhCnAgents,
    approvals: zhCnApprovals,
    auth: zhCnAuth,
    costs: zhCnCosts,
    dashboard: zhCnDashboard,
    goals: zhCnGoals,
    inbox: zhCnInbox,
    issues: zhCnIssues,
    notFound: zhCnNotFound,
    plugins: zhCnPlugins,
    projects: zhCnProjects,
    settings: zhCnSettings,
    company: zhCnCompany,
    workspaces: zhCnWorkspaces,
  },
} as const;

export const supportedLanguages = ["en", "zh-CN"] as const;
