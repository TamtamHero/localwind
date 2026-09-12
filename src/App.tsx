import React, { useEffect, useMemo, useState } from "react";

type WindResponse = {
  latitude?: number;
  longitude?: number;
  hourly?: {
    time?: string[];
    wind_direction_10m?: number[];
    wind_speed_10m?: number[];
  };
};

const baseDirs8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const baseDirs16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

const RADIUS = 120;
const INNER_RADIUS = 20;

 type Dir8 = (typeof baseDirs8)[number];
 type Dir16 = (typeof baseDirs16)[number];

 function degreeToCompass(deg: number, highPrecision: boolean): Dir8 | Dir16 {

  if (highPrecision) {
    const idx = Math.round(((deg % 360) / 22.5)) % 16;
    return baseDirs16[idx];
  }
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return baseDirs8[idx];
}

function App() {
  const [data, setData] = useState<WindResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highPrecision, setHighPrecision] = useState(false);
  const [coordsInput, setCoordsInput] = useState("43.95998, 4.81797");
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 43.95998, lon:  4.81797});

  const loadForCoords = async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    setCoords({ lat, lon });
    try {
      const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
      const canUseLS =
        typeof window !== "undefined" && typeof window.localStorage !== "undefined";

      if (canUseLS) {
        const cached = window.localStorage.getItem("windwatcher:" + key);
        if (cached) {
          const parsed = JSON.parse(cached) as WindResponse;
          setData(parsed);
          setLoading(false);
          return;
        }
      }
      const now = new Date();
      const end = now.toISOString().slice(0, 10);
      const startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const start = startDate.toISOString().slice(0, 10);

      const url = new URL("https://archive-api.open-meteo.com/v1/archive");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("start_date", start);
      url.searchParams.set("end_date", end);
      url.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m");
      url.searchParams.set("timezone", "UTC");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch data from Open-Meteo");
      const json = (await res.json()) as WindResponse;
      setData(json);

      if (canUseLS) {
        try {
          window.localStorage.setItem("windwatcher:" + key, JSON.stringify(json));
        } catch {
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForCoords(43.95998, 4.81797);
  }, []);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { labels, counts, avgSpeeds } = useMemo(() => {
    const dirs = data?.hourly?.wind_direction_10m ?? [];
    const speeds = data?.hourly?.wind_speed_10m ?? [];
    const labelsArr = highPrecision ? baseDirs16 : baseDirs8;
    const countsMap: Record<string, number> = {};
    const speedSumMap: Record<string, number> = {};
    labelsArr.forEach((d) => {
      countsMap[d] = 0;
      speedSumMap[d] = 0;
    });

    dirs.forEach((deg, idx) => {
      const k = degreeToCompass(deg, highPrecision);
      const speed = speeds[idx] ?? 0;
      countsMap[k] = (countsMap[k] ?? 0) + 1;
      speedSumMap[k] = (speedSumMap[k] ?? 0) + speed;
    });

    const countsArr = labelsArr.map((d) => countsMap[d] ?? 0);
    const avgSpeedsArr = labelsArr.map((d) => {
      const c = countsMap[d] ?? 0;
      if (!c) return 0;
      return (speedSumMap[d] ?? 0) / c;
    });

    return { labels: labelsArr, counts: countsArr, avgSpeeds: avgSpeedsArr };
  }, [data, highPrecision]);

   if (loading)
     return (
       <div
         style={{
           minHeight: "100vh",
           margin: 0,
           padding: "1rem",
           background: "radial-gradient(circle at top, #0f172a, #020617)",
           color: "#e5e7eb",
           fontFamily:
             "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
           display: "flex",
           alignItems: "center",
           justifyContent: "center",
         }}
       >
         Loading...
       </div>
     );

   if (error)
     return (
       <div
         style={{
           minHeight: "100vh",
           margin: 0,
           padding: "1rem",
           background: "radial-gradient(circle at top, #0f172a, #020617)",
           color: "#e5e7eb",
           fontFamily:
             "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
           display: "flex",
           alignItems: "center",
           justifyContent: "center",
         }}
       >
         Error: {error}
       </div>
     );


  const activeIndex =
    selectedIndex != null ? selectedIndex : hoverIndex != null ? hoverIndex : null;

  const activeLabel =
    activeIndex != null && activeIndex >= 0 && activeIndex < labels.length
      ? labels[activeIndex]
      : null;
  const activeCount =
    activeIndex != null && activeIndex >= 0 && activeIndex < counts.length
      ? counts[activeIndex]
      : null;
  const activeSpeed =
    activeIndex != null && activeIndex >= 0 && activeIndex < avgSpeeds.length
      ? avgSpeeds[activeIndex]
      : null;

  const maxCount = Math.max(1, ...counts);
   const center = RADIUS + 30;
   const totalRadius = RADIUS + 40;


  const colorForSpeed = (speed: number) => {
    const clamped = Math.max(0, Math.min(30, speed));
    const t = clamped / 30;
    const r = Math.round(255 * t);
    const g = 0;
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  };

  return (
     <div
       style={{
         minHeight: "100vh",
         margin: 0,
         padding: "1.25rem",
         background: "radial-gradient(circle at top, #0f172a, #020617)",
         color: "#e5e7eb",
         fontFamily:
           "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
         display: "flex",
         flexDirection: "column",
       }}
     >
       <div
         style={{
           width: "100%",
           height: "100%",
           background: "rgba(15,23,42,0.9)",
           borderRadius: 24,
           border: "1px solid rgba(148,163,184,0.25)",
           boxShadow:
             "0 24px 80px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.8)",
           padding: "1.25rem 1.5rem 1.5rem",
           backdropFilter: "blur(18px)",
           display: "grid",
           gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
           gap: "1.5rem",
           alignItems: "stretch",
         }}
       >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "0.2rem 0.7rem",
                borderRadius: 999,
                background:
                  "linear-gradient(to right, rgba(59,130,246,0.22), rgba(236,72,153,0.22))",
                border: "1px solid rgba(148,163,184,0.3)",
                fontSize: 12,
                letterSpacing: 0.08,
                textTransform: "uppercase",
                color: "#cbd5f5",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background:
                    "radial-gradient(circle at 30% 30%, #e5e7eb, #22c55e 45%, transparent 60%)",
                  boxShadow: "0 0 12px rgba(34,197,94,0.9)",
                }}
              />
              Windwatcher · Local archive
            </div>
            <h1
              style={{
                marginTop: 14,
                marginBottom: 4,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: 0.02,
              }}
            >
              Wind rose for the last 365 days
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: "#9ca3af",
              }}
            >
              Each sector shows how often the wind blows from that direction.
              Color encodes the average speed: blue for calm, red for strong winds.
            </p>
          </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Current coordinates: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  value={coordsInput}
                  onChange={(e) => setCoordsInput(e.target.value)}
                  placeholder="Latitude, Longitude (e.g. 43.95998, 4.81797)"
                  style={{
                    flex: 1,
                    padding: "0.45rem 0.7rem",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.6)",
                    background: "rgba(15,23,42,0.95)",
                    color: "#e5e7eb",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => {
                    const parts = coordsInput.split(/[,\s]+/).filter(Boolean);
                    if (parts.length < 2) {
                      setError("Please enter coordinates as 'lat, lon'");
                      return;
                    }
                    const lat = Number(parts[0]);
                    const lon = Number(parts[1]);
                    if (!isFinite(lat) || !isFinite(lon)) {
                      setError("Invalid latitude/longitude values");
                      return;
                    }
                    loadForCoords(lat, lon);
                  }}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: 999,
                    border: "1px solid rgba(129,140,248,0.9)",
                    background:
                      "linear-gradient(to right, rgba(59,130,246,0.95), rgba(129,140,248,0.98))",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Load cached
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0.4rem 0.65rem",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.8)",
                  border: "1px solid rgba(148,163,184,0.5)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
              <span
                style={{
                  width: 34,
                  height: 18,
                  borderRadius: 999,
                  padding: 2,
                  background: highPrecision
                    ? "linear-gradient(to right, #38bdf8, #6366f1)"
                    : "rgba(15,23,42,0.9)",
                  border: "1px solid rgba(148,163,184,0.5)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: highPrecision ? "flex-end" : "flex-start",
                  transition: "background 150ms ease, justify-content 150ms ease",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: "#e5e7eb",
                    boxShadow: "0 0 0 1px rgba(15,23,42,0.6)",
                  }}
                />
              </span>
              <input
                type="checkbox"
                checked={highPrecision}
                onChange={(e) => setHighPrecision(e.target.checked)}
                style={{ display: "none" }}
              />
              <span style={{ color: "#e5e7eb" }}>16-point precision</span>
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              <span>Speed scale</span>
              <div
                style={{
                  flexShrink: 0,
                  width: 110,
                  height: 10,
                  borderRadius: 999,
                  background:
                    "linear-gradient(to right, #0ea5e9, #22c55e, #eab308, #ef4444)",
                  boxShadow: "0 0 0 1px rgba(15,23,42,0.7)",
                }}
              />
              <span style={{ opacity: 0.9 }}>0 km/h</span>
              <span style={{ opacity: 0.9 }}>30+ km/h</span>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 6,
                padding: "0.5rem 0.75rem",
                borderRadius: 12,
                background: "rgba(127,29,29,0.35)",
                border: "1px solid rgba(248,113,113,0.6)",
                fontSize: 12,
                color: "#fecaca",
              }}
            >
              {error}
            </div>
          )}
        </div>

         <div
           style={{
             display: "flex",
             alignItems: "center",
             justifyContent: "center",
             width: "100%",
           }}
         >
           <div
             style={{
               position: "relative",
               width: "100%",
               maxWidth: 640,
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
             }}
           >
              <svg
                width="80%"
                height="80%"
                viewBox={`0 0 ${totalRadius * 2} ${totalRadius * 2}`}
                preserveAspectRatio="xMidYMid meet"
              >
            <defs>
              <radialGradient id="centerGlow" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#e5e7eb" stopOpacity={0.6} />
                <stop offset="35%" stopColor="#38bdf8" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#020617" stopOpacity={0} />
              </radialGradient>
            </defs>

            <circle
              cx={center}
              cy={center}
              r={RADIUS + 4}
              fill="rgba(15,23,42,0.95)"
              stroke="rgba(148,163,184,0.55)"
              strokeWidth={1.4}
            />

            <circle
              cx={center}
              cy={center}
              r={INNER_RADIUS}
              fill="rgba(15,23,42,0.9)"
              stroke="rgba(148,163,184,0.4)"
              strokeWidth={1}
            />
            <circle
              cx={center}
              cy={center}
              r={RADIUS}
              fill="url(#centerGlow)"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth={1}
              strokeDasharray="4 6"
            />

            {[0, 90, 180, 270].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = center + INNER_RADIUS * Math.cos(rad);
              const y1 = center + INNER_RADIUS * Math.sin(rad);
              const x2 = center + RADIUS * Math.cos(rad);
              const y2 = center + RADIUS * Math.sin(rad);
              return (
                <line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(148,163,184,0.45)"
                  strokeWidth={0.8}
                  strokeDasharray="2 4"
                />
              );
            })}

            {labels.map((label, i) => {
              const value = counts[i];
              const frac = value / maxCount;
              const outerR = INNER_RADIUS + frac * (RADIUS - INNER_RADIUS);
              const avgSpeed = avgSpeeds[i] ?? 0;
              const fillColor = colorForSpeed(avgSpeed);

               const count = labels.length;
               const angleStep = (2 * Math.PI) / count;
               const startAngle = -Math.PI / 2 + (i - 0.5) * angleStep;
               const endAngle = startAngle + angleStep * 0.9;


              const x1Inner = center + INNER_RADIUS * Math.cos(startAngle);
              const y1Inner = center + INNER_RADIUS * Math.sin(startAngle);
              const x1Outer = center + outerR * Math.cos(startAngle);
              const y1Outer = center + outerR * Math.sin(startAngle);

              const x2Inner = center + INNER_RADIUS * Math.cos(endAngle);
              const y2Inner = center + INNER_RADIUS * Math.sin(endAngle);
              const x2Outer = center + outerR * Math.cos(endAngle);
              const y2Outer = center + outerR * Math.sin(endAngle);

              const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

              const d = [
                `M ${x1Inner} ${y1Inner}`,
                `L ${x1Outer} ${y1Outer}`,
                `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
                `L ${x2Inner} ${y2Inner}`,
                `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${x1Inner} ${y1Inner}`,
                "Z",
              ].join(" ");

               const midAngle = -Math.PI / 2 + i * angleStep;
               const labelR = RADIUS + 14;
               const lx = center + labelR * Math.cos(midAngle);
               const ly = center + labelR * Math.sin(midAngle);


              const isHovered = hoverIndex === i;
              const isSelected = selectedIndex === i;

              return (
                <g
                  key={label}
                  onMouseEnter={() => {
                    setHoverIndex(i);
                  }}
                  onMouseLeave={() => {
                    setHoverIndex(null);
                  }}
                  onClick={() => {
                    setSelectedIndex((prev) => (prev === i ? null : i));
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d={d}
                    fill={fillColor}
                    stroke={isSelected ? "#f97316" : isHovered ? "#f9fafb" : "#020617"}
                    strokeWidth={isSelected ? 1.2 : isHovered ? 1 : 0.6}
                    style={{ opacity: isSelected || isHovered ? 1 : 0.8 }}
                  />
                  <text
                    x={lx}
                    y={ly}
                    fontSize={9}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill="#e5e7eb"
                    style={{ textShadow: "0 1px 2px rgba(15,23,42,0.9)" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            <circle
              cx={center}
              cy={center}
              r={4}
              fill="#e5e7eb"
              stroke="#0f172a"
              strokeWidth={1}
            />
          </svg>

          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 4,
              transform: "translateX(-50%)",
              background: "rgba(15,23,42,0.96)",
              borderRadius: 14,
              padding: "0.55rem 0.9rem",
              border: "1px solid rgba(148,163,184,0.7)",
              boxShadow: "0 10px 25px rgba(15,23,42,0.9)",
              minWidth: 190,
              fontSize: 12,
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                color: "#e5e7eb",
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {activeLabel ?? "No sector selected"}
              </div>
              <div style={{ color: "#9ca3af" }}>
                <div>
                  Frequency: <strong>{activeCount ?? "–"}</strong>
                  {activeCount != null && data?.hourly?.time && (
                    <span>
                      {" "}(
                      {((activeCount / data.hourly.time.length) * 100).toFixed(1)}%
                      )
                    </span>
                  )}
                </div>
                <div>
                  Avg speed: <strong>{activeSpeed != null ? `${activeSpeed.toFixed(1)} km/h` : "–"}</strong>
                </div>
              </div>
            </div>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background:
                  activeSpeed != null ? colorForSpeed(activeSpeed) : "rgba(75,85,99,0.7)",
                boxShadow: "0 0 12px rgba(148,163,184,0.9)",
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}

export default App; 
