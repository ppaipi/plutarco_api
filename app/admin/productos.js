/* panel.js - Panel Admin Plutarco (Next-level)
   Requisitos backend:
   - POST /login (form-urlencoded) -> { access_token }
   - GET  /products (ordenados por orden en backend)
   - PUT  /products/{id}/order  Body: { orden: int }
   - PUT  /products/{id}/state       Body: { habilitado: bool }  <-- existing
   - POST /products/{codigo}/upload-image  (FormData file)
   - POST /products/import (FormData file)
   - POST /products/import-habilitados (FormData file)
   - POST /products/import-ordenes (FormData file)
*/

const API_BASE = ""; // ruta relativa

// state
let token = localStorage.getItem("token") || null;
let products = [];
let visibleCount = 50;
const PAGE_STEP = 50;
let currentEditCodigo = null;
let currentImgLink = null;

// DOM
const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");
const btnLogout = document.getElementById("btn-logout");
const listEl = document.getElementById("list");
const statsEl = document.getElementById("stats");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("filter-category");
const onlyEnabledCheckbox = document.getElementById("only-enabled");
const loadMoreBtn = document.getElementById("btn-load-more");

// modal
const modal = document.getElementById("modal");
const modalPreview = document.getElementById("modal-preview");
const modalFile = document.getElementById("modal-file");
const modalDelete = document.getElementById("modal-delete");
const modalUpload = document.getElementById("modal-upload");
const modalClose = document.getElementById("modal-close");

// file inputs
const fileExcel = document.getElementById("file-excel");
const btnUploadExcel = document.getElementById("btn-upload-excel");
const fileJson = document.getElementById("file-json");
const btnUploadJson = document.getElementById("btn-upload-json");
const fileCsv = document.getElementById("file-csv");
const btnUploadCsv = document.getElementById("btn-upload-csv");

// === MODO OSCURO ===
const btnTheme = document.getElementById("theme-toggle");

// cargar tema guardado
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
  btnTheme.textContent = "☀️";
}

// evento para cambiar el tema
btnTheme.addEventListener("click", () => {
  const isDark = document.documentElement.classList.toggle("dark");
  btnTheme.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// token helpers
function setToken(t){
  token = t;
  if(t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

// show/hide screens
function showLogin(){ window.location.href = '/login'; }
function showDashboard(){ loginScreen.classList.add("hidden"); dashboard.classList.remove("hidden"); btnLogout.hidden = false }

const API_URL = "https://api.plutarcoalmacen.com.ar/";

// Logout
btnLogout.addEventListener('click', ()=>{
  setToken(null);
  window.location.href = '/login';
});

/* ------------------ PRODUCTS ------------------ */
async function loadProducts(force=false){
  try{
    statsEl.textContent = 'Cargando productos...';

    const headers = {};
    if(token) headers['x-api-key'] = token;

    // SIEMPRE usa API_URL con la barra final
    const res = await fetch(API_URL + "products/", {
      method: "GET",
      headers,
    });

    if(!res.ok){
      const txt = await res.text();
      throw new Error(txt || res.status);
    }

    const all = res.status === 204 ? [] : await res.json();

    products = all;
    populateCategories();
    visibleCount = PAGE_STEP;
    renderFiltered();
    statsEl.textContent = `Productos: ${products.length}`;
  }catch(e){
    console.error(e);
    statsEl.textContent = 'Error cargando productos';
  }
}


function populateCategories(){
  const cats = Array.from(new Set(products.map(p => (p.categoria||'').trim()).filter(Boolean)));
  categorySelect.innerHTML = '<option value="">Todas categorías</option>';
  cats.sort().forEach(c=>{
    const op = document.createElement('option'); op.value = c; op.textContent = c; categorySelect.appendChild(op);
  });
}

/* SEARCH & FILTER */
let searchTerm = '';
let searchTimer = null;
searchInput.addEventListener('input', (e)=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=> {
    searchTerm = e.target.value.trim().toLowerCase();
    renderFiltered();
  }, 180);
});
categorySelect.addEventListener('change', renderFiltered);
onlyEnabledCheckbox.addEventListener('change', renderFiltered);

/* RENDER + ORDERING (ensures sorted by orden) */
function renderFiltered(){
  let list = products.slice();

  // always sort by orden asc (null/undefined -> big number)
  list.sort((a,b)=> (Number.isFinite(a.orden)?a.orden:999999) - (Number.isFinite(b.orden)?b.orden:999999));

  if(onlyEnabledCheckbox.checked) list = list.filter(p => p.habilitado === true);
  const cat = categorySelect.value;
  if(cat) list = list.filter(p => (p.categoria||'').toLowerCase() === cat.toLowerCase());
  if(searchTerm){
    list = list.filter(p => ((p.nombre||'') + ' ' + (p.codigo||'') + ' ' + (p.descripcion||'')).toLowerCase().includes(searchTerm));
  }

  renderList(list.slice(0, visibleCount));
  if(list.length > visibleCount) loadMoreBtn.classList.remove('hidden'); else loadMoreBtn.classList.add('hidden');
  statsEl.textContent = `Mostrando ${Math.min(visibleCount, list.length)} de ${list.length}`;
}

function renderList(list) {
  listEl.innerHTML = '';
  if (!list.length) {
    listEl.innerHTML = '<div class="no-results card">No hay productos</div>';
    return;
  }

  list.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = 'product-card';
    div.dataset.codigo = p.codigo;
    div.dataset.id = p.id;
    div.dataset.index = idx;

    const imagen = p.imagen_url ? p.imagen_url : '/media_static/placeholder.jpg';

    div.innerHTML = `
      <div class="thumb">
        <img src="${escapeHtml(imagen)}" alt="${escapeHtml(p.nombre)}"
        onerror="this.src='/media_static/placeholder.jpg'">
      </div>

      <div class="meta">
        <h4 title="${escapeHtml(p.nombre)}">${escapeHtml(p.nombre)}</h4>
        <p class="small">${escapeHtml(p.codigo)} • $${escapeHtml(p.precio || '')}</p>
        ${p.categoria || p.subcategoria ? `<p class="small">${escapeHtml(p.categoria || '')} • ${escapeHtml(p.subcategoria || '')}</p>` : ''}

        <div class="row">
          <label class="small">Orden:
            <input type="number" class="inp-order" value="${p.orden || 0}" min="0">
          </label>

          <label class="small">Habilitado:
            <input type="checkbox" class="inp-enabled" ${p.habilitado ? 'checked' : ''}>
          </label>

          <button class="thumb-button btn-img">Imagen</button>
        </div>

        <div class="order-buttons">
          <button class="btn-up">▲</button>
          <button class="btn-down">▼</button>
        </div>
      </div>
    `;

  // CAMBIAR ORDEN con input
  div.querySelector('.inp-order').addEventListener('change', async (ev) => {
    const v = Number(ev.target.value) || 0;
    try {
      // PUT directo para actualizar orden
      {
        const path = `products/${p.id}/order`; // sin slash final
        const headers = {};
        if(token) headers['x-api-key'] = token;
        headers['Content-Type'] = 'application/json';
        const opts = { method: 'PUT', headers, body: JSON.stringify({ orden: v }) };
        const res = await fetch(API_URL + path, opts);
        if(!res.ok){
          const txt = await res.text();
          throw new Error(txt || res.status);
        }
        if(res.status !== 204) await res.json();
      }

      p.orden = v;

      if (!suppressOrderReload) {
        await loadProducts(true);
      }

    } catch (err) {
      alert('No se pudo actualizar orden');
      console.error(err);
    }
  });

  // CAMBIAR ESTADO HABILITADO con checkbox
  div.querySelector('.inp-enabled').addEventListener('change', async (ev) => {
    const isEnabled = ev.target.checked;
    try {
      const path = `products/${p.id}/state`; // sin slash final
      const headers = {};
      if(token) headers['x-api-key'] = token;
      headers['Content-Type'] = 'application/json';
      const opts = { method: 'PUT', headers, body: JSON.stringify({ habilitado: isEnabled }) };
      const res = await fetch(API_URL + path, opts);
      if(!res.ok){
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      if(res.status !== 204) await res.json();

      // actualizar en memoria
      p.habilitado = isEnabled;

    } catch (err) {
      alert('No se pudo actualizar estado');
      console.error(err);
      ev.target.checked = !isEnabled; // revertir checkbox si hay error
    }
  });



    // MODAL IMAGEN
    div.querySelector('.btn-img').addEventListener('click', () => {
      currentEditCodigo = p.codigo;
      currentImgLink = p.imagen_url || null;
      modalPreview.src = p.imagen_url ? p.imagen_url : '/media_static/placeholder.jpg';
      modalFile.value = '';
      modal.setAttribute('aria-hidden', 'false');
    });

    // BOTÓN SUBIR
    div.querySelector('.btn-up').addEventListener('click', async () => {
      await moveProduct(p.id, -1);
    });

    // BOTÓN BAJAR
    div.querySelector('.btn-down').addEventListener('click', async () => {
      await moveProduct(p.id, +1);
    });

    listEl.appendChild(div);
  });
}
/* @router.put("/{product_id}/state")
def api_set_state(product_id: int, payload: dict):
 */
async function moveProduct(productId, direction) {
  // SIEMPRE trabajar sobre una lista ordenada real (no sobre products)
  const sorted = [...products].sort((a, b) => 
    (a.orden ?? 999999) - (b.orden ?? 999999)
  );

  const index = sorted.findIndex(p => p.id === productId);
  if (index === -1) return;

  const newIndex = index + direction;

  // fuera de rango
  if (newIndex < 0 || newIndex >= sorted.length) return;

  // intercambiar
  const temp = sorted[index];
  sorted[index] = sorted[newIndex];
  sorted[newIndex] = temp;

  // reasignar orden secuencial correcto sin romper nada
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].orden = i + 1;
  }

  try {
    // GUARDA SOLO LOS DOS QUE CAMBIARON
    {
      const pathA = `products/${sorted[index].id}/order`; // sin slash final
      const headersA = {}; if(token) headersA['x-api-key'] = token; headersA['Content-Type'] = 'application/json';
      const optsA = { method: 'PUT', headers: headersA, body: JSON.stringify({ orden: sorted[index].orden }) };
      const resA = await fetch(API_URL + pathA, optsA);
      if(!resA.ok){ const txt = await resA.text(); throw new Error(txt || resA.status); }
    }

    {
      const pathB = `products/${sorted[newIndex].id}/order`; // sin slash final
      const headersB = {}; if(token) headersB['x-api-key'] = token; headersB['Content-Type'] = 'application/json';
      const optsB = { method: 'PUT', headers: headersB, body: JSON.stringify({ orden: sorted[newIndex].orden }) };
      const resB = await fetch(API_URL + pathB, optsB);
      if(!resB.ok){ const txt = await resB.text(); throw new Error(txt || resB.status); }
    }

    // recargar una sola vez
    await loadProducts(true);

  } catch (err) {
    console.error(err);
    alert("Error reordenando");
  }
}




/* ------------------ MODAL IMAGE ------------------ */
modalClose.addEventListener('click', ()=> modal.setAttribute('aria-hidden','true'));
modalFile.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  modalPreview.src = URL.createObjectURL(f);
});
modalUpload.addEventListener('click', async ()=>{
  const f = modalFile.files[0];
  if(!f){ alert('Elegí una imagen'); return; }
  const ext = f.name.split('.').pop().toLowerCase();
  if(!['jpg','jpeg','png','webp'].includes(ext)){ alert('Formato inválido'); return; }
  const fd = new FormData(); fd.append('file', f);
  try{
    // POST FormData directo (sin Content-Type)
    {
      const path = `images/upload/${currentEditCodigo}/`; // sin slash final
      const headers = {};
      if(token) headers['x-api-key'] = token;
      const opts = { method: 'POST', headers, body: fd };
      const res = await fetch(API_URL + path, opts);
      if(!res.ok){
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      if(res.status !== 204) await res.json();
    }

    modal.setAttribute('aria-hidden','true');
    await loadProducts(true);
    alert('Imagen subida correctamente');
  }catch(err){ console.error(err); alert('Error subiendo imagen'); }
});
modalDelete.addEventListener('click', async ()=>{
  if(!confirm('¿Eliminar imagen del producto?')) return;
  if(!currentImgLink){ alert('El producto no tiene imagen'); return; }
  if(currentImgLink[0] === '/') currentImgLink = currentImgLink.slice(1);
  try{
    // DELETE imagen
    {
      const path = `${currentImgLink}`; // sin slash final
      const headers = {};
      if(token) headers['x-api-key'] = token;
      const opts = { method: 'DELETE', headers };
      const res = await fetch(API_URL + path, opts);
      if(!res.ok){
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
    }

    modal.setAttribute('aria-hidden','true');
    await loadProducts(true);
    alert('Imagen eliminada correctamente');
  }catch(err){ console.error(err); alert('Error eliminando imagen'); }
});
/* ------------------ IMPORTERS ------------------ */
btnUploadExcel.addEventListener('click', ()=> fileExcel.click());
fileExcel.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    // POST FormData para import
    {
      const path = 'products/import'; // sin slash final
      const headers = {};
      if(token) headers['x-api-key'] = token;
      const opts = { method: 'POST', headers, body: fd };
      const res = await fetch(API_URL + path, opts);
      if(!res.ok){ const txt = await res.text(); throw new Error(txt || res.status); }
      var r = res.status === 204 ? null : await res.json();
    }

    alert(`Import: ${r.created} creados, ${r.updated} actualizados, ${r.skipped} saltados`);
    await loadProducts(true);
  }catch(err){ console.error(err); alert('Error importando Excel') }
});

btnUploadJson.addEventListener('click', ()=> fileJson.click());
fileJson.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    {
      const path = 'products/import-habilitados'; // sin slash final
      const headers = {}; if(token) headers['x-api-key'] = token;
      const opts = { method: 'POST', headers, body: fd };
      const res = await fetch(API_URL + path, opts);
      if(!res.ok){ const txt = await res.text(); throw new Error(txt || res.status); }
      if(res.status !== 204) await res.json();
    }

    alert('Habilitados importados');
    await loadProducts(true);
  }catch(err){ console.error(err); alert('Error importando JSON') }
});

btnUploadCsv.addEventListener('click', ()=> fileCsv.click());
fileCsv.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    {
      const path = 'products/import-ordenes'; // sin slash final
      const headers = {}; if(token) headers['x-api-key'] = token;
      const opts = { method: 'POST', headers, body: fd };
      const res = await fetch(API_URL + path, opts);
      if(!res.ok){ const txt = await res.text(); throw new Error(txt || res.status); }
      if(res.status !== 204) await res.json();
    }

    alert('Ordenes importadas');
    await loadProducts(true);
  }catch(err){ console.error(err); alert('Error importando CSV') }
});

/* ------------------ LOAD MORE / INIT ------------------ */
loadMoreBtn.addEventListener('click', ()=> { visibleCount += PAGE_STEP; renderFiltered(); });

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Check token on init - rediijo a login si no hay token
if(token){ showDashboard(); loadProducts(true); } else { window.location.href = API_URL + 'login/'; }
