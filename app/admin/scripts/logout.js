import { TOKEN } from "./config.js";
import { savePreviousPage } from "./helper.js";

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("btn-logout");

  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    sessionStorage.removeItem("token");
    localStorage.removeItem("token");
    savePreviousPage();
    window.location.href = "/login/";
  });
});

if (!TOKEN) {
  savePreviousPage();
  window.location.href = "/login";
}