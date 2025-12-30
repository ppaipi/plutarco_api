import API_URL from "./config.js";
const API_KEY = localStorage.getItem("token");
const monthSelector = document.getElementById("month-selector");

let orders = [];

/* =========================
   AUTH
========================= */
if (!API_KEY) {
  window.location.href = "/login/";
}

/* =========================
   THEME TOGGLE
========================= */
const themeToggle = document.getElementById("theme-toggle");
const html = document.documentElement;

const savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") {
  html.classList.add("dark");
  themeToggle.textContent = "☀️";
}

themeToggle.addEventListener("click", () => {
  html.classList.toggle("dark");
  const isDark = html.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
});

/* =========================
   LOGOUT
========================= */
const logoutBtn = document.getElementById("btn-logout");
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/login/";
});

/* =========================
   FETCH ORDERS
========================= */
async function fetchOrders() {
  try {
    const headers = {};
    if (API_KEY) headers['x-api-key'] = API_KEY;
    const response = await fetch(API_URL + "orders/list", { method: 'GET', headers });


    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    orders = Array.isArray(data) ? data : [];
    
    populateMonthSelector();
  } catch (err) {
    console.error("Error cargando pedidos:", err);
    alert("Error cargando pedidos: " + err.message);
  }
}

fetchOrders();

/* =========================
   MONTH SELECTOR POPULATION
========================= */
function populateMonthSelector() {
  const monthSet = new Set();
  
  orders.forEach(order => {
    if (order.dia_pedido) {
      const date = new Date(order.dia_pedido);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      monthSet.add(`${year}-${month}`);
    }
  });

  const months = Array.from(monthSet).sort().reverse();
  
  // Limpiar opciones previas excepto la primera
  const firstOption = monthSelector.querySelector("option");
  monthSelector.innerHTML = "";
  monthSelector.appendChild(firstOption);

  months.forEach(month => {
    const option = document.createElement("option");
    option.value = month;
    const [year, monthNum] = month.split("-");
    const date = new Date(year, parseInt(monthNum) - 1);
    const monthName = date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    monthSelector.appendChild(option);
  });

  // Seleccionar el mes más reciente
  if (months.length > 0) {
    monthSelector.value = months[0];
    calculateSummary(months[0]);
  }
}

monthSelector.addEventListener("change", (e) => {
  if (e.target.value) {
    calculateSummary(e.target.value);
  }
});

/* =========================
   CALCULATE SUMMARY
========================= */
function calculateSummary(monthYear) {
  if (!monthYear) return;

  const [year, month] = monthYear.split("-").map(Number);

  const filtered = orders.filter(o => {
    if (!o.dia_pedido) return false;
    const d = new Date(o.dia_pedido);
    return d.getFullYear() === year && d.getMonth() === month - 1;
  });

  // Campos reales según Order model
  const subtotal = sumField(filtered, "subtotal");
  const comision = subtotal * 0.20; // 20%
  const ganancia = subtotal - comision;

  const envio_cobrado = sumField(filtered, "envio_cobrado");
  const costo_envio_real = sumField(filtered, "costo_envio_real");
  const diferencia_envio = envio_cobrado - costo_envio_real;

  const personas = 2;
  const pago_por_persona = subtotal * 0.10; // 10%
  const diferencia_envio_por_persona = 0; // No se reparte en este ejemplo
  const total_por_persona = pago_por_persona ;

  // Balance final
  const ingresos = subtotal + envio_cobrado;
  const egresos = comision - (diferencia_envio);
  const saldo = ingresos - egresos;

  render({
    "total-subtotal": subtotal,
    "total-percentage": comision,
    "total-profit": ganancia,
    "delivery-charged": envio_cobrado,
    "delivery-costs": costo_envio_real,
    "delivery-difference": diferencia_envio,
    "payment-per-person": pago_por_persona,
    "delivery-diff-per-person": diferencia_envio_por_persona,
    "total-per-person": total_por_persona,
    "total-income": ingresos,
    "total-expenses": egresos,
    "final-balance": saldo
  });
}

/* =========================
   HELPERS
========================= */
function sumField(arr, field) {
  return arr.reduce((acc, o) => {
    const value = o[field];

    if (typeof value === "number") return acc + value;
    if (value && typeof value === "object" && "parsedValue" in value) {
      return acc + Number(value.parsedValue || 0);
    }

    return acc;
  }, 0);
}


function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function render(data) {
  Object.entries(data).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = formatMoney(value);
      // Color si es negativo
      if (value < 0) {
        el.style.color = "var(--danger)";
      } else {
        el.style.color = "";
      }
    }
  });
}
