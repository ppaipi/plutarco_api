import { THEME } from "./config.js";

const btnTheme = document.getElementById("theme-toggle");
const root = document.documentElement;

// detectar tema inicial
function getInitialTheme() {
  if (THEME) return THEME;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);

  if (btnTheme) {
    btnTheme.textContent = isDark ? "☀️" : "🌙";
  }
}

// aplicar al cargar
const initialTheme = getInitialTheme();
applyTheme(initialTheme);
localStorage.setItem("theme", initialTheme);

// toggle
if (btnTheme) {
  btnTheme.addEventListener("click", () => {
    const isDark = root.classList.toggle("dark");
    const theme = isDark ? "dark" : "light";

    btnTheme.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", theme);
  });
}
