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

type Lang = "en" | "fr";

const STRINGS = {
  en: {
    title: "Wind rose for",
    description:
      "A wind rose summarizing hourly wind measurements for the selected year. Each wedge points to the direction the wind blows from and its length shows how often that direction occurs — longer means more frequent. Color shows the average wind speed for that direction, from green (calm) to red (strong).",
    readMore: "Read more",
    readLess: "Read less",
    currentCoords: "Current coordinates:",
    map: "Map",
    load: "Load",
    precision: (n: number) => `${n}-point precision`,
    speedScaleLabel: (v: string) => `Speed Scale: ${v}`,
    absolute: "Absolute",
    relative: "Relative",
    valuesLabel: (v: string) => `Values: ${v}`,
    average: "Average",
    median: "Median",
    max: "Max",
    dataLabel: (v: string) => `Data: ${v}`,
    wind: "Wind",
    gusts: "Gusts",
    tipPrecision: "Group wind directions into 8 or 16 compass sectors.",
    tipScale:
      "Absolute uses a fixed km/h range; Relative scales colours to the strongest month.",
    tipValues:
      "How each sector's speed is summarised: average, median, or maximum.",
    tipData: "Plot mean wind speed or wind gusts.",
    last365: "Last 365 days",
    noSector: "No sector selected",
    frequency: "Frequency",
    averageSpeedLabel: "Average wind speed",
    medianSpeedLabel: "Median wind speed",
    maxAt: "Max on",
    searchPlaceholder: "Search a place (e.g. Paris, Montpellier)",
    searching: "Searching…",
    cancel: "Cancel",
    loading: "Loading...",
    errorLabel: "Error",
    errInvalidFormat: "Please enter coordinates as 'lat, lon'",
    errInvalidValues: "Invalid latitude/longitude values",
    errFetch: "Failed to fetch data from Open-Meteo",
    errUnknown: "Unknown error",
    errYearRange: (max: number) => `Year must be between 1940 and ${max}`,
    months: [
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
    ],
    directions: {
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
    } as Record<string, string>,
  },
  fr: {
    title: "Rose des vents pour",
    description:
      "Une rose des vents résumant les mesures horaires du vent pour l'année sélectionnée. Chaque secteur pointe la direction d'où vient le vent et sa longueur indique sa fréquence — plus le secteur est long, plus le vent souffle souvent de cette direction. La couleur représente la vitesse moyenne du vent pour cette direction, du vert (calme) au rouge (fort).",
    readMore: "Lire plus",
    readLess: "Lire moins",
    currentCoords: "Coordonnées actuelles :",
    map: "Carte",
    load: "Charger",
    precision: (n: number) => `Précision : ${n} points`,
    speedScaleLabel: (v: string) => `Échelle : ${v}`,
    absolute: "Absolue",
    relative: "Relative",
    valuesLabel: (v: string) => `Valeurs : ${v}`,
    average: "Moyenne",
    median: "Médiane",
    max: "Max",
    dataLabel: (v: string) => `Données : ${v}`,
    wind: "Vent",
    gusts: "Rafales",
    tipPrecision: "Regrouper les directions du vent en 8 ou 16 secteurs.",
    tipScale:
      "Absolue utilise une plage fixe en km/h ; Relative adapte les couleurs au mois le plus fort.",
    tipValues:
      "Comment la vitesse de chaque secteur est résumée : moyenne, médiane ou maximum.",
    tipData: "Afficher la vitesse moyenne du vent ou les rafales.",
    last365: "365 derniers jours",
    noSector: "Aucun secteur sélectionné",
    frequency: "Fréquence",
    averageSpeedLabel: "Vitesse moyenne",
    medianSpeedLabel: "Vitesse médiane",
    maxAt: "Maximum le",
    searchPlaceholder: "Rechercher un lieu (ex. Paris, Montpellier)",
    searching: "Recherche…",
    cancel: "Annuler",
    loading: "Chargement...",
    errorLabel: "Erreur",
    errInvalidFormat: "Veuillez saisir les coordonnées sous la forme « lat, lon »",
    errInvalidValues: "Valeurs de latitude/longitude invalides",
    errFetch: "Échec de la récupération des données depuis Open-Meteo",
    errUnknown: "Erreur inconnue",
    errYearRange: (max: number) => `L'année doit être comprise entre 1940 et ${max}`,
    months: [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ],
    directions: {
      N: "Nord",
      NNE: "Nord-nord-est",
      NE: "Nord-est",
      ENE: "Est-nord-est",
      E: "Est",
      ESE: "Est-sud-est",
      SE: "Sud-est",
      SSE: "Sud-sud-est",
      S: "Sud",
      SSW: "Sud-sud-ouest",
      SW: "Sud-ouest",
      WSW: "Ouest-sud-ouest",
      W: "Ouest",
      WNW: "Ouest-nord-ouest",
      NW: "Nord-ouest",
      NNW: "Nord-nord-ouest",
    } as Record<string, string>,
  },
};

const formatDateTime = (iso: string, lang: Lang) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  const d = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5])
    )
  );
  const navLang =
    typeof navigator !== "undefined"
      ? (navigator.language || "").toLowerCase()
      : "";
  const isUS = lang === "en" && navLang.startsWith("en-us");
  const locale = isUS ? "en-US" : lang === "fr" ? "fr-FR" : "en-GB";
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
};

const MIN_YEAR = 1940;

const clampYear = (value: number, maxYear: number) =>
  Math.min(Math.max(value, MIN_YEAR), maxYear);

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
  const lang: Lang = useMemo(() => {
    if (typeof navigator !== "undefined") {
      if ((navigator.language || "").toLowerCase().startsWith("fr")) return "fr";
    }
    return "en";
  }, []);
  const t = STRINGS[lang];

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const [data, setData] = useState<WindResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highPrecision, setHighPrecision] = useState(false);
  const [coordsInput, setCoordsInput] = useState("43.95998, 4.81797");
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 43.95998, lon:  4.81797});
  const currentYear = new Date().getFullYear();
  const [yearInput, setYearInput] = useState(String(currentYear));
  const [year, setYear] = useState(currentYear);

  const loadForCoords = async (lat: number, lon: number, y: number) => {
    setLoading(true);
    setError(null);
    setCoords({ lat, lon });
    setYear(y);
    setYearInput(String(y));
    const key = `${y}_${lat.toFixed(5)}_${lon.toFixed(5)}`;
    const canUseLS =
      typeof window !== "undefined" && typeof window.localStorage !== "undefined";
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
    const cacheKey = "localwind:v4:" + key;
    let stale: WindResponse | null = null;
    try {
      if (canUseLS) {
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as {
              savedAt?: number;
              data?: WindResponse;
            };
            if (parsed && parsed.data) {
              stale = parsed.data;
              if (
                typeof parsed.savedAt === "number" &&
                Date.now() - parsed.savedAt < CACHE_MAX_AGE
              ) {
                setData(parsed.data);
                setLoading(false);
                return;
              }
            }
          } catch {
          }
        }
        if (!stale) {
          const coordKey = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
          const legacyKeys = ["localwind:v3:" + key];
          if (y === currentYear) legacyKeys.push("localwind:v2:" + coordKey);
          for (const lk of legacyKeys) {
            const legacyRaw = window.localStorage.getItem(lk);
            if (!legacyRaw) continue;
            try {
              const legacyParsed = JSON.parse(legacyRaw) as
                | { data?: WindResponse }
                | WindResponse;
              const legacyData =
                (legacyParsed as { data?: WindResponse }).data ??
                (legacyParsed as WindResponse);
              if (legacyData && legacyData.hourly) {
                stale = legacyData;
                break;
              }
            } catch {
            }
          }
        }
      }
      const now = new Date();
      let start: string;
      let end: string;
      if (y === currentYear) {
        end = now.toISOString().slice(0, 10);
        const startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        start = startDate.toISOString().slice(0, 10);
      } else {
        start = `${y}-01-01`;
        end = `${y}-12-31`;
      }

      const url = new URL("https://archive-api.open-meteo.com/v1/archive");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("start_date", start);
      url.searchParams.set("end_date", end);
      url.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m,wind_gusts_10m");
      url.searchParams.set("timezone", "UTC");

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000);
      let json: WindResponse;
      try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error(t.errFetch);
        json = (await res.json()) as WindResponse;
      } finally {
        window.clearTimeout(timeoutId);
      }
      setData(json);

      if (canUseLS) {
        try {
          window.localStorage.setItem(
            cacheKey,
            JSON.stringify({ savedAt: Date.now(), data: json })
          );
        } catch {
        }
      }
    } catch (e: any) {
      if (stale) {
        setData(stale);
      } else {
        setError(e?.message ?? t.errUnknown);
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  };

   useEffect(() => {
     loadForCoords(43.95998, 4.81797, currentYear);
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
   const [tileHover, setTileHover] = useState<{
     series: number;
     dir: number;
   } | null>(null);
   const [centerHover, setCenterHover] = useState<{
     scope: "main" | number;
   } | null>(null);
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

     const placePin = (
       lat: number,
       lng: number,
       zoom?: number,
       withPopup = true
     ) => {
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

       if (!withPopup) return;

       const content = document.createElement("div");
       content.style.cssText =
         "display:flex;flex-direction:column;gap:6px;min-width:160px;color:#e5e7eb;";
       const label = document.createElement("div");
       label.style.cssText = "font-size:11px;color:#93c5fd;";
       label.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
       const row = document.createElement("div");
       row.style.cssText = "display:flex;gap:6px;justify-content:flex-end;";
       const cancelBtn = document.createElement("button");
       cancelBtn.textContent = t.cancel;
       cancelBtn.style.cssText =
         "padding:4px 10px;border-radius:999px;border:1px solid rgba(148,163,184,0.6);background:rgba(15,23,42,0.95);color:#e5e7eb;font-size:12px;cursor:pointer;";
       const loadBtn = document.createElement("button");
       loadBtn.textContent = t.load;
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
         const parsedYear = Number(yearInput);
         setCoordsInput(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
         loadForCoords(
           lat,
           lng,
           isFinite(parsedYear)
             ? clampYear(parsedYear, currentYear)
             : currentYear
         );
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

     if (isFinite(coords.lat) && isFinite(coords.lon)) {
       placePin(coords.lat, coords.lon, undefined, false);
     }

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
           "accept-language": lang,
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


   const {
    labels,
    counts,
    avgSpeeds,
    maxTimes,
    overallSpeed,
    monthly,
    monthlySeries,
    globalMaxFrac,
  } = useMemo(() => {
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
       maxTimes: (string | null)[];
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

     const maxTimeFor = (speeds_: number[], times_: string[]) => {
       if (!speeds_.length) return null;
       let best = 0;
       for (let i = 1; i < speeds_.length; i++) {
         if (speeds_[i] > speeds_[best]) best = i;
       }
       return times_[best] ?? null;
     };
 
     if (times.length && speeds.length && dirs.length) {
       const buckets: Record<
         string,
          {
            count: number;
            speedsAll: number[];
            dirCounts: Record<string, number>;
            dirSpeeds: Record<string, number[]>;
            dirTimes: Record<string, string[]>;
          }
        > = {};
 
        times.forEach((iso, idx) => {
          const match = /^(\d{4})-(\d{2})/.exec(iso);
          if (!match) return;
          const key = `${match[1]}-${match[2]}`;
          if (!buckets[key]) {
            buckets[key] = {
              count: 0,
              speedsAll: [],
              dirCounts: {},
              dirSpeeds: {},
              dirTimes: {},
            };
          }
          const speed = speeds[idx] ?? 0;
          const dirLabel = degreeToCompass(dirs[idx] ?? 0, highPrecision);
          buckets[key].count += 1;
          buckets[key].speedsAll.push(speed);
          buckets[key].dirCounts[dirLabel] = (buckets[key].dirCounts[dirLabel] ?? 0) + 1;
          (buckets[key].dirSpeeds[dirLabel] ??= []).push(speed);
          (buckets[key].dirTimes[dirLabel] ??= []).push(iso);
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
         const mMaxTimes = labelsArr.map((label) =>
           maxTimeFor(
             bucket.dirSpeeds[label] ?? [],
             bucket.dirTimes[label] ?? []
           )
         );
         const mMaxCount = Math.max(1, ...mCounts);
         monthlySeries.push({
           labels: labelsArr.slice(),
           counts: mCounts,
           avgSpeeds: mAvgSpeeds,
           maxCount: mMaxCount,
           maxTimes: mMaxTimes,
         });
       });

       monthly.reverse();
       monthlySeries.reverse();
     }


    const timesMap: Record<string, string[]> = {};
    labelsArr.forEach((d) => {
      countsMap[d] = 0;
      speedsMap[d] = [];
      timesMap[d] = [];
    });

    dirs.forEach((deg, idx) => {
      const k = degreeToCompass(deg, highPrecision);
      const speed = speeds[idx] ?? 0;
      countsMap[k] = (countsMap[k] ?? 0) + 1;
      (speedsMap[k] ??= []).push(speed);
      (timesMap[k] ??= []).push(times[idx] ?? "");
    });

    const countsArr = labelsArr.map((d) => countsMap[d] ?? 0);
    const avgSpeedsArr = labelsArr.map((d) => statFor(speedsMap[d] ?? []));
    const maxTimesArr = labelsArr.map((d) =>
      maxTimeFor(speedsMap[d] ?? [], timesMap[d] ?? [])
    );
    const overallSpeed = statFor(speeds);

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
      maxTimes: maxTimesArr,
      overallSpeed,
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
         {t.loading}
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
         {t.errorLabel}: {error}
       </div>
     );


  const activeIndex =
    hoverIndex != null ? hoverIndex : selectedIndex != null ? selectedIndex : null;

  const dataset =
    selectedMonthForChart != null && monthlySeries[selectedMonthForChart]
      ? monthlySeries[selectedMonthForChart]
      : {
          labels,
          counts,
          avgSpeeds,
          maxTimes,
          maxCount: Math.max(1, ...counts),
        };

  const chartLabels = dataset.labels;
  const chartCounts = dataset.counts;
  const chartAvgSpeeds = dataset.avgSpeeds;
  const chartMaxTimes = dataset.maxTimes;
  const maxCount = dataset.maxCount;

  const selectedSpeed =
    selectedIndex != null &&
    selectedIndex >= 0 &&
    selectedIndex < chartAvgSpeeds.length
      ? chartAvgSpeeds[selectedIndex]
      : null;
  const displayedScaleSpeed =
    scaleSpeed != null ? scaleSpeed : selectedSpeed;

  const monthNames = t.months;
  const selectedMonth =
    selectedMonthForChart != null ? monthly[selectedMonthForChart] : null;
  const chartTitle = selectedMonth
    ? `${monthNames[selectedMonth.month - 1]} ${selectedMonth.year}`
    : String(year);
  const chartTotalCount = selectedMonth
    ? selectedMonth.count
    : data?.hourly?.time?.length ?? 0;

  const tileSeries =
    tileHover != null ? monthlySeries[tileHover.series] ?? null : null;
  const tileMonth = tileHover != null ? monthly[tileHover.series] ?? null : null;
  const tipLabels = tileSeries ? tileSeries.labels : chartLabels;
  const tipCounts = tileSeries ? tileSeries.counts : chartCounts;
  const tipMaxTimes = tileSeries ? tileSeries.maxTimes : chartMaxTimes;
  const tipIndex = tileHover ? tileHover.dir : activeIndex;
  const tipTotal = tileMonth ? tileMonth.count : chartTotalCount;
  const tipTitle = tileMonth
    ? `${monthNames[tileMonth.month - 1]} ${tileMonth.year}`
    : chartTitle;
  const tipLabel =
    tipIndex != null && tipIndex >= 0 && tipIndex < tipLabels.length
      ? tipLabels[tipIndex]
      : null;

  const discEnabled = metric !== "max" && !useGusts;
  const centerSpeed =
    centerHover == null
      ? null
      : centerHover.scope === "main"
      ? overallSpeed
      : monthly[centerHover.scope]?.avgSpeed ?? 0;
  const centerTitle =
    centerHover != null &&
    typeof centerHover.scope === "number" &&
    monthly[centerHover.scope]
      ? `${monthNames[monthly[centerHover.scope].month - 1]} ${
          monthly[centerHover.scope].year
        }`
      : chartTitle;
  const centerLabel =
    metric === "median" ? t.medianSpeedLabel : t.averageSpeedLabel;
  const centerActive = centerHover != null && centerSpeed != null;
  const infoIndex = centerActive ? null : tipIndex;

  const parsedCoordsInput = coordsInput
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  const coordsDirty =
    parsedCoordsInput.length < 2 ||
    !isFinite(parsedCoordsInput[0]) ||
    !isFinite(parsedCoordsInput[1]) ||
    Math.abs(parsedCoordsInput[0] - coords.lat) > 1e-6 ||
    Math.abs(parsedCoordsInput[1] - coords.lon) > 1e-6;
  const loadDirty = coordsDirty || Number(yearInput) !== year;

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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minHeight: 0 }}>
          <div>
            <h1
              style={{
                marginTop: 0,
                marginBottom: 4,
                fontSize: "clamp(15px, 4.6vw, 26px)",
                fontWeight: 600,
                letterSpacing: 0.02,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.title}{" "}
              <input
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                inputMode="numeric"
                aria-label="year"
                style={{
                  width: "3.4em",
                  boxSizing: "border-box",
                  fontSize: "inherit",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  background: "linear-gradient(to right, #22d3ee, #818cf8)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  caretColor: "#38bdf8",
                  border: "1px dashed rgba(148,163,184,0.7)",
                  borderRadius: 6,
                  padding: "0 0.2em",
                  textAlign: "center",
                  outline: "none",
                }}
              />
            </h1>
            <p
              onClick={
                isPortrait
                  ? () => setShowFullDescription((v) => !v)
                  : undefined
              }
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: "#9ca3af",
                cursor: isPortrait ? "pointer" : "default",
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
              {t.description}
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
                {showFullDescription ? t.readLess : t.readMore}
              </button>
            )}
          </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                {t.currentCoords} {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
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
                  {t.map}
                </button>
                <button
                  onClick={() => {
                    const parts = coordsInput.split(/[,\s]+/).filter(Boolean);
                    if (parts.length < 2) {
                      setError(t.errInvalidFormat);
                      return;
                    }
                    const lat = Number(parts[0]);
                    const lon = Number(parts[1]);
                    if (!isFinite(lat) || !isFinite(lon)) {
                      setError(t.errInvalidValues);
                      return;
                    }
                    const parsedYear = Number(yearInput);
                    if (
                      !isFinite(parsedYear) ||
                      parsedYear < MIN_YEAR ||
                      parsedYear > currentYear
                    ) {
                      setError(t.errYearRange(currentYear));
                      return;
                    }
                    loadForCoords(lat, lon, parsedYear);
                  }}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: 999,
                    border: loadDirty
                      ? "1px solid rgba(129,140,248,0.9)"
                      : "1px solid rgba(148,163,184,0.5)",
                    background: loadDirty
                      ? "linear-gradient(to right, rgba(59,130,246,0.95), rgba(129,140,248,0.98))"
                      : "rgba(15,23,42,0.8)",
                    color: loadDirty ? "white" : "#e5e7eb",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.load}
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

              <Tooltip text={t.tipPrecision} portrait={isPortrait}>
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
                {t.precision(highPrecision ? 16 : 8)}
              </span>
            </label>
            </Tooltip>

            <Tooltip text={t.tipScale} portrait={isPortrait}>
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
              {t.speedScaleLabel(relativeSpeed ? t.relative : t.absolute)}
            </button>
            </Tooltip>

            <Tooltip text={t.tipValues} portrait={isPortrait}>
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
              {t.valuesLabel(
                metric === "average"
                  ? t.average
                  : metric === "median"
                  ? t.median
                  : t.max
              )}
            </button>
            </Tooltip>

            <Tooltip text={t.tipData} portrait={isPortrait}>
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
              {t.dataLabel(useGusts ? t.gusts : t.wind)}
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
                flex: 1,
                minHeight: 0,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
               <svg
                 width="100%"
                 height="100%"
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
                metric === "max"
                  ? value > 0
                    ? 1
                    : 0
                  : value / Math.max(1, chartTotalCount) / globalMaxFrac;
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

            {discEnabled && (
              <circle
                cx={center}
                cy={center}
                r={16}
                fill={colorForSpeed(overallSpeed)}
                stroke={centerHover?.scope === "main" ? "#f9fafb" : "#020617"}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => {
                  setScaleSpeed(overallSpeed);
                  setCenterHover({ scope: "main" });
                }}
                onMouseLeave={() => {
                  setScaleSpeed(null);
                  setCenterHover(null);
                }}
              />
            )}
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
              {centerActive ? centerTitle : tipTitle}
            </div>
            <div style={{ fontWeight: 600 }}>
              {centerActive
                ? centerLabel
                : tipLabel
                ? t.directions[tipLabel] ?? tipLabel
                : t.noSector}
            </div>
            <div style={{ color: "#9ca3af" }}>
              {metric === "max" ? (
                <>
                  {t.maxAt}{" "}
                  <strong>
                    {infoIndex != null && tipMaxTimes[infoIndex]
                      ? formatDateTime(tipMaxTimes[infoIndex]!, lang)
                      : "–"}
                  </strong>
                </>
              ) : (
                <>
                  {t.frequency}{" "}
                  <strong>
                    {infoIndex != null &&
                    infoIndex >= 0 &&
                    infoIndex < tipCounts.length
                      ? `${tipCounts[infoIndex]}h`
                      : "–"}
                  </strong>
                  {infoIndex != null &&
                    infoIndex >= 0 &&
                    infoIndex < tipCounts.length &&
                    tipTotal > 0 && (
                      <span>
                        {" "}(
                        {((tipCounts[infoIndex] / tipTotal) * 100).toFixed(1)}%)
                      </span>
                    )}
                </>
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
                const frac =
                  metric === "max"
                    ? value > 0
                      ? 1
                      : 0
                    : value / Math.max(1, m.count) / globalMaxFrac;
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
                    onMouseEnter={() => {
                      setScaleSpeed(avgSpeed);
                      setTileHover({ series: idx, dir: i });
                    }}
                    onMouseLeave={() => {
                      setScaleSpeed(null);
                      setTileHover(null);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <path
                      d={d}
                      fill={fillColor}
                      stroke={
                        tileHover &&
                        tileHover.series === idx &&
                        tileHover.dir === i
                          ? "#f9fafb"
                          : "#020617"
                      }
                      strokeWidth={
                        tileHover &&
                        tileHover.series === idx &&
                        tileHover.dir === i
                          ? 1
                          : 0.4
                      }
                    />
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
              {discEnabled && (
                <circle
                  cx={center}
                  cy={center}
                  r={15}
                  fill={colorForSpeed(m.avgSpeed)}
                  stroke={centerHover?.scope === idx ? "#f9fafb" : "#020617"}
                  strokeWidth={centerHover?.scope === idx ? 1 : 0.8}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => {
                    setScaleSpeed(m.avgSpeed);
                    setCenterHover({ scope: idx });
                  }}
                  onMouseLeave={() => {
                    setScaleSpeed(null);
                    setCenterHover(null);
                  }}
                />
              )}
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
                placeholder={t.searchPlaceholder}
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
                  {t.searching}
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
