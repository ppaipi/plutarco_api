export function savePreviousPage() {
  const path = window.location.pathname;
  const last = localStorage.getItem("previous_page");

  if (!path.startsWith("/admin")) return;
  if (path === last) return;
  if (path.includes("login")) return;

  localStorage.setItem("previous_page", path);
}