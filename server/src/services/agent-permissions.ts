export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  canUpdateDirectReportProfiles: boolean;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  return {
    canCreateAgents: role === "ceo",
    canUpdateDirectReportProfiles: false,
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    canUpdateDirectReportProfiles:
      typeof record.canUpdateDirectReportProfiles === "boolean"
        ? record.canUpdateDirectReportProfiles
        : defaults.canUpdateDirectReportProfiles,
  };
}
