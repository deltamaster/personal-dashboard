export interface ClientSession {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

let inflightSession: Promise<ClientSession | null> | null = null;

export async function fetchSession(): Promise<ClientSession | null> {
  if (inflightSession) return inflightSession;

  inflightSession = (async () => {
    try {
      const res = await fetch("/api/auth/session/", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.user ? data : null;
    } catch {
      return null;
    }
  })();

  try {
    return await inflightSession;
  } finally {
    inflightSession = null;
  }
}
