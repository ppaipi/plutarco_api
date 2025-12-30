const buttonSaveAllConfig = document.getElementById("btn-save-all-config");
const inputMinOrderAmount = document.getElementById("config-min-order-amount");
const inputCategoryOrder = document.getElementById("config-category-order");
const inputSubcategoryOrder = document.getElementById("config-subcategory-order");
const inputCategoryInput = document.getElementById("config-category-input");
const inputSubcategoryInput = document.getElementById("config-subcategory-input");
const btnAddCategory = document.getElementById("btn-add-category");
const btnAddSubcategory = document.getElementById("btn-add-subcategory");
const btnLogout = document.getElementById("btn-logout");
const btnTheme = document.getElementById("theme-toggle");
const tariffsTable = document.getElementById('tariffs-table');
const btnAddTariff = document.getElementById('btn-add-tariff');
const daysListEl = document.getElementById('days-list');

const msgConfig = document.getElementById("config-msg");
const msgDeliveryDays = document.getElementById("delivery-days-msg");
const msgCategoryOrder = document.getElementById("category-order-msg");

import API_URL from "./config.js";

function showMsg(el, text, ok = true) {
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? "green" : "red";
}

function createTariffRow(t = {km: '', price: ''}){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input class="input" data-km value="${t.km}"></td>
  <td><input class="input" data-price value="${t.price}"></td>
  <td><button class="small-btn btn-remove">Eliminar</button></td>`;
  const btn = tr.querySelector('.btn-remove');
  btn.addEventListener('click', ()=> tr.remove());
  return tr;
}

async function fetchCategoriesLists(){
  try{
    const headers = {};
    const tokenValue = localStorage.getItem('token');
    if (tokenValue) headers['x-api-key'] = tokenValue;

    const res1 = await fetch(window.location.origin + '/products/categories', { headers });
    const cats = res1.ok ? await res1.json() : [];
    const dl = document.getElementById('categories-list');
    dl.innerHTML = '';
    cats.forEach(c=> dl.appendChild(new Option(c)));

    const res2 = await fetch(window.location.origin + '/products/subcategories', { headers });
    const subs = res2.ok ? await res2.json() : [];
    const dl2 = document.getElementById('subcategories-list');
    dl2.innerHTML = '';
    subs.forEach(s=> dl2.appendChild(new Option(s)));
  }catch(e){console.warn('No se pudieron cargar listas:', e)}
}

async function fetchConfig() {
  try {
    const headers = {};
    const tokenValue = localStorage.getItem('token');
    if (tokenValue) headers['x-api-key'] = tokenValue;

    const response = await fetch(API_URL + "config/list", { method: 'GET', headers });
    if(!response.ok){
      const txt = await response.text().catch(()=> '');
      throw new Error(txt || response.status);
    }

    const config = response.status === 204 ? {} : await response.json();

    // Populate tariffs
    const tbody = tariffsTable.querySelector('tbody');
    tbody.innerHTML = '';
    const tarifas = config.envio_tarifas || [];
    if(tarifas.length === 0){
      tbody.appendChild(createTariffRow());
    } else {
      tarifas.forEach(t=> tbody.appendChild(createTariffRow(t)));
    }

    // Pedido mínimo
    inputMinOrderAmount.value = config.pedido_minimo || '';

    // Dias de entrega
    const days = config.dias_entrega || [];
    // ensure 7 rows
    daysListEl.innerHTML = '';
    const weekdayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    for(let i=0;i<7;i++){
      const found = days.find(d=> d.weekday === i) || {weekday:i, cutoff: ''};
      const row = document.createElement('div');
      row.className = 'day-row';
      row.innerHTML = `<label><input type="checkbox" data-weekday ${found.cutoff!=='' || (found.enabled? 'checked':'') ? 'checked':''}> ${weekdayNames[i]}</label>
        <input type="time" data-cutoff value="${found.cutoff || ''}">`;
      daysListEl.appendChild(row);
    }

    // categorias / subcategorias
    // set order inputs as comma separated values
    inputCategoryOrder.value = (config.orden_categorias || []).join(',');
    inputSubcategoryOrder.value = (config.orden_subcategorias || []).join(',');
    
    // render interactive tag lists (reorderable)
    renderTagListsFromConfig();

    // fill datalists
    fetchCategoriesLists();
  } catch (err) {
    console.error("Error cargando config:", err);
    showMsg(msgConfig, "⚠️ No se pudo cargar: " + err.message, false);
  }
}

async function saveConfig() {
  const tokenValue = localStorage.getItem('token');
  if (!tokenValue) {
    showMsg(msgConfig, "⚠️ Sin token de autenticación. Inicia sesión de nuevo.", false);
    return;
  }

  // build envio_tarifas from table
  const tarifas = [];
  tariffsTable.querySelectorAll('tbody tr').forEach(tr=>{
    const km = tr.querySelector('[data-km]').value;
    const price = tr.querySelector('[data-price]').value;
    if(km!=='' && price!=='') tarifas.push({km: parseFloat(km), price: parseFloat(price)});
  });

  // build dias_entrega from daysList
  const dias = [];
  daysListEl.querySelectorAll('.day-row').forEach((row,idx)=>{
    const enabled = row.querySelector('[data-weekday]').checked;
    const cutoff = row.querySelector('[data-cutoff]').value || '';
    if(enabled){ dias.push({weekday: idx, cutoff}); }
  });

  const payload = {
    envio_tarifas: tarifas,
    dias_entrega: dias,
    orden_categorias: inputCategoryOrder.value.split(',').map(s=>s.trim()).filter(s=>s),
    orden_subcategorias: inputSubcategoryOrder.value.split(',').map(s=>s.trim()).filter(s=>s),
    pedido_minimo: parseFloat(inputMinOrderAmount.value) || 0,
  };

  try{
    const headers = {'Content-Type':'application/json', 'x-api-key': tokenValue};
    const response = await fetch(API_URL + 'config/envio', {method:'PUT', headers, body: JSON.stringify(payload)});
    if(!response.ok){
      const txt = await response.text().catch(()=> '');
      throw new Error(txt || response.status);
    }
    showMsg(msgConfig, '✅ Configuración guardada.', true);
  }catch(err){
    console.error('Error guardando config:', err);
    showMsg(msgConfig, '❌ Error: ' + err.message, false);
  }
}

buttonSaveAllConfig.addEventListener("click", saveConfig);

document.addEventListener("DOMContentLoaded", () => {
  // Verificar si hay token; si no, redirigir a login
  const savedToken = localStorage.getItem("token");
  if (!savedToken) {
    window.location.href = "/login";
    return;
  }

  // ===== DARK MODE =====
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
    if(btnTheme) btnTheme.textContent = "☀️";
  }

  if (btnTheme) {
    btnTheme.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle("dark");
      btnTheme.textContent = isDark ? "☀️" : "🌙";
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }

  // Botón Salir: limpiar localStorage y redirigir a login
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "/login";
    });
  }
  
  // add tariff button
  if(btnAddTariff){
    btnAddTariff.addEventListener('click', ()=>{
      const tbody = tariffsTable.querySelector('tbody');
      tbody.appendChild(createTariffRow());
    });
  }
  
  // category and subcategory add buttons
  if(btnAddCategory) btnAddCategory.addEventListener('click', ()=>{
    const v = (inputCategoryInput.value || '').trim();
    if(v) { addTagToList('category', v); inputCategoryInput.value = ''; inputCategoryInput.focus(); }
  });
  if(btnAddSubcategory) btnAddSubcategory.addEventListener('click', ()=>{
    const v = (inputSubcategoryInput.value || '').trim();
    if(v) { addTagToList('subcategory', v); inputSubcategoryInput.value = ''; inputSubcategoryInput.focus(); }
  });
  
  // Enter key on inputs
  if(inputCategoryInput) inputCategoryInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') { e.preventDefault(); btnAddCategory.click(); }
  });
  if(inputSubcategoryInput) inputSubcategoryInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') { e.preventDefault(); btnAddSubcategory.click(); }
  });

  fetchCategoriesLists();
  fetchConfig();
});


function renderTagListsFromConfig(){
  // Clear existing
  const catContainer = document.getElementById('category-tags');
  const subContainer = document.getElementById('subcategory-tags');
  if(catContainer) catContainer.innerHTML = '';
  if(subContainer) subContainer.innerHTML = '';

  const catVals = (inputCategoryOrder.value || '').split(',').map(s=>s.trim()).filter(s=>s);
  const subVals = (inputSubcategoryOrder.value || '').split(',').map(s=>s.trim()).filter(s=>s);

  catVals.forEach(v=> addTagToList('category', v, false));
  subVals.forEach(v=> addTagToList('subcategory', v, false));
}

function addTagToList(kind, value, syncInput=true){
  const id = kind === 'category' ? 'category-tags' : 'subcategory-tags';
  const container = document.getElementById(id);
  if(!container) return;
  
  // prevent duplicates
  const existing = Array.from(container.querySelectorAll('.tag')).map(t=>t.dataset.value);
  if(existing.includes(value)) return;

  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.draggable = true;
  tag.dataset.value = value;
  tag.innerHTML = `<span class="tag-label">${value}</span>
    <div class="tag-actions">
      <button class="tag-btn btn-move-up" title="Subir">▲</button>
      <button class="tag-btn btn-move-down" title="Bajar">▼</button>
      <button class="tag-btn btn-delete" title="Eliminar">✖</button>
    </div>`;

  // drag handlers
  tag.addEventListener('dragstart', (e)=>{ 
    e.dataTransfer.setData('text/plain', value); 
    tag.classList.add('dragging'); 
    e.dataTransfer.effectAllowed = 'move'; 
  });
  tag.addEventListener('dragend', ()=>{ tag.classList.remove('dragging'); });

  // drop on another tag
  tag.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  tag.addEventListener('drop', (e)=>{
    e.preventDefault();
    const draggedValue = e.dataTransfer.getData('text/plain');
    if(!draggedValue) return;
    const draggedEl = Array.from(container.querySelectorAll('.tag')).find(t=>t.dataset.value === draggedValue);
    if(!draggedEl || draggedEl === tag) return;
    container.insertBefore(draggedEl, tag);
    syncInputFromTags(kind);
  });

  // action buttons
  tag.querySelector('.btn-delete').addEventListener('click', (e)=>{ 
    e.preventDefault();
    tag.remove(); 
    syncInputFromTags(kind); 
  });
  tag.querySelector('.btn-move-up').addEventListener('click', (e)=>{ 
    e.preventDefault();
    const prev = tag.previousElementSibling; 
    if(prev) container.insertBefore(tag, prev); 
    syncInputFromTags(kind); 
  });
  tag.querySelector('.btn-move-down').addEventListener('click', (e)=>{ 
    e.preventDefault();
    const next = tag.nextElementSibling; 
    if(next) container.insertBefore(next, tag); 
    syncInputFromTags(kind); 
  });

  // allow dropping at end (empty space)
  container.addEventListener('dragover', (e)=>{ e.preventDefault(); });
  container.addEventListener('drop', (e)=>{
    e.preventDefault();
    const draggedValue = e.dataTransfer.getData('text/plain');
    if(!draggedValue) return;
    const draggedEl = Array.from(container.querySelectorAll('.tag')).find(t=>t.dataset.value === draggedValue);
    if(!draggedEl) return;
    container.appendChild(draggedEl);
    syncInputFromTags(kind);
  });

  container.appendChild(tag);
  if(syncInput) syncInputFromTags(kind);
}

function syncInputFromTags(kind){
  const id = kind === 'category' ? 'category-tags' : 'subcategory-tags';
  const container = document.getElementById(id);
  if(!container) return;
  const values = Array.from(container.querySelectorAll('.tag')).map(t=>t.dataset.value);
  if(kind === 'category') inputCategoryOrder.value = values.join(',');
  else inputSubcategoryOrder.value = values.join(',');
}
