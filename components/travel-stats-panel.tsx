import type { TravelStats } from "@/lib/types/travel";

function formatKm(km: number): string {
  if (km >= 10000) return `${(km / 10000).toFixed(1)}万 km`;
  return `${km.toLocaleString()} km`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function TravelStatsPanel({ stats }: { stats: TravelStats }) {
  const topAirlines = stats.flights.byAirline.slice(0, 6);
  const maxAirlineKm = Math.max(...topAirlines.map((a) => a.distanceKm), 1);
  const topTrainTypes = stats.trains.byType.slice(0, 6);
  const maxTrainCount = Math.max(...topTrainTypes.map((t) => t.count), 1);

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Places visited</p>
        <p className="mt-1 text-3xl font-bold">{stats.visits.total}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {stats.visits.provinces} provinces · {stats.visits.cities} cities ·{" "}
          {stats.visits.countries}{" "}
          {stats.visits.countries === 1 ? "country" : "countries"}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Flights</p>
        <p className="mt-1 text-3xl font-bold">{stats.flights.total}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {formatKm(stats.flights.totalDistanceKm)} flown
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Trains</p>
        <p className="mt-1 text-3xl font-bold">{stats.trains.total}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {formatDuration(stats.trains.totalDurationMinutes)} on rail
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Visit types</p>
        {stats.visits.byType.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No data yet</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {stats.visits.byType.slice(0, 5).map(({ type, count }) => (
              <li key={type} className="flex justify-between text-sm">
                <span>{type}</span>
                <span className="text-[var(--muted)]">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:col-span-2">
        <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">Top airlines by distance</h3>
        {topAirlines.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No flights yet</p>
        ) : (
          <ul className="space-y-2">
            {topAirlines.map(({ airline, count, distanceKm }) => (
              <li key={airline} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate">{airline}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(distanceKm / maxAirlineKm) * 100}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-[var(--muted)]">
                  {formatKm(distanceKm)} · {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:col-span-2">
        <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">Rail by train type</h3>
        {topTrainTypes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No trains yet</p>
        ) : (
          <ul className="space-y-2">
            {topTrainTypes.map(({ trainType, count, durationMinutes }) => (
              <li key={trainType} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 truncate">{trainType}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(count / maxTrainCount) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-[var(--muted)]">
                  {count} · {formatDuration(durationMinutes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
