/**
 * Set API base BEFORE js/api.js loads.
 * Live Server / other static hosts don't have POST /forgot-password — only Express does (port 5000).
 *
 * Rules:
 * - If you already set window.__API_BASE__, we leave it alone.
 * - If this page is served by Express on port 5000, API is same origin (leave unset).
 * - Otherwise on localhost / LAN, point at the machine's Express on :5000.
 */
(function (w) {
  if (typeof w === "undefined" || !w.location) return;
  if (typeof w.__API_BASE__ === "string" && w.__API_BASE__.trim().length > 0) return;

  var loc = w.location;
  if (loc.protocol === "file:") {
    w.__API_BASE__ = "http://127.0.0.1:5000";
    return;
  }

  var port = loc.port;
  // Express default in backend/server.js — UI + API same server
  if (port === "5000") return;

  var host = loc.hostname;
  var loopback =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  var lan =
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);

  if (loopback) {
    w.__API_BASE__ = "http://127.0.0.1:5000";
    return;
  }
  if (lan) {
    w.__API_BASE__ = "http://" + host + ":5000";
  }
})(typeof window !== "undefined" ? window : undefined);
