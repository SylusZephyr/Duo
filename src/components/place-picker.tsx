import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { searchPlaces, type PlaceHit } from "@/lib/maps.functions";

export function PlacePicker({
  value,
  onChange,
}: {
  value: PlaceHit | null;
  onChange: (place: PlaceHit | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const run = useServerFn(searchPlaces);

  useEffect(() => {
    if (value || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await run({ data: { query: query.trim() } }));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, value, run]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3">
        <MapPin className="size-4 text-gold" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{value.name}</p>
          <p className="truncate text-xs text-muted-foreground">{value.address}</p>
        </div>
        <button onClick={() => onChange(null)} aria-label="Clear place">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Where were you?"
          className="h-12 rounded-2xl border-border bg-secondary/40 pl-10"
        />
        <MapPin className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground" />
        {loading ? (
          <Loader2 className="absolute right-3.5 top-4 size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {results.length > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {results.map((place) => (
            <li key={place.id}>
              <button
                onClick={() => {
                  onChange(place);
                  setQuery("");
                }}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-secondary/60"
              >
                <p className="text-sm">{place.name}</p>
                <p className="text-xs text-muted-foreground">{place.address}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
