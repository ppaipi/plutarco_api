// login.js - Lógica de login independiente

import API_URL from "./config.js";
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");
const loginUser = document.getElementById("login-user");
const loginPass = document.getElementById("login-pass");
const btnTheme = document.getElementById("theme-toggle");

// === MODO OSCURO ===
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
  btnTheme.textContent = "☀️";
}

btnTheme.addEventListener("click", () => {
  const isDark = document.documentElement.classList.toggle("dark");
  btnTheme.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// === LOGIN ===
btnLogin.addEventListener("click", async () => {
  loginMsg.textContent = "";
  loginMsg.classList.remove("success");

  const user = loginUser.value.trim();
  const pass = loginPass.value.trim();

  if (!user || !pass) {
    loginMsg.textContent = "Completá usuario y contraseña";
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Cargando...";

  try {
    const form = new URLSearchParams();
    form.append("username", user);
    form.append("password", pass);

    const res = await fetch(API_URL + "login/auth/", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      throw new Error("Credenciales incorrectas");
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error("No se recibió token");
    }

    // Guardar token
    localStorage.setItem("token", data.access_token);

    // Mensaje de éxito
    loginMsg.textContent = "✓ Login exitoso, redirigiendo...";
    loginMsg.classList.add("success");
    previousPage = document.referrer;
    // Redirigir a productos después de 500ms
    setTimeout(() => {
      if (previousPage && previousPage.includes("plutarco")) {
        window.location.href =  previousPage;
      } else {
        window.location.href = "/productos/";
      }
    }, 500);
  } catch (e) {
    loginMsg.textContent = e.message || "Error en login";
    btnLogin.disabled = false;
    btnLogin.textContent = "Ingresar";
  }
});

// Permitir enter en los inputs
loginUser.addEventListener("keypress", (e) => {
  if (e.key === "Enter") loginPass.focus();
});

loginPass.addEventListener("keypress", (e) => {
  if (e.key === "Enter") btnLogin.click();
});
