import { AuthGuard } from "@/components/auth-guard";

export default function TravelPage() {
  return (
    <AuthGuard>
      <h1 className="text-2xl font-bold">Travel</h1>
      <p className="mt-2 text-[var(--muted)]">Coming soon.</p>
    </AuthGuard>
  );
}
