/**
 * Saras API — fetch helpers for signup, login, bills.
 *
 * API base URL:
 * - Set window.__API_BASE__ (e.g. "https://api.example.com") before this script to override.
 * - If you open HTML via Live Server (port 5500) or another static server, requests default to
 *   http://localhost:5000 where Express runs (see backend/server.js).
 * - If you open the app at http://localhost:5000/... (Express serving the UI), same-origin "" is used.
 */
(function (global) {
  /**
   * Resolve where /signup, /forgot-password, etc. live.
   * Wrong host = "Cannot POST /forgot-password" from the static server (it has no API routes).
   */
  function resolveApiBase() {
    if (
      typeof global.__API_BASE__ !== "undefined" &&
      global.__API_BASE__ !== null &&
      String(global.__API_BASE__).trim().length > 0
    ) {
      return String(global.__API_BASE__).trim().replace(/\/$/, "");
    }
    if (typeof window === "undefined" || !window.location) {
      return "";
    }
    var loc = window.location;
    var port = loc.port;

    if (loc.protocol === "file:") {
      return "http://127.0.0.1:5000";
    }

    // Express serves UI + API on the same port (backend default PORT=5000).
    if (port === "5000") {
      return "";
    }

    // Port omitted on http://localhost → often 80; static server has no API routes.
    var host = loc.hostname;
    var loopback =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    var lan =
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^10\.\d+\.\d+\.\d+$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);

    if (loopback) {
      return "http://127.0.0.1:5000";
    }
    if (lan) {
      return "http://" + host + ":5000";
    }

    return "";
  }

  var API_BASE = resolveApiBase();

  var STORAGE = {
    USER_ID: "sarasUserId",
    USERNAME: "sarasUsername",
    TOKEN: "sarasToken",
  };

  function getToken() {
    return localStorage.getItem(STORAGE.TOKEN);
  }

  function getUserId() {
    return localStorage.getItem(STORAGE.USER_ID);
  }

  function getUsername() {
    return localStorage.getItem(STORAGE.USERNAME) || "";
  }

  function isLoggedIn() {
    return !!getToken() && !!getUserId();
  }

  /** Save session after successful signup or login (userId + JWT token). */
  function setSession(data) {
    if (data.userId) localStorage.setItem(STORAGE.USER_ID, data.userId);
    if (data.username !== undefined)
      localStorage.setItem(STORAGE.USERNAME, data.username);
    if (data.token) localStorage.setItem(STORAGE.TOKEN, data.token);
  }

  function clearSession() {
    localStorage.removeItem(STORAGE.USER_ID);
    localStorage.removeItem(STORAGE.USERNAME);
    localStorage.removeItem(STORAGE.TOKEN);
  }

  function authHeaders() {
    var t = getToken();
    var h = { "Content-Type": "application/json" };
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  /** Parse JSON and throw a clear Error if the response is not OK. */
  async function handleResponse(res) {
    var text = await res.text();
    var data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { message: text || "Invalid response from server" };
    }
    if (!res.ok) {
      var err = new Error(data.message || res.statusText || "Request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function postSignup(username, email, password) {
    var res = await fetch(API_BASE + "/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password,
      }),
    });
    var data = await handleResponse(res);
    setSession(data);
    return data;
  }

  /** Request a 6-digit OTP by email (response never contains the OTP). */
  async function postForgotPassword(usernameOrEmail) {
    var res = await fetch(API_BASE + "/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail: usernameOrEmail }),
    });
    return handleResponse(res);
  }

  /** Submit OTP + new password after forgot-password. */
  async function postResetPassword(usernameOrEmail, otp, newPassword) {
    var res = await fetch(API_BASE + "/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrEmail: usernameOrEmail,
        otp: otp,
        newPassword: newPassword,
      }),
    });
    return handleResponse(res);
  }

  async function postLogin(username, password) {
    var res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password }),
    });
    var data = await handleResponse(res);
    setSession(data);
    return data;
  }

  /** Save a bill for the logged-in user (userId comes from the JWT). */
  async function addBill(payload) {
    var res = await fetch(API_BASE + "/add-bill", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  }

  /** Load all bills for this user (server checks JWT matches userId). */
  async function getBills(userId) {
    var res = await fetch(
      API_BASE + "/bills/" + encodeURIComponent(userId),
      {
        headers: authHeaders(),
      }
    );
    return handleResponse(res);
  }

  /** Update paid/due on a bill after the customer pays (optional). */
  async function patchBill(billId, paid, due) {
    var res = await fetch(
      API_BASE + "/bills/" + encodeURIComponent(billId),
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ paid: paid, due: due }),
      }
    );
    return handleResponse(res);
  }

  global.SarasAPI = {
    /** Resolved API origin (empty string = same host as the page, when page is served by Express). */
    API_BASE: API_BASE,
    getToken: getToken,
    getUserId: getUserId,
    getUsername: getUsername,
    isLoggedIn: isLoggedIn,
    setSession: setSession,
    clearSession: clearSession,
    postSignup: postSignup,
    postForgotPassword: postForgotPassword,
    postResetPassword: postResetPassword,
    postLogin: postLogin,
    addBill: addBill,
    getBills: getBills,
    patchBill: patchBill,
  };
})(typeof window !== "undefined" ? window : global);
