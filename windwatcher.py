#!/usr/bin/env python3
import datetime as dt
import math
import sys
import json
import os
from typing import Tuple, List

import requests
import matplotlib.pyplot as plt


def fetch_wind_data(
    latitude: float,
    longitude: float,
    days: int = 365,
) -> Tuple[List[float], List[float]]:
    today = dt.date.today()
    start_date = today - dt.timedelta(days=days)

    key = f"{latitude:.5f}_{longitude:.5f}"
    cache_path = os.path.join(os.path.dirname(__file__), "wind_data_cache.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            cached_root = json.load(f)
        cached = cached_root.get(key, {}) if isinstance(cached_root, dict) else {}
        hourly = cached.get("hourly", {})
        speeds = hourly.get("wind_speed_10m", [])
        directions = hourly.get("wind_direction_10m", [])
        if speeds and directions and len(speeds) == len(directions):
            return speeds, directions

    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": today.isoformat(),
        "hourly": "wind_speed_10m,wind_direction_10m",
        "timezone": "UTC",
    }

    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    to_store = {}
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            try:
                existing = json.load(f)
                if isinstance(existing, dict):
                    to_store = existing
            except Exception:
                to_store = {}
    to_store[key] = data
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(to_store, f)

    hourly = data.get("hourly", {})
    speeds = hourly.get("wind_speed_10m", [])
    directions = hourly.get("wind_direction_10m", [])

    if not speeds or not directions or len(speeds) != len(directions):
        raise RuntimeError("Unexpected wind data format from API")

    return speeds, directions


def degree_to_compass(deg: float, high_precision: bool = False) -> str:
    if high_precision:
        directions = [
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
        ]
        idx = int((deg % 360) / 22.5 + 0.5) % 16
        return directions[idx]
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = int((deg % 360) / 45.0 + 0.5) % 8
    return directions[idx]


def plot_wind_direction_hist(directions_deg: List[float], high_precision: bool = False) -> None:
    compass_dirs = [degree_to_compass(d, high_precision=high_precision) for d in directions_deg]

    order = (
        ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        if not high_precision
        else [
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
        ]
    )
    counts = {d: 0 for d in order}
    for d in compass_dirs:
        counts[d] += 1

    values = [counts[d] for d in order]

    plt.ion()
    fig, ax = plt.subplots(figsize=(10, 4))
    bars = ax.bar(order, values, color="skyblue", edgecolor="black")
    ax.set_xlabel("Wind direction")
    ax.set_ylabel("Frequency (hours)")
    title = ax.set_title(
        "Wind direction distribution (last 365 days)"
        + (" - high precision" if high_precision else "")
    )
    plt.tight_layout()

    ax_toggle = plt.axes([0.8, 0.9, 0.15, 0.05])
    from matplotlib.widgets import CheckButtons

    check = CheckButtons(ax_toggle, ["High precision"], [high_precision])

    def update(label):
        nonlocal high_precision
        high_precision = not high_precision
        new_compass_dirs = [degree_to_compass(d, high_precision=high_precision) for d in directions_deg]
        new_order = (
            ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
            if not high_precision
            else [
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
            ]
        )
        new_counts = {d: 0 for d in new_order}
        for d in new_compass_dirs:
            new_counts[d] += 1
        new_values = [new_counts[d] for d in new_order]
        ax.clear()
        ax.bar(new_order, new_values, color="skyblue", edgecolor="black")
        ax.set_xlabel("Wind direction")
        ax.set_ylabel("Frequency (hours)")
        title_text = "Wind direction distribution (last 365 days)" + (" - high precision" if high_precision else "")
        ax.set_title(title_text)
        plt.draw()

    check.on_clicked(update)

    plt.show(block=True)


def main():
    if len(sys.argv) != 1:
        print("Usage: python windwatcher.py")
        sys.exit(1)

    lat = 43.95998
    lon = 4.81797

    high_precision = False

    speeds, directions = fetch_wind_data(lat, lon)
    plot_wind_direction_hist(directions, high_precision=high_precision)


if __name__ == "__main__":
    main()
