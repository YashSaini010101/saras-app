/**
 * Use on protected pages (calculator, bill, history, about).
 * If the user is not logged in, sends them to the login page.
 */
(function () {
  if (typeof window === "undefined" || !window.SarasAPI) {
    window.location.replace("login.html");
    return;
  }
  if (!SarasAPI.isLoggedIn()) {
    window.location.replace("login.html");
  }
})();
