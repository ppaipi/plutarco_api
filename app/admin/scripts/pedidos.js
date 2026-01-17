// pedidos.js - versión mejorada con typeahead y delete (REVISADO)
// Requisitos: que el HTML tenga los IDs usados abajo. El script es robusto si faltan algunos elementos.

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
const fTelefonoWpp = document.getElementById("o-telefono-wpp");
const fDireccion = document.getElementById("o-direccion");
const fDireccionMaps = document.getElementById("o-direccion-maps");
const fDia = document.getElementById("o-dia");
const fEnvio = document.getElementById("o-envio");
const fCostoEnvio = document.getElementById("o-costo-envio");
const fTotal = document.getElementById("o-total"); // NUEVO
const fComentario = document.getElementById("o-comentario"); // NUEVO
const fConfirmado = document.getElementById("o-confirmado");
const fEntregado = document.getElementById("o-entregado");

const productSearch = document.getElementById("product-search");
const typeaheadList = document.getElementById("typeahead-list");
const itemsTableBody = document.querySelector("#items-table tbody");
const calcSubtotal = document.getElementById("calc-subtotal");
const btnAddTemp = document.getElementById("btn-add-temp");
const btnPrintSome = document.getElementById("print-some");

// Base API URL (usar absoluta para evitar redirecciones http/https)
import API_URL from "./config.js";
import { TOKEN } from "./config.js";
import { generarHTMLPrint } from "./printhtml.js";
let token = TOKEN;

import { recomputeDate } from "./datearg.js";
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

// ===================== LOAD ORDERS =====================
async function loadOrders(){
  try{
    if (listEl) listEl.innerHTML = `<div class="card">Cargando pedidos...</div>`;

    const headers = {};
    if (token) headers['x-api-key'] = token;

    const res = await fetch(API_URL + "orders/list", { method: 'GET', headers });
    if(!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error(txt || res.status);
    }
    const data = res.status === 204 ? [] : await res.json();

    if (!Array.isArray(data)) {
      orders = [];
    } else {
      orders = data.map(o => ({
        ...o,
        total: Number(o.total || 0),
        envio_cobrado: Number(o.envio_cobrado || 0),
        costo_envio_real: Number(o.costo_envio_real || 0),
        subtotal: Number(o.subtotal || 0),
        dia_entrega: o.dia_entrega ? String(o.dia_entrega).slice(0,10) : null
      }));
    }

    // repopulate months when available
    if (document.getElementById("filter-month")) populateMonths();
    render();
  }catch(e){
    console.error(e);
    if (listEl) listEl.innerHTML = `<div class="card no-results">Error cargando pedidos</div>`;
  }
}
function toggleButtonConfirm(element, confirmado) {
  const msdConfirmed = element;
  if (!msdConfirmed) return;
  if (confirmado) {
      msdConfirmed.textContent = 'Confirmado';
      msdConfirmed.className = 'primary';
  }
  else if (!confirmado) {
      msdConfirmed.textContent = 'No confirmado';
      msdConfirmed.className = 'muted';
  }
}
function toggleButtonDelivered(element, entregado) {
  const msdDelivered = element;
  if (!msdDelivered) return;
  if (entregado) {
      msdDelivered.textContent = 'Entregado';
      msdDelivered.className = 'success';
  }
  else if (!entregado) {
      msdDelivered.textContent = 'No entregado';
      msdDelivered.className = 'muted';
  }
}
async function toggleConfirm(orderId){
  const headers = {};
  if (token) headers['x-api-key'] = token;
  const res = await fetch(API_URL + `orders/${orderId}/toggle-confirmed`, { method: 'POST', headers });
  if(!res.ok){
    console.error('Error toggling confirm');
    return;
  }
  const confirmado = await res.json().then(data => data.confirmado);
  const msgConfirmed = document.getElementById(`msg-confirmed-${orderId}`);
  toggleButtonConfirm(msgConfirmed, confirmado);
}
async function toggleDelivered(orderId){
  const headers = {};
  if (token) headers['x-api-key'] = token;
  const res = await fetch(API_URL + `orders/${orderId}/toggle-delivered`, { method: 'POST', headers });
  if(!res.ok){
    console.error('Error toggling delivered');
    return;
  }
  const entregado = await res.json().then(data => data.entregado);
  const msgDelivered = document.getElementById(`msg-delivered-${orderId}`);
  toggleButtonDelivered(msgDelivered, entregado);
}

// ===================== RENDER ORDERS =====================
function render() {
  if (!listEl) return;
  listEl.innerHTML = '';

  const q = (search && search.value || '').toLowerCase();
  const state = (filterStatus && filterStatus.value) || '';
  const exactDate = (filterDate && filterDate.value) || '';
  const monthFilter = (filterMonth && filterMonth.value) || '';
  const sortDir = (filterSort && filterSort.value) || 'desc';

  let filtered = orders.filter(o => {
    if (q) {
      const s = `${o.nombre_completo||''} ${o.correo||''} ${o.direccion||''}`.toLowerCase();
      if (!s.includes(q)) return false;
    }

    if (state === 'pendiente' && (o.confirmado || o.entregado)) return false;
    if (state === 'confirmado' && !o.confirmado) return false;
    if (state === 'entregado' && !o.entregado) return false;

    if (exactDate && o.dia_pedido !== exactDate) return false;

    if (monthFilter) {
      const month = o.dia_pedido ? o.dia_pedido.slice(0,7) : '';
      if (month !== monthFilter) return false;
    }

    return true;
  });

  // ORDENACIÓN por fecha
  filtered.sort((a,b)=>{
    const da = a.dia_pedido || '0000-00-00';
    const db = b.dia_pedido || '0000-00-00';
    return sortDir === 'asc'
      ? da.localeCompare(db)
      : db.localeCompare(da);
  });

  // PAGINADO
  const slice = filtered.slice(0, (page+1)*PAGE_SIZE);

  if (slice.length === 0) {
    listEl.innerHTML = `<div class="card no-results">No hay pedidos</div>`;
    return;
  }

  // RENDER
  for (const o of slice) {
    const card = document.createElement('div');
    card.className = 'order-card';

    card.innerHTML = `
      <h3>
        <span>${escapeHtml(o.nombre_completo || '—')}</span>
        <span class="muted small">#${o.id}</span>
      </h3>

      <p class="small">
        <span>${escapeHtml(o.correo || '')} </span> • <span id="phone-${o.id}">${escapeHtml(o.telefono || '')}</span>
      </p>

      <p class="small"> <span id="address-${o.id}">${escapeHtml(o.direccion || '')}</span></p>

      <p class="small">
        Pedido: <b>${recomputeDate(o.dia_pedido) || '-'}</b> •
        Entrega: <b>${recomputeDate(o.dia_entrega) || '-'}</b>
      </p>

      <p class="small">Total: <b>$${Number(o.total || 0)}</b></p>

      <p class="small">
        <span id="msg-confirmed-${o.id}" class=""></span> • <span id="msg-delivered-${o.id}" class=""></span>
       </p>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn small" data-id="${o.id}" data-action="edit" id="edit-${o.id}">Ver / Editar</button>
        <button class="btn ghost small" data-id="${o.id}" data-action="print" id="print-${o.id}">Imprimir</button>
        <button class="btn danger small" data-id="${o.id}" data-action="delete" id="delete-${o.id}">Eliminar</button>
      </div>
    `;


    const editBtn = card.querySelector('button[id="edit-' + o.id + '"]');
    const deleteBtn = card.querySelector('button[id="delete-' + o.id + '"]');
    const printBtn = card.querySelector('button[id="print-' + o.id + '"]');

    const msgConfirmed = card.querySelector(`#msg-confirmed-${o.id}`);
    const msgDelivered = card.querySelector(`#msg-delivered-${o.id}`);

    const phoneEl = card.querySelector(`#phone-${o.id}`);
    const addressEl = card.querySelector(`#address-${o.id}`);
    if (phoneEl) {
      phoneEl.onclick = () => { window.open(`https://wa.me/${encodeURIComponent(o.telefono || '')}`, '_blank'); };
      phoneEl.style.cursor = 'pointer';
    }
    if (addressEl) {
      addressEl.onclick = () => { window.open(`https://www.google.com/maps/search/${encodeURIComponent(o.direccion || '')}`, '_blank'); };
      addressEl.style.cursor = 'pointer';
    }

    if (msgConfirmed) {
      toggleButtonConfirm(msgConfirmed, o.confirmado);
      msgConfirmed.onclick = () => { toggleConfirm(o.id); };
      msgConfirmed.style.cursor = 'pointer';
    }

    if (msgDelivered) {
      toggleButtonDelivered(msgDelivered, o.entregado);
      msgDelivered.onclick = () => { toggleDelivered(o.id); };
      msgDelivered.style.cursor = 'pointer';
    }

    if (editBtn) editBtn.onclick = () => openEdit(o);
    if (printBtn) printBtn.onclick = () => printOrder(o.id);
    if (deleteBtn) deleteBtn.onclick = () => confirmAndDelete(o.id);

    listEl.appendChild(card);
  }
}

// ===================== ESCAPE HTML =====================
function escapeHtml(s){ if(s === null || s === undefined) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// mostrar mensaje temporal sin alerta


// ===================== DELETE ORDER =====================
async function confirmAndDelete(orderId){
  if(!confirm(`¿Eliminar pedido #${orderId}? Esta acción no se puede deshacer.`)) return;
  try{
    {
      const path = `orders/${orderId}`;
      const headers = {};
      if (token) headers['x-api-key'] = token;
      const res = await fetch(API_URL + path, { method: 'DELETE', headers });
      if(!res.ok){
        const txt = await res.text().catch(()=>'');
        throw new Error(txt || res.status);
      }
      if(res.status !== 204) await res.json();
    }
    toast('Pedido eliminado');
    await loadOrders();
  }catch(e){
    console.error(e);
    alert('Error eliminando pedido: ' + (e.message || e));
  }
}

// ===================== OPEN EDIT / CREATE =====================
if (btnNewOrder) btnNewOrder.addEventListener('click', ()=>{
  editingOrderId = null;
  if (modalTitle) modalTitle.textContent = 'Crear pedido';
  if (fNombre) fNombre.value = '';
  if (fCorreo) fCorreo.value = '';
  if (fTelefono) fTelefono.value = '';
  if (fDireccion) fDireccion.value = '';
  if (fDia) fDia.value = '';
  if (fEnvio) fEnvio.value = '';
  if (fCostoEnvio) fCostoEnvio.value = '';
  if (fComentario) fComentario.value = '';
  if (fConfirmado) fConfirmado.checked = false;
  if (fEntregado) fEntregado.checked = false;
  items = [];
  if (btnDeleteOrder) btnDeleteOrder.style.display = 'none';
  renderItemsTable();
  openModalUI();
});

async function get_order(orderId) {
  try {
    const path = `orders/${orderId}`;
    const headers = {};
    if (token) headers['x-api-key'] = token;

    const res = await fetch(API_URL + path, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || res.status);
    }

    // ✅ parse JSON
    const data = await res.json();

    const productos = data.productos || [];

    const items = productos.map(it => ({
      id: it.id,
      codigo: it.codigo || it.product_codigo || '',
      nombre: it.nombre || it.product_name || '',
      cantidad: it.cantidad || 1,
      precio_unitario: Number(it.precio_unitario || it.precio || 0)
    }));

    const order = data.order || {};

    order.productos = productos;
    order.items = items;

    return order;

  } catch (e) {
    console.error('Error cargando orden:', e);
    return null;
  }
}



async function openEdit(order){
  editingOrderId = order.id;
  if (modalTitle) modalTitle.textContent = `Editar pedido #${order.id}`;
  if (fNombre) fNombre.value = order.nombre_completo || '';
  if (fCorreo) fCorreo.value = order.correo || '';
  if (fTelefono) fTelefono.value = order.telefono || '';
  if (fTelefonoWpp) fTelefonoWpp.href = `https://wa.me/${encodeURIComponent(order.telefono || '')}`;
  if (fDireccionMaps) fDireccionMaps.href = `https://www.google.com/maps/search/${encodeURIComponent(order.direccion || '')}`;
  if (fDireccion) fDireccion.value = order.direccion || '';
  if (fDia) fDia.value = order.dia_entrega || '';
  if (fEnvio) fEnvio.value = order.envio_cobrado || 0;
  if (fCostoEnvio) fCostoEnvio.value = order.costo_envio_real || 0;
  if (fTotal) fTotal.value = order.total || 0;
  if (fComentario) fComentario.value = order.comentario || '';
  if (fConfirmado) fConfirmado.checked = !!order.confirmado;
  if (fEntregado) fEntregado.checked = !!order.entregado;
  if (btnDeleteOrder) btnDeleteOrder.style.display = 'inline-block';

  try{
    // obtener pedido con fetch local usando buildApiUrl
    const order_fetch = await get_order(order.id);
    items = order_fetch.items || [];
    renderItemsTable();
    openModalUI();
    modal.scrollTo(0,0);
}
  catch(e){
    console.error(e);
    alert('Error cargando pedido: ' + (e.message||e));
  }
}

function openModalUI(){
  if (!modal) return;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');
  if (productSearch) productSearch.focus();
}
function closeModalUI(){
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden','true');
}

async function get_image_link(codigo){
  if (!codigo) return '/media_static/placeholder.jpg';
  try{
    const res = await (async ()=>{
      const path = `products/by-codigo/${encodeURIComponent(codigo)}`;
      const headers = {};
      if (token) headers['x-api-key'] = token;
      const r = await fetch(API_URL + path, { method: 'GET', headers });
      if(!r.ok){
        const txt = await r.text().catch(()=>'');
        throw new Error(txt || r.status);
      }
      return r.status === 204 ? null : await r.json();
    })();
    if(res && res.imagen_url) return res.imagen_url;
    return '/media_static/placeholder.jpg';
  }catch(err){
    return '/media_static/placeholder.jpg';
  }
}

// ===================== ITEMS TABLE =====================
async function renderItemsTable(){
  if (!itemsTableBody) return;
  itemsTableBody.innerHTML = '';
  let subtotal = 0;

  // render rows synchronously, update images async
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const subtotalItem = (Number(it.cantidad||0) * Number(it.precio_unitario||0));
    subtotal += subtotalItem;

    const tr = document.createElement('tr');
    tr.className = 'item-row';



    const imgId = `item-img-${it.codigo.replace(/[^a-zA-Z0-9_-]/g,'_')}-${idx}`;

    tr.innerHTML = `
      <td class="item-img-conteiner"><img class="item-img" id="${imgId}" src="/media_static/placeholder.jpg" alt="Imagen de ${it.nombre}"></td>
      <td><input placeholder="Codigo" class="input item-codigo" data-idx="${idx}" data-field="codigo" value="${escapeHtml(it.codigo||'')}"></td>
      <td><input placeholder="Nombre" class="input item-nombre" data-idx="${idx}" data-field="nombre" value="${escapeHtml(it.nombre||'')}"></td>
      <td><input placeholder="Cantidad" class="input item-cantidad" data-idx="${idx}" data-field="cantidad" type="number"  value="${it.cantidad||1}"></td>
      <td><input placeholder="Precio Unitario" class="input item-precio_unitario" data-idx="${idx}" data-field="precio_unitario" type="number"  value="${it.precio_unitario||0}"></td>
      <td class="cell-subtotal">$${subtotalItem}</td>
      <td><button class="btn danger small item-eliminar" data-idx="${idx}" data-action="remove">Eliminar</button></td>
    `;
    itemsTableBody.appendChild(tr);
        (async () => {
      const imagen = await get_image_link(it.codigo);
      const imgEl = document.getElementById(imgId);
      if (imgEl) imgEl.src = imagen;
    })();
  }

  // update subtotal display
  if (calcSubtotal) calcSubtotal.textContent = subtotal;

  // attach listeners (re-query because we rebuilt DOM)
  itemsTableBody.querySelectorAll('input[data-field]').forEach(inp=>{
    inp.onchange = ()=>{
      const idx = Number(inp.dataset.idx);
      const field = inp.dataset.field;
      if (field === 'cantidad' || field === 'precio_unitario') items[idx][field] = Number(inp.value) || 0;
      else items[idx][field] = inp.value;
      // re-render to update subtotals and recalc totals
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

async function printOrder(orderID){
/*   const url = `${API_URL}orders/print/${orderId}`;
  window.open(url, '_blank'); */

  const order = await get_order(orderID);
  let print = window.open(' ', 'popimpr');
  print.document.write(generarHTMLPrint(order));
  print.document.close();
  print.print( );
  print.close();
}

// add temporary "varios" item
if (btnAddTemp) btnAddTemp.addEventListener('click', ()=>{
  const nombre = prompt('Nombre del artículo temporal (ej: Varios, Recargo):','Varios Almacen');
  if(!nombre) return;
  items.push({ codigo: '', nombre: nombre, cantidad: 1, precio_unitario: 0 });
  renderItemsTable();
});

if(btnPrintSome) btnPrintSome.addEventListener('click', async ()=>{
  let ordersSelected = [];
  //mostrar modal para seleccionar pedidos
  const input = prompt('Ingrese los IDs de los pedidos a imprimir, separados por comas (ej: 1,2,3):');
  if(!input) return;
  const ids = input.split(',').map(id=>Number(id.trim())).filter(id=>!isNaN(id));
  for(const id of ids){
    const order = await get_order(id);
    if(order) ordersSelected.push(order);
  }
  if(ordersSelected.length === 0){
    alert('No se encontraron pedidos con los IDs proporcionados.');
    return;
  }
  let htmlContent = generarHTMLPrint(ordersSelected);
  let print = window.open(' ', 'popimpr');
  print.document.write(htmlContent);
  print.document.close();
  print.print( );
  print.close();
});

// ===================== TYPEAHEAD IMPLEMENTATION =====================
if (productSearch) {
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
        // prefer server search endpoint (fetch local)
        const path = `products/search?q=${encodeURIComponent(q)}&limit=12`;
        const headers = {};
        if (token) headers['x-api-key'] = token;
        const r = await fetch(API_URL + path, { method: 'GET', headers });
        if(!r.ok) throw new Error(await r.text().catch(()=>r.status));
        const res = await r.json();
         typeaheadResults = (Array.isArray(res) ? res : []).map(p=>({
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
}

function openTypeahead(){
  if(!typeaheadList) return;
  if(!typeaheadResults || typeaheadResults.length === 0){ closeTypeahead(); return; }
  typeaheadList.innerHTML = '';
  typeaheadResults.forEach((r, i)=>{
    const div = document.createElement('div');
    div.className = 'typeahead-item' + (i===typeaheadActive ? ' active' : '');
    div.dataset.index = i;
    div.innerHTML = `<div><strong>${escapeHtml(r.nombre)}</strong><div class="meta">${escapeHtml(r.codigo)}</div></div><div class="meta">$${Number(r.precio||0)}</div>`;
    div.onclick = ()=> selectTypeahead(i);
    typeaheadList.appendChild(div);
  });
  typeaheadList.style.display = 'block';
  typeaheadOpen = true;
}

function renderTypeahead(){
  if(!typeaheadList) return;
  Array.from(typeaheadList.children).forEach((ch, idx)=> {
    ch.classList.toggle('active', idx === typeaheadActive);
    if(idx === typeaheadActive){
      ch.scrollIntoView({block:'nearest'});
    }
  });
}

function closeTypeahead(){
  if(!typeaheadList) return;
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
  if (productSearch) productSearch.value = '';
  closeTypeahead();
}

// click outside to close typeahead
document.addEventListener('click', (e)=>{
  if (productSearch && typeaheadList) {
    if(!productSearch.contains(e.target) && !typeaheadList.contains(e.target)) closeTypeahead();
  }
});

// ===================== IMPORT EXCEL =====================
if (btnImportExcel && fileExcel) {
  btnImportExcel.addEventListener('click', ()=> fileExcel.click());
  fileExcel.addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const fd = new FormData(); fd.append('file', f);
    try{
      // POST FormData para import
      {
        const path = 'orders/import-excel';
        const headers = {};
        if (token) headers['x-api-key'] = token;
        const res = await fetch(API_URL + path, { method: 'POST', headers, body: fd });
        if(!res.ok){
          const txt = await res.text().catch(()=>'');
          throw new Error(txt || res.status);
        }
        var r = res.status === 204 ? null : await res.json();
      }
      toast(`Importados: ${r.created}. Errores: ${r.errors?.length||0}`);
      if(r.errors && r.errors.length) console.warn('Errores import:', r.errors);
      await loadOrders();
    }catch(err){ console.error(err); alert('Error importando Excel: ' + (err.message||err)); }
  });
 }
 
 // ===================== SAVE modal (create or update) =====================
if (modalSave) modalSave.addEventListener('click', async ()=>{
  const payload = {
    nombre_completo: fNombre ? fNombre.value : '',
    correo: fCorreo ? fCorreo.value : '',
    telefono: fTelefono ? fTelefono.value : '',
    direccion: fDireccion ? fDireccion.value : '',
    dia_entrega: fDia ? fDia.value || null : null,
    envio_cobrado: Number(fEnvio ? fEnvio.value : 0) || 0,
    costo_envio_real: Number(fCostoEnvio ? fCostoEnvio.value : 0) || 0,
    comentario: fComentario ? fComentario.value : '',
    confirmado: Boolean(fConfirmado ? fConfirmado.checked : false),
    entregado: Boolean(fEntregado ? fEntregado.checked : false),
  };

  try{
    if (editingOrderId) {
      const fullPayload = {
        ...payload,
        items: items.map(it => ({
          codigo: it.codigo || "",
          nombre: it.nombre || "",
          cantidad: Number(it.cantidad || 1),
          precio_unitario: Number(it.precio_unitario || 0)
        }))
      };

      // PUT pedido
      {
        const path = `orders/${editingOrderId}`;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['x-api-key'] = token;
        const res = await fetch(API_URL + path, { method: 'PUT', headers, body: JSON.stringify(fullPayload) });
        if(!res.ok){
          const txt = await res.text().catch(()=>'');
          throw new Error(txt || res.status);
        }
        if(res.status !== 204) await res.json();
      }

       toast('Pedido actualizado');
     } else {
       const newPayload = {
         ...payload,
         items: items.map(it => ({
           codigo: it.codigo || "",
           nombre: it.nombre || "",
           cantidad: Number(it.cantidad || 1),
           precio_unitario: Number(it.precio_unitario || 0)
         }))
       };

      // POST crear pedido (ruta relativa)
      {
        const res = await fetch('https://plutarco-api.fly.dev/orders/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newPayload)
        });        
        if(!res.ok){
          const txt = await res.text().catch(()=>'');
          throw new Error(txt || res.status);
        }
        if(res.status !== 204) await res.json();
      }
       toast('Pedido creado');
     }

    await loadOrders();
    closeModalUI();
  }catch(e){
    console.error(e);
    alert('Error guardando pedido: ' + (e.message||e));
  }
 });

 if (modalCancel) modalCancel.addEventListener('click', ()=> closeModalUI());
 if (btnDeleteOrder) btnDeleteOrder.addEventListener('click', async ()=>{
   if(!editingOrderId) return;
   if(!confirm(`Confirmar eliminación de pedido #${editingOrderId}?`)) return;
   try{
    {
      const path = `orders/${editingOrderId}`;
      const headers = {};
      if (token) headers['x-api-key'] = token;
      const res = await fetch(API_URL + path, { method: 'DELETE', headers });
      if(!res.ok){
        const txt = await res.text().catch(()=>'');
        throw new Error(txt || res.status);
      }
      if(res.status !== 204) await res.json();
    }
     toast('Pedido eliminado');
     closeModalUI();
     await loadOrders();
   }catch(e){
     console.error(e);
     alert('Error eliminando pedido: ' + (e.message||e));
   }
 });

 function populateMonths() {
  const select = document.getElementById("filter-month");
  if(!select) return;
  const months = new Set();

  orders.forEach(o => {
    if (o.dia_pedido) {
      const m = o.dia_pedido.slice(0,7); // YYYY-MM
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
if (btnLoadMore) btnLoadMore.addEventListener('click', ()=> { page++; render(); });
if (search) search.addEventListener('input', ()=> { page = 0; render(); });
if (filterStatus) filterStatus.addEventListener('change', ()=> { page = 0; render(); });
if (filterDate) filterDate.addEventListener('change', ()=> { page = 0; render(); });
if (filterMonth) filterMonth.addEventListener("change", () => { page = 0; render(); });
if (filterSort) filterSort.addEventListener("change", () => { page = 0; render(); });

// init
(async () => {
  await loadOrders();   // << aseguramos que orders ya está cargado
  populateMonths();      // << ahora sí hay meses
  render();              // << y recién acá renderizamos
})();
