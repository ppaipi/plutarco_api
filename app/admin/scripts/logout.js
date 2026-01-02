import { TOKEN } from "./config";
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("btn-logout");

  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include" // MUY IMPORTANTE si usás cookies
      });
    } catch (err) {
      console.warn("Error al cerrar sesión", err);
    }

    // Limpiar storage local
    sessionStorage.clear();
    localStorage.clear();

    // Redirigir
    window.location.href = "/login/";
  });
});

if (!TOKEN) {
  window.location.href = "/login";
  return;
}