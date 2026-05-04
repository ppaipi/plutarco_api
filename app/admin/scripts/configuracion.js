const buttonSaveAllConfig = document.getElementById("btn-save-all-config");
const inputMinOrderAmount = document.getElementById("config-min-order-amount");
const inputCategoryInput = document.getElementById("config-category-input");
const inputCategoryEmoji = document.getElementById("config-category-emoji");
const inputCategoryColor = document.getElementById("config-category-color");
const inputSubcategoryInput = document.getElementById("config-subcategory-input");
const inputSubcategoryEmoji = document.getElementById("config-subcategory-emoji");
const inputSubcategoryColor = document.getElementById("config-subcategory-color");
const tariffsTable = document.getElementById('tariffs-table');
const btnAddCategory = document.getElementById("btn-add-category");
const btnAddSubcategory = document.getElementById("btn-add-subcategory");
const inputStoreStatus = document.getElementById("config-store-status");
const msgStoreStatus = document.getElementById("store-status-msg");
const inputAnuncioHabilitado = document.getElementById("anuncio-store-status");
const imgAnuncio = document.getElementById("anuncio-img");
const btnAnuncioUpload = document.getElementById("anuncio-button");
const btnAddTariff = document.getElementById('btn-add-tariff');
const daysListEl = document.getElementById('days-list');

const msgConfig = document.getElementById("config-msg");
const msgDeliveryDays = document.getElementById("delivery-days-msg");
const msgCategoryOrder = document.getElementById("category-order-msg");

import API_URL from "./config.js";
import {TOKEN} from "./config.js";
let api_key = TOKEN;

function showMsg(el, text, ok = true) {
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${ok ? 'success' : 'error'}`;
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
    if (api_key) headers['x-api-key'] = api_key;

    const res1 = await fetch(API_URL + 'products/categories', { headers });
    const cats = res1.ok ? await res1.json() : [];
    const dl = document.getElementById('categories-list');
    dl.innerHTML = '';
    cats.forEach(c=> dl.appendChild(new Option(c)));

    const res2 = await fetch(API_URL + 'products/subcategories', { headers });
    const subs = res2.ok ? await res2.json() : [];
    const dl2 = document.getElementById('subcategories-list');
    dl2.innerHTML = '';
    subs.forEach(s=> dl2.appendChild(new Option(s)));
  }catch(e){console.warn('No se pudieron cargar listas:', e)}
}

async function fetchConfig() {
  try {
    const headers = {};
    if (api_key) headers['x-api-key'] = api_key;

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
    // store status
    inputStoreStatus.checked = config.status !== false;
    msgStoreStatus.value = config.mensage_status || '';

    // anuncio
    inputAnuncioHabilitado.checked = config.anuncio_habilitado || false;
    if (config.anuncio_imagen_url) {
      imgAnuncio.src =config.anuncio_imagen_url;
      imgAnuncio.style.display = 'block';
    } else {
      imgAnuncio.style.display = 'none';
    }

    //empleados
    initEmpleados(config || {});

    // categorias / subcategorias - Nueva estructura con emoji y color
    renderTagListsFromConfig(config);
  } catch (err) {
    console.error("Error cargando config:", err);
    showMsg(msgConfig, "⚠️ No se pudo cargar: " + err.message, false);
  }
}

// ============ CONFIG EMPLEADOS (FUENTE DE VERDAD) ============

const employeesContainer = document.getElementById('employees-container');
const addEmployeeBtn = document.getElementById('btn-add-employee');
const hiddenEmployeesInput = document.getElementById('config-employees-data');

let empleados = [];

/**
 * Renderiza la lista de empleados
 */
function renderEmpleados() {
  employeesContainer.innerHTML = '';

  empleados.forEach((nombre, index) => {
    const row = document.createElement('div');
    row.className = 'empleado-row';

    row.innerHTML = `
      <input
        type="text"
        class="input empleado-name"
        value="${nombre}"
        placeholder="Nombre del empleado"
      >
      <button class="small-btn btn-remove">Eliminar</button>
    `;

    // editar nombre
    row.querySelector('.empleado-name').addEventListener('input', (e) => {
      empleados[index] = e.target.value;
      syncHiddenInput();
    });

    // eliminar
    row.querySelector('.btn-remove').addEventListener('click', () => {
      empleados.splice(index, 1);
      syncHiddenInput();
      renderEmpleados();
    });

    employeesContainer.appendChild(row);
  });

  syncHiddenInput();
}

/**
 * Agrega un empleado vacío
 */
addEmployeeBtn.addEventListener('click', () => {
  empleados.push('');
  renderEmpleados();
});

/**
 * Sincroniza con el input hidden
 */
function syncHiddenInput() {
  hiddenEmployeesInput.value = JSON.stringify(
    empleados.filter(e => e.trim() !== '')
  );
}

/**
 * Inicializar desde config
 */
function initEmpleados(config) {
  if (!config || !Array.isArray(config.empleados)) return;
  empleados = [...config.empleados];
  renderEmpleados();
}


async function saveConfig() {
  if (!api_key) {
    showMsg(msgConfig, "⚠️ Sin API KEY. Inicia sesión de nuevo.", false);
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
  const storeStatus = inputStoreStatus.checked;
  const storeMsg = msgStoreStatus.value || "";

  // build categorías/subcategorías con emoji y color desde las tablas
  const categorias = [];
  document.querySelectorAll('#category-table tbody tr').forEach(row => {
    const name = row.querySelector('.name-cell').textContent;
    const emoji = row.querySelector('.emoji-cell').textContent === '—' ? '' : row.querySelector('.emoji-cell').textContent;
    const color = rgbToHex(row.querySelector('.color-preview').style.backgroundColor) || '#3b82f6';
    if (name) categorias.push({ name, emoji, color });
  });

  const subcategorias = [];
  document.querySelectorAll('#subcategory-table tbody tr').forEach(row => {
    const name = row.querySelector('.name-cell').textContent;
    const emoji = row.querySelector('.emoji-cell').textContent === '—' ? '' : row.querySelector('.emoji-cell').textContent;
    const color = rgbToHex(row.querySelector('.color-preview').style.backgroundColor) || '#3b82f6';
    if (name) subcategorias.push({ name, emoji, color });
  });

  // build payload
  const payload = {
    envio_tarifas: tarifas,
    dias_entrega: dias,
    orden_categorias: categorias,
    orden_subcategorias: subcategorias,
    pedido_minimo: parseFloat(inputMinOrderAmount.value) || 0,
    status: storeStatus,
    mensage_status: storeMsg,
    empleados: empleados,
    anuncio_habilitado: inputAnuncioHabilitado.checked
  };

  try{
    const headers = {'Content-Type':'application/json', 'x-api-key': api_key};
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
  // anuncio upload button
  if(btnAnuncioUpload){
    btnAnuncioUpload.addEventListener('click', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
          const headers = {};
          if (api_key) headers['Authorization'] = `Bearer ${api_key}`;
          const res = await fetch(API_URL + 'config/anuncio/upload', {
            method: 'POST',
            headers,
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            imgAnuncio.src = API_URL + data.url;
            imgAnuncio.style.display = 'block';
            showMsg(msgConfig, "Imagen del anuncio subida correctamente", true);
          } else {
            showMsg(msgConfig, "Error subiendo imagen", false);
          }
        } catch (err) {
          showMsg(msgConfig, "Error: " + err.message, false);
        }
      };
      input.click();
    });
  }
    btnAddTariff.addEventListener('click', ()=>{
      const tbody = tariffsTable.querySelector('tbody');
      tbody.appendChild(createTariffRow());
    });
  
  
  // category and subcategory add buttons
  if(btnAddCategory) btnAddCategory.addEventListener('click', ()=>{
    const name = (inputCategoryInput.value || '').trim();
    const emoji = (inputCategoryEmoji.value || '').trim();
    const color = inputCategoryColor.value || '#0b76ff';
    if(name) { 
      addTagToList('category', {name, emoji, color}); 
      inputCategoryInput.value = ''; 
      inputCategoryEmoji.value = '';
      inputCategoryColor.value = '#0b76ff';
      inputCategoryInput.focus(); 
    }
  });
  if(btnAddSubcategory) btnAddSubcategory.addEventListener('click', ()=>{
    const name = (inputSubcategoryInput.value || '').trim();
    const emoji = (inputSubcategoryEmoji.value || '').trim();
    const color = inputSubcategoryColor.value || '#0b76ff';
    if(name) { 
      addTagToList('subcategory', {name, emoji, color}); 
      inputSubcategoryInput.value = ''; 
      inputSubcategoryEmoji.value = '';
      inputSubcategoryColor.value = '#0b76ff';
      inputSubcategoryInput.focus(); 
    }
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

function showEditModal(kind, row) {
  const name = row.querySelector('.name-cell').textContent;
  const emoji = row.querySelector('.emoji-cell').textContent === '—' ? '' : row.querySelector('.emoji-cell').textContent;
  const color = row.querySelector('.color-preview').style.backgroundColor || '#3b82f6';
  
  const newEmoji = prompt(`Editar emoji para "${name}":\n(Deja vacío si no deseas emoji)`, emoji);
  if (newEmoji === null) return; // Cancelado
  
  const newColor = prompt(`Editar color para "${name}":\n(Formato: #RRGGBB, ej: #FF0000)`, rgbToHex(color));
  if (newColor === null) return; // Cancelado
  
  // Validar color
  if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
    alert('Color inválido. Use formato #RRGGBB');
    return;
  }
  
  row.querySelector('.emoji-cell').textContent = newEmoji || '—';
  row.querySelector('.color-preview').style.backgroundColor = newColor;
  row.querySelector('.color-preview').title = newColor;
}

function rgbToHex(rgb) {
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return '#3b82f6';
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


function renderTagListsFromConfig(config){
  // Clear existing tables
  const catTable = document.getElementById('category-table').querySelector('tbody');
  const subTable = document.getElementById('subcategory-table').querySelector('tbody');
  catTable.innerHTML = '';
  subTable.innerHTML = '';

  const categorias = (config && config.orden_categorias) || [];
  const subcategorias = (config && config.orden_subcategorias) || [];

  categorias.forEach((cat, index) => {
    if (typeof cat === 'string') {
      // Migración: si aún es string, convertir a objeto
      addTableRow('category', {name: cat, emoji: '', color: '#3b82f6'}, false);
    } else {
      addTableRow('category', cat, false);
    }
  });
  
  subcategorias.forEach((subcat, index) => {
    if (typeof subcat === 'string') {
      // Migración: si aún es string, convertir a objeto
      addTableRow('subcategory', {name: subcat, emoji: '', color: '#3b82f6'}, false);
    } else {
      addTableRow('subcategory', subcat, false);
    }
  });
}

function addTableRow(kind, itemData, syncInput=true){
  const tableId = kind === 'category' ? 'category-table' : 'subcategory-table';
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  
  // Normalizar data: puede ser string (antiguo) u objeto (nuevo)
  let name, emoji, color;
  if (typeof itemData === 'string') {
    name = itemData;
    emoji = '';
    color = '#3b82f6';
  } else {
    name = itemData.name;
    emoji = itemData.emoji || '';
    color = itemData.color || '#3b82f6';
  }

  // prevent duplicates
  const existingRows = Array.from(tbody.querySelectorAll('tr')).map(row => 
    row.querySelector('.name-cell').textContent
  );
  if(existingRows.includes(name)) return;

  const rowIndex = tbody.children.length + 1;
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td class="order-number">${rowIndex}</td>
    <td class="emoji-cell">${emoji || '—'}</td>
    <td class="name-cell">${name}</td>
    <td class="color-cell">
      <div class="color-preview" style="background-color: ${color}" title="${color}"></div>
    </td>
    <td class="actions-cell">
      <button class="action-btn edit-btn" title="Editar">✎</button>
      <button class="action-btn move-btn" title="Subir">▲</button>
      <button class="action-btn move-btn" title="Bajar">▼</button>
      <button class="action-btn delete-btn" title="Eliminar">🗑️</button>
    </td>
  `;

  // Edit button
  row.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.preventDefault();
    showEditModal(kind, row);
  });

  // Move up button
  row.querySelectorAll('.move-btn')[0].addEventListener('click', (e) => {
    e.preventDefault();
    const prevRow = row.previousElementSibling;
    if (prevRow) {
      tbody.insertBefore(row, prevRow);
      updateOrderNumbers(tbody);
      syncInputFromTable(kind);
    }
  });

  // Move down button
  row.querySelectorAll('.move-btn')[1].addEventListener('click', (e) => {
    e.preventDefault();
    const nextRow = row.nextElementSibling;
    if (nextRow) {
      tbody.insertBefore(nextRow, row);
      updateOrderNumbers(tbody);
      syncInputFromTable(kind);
    }
  });

  // Delete button
  row.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.preventDefault();
    row.remove();
    updateOrderNumbers(tbody);
    syncInputFromTable(kind);
  });

  // Color preview click to edit
  row.querySelector('.color-preview').addEventListener('click', (e) => {
    e.preventDefault();
    showEditModal(kind, row);
  });

  tbody.appendChild(row);
  updateOrderNumbers(tbody);
  
  if(syncInput) syncInputFromTable(kind);
}

function updateOrderNumbers(tbody) {
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    row.querySelector('.order-number').textContent = index + 1;
  });
}

function syncInputFromTable(kind){
  // No necesitamos sincronizar con un input hidden, ya que se guarda directamente en saveConfig
}
