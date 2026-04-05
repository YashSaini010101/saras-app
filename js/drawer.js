/**
 * Drawer: wire Log out and show username on protected pages.
 */
function initProtectedDrawer() {
  var logoutBtn = document.getElementById("navLogout");
  var label = document.getElementById("navLogoutLabel");
  if (label && window.SarasAPI) {
    label.textContent = "Log out (" + SarasAPI.getUsername() + ")";
  }
  if (logoutBtn && window.SarasAPI) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      SarasAPI.clearSession();
      window.location.href = "login.html";
    });
  }
}
