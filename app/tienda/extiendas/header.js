// header.js - Módulo para manejar el header y navegación
let ordenCategorias = [];
let CATEGORIA_EMOJIS = {};
let ordenSubCategorias = [];
let currentFilter = 'Todas';
let filteredProducts = [];

// Funciones del header
function renderCategoryMenu() {
  const container = document.getElementById('dropdown-categories');
  if (!container) return;
  container.innerHTML = '';

  // Botón "Todas"
  const todasBtn = document.createElement('button');
  todasBtn.textContent = '🛒 Ver todos los productos';
  todasBtn.classList.add('cat-btn', 'cat-btn-todas');
  todasBtn.id = 'cat-btn-Todas';
  todasBtn.onclick = () => {
    filterCategory('Todas');
  };
  container.appendChild(todasBtn);

  // Grid 2 columnas para el resto
  const grid = document.createElement('div');
  grid.className = 'dropdown-cat-grid';
  container.appendChild(grid);

  let cats = [...new Set(products.map(p => p.Categoria))].filter(c => c && c.trim() !== '');
  cats.sort((a, b) => {
    const idxA = ordenCategorias.indexOf(a);
    const idxB = ordenCategorias.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.classList.add('cat-btn');
    btn.id = `cat-btn-${cat}`;
    const emoji = CATEGORIA_EMOJIS[cat] || '📦';
    btn.innerHTML = `${emoji} ${cat}`;
    btn.onclick = () => {
      filterCategory(cat);
    };
    grid.appendChild(btn);
  });
}

function highlightSelected(selectedBtn) {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.remove('active-cat');
  });
  let activeBtn = document.getElementById(`cat-btn-${selectedBtn}`);
  if (activeBtn) activeBtn.classList.add('active-cat');
}

function positionDropdown() {
  const btn = document.querySelector('.dropdown-btn');
  const content = document.querySelector('.dropdown-content');
  if (!btn || !content) return;
  const rect = btn.getBoundingClientRect();
  content.style.top = rect.bottom + 'px';
  content.style.left = rect.left + 'px';
  if (rect.left + 360 > window.innerWidth) {
    content.style.left = (window.innerWidth - 360) + 'px';
  }
}

function filterCategory(cat) {
  currentFilter = cat;
  currentSearch = '';
  filteredProducts = (cat === 'Todas') ? [...products] : products.filter(p => p.Categoria === cat);
  renderCategoryMenu();
  renderProductsByCategory(filteredProducts);

  const volverbtn = document.getElementsByClassName('volver-btn')[0];
  if (volverbtn) {
    volverbtn.style.display = 'none';
  }
}

function renderCategoryCards() {
  const container = document.getElementById('categoria-cards');
  if (!container) return;
  container.innerHTML = '';

  let cats = [...new Set(products.map(p => p.Categoria))].filter(c => c && c.trim() !== '');
  cats.sort((a, b) => {
    const idxA = ordenCategorias.indexOf(a);
    const idxB = ordenCategorias.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  cats.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'categoria-card';
    const emoji = CATEGORIA_EMOJIS[cat] || '📦';
    card.innerHTML = `
      <div class="categoria-emoji">${emoji}</div>
      <div class="categoria-nombre">${cat}</div>
    `;
    card.onclick = () => {
      filterCategory(cat);
      document.getElementById('product-list').scrollIntoView({behavior:'smooth'});
    };
    container.appendChild(card);
  });
}

function renderQuickCats() {
  const container = document.getElementById('quick-cat-pills');
  if (!container) return;
  container.innerHTML = '';

  let cats = [...new Set(products.map(p => p.Categoria))].filter(c => c && c.trim() !== '');
  cats.sort((a, b) => {
    const idxA = ordenCategorias.indexOf(a);
    const idxB = ordenCategorias.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Tomar las primeras 5 categorías para pills rápidas
  cats.slice(0, 5).forEach(cat => {
    const pill = document.createElement('button');
    pill.className = 'quick-cat-pill';
    const emoji = CATEGORIA_EMOJIS[cat] || '📦';
    pill.innerHTML = `${emoji} ${cat}`;
    pill.onclick = () => {
      filterCategory(cat);
      document.getElementById('product-list').scrollIntoView({behavior:'smooth'});
    };
    container.appendChild(pill);
  });
}

// Inicialización del header
document.addEventListener("DOMContentLoaded", () => {
  const dropdownBtn = document.querySelector(".dropdown-btn");
  const dropdownContent = document.querySelector(".dropdown-content");
  const arrow = document.querySelector(".dropdown-btn .arrow");

  if (!dropdownBtn || !dropdownContent) return;

  const isTouchDevice = () => {
    return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
  };

  if (isTouchDevice()) {
    dropdownBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      dropdownContent.classList.toggle('show');
      positionDropdown();
      if (dropdownContent.classList.contains('show')) {
        arrow.textContent = '▲';
      } else {
        arrow.textContent = '▼';
      }
    });
  } else {
    dropdownBtn.addEventListener('click', () => {
      dropdownContent.classList.toggle('show');
      positionDropdown();
      if (dropdownContent.classList.contains('show')) {
        arrow.textContent = '▲';
      } else {
        arrow.textContent = '▼';
      }
    });
  }

  window.addEventListener('scroll', () => {
    if (dropdownContent.classList.contains('show')) {
      positionDropdown();
    }
  });
  window.addEventListener('resize', () => {
    if (dropdownContent.classList.contains('show')) {
      positionDropdown();
    }
  });
});

// Exponer funciones globales
window.renderCategoryMenu = renderCategoryMenu;
window.highlightSelected = highlightSelected;
window.filterCategory = filterCategory;
window.renderCategoryCards = renderCategoryCards;
window.renderQuickCats = renderQuickCats;