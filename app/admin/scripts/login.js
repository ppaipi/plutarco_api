import API_URL, { PREVIOUS_PAGE } from "./config.js";

const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");
const loginUser = document.getElementById("login-user");
const loginPass = document.getElementById("login-pass");

if (!btnLogin) {
  console.warn("login.js cargado sin botón de login");
}

function isSafeInternalPath(path) {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//")
  );
}

btnLogin.addEventListener("click", async () => {
  loginMsg.textContent = "";
  loginMsg.classList.remove("success");

  const user = loginUser.value.trim();
  const pass = loginPass.value.trim();

  if (!user || !pass) {
    loginMsg.textContent = "Completá usuario y contraseña";
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Cargando...";

  try {
    const form = new URLSearchParams();
    form.append("username", user);
    form.append("password", pass);

    const res = await fetch(API_URL + "login/auth/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
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

    loginMsg.textContent = "✓ Login exitoso, redirigiendo...";
    loginMsg.classList.add("success");

    // limpiar previous_page
    sessionStorage.removeItem("previous_page");

    setTimeout(() => {
      if (isSafeInternalPath(PREVIOUS_PAGE)) {
        window.location.href = PREVIOUS_PAGE;
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

// Enter UX
loginUser.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginPass.focus();
});

loginPass.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLogin.click();
});
