import { createContext, useContext, type ReactNode } from "react";

export type WorkspaceCtx = {
  slug: string;
  name: string;
  role: "owner" | "admin" | "member" | null;
};

const Ctx = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceCtx;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Current workspace inside a /$slug route, or null on global pages. */
export function useWorkspace(): WorkspaceCtx | null {
  return useContext(Ctx);
}

export function useIsWorkspaceAdmin(): boolean {
  const ws = useContext(Ctx);
  return ws?.role === "owner" || ws?.role === "admin";
}
