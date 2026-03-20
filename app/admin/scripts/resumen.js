import API_URL from "./config.js";
import { TOKEN } from "./config.js";
let API_KEY = TOKEN;

const monthSelector = document.getElementById("month-selector");

let orders = [];
let empleados = {};


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
async function fetchEmpleados() {
  try {
    const headers = {};
    if (API_KEY) headers['x-api-key'] = API_KEY;
    const response = await fetch(API_URL + "config/empleados", { method: 'GET', headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    empleados = data || {};
    
    // Poblar selector de empleados en el formulario de pedidos
    const empleadoSelect = document.getElementById("o-empleado-asignado");
    if (empleadoSelect) {
      Object.entries(empleados).forEach(([id, name]) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = name;
        empleadoSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Error cargando empleados:", err);
    alert("Error cargando empleados: " + err.message);
  }
}

await fetchEmpleados();
await fetchOrders();

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
async function calculateSummary(monthYear) {
  if (!monthYear) return;

  const [year, month] = monthYear.split("-").map(Number);

  const filtered = orders.filter(o => {
    if (!o.dia_pedido) return false;
    const d = new Date(o.dia_pedido);
    return d.getFullYear() === year && d.getMonth() === month - 1;
  });

  // Cargar empleados de config
  const empleadosNombres = empleados.empleados || empleados;

  // Calcular pago por empleado
  const empleadosPago = {};
  
  filtered.forEach(order => {
    const empleadoIds = Array.isArray(order.empleado_asignado) ? order.empleado_asignado : [];
    if (empleadoIds.length === 0) return;
    
    const totalPedido = Number(order.total || 0);
    
    // Cada empleado asignado se lleva el 20% del total del pedido
    const comisionPedido = totalPedido * 0.20;
    const pagoPorEmpleado = comisionPedido / empleadoIds.length;

    console.group(`Pedido #${order.id || "sin-id"}`);
    console.log("Total pedido:", totalPedido);
    console.log("Empleados asignados:", empleadoIds.length);
    console.log("Comisión total (20%):", comisionPedido);
    console.log("Pago por empleado:", pagoPorEmpleado);

    empleadoIds.forEach(empleadoId => {
      const nombreEmpleado = empleadosNombres[empleadoId] || `Empleado ${empleadoId}`;

      if (!empleadosPago[nombreEmpleado]) {
        empleadosPago[nombreEmpleado] = 0;
      }

      empleadosPago[nombreEmpleado] += pagoPorEmpleado;

      console.log(
        `→ ${nombreEmpleado} suma $${pagoPorEmpleado.toFixed(2)} (acumulado: $${empleadosPago[nombreEmpleado].toFixed(2)})`
      );
    });

    console.groupEnd();
      });

  // Campos generales
  const subtotal = sumField(filtered, "subtotal");
  const comision = subtotal * 0.20; // 20%
  const ganancia = subtotal - comision;

  const envio_cobrado = sumField(filtered, "envio_cobrado");
  const costo_envio_real = sumField(filtered, "costo_envio_real");
  const diferencia_envio = envio_cobrado - costo_envio_real;

  // Calcular totales por empleado
  const totalEmpleados = Object.values(empleadosPago).reduce((a, b) => a + b, 0);
  const cantEmpleados = Object.keys(empleadosPago).length;

  // Balance final
  const ingresos = subtotal + envio_cobrado;
  const egresos = comision - (diferencia_envio);
  const saldo = ingresos - egresos;

  // Renderizar tabla de empleados
  renderEmpleadosTable(empleadosPago);

  render({
    "total-subtotal": subtotal,
    "total-percentage": comision,
    "total-profit": ganancia,
    "delivery-charged": envio_cobrado,
    "delivery-costs": costo_envio_real,
    "delivery-difference": diferencia_envio,
    "payment-per-person": totalEmpleados > 0 ? totalEmpleados / cantEmpleados : 0,
    "total-employees": cantEmpleados,
    "total-paid-employees": totalEmpleados,
    "total-income": ingresos,
    "total-expenses": egresos,
    "final-balance": saldo
  });
}

/* =========================
   RENDER EMPLEADOS TABLE
========================= */
function renderEmpleadosTable(empleadosPago) {
  const container = document.getElementById("empleados-summary");
  if (!container) return;

  // Limpiar tabla anterior
  container.innerHTML = '';

  // Crear tabla
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginTop = '1.5rem';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  ['Empleado', 'Pago (20% de pedidos)', 'Porcentaje'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.padding = '10px';
    th.style.textAlign = 'left';
    th.style.fontWeight = 'bold';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  const totalPago = Object.values(empleadosPago).reduce((a, b) => a + b, 0);
console.group("Detalle pagos empleados");
  Object.entries(empleadosPago).forEach(([nombre, pago]) => {
      console.log(`${nombre}: $${pago.toFixed(2)}`);
    const row = document.createElement('tr');

    const tdNombre = document.createElement('td');
    tdNombre.textContent = nombre;
    tdNombre.style.padding = '10px';
    row.appendChild(tdNombre);

    const tdPago = document.createElement('td');
    tdPago.textContent = formatMoney(pago);
    tdPago.style.padding = '10px';
    tdPago.style.fontWeight = 'bold';
    tdPago.style.color = '#1E88E5';
    row.appendChild(tdPago);

    const tdPorcentaje = document.createElement('td');
    const porcentaje = ((pago / totalPago) * 100).toFixed(1);
    tdPorcentaje.textContent = `${porcentaje}%`;
    tdPorcentaje.style.padding = '10px';
    row.appendChild(tdPorcentaje);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
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
