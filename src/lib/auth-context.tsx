import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession, signOut as authSignOut } from "@/lib/auth-client";
import { getMyRole } from "@/lib/account.functions";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

type AuthCtx = {
  user: SessionUser | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  const user = (session?.user as SessionUser | undefined) ?? null;

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    getMyRole()
      .then((r) => {
        if (!cancelled) setIsAdmin(r.isAdmin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signOut = async () => {
    await authSignOut();
  };

  return (
    <Ctx.Provider value={{ user, loading: isPending, isAdmin, signOut }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
