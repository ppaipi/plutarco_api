import { TOKEN } from "./config.js";
function savePreviousPage() {
  const path = window.location.pathname;
  const last = localStorage.getItem("previous_page");

  if (path === last) return;
  if (path.includes("login")) return;

  localStorage.removeItem("previous_page");
  localStorage.setItem("previous_page", path);
}
savePreviousPage();
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

