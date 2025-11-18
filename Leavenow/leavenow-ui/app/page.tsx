"use client";

import { FormEvent, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type Mode = "DRIVE" | "TRANSIT" | "WALK" | "CAB";

const MODE_LABEL: Record<Mode, string> = {
  DRIVE: "Drive (your own car)",
  CAB: "Cab / ride-hail",
  TRANSIT: "Transit",
  WALK: "Walk",
};

type Alternative = {
  mode: Mode | string;
  etaSeconds: number;
  reliability: number;
};

type PlanResponse = {
  leaveBy: string;
  chosenMode: Mode;
  etaSeconds: number;
  reliability: number;
  explain: string;
  alternatives: Alternative[];

  alreadyLate: boolean;
  minutesLate: number;
  expectedArrival: string;
};

type PlaceSuggestion = {
  id: string;
  text: string;
  lat: number;
  lng: number;
};

type Coords = { lat: number; lng: number } | null;

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function haversineKm(a: Coords, b: Coords): number | null {
  if (!a || !b) return null;
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// ---------- Place input with suggestions ----------

type PlaceInputProps = {
  label: string;
  placeholder: string;
  value: string;
  disabled?: boolean;
  onValueChange: (v: string) => void;
  onPlaceSelected: (place: PlaceSuggestion) => void;
};

function PlaceInput({
  label,
  placeholder,
  value,
  disabled,
  onValueChange,
  onPlaceSelected,
}: PlaceInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchSuggestions(q: string) {
    const query = q.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/places?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as PlaceSuggestion[];
      setSuggestions(data);
      setOpen(data.length > 0);
    } finally {
      setLoading(false);
    }
  }

  const handleSelect = (place: PlaceSuggestion) => {
    onPlaceSelected(place);
    onValueChange(place.text);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onFocus={() => {
          if (!disabled && suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
      />
      {loading && !disabled && (
        <span className="absolute right-3 top-[30px] text-[10px] text-slate-500">
          …
        </span>
      )}
      {open && suggestions.length > 0 && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-800 bg-slate-950/95 text-sm shadow-lg shadow-black/40">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="cursor-pointer px-3 py-2 hover:bg-slate-800/80"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Page ----------

export default function HomePage() {
  const [originLabel, setOriginLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [originCoords, setOriginCoords] = useState<Coords>(null);
  const [destCoords, setDestCoords] = useState<Coords>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [arriveBy, setArriveBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);

  const [lastOrigin, setLastOrigin] = useState<Coords>(null);
  const [lastDest, setLastDest] = useState<Coords>(null);

  // ---- derived “trip insights” ----
  const tripDistanceKm = useMemo(
    () => haversineKm(lastOrigin, lastDest),
    [lastOrigin, lastDest]
  );

  const avgSpeedKmh = useMemo(() => {
    if (!plan || !tripDistanceKm || tripDistanceKm === 0) return null;
    const hours = plan.etaSeconds / 3600;
    if (hours <= 0) return null;
    return tripDistanceKm / hours;
  }, [plan, tripDistanceKm]);

  const trafficLabel = useMemo(() => {
    if (avgSpeedKmh == null) return "Unknown";
    if (avgSpeedKmh > 55) return "Light";
    if (avgSpeedKmh > 30) return "Moderate";
    return "Heavy";
  }, [avgSpeedKmh]);

  const weatherLabel = useMemo(() => {
    if (!plan) return "—";
    const lower = plan.explain.toLowerCase();
    if (lower.includes("weather slowdown") || lower.includes("rain")) {
      return "Rain / wet roads";
    }
    return "No significant rain";
  }, [plan]);

  const buffersLabel = useMemo(() => {
    if (!plan) return "—";
    // use explain text but trim a bit to keep it compact
    return plan.explain.replace(/^includes\s*/i, "");
  }, [plan]);

  // -------- helpers --------

  const resolveCoords = async (
    label: string,
    existing: Coords
  ): Promise<Coords> => {
    if (existing) return existing;
    const q = label.trim();
    if (!q) return null;

    try {
      const res = await fetch(
        `${API_BASE}/api/places?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) return null;
      const data = (await res.json()) as PlaceSuggestion[];
      if (!data.length) return null;
      const first = data[0];
      return { lat: first.lat, lng: first.lng };
    } catch {
      return null;
    }
  };

  const handleUseCurrentLocation = () => {
    const next = !useCurrentLocation;
    setUseCurrentLocation(next);
    setError(null);

    if (!next) {
      setOriginCoords(null);
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      setUseCurrentLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setOriginCoords({ lat: latitude, lng: longitude });
        setOriginLabel("Current location");
      },
      (err) => {
        console.error(err);
        setError(
          "Unable to fetch current location. Please allow location access."
        );
        setUseCurrentLocation(false);
      }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);

    try {
      let finalOrigin: Coords = null;

      if (useCurrentLocation) {
        if (!originCoords) {
          throw new Error(
            "We’re still trying to read your current location. Please try again in a moment."
          );
        }
        finalOrigin = originCoords;
      } else {
        finalOrigin = await resolveCoords(originLabel, originCoords);
      }

      const finalDest = await resolveCoords(destLabel, destCoords);

      if (!finalOrigin || !finalDest) {
        throw new Error(
          "We couldn’t resolve one of the places. Try picking from the dropdown or retyping."
        );
      }

      if (!arriveBy) {
        throw new Error("Please choose an arrival time.");
      }

      const arriveIso = new Date(arriveBy).toISOString();

      const res = await fetch(`${API_BASE}/api/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: finalOrigin,
          destination: finalDest,
          arriveBy: arriveIso,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Backend error (${res.status}): ${text || res.statusText}`
        );
      }

      const data = (await res.json()) as PlanResponse;
      setPlan(data);
      setLastOrigin(finalOrigin);
      setLastDest(finalDest);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = (mode: string) => {
    if (!lastOrigin || !lastDest) return;
    const m = mode.toLowerCase();
    let travelMode = "driving";
    if (m.includes("walk")) travelMode = "walking";
    else if (m.includes("transit")) travelMode = "transit";

    const url = `https://www.google.com/maps/dir/?api=1&origin=${lastOrigin.lat},${lastOrigin.lng}&destination=${lastDest.lat},${lastDest.lng}&travelmode=${travelMode}`;
    window.open(url, "_blank");
  };

  // ---------- UI ----------

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-900/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-emerald-500/25 border border-emerald-400/70 flex items-center justify-center text-xs font-bold text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.35)]">
              LN
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                LeaveNow Orchestrator
              </h1>
              <p className="text-xs text-slate-400">
                Turn “When should I leave?” into a clear, realistic answer.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">
              Commutes · Errands · Airport runs
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Planner card */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 lg:p-7 shadow-xl shadow-black/40">
            <h2 className="text-xl font-semibold mb-1">Plan a trip for today</h2>
            <p className="text-sm text-slate-400 mb-5">
              Choose where you&apos;re starting and where you need to be. We&apos;ll
              factor in travel time, prep, and buffers, then tell you when to
              leave.
            </p>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <PlaceInput
                    label="Origin"
                    placeholder="e.g. Current place, apartment, campus..."
                    value={originLabel}
                    disabled={useCurrentLocation}
                    onValueChange={(v) => {
                      setOriginLabel(v);
                    }}
                    onPlaceSelected={(p) =>
                      setOriginCoords({ lat: p.lat, lng: p.lng })
                    }
                  />
                  <label className="flex items-center gap-2 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={useCurrentLocation}
                      onChange={handleUseCurrentLocation}
                      className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                    />
                    Use current location as origin
                  </label>
                </div>

                <PlaceInput
                  label="Destination"
                  placeholder="e.g. Office, campus, coffee shop..."
                  value={destLabel}
                  onValueChange={(v) => {
                    setDestLabel(v);
                  }}
                  onPlaceSelected={(p) =>
                    setDestCoords({ lat: p.lat, lng: p.lng })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Arrive by (local time)
                </label>
                <input
                  type="datetime-local"
                  value={arriveBy}
                  onChange={(e) => setArriveBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Computing plan..." : "Compute leave-by time"}
              </button>
            </form>
          </section>

          {/* Result card */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:p-7 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Plan result</h2>
            </div>

            {!plan && (
              <p className="text-sm text-slate-400">
                Once you pick an origin, a destination, and an arrival time,
                we&apos;ll show you when to leave and what each travel option
                looks like.
              </p>
            )}

            {plan && (
              <div className="space-y-5">
                {/* Main recommendation */}
                <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-300">
                    {plan.alreadyLate
                      ? "You’re already cutting it close"
                      : "Recommended leave-by"}
                  </p>
                  <p className="mt-1 text-4xl font-semibold text-emerald-100">
                    {formatTime(plan.leaveBy)}
                  </p>
                  <p className="mt-2 text-xs text-emerald-200">
                    If you leave at this time, you&apos;ll arrive around{" "}
                    <span className="font-semibold">
                      {formatTime(plan.expectedArrival)}
                    </span>
                    .
                  </p>
                  <p className="mt-2 text-xs text-emerald-200">
                    Mode:{" "}
                    <span className="font-semibold">
                      {MODE_LABEL[plan.chosenMode]}
                    </span>{" "}
                    · Travel time ~ {formatDuration(plan.etaSeconds)} ·
                    Reliability{" "}
                    <span className="font-semibold">
                      {(plan.reliability * 100).toFixed(0)}%
                    </span>
                  </p>
                  {plan.alreadyLate ? (
                    <p className="mt-2 text-xs text-amber-300">
                      You would have needed to leave about{" "}
                      <span className="font-semibold">
                        {plan.minutesLate} minute
                        {plan.minutesLate === 1 ? "" : "s"}
                      </span>{" "}
                      earlier to hit your target exactly. Leaving now means
                      you&apos;ll arrive slightly after your desired time.
                    </p>
                  ) : null}
                </div>

                {/* Insights row */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                      Trip insights
                    </p>
                    <p className="text-slate-200">
                      Distance:{" "}
                      <span className="font-semibold">
                        {tripDistanceKm != null
                          ? `${tripDistanceKm.toFixed(1)} km`
                          : "—"}
                      </span>
                    </p>
                    <p className="text-slate-200">
                      Traffic:{" "}
                      <span className="font-semibold">{trafficLabel}</span>
                      {avgSpeedKmh != null && (
                        <span className="text-slate-500">
                          {" "}
                          · ~{avgSpeedKmh.toFixed(0)} km/h
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                      Conditions & buffers
                    </p>
                    <p className="text-slate-200">
                      Weather:{" "}
                      <span className="font-semibold">{weatherLabel}</span>
                    </p>
                    <p className="text-slate-200">
                      Buffers:{" "}
                      <span className="font-semibold">{buffersLabel}</span>
                    </p>
                  </div>
                </div>

                {/* Alternatives */}
                <div>
                  <h3 className="text-sm font-medium text-slate-200 mb-2">
                    Alternatives (tap to open in Google Maps)
                  </h3>
                  <div className="space-y-2">
                    {plan.alternatives.map((alt) => (
                      <button
                        key={alt.mode}
                        type="button"
                        onClick={() => openInGoogleMaps(alt.mode)}
                        className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-xs hover:border-emerald-500/60 hover:bg-slate-900 cursor-pointer text-left"
                      >
                        <div>
                          <p className="font-semibold capitalize">
                            {alt.mode.toLowerCase()}
                          </p>
                          <p className="text-slate-400">
                            {formatDuration(alt.etaSeconds)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-300">
                            {(alt.reliability * 100).toFixed(0)}%
                          </p>
                          <p className="text-slate-500">reliability</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-3">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>LeaveNow Orchestrator · Smart leave-time planner.</span>
          <span>Built with NestJS, PostgreSQL, Redis &amp; Next.js.</span>
        </div>
      </footer>
    </main>
  );
}