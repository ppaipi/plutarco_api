import { recomputeDate } from "./datearg.js";

export function generarHTMLPrint(orders) {

  // Normalizamos a array
  if (!Array.isArray(orders)) {
    orders = [orders];
  }

  let pedidosHTML = "";

  for (const order of orders) {
    pedidosHTML += generarPedidoHTML(order);
  }

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
      margin: 25px 0;
      border-top: 2px dashed black;
    }

    .page-break {
      page-break-before: always;
    }

    /* Evita cortes feos */
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  </style>
</head>

<body>
  ${pedidosHTML}
</body>
</html>
  `;
}

/* ===========================
   Pedido individual (privado)
   =========================== */
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
  <div class="pedido page-break">

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
