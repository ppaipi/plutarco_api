  import { THEME } from "./config.js";
  const btnTheme = document.getElementById("theme-toggle");
  if (THEME === "dark") {
    document.documentElement.classList.add("dark");
    if(btnTheme) btnTheme.textContent = "☀️";
  }

  if (btnTheme) {
    btnTheme.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle("dark");
      btnTheme.textContent = isDark ? "☀️" : "🌙";
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }