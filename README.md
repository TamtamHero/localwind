# LocalWind

LocalWind is a small web app that turns a year of hourly weather observations
into an easy-to-read **wind rose**. Give it a pair of coordinates (or pick a spot
on the map) and it shows how the wind behaves at that place over the last 365
days: where it comes from, how often, and how strong it typically is.

## What it shows

- **Direction & frequency** — each wedge of the rose points to the direction the
  wind blows from. The longer the wedge, the more often the wind came from that
  direction.
- **Speed by colour** — a colour gradient from green (calm) to red (strong)
  encodes the wind speed in that direction.
- **Monthly breakdown** — the panel on the right shows a mini wind rose for each
  of the last 12 months. Click one to redraw the main chart for that month alone.
- **Details on demand** — hover a wedge to read its exact frequency and speed;
  click to pin the values. The scale inside the info box marks where that speed
  sits.

## Controls

| Control | What it does |
| --- | --- |
| **8 / 16-point precision** | Switch between 8 and 16 compass sectors. |
| **Speed Scale: Absolute / Relative** | Absolute uses a fixed km/h range; relative normalises colours against the strongest month. |
| **Values: Average / Median / Max** | Choose which statistic describes the speed in each sector. |
| **Data: Wind / Gusts** | Show mean wind speed or wind gusts (`wind_gusts_10m`). |
| **Map** | Open a world map to pick a location, with a place search powered by OpenStreetMap Nominatim. |

## Data & caching

Weather data comes from the
[Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
(`wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, hourly, UTC). Results
are cached in the browser's `localStorage` per coordinate and automatically
discarded once they are more than 24 hours old.

Map tiles are served by OpenStreetMap, and the map's place search uses the
public Nominatim geocoder.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Tech

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Leaflet](https://leafletjs.com/) for the map
- Open-Meteo, OpenStreetMap and Nominatim for data

## License

This project is free software, released under the **GNU General Public
License, version 3** (or later). See [LICENSE](LICENSE) for the full text.
