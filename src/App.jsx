import { useEffect, useMemo, useRef, useState } from "react";

const initialCoords = { lat: "", lon: "" };

const formatNumber = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return Number(value).toFixed(digits);
};

const formatLocationLabel = (item) => {
  if (!item) return "";
  const parts = [item.name, item.admin1, item.country].filter(Boolean);
  return parts.join(", ");
};

export default function App() {
  const [mode, setMode] = useState("place");
  const [place, setPlace] = useState("");
  const [coords, setCoords] = useState(initialCoords);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [queryMeta, setQueryMeta] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef(null);

  const canSubmit = useMemo(() => {
    if (mode === "place") {
      return place.trim().length > 1;
    }
    return coords.lat.trim() !== "" && coords.lon.trim() !== "";
  }, [coords.lat, coords.lon, mode, place]);

  const resetStatus = () => {
    setError("");
    setStatus("idle");
  };

  const handleCoordsChange = (field) => (event) => {
    resetStatus();
    setCoords((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePlaceChange = (event) => {
    resetStatus();
    setPlace(event.target.value);
    setSelectedSuggestion(null);
    setShowSuggestions(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (mode !== "place") {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const query = place.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    if (showSuggestions) {
      setIsSuggesting(true);
    }
    const timer = setTimeout(async () => {
      try {
        const geocodeUrl = new URL(
          "https://geocoding-api.open-meteo.com/v1/search"
        );
        geocodeUrl.searchParams.set("name", query);
        geocodeUrl.searchParams.set("count", "5");
        geocodeUrl.searchParams.set("language", "en");
        geocodeUrl.searchParams.set("format", "json");

        const response = await fetch(geocodeUrl.toString());
        if (!response.ok) {
          throw new Error("Suggestion lookup failed.");
        }
        const data = await response.json();
        const nextSuggestions = (data?.results ?? []).map((item) => ({
          ...item,
          label: formatLocationLabel(item),
        }));
        setSuggestions(nextSuggestions);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSuggesting(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [mode, place, showSuggestions]);

  const fetchWeather = async ({ latitude, longitude, label }) => {
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", latitude);
    weatherUrl.searchParams.set("longitude", longitude);
    weatherUrl.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,precipitation,wind_speed_10m"
    );
    weatherUrl.searchParams.set("timezone", "auto");

    const response = await fetch(weatherUrl.toString());
    if (!response.ok) {
      throw new Error("Weather service error. Try again.");
    }
    const data = await response.json();

    setResult(data);
    setQueryMeta({
      label,
      latitude,
      longitude,
      time: data?.current?.time ?? "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setResult(null);
    setQueryMeta(null);

    try {
      if (mode === "place") {
        if (selectedSuggestion) {
          await fetchWeather({
            latitude: selectedSuggestion.latitude,
            longitude: selectedSuggestion.longitude,
            label: selectedSuggestion.label,
          });
        } else {
          const geocodeUrl = new URL(
            "https://geocoding-api.open-meteo.com/v1/search"
          );
          geocodeUrl.searchParams.set("name", place.trim());
          geocodeUrl.searchParams.set("count", "1");
          geocodeUrl.searchParams.set("language", "en");
          geocodeUrl.searchParams.set("format", "json");

          const geocodeResponse = await fetch(geocodeUrl.toString());
          if (!geocodeResponse.ok) {
            throw new Error("Location lookup failed. Try again.");
          }
          const geocodeData = await geocodeResponse.json();
          const top = geocodeData?.results?.[0];

          if (!top) {
            throw new Error("No matching location found.");
          }

          await fetchWeather({
            latitude: top.latitude,
            longitude: top.longitude,
            label: formatLocationLabel(top),
          });
        }
      } else {
        await fetchWeather({
          latitude: coords.lat.trim(),
          longitude: coords.lon.trim(),
          label: "Custom coordinates",
        });
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const handleUseLocation = () => {
    setStatus("loading");
    setError("");

    if (!navigator.geolocation) {
      setStatus("error");
      setError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = {
          lat: position.coords.latitude.toFixed(5),
          lon: position.coords.longitude.toFixed(5),
        };
        setCoords(nextCoords);
        setMode("coords");
        setStatus("idle");
      },
      () => {
        setStatus("error");
        setError("Unable to access your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald-300">
            Weather One
          </p>
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">
              Check the sky in seconds.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 md:text-lg">
              Search by place name or drop exact coordinates. This single page
              uses the free Open-Meteo API, no key needed.
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-glow backdrop-blur"
          >
            <div className="flex flex-wrap gap-2 rounded-full bg-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => {
                  resetStatus();
                  setMode("place");
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === "place"
                    ? "bg-emerald-400 text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Place name
              </button>
              <button
                type="button"
                onClick={() => {
                  resetStatus();
                  setMode("coords");
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === "coords"
                    ? "bg-emerald-400 text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Lat / lon
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {mode === "place" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    Place name
                  </label>
                  <div className="relative" ref={suggestionRef}>
                    <input
                      type="text"
                      value={place}
                      onChange={handlePlaceChange}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestions(false), 120);
                      }}
                      placeholder="Goa, Mumbai, New York"
                      className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400"
                    />
                    {showSuggestions && place.trim().length > 1 ? (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-glow">
                        {isSuggesting ? (
                          <div className="px-4 py-3 text-sm text-slate-400">
                            Searching...
                          </div>
                        ) : suggestions.length > 0 ? (
                          suggestions.map((item) => (
                            <button
                              key={`${item.id}-${item.latitude}-${item.longitude}`}
                              type="button"
                              onMouseDown={() => {
                                setPlace(item.label);
                                setSelectedSuggestion(item);
                                setSuggestions([]);
                                setShowSuggestions(false);
                              }}
                              className="flex w-full items-center justify-between gap-3 border-b border-slate-900/80 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-900 last:border-none"
                            >
                              <span className="font-medium text-white">
                                {item.name}
                              </span>
                              <span className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                                {item.country}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-400">
                            No matches found.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">
                      Latitude
                    </label>
                    <input
                      type="number"
                      value={coords.lat}
                      onChange={handleCoordsChange("lat")}
                      placeholder="19.0760"
                      className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">
                      Longitude
                    </label>
                    <input
                      type="number"
                      value={coords.lon}
                      onChange={handleCoordsChange("lon")}
                      placeholder="72.8777"
                      className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit || status === "loading"}
                className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {status === "loading" ? "Checking..." : "Get weather"}
              </button>
              <button
                type="button"
                onClick={handleUseLocation}
                className="rounded-full border border-slate-700/80 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-white"
              >
                Use my location
              </button>
            </div>

            {error ? (
              <p className="mt-4 text-sm text-rose-300">{error}</p>
            ) : null}
          </form>

          <aside className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-glow">
            <h2 className="text-lg font-semibold text-white">
              Current snapshot
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Results appear here after you search.
            </p>

            {status === "success" && result?.current ? (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                    {queryMeta?.label ?? "Selected location"}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Lat {formatNumber(queryMeta?.latitude, 4)} | Lon{" "}
                    {formatNumber(queryMeta?.longitude, 4)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Local time {queryMeta?.time || "-"}
                  </p>
                </div>

                <div className="grid gap-4 rounded-2xl bg-slate-950/70 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-slate-400">
                      Temperature
                    </span>
                    <span className="text-3xl font-semibold text-white">
                      {formatNumber(result.current.temperature_2m, 1)}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Feels like</span>
                    <span>
                      {formatNumber(result.current.apparent_temperature, 1)}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Precipitation</span>
                    <span>
                      {formatNumber(result.current.precipitation, 1)} mm
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Wind speed</span>
                    <span>
                      {formatNumber(result.current.wind_speed_10m, 1)} km/h
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-3 text-sm text-slate-400">
                <p>Try "Goa" or "Bengaluru".</p>
                <p>Or use coordinates like 19.0760, 72.8777.</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
