/**
 * Feature keys, mirroring the open-source server's
 * `apps/server/src/common/features.ts`. That file is the authority: the server
 * reports a subset of these keys from POST /workspace/entitlements, and
 * `useHasFeature` checks membership in what it reported.
 *
 * On a CE server the reported subset is `apps/server/src/ce/licence/enabled-features.ts`.
 */
export const Feature = {
  SSO_CUSTOM: "sso:custom",
  SSO_GOOGLE: "sso:google",
  MFA: "mfa",
  API_KEYS: "api:keys",
  COMMENT_RESOLUTION: "comment:resolution",
  PAGE_PERMISSIONS: "page:permissions",
  AI: "ai",
  CONFLUENCE_IMPORT: "import:confluence",
  DOCX_IMPORT: "import:docx",
  PDF_IMPORT: "import:pdf",
  ATTACHMENT_INDEXING: "attachment:indexing",
  SECURITY_SETTINGS: "security:settings",
  MCP: "mcp",
  SCIM: "scim",
  PAGE_VERIFICATION: "page:verification",
  AUDIT_LOGS: "audit:logs",
  RETENTION: "retention",
  SHARING_CONTROLS: "sharing:controls",
  VIEWER_COMMENTS: "comment:viewer",
  TEMPLATES: "templates",
  PDF_EXPORT: "export:pdf",
  PERSONAL_SPACES: "spaces:personal",
  DOCX_EXPORT: "export:docx",
  BASES: "bases",
  OAUTH: "oauth",
  AI_CONTROLS: "ai:controls",
  MCP_CONTROLS: "mcp:controls",
  PUBLIC_SPACE_APPEARANCE: "public-space:appearance",
  SIEM: "siem",
} as const;

export type FeatureKey = (typeof Feature)[keyof typeof Feature];
