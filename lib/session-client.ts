export interface ClientSession {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

export async function fetchSession(): Promise<ClientSession | null> {
  try {
    const res = await fetch("/api/auth/session/", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ? data : null;
  } catch {
    return null;
  }
}
