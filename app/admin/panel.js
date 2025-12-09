/* panel.js - Panel Admin Plutarco (Next-level)
   Requisitos backend:
   - POST /api/admin/login (form-urlencoded) -> { access_token }
   - GET  /api/products (ordenados por orden en backend)
   - PUT  /api/products/{id}/order  Body: { orden: int }
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
const modalUpload = document.getElementById("modal-upload");
const modalClose = document.getElementById("modal-close");

// file inputs
const fileExcel = document.getElementById("file-excel");
const btnUploadExcel = document.getElementById("btn-upload-excel");
const fileJson = document.getElementById("file-json");
const btnUploadJson = document.getElementById("btn-upload-json");
const fileCsv = document.getElementById("file-csv");
const btnUploadCsv = document.getElementById("btn-upload-csv");

// theme toggle (inject button to header actions if not present)
(function ensureThemeToggle(){
  const actions = document.querySelector('.actions');
  if(!actions) return;
  if(document.getElementById('theme-toggle')) return;
  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.className = 'btn small ghost';
  btn.textContent = '🌙';
  btn.title = 'Toggle theme';
  actions.prepend(btn);
  btn.addEventListener('click', toggleTheme);
  const saved = localStorage.getItem('theme');
  if(saved === 'dark') document.documentElement.classList.add('dark');
})();

function toggleTheme(){
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
}

// token helpers
function setToken(t){
  token = t;
  if(t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

// show/hide screens
function showLogin(){ loginScreen.classList.remove("hidden"); dashboard.classList.add("hidden"); btnLogout.hidden = true }
function showDashboard(){ loginScreen.classList.add("hidden"); dashboard.classList.remove("hidden"); btnLogout.hidden = false }

// api helper
async function api(path, method="GET", body=null, isForm=false){
  const headers = {};
  if(token) headers['x-api-key'] = token;
  if(!isForm && body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if(body) opts.body = isForm ? body : JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if(!res.ok){
    const txt = await res.text();
    throw new Error(txt || res.status);
  }
  if(res.status === 204) return null;
  return res.json();
}

/* ------------------ LOGIN ------------------ */
btnLogin.addEventListener('click', async ()=>{
  loginMsg.textContent = '';
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  if(!user || !pass){ loginMsg.textContent = 'Completá usuario y contraseña'; return; }
  try{
    const form = new URLSearchParams();
    form.append('username', user); form.append('password', pass);
    const r = await fetch(API_BASE + '/api/admin/login', { method: 'POST', body: form });
    if(!r.ok) throw new Error('Login failed');
    const data = await r.json();
    setToken(data.access_token);
    showDashboard();
    await loadProducts(true);
  }catch(e){
    console.error(e);
    loginMsg.textContent = 'Credenciales incorrectas';
  }
});

btnLogout.addEventListener('click', ()=>{
  setToken(null);
  showLogin();
});

/* ------------------ PRODUCTS ------------------ */
async function loadProducts(force=false){
  try{
    statsEl.textContent = 'Cargando productos...';
    const all = await api('/api/products'); // backend returns ordered by orden
    products = all || [];
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

function renderList(list){
  listEl.innerHTML = '';
  if(!list.length){ listEl.innerHTML = '<div class="no-results card">No hay productos</div>'; return; }

  // build DOM and attach drag/drop attributes
  list.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = 'product-card';
    div.draggable = true;
    div.dataset.codigo = p.codigo;
    div.dataset.id = p.id;
    div.dataset.index = idx;

    const imagen = p.imagen_url ? p.imagen_url : 'placeholder.jpg';

    div.innerHTML = `
      <div class="thumb"><img src="${escapeHtml(imagen)}" alt="${escapeHtml(p.nombre)}" onerror="this.src='placeholder.jpg'"></div>
      <div class="meta">
        <h4 title="${escapeHtml(p.nombre)}">${escapeHtml(p.nombre)}</h4>
        <p class="small">${escapeHtml(p.codigo)} • ${escapeHtml(p.categoria||'')}</p>
        <div class="row">
          <label class="small">Orden:
            <input type="number" class="inp-order" value="${p.orden||0}" min="0">
          </label>
          <label class="small">Habilitado:
            <input type="checkbox" class="inp-enabled" ${p.habilitado ? 'checked' : ''}>
          </label>
          <button class="thumb-button btn-img">Imagen</button>
        </div>
      </div>
    `;

    // order change
    div.querySelector('.inp-order').addEventListener('change', async (ev)=>{
      const v = Number(ev.target.value) || 0;
      try{
        await api(`/products/${p.id}/order`, 'PUT', { orden: v });
        p.orden = v;
        await loadProducts(true);
      }catch(err){ alert('No se pudo actualizar orden'); console.error(err); }
    });

    // habilitado toggle
    div.querySelector('.inp-enabled').addEventListener('change', async (ev)=>{
      const val = Boolean(ev.target.checked);
      try{
        await api(`/products/${p.id}/state`, 'PUT', { habilitado: val });
        p.habilitado = val;
        renderFiltered();
      }catch(err){ alert('No se pudo actualizar estado'); console.error(err); }
    });

    // open modal image
    div.querySelector('.btn-img').addEventListener('click', ()=>{
      currentEditCodigo = p.codigo;
      modalPreview.src = p.imagen_url ? p.imagen_url : 'placeholder.jpg';
      modalFile.value = '';
      modal.setAttribute('aria-hidden','false');
    });

    // drag events
    div.addEventListener('dragstart', (e)=> {
      e.dataTransfer.setData('text/plain', p.codigo);
      div.classList.add('dragging');
    });
    div.addEventListener('dragend', ()=> div.classList.remove('dragging'));

    // allow drop on others
    div.addEventListener('dragover', (e)=> {
      e.preventDefault();
      const after = getDragAfterElement(listEl, e.clientY);
      const dragging = document.querySelector('.product-card.dragging');
      if(!dragging) return;
      if(after == null) listEl.appendChild(dragging);
      else listEl.insertBefore(dragging, after);
    });

    listEl.appendChild(div);
  });

  // when user finishes drag (drop anywhere), compute new order and save
  listEl.addEventListener('drop', async (e)=>{
    e.preventDefault();
    // compute new orders from DOM order
    const nodes = Array.from(listEl.querySelectorAll('.product-card'));
    const updates = [];
    for(let i=0;i<nodes.length;i++){
      const node = nodes[i];
      const id = Number(node.dataset.id);
      const newOrden = i + 1; // 1-based ranking
      const prod = products.find(x=>x.id === id);
      if(prod && prod.orden !== newOrden){
        updates.push({ id, orden: newOrden, codigo: node.dataset.codigo });
      }
    }
    if(updates.length === 0){ return; }
    // save sequentially to backend
    try{
      for(const u of updates){
        await api(`/products/${u.id}/order`, 'PUT', { orden: u.orden });
      }
      // reload
      await loadProducts(true);
      alert('Orden guardado');
    }catch(err){
      console.error(err);
      alert('Error guardando ordenes');
    }
  }, { once: false });
}

// helper to find drop position
function getDragAfterElement(container, y){
  const draggableElements = [...container.querySelectorAll('.product-card:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if(offset < 0 && offset > closest.offset){
      return { offset: offset, element: child };
    }else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
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
    await api(`/products/${currentEditCodigo}/upload-image`, 'POST', fd, true);
    modal.setAttribute('aria-hidden','true');
    await loadProducts(true);
    alert('Imagen subida correctamente');
  }catch(err){ console.error(err); alert('Error subiendo imagen'); }
});

/* ------------------ IMPORTERS ------------------ */
btnUploadExcel.addEventListener('click', ()=> fileExcel.click());
fileExcel.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    const r = await api('/products/import', 'POST', fd, true);
    alert(`Import: ${r.created} creados, ${r.updated} actualizados, ${r.skipped} saltados`);
    await loadProducts(true);
  }catch(err){ console.error(err); alert('Error importando Excel') }
});

btnUploadJson.addEventListener('click', ()=> fileJson.click());
fileJson.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    await api('/products/import-habilitados', 'POST', fd, true);
    alert('Habilitados importados');
    await loadProducts(true);
  }catch(err){ console.error(err); alert('Error importando JSON') }
});

btnUploadCsv.addEventListener('click', ()=> fileCsv.click());
fileCsv.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const fd = new FormData(); fd.append('file', f);
  try{
    await api('/products/import-ordenes', 'POST', fd, true);
    alert('Ordenes importadas');
    await loadProducts(true);
  }catch(err){ console.error(err); alert('Error importando CSV') }
});

/* ------------------ LOAD MORE / INIT ------------------ */
loadMoreBtn.addEventListener('click', ()=> { visibleCount += PAGE_STEP; renderFiltered(); });

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

if(token){ showDashboard(); loadProducts(true); } else showLogin();
