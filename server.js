const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const cachePath = path.join(__dirname, "wind_data_cache.json");

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);
  if (parsed.pathname === "/api/wind") {
    if (!fs.existsSync(cachePath)) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Cache file not found. Run windwatcher.py first." }));
      return;
    }
    try {
      const raw = fs.readFileSync(cachePath, "utf-8");
      const json = JSON.parse(raw);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(json));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Failed to read cache", message: String(e) }));
    }
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain");
  res.end("Not found");
});

server.listen(8000, () => {
  console.log("Wind cache server listening on http://localhost:8000");
});
