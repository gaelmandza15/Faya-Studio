import { AppShell } from "@/components/shell/app-shell";
import { WorkspaceProvider } from "@/components/shell/workspace-provider";
import { getWorkspaceContext } from "@/lib/workspace";

// The protected layout reads the session and the active workspace, so it is
// request-bound by design.
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await getWorkspaceContext();

  return (
    <WorkspaceProvider value={workspace}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
