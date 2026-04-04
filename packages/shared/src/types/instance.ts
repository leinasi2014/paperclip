export interface InstanceGeneralSettings {
  censorUsernameInLogs: boolean;
}

export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
  autoRestartDevServerWhenIdle: boolean;
}

export interface BoardAssistantSettings {
  enabled: boolean;
  activeChannels: ("wechat")[];
  staticCompanyGroups: {
    groupKey: string;
    displayName: string;
    companyIds: string[];
    enabled: boolean;
  }[];
  autoExecutionMode: "manual_confirm" | "low_risk_auto" | "enhanced_auto";
  allowProactiveBriefing: boolean;
  allowAllActiveCompaniesQueryGroup: boolean;
  bindingTokenTtlMinutes: number;
  proposedTtlHours: number;
  clarifyingTtlHours: number;
  highSensitivityConfirmTtlHours: number;
  ingressReplayWindowMinutes: number;
  previousSecretGraceWindowMinutes: number;
  outboxMaxRetries: number;
  nudgeIntervalHours: number;
  maxNudgesPerItem: number;
}

export interface InstanceSettings {
  id: string;
  general: InstanceGeneralSettings;
  experimental: InstanceExperimentalSettings;
  boardAssistant: BoardAssistantSettings;
  createdAt: Date;
  updatedAt: Date;
}
