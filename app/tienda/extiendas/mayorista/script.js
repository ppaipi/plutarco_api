let products = [];
let cart = {};
let filteredProducts = [];
let currentSearch = '';

// --- Cargar productos ---
async function loadProducts() {
  // URL del Google Sheets publicado como CSV
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRuR4CdI6eVCgVOSn3GrZ4lBcYaQdqOZfKsoySaW4sxJHjXhEuzVw3OXeSAdjo6Oyv3jNJHLPoaIGtG/pub?gid=1313221296&single=true&output=csv";

  try {
    // Intentar cargar desde Google Sheets
    const resAll = await fetch(SHEET_URL + "&cacheBust=" + Date.now());
    if (!resAll.ok) throw new Error("Error en la respuesta de Google Sheets");

    const csvText = await resAll.text();
    products = parseCSV(csvText);
    loadCategories();

  } catch (error) {
    console.warn("No se pudo cargar desde Google Sheets", error);
  }

  // Copiar a filteredProducts y renderizar
  filteredProducts = [...products];
  await renderProducts(filteredProducts);

  // Scroll al header
  const header = document.querySelector("header");
  if (header) {
    header.scrollIntoView({ behavior: "smooth" });
  }
}

function loadCategories() {
  // Esta función se llama para inicializar, pero ahora la renderización
  // por categorías ocurre en renderProducts()
}



function cerrarModalDescripcion() {
  const modal = document.getElementById('modal-descripcion');
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  if (content) {
    content.classList.remove('modal-content-anim');
    content.classList.add('modal-content-anim-close');
    setTimeout(() => {
      modal.remove();
    }, 180);
  } else {
    modal.remove();
  }
}

async function mostrarDescripcionProducto(prod) {
  await crearModalDescripcion(prod);
}
async function imagenUrl(codigo) {
  try {
    const response = await fetch(`https://plutarcoalmacen.com.ar/products/img-by-codigo/${codigo}`);
    if (!response.ok) throw new Error("Error");
    const data = await response.json();
    return data.url || "/media_static/placeholder.jpg";
  } catch {
    return "/media_static/placeholder.jpg";
  }
}
// Todo el div del producto abre el modal
async function createProductCard(prod) {
  // Obtener la URL correcta de la imagen
  const imageUrl = await imagenUrl(prod.Codigo).catch(() => "/media_static/placeholder.jpg");

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
    btnMenos.onclick = (e) => {
      e.stopPropagation();
      updateQuantity(prod.Codigo, -1);
    };

    const spanCantidad = document.createElement('span');
    spanCantidad.textContent = cantidad;

    const btnMas = document.createElement('button');
    btnMas.textContent = '+';
    btnMas.onclick = (e) => {
      e.stopPropagation();
      updateQuantity(prod.Codigo, 1);
    };

    controles.appendChild(btnMenos);
    controles.appendChild(spanCantidad);
    controles.appendChild(btnMas);
  } else {
    controles = document.createElement('button');
    controles.textContent = 'Agregar';
    controles.onclick = (e) => {
      e.stopPropagation();
      addToCart(prod.Codigo);
    };
  }

  // Crear imagen con la URL correcta
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = prod.Nombre;
  img.loading = 'lazy';
  img.style.objectFit = 'cover';
  img.onerror = function() {
    this.onerror = null;
    this.src = this.src.replace('.jpeg', '.jpg');
    this.onerror = function() { this.src = '/media_static/placeholder.jpg'; };
  };

  div.appendChild(img);

  const h3 = document.createElement('h3');
  h3.textContent = prod.Nombre;
  div.appendChild(h3);

  const p = document.createElement('p');
  p.textContent = `$${prod.Precio}`;
  div.appendChild(p);

  // Solo abre el modal si el click no es sobre un botón
  div.onclick = (e) => {
    if (
      e.target.tagName !== 'BUTTON' &&
      !(e.target.closest && e.target.closest('button'))
    ) {
      mostrarDescripcionProducto(prod);
    }
  };

  div.appendChild(controles);
  return div;
}

function parseCSV(csvText) {
  // quitar BOM si viene
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  // detectar separador por la primera línea
  const first = lines[0];
  const countSemi = (first.match(/;/g) || []).length;
  const countComma = (first.match(/,/g) || []).length;
  const sep = countSemi > countComma ? ";" : ",";

  // regex: separa por sep solo si está FUERA de comillas
  const splitRegex = new RegExp(`${escapeRegex(sep)}(?=(?:[^"]*"[^"]*")*[^"]*$)`);

  const headers = first.split(splitRegex).map(h => unquote(h.trim()));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^\s*$/.test(line)) continue;

    let cols = line.split(splitRegex);

    // Si hay más columnas que headers (p. ej. porque la última trae el separador sin comillar),
    // juntamos todo lo sobrante en la última columna (Descripcion).
    if (cols.length > headers.length) {
      const fixed = cols.slice(0, headers.length - 1);
      const tail = cols.slice(headers.length - 1).join(sep);
      cols = [...fixed, tail];
    }

    const obj = {};
    headers.forEach((h, idx) => {
      const raw = (cols[idx] ?? "").trim();
      const value = unquote(raw);
      obj[h] = parseValue(h, value);
    });
    rows.push(obj);
  }

  return rows;

  function parseValue(header, value) {
    if (typeof value !== 'string') return value;
    const headerKey = header.toLowerCase();

    if (/precio|total|subtotal|envio|costo/i.test(headerKey)) {
      const num = parseCurrency(value);
      return num === null ? value : num;
    }

    return value;
  }

  function parseCurrency(value) {
    let text = value.replace(/\s+/g, '');
    if (!text) return null;

    // Quitar símbolo de moneda si existe
    text = text.replace(/^\$/g, '');
    text = text.replace(/[^0-9.,-]/g, '');

    const hasDot = text.indexOf('.') !== -1;
    const hasComma = text.indexOf(',') !== -1;

    if (hasDot && hasComma) {
      // Si ambos existen, asumimos que el separador de decimales es el último que aparece.
      if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
        text = text.replace(/\./g, '').replace(/,/g, '.');
      } else {
        text = text.replace(/,/g, '');
      }
    } else if (hasComma) {
      const parts = text.split(',');
      if (parts.length === 2 && parts[1].length === 2) {
        text = `${parts[0]}.${parts[1]}`;
      } else {
        text = text.replace(/,/g, '');
      }
    } else if (hasDot) {
      const parts = text.split('.');
      if (parts.length === 2 && parts[1].length === 2) {
        // Formato decimal 4.80
        text = text;
      } else {
        // Punto como separador de miles o múltiple separador
        text = text.replace(/\./g, '');
      }
    }

    const parsed = parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function unquote(s) {
    // si viene entre comillas, quítalas y des-escapá comillas dobles
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1).replace(/""/g, '"');
    }
    return s;
  }
  function escapeRegex(ch) {
    // por si algún día usás otro separador especial
    return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}




// Renderiza productos agrupados por categorías
async function renderProducts(productos) {
  const container = document.getElementById('product-list');
  container.innerHTML = '';

  // Agrupar productos por categoría
  const porCategoria = {};
  productos.forEach(prod => {
    const cat = (prod.Categoria || 'Sin categoría').trim();
    if (!porCategoria[cat]) {
      porCategoria[cat] = [];
    }
    porCategoria[cat].push(prod);
  });

  // Ordenar categorías alfabéticamente
  const categorias = Object.keys(porCategoria);

  // Renderizar cada categoría con sus productos
  for (const categoria of categorias) {
    // Crear contenedor de la categoría
    const categoriaDiv = document.createElement('div');
    categoriaDiv.className = 'categoria-section';

    // Título de la categoría
    const titulo = document.createElement('h2');
    titulo.className = 'categoria-titulo';
    titulo.textContent = categoria;
    categoriaDiv.appendChild(titulo);

    // Grid de productos de esta categoría
    const grid = document.createElement('div');
    grid.className = 'product-grid';

    // Esperar todas las tarjetas de producto
    const cards = await Promise.all(porCategoria[categoria].map(prod => createProductCard(prod)));
    cards.forEach(card => grid.appendChild(card));

    categoriaDiv.appendChild(grid);
    container.appendChild(categoriaDiv);
  }
}

// Buscador simple
async function searchProduct() {
  const term = document.getElementById('search-input').value.toLowerCase().trim();
  currentSearch = term;

  if (!term) {
    filteredProducts = [...products];
    await renderProducts(filteredProducts);
    return;
  }

  filteredProducts = products.filter(p => p.Nombre.toLowerCase().includes(term));
  await renderProducts(filteredProducts);
}

function addToCart(codigo) {
  cart[codigo] = (cart[codigo] || 0) + 1;
  updateProductCard(codigo);
  updateCart();
  animateCart();
}

function updateProductCard(codigo) {
  const card = document.querySelector(`[data-codigo="${codigo}"]`);
  if (!card) return;

  const cantidad = cart[codigo] || 0;

  if (cantidad === 0) {
    const controles = card.querySelector('.quantity-controls');
    if (controles) {
      const btnAgregar = document.createElement('button');
      btnAgregar.textContent = 'Agregar';
      btnAgregar.onclick = () => addToCart(codigo);
      controles.replaceWith(btnAgregar);
    }
  } else {
    const controles = card.querySelector('.quantity-controls');
    if (controles) {
      controles.querySelector('span').textContent = cantidad;
    } else {
      const oldButton = card.querySelector('button');
      const newControls = document.createElement('div');
      newControls.className = 'quantity-controls';

      const btnMenos = document.createElement('button');
      btnMenos.textContent = '-';
      btnMenos.onclick = () => updateQuantity(codigo, -1);

      const span = document.createElement('span');
      span.textContent = cantidad;

      const btnMas = document.createElement('button');
      btnMas.textContent = '+';
      btnMas.onclick = () => updateQuantity(codigo, 1);

      newControls.appendChild(btnMenos);
      newControls.appendChild(span);
      newControls.appendChild(btnMas);

      oldButton.replaceWith(newControls);
    }
  }
}

function updateQuantity(codigo, delta) {
  if (!cart[codigo]) return;

  cart[codigo] += delta;
  if (cart[codigo] <= 0) {
    delete cart[codigo];
  }

  updateProductCard(codigo);
  updateCart();
  animateCart();
}

async function removeFromCart(codigo) {
  delete cart[codigo];
  await renderProducts(filteredProducts);
  updateCart();
  animateCart();
}

async function updateCart() {
  const ul = document.getElementById('cart-items');
  if (!ul) return;
  ul.innerHTML = '';
  let subtotal = 0;
  let count = 0;

  for (let codigo in cart) {
    const producto = products.find(p => p.Codigo === codigo);
    const cantidad = cart[codigo];
    const imageUrl = await imagenUrl(producto.Codigo).catch(() => "/media_static/placeholder.jpg");
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="cart-item">
        <img 
          class="thumb"
          src="${imageUrl}" 
          alt="${producto.Nombre}" 
          onerror="this.onerror=null; this.src=this.src.replace('.jpeg', '.jpg'); this.onerror=function(){ this.src='plutarcoalmacen.com.ar/media_static/placeholder.jpg'; }"
          loading="lazy"
          width="80" height="80"
          style="object-fit: cover;">
        <div>
          <strong>${producto.Nombre}</strong>
          <div class="quantity-controls">
            <button onclick="updateQuantity('${codigo}', -1)">-</button>
            <span>${cantidad}</span>
            <button onclick="updateQuantity('${codigo}', 1)">+</button>
            <button onclick="removeFromCart('${codigo}')" class="remove-btn">❌</button>
          </div>
          <p>$${producto.Precio * cantidad}</p>
        </div>
      </div>
    `;
    ul.appendChild(li);
    subtotal += producto.Precio * cantidad;
    count += cantidad;
  }

  const total = subtotal;


  const totalEl = document.getElementById('total');
  const countEl = document.getElementById('cart-count');
  if (totalEl) totalEl.textContent = total;
  if (countEl) countEl.textContent = count;
  if(document.getElementById('retiro-btn')?.checked) {
    aplicarDescuento();
  }
}

const cart2 = document.getElementById('cart');
const cartButtonWrapper = document.getElementById('cart-icon-fixed');
const openCartButton = document.getElementById('cart-icon');
const closeCartButton = document.querySelector('.close-cart');

openCartButton.addEventListener('click', () => {
  cart2.classList.add('visible');
  cartButtonWrapper.style.display = 'none';
});

closeCartButton.addEventListener('click', () => {
  cart2.classList.remove('visible');
  cartButtonWrapper.style.display = 'block';
});

function toggleCart() {
  const cartPanel = document.getElementById('cart');
  cartPanel.classList.toggle('visible');
}

function animateCart() {
  const icon = document.getElementById('cart-count');
  if (!icon) return;
  icon.style.transform = 'scale(1.3)';
  icon.style.transition = 'transform 0.2s';
  setTimeout(() => icon.style.transform = 'scale(1)', 200);
}

function bloquearBoton(btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando...';
  }
}

function desbloquearBoton(btn) {
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Finalizar Pedido';
  }
}

function validarCampos(btn) {
  const nombre = document.getElementById('name')?.value.trim();
  const mail = document.getElementById('email')?.value.trim();
  // Elimina referencias a telefono y direccion si no existen en el HTML

  if (!nombre || !mail) {
    alert('Complete todos los campos.');
    desbloquearBoton(btn);
    return false;
  }

  if (Object.keys(cart).length === 0) {
    alert('Agregue productos al carrito.');
    desbloquearBoton(btn);
    return false;
  }

  return true;
}
function enviarPedido() {
  const btn = document.getElementById('submit-btn');
  if (!validarCampos(btn)) return;

  bloquearBoton(btn);

  const pedido = {
    nombre: document.getElementById('name')?.value.trim(),
    mail: document.getElementById('email')?.value.trim(),
    productos: [],
    total: 0
  };

  let totalProductos = 0;

  for (const codigo in cart) {
    const prod = products.find(p => p.Codigo === codigo);
    const cantidad = cart[codigo];
    if (prod && cantidad > 0) {
      const subtotal = prod.Precio * cantidad;
      pedido.productos.push({
        codigo: prod.Codigo,
        nombre: prod.Nombre,
        unidades: cantidad,
        total: subtotal
      });
      totalProductos += subtotal;
    }
  }

  pedido.total = totalProductos;
  if (document.getElementById('retiro-btn')?.checked) {
    pedido.total_descuento = (totalProductos * 0.9);
  }

  const formBody = 'data=' + encodeURIComponent(JSON.stringify(pedido));

  fetch('https://script.google.com/macros/s/AKfycbyfsOxzheXTlGnYKwHgsUPF6toKd-fo4oeXQf8eGX4HtP6yRiPApwdTGUu5ewB1lTr0/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody
  }).then(async (response) => {
    if (response.ok) {
      alert('Pedido enviado con éxito!');
      cart = {};
      await renderProducts(filteredProducts);
      document.getElementById('name').value = '';
      document.getElementById('email').value = '';
      updateCart();
    } else {
      alert('Error al enviar pedido.');
    }
    desbloquearBoton(btn);
  }).catch(() => {
    alert('Error de red.');
    desbloquearBoton(btn);
  });
}





// --- Modal descripción producto ---
async function crearModalDescripcion(prod) {
  const oldModal = document.getElementById('modal-descripcion');
  if (oldModal) oldModal.remove();

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'modal-descripcion';
  modalOverlay.className = 'modal-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content modal-content-anim';

  // Obtener la URL correcta de la imagen
  const imageUrl = await imagenUrl(prod.Codigo).catch(() => "/media_static/placeholder.jpg");

  // Imagen grande
  const img = document.createElement('img');
  img.className = 'modal-img';
  img.id = `modal-img-${prod.Codigo}`;
  img.src = imageUrl;
  img.alt = prod.Nombre;
  img.onerror = function() {
    this.onerror = null;
    this.src = this.src.replace('.jpeg', '.jpg');
    this.onerror = function() { this.src = '/media_static/placeholder.jpg'; };
  };

  img.onclick = () => {
    toggleZoom(img.id);
  };
  

  // Info
  const infoDiv = document.createElement('div');
  infoDiv.className = 'modal-info';

  const title = document.createElement('h3');
  title.className = 'modal-title';
  title.textContent = prod.Nombre;

  // Descripción
  const desc = document.createElement('p');
  desc.className = 'modal-desc';
  desc.textContent = prod.Descripcion;

  // Precio
  const price = document.createElement('div');
  price.style.fontWeight = 'bold';
  price.style.fontSize = '1.2rem';
  price.style.marginBottom = '1.2rem';
  price.textContent = `$${prod.Precio}`;

  // Controles de carrito
  const controls = document.createElement('div');
  controls.className = 'modal-controls quantity-controls';

  function renderControls() {
    controls.innerHTML = '';
    const cantidad = cart[prod.Codigo] || 0;
    if (cantidad > 0) {
      const btnMenos = document.createElement('button');
      btnMenos.textContent = '-';
      btnMenos.onclick = (e) => {
        e.stopPropagation();
        updateQuantity(prod.Codigo, -1);
        renderControls();
      };

      const spanCantidad = document.createElement('span');
      spanCantidad.textContent = cantidad;

      const btnMas = document.createElement('button');
      btnMas.textContent = '+';
      btnMas.onclick = (e) => {
        e.stopPropagation();
        updateQuantity(prod.Codigo, 1);
        renderControls();
      };

      controls.appendChild(btnMenos);
      controls.appendChild(spanCantidad);
      controls.appendChild(btnMas);
    } else {
      const btnAgregar = document.createElement('button');
      btnAgregar.textContent = 'Agregar al carrito';
      btnAgregar.className = 'agregar-btn';
      btnAgregar.onclick = (e) => {
        e.stopPropagation();
        addToCart(prod.Codigo);
        renderControls();
      };
      controls.appendChild(btnAgregar);
    }
  }
  renderControls();

  infoDiv.appendChild(title);
  infoDiv.appendChild(desc);
  infoDiv.appendChild(price);
  infoDiv.appendChild(controls);

  // Botón cerrar
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close-btn';
  closeBtn.innerHTML = '✖';
  closeBtn.onclick = cerrarModalDescripcion;

  modalContent.appendChild(img);
  modalContent.appendChild(infoDiv);
  modalContent.appendChild(closeBtn);

  modalOverlay.appendChild(modalContent);

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) cerrarModalDescripcion();
  };

  document.body.appendChild(modalOverlay);

  // Cerrar modal con Escape
  function escListener(e) {
    if (e.key === 'Escape') {
      cerrarModalDescripcion();
      document.removeEventListener('keydown', escListener);
    }
  }
  document.addEventListener('keydown', escListener);
}
const retiroBtn = document.getElementById('retiro-btn');
if (retiroBtn) {
  retiroBtn.addEventListener('change', function () {
    if (this.checked) {
      aplicarDescuento();
    } else {
      desactivarDescuento();
    }
  });
}
function desactivarDescuento() {
  const totalDctoSpan = document.getElementById('total-with-discount');
  
  if (totalDctoSpan) {
    totalDctoSpan.textContent = '0';
    
    const contenedorDcto = totalDctoSpan.closest('.total');
    if (contenedorDcto) {
      contenedorDcto.classList.add('oculto');
    }
  }
}


function aplicarDescuento() {
  const totalEl = document.getElementById('total');
  const totalDctoSpan = document.getElementById('total-with-discount');
  
  if (!totalEl || !totalDctoSpan) return;

  // Convertimos el texto a número
  const currentTotal = parseFloat(totalEl.textContent);
  

  // Calculamos (10% de descuento)
  const discountedTotal = currentTotal * 0.9;
  
  // Escribimos el resultado con 2 decimales
  totalDctoSpan.textContent = discountedTotal;
  
  // IMPORTANTE: Quitamos 'oculto' al PÁRRAFO PADRE
  const contenedorDcto = totalDctoSpan.closest('.total'); 
  if (contenedorDcto) {
    contenedorDcto.classList.remove('oculto');
  }
}


function toggleZoom(idImagen) {
  const original = document.getElementById(idImagen);
  if (!original) return console.error("Imagen no encontrada:", idImagen);

  const existingClone = document.querySelector('.zoom-clone');
  if (existingClone) {
    closeZoom(existingClone);
    return;
  }

  let overlay = document.querySelector('.zoom-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'zoom-overlay';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');

  let closeBtn = document.querySelector('.zoom-close-btn');
  if (!closeBtn) {
    closeBtn = document.createElement('div');
    closeBtn.className = 'zoom-close-btn';
    closeBtn.textContent = '×';
    document.body.appendChild(closeBtn);
  }
  closeBtn.style.display = 'block';

  // Clonar imagen
  const clone = original.cloneNode(true);
  clone.classList.add('zoom-clone');
  document.body.appendChild(clone);

  // Obtener posición original (relativa a viewport)
  const rect = original.getBoundingClientRect();

  // Obtener scroll para posicionar absoluto
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  // Poner clone en posición absoluta (relativa a documento)
  clone.style.position = 'absolute';
  clone.style.top = (rect.top + scrollTop) + 'px';
  clone.style.left = (rect.left + scrollLeft) + 'px';
  clone.style.width = rect.width + 'px';
  clone.style.height = rect.height + 'px';

  clone.getBoundingClientRect(); // Forzar reflow

  // Calcular tamaño final manteniendo proporción
  const aspectRatio = rect.width / rect.height;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const maxWidthPercent = vw <= 600 ? 0.9 : 0.75;
  const maxHeightPercent = vw <= 600 ? 0.9 : 0.75;

  let finalWidth = vw * maxWidthPercent;
  let finalHeight = finalWidth / aspectRatio;

  if (finalHeight > vh * maxHeightPercent) {
    finalHeight = vh * maxHeightPercent;
    finalWidth = finalHeight * aspectRatio;
  }

  // Posición final centrada con scroll
  const finalTop = scrollTop + (vh - finalHeight) / 2;
  const finalLeft = scrollLeft + (vw - finalWidth) / 2;

  // Animar clon a tamaño y posición final
  clone.style.top = finalTop + 'px';
  clone.style.left = finalLeft + 'px';
  clone.style.width = finalWidth + 'px';
  clone.style.height = finalHeight + 'px';

  

  // Función para cerrar zoom
  function closeZoom(cloneImg) {
    const rect = original.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    cloneImg.style.top = (rect.top + scrollTop) + 'px';
    cloneImg.style.left = (rect.left + scrollLeft) + 'px';
    cloneImg.style.width = rect.width + 'px';
    cloneImg.style.height = rect.height + 'px';

    overlay.classList.remove('open');
    closeBtn.style.display = 'none';

    cloneImg.addEventListener('transitionend', () => cloneImg.remove(), { once: true });
  }
  function escListener(e) {
    if (e.key === 'Escape') {
      closeZoom(clone);
      document.removeEventListener('keydown', escListener);
    }
  }
  document.addEventListener('keydown', escListener);

  // Eventos para cerrar zoom
  overlay.onclick = (e) => { if (e.target === overlay) closeZoom(clone); };
  clone.onclick = () => closeZoom(clone);
  closeBtn.onclick = () => closeZoom(clone);
}


window.onload = () => {
  loadProducts();
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => searchProduct());
  }
};