// pedidos.js - versión mejorada con typeahead y delete
const listEl = document.getElementById("list");
const filterMonth = document.getElementById("filter-month"); // NUEVO
const filterSort = document.getElementById("filter-sort");   // NUEVO
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
const btnDeleteOrder = document.getElementById("btn-delete-order");

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
const typeaheadList = document.getElementById("typeahead-list");
const itemsTableBody = document.querySelector("#items-table tbody");
const calcSubtotal = document.getElementById("calc-subtotal");
const btnAddTemp = document.getElementById("btn-add-temp");

// theme toggle reuse (if exists)
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
let items = []; // array of { id?, codigo, nombre, cantidad, precio_unitario }
let typeaheadResults = [];
let typeaheadActive = -1;
let typeaheadOpen = false;
let typeaheadTimer = null;

function toast(msg) { alert(msg) } // reemplazable por prettier toast

// ===================== API helper =====================
async function api(path, method='GET', body=null, isForm=false){
  const headers = {};
  const token = localStorage.getItem('token');
  if(token) headers['x-api-key'] = token;
  if(!isForm && body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if(body) opts.body = isForm ? body : JSON.stringify(body);
  const res = await fetch(path, opts);
  if(!res.ok){
    const txt = await res.text();
    throw new Error(txt || res.status);
  }
  if(res.status === 204) return null;
  return res.json();
}

// ===================== LOAD ORDERS =====================
async function loadOrders(){
  try{
    const data = await api('/api/orders');
    // ensure date fields are strings
    orders = data.map(o => ({ ...o, dia_entrega: o.dia_entrega ? o.dia_entrega.toString().slice(0,10) : null }));
    render();
  }catch(e){
    console.error(e);
    ordersBox.innerHTML = `<div class="card no-results">Error cargando pedidos</div>`;
  }
}

// ===================== RENDER ORDERS =====================
function render() {

  const month = document.getElementById("filter-month").value;
  const sortDir = document.getElementById("filter-sort").value;

  let pageSize = (page + 1) * PAGE_SIZE;

  // === FILTRAR POR MES ===
  const filtered = orders.filter(o => {
    if (month) {
      // si no existe dia_entrega o no empieza con "YYYY-MM"
      if (!o.dia_entrega || !o.dia_entrega.startsWith(month)) {
        return false;
      }
    }
    return true;
  });

  // === ORDEN ASC/DESC ===
  const ordered = filtered.sort((a, b) => {
    const da = a.dia_entrega || "";
    const db = b.dia_entrega || "";

    return sortDir === "asc"
      ? da.localeCompare(db)  // más antiguo primero
      : db.localeCompare(da); // más nuevo primero
  });

  // === PAGINACIÓN ===
  const slice = ordered.slice(0, pageSize);

  // === LIMPIAR LISTA ===
  listEl.innerHTML = "";

  if (slice.length === 0) {
    listEl.innerHTML = `
      <div class="no-results card">
        No hay pedidos para este filtro
      </div>`;
    return;
  }

  // === RENDERIZAR CADA PEDIDO ===
  slice.forEach(o => {

    const card = document.createElement("div");
    card.className = "order-card";

    card.innerHTML = `
      <div class="header">
        <h3>Pedido #${escapeHtml(o.id)} — ${escapeHtml(o.nombre || "")}</h3>
        <span class="date">${escapeHtml(o.dia_entrega || "-")}</span>
      </div>

      <div class="row">
        <strong>Email:</strong> ${escapeHtml(o.email || "")}
      </div>
      <div class="row">
        <strong>Teléfono:</strong> ${escapeHtml(o.telefono || "")}
      </div>

      <div class="row">
        <strong>Dirección:</strong> ${escapeHtml(o.direccion || "")}
      </div>

      <div class="row">
        <strong>Productos:</strong>
        <div class="prod-box">${escapeHtml(o.productos || "")}</div>
      </div>

      <div class="row">
        <strong>Total:</strong> $${escapeHtml(o.total || "0")}
      </div>

      <div class="row">
        <button class="btn small" data-edit="${o.id}">Editar</button>
        <button class="btn small btn-danger" data-delete="${o.id}">Eliminar</button>
      </div>
    `;

    listEl.appendChild(card);
  });

  // === BOTÓN "CARGAR MÁS" ===
  if (ordered.length > pageSize) {
    btnLoadMore.classList.remove("hidden");
  } else {
    btnLoadMore.classList.add("hidden");
  }
}


// ===================== ESCAPE HTML =====================
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ===================== DELETE ORDER =====================
async function confirmAndDelete(orderId){
  if(!confirm(`¿Eliminar pedido #${orderId}? Esta acción no se puede deshacer.`)) return;
  try{
    await api(`/api/orders/${orderId}`, 'DELETE');
    toast('Pedido eliminado');
    await loadOrders();
  }catch(e){
    console.error(e);
    alert('Error eliminando pedido: ' + e.message);
  }
}

// ===================== OPEN EDIT / CREATE =====================
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
  btnDeleteOrder.style.display = 'none';
  renderItemsTable();
  openModalUI();
});

async function openEdit(order){
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
  btnDeleteOrder.style.display = 'inline-block';

  try{
    const r = await api(`/api/orders/${order.id}`);
    items = (r.productos || []).map(it => ({
      id: it.id,
      codigo: it.codigo || it.product_codigo || '',
      nombre: it.nombre || it.product_name || '',
      cantidad: it.cantidad || 1,
      precio_unitario: Number(it.precio_unitario || it.precio || 0)
    }));
  }catch(e){
    console.error(e);
    items = [];
  }
  renderItemsTable();
  openModalUI();
}

function openModalUI(){
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');
  productSearch.focus();
}
function closeModalUI(){
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden','true');
}

// ===================== ITEMS TABLE =====================
function renderItemsTable(){
  itemsTableBody.innerHTML = '';
  let subtotal = 0;
  items.forEach((it, idx)=>{
    const subtotalItem = (Number(it.cantidad||0) * Number(it.precio_unitario||0));
    subtotal += subtotalItem;
    const tr = document.createElement('tr');
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

  // attach listeners
  itemsTableBody.querySelectorAll('input[data-field]').forEach(inp=>{
    inp.onchange = ()=>{
      const idx = Number(inp.dataset.idx);
      const field = inp.dataset.field;
      if(field === 'cantidad' || field === 'precio_unitario') items[idx][field] = Number(inp.value) || 0;
      else items[idx][field] = inp.value;
      renderItemsTable();
    };
  });
  itemsTableBody.querySelectorAll('button[data-action="remove"]').forEach(btn=>{
    btn.onclick = ()=>{
      const idx = Number(btn.dataset.idx);
      items.splice(idx,1);
      renderItemsTable();
    };
  });
}

// add temporary "varios" item
btnAddTemp.addEventListener('click', ()=>{
  const nombre = prompt('Nombre del artículo temporal (ej: Varios, Recargo):','Varios');
  if(!nombre) return;
  items.push({ codigo: '', nombre: nombre, cantidad: 1, precio_unitario: 0 });
  renderItemsTable();
});

// ===================== TYPEAHEAD IMPLEMENTATION =====================
productSearch.addEventListener('keydown', (e)=>{
  const key = e.key;
  if(!typeaheadOpen) return;
  if(key === 'ArrowDown'){ e.preventDefault(); typeaheadActive = Math.min(typeaheadActive+1, typeaheadResults.length-1); renderTypeahead(); }
  else if(key === 'ArrowUp'){ e.preventDefault(); typeaheadActive = Math.max(typeaheadActive-1, 0); renderTypeahead(); }
  else if(key === 'Enter'){ e.preventDefault(); if(typeaheadActive >= 0) selectTypeahead(typeaheadActive); }
  else if(key === 'Escape'){ closeTypeahead(); }
});

productSearch.addEventListener('input', ()=>{
  const q = productSearch.value.trim();
  if(typeaheadTimer) clearTimeout(typeaheadTimer);
  if(q.length === 0){ closeTypeahead(); return; }
  typeaheadTimer = setTimeout(async ()=>{
    try{
      // prefer server search endpoint
      const res = await api(`/api/products/search?q=${encodeURIComponent(q)}&limit=12`);
      typeaheadResults = res.map(p=>({
        codigo: p.codigo || '',
        nombre: p.nombre || '',
        precio: (p.precio || p.precio_unitario || 0)
      }));
      typeaheadActive = 0;
      openTypeahead();
    }catch(err){
      console.error('typeahead err', err);
      typeaheadResults = [];
      closeTypeahead();
    }
  }, 220);
});

function openTypeahead(){
  if(!typeaheadResults || typeaheadResults.length === 0){ closeTypeahead(); return; }
  typeaheadList.innerHTML = '';
  typeaheadResults.forEach((r, i)=>{
    const div = document.createElement('div');
    div.className = 'typeahead-item' + (i===typeaheadActive ? ' active' : '');
    div.dataset.index = i;
    div.innerHTML = `<div><strong>${escapeHtml(r.nombre)}</strong><div class="meta">${escapeHtml(r.codigo)}</div></div><div class="meta">$${Number(r.precio||0).toFixed(2)}</div>`;
    div.onclick = ()=> selectTypeahead(i);
    typeaheadList.appendChild(div);
  });
  typeaheadList.style.display = 'block';
  typeaheadOpen = true;
}

function renderTypeahead(){
  Array.from(typeaheadList.children).forEach((ch, idx)=> {
    ch.classList.toggle('active', idx === typeaheadActive);
    if(idx === typeaheadActive){
      // ensure visible
      ch.scrollIntoView({block:'nearest'});
    }
  });
}

function closeTypeahead(){
  typeaheadList.style.display = 'none';
  typeaheadOpen = false;
  typeaheadResults = [];
  typeaheadActive = -1;
}

function selectTypeahead(idx){
  const p = typeaheadResults[idx];
  if(!p) return;
  items.push({ codigo: p.codigo, nombre: p.nombre, cantidad: 1, precio_unitario: Number(p.precio||0) });
  renderItemsTable();
  productSearch.value = '';
  closeTypeahead();
}

// click outside to close typeahead
document.addEventListener('click', (e)=>{
  if(!productSearch.contains(e.target) && !typeaheadList.contains(e.target)) closeTypeahead();
});

// ===================== IMPORT EXCEL =====================
btnImportExcel.addEventListener('click', ()=> fileExcel.click());
fileExcel.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    const r = await api('/api/orders/import-excel', 'POST', fd, true);
    toast(`Importados: ${r.created}. Errores: ${r.errors?.length||0}`);
    if(r.errors && r.errors.length) console.warn('Errores import:', r.errors);
    await loadOrders();
  }catch(err){ console.error(err); alert('Error importando Excel: ' + (err.message||err)); }
});

// ===================== SAVE modal (create or update) =====================
modalSave.addEventListener('click', async ()=>{
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
      await api(`/api/orders/${editingOrderId}`, 'PUT', payload);

      // sync items: update existing, create new, delete removed
      const server = await api(`/api/orders/${editingOrderId}`);
      const serverItemIds = (server.productos || []).map(i=>i.id);

      // update/create
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
      // delete removed
      const keptIds = items.filter(i=>i.id).map(i=>i.id);
      const toDelete = (server.productos || []).filter(si => !keptIds.includes(si.id));
      for(const td of toDelete){
        await api(`/api/orders/${editingOrderId}/items/${td.id}`, 'DELETE');
      }

      toast('Pedido actualizado');
    } else {
      // create order first
      const newOrderResp = await api('/api/orders', 'POST', { ...payload, productos: [] });
      const newOrderId = newOrderResp.order?.id || newOrderResp.order || newOrderResp.id || null;
      if(!newOrderId) {
        throw new Error('No se pudo obtener ID del nuevo pedido (revisá la respuesta del backend).');
      }
      for(const it of items){
        await api(`/api/orders/${newOrderId}/items`, 'POST', {
          codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, precio_unitario: it.precio_unitario
        });
      }
      toast('Pedido creado');
    }
    closeModalUI();
    await loadOrders();
  }catch(e){
    console.error(e);
    alert('Error guardando pedido: ' + (e.message||e));
  }
});

modalCancel.addEventListener('click', ()=> closeModalUI());
btnDeleteOrder.addEventListener('click', async ()=>{
  if(!editingOrderId) return;
  if(!confirm(`Confirmar eliminación de pedido #${editingOrderId}?`)) return;
  try{
    await api(`/api/orders/${editingOrderId}`, 'DELETE');
    toast('Pedido eliminado');
    closeModalUI();
    await loadOrders();
  }catch(e){
    console.error(e);
    alert('Error eliminando pedido: ' + e.message);
  }
});
function populateMonths() {
  const select = document.getElementById("filter-month");
  const months = new Set();

  orders.forEach(o => {
    if (o.dia_entrega) {
      const m = o.dia_entrega.slice(0,7); // YYYY-MM
      months.add(m);
    }
  });

  const arr = Array.from(months).sort().reverse(); // últimos primero

  select.innerHTML = `<option value="">Todos los meses</option>`;
  arr.forEach(m => {
    const [y,mo] = m.split("-");
    const label = `${mo}/${y}`;
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = label;
    select.appendChild(opt);
  });

  // seleccionar automáticamente el último mes
  if (arr.length > 0) select.value = arr[0];
}


// pagination & filters
btnLoadMore.addEventListener('click', ()=> { page++; render(); });
search.addEventListener('input', ()=> { page = 0; render(); });
filterStatus.addEventListener('change', ()=> { page = 0; render(); });
filterDate.addEventListener('change', ()=> { page = 0; render(); });

// init
loadOrders();
populateMonths();
render();
