// pedidos.js - gestión de pedidos avanzada
const ordersBox = document.getElementById("orders");
const search = document.getElementById("search");
const filterStatus = document.getElementById("filter-status");
const filterDate = document.getElementById("filter-date");
const btnLoadMore = document.getElementById("btn-load-more");
const fileExcel = document.getElementById("file-excel");
const btnImportExcel = document.getElementById("btn-import-excel");
const btnNewOrder = document.getElementById("btn-new-order");

// modal elements
const modal = document.getElementById("modal-order");
const modalTitle = document.getElementById("modal-title");
const modalSave = document.getElementById("modal-save");
const modalCancel = document.getElementById("modal-cancel");

// order fields
const fNombre = document.getElementById("o-nombre");
const fCorreo = document.getElementById("o-correo");
const fTelefono = document.getElementById("o-telefono");
const fDireccion = document.getElementById("o-direccion");
const fDia = document.getElementById("o-dia");
const fEnvio = document.getElementById("o-envio");
const fCostoEnvio = document.getElementById("o-costo-envio");
const fConfirmado = document.getElementById("o-confirmado");
const fEntregado = document.getElementById("o-entregado");

const productSearch = document.getElementById("product-search");
const itemsTableBody = document.querySelector("#items-table tbody");
const calcSubtotal = document.getElementById("calc-subtotal");
const btnAddTemp = document.getElementById("btn-add-temp");

// theme toggle reuse
const btnTheme = document.getElementById("theme-toggle");
const saved = localStorage.getItem("theme");
if (saved === "dark") {
  document.documentElement.classList.add("dark");
  if (btnTheme) btnTheme.textContent = "☀️";
}
if (btnTheme) btnTheme.onclick = () => {
  const isDark = document.documentElement.classList.toggle("dark");
  if (btnTheme) btnTheme.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("theme", isDark ? "dark" : "light");
};

// state
let orders = [];
let page = 0;
const PAGE_SIZE = 20;
let editingOrderId = null;
let items = []; // {id(optional), codigo, nombre, cantidad, precio_unitario}

// helper API
async function api(path, method='GET', body=null, isForm=false){
  const headers = {};
  const token = localStorage.getItem('token');
  if(token) headers['x-api-key'] = token;
  if(!isForm && body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if(body) opts.body = isForm ? body : JSON.stringify(body);
  const res = await fetch(path, opts);
  if(!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.status);
  }
  if(res.status === 204) return null;
  return res.json();
}

// load orders
async function loadOrders(){
  try{
    const data = await api('/api/orders');
    orders = data;
    render();
  }catch(e){
    console.error(e);
    ordersBox.innerHTML = `<div class="card no-results">Error cargando pedidos</div>`;
  }
}

function render(){
  ordersBox.innerHTML = '';
  const q = search.value.toLowerCase();
  const state = filterStatus.value;
  const date = filterDate.value;

  const filtered = orders.filter(o=>{
    if(q){
      const s = `${o.nombre_completo||''} ${o.correo||''} ${o.direccion||''}`.toLowerCase();
      if(!s.includes(q)) return false;
    }
    if(state === 'pendiente' && (o.confirmado || o.entregado)) return false;
    if(state === 'confirmado' && !o.confirmado) return false;
    if(state === 'entregado' && !o.entregado) return false;
    if(date && (o.dia_entrega !== date)) return false;
    return true;
  });

  const slice = filtered.slice(0, (page+1)*PAGE_SIZE);
  if(slice.length === 0){
    ordersBox.innerHTML = `<div class="card no-results">No hay pedidos</div>`;
    return;
  }

  for(const o of slice){
    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <h3>${escapeHtml(o.nombre_completo || '—')}</h3>
      <p class="small">${escapeHtml(o.correo || '')}</p>
      <p class="small">${escapeHtml(o.telefono || '')} • ${escapeHtml(o.direccion || '')}</p>
      <p class="small">Entrega: <b>${o.dia_entrega || '-'}</b></p>
      <p class="small">Total: $${(o.envio_cobrado||0)+0}</p>
      <div class="row" style="margin-top:8px">
        <button class="btn small" data-id="${o.id}" data-action="edit">Ver / Editar</button>
        <button class="btn ghost small" data-id="${o.id}" data-action="print">Imprimir</button>
      </div>
    `;
    const btnEdit = card.querySelector('button[data-action="edit"]');
    btnEdit.onclick = ()=> openEdit(o);
    ordersBox.appendChild(card);
  }
}

// helpers
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Modal open for creating new order
btnNewOrder.addEventListener('click', ()=>{
  editingOrderId = null;
  modalTitle.textContent = 'Crear pedido';
  fNombre.value = '';
  fCorreo.value = '';
  fTelefono.value = '';
  fDireccion.value = '';
  fDia.value = '';
  fEnvio.value = '';
  fCostoEnvio.value = '';
  fConfirmado.checked = false;
  fEntregado.checked = false;
  items = [];
  renderItemsTable();
  modal.style.display = 'flex';
});

// open for editing
function openEdit(order){
  editingOrderId = order.id;
  modalTitle.textContent = `Editar pedido #${order.id}`;
  fNombre.value = order.nombre_completo || '';
  fCorreo.value = order.correo || '';
  fTelefono.value = order.telefono || '';
  fDireccion.value = order.direccion || '';
  fDia.value = order.dia_entrega || '';
  fEnvio.value = order.envio_cobrado || 0;
  fCostoEnvio.value = order.costo_envio_real || 0;
  fConfirmado.checked = !!order.confirmado;
  fEntregado.checked = !!order.entregado;
  // obtener items asociados
  (async ()=>{
    try{
      // el endpoint GET /api/orders/{id} devuelve order + productos
      const r = await api(`/api/orders/${order.id}`);
      // asumo r.productos es array de items con id, nombre, cantidad, precio_unitario, product_id, codigo
      items = (r.productos || []).map(it => ({
        id: it.id,
        codigo: it.codigo || it.product_codigo || '',
        nombre: it.nombre || it.product_name || '',
        cantidad: it.cantidad || 1,
        precio_unitario: it.precio_unitario || it.precio || 0
      }));
      renderItemsTable();
      modal.style.display = 'flex';
    }catch(e){ console.error(e); alert('Error cargando items'); }
  })();
}

// render items
function renderItemsTable(){
  itemsTableBody.innerHTML = '';
  let subtotal = 0;
  items.forEach((it, idx)=>{
    const tr = document.createElement('tr');
    const subtotalItem = (Number(it.cantidad||0) * Number(it.precio_unitario||0));
    subtotal += subtotalItem;
    tr.innerHTML = `
      <td><input class="input" data-idx="${idx}" data-field="codigo" value="${escapeHtml(it.codigo||'')}"></td>
      <td><input class="input" data-idx="${idx}" data-field="nombre" value="${escapeHtml(it.nombre||'')}"></td>
      <td><input class="input" data-idx="${idx}" data-field="cantidad" type="number" style="width:80px" value="${it.cantidad||1}"></td>
      <td><input class="input" data-idx="${idx}" data-field="precio_unitario" type="number" style="width:120px" value="${it.precio_unitario||0}"></td>
      <td>$${subtotalItem.toFixed(2)}</td>
      <td><button class="btn small" data-idx="${idx}" data-action="remove">Eliminar</button></td>
    `;
    itemsTableBody.appendChild(tr);
  });
  calcSubtotal.textContent = subtotal.toFixed(2);

  // attach listeners to inputs & remove
  itemsTableBody.querySelectorAll('input[data-field]').forEach(inp=>{
    inp.onchange = (e)=>{
      const idx = Number(inp.dataset.idx);
      const field = inp.dataset.field;
      if(field === 'cantidad' || field === 'precio_unitario'){
        items[idx][field] = Number(inp.value) || 0;
      } else {
        items[idx][field] = inp.value;
      }
      renderItemsTable();
    };
  });
  itemsTableBody.querySelectorAll('button[data-action="remove"]').forEach(btn=>{
    btn.onclick = (e)=>{
      const idx = Number(btn.dataset.idx);
      items.splice(idx,1);
      renderItemsTable();
    };
  });
}

// add temporary "varios" item
btnAddTemp.addEventListener('click', ()=>{
  const nombre = prompt('Nombre del artículo temporal (ej: Varios, Recargo, Donación):','Varios');
  if(!nombre) return;
  items.push({ codigo: '', nombre: nombre, cantidad: 1, precio_unitario: 0 });
  renderItemsTable();
});

// product search suggestions (simple)
let productSuggestTimer = null;
productSearch.addEventListener('input', (e)=>{
  clearTimeout(productSuggestTimer);
  const q = productSearch.value.trim();
  if(!q) return;
  productSuggestTimer = setTimeout(async ()=>{
    try{
      // intentar un endpoint de búsqueda si existe: /api/products/search?q=...
      // si no, traemos /api/products y filtramos
      let res;
      try{
        res = await api(`/api/products?search=${encodeURIComponent(q)}`);
      }catch(err){
        const all = await api('/api/products');
        res = all.filter(p => ((p.nombre||'') + ' ' + (p.codigo||'')).toLowerCase().includes(q.toLowerCase()));
      }
      // mostrar sugerencias simples
      const list = res.slice(0,8);
      const pick = list[0];
      if(list.length===1 && pick){
        // autoañadir el primer resultado
        items.push({ codigo: pick.codigo||'', nombre: pick.nombre||'', cantidad:1, precio_unitario: pick.precio||pick.precio_unitario||0 });
        productSearch.value = '';
        renderItemsTable();
      } else {
        // mostrar un simple prompt con opciones
        const names = list.map((p,i)=>`${i+1}) ${p.nombre} — ${p.codigo} — $${p.precio||p.precio_unitario||0}`).join('\n');
        if(!names) return;
        const ans = prompt(`Sugerencias:\n${names}\nElige el número para añadir, o cancelar:`);
        const num = Number(ans);
        if(num && list[num-1]){
          const pick2 = list[num-1];
          items.push({ codigo: pick2.codigo||'', nombre: pick2.nombre||'', cantidad:1, precio_unitario: pick2.precio||pick2.precio_unitario||0 });
          productSearch.value = '';
          renderItemsTable();
        }
      }
    }catch(err){ console.error(err); }
  }, 350);
});

// IMPORT EXCEL
btnImportExcel.addEventListener('click', ()=> fileExcel.click());
fileExcel.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    const r = await api('/api/orders/import-excel', 'POST', fd, true);
    alert(`Importados: ${r.created}. Errores: ${r.errors?.length||0}`);
    await loadOrders();
  }catch(err){ console.error(err); alert('Error importando Excel'); }
});

// SAVE modal (create or update)
modalSave.addEventListener('click', async ()=>{
  // construir payload pedido
  const payload = {
    nombre_completo: fNombre.value,
    correo: fCorreo.value,
    telefono: fTelefono.value,
    direccion: fDireccion.value,
    dia_entrega: fDia.value || null,
    envio_cobrado: Number(fEnvio.value) || 0,
    costo_envio_real: Number(fCostoEnvio.value) || 0,
    confirmado: Boolean(fConfirmado.checked),
    entregado: Boolean(fEntregado.checked),
  };

  try{
    if(editingOrderId){
      // Primero actualizar campos generales
      await api(`/api/orders/${editingOrderId}`, 'PUT', payload);

      // Luego sincronizar items: simplificamos borrando y re-guardando, o usando endpoints items CRUD
      // Aquí usamos endpoints items: si item has id -> update, else -> create; we also delete removed (best effort)
      // Obtener items actuales del servidor:
      const srv = await api(`/api/orders/${editingOrderId}`);
      const srvItems = (srv.productos || []).map(i=>i.id);
      // actualizar/crear
      for(const it of items){
        if(it.id){
          await api(`/api/orders/${editingOrderId}/items/${it.id}`, 'PUT', {
            nombre: it.nombre, cantidad: it.cantidad, precio_unitario: it.precio_unitario
          });
        } else {
          await api(`/api/orders/${editingOrderId}/items`, 'POST', {
            codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, precio_unitario: it.precio_unitario
          });
        }
      }
      // borrar los que fueron removidos: detectar ids en srv que ya no están en items
      const keptIds = items.filter(i=>i.id).map(i=>i.id);
      const toDelete = (srv.productos || []).filter(si => !keptIds.includes(si.id));
      for(const td of toDelete){
        await api(`/api/orders/${editingOrderId}/items/${td.id}`, 'DELETE');
      }

      alert('Pedido actualizado');
    } else {
      // crear nuevo
      // We first create order with empty products, then add items
      const newOrder = await api('/api/orders', 'POST', {
        ...payload,
        productos: [] // create_order needs productos; we'll add them after
      });
      const newId = newOrder.order.id || newOrder.order; // depende de create_order response
      // add items
      for(const it of items){
        await api(`/api/orders/${newId}/items`, 'POST', {
          codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, precio_unitario: it.precio_unitario
        });
      }
      alert('Pedido creado');
    }

    modal.style.display = 'none';
    await loadOrders();
  }catch(e){
    console.error(e);
    alert('Error guardando pedido: ' + (e.message||e));
  }
});

modalCancel.addEventListener('click', ()=> modal.style.display = 'none');

// pagination & filters
btnLoadMore.addEventListener('click', ()=> { page++; render(); });
search.addEventListener('input', ()=> { page = 0; render(); });
filterStatus.addEventListener('change', ()=> { page = 0; render(); });
filterDate.addEventListener('change', ()=> { page = 0; render(); });

// init
loadOrders();
