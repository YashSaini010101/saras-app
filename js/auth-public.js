/**
 * Use on login, signup, forgot-password, reset-password.
 * If the user is already logged in, send them to the calculator home.
 */
(function () {
  if (typeof window === "undefined" || !window.SarasAPI) return;
  if (SarasAPI.isLoggedIn()) {
    window.location.replace("index.html");
  }
})();
