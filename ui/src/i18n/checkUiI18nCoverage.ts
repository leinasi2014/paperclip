import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const { checkUiI18nCoverage } = require("../../../scripts/check-ui-i18n-coverage.mjs") as {
  checkUiI18nCoverage: (options: {
    repoRoot?: string;
    log?: (message: string) => void;
    error?: (message: string) => void;
  }) => number;
};
