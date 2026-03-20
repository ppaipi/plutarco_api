import { recomputeDate } from "./datearg.js";

const PAGE_HEIGHT = 1122; // A4 aprox (96 DPI)

export function generarHTMLPrint(orders) {

  if (!Array.isArray(orders)) {
    orders = [orders];
  }

  // contenedor invisible para medir
  const measure = document.createElement("div");
  measure.style.position = "absolute";
  measure.style.visibility = "hidden";
  measure.style.width = "210mm";
  document.body.appendChild(measure);

  let htmlFinal = "";
  let alturaActual = 0;
  let first = true;

  for (const order of orders) {

    const pedidoHTML = generarPedidoHTML(order);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = pedidoHTML;
    measure.appendChild(wrapper);

    const alturaPedido = wrapper.scrollHeight;

    // 👉 SOLO saltamos página si NO entra
    if (!first && alturaActual + alturaPedido > PAGE_HEIGHT) {
      htmlFinal += `<div class="page-break"></div>`;
      alturaActual = 0;
    }

    htmlFinal += pedidoHTML;
    alturaActual += alturaPedido;
    first = false;

    measure.innerHTML = "";
  }

  document.body.removeChild(measure);

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Pedidos - Plutarco Almacén</title>

<style>
body {
  font-family: 'Segoe UI', Tahoma, sans-serif;
  color: #333;
  margin: 20px;
}

.pedido {
  max-width: 800px;
  margin: auto;
  page-break-inside: avoid;
}

h2 {
  text-align: center;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 10px 0;
}

th, td {
  padding: 6px;
  border-bottom: 1px solid #ddd;
}

th {
  background: #f5f5f5;
}

.right {
  text-align: right;
}

.total-final td {
  font-size: 16px;
  font-weight: bold;
  color: #1e88e5;
}

.corte {
  margin: 20px 0;
  border-top: 2px dashed black;
}

.page-break {
  page-break-before: always;
}

/* Evitar cortes feos */
table { page-break-inside: auto; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
</style>
</head>

<body>
${htmlFinal}
</body>
</html>
`;
}

/* ======================
   Pedido individual
   ====================== */
function generarPedidoHTML(order) {

  let productosHTML = "";

  for (const p of order.productos) {
    productosHTML += `
      <tr>
        <td>${p.cantidad}</td>
        <td>${p.nombre}</td>
        <td>$${p.precio_unitario}</td>
        <td class="right">$${p.precio_unitario * p.cantidad}</td>
      </tr>
    `;
  }

  return `
<div class="pedido">

  <h2>📦 Pedido #${order.id} | Plutarco Almacén 🥖</h2>

  <div class="datos">
    <p><strong>Nombre:</strong> ${order.nombre_completo}</p>
    <p><strong>Email:</strong> ${order.correo}</p>
    <p><strong>Teléfono:</strong> ${order.telefono}</p>
    <p><strong>Dirección:</strong> ${order.direccion}</p>
    <p><strong>Día de entrega:</strong> ${recomputeDate(order.dia_entrega)}</p>
    ${order.comentario ? `<p><strong>Comentario:</strong> ${order.comentario}</p>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>Cant.</th>
        <th>Producto</th>
        <th>Precio</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${productosHTML}
    </tbody>
  </table>

  <table class="totales">
    <tr>
      <td>Subtotal</td>
      <td class="right">$${order.subtotal}</td>
    </tr>
    <tr>
      <td>Envío</td>
      <td class="right">$${order.envio_cobrado}</td>
    </tr>
    <tr class="total-final">
      <td>TOTAL</td>
      <td class="right">$${order.total}</td>
    </tr>
  </table>

  <div class="corte"></div>
</div>
`;
}
