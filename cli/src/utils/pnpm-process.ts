const WINDOWS_COMMAND_PROCESS = process.env.ComSpec?.trim() || "cmd.exe";

function quoteWindowsCmdArg(value: string): string {
  if (value.length === 0) return '""';
  if (!/[\s"&()<>|^]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function buildPnpmProcessSpec(args: string[]): { command: string; args: string[] } {
  if (process.platform !== "win32") {
    return {
      command: "pnpm",
      args,
    };
  }

  const commandLine = ["pnpm", ...args].map((value) => quoteWindowsCmdArg(value)).join(" ");
  return {
    command: WINDOWS_COMMAND_PROCESS,
    args: ["/d", "/s", "/c", commandLine],
  };
}
