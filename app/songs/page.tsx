"use client";

import { AuthGuard } from "@/components/auth-guard";
import { SongsManager } from "@/components/songs-manager";

export default function SongsPage() {
  return (
    <AuthGuard>
      <SongsManager />
    </AuthGuard>
  );
}
