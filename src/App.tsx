import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type WindResponse = {
  latitude?: number;
  longitude?: number;
  hourly?: {
    time?: string[];
    wind_direction_10m?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
  };
};

type GeoResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
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

const dirFullNames: Record<string, string> = {
  N: "North",
  NNE: "North-northeast",
  NE: "Northeast",
  ENE: "East-northeast",
  E: "East",
  ESE: "East-southeast",
  SE: "Southeast",
  SSE: "South-southeast",
  S: "South",
  SSW: "South-southwest",
  SW: "Southwest",
  WSW: "West-southwest",
  W: "West",
  WNW: "West-northwest",
  NW: "Northwest",
  NNW: "North-northwest",
};

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

function Tooltip({
  text,
  portrait = false,
  children,
}: {
  text: string;
  portrait?: boolean;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  const handleEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = e.currentTarget;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (portrait) {
        const rect = el.getBoundingClientRect();
        const width = Math.min(230, window.innerWidth - 16);
        let l = window.innerWidth / 2 - rect.left;
        const minL = width / 2 + 8 - rect.left;
        const maxL = window.innerWidth - width / 2 - 8 - rect.left;
        l = Math.max(minL, Math.min(maxL, l));
        setLeft(l);
      } else {
        setLeft(null);
      }
      setShow(true);
    }, 600);
  };
  const handleLeave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setShow(false);
  };

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {show && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: left != null ? left : "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: portrait ? "calc(100vw - 1.2rem)" : 230,
            padding: "6px 10px",
            borderRadius: 10,
            background: "rgba(15,23,42,0.98)",
            border: "1px solid rgba(148,163,184,0.5)",
            color: "#e5e7eb",
            fontSize: 12,
            lineHeight: 1.4,
            textAlign: "center",
            boxShadow: "0 10px 25px rgba(15,23,42,0.9)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
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

      const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
      if (canUseLS) {
        const cacheKey = "localwind:v2:" + key;
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as {
              savedAt?: number;
              data?: WindResponse;
            };
            if (
              parsed &&
              typeof parsed.savedAt === "number" &&
              Date.now() - parsed.savedAt < CACHE_MAX_AGE &&
              parsed.data
            ) {
              setData(parsed.data);
              setLoading(false);
              return;
            }
          } catch {
          }
          window.localStorage.removeItem(cacheKey);
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
      url.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m,wind_gusts_10m");
      url.searchParams.set("timezone", "UTC");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch data from Open-Meteo");
      const json = (await res.json()) as WindResponse;
      setData(json);

      if (canUseLS) {
        try {
          window.localStorage.setItem(
            "localwind:v2:" + key,
            JSON.stringify({ savedAt: Date.now(), data: json })
          );
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

   useEffect(() => {
     if (typeof window === "undefined" || !window.matchMedia) return;
     const mq = window.matchMedia("(orientation: portrait), (max-width: 820px)");
     const update = () => setIsPortrait(mq.matches);
     update();
     if (mq.addEventListener) mq.addEventListener("change", update);
     else mq.addListener(update);
     return () => {
       if (mq.removeEventListener) mq.removeEventListener("change", update);
       else mq.removeListener(update);
     };
   }, []);

   const [hoverIndex, setHoverIndex] = useState<number | null>(null);
   const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
   const [selectedMonthForChart, setSelectedMonthForChart] = useState<number | null>(null);
   const [monthlyHover, setMonthlyHover] = useState<number | null>(null);
   const [scaleSpeed, setScaleSpeed] = useState<number | null>(null);
   const [relativeSpeed, setRelativeSpeed] = useState(false);
   const [metric, setMetric] = useState<"average" | "median" | "max">("average");
   const [useGusts, setUseGusts] = useState(false);
   const [isPortrait, setIsPortrait] = useState(false);
   const [showMap, setShowMap] = useState(false);
   const [showFullDescription, setShowFullDescription] = useState(false);
   const [searchQuery, setSearchQuery] = useState("");
   const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
   const [searchLoading, setSearchLoading] = useState(false);
   const mapContainerRef = useRef<HTMLDivElement | null>(null);
   const mapRef = useRef<L.Map | null>(null);
   const placePinRef = useRef<
     ((lat: number, lng: number, zoom?: number) => void) | null
   >(null);
   const suppressSearchRef = useRef(false);

   useEffect(() => {
     if (!showMap || !mapContainerRef.current) return;
     const map = L.map(mapContainerRef.current).setView([coords.lat, coords.lon], 4);
     L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
       maxZoom: 19,
       attribution: "&copy; OpenStreetMap contributors",
     }).addTo(map);

     let marker: L.Marker | null = null;
     let popup: L.Popup | null = null;

     const placePin = (lat: number, lng: number, zoom?: number) => {
       if (marker) marker.remove();
       if (popup) map.closePopup(popup);

       if (zoom) map.setView([lat, lng], zoom, { animate: true });

       const icon = L.divIcon({
         className: "",
         html:
           '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#ef4444;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 0 6px rgba(0,0,0,0.6)"></div>',
         iconSize: [18, 18],
         iconAnchor: [9, 18],
         popupAnchor: [0, -28],
       });
       marker = L.marker([lat, lng], { icon }).addTo(map);

       const content = document.createElement("div");
       content.style.cssText =
         "display:flex;flex-direction:column;gap:6px;min-width:160px;color:#e5e7eb;";
       const label = document.createElement("div");
       label.style.cssText = "font-size:11px;color:#93c5fd;";
       label.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
       const row = document.createElement("div");
       row.style.cssText = "display:flex;gap:6px;justify-content:flex-end;";
       const cancelBtn = document.createElement("button");
       cancelBtn.textContent = "Cancel";
       cancelBtn.style.cssText =
         "padding:4px 10px;border-radius:999px;border:1px solid rgba(148,163,184,0.6);background:rgba(15,23,42,0.95);color:#e5e7eb;font-size:12px;cursor:pointer;";
       const loadBtn = document.createElement("button");
       loadBtn.textContent = "Load";
       loadBtn.style.cssText =
         "padding:4px 10px;border-radius:999px;border:1px solid rgba(129,140,248,0.9);background:linear-gradient(to right, rgba(59,130,246,0.95), rgba(129,140,248,0.98));color:#fff;font-size:12px;cursor:pointer;";
       cancelBtn.addEventListener("click", () => {
         if (marker) {
           marker.remove();
           marker = null;
         }
         if (popup) {
           map.closePopup(popup);
           popup = null;
         }
       });
       loadBtn.addEventListener("click", () => {
         setCoordsInput(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
         loadForCoords(lat, lng);
         setShowMap(false);
       });
       row.appendChild(cancelBtn);
       row.appendChild(loadBtn);
       content.appendChild(label);
       content.appendChild(row);

       popup = L.popup({
         className: "ww-popup",
         closeButton: false,
         offset: L.point(0, -30),
       })
         .setLatLng([lat, lng])
         .setContent(content)
         .openOn(map);
     };

     placePinRef.current = placePin;

     map.on("click", (e: L.LeafletMouseEvent) => {
       placePin(e.latlng.lat, e.latlng.lng);
     });

     mapRef.current = map;
     setTimeout(() => map.invalidateSize(), 0);
     return () => {
       map.remove();
       mapRef.current = null;
       placePinRef.current = null;
     };
   }, [showMap]);

   const runSearch = async () => {
     const q = searchQuery.trim();
     if (!q) return;
     setSearchLoading(true);
     try {
       const params = new URLSearchParams({
         format: "jsonv2",
         limit: "10",
         addressdetails: "1",
         q,
       });
       const map = mapRef.current;
       if (map) {
         const b = map.getBounds();
         const sw = b.getSouthWest();
         const ne = b.getNorthEast();
         params.set("viewbox", `${sw.lng},${ne.lat},${ne.lng},${sw.lat}`);
         params.set("bounded", "0");
       }
       const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
       const res = await fetch(url, {
         headers: { Accept: "application/json" },
       });
       const json = (await res.json()) as GeoResult[];
       setSearchResults(Array.isArray(json) ? json : []);
     } catch {
       setSearchResults([]);
     } finally {
       setSearchLoading(false);
     }
   };

   const selectSearchResult = (r: GeoResult) => {
     const lat = Number(r.lat);
     const lon = Number(r.lon);
     if (!isFinite(lat) || !isFinite(lon)) return;
     suppressSearchRef.current = true;
     setSearchQuery(r.display_name);
     setSearchResults([]);
     if (placePinRef.current) placePinRef.current(lat, lon, 12);
   };

   useEffect(() => {
     if (!showMap) return;
     if (suppressSearchRef.current) {
       suppressSearchRef.current = false;
       return;
     }
     const q = searchQuery.trim();
     if (q.length < 3) {
       setSearchResults([]);
       return;
     }
     const timer = setTimeout(() => {
       runSearch();
     }, 400);
     return () => clearTimeout(timer);
   }, [searchQuery, showMap]);


   const { labels, counts, avgSpeeds, monthly, monthlySeries, globalMaxFrac } = useMemo(() => {
     const dirs = data?.hourly?.wind_direction_10m ?? [];
     const speeds = useGusts
       ? data?.hourly?.wind_gusts_10m ?? data?.hourly?.wind_speed_10m ?? []
       : data?.hourly?.wind_speed_10m ?? [];
     const times = data?.hourly?.time ?? [];
     const labelsArr = highPrecision ? baseDirs16 : baseDirs8;
     const countsMap: Record<string, number> = {};
     const speedsMap: Record<string, number[]> = {};
     const monthly: Array<{ year: number; month: number; count: number; avgSpeed: number }> = [];
     const monthlySeries: Array<{
       labels: (typeof labelsArr)[number][];
       counts: number[];
       avgSpeeds: number[];
       maxCount: number;
     }> = [];

     const statFor = (arr: number[]) => {
       if (!arr.length) return 0;
       if (metric === "max") return Math.max(...arr);
       if (metric === "median") {
         const sorted = [...arr].sort((a, b) => a - b);
         const mid = Math.floor(sorted.length / 2);
         return sorted.length % 2
           ? sorted[mid]
           : (sorted[mid - 1] + sorted[mid]) / 2;
       }
       let sum = 0;
       for (const v of arr) sum += v;
       return sum / arr.length;
     };
 
     if (times.length && speeds.length && dirs.length) {
       const buckets: Record<
         string,
         {
           count: number;
           speedsAll: number[];
           dirCounts: Record<string, number>;
           dirSpeeds: Record<string, number[]>;
         }
       > = {};
 
       times.forEach((iso, idx) => {
         const d = new Date(iso);
         if (Number.isNaN(d.getTime())) return;
         const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
         if (!buckets[key]) {
           buckets[key] = {
             count: 0,
             speedsAll: [],
             dirCounts: {},
             dirSpeeds: {},
           };
         }
         const speed = speeds[idx] ?? 0;
         const dirLabel = degreeToCompass(dirs[idx] ?? 0, highPrecision);
         buckets[key].count += 1;
         buckets[key].speedsAll.push(speed);
         buckets[key].dirCounts[dirLabel] = (buckets[key].dirCounts[dirLabel] ?? 0) + 1;
         (buckets[key].dirSpeeds[dirLabel] ??= []).push(speed);
       });
 
       const keys = Object.keys(buckets).sort();
       const last12 = keys.slice(-12);
       last12.forEach((k) => {
         const [y, m] = k.split("-");
         const bucket = buckets[k];
         monthly.push({
           year: Number(y),
           month: Number(m),
           count: bucket.count,
           avgSpeed: statFor(bucket.speedsAll),
         });
 
         const mCounts = labelsArr.map((label) => bucket.dirCounts[label] ?? 0);
         const mAvgSpeeds = labelsArr.map((label) =>
           statFor(bucket.dirSpeeds[label] ?? [])
         );
         const mMaxCount = Math.max(1, ...mCounts);
         monthlySeries.push({
           labels: labelsArr.slice(),
           counts: mCounts,
           avgSpeeds: mAvgSpeeds,
           maxCount: mMaxCount,
         });
       });

       monthly.reverse();
       monthlySeries.reverse();
     }


    labelsArr.forEach((d) => {
      countsMap[d] = 0;
      speedsMap[d] = [];
    });

    dirs.forEach((deg, idx) => {
      const k = degreeToCompass(deg, highPrecision);
      const speed = speeds[idx] ?? 0;
      countsMap[k] = (countsMap[k] ?? 0) + 1;
      (speedsMap[k] ??= []).push(speed);
    });

    const countsArr = labelsArr.map((d) => countsMap[d] ?? 0);
    const avgSpeedsArr = labelsArr.map((d) => statFor(speedsMap[d] ?? []));

    const totalHours = times.length || 1;
    let globalMaxFrac = 0;
    countsArr.forEach((c) => {
      globalMaxFrac = Math.max(globalMaxFrac, c / totalHours);
    });
    monthlySeries.forEach((s, idx) => {
      const total = monthly[idx]?.count || 1;
      s.counts.forEach((c) => {
        globalMaxFrac = Math.max(globalMaxFrac, c / total);
      });
    });
    if (globalMaxFrac <= 0) globalMaxFrac = 1;
 
    return {
      labels: labelsArr,
      counts: countsArr,
      avgSpeeds: avgSpeedsArr,
      monthly,
      monthlySeries,
      globalMaxFrac,
    };
    }, [data, highPrecision, metric, useGusts]);



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
    hoverIndex != null ? hoverIndex : selectedIndex != null ? selectedIndex : null;

  const dataset =
    selectedMonthForChart != null && monthlySeries[selectedMonthForChart]
      ? monthlySeries[selectedMonthForChart]
      : { labels, counts, avgSpeeds, maxCount: Math.max(1, ...counts) };

  const chartLabels = dataset.labels;
  const chartCounts = dataset.counts;
  const chartAvgSpeeds = dataset.avgSpeeds;
  const maxCount = dataset.maxCount;

  const activeLabel =
    activeIndex != null && activeIndex >= 0 && activeIndex < chartLabels.length
      ? chartLabels[activeIndex]
      : null;
  const activeCount =
    activeIndex != null && activeIndex >= 0 && activeIndex < chartCounts.length
      ? chartCounts[activeIndex]
      : null;
  const activeSpeed =
    activeIndex != null && activeIndex >= 0 && activeIndex < chartAvgSpeeds.length
      ? chartAvgSpeeds[activeIndex]
      : null;

  const selectedSpeed =
    selectedIndex != null &&
    selectedIndex >= 0 &&
    selectedIndex < chartAvgSpeeds.length
      ? chartAvgSpeeds[selectedIndex]
      : null;
  const displayedScaleSpeed =
    scaleSpeed != null ? scaleSpeed : selectedSpeed;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const selectedMonth =
    selectedMonthForChart != null ? monthly[selectedMonthForChart] : null;
  const chartTitle = selectedMonth
    ? `${monthNames[selectedMonth.month - 1]} ${selectedMonth.year}`
    : "Last 365 days";
  const chartTotalCount = selectedMonth
    ? selectedMonth.count
    : data?.hourly?.time?.length ?? 0;
   const center = RADIUS + 30;
   const totalRadius = RADIUS + 40;
   const miniHalf = RADIUS + 20;
   const mainHalf = RADIUS + 24;


  const hueStops: Array<[number, number]> = [
    [0, 145],
    [0.15, 145],
    [0.35, 60],
    [0.4, 60],
    [0.6, 30],
    [0.65, 30],
    [0.85, 0],
    [1, 0],
  ];

  const hueForT = (t: number) => {
    for (let i = 0; i < hueStops.length - 1; i++) {
      const [t0, h0] = hueStops[i];
      const [t1, h1] = hueStops[i + 1];
      if (t <= t1) {
        const span = t1 - t0 || 1;
        return h0 + (h1 - h0) * ((t - t0) / span);
      }
    }
    return hueStops[hueStops.length - 1][1];
  };

  const monthlyMaxSpeed = monthlySeries.reduce(
    (max, series) => Math.max(max, ...series.avgSpeeds),
    1
  );
  const absoluteMaxSpeed =
    metric === "max" ? (useGusts ? 100 : 50) : useGusts ? 50 : 30;
  const maxSpeedForColor = relativeSpeed
    ? monthlyMaxSpeed
    : absoluteMaxSpeed;

  const colorForSpeed = (speed: number) => {
    const clamped = Math.max(0, Math.min(maxSpeedForColor, speed));
    const t = clamped / maxSpeedForColor;
    const h = hueForT(t);
    const s = 80 + (85 - 80) * t;
    const l = 42 + (50 - 42) * t;
    return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
  };

  const speedGradient = Array.from({ length: 31 }, (_, i) =>
    colorForSpeed((i / 30) * maxSpeedForColor)
  ).join(", ");

  return (
      <div
        style={{
          height: isPortrait ? "auto" : "100vh",
          minHeight: isPortrait ? "100vh" : undefined,
          boxSizing: "border-box",
          overflow: isPortrait ? "visible" : "hidden",
          margin: 0,
          padding: isPortrait ? "0.4rem" : "1.25rem",
          background: "radial-gradient(circle at top, #0f172a, #020617)",
          color: "#e5e7eb",
          fontFamily:
           "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
           display: "flex",
           justifyContent: "center",
           alignItems: isPortrait ? "flex-start" : "stretch",
         }}
       >
         <div
           style={{
             width: "100%",
             minHeight: isPortrait ? undefined : 0,
             overflow: isPortrait ? "visible" : "hidden",
             background: "rgba(15,23,42,0.9)",


           borderRadius: 24,
           border: "1px solid rgba(148,163,184,0.25)",
           boxShadow:
             "0 24px 80px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.8)",
           padding: isPortrait ? "0.6rem" : "1.25rem 1.5rem 1.5rem",
           backdropFilter: "blur(18px)",
            display: "grid",
            gridTemplateColumns: isPortrait
              ? "minmax(0, 1fr)"
              : "minmax(0, 2fr) minmax(0, 3fr)",
            gridTemplateRows: isPortrait ? undefined : "minmax(0, 1fr)",
            gap: "1.5rem",
            alignItems: "stretch",

         }}
       >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: 0 }}>
          <div>
            <h1
              style={{
                marginTop: 0,
                marginBottom: 4,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: 0.02,
              }}
            >
              Wind rose for last 365 days
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: "#9ca3af",
                ...(isPortrait && !showFullDescription
                  ? {
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }
                  : {}),
              }}
            >
              A wind rose summarizing hourly wind measurements from the last
              365 days. Each wedge points to the direction the wind blows from
              and its length shows how often that direction occurs — longer
              means more frequent. Color shows the average wind speed for that
              direction, from green (calm) to red (strong).
            </p>
            {isPortrait && (
              <button
                onClick={() => setShowFullDescription((v) => !v)}
                style={{
                  marginTop: 4,
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#93c5fd",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {showFullDescription ? "Read less" : "Read more"}
              </button>
            )}
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
                    flex: "1 1 0",
                    minWidth: 0,
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
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowMap(true);
                  }}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.6)",
                    background: "rgba(15,23,42,0.95)",
                    color: "#e5e7eb",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Map
                </button>
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
                  Load
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >

              <Tooltip text="Group wind directions into 8 or 16 compass sectors." portrait={isPortrait}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 40,
                  boxSizing: "border-box",
                  padding: "0.4rem 0.7rem",
                  borderRadius: 999,
                  background: highPrecision
                    ? "linear-gradient(to right, rgba(59,130,246,0.95), rgba(129,140,248,0.98))"
                    : "rgba(15,23,42,0.8)",
                  border: highPrecision
                    ? "1px solid rgba(129,140,248,0.9)"
                    : "1px solid rgba(148,163,184,0.5)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
              <input
                type="checkbox"
                checked={highPrecision}
                onChange={(e) => setHighPrecision(e.target.checked)}
                style={{ display: "none" }}
              />
              <span style={{ color: highPrecision ? "white" : "#e5e7eb" }}>
                {highPrecision ? "16" : "8"}-point precision
              </span>
            </label>
            </Tooltip>

            <Tooltip text="Absolute uses a fixed km/h range; Relative scales colours to the strongest month." portrait={isPortrait}>
            <button
              onClick={() => setRelativeSpeed((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 40,
                boxSizing: "border-box",
                padding: "0.4rem 0.7rem",
                borderRadius: 999,
                background: relativeSpeed
                  ? "linear-gradient(to right, rgba(59,130,246,0.95), rgba(129,140,248,0.98))"
                  : "rgba(15,23,42,0.8)",
                border: relativeSpeed
                  ? "1px solid rgba(129,140,248,0.9)"
                  : "1px solid rgba(148,163,184,0.5)",
                color: relativeSpeed ? "white" : "#e5e7eb",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Speed Scale: {relativeSpeed ? "Relative" : "Absolute"}
            </button>
            </Tooltip>

            <Tooltip text="How each sector's speed is summarised: average, median, or maximum." portrait={isPortrait}>
            <button
              onClick={() =>
                setMetric((prev) =>
                  prev === "average"
                    ? "median"
                    : prev === "median"
                    ? "max"
                    : "average"
                )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 40,
                boxSizing: "border-box",
                padding: "0.4rem 0.7rem",
                borderRadius: 999,
                background:
                  metric === "median"
                    ? "linear-gradient(to right, rgba(59,130,246,0.95), rgba(129,140,248,0.98))"
                    : metric === "max"
                    ? "linear-gradient(to right, rgba(239,68,68,0.95), rgba(244,63,94,0.98))"
                    : "rgba(15,23,42,0.8)",
                border:
                  metric === "median"
                    ? "1px solid rgba(129,140,248,0.9)"
                    : metric === "max"
                    ? "1px solid rgba(248,113,113,0.9)"
                    : "1px solid rgba(148,163,184,0.5)",
                color: metric === "average" ? "#e5e7eb" : "white",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Values:{" "}
              {metric === "average"
                ? "Average"
                : metric === "median"
                ? "Median"
                : "Max"}
            </button>
            </Tooltip>

            <Tooltip text="Plot mean wind speed or wind gusts." portrait={isPortrait}>
            <button
              onClick={() => setUseGusts((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 40,
                boxSizing: "border-box",
                padding: "0.4rem 0.7rem",
                borderRadius: 999,
                background: useGusts
                  ? "linear-gradient(to right, rgba(59,130,246,0.95), rgba(129,140,248,0.98))"
                  : "rgba(15,23,42,0.8)",
                border: useGusts
                  ? "1px solid rgba(129,140,248,0.9)"
                  : "1px solid rgba(148,163,184,0.5)",
                color: useGusts ? "white" : "#e5e7eb",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Data: {useGusts ? "Gusts" : "Wind"}
            </button>
            </Tooltip>

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
             flex: 1,
             minHeight: 0,
             display: "flex",
             flexDirection: "column",
             alignItems: "center",
             justifyContent: "flex-end",
             width: "100%",
             marginBottom: isPortrait ? 4 : 0,
           }}
         >
           <div
             style={{
               flex: isPortrait ? undefined : 1,
               minHeight: isPortrait ? undefined : 0,
               width: "100%",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
             }}
           >
              <svg
                width={isPortrait ? "80%" : "100%"}
                height={isPortrait ? "80%" : "100%"}
                viewBox={`${center - mainHalf} ${center - mainHalf} ${mainHalf * 2} ${mainHalf * 2}`}
                preserveAspectRatio="xMidYMid meet"
              >
            <defs>
              <radialGradient id="centerGlow" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#e5e7eb" stopOpacity={0.6} />
                <stop offset="35%" stopColor="#38bdf8" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#020617" stopOpacity={0} />
              </radialGradient>
              <pattern
                id="selectedStripes"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="rgba(0,0,0,0.7)"
                  strokeWidth="2"
                />
              </pattern>
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

            {chartLabels.map((label, i) => {
              const value = chartCounts[i];
              const frac =
                value / Math.max(1, chartTotalCount) / globalMaxFrac;
              const outerR = INNER_RADIUS + frac * (RADIUS - INNER_RADIUS);
              const avgSpeed = chartAvgSpeeds[i] ?? 0;
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
                    setScaleSpeed(avgSpeed);
                  }}
                  onMouseLeave={() => {
                    setHoverIndex(null);
                    setScaleSpeed(null);
                  }}
                  onClick={() => {
                    setSelectedIndex((prev) => (prev === i ? null : i));
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d={d}
                    fill={fillColor}
                    stroke={isHovered ? "#f9fafb" : "#020617"}
                    strokeWidth={isHovered ? 1 : 0.6}
                    style={{ opacity: isSelected || isHovered ? 1 : 0.8 }}
                  />
                  {isSelected && (
                    <path d={d} fill="url(#selectedStripes)" pointerEvents="none" />
                  )}
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
           </div>

          <div
            style={{
              marginTop: 2,
              background: "rgba(15,23,42,0.96)",
              borderRadius: 14,
              padding: "0.6rem 0.9rem 0.7rem",
              border: "1px solid rgba(148,163,184,0.7)",
              boxShadow: "0 10px 25px rgba(15,23,42,0.9)",
              minWidth: 260,
              fontSize: 12,
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              color: "#e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#93c5fd",
                letterSpacing: 0.02,
              }}
            >
              {chartTitle}
            </div>
            <div style={{ fontWeight: 600 }}>
              {activeLabel
                ? dirFullNames[activeLabel] ?? activeLabel
                : "No sector selected"}
            </div>
            <div style={{ color: "#9ca3af" }}>
              Frequency:{" "}
              <strong>
                {activeCount != null ? `${activeCount}h` : "–"}
              </strong>
              {activeCount != null && chartTotalCount > 0 && (
                <span>
                  {" "}(
                  {((activeCount / chartTotalCount) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginTop: 2,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 10,
                  borderRadius: 999,
                  background: `linear-gradient(to right, ${speedGradient})`,
                  boxShadow: "0 0 0 1px rgba(15,23,42,0.7)",
                }}
              >
                {displayedScaleSpeed != null && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: `${(Math.max(0, Math.min(maxSpeedForColor, displayedScaleSpeed)) / maxSpeedForColor) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: colorForSpeed(displayedScaleSpeed),
                      border: "2px solid #0f172a",
                      boxShadow: "0 0 8px rgba(0,0,0,0.6)",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 10,
                  color: "#9ca3af",
                }}
              >
                <span>0 km/h</span>
                <span
                  style={{
                    color:
                      displayedScaleSpeed != null
                        ? colorForSpeed(displayedScaleSpeed)
                        : "#9ca3af",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayedScaleSpeed != null
                    ? `${displayedScaleSpeed.toFixed(1)} km/h`
                    : ""}
                </span>
                <span>
                  {relativeSpeed
                    ? `${maxSpeedForColor.toFixed(0)} km/h`
                    : `${absoluteMaxSpeed}+ km/h`}
                </span>
              </div>
            </div>
          </div>
      </div>
    </div>
    <div
      style={{
        width: "100%",
        minHeight: 0,
        height: isPortrait ? "auto" : "100%",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPortrait
            ? "repeat(3, minmax(0, 1fr))"
            : "repeat(4, minmax(0, 1fr))",
          gridTemplateRows: isPortrait ? undefined : "repeat(3, minmax(0, 1fr))",
          gap: "0.5rem",
          height: isPortrait ? "auto" : "100%",
          alignContent: "stretch",
          alignItems: "stretch",
        }}
      >
      {monthly.map((m, idx) => {
        const isSelected = selectedMonthForChart === idx;
        const series = monthlySeries[idx] ?? {
          labels,
          counts,
          avgSpeeds,
          maxCount: Math.max(1, ...counts),
        };
        const isHovered = monthlyHover === idx;
        const bg = isSelected
          ? "rgba(30,64,175,0.95)"
          : isHovered
          ? "rgba(30,41,59,0.98)"
          : "rgba(15,23,42,0.98)";
        return (
        <div
          key={`${m.year}-${m.month}-${idx}`}
           onClick={() =>
             setSelectedMonthForChart((prev) => (prev === idx ? null : idx))
           }
           onMouseEnter={() => setMonthlyHover(idx)}
           onMouseLeave={() => setMonthlyHover(null)}

          style={{
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.45)",
            background: bg,
            padding: "0.35rem 0.35rem 0.4rem",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minHeight: isPortrait ? undefined : 0,
            overflow: isPortrait ? "visible" : "hidden",
            cursor: "pointer",
            transition: "background 150ms ease, box-shadow 150ms ease",
            zIndex: isSelected ? 2 : 1,
            boxShadow:
              isSelected
                ? "0 6px 18px rgba(15,23,42,0.8)"
                : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11,
              color: "#e5e7eb",
              marginBottom: 2,
            }}
          >
            <span>
              {isPortrait
                ? monthNames[m.month - 1]
                : `${monthNames[m.month - 1]} ${m.year}`}
            </span>
            <span style={{ color: "#9ca3af" }}>{m.count}h</span>
          </div>
          <div
            style={{
              flex: isPortrait ? undefined : 1,
              minHeight: isPortrait ? undefined : 0,
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                flex: isPortrait ? undefined : 1,
                minHeight: isPortrait ? undefined : 0,
                width: "100%",
                paddingBottom: isPortrait ? "100%" : undefined,
              }}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`${center - miniHalf} ${center - miniHalf} ${miniHalf * 2} ${miniHalf * 2}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0 }}
              >
              <circle
                cx={center}
                cy={center}
                r={RADIUS + 4}
                fill="rgba(15,23,42,0.95)"
                stroke="rgba(148,163,184,0.45)"
                strokeWidth={0.8}
              />
              <circle
                cx={center}
                cy={center}
                r={INNER_RADIUS}
                fill="rgba(15,23,42,0.9)"
                stroke="rgba(148,163,184,0.4)"
                strokeWidth={0.7}
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
                    strokeWidth={0.6}
                    strokeDasharray="2 4"
                  />
                );
              })}
              {series.labels.map((label, i) => {
                const value = series.counts[i];
                const frac = value / Math.max(1, m.count) / globalMaxFrac;
                const outerR = INNER_RADIUS + frac * (RADIUS - INNER_RADIUS);
                const avgSpeed = series.avgSpeeds[i] ?? 0;
                const fillColor = colorForSpeed(avgSpeed);

                const count = series.labels.length;
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
                const labelR = RADIUS + 10;
                const lx = center + labelR * Math.cos(midAngle);
                const ly = center + labelR * Math.sin(midAngle);

                return (
                  <g
                    key={label}
                    onMouseEnter={() => setScaleSpeed(avgSpeed)}
                    onMouseLeave={() => setScaleSpeed(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <path d={d} fill={fillColor} />
                    <text
                      x={lx}
                      y={ly}
                      fontSize={7}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fill="#e5e7eb"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
              </svg>
            </div>
          </div>
        </div>
       );
       })}

    </div>
    </div>
    </div>
    {showMap && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(2,6,23,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 960,
            height: "75vh",
            background: "rgba(15,23,42,0.98)",
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.5)",
            padding: "1rem",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={() => setShowMap(false)}
            style={{
              position: "absolute",
              top: -12,
              right: -12,
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.6)",
              background: "rgba(15,23,42,0.98)",
              color: "#e5e7eb",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              zIndex: 1001,
            }}
          >
            ×
          </button>
          <style>{`
            .ww-popup .leaflet-popup-content-wrapper {
              background: rgba(15,23,42,0.98);
              color: #e5e7eb;
              border: 1px solid rgba(148,163,184,0.5);
              border-radius: 10px;
            }
            .ww-popup .leaflet-popup-tip {
              background: rgba(15,23,42,0.98);
            }
            .ww-popup .leaflet-popup-content {
              margin: 8px 10px;
            }
            .leaflet-container,
            .leaflet-container.leaflet-grab,
            .leaflet-container.leaflet-dragging .leaflet-grab,
            .leaflet-dragging .leaflet-container {
              cursor: default !important;
            }
          `}</style>
          <div style={{ position: "relative", zIndex: 1002 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                placeholder="Search a place (e.g. Paris, Montpellier)"
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  padding: "0.5rem 0.9rem",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.6)",
                  background: "rgba(15,23,42,0.95)",
                  color: "#e5e7eb",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              {searchLoading && (
                <span style={{ alignSelf: "center", fontSize: 12, color: "#9ca3af" }}>
                  Searching…
                </span>
              )}
            </div>
            {searchResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 1003,
                  background: "rgba(15,23,42,0.99)",
                  border: "1px solid rgba(148,163,184,0.5)",
                  borderRadius: 10,
                  maxHeight: 220,
                  overflowY: "auto",
                  boxShadow: "0 12px 30px rgba(15,23,42,0.9)",
                }}
              >
                {searchResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => selectSearchResult(r)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "7px 10px",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(148,163,184,0.2)",
                      color: "#e5e7eb",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            ref={mapContainerRef}
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              borderRadius: 10,
              overflow: "hidden",
            }}
          />
        </div>
      </div>
    )}
    </div>
  );
}

export default App; 
