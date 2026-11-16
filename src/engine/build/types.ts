export interface TauriBuildInput {
  workspaceDir: string;
  appName: string;
  identifier: string;
  timeoutMs?: number;
}

export interface TauriBuildResult {
  ok: boolean;
  exitCode: number | null;
  log: string;
  binaryPath?: string;
  durationMs: number;
  error?: string;
}

export interface BuildRunner {
  readonly name: string;
  buildTauriApp(input: TauriBuildInput): Promise<TauriBuildResult>;
}
