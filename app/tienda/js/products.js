// ─── products.js ─────────────────────────────────────────────────────────────

import {
  products, filteredProducts, cart,
  ordenCategorias, CATEGORIA_EMOJIS, ordenSubCategorias,
  currentFilter, indiceCategoria,
  setCurrentFilter, setCurrentSearch, setFilteredProducts, setIndiceCategoria,
} from './state.js';
import { addToCart, updateQuantity }  from './cart.js';
import { crearModalDescripcion }      from './ui.js';
import { escapeHtml, sortByOrden }    from './utils.js';
let restaurandoScroll = false;

// ── Helpers de URL ────────────────────────────────────────────────────────────
export function getQueryParam(param) {
  return new URLSearchParams(window.location.search).get(param) || '';
}

function setQueryParams(params) {
  const url = new URL(window.location);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
    else   url.searchParams.delete(k);
  });
  window.history.replaceState({}, '', url);
}

// ── Leer URL al iniciar y aplicar filtros ─────────────────────────────────────
export function aplicarFiltrosDesdeURL() {
  const cat = getQueryParam('cat');
  const search = getQueryParam('search');

  restaurandoScroll = true;

  if (search) {
    searchProduct(search);
  } else if (cat && cat !== 'Todas') {
    filterCategory(cat);
  } else {
    setFilteredProducts([...products]);
    renderCategoryMenu();
    renderProductsByCategory(products);
  }

  const scrollY = JSON.parse(
    sessionStorage.getItem("tienda-scroll") || "{}"
  ).scrollY;

  if (scrollY) {
    setTimeout(() => {
      window.scrollTo(0, scrollY );

      restaurandoScroll = false;
    }, 50);

    sessionStorage.removeItem("tienda-scroll");

  } else {

    restaurandoScroll = false;
  }
}

// ── Filtrar por categoría ─────────────────────────────────────────────────────
export function filterCategory(cat) {
  setCurrentFilter(cat);
  setCurrentSearch('');

  const filtered = cat === 'Todas' ? [...products] : products.filter(p => p.Categoria === cat);
  setFilteredProducts(filtered);

  setQueryParams({ cat: cat === 'Todas' ? '' : cat, search: '' });

  renderCategoryMenu();
  renderProductsByCategory(filtered);

  const volverBtn = document.querySelector('.volver-btn');
  if (volverBtn && !restaurandoScroll) setTimeout(() => volverBtn.scrollIntoView({ behavior: 'smooth' }), 100);
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────
export function searchProduct(term) {

  // Si viene desde addEventListener('input', ...)
  if (term instanceof Event) {
    term = term.target.value;
  }

  // Si no se pasa término, leer del input
  if (term === undefined || term === null) {
    term = document.getElementById('search-input')?.value ?? '';
  }

  term = String(term).toLowerCase().trim();

  // Sincronizar el input con el término
  const input = document.getElementById('search-input');

  if (input && input.value.toLowerCase().trim() !== term) {
    input.value = term;
  }

  setCurrentSearch(term);

  if (!term) {

    // Sin término: volver al filtro de categoría activo
    setQueryParams({ search: '' });

    filterCategory(currentFilter);

    return;
  }

  setQueryParams({
    search: term,
    cat: ''
  });

  setCurrentFilter('Todas');

  const palabras = term
    .split(/\s+/)
    .filter(Boolean);

  const filtered = products.filter(p => {

    const searchable = `
      ${p.Nombre || ''}
      ${p.Descripcion || ''}
      ${p.Categoria || ''}
      ${p.SubCategoria || ''}
    `
      .toLowerCase();

    return palabras.every(palabra =>
      searchable.includes(palabra)
    );
  });

  setFilteredProducts(filtered);

  renderCategoryMenu();

  renderProductsByCategory(filtered, term);
  if (!restaurandoScroll) {
  document.getElementById('product-list')
    ?.scrollIntoView({ behavior: 'smooth' });
  }
}
function guardarEstadoTienda() {
  const input = document.getElementById('search-input');
  const scrollY = window.scrollY;
  const search1 = getQueryParam('search') || '';
  const filter1 = getQueryParam('cat') || 'Todas';

  const estado = {
    filter: filter1,
    search: search1,
  };

  sessionStorage.setItem('tienda-estado', JSON.stringify(estado));
  sessionStorage.setItem('tienda-scroll', JSON.stringify({ scrollY: scrollY }));
}

// ── Tarjeta individual ────────────────────────────────────────────────────────
export function createProductCard(prod) {
  const div = document.createElement('div');
  div.className = 'product';
  div.setAttribute('data-codigo', prod.Codigo);

  const cantidad = cart[prod.Codigo] || 0;
  let controles;

  if (cantidad > 0) {
    controles = document.createElement('div');
    controles.className = 'quantity-controls';

    const btnMenos = document.createElement('button');
    btnMenos.textContent = '-';
    btnMenos.onclick = (e) => { e.stopPropagation(); updateQuantity(prod.Codigo, -1); };

    const span = document.createElement('span');
    span.textContent = cantidad;

    const btnMas = document.createElement('button');
    btnMas.textContent = '+';
    btnMas.onclick = (e) => { e.stopPropagation(); updateQuantity(prod.Codigo, 1); };

    controles.appendChild(btnMenos);
    controles.appendChild(span);
    controles.appendChild(btnMas);
  } else {
    controles = document.createElement('button');
    controles.textContent = 'Agregar';
    controles.onclick = (e) => { e.stopPropagation(); addToCart(prod.Codigo); };
  }

  div.innerHTML = `
    <img
      src="${escapeHtml(prod.Imagen)}"
      alt="${prod.Nombre}"
      loading="lazy"
      style="object-fit:cover;"
      onerror="this.src='/media_static/placeholder.jpg'">
    <h3>${prod.Nombre}</h3>
    <p>$${prod.Precio}</p>`;

  div.onclick = (e) => {
    guardarEstadoTienda();
    if (e.target.tagName !== 'BUTTON' && !e.target.closest?.('button')) {
      window.location.href = `/producto/${prod.Id}`;
    }
  };

  div.appendChild(controles);
  return div;
}

// ── Estado vacío ──────────────────────────────────────────────────────────────
function createEmptyState(tipo, termino) {

  const div = document.createElement('div');

  div.className = 'sf-empty-state';

  if (tipo === 'search') {

    div.innerHTML = `
      <div class="sf-empty-icon">🔍</div>

      <h3>
        No encontramos
        "<em>${escapeHtml(termino)}</em>"
      </h3>

      <p>
        Probá con otro nombre, revisá la ortografía
        o explorá nuestras categorías.
      </p>

      <div class="sf-empty-actions">

        <button
          onclick="
            document.getElementById('search-input').value='';
            searchProduct('');
          "
        >
          ✕ Limpiar búsqueda
        </button>

        <button
          class="sf-wsp-btn"
          onclick="
            window.open(
              'https://wa.me/5491150168920?text=Hola! Busco el producto: ${encodeURIComponent(termino)}',
              '_blank'
            )
          "
        >
          💬 Pedilo por WhatsApp
        </button>

      </div>
    `;

  } else {

    div.innerHTML = `
      <div class="sf-empty-icon">📦</div>

      <h3>
        No hay productos en esta categoría todavía
      </h3>

      <p>
        Estamos trabajando para agregar más productos.
        ¡Volvé pronto!
      </p>

      <div class="sf-empty-actions">

        <button
          onclick="filterCategory('Todas')"
        >
          🛒 Ver todos los productos
        </button>

        <button
          class="sf-wsp-btn"
          onclick="
            window.open(
              'https://wa.me/5491150168920?text=Hola! Quiero saber sobre: ${encodeURIComponent(termino || '')}',
              '_blank'
            )
          "
        >
          💬 Consultar por WhatsApp
        </button>

      </div>
    `;
  }

  return div;
}
// ── Tarjeta "Ver más" ─────────────────────────────────────────────────────────
function createVerMasCard(categoria) {
  const catClass = categoria.replace(/\s+/g, '-');
  const div = document.createElement('div');
  div.className = `product ver-mas-card ${catClass}`;
  div.style.cursor = 'pointer';
  div.onclick = () => { setIndiceCategoria(catClass); filterCategory(categoria); };

  div.innerHTML = `
    <div class="ver-mas-icon">
      <svg xmlns="http://www.w3.org/2000/svg" class="boton-ver-mas" viewBox="0 0 24 24">
        <rect x="10.75" y="4" width="2.5" height="16" rx="1.2"/>
        <rect x="4" y="10.75" width="16" height="2.5" rx="1.2"/>
      </svg>
    </div>
    <div class="ver-mas-text">Ver más</div>`;

  return div;
}

// ── Menú desplegable ──────────────────────────────────────────────────────────
export function renderCategoryMenu() {
  const container = document.getElementById('dropdown-categories');
  if (!container) return;
  container.innerHTML = '';

  const todasBtn = document.createElement('button');
  todasBtn.textContent = '🛒 Ver todos los productos';
  todasBtn.classList.add('cat-btn', 'cat-btn-todas');
  todasBtn.id = 'cat-btn-Todas';
  todasBtn.onclick = () => {
    setIndiceCategoria('');
    filterCategory('Todas');
  };
  container.appendChild(todasBtn);

  const grid = document.createElement('div');
  grid.className = 'dropdown-cat-grid';
  container.appendChild(grid);

  getCategoriasOrdenadas(products).forEach(cat => {
    const info  = CATEGORIA_EMOJIS.find(c => c.name === cat) || { emoji: '📦' };
    const count = products.filter(p => p.Categoria === cat).length;
    const btn   = document.createElement('button');
    btn.classList.add('cat-btn');
    btn.id = `cat-btn-${cat.replace(/\s+/g, '-')}`;
    btn.innerHTML = `
      <span style="font-size:1.1rem;flex-shrink:0">${info.emoji}</span>
      <span style="line-height:1.2">${cat}<br>
        <small style="color:#aaa;font-weight:400;font-size:0.7rem">${count} productos</small>
      </span>`;
    btn.onclick = () => filterCategory(cat);
    grid.appendChild(btn);
  });
}

export function highlightSelected(selectedKey) {
  document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active-cat'));
  const active = document.getElementById(`cat-btn-${selectedKey}`);
  if (active) active.classList.add('active-cat');
}

// ── Cards visuales ────────────────────────────────────────────────────────────
export function renderCategoryCards() {
  const container = document.getElementById('categoria-cards');
  if (!container) return;
  container.innerHTML = '';

  getCategoriasOrdenadas(products).forEach(cat => {
    const info  = CATEGORIA_EMOJIS.find(c => c.name === cat) || { emoji: '📦', color: '#cccccc' };
    const count = products.filter(p => p.Categoria === cat).length;

    const card = document.createElement('div');
    card.className = 'cat-visual-card';
    card.style.backgroundColor = info.color;
    card.onclick = () => {
      setIndiceCategoria('');
      filterCategory(cat);
      if (!restaurandoScroll) {
          setTimeout(() => {
            document.getElementById('product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        };
      }
    card.innerHTML = `
      <div class="cat-visual-emoji">${info.emoji}</div>
      <div class="cat-visual-nombre">${cat}</div>
      <div class="cat-visual-count">${count} producto${count !== 1 ? 's' : ''}</div>`;
    container.appendChild(card);
  });
}

// ── Quick pills ───────────────────────────────────────────────────────────────
export function renderQuickCats() {
  const container = document.getElementById('quick-cat-pills');
  if (!container) return;

  ordenCategorias.slice(0, 5).forEach(cat => {
    const info = CATEGORIA_EMOJIS.find(c => c.name === cat) || { emoji: '📦' };
    const pill = document.createElement('div');
    pill.className   = 'quick-pill';
    pill.textContent = `${info.emoji} ${cat}`;
    pill.onclick     = () => filterCategory(cat);
    container.appendChild(pill);
  });
}

// ── Renderizado principal ─────────────────────────────────────────────────────
export function renderProductsByCategory(productos, searchTerm = '') {
  const container = document.getElementById('product-list');
  container.innerHTML = '';

  // Botón volver (cuando hay filtro activo)
// Botón volver (cuando hay filtro activo)
if (currentFilter !== 'Todas' || searchTerm) {

  // Encabezado de contexto
  const contextBar = document.createElement('div');

  contextBar.className = 'sf-context-bar';

  if (searchTerm) {

    contextBar.innerHTML = `
      <span class="sf-context-label">
        Resultados para
        <em>"${escapeHtml(searchTerm)}"</em>

        — <strong>${productos.length}</strong>
        producto${productos.length !== 1 ? 's' : ''}
      </span>

      <button
        class="sf-clear-btn"
        onclick="
          document.getElementById('search-input').value='';
          searchProduct('');
        "
      >
        ✕ Limpiar
      </button>
    `;

  } else {

    const catClass = currentFilter.replace(/\s+/g, '-');

    highlightSelected(catClass);

    contextBar.innerHTML = `
      <span class="sf-context-label">
        ${currentFilter}

        — <strong>${productos.length}</strong>
        producto${productos.length !== 1 ? 's' : ''}
      </span>

      <button
        class="sf-clear-btn"
        onclick="filterCategory('Todas')"
      >
        ✕ Ver todos
      </button>
    `;
  }

  container.appendChild(contextBar);

  // Botón volver clásico
  const backBtn = document.createElement('button');

  backBtn.textContent = '⬅ Volver al inicio';

  backBtn.className = 'volver-btn';

  backBtn.onclick = () => {

    setCurrentFilter('Todas');

    setFilteredProducts([...products]);

    document.getElementById('search-input').value = '';

    setCurrentSearch('');

    setQueryParams({
      cat: '',
      search: ''
    });

    renderCategoryMenu();

    renderProductsByCategory([...products]);

    if (indiceCategoria) {

      scrollToElementoVerMas(indiceCategoria);

    } else if (!restaurandoScroll) {

      document.getElementById('categorias-visuales')
        ?.scrollIntoView({
          behavior: 'smooth'
        });
    }
  };

  container.appendChild(backBtn);

  }

  // Estado vacío global
  if (productos.length === 0) {
    container.appendChild(
      createEmptyState(searchTerm ? 'search' : 'cat', searchTerm || currentFilter)
    );
    return;
  }

  const cats = getCategoriasOrdenadas(productos);
  cats.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'category-section';

    const h2 = document.createElement('h2');
    h2.className = `category-title ${cat.replace(/\s+/g, '-')}`;
    h2.innerHTML = `<a href="#" onclick="filterCategory('${escapeHtml(cat)}'); return false;">${cat}</a>`;

    const subtitulos = {
      'Panificados Integrales': 'Toda nuestra panaderia está elaborada con harinas integrales organicas, sin aditivos, conservantes, ni harinas blancas.',
      'Productos Sueltos':      'Todos nuestros productos vienen fraccionados en porciones. Si necesitas más, solo agregue mas unidades.',
    };
    if (subtitulos[cat]) {
      const sub = document.createElement('span');
      sub.className   = 'category-subtitle';
      sub.textContent = subtitulos[cat];
      h2.appendChild(sub);
    }
    div.appendChild(h2);

    const productosCat = productos.filter(p => p.Categoria === cat).sort(sortByOrden);

    // Sin productos en esta categoría (no debería ocurrir, pero por si acaso)
    if (productosCat.length === 0) {
      div.appendChild(createEmptyState('cat', cat));
      container.appendChild(div);
      return;
    }

    if (currentFilter === cat && !searchTerm) {
      // Vista expandida con subcategorías
      const subs = [...new Set(productosCat.map(p => p.SubCategoria || ''))];
      subs.sort((a, b) => {
        const ia = ordenSubCategorias.indexOf(a);
        const ib = ordenSubCategorias.indexOf(b);
        return (ia !== -1 ? ia : Infinity) - (ib !== -1 ? ib : Infinity) || a.localeCompare(b, 'es');
      });

      subs.forEach(sub => {
        const subDiv = document.createElement('div');
        subDiv.className = 'subcategory-section';

        const h3 = document.createElement('h3');
        h3.className   = `subcategory-title ${sub.replace(/\s+/g, '-')}`;
        h3.textContent = sub;
        subDiv.appendChild(h3);

        const grid     = document.createElement('div');
        grid.className = 'product-grid';
        const prodsSub = productosCat.filter(p => (p.SubCategoria || '') === sub);
        prodsSub.forEach(p => grid.appendChild(createProductCard(p)));

        const resto = prodsSub.length % 5;
        if (resto !== 0) for (let i = resto; i < 5; i++) grid.appendChild(createEspacioVacio());
        subDiv.appendChild(grid);
        div.appendChild(subDiv);
      });
    } else {
      // Vista previa: 5 productos + "ver más"
      if (!searchTerm) highlightSelected('Todas');

      const grid     = document.createElement('div');
      grid.className = 'product-grid';
      const mostrar  = productosCat.slice(0, 5);
      mostrar.forEach(p => grid.appendChild(createProductCard(p)));
      if (productosCat.length > 5) grid.appendChild(createVerMasCard(cat));
      for (let i = mostrar.length; i < 5; i++) grid.appendChild(createEspacioVacio());
      div.appendChild(grid);
    }

    container.appendChild(div);
  });
}

// ── Helpers internos ──────────────────────────────────────────────────────────
function getCategoriasOrdenadas(prods) {
  const cats = [...new Set(prods.map(p => p.Categoria).filter(Boolean))];
  return cats.sort((a, b) => {
    const ia = ordenCategorias.indexOf(a);
    const ib = ordenCategorias.indexOf(b);
    return (ia !== -1 ? ia : Infinity) - (ib !== -1 ? ib : Infinity) || a.localeCompare(b, 'es');
  });
}

function createEspacioVacio() {
  const el = document.createElement('div');
  el.className = 'product espacio-vacio';
  return el;
}

function scrollToElementoVerMas(clase, intentos = 10) {
  const el = document.querySelector(`.category-title.${clase}`);
  if (el && !restaurandoScroll) {
    el.scrollIntoView({ behavior: 'smooth' });
    if (intentos > 0) setTimeout(() => requestAnimationFrame(() => scrollToElementoVerMas(clase, intentos - 1)), 50);
  }
}