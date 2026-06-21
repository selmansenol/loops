import { createContext, useContext, type ReactNode } from "react";
import { useSession, signOut as authSignOut } from "@/lib/auth-client";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

type AuthCtx = {
  user: SessionUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signOut: async () => {},
});

// Global auth only. Admin/membership is per-workspace and resolved per route
// (see workspace.functions `getMyWorkspaceRoleFn`).
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const user = (session?.user as SessionUser | undefined) ?? null;

  const signOut = async () => {
    await authSignOut();
  };

  return <Ctx.Provider value={{ user, loading: isPending, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
