export type InviteDiagnostic = {
  code: string;
  level: "info" | "warn";
  message: string;
  hint?: string;
};

type TFunction = (key: string) => string;

type InviteDiagnosticTranslation = {
  message: string;
  hint?: string;
};

const inviteDiagnosticTranslations: Record<string, InviteDiagnosticTranslation> = {
  openclaw_gateway_defaults_missing: {
    message: "invite.diagnostics.openclaw_gateway_defaults_missing.message",
    hint: "invite.diagnostics.openclaw_gateway_defaults_missing.hint",
  },
  openclaw_gateway_url_missing: {
    message: "invite.diagnostics.openclaw_gateway_url_missing.message",
    hint: "invite.diagnostics.openclaw_gateway_url_missing.hint",
  },
  openclaw_gateway_url_protocol: {
    message: "invite.diagnostics.openclaw_gateway_url_protocol.message",
    hint: "invite.diagnostics.openclaw_gateway_url_protocol.hint",
  },
  openclaw_gateway_url_configured: {
    message: "invite.diagnostics.openclaw_gateway_url_configured.message",
  },
  openclaw_gateway_url_invalid: {
    message: "invite.diagnostics.openclaw_gateway_url_invalid.message",
  },
  openclaw_gateway_auth_header_missing: {
    message: "invite.diagnostics.openclaw_gateway_auth_header_missing.message",
    hint: "invite.diagnostics.openclaw_gateway_auth_header_missing.hint",
  },
  openclaw_gateway_auth_header_too_short: {
    message: "invite.diagnostics.openclaw_gateway_auth_header_too_short.message",
    hint: "invite.diagnostics.openclaw_gateway_auth_header_too_short.hint",
  },
  openclaw_gateway_auth_header_configured: {
    message: "invite.diagnostics.openclaw_gateway_auth_header_configured.message",
  },
  openclaw_gateway_device_key_configured: {
    message: "invite.diagnostics.openclaw_gateway_device_key_configured.message",
  },
  openclaw_gateway_device_key_generated: {
    message: "invite.diagnostics.openclaw_gateway_device_key_generated.message",
  },
  openclaw_gateway_device_key_generate_failed: {
    message: "invite.diagnostics.openclaw_gateway_device_key_generate_failed.message",
    hint: "invite.diagnostics.openclaw_gateway_device_key_generate_failed.hint",
  },
  openclaw_gateway_paperclip_api_url_protocol: {
    message: "invite.diagnostics.openclaw_gateway_paperclip_api_url_protocol.message",
    hint: "invite.diagnostics.openclaw_gateway_paperclip_api_url_protocol.hint",
  },
  openclaw_gateway_paperclip_api_url_configured: {
    message: "invite.diagnostics.openclaw_gateway_paperclip_api_url_configured.message",
  },
  openclaw_gateway_paperclip_api_url_invalid: {
    message: "invite.diagnostics.openclaw_gateway_paperclip_api_url_invalid.message",
  },
  openclaw_onboarding_api_loopback: {
    message: "invite.diagnostics.openclaw_onboarding_api_loopback.message",
    hint: "invite.diagnostics.openclaw_onboarding_api_loopback.hint",
  },
  openclaw_onboarding_private_loopback_bind: {
    message: "invite.diagnostics.openclaw_onboarding_private_loopback_bind.message",
    hint: "invite.diagnostics.openclaw_onboarding_private_loopback_bind.hint",
  },
  openclaw_onboarding_private_host_not_allowed: {
    message: "invite.diagnostics.openclaw_onboarding_private_host_not_allowed.message",
    hint: "invite.diagnostics.openclaw_onboarding_private_host_not_allowed.hint",
  },
} as const;

export const INVITE_DIAGNOSTIC_CODES = Object.keys(inviteDiagnosticTranslations) as Array<
  keyof typeof inviteDiagnosticTranslations
>;

export function formatInviteDiagnostic(
  diagnostic: InviteDiagnostic,
  t: TFunction,
): { message: string; hint?: string } {
  const translated = inviteDiagnosticTranslations[diagnostic.code];
  if (!translated) {
    return {
      message: diagnostic.message,
      hint: diagnostic.hint,
    };
  }

  return {
    message: t(translated.message),
    hint: translated.hint ? t(translated.hint) : undefined,
  };
}
