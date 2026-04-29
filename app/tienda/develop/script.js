let products = [];
let allProducts = [];
let enabledCodes = [];
let rankingMap = {};
let cart = {};
const CART_STORAGE_KEY = 'plutarco_cart';
let lastAddToCart = Date.now();
let filteredProducts = [];
let currentFilter = 'Todas';

function saveCartToSession() {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.warn('No se pudo guardar el carrito en sessionStorage:', err);
  }
}

function loadCartFromSession() {
  try {
    const stored = sessionStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        cart = parsed;
      }
    }
  } catch (err) {
    console.warn('No se pudo cargar el carrito desde sessionStorage:', err);
    cart = {};
  }
}
let currentSearch = '';
let costoEnvioActual = 0;
let indiceCategoria = '';
let descripcionesPorCodigo = {};
let configuracion = {};
let pedidoMinimo = false
let cantidadMinima = configuracion.pedido_minimo || 0;
let diasEntregaConfig = [];
let preciosEnvioConfig = [];
let estadoTienda = true;
let mensajeEstado = "";
let autocomplete; 
const LOCAL_ADDRESS = 'Ibera 3852, Coghlan, CABA, Argentina.';
let ordenCategorias = [];
let ordenSubCategorias = [];
const botonWpp = document.getElementById('boton-wpp');


let direccionValidaGoogle = false; // Variable global para saber si la dirección es válida de Google
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }


async function loadProducts() {
    try {
        const res = await fetch('https://plutarco-api.fly.dev/products/enabled');
        const data = await res.json();
        allProducts = data.map(item => ({
            Codigo: item.codigo,
            Nombre: item.nombre,
            Descripcion: item.descripcion,
            Categoria: item.categoria,
            SubCategoria: item.subcategoria,
            Precio: item.precio,
            Proveedor: item.proveedor,
            Orden: item.orden,
            Imagen: item.imagen_url
        }));
        products = allProducts;
        filteredProducts = [...products];
        loadCartFromSession();
        renderCategoryMenu();
        renderProductsByCategory(filteredProducts);
        renderCategoryCards();
        renderQuickCats();
        updateCart();
        const header = document.querySelector('header');
        if (header) {
            header.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        console.error("Error cargando productos:", err);
    }
}


async function loadconfig(){
    try {
    const res = await fetch('https://plutarco-api.fly.dev/config/list');
    configuracion = await res.json();
    diasEntregaConfig = configuracion.dias_entrega || [];
    preciosEnvioConfig = configuracion.envio_tarifas || [];
    cantidadMinima = configuracion.pedido_minimo || 0;
    ordenCategorias = configuracion.orden_categorias || ordenCategorias;
    ordenSubCategorias = configuracion.orden_subcategorias || ordenSubCategorias;
    mensajeEstado = configuracion.mensage_status || "";
    console.log("Configuración cargada:", configuracion);
    cargarDiasEntrega();
  } catch (err) {
    console.error("Error cargando configuración:", err);
  }
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
    }, 180); // igual al tiempo de la animación de cierre en CSS
  } else {
    modal.remove();
  }
}


// MODIFICAR: todo el div del producto abre el modal
function createProductCard(prod) {
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

div.innerHTML = `
  <img 
    src="${escapeHtml(prod.Imagen)}" 
    alt="${prod.Nombre}" 
    loading="lazy"
    style="object-fit: cover;"
    onerror="this.src='/media_static/placeholder.jpg'";"
  >

  <h3>${prod.Nombre}</h3>
  <p>$${prod.Precio}</p>
`;


  // SOLO abre el modal si el click no es sobre un botón
  div.onclick = (e) => {
    if (
      e.target.tagName !== 'BUTTON' &&
      !(e.target.closest && e.target.closest('button'))
    ) {
      crearModalDescripcion(prod);
    }
  };

  div.appendChild(controles);
  return div;
}

function cargarDiasEntrega() {
  const select = document.getElementById("pickup-day");
  if (!select) return;

  select.innerHTML = "";

  const diasValidos = (Array.isArray(diasEntregaConfig) && diasEntregaConfig.length > 0)
    ? diasEntregaConfig
    : [
        { weekday: 1, cutoff: "" }, // lunes
        { weekday: 4, cutoff: "" }  // jueves
      ];
  const ahora = new Date();
  let fechaIterada = new Date();
  const opciones = [];

  while (opciones.length < 2) {
    const diaSemana = fechaIterada.getDay();
    const diaConfig = diasValidos.find(d => d.weekday === diaSemana);

    if (diaConfig) {
      let incluirDia = true;

      const esHoy =
        fechaIterada.toDateString() === ahora.toDateString();

      if (
        esHoy &&
        diaConfig.cutoff &&
        diaConfig.cutoff.trim() !== ""
      ) {
        const [horaCutoff, minutoCutoff] = diaConfig.cutoff.split(":").map(Number);
        const fechaCutoff = new Date(ahora);
        fechaCutoff.setHours(horaCutoff, minutoCutoff, 0, 0);

        if (ahora > fechaCutoff) incluirDia = false;
      }

      if (incluirDia) {
        const fecha = new Date(fechaIterada);

        const diaTexto = fecha.toLocaleDateString("es-AR", { weekday: "long" });
        const fechaTexto = fecha.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit"
        });

        const horaTexto = diaConfig.cutoff
          ? `${diaConfig.cutoff.split(":")[0]} hs aprox`
          : "horario a confirmar";

        opciones.push({
          value: fecha.toISOString().split("T")[0],
          texto: `${capitalize(diaTexto)} ${fechaTexto} · ${horaTexto}`
        });
      }
    }

    fechaIterada.setDate(fechaIterada.getDate() + 1);
  }

  select.innerHTML = '<option value="" disabled selected>Seleccionar una fecha</option>';

  opciones.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.texto;
    select.appendChild(option);
  });
}

function capitalize(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}




// Detectar si es pantalla táctil
const isTouchDevice = () => {
  return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
};

document.addEventListener("DOMContentLoaded", () => {
  const dropdownBtn = document.querySelector(".dropdown-btn");
  const dropdownContent = document.querySelector(".dropdown-content");
  const arrow = document.querySelector(".dropdown-btn .arrow");

  if (isTouchDevice()) {
    // 👉 En móviles: abrir/cerrar con click
    dropdownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      dropdownContent.classList.toggle("show");
      arrow.classList.toggle("rotate");
    });

    // 👉 Cerrar al hacer click fuera
    document.addEventListener("click", (e) => {
      if (!dropdownBtn.contains(e.target) && !dropdownContent.contains(e.target)) {
        dropdownContent.classList.remove("show");
        arrow.classList.remove("rotate");
      }
    });
  }
  // 👉 En desktop no hacemos nada: se controla con :hover en CSS
});


function renderCategoryMenu() {
  const container = document.getElementById('dropdown-categories');
  if (!container) return;
  container.innerHTML = '';

  const todasBtn = document.createElement('button');
  todasBtn.textContent = 'Todas';
  todasBtn.classList.add('cat-btn');
  todasBtn.id = 'cat-btn-Todas';
  todasBtn.onclick = () => {
    indiceCategoria = '';
    currentFilter = 'Todas';
    filteredProducts = [...products];
    renderProductsByCategory(filteredProducts);
  };
  container.appendChild(todasBtn);
  highlightSelected("Todas");

  let categorias = [...new Set(products.map(p => p.Categoria))];

  // Reordenar según el array
  categorias.sort((a, b) => {
    const indexA = ordenCategorias.indexOf(a);
    const indexB = ordenCategorias.indexOf(b);

    const posA = indexA !== -1 ? indexA : Infinity;
    const posB = indexB !== -1 ? indexB : Infinity;

    if (posA !== posB) return posA - posB;
    return a.localeCompare(b, 'es'); // alfabético si no están en el array
  });

  categorias.forEach(cat => {
    const catFiltered = cat.replace(/\s+/g, '-');
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.classList.add(`cat-btn`);
    btn.id = `cat-btn-${catFiltered}`;
    btn.onclick = () => {
      indiceCategoria = '';
      filterCategory(cat);
    };
    container.appendChild(btn);
  });
}


function highlightSelected(selectedBtn) {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.remove('active-cat');
  });
  let activeBtn = document.getElementById(`cat-btn-${selectedBtn}`);
  activeBtn.classList.add('active-cat');
}


function scrollToElementoVerMas(clase, intentos = 10) {
  const el = document.querySelector(`.category-title.${clase}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    if (intentos > 0) {
      setTimeout(() => {
        requestAnimationFrame(() => scrollToElementoVerMas(clase, intentos - 1));
      }, 50);
    }
  }
}
function consultarWhatsApp() {
  const addressInput = document.getElementById('address');
  const direccion = addressInput ? addressInput.value.trim() : '';
  let mensaje= `Hola! Vengo de la pagina web.`;


  if (cart != null && Object.keys(cart).length > 0) {
    subtotal = document.getElementById('cart-summary') ? document.getElementById('cart-summary').querySelector('p strong').textContent.replace('Total: $', '') : '0';
    totalEnvio = document.getElementById('cart-summary') ? document.getElementById('cart-summary').querySelectorAll('p')[1].textContent.replace('Envío: $', '') : '0';
    total = document.getElementById('cart-summary') ? document.getElementById('cart-summary').querySelector('p strong').textContent.replace('Total: $', '') : '0';
    mensaje += ` \nQuisiera consultar sobre el siguiente pedido: \nSubtotal: $${subtotal} \nEnvío: $${totalEnvio} \nTotal: $${total}. \nDetalle:`;
    for (let codigo in cart) {
      const producto = products.find(p => p.Codigo === codigo);
      const cantidad = cart[codigo];
      mensaje += ` \n- ${producto.Nombre}: ${cantidad} unidades`;
    }
    if (direccion) {
      mensaje += ` \nLa dirección de envío es ${direccion}.`;
    }
  }

  const url = `https://wa.me/5491150168920?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}


function renderProductsByCategory(productos) {
  const container = document.getElementById('product-list');
  container.innerHTML = '';

  if (currentFilter !== 'Todas') {
    const catFiltered = currentFilter.replace(/\s+/g, '-');
    highlightSelected(catFiltered);
    const backBtn = document.createElement('button');
    backBtn.textContent = '⬅ Volver al inicio';
    backBtn.className = 'volver-btn';
    backBtn.onclick = () => {
      currentFilter = 'Todas';
      filteredProducts = [...products];
      renderCategoryMenu();
      renderProductsByCategory(filteredProducts);
      if (indiceCategoria) {
        scrollToElementoVerMas(indiceCategoria);
      } else {
        categoriasVisuales = document.getElementById('categorias-visuales');
        if (categoriasVisuales) {
          categoriasVisuales.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    container.appendChild(backBtn);
  }

  let categorias = [...new Set(productos.map(p => p.Categoria))];

  categorias.sort((a, b) => {
    const indexA = ordenCategorias.indexOf(a);
    const indexB = ordenCategorias.indexOf(b);

    const posA = indexA !== -1 ? indexA : Infinity;
    const posB = indexB !== -1 ? indexB : Infinity;

    if (posA !== posB) return posA - posB;
    return a.localeCompare(b, 'es');
  });

  categorias.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'category-section';

    const h2 = document.createElement('h2');
    h2.className = `category-title ${cat.replace(/\s+/g, '-')}`;
    h2.innerHTML = `<a href="#" onclick="filterCategory('${cat}'); return false;">${cat}</a>`;

    if (cat === "Panificados Integrales") {
      const subTitle = document.createElement('span');
      subTitle.className = 'category-subtitle';
      subTitle.textContent = "Toda nuestra panaderia está elaborada con harinas integrales organicas, sin aditivos, conservantes, ni harinas blancas.";
      h2.appendChild(subTitle);
    }
    if (cat === "Productos Sueltos") {
      const subTitle = document.createElement('span');
      subTitle.className = 'category-subtitle';
      subTitle.textContent = "Todos nuestros productos vienen fraccionados en porciones. Si necesitas más, solo agregue mas unidades.";
      h2.appendChild(subTitle);
    }

    div.appendChild(h2);

    const productosCat = productos
      .filter(p => p.Categoria === cat)
      .sort(sortByOrden);

    if (currentFilter === cat) {

      let subcategorias = [...new Set(productosCat.map(p => p.SubCategoria || ''))];

      subcategorias.sort((a, b) => {
        const indexA = ordenSubCategorias.indexOf(a);
        const indexB = ordenSubCategorias.indexOf(b);

        const posA = indexA !== -1 ? indexA : Infinity;
        const posB = indexB !== -1 ? indexB : Infinity;

        if (posA !== posB) return posA - posB;
        return a.localeCompare(b, 'es');
      });

      subcategorias.forEach(sub => {
        const subDiv = document.createElement('div');
        subDiv.className = 'subcategory-section';

        const h3 = document.createElement('h3');
        h3.className = `subcategory-title ${sub.replace(/\s+/g, '-')}`;
        h3.textContent = sub;
        subDiv.appendChild(h3);

        const grid = document.createElement('div');
        grid.className = 'product-grid';

        const productosSub = productosCat.filter(p => (p.SubCategoria || '') === sub);
        productosSub.forEach(prod => grid.appendChild(createProductCard(prod)));

        const resto = productosSub.length % 5;
        if (resto !== 0) {
          for (let i = resto; i < 5; i++) {
            const vacio = document.createElement("div");
            vacio.className = "product espacio-vacio";
            grid.appendChild(vacio);
          }
        }
        subDiv.appendChild(grid);
        div.appendChild(subDiv);
      });

    } else {
      highlightSelected("Todas");
      const grid = document.createElement('div');
      grid.className = 'product-grid';

      const mostrar = productosCat.slice(0, 5);
      mostrar.forEach(prod => grid.appendChild(createProductCard(prod)));

      if (productosCat.length > 5) {
        const verMasBtn = createVerMasCard(cat);
        grid.appendChild(verMasBtn);
      }

      for (let i = mostrar.length; i < 5; i++) {
        const vacio = document.createElement("div");
        vacio.className = "product espacio-vacio";
        grid.appendChild(vacio);
      }

      div.appendChild(grid);
    }

    container.appendChild(div);
  });
}


function sortByOrden(a, b) {
  const ordenA = Number.isInteger(a.Orden) ? a.Orden : Infinity;
  const ordenB = Number.isInteger(b.Orden) ? b.Orden : Infinity;

  if (ordenA !== ordenB) return ordenA - ordenB;

  return a.Nombre.localeCompare(b.Nombre, 'es');
}



function createVerMasCard(categoria) {
  const div = document.createElement('div');
  const catClass = categoria.replace(/\s+/g, '-');
  div.className = `product ver-mas-card ${catClass}`;
  div.style.cursor = 'pointer';

  div.onclick = () => {
    indiceCategoria = catClass;
    filterCategory(categoria);
  };

  const icon = document.createElement('div');
  icon.className = 'ver-mas-icon';
  icon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="boton-ver-mas" viewBox="0 0 24 24" >
      <rect x="10.75" y="4" width="2.5" height="16" rx="1.2"/>
      <rect x="4" y="10.75" width="16" height="2.5" rx="1.2"/>
    </svg>
  `;

  const texto = document.createElement('div');
  texto.className = 'ver-mas-text';
  texto.textContent = 'Ver más';

  div.appendChild(icon);
  div.appendChild(texto);
  return div;
}

function filterCategory(cat) {
  currentFilter = cat;
  currentSearch = '';
  filteredProducts = (cat === 'Todas') ? [...products] : products.filter(p => p.Categoria === cat);
  renderCategoryMenu();
  renderProductsByCategory(filteredProducts);

  const volverbtn = document.getElementsByClassName('volver-btn')[0];
  if (volverbtn) {
    setTimeout(() => {
      volverbtn.scrollIntoView({ behavior: 'smooth' });
    }, 100);    
  }
}

function searchProduct() {
  const term = document.getElementById('search-input').value.toLowerCase().trim();
  currentSearch = term;

  if (!term) {
    filterCategory(currentFilter);
    return;
  }

  filteredProducts = products.filter(p => p.Nombre.toLowerCase().includes(term));
  renderProductsByCategory(filteredProducts);
}

function addToCart(codigo) {
  lastAddToCart = Date.now();
  cart[codigo] = (cart[codigo] || 0) + 1;
  updateProductCard(codigo);
  const addressInput = document.getElementById('address');
  if (addressInput && addressInput.value.trim() && addressInput.value.trim().toUpperCase() !== 'A ACORDAR') {
    actualizarEnvio();
  } else {
    updateCart();
  }
  animateCart();
  animarCarrito();
  // Oculta el mensaje de error del carrito si hay productos
  actualizarErrorCarrito();
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
  const addressInput = document.getElementById('address');
  if (addressInput && addressInput.value.trim() && addressInput.value.trim().toUpperCase() !== 'A ACORDAR') {
    actualizarEnvio();
  } else {
    updateCart();
  }
  animateCart();
  // Oculta el mensaje de error del carrito si hay productos
  actualizarErrorCarrito();
}

function removeFromCart(codigo) {
  delete cart[codigo];
  renderProductsByCategory(filteredProducts);
  const addressInput = document.getElementById('address');
  if (addressInput && addressInput.value.trim() && addressInput.value.trim().toUpperCase() !== 'A ACORDAR') {
    actualizarEnvio();
  } else {
    updateCart();
  }
  animateCart();
  // Oculta el mensaje de error del carrito si hay productos
  actualizarErrorCarrito();
}

// Nueva función para actualizar el mensaje de error del carrito
function actualizarErrorCarrito() {
  let carritoErrorDiv = document.getElementById('carrito-error');
  if (carritoErrorDiv) {
    if (Object.keys(cart).length > 0) {
      carritoErrorDiv.textContent = '';
      carritoErrorDiv.style.display = 'none';
      validacionCampos['carrito'] = true;
    }
    // Si el usuario ya intentó enviar y el carrito está vacío, el mensaje se mostrará en validarCamposEnTiempoReal
  }
}

function updateCart() {
  const ul = document.getElementById('cart-items');
  if (!ul) return;
  ul.innerHTML = '';
  let subtotal = 0;
  let count = 0;

  for (let codigo in cart) {
    const producto = products.find(p => p.Codigo === codigo);
    if (!producto) continue;
    const cantidad = cart[codigo];
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="cart-item">
        <img 
          class="thumb"
          src="${escapeHtml(producto.Imagen)}"
          alt="${producto.Nombre}" 
          onerror="this.onerror=null; this.src='/media_static/placeholder.jpg';"
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

  // actualizar flag de pedido mínimo
  pedidoMinimo = subtotal >= cantidadMinima;

  // El costo de envío se calcula en actualizarEnvio, aquí solo se muestra
  const envio = costoEnvioActual;
  const total = subtotal + envio;

  const totalEl = document.getElementById('total');
  const countEl = document.getElementById('cart-count');
  if (totalEl) totalEl.textContent = total;
  if (countEl) countEl.textContent = count;

  // opcional: mostrar resumen
  const resumen = document.getElementById('cart-summary');
  if (resumen) {
    resumen.innerHTML = `
      <p>Subtotal: $${subtotal}</p>
      <p>Envío: $${envio}</p>
      <p><strong>Total: $${total}</strong></p>
    `;
  }

  saveCartToSession();
}
function Ocultar(elemento) {
  if (elemento) {
    elemento.classList.add('oculto');
    elemento.classList.remove('visible');
  }
}
function Mostrar(elemento) {
  if (elemento) {
    elemento.classList.remove('oculto');
    elemento.classList.add('visible');
  }
}



const cart2 = document.getElementById('cart');
const openCartButton = document.getElementById('cart-icon');


function toggleCart() {
  const cartPanel = document.getElementById('cart');
  cartPanel.classList.toggle('visible');
  if (botonWpp) {
    if (cartPanel.classList.contains('visible')) {
      Ocultar(botonWpp);
    } else {
      Mostrar(botonWpp);
    }
  }
}
function animarCarrito() {
  const cart = document.getElementById('cart-icon');
  if(!cart) return;
  // Reiniciar animación si ya estaba activa
  cart.classList.remove("cart-animate");
  void cart.offsetWidth; // truco para reiniciar
  cart.classList.add("cart-animate");
}

function animateCart() {
  const icon = document.getElementById('cart-count');
  if (!icon || !cart) return;
  animarCarrito(cart);
  icon.style.transform = 'scale(1.3)';
  icon.style.transition = 'transform 0.2s';
  setTimeout(() => icon.style.transform = 'scale(1)', 200);
}

function validarDia(event) {
  const input = event.target;
  const date = new Date(input.value);
  const day = date.getDay();
  input.setCustomValidity([3, 6].includes(day) ? '' : 'Solo se permite miércoles o sábados');
}
setInterval(() => {
  const ahora = Date.now();
  const unMinuto = 10000;

  if (
    Object.keys(cart).length > 0 &&
    ahora - lastAddToCart >= unMinuto
  ) {
    animarCarrito();
    animateCart();
    lastAddToCart = Date.now();
  }
}, 5000);


let timeoutEnvio; // para evitar llamadas repetidas
let ultimaDireccionConsultada = "";
let ultimoResultadoEnvio = null;
let calculandoEnvio = false; // Estado de carga

// Cache mejorado: almacenar múltiples resultados
let cacheEnvios = {};

function initAutocomplete() {
  const input = document.getElementById('address');
  const bounds = new google.maps.LatLngBounds(
    { lat: -34.705, lng: -58.531 },
    { lat: -34.515, lng: -58.335 }
  );

  autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ['formatted_address', 'geometry'],
    componentRestrictions: { country: "ar" }
  });

  autocomplete.setBounds(bounds);
  autocomplete.setOptions({ strictBounds: false }); 
  const inputField = document.getElementById('address');
  inputField.addEventListener('input', () => {
    cargandoEnvio(true);
  });

  // Cuando el usuario elige una dirección de la lista
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace && autocomplete.getPlace();
    if (place && place.formatted_address && place.geometry) {
      direccionValidaGoogle = true;
      camposTocados['address'] = true;
      validarDireccionSolo();
      const destino = place.formatted_address.trim();
      actualizarEnvioConCache(destino);
      updateCart();
    } else {
      direccionValidaGoogle = false;
    }
  });
}

function actualizarEnvioConCache(destino) {
  // Si el destino es el mismo que el último calculado y tenemos caché, reutilizamos el resultado
  const cacheKey = destino.toLowerCase().trim();
  if (cacheEnvios[cacheKey]) {
    const { costo, msg, color } = cacheEnvios[cacheKey];
    costoEnvioActual = costo;
    mostrarMensajeEnvio(msg, color);
    updateCart();
    return;
  }

  // Calcular subtotal igual que en actualizarEnvio()
  let subtotal = 0;
  for (let codigo in cart) {
    const producto = products.find(p => p.Codigo === codigo);
    const cantidad = cart[codigo];
    subtotal += producto.Precio * cantidad;
  }

  // Llamar a la API solo si no está en caché
  calcularCostoEnvio(destino, subtotal, function(costo, mensaje, color) {
    // Resultado ya se cachea en calcularCostoEnvio
    // Mostrar resultado
    costoEnvioActual = costo;
    mostrarMensajeEnvio(mensaje, color);
    updateCart();
  });
}
function cargandoEnvio(boolean) {
  if(boolean == calculandoEnvio) {
    return;
  }
  calculandoEnvio = boolean;
  if (boolean)
    mostrarMensajeEnvio('', 'black');
}

function calcularCostoEnvio(destino, subtotal, callback) {
  if (!destino || destino.trim().toUpperCase() === 'A ACORDAR') {
    callback(0, 'Dirección A ACORDAR. El costo de envío se definirá al confirmar el pedido.', 'orange');
    return;
  }

  // Verificar si está en cache
  const cacheKey = destino.toLowerCase().trim();
  if (cacheEnvios[cacheKey]) {
    const { costo, msg, color } = cacheEnvios[cacheKey];
    callback(costo, msg, color);
    return;
  }

  // Mostrar indicador de carga
  cargandoEnvio(true);

  const service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [LOCAL_ADDRESS],
    destinations: [destino],
    travelMode: 'DRIVING'
  }, (response, status) => {
    cargandoEnvio(false);

    if (status !== 'OK' || !response.rows?.[0]?.elements?.[0]) {
      callback(0, 'Error al calcular distancia.', 'red');
      return;
    }

    const element = response.rows[0].elements[0];
    if (element.status !== 'OK') {
      callback(0, 'No se puede entregar a esa dirección.', 'red');
      return;
    }

    // Distancia calculada
    const km = element.distance.value / 1000;
    const kmRedondeado = Math.ceil(km * 10) / 10;

    let costo = 0;
    let msg = '';
    let color = 'green';

    // Ordenar rangos por km ascendente
    const rangos = [...preciosEnvioConfig].sort((a, b) => a.km - b.km);

    // Buscar rango válido
    const rango = rangos.find(r => kmRedondeado <= r.km);

    if (!rango) {
      callback(0, 'Fuera del area de entrega (' + kmRedondeado + ' km) <a href="https://wa.me/5491150168920?text=Hola! Vengo de la página web. \nQuiero cotizar un envio de '+ kmRedondeado + ' km a la dirección: ' + destino + '" target="_blank">Escribinos y acordamos un precio!</a>', 'red');
      return;
    }

    costo = rango.price;
    if(costo === 0){
      msg = `Felicidades! Tenés envío gratis!! (${kmRedondeado} km)`;
    } else {
      msg = `Envío ${kmRedondeado} km — $${costo}`;
    }
    color = 'green';

    // Guardar en cache
    cacheEnvios[cacheKey] = { costo, msg, color };

    callback(costo, msg, color);    
  });
}



function actualizarEnvio() {
  const input = document.getElementById('address');
  const destino = (autocomplete && autocomplete.getPlace() && autocomplete.getPlace().formatted_address) ? autocomplete.getPlace().formatted_address : input.value;
  let subtotal = 0;
  for (let codigo in cart) {
    const producto = products.find(p => p.Codigo === codigo);
    const cantidad = cart[codigo];
    subtotal += producto.Precio * cantidad;
  }
  calcularCostoEnvio(destino, subtotal, function(costo, mensaje, color) {
    costoEnvioActual = costo;
    mostrarMensajeEnvio(mensaje, color);
    updateCart();
  });
}


function mostrarMensajeEnvio(texto, color) {
  const envioMsg = document.getElementById('envio-msg');
  if (envioMsg) {
    if (calculandoEnvio) {
      envioMsg.innerHTML = '<span class="loading-spinner"></span> Calculando envío...';
      envioMsg.style.color = '#666';
    } else {
      envioMsg.innerHTML = texto;
      envioMsg.style.color = color;
    }
  }
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

// Variables globales para el estado de validación de cada campo
const validacionCampos = {
  'pickup-day': false,
  'name': false,
  'email': false,
  'phone': false,
  'address': false,
  'comment': false,
  'carrito': false
};

// Nuevo: trackea si el usuario ya tocó el campo
const camposTocados = {
  'pickup-day': false,
  'name': false,
  'email': false,
  'phone': false,
  'address': false,
  'comment': false
};

// Nuevo: para saber si el usuario intentó enviar el formulario
let intentoEnviar = false;

// Validación en tiempo real: mensajes debajo de cada campo y borde rojo si hay error
function validarCamposEnTiempoReal() {
  const campos = [
    { id: 'pickup-day', nombre: 'Día de retiro', validar: v => !!v, mensaje: 'Seleccione un día de retiro.' },
    { id: 'name', nombre: 'Nombre', validar: v => !!v && v.indexOf(' ') !== -1, mensaje: 'Ingrese su nombre completo.' },
    { id: 'email', nombre: 'Email', validar: v => !!v && v.indexOf('@') !== -1 && v.indexOf('.') !== -1, mensaje: 'Ingrese un mail válido.' },
    { id: 'phone', nombre: 'Teléfono', validar: v => !!v && v.length >= 8, mensaje: 'Ingrese un teléfono válido.' },
    { id: 'comment', nombre: 'Comentario', validar: v => !!v, mensaje: 'Ingrese un comentario.' }
  ];

  let hayError = false;

  campos.forEach(campo => {
    const el = document.getElementById(campo.id);
    if (!el) return;
    let valor = el.value.trim();
    let errorMsg = '';

    // Mostrar error si el usuario ya tocó el campo (blur/change) o intentó enviar, y el campo NO es válido
    let mostrarError = (camposTocados[campo.id] || intentoEnviar) && !campo.validar(valor);
    let esValido = campo.validar(valor);

    el.classList.remove('input-error', 'input-success');
    if (!esValido) {
      if (mostrarError) {
        errorMsg = campo.mensaje;
        hayError = true;
        el.classList.add('input-error');
        validacionCampos[campo.id] = false;
      } else {
        validacionCampos[campo.id] = false;
      }
    } else {
      el.classList.add('input-success');
      validacionCampos[campo.id] = true;
    }

    // --- CAMBIO SOLO PARA pickup-day ---
    if (campo.id === 'pickup-day') {
      // Buscar el div.inputs más cercano al select (si existe)
      let parentInputs = el.closest('.inputs');
      // Si no hay, crear uno alrededor del select
      if (!parentInputs) {
        // Si el select no está dentro de un div.inputs, lo envolvemos
        let wrapper = document.createElement('div');
        wrapper.className = 'inputs';
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        parentInputs = wrapper;
      }
      let errorDiv = parentInputs.querySelector('.campo-error');
      if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'campo-error';
        parentInputs.appendChild(errorDiv);
      }
      errorDiv.textContent = mostrarError ? errorMsg : '';
      errorDiv.style.display = mostrarError ? 'block' : 'none';
      return; // No seguir con el resto para pickup-day
    }
    // --- FIN CAMBIO pickup-day ---

    // Mensaje debajo del campo, dentro del div.inputs
    let parentInputs = el.closest('.inputs') || el.parentNode;
    let errorDiv = parentInputs.querySelector('.campo-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'campo-error';
      parentInputs.appendChild(errorDiv);
    }
    errorDiv.textContent = mostrarError ? errorMsg : '';
    errorDiv.style.display = mostrarError ? 'block' : 'none';
  });

  // Validar dirección solo si ya se tocó (blur/change) o intentó enviar
  validarDireccionSolo();

  // Validar carrito solo si el usuario intentó enviar
  let carritoErrorDiv = document.getElementById('carrito-error');
  if (!carritoErrorDiv) {
    carritoErrorDiv = document.createElement('div');
    carritoErrorDiv.id = 'carrito-error';
    carritoErrorDiv.style.color = 'red';
    carritoErrorDiv.style.margin = '4px 0 0 0';
    const form = document.getElementById('pedido-form') || document.getElementById('cart');
    form.appendChild(carritoErrorDiv);
  }
  // Mostrar mensaje solo si el usuario intentó enviar y el carrito está vacío
  if (intentoEnviar && Object.keys(cart).length === 0) {
    carritoErrorDiv.textContent = 'Agregue productos al carrito.';
    hayError = true;
    validacionCampos['carrito'] = false;
    carritoErrorDiv.style.display = 'block';
  } else {
    carritoErrorDiv.textContent = '';
    validacionCampos['carrito'] = Object.keys(cart).length > 0;
    carritoErrorDiv.style.display = 'none';
  }

  // Habilitar/deshabilitar el botón de envío
  const btn = document.getElementById('submit-btn');
  if (btn) btn.disabled = hayError;

  return !hayError;
}

// ...existing code...

// Asignar eventos a los campos para validar en tiempo real
document.addEventListener('DOMContentLoaded', () => {
  const campos = [
    'pickup-day', 'name', 'email', 'phone', 'address', 'comment'
  ];
  campos.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'address') {
        // Solo marcar como tocado y validar al perder foco o cambiar
        el.addEventListener('blur', function() {
          camposTocados['address'] = true;
          validarDireccionSolo();
        });
        el.addEventListener('change', function() {
          camposTocados['address'] = true;
          validarDireccionSolo();
        });
        el.addEventListener('input', function() {
          validarDireccionSolo();
        });
      } else {
        el.addEventListener('blur', function() {
          camposTocados[id] = true;
          validarCamposEnTiempoReal();
        });
        el.addEventListener('change', function() {
          camposTocados[id] = true;
          validarCamposEnTiempoReal();
        });
        el.addEventListener('input', function() {
          validarCamposEnTiempoReal();
        });
      }
    }
  });
  // No validar automáticamente al cargar
});

// Validar dirección solo cuando corresponde
function validarDireccionSolo() {
  const el = document.getElementById('address');
  if (!el) return;
  let valor = el.value.trim();
  let errorMsg = '';
  // Permitir "A ACORDAR"
  if (valor.toUpperCase() === 'A ACORDAR') {
    direccionValidaGoogle = true;
  }
  // Mostrar error si el usuario ya tocó el campo (blur/change) o intentó enviar, y el campo NO es válido
  let mostrarError = (camposTocados['address'] || intentoEnviar) && !direccionValidaGoogle;
  el.classList.remove('input-error', 'input-success');
  if (!direccionValidaGoogle) {
    if (mostrarError) {
      errorMsg = 'Seleccione una dirección válida.';
      el.classList.add('input-error');
      validacionCampos['address'] = false;
    } else {
      validacionCampos['address'] = false;
    }
  } else {
    el.classList.add('input-success');
    validacionCampos['address'] = true;
  }
  // Mensaje debajo del campo, dentro del div.inputs
  let parentInputs = el.closest('.inputs') || el.parentNode;
  let errorDiv = parentInputs.querySelector('.campo-error');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.className = 'campo-error';
    parentInputs.appendChild(errorDiv);
  }
  errorDiv.textContent = mostrarError ? errorMsg : '';
  errorDiv.style.display = mostrarError ? 'block' : 'none';

  // Habilitar/deshabilitar el botón de envío
  const btn = document.getElementById('submit-btn');
  if (btn) btn.disabled = !todosCamposValidados();
}

function todosCamposValidados() {
  return Object.values(validacionCampos).every(v => v === true);
}

function mostrarConfirmacionPedido(data) {
  console.log("Datos recibidos para confirmación:", data);
  const order = data.order;
  const productos = data.productos;

  // Generar HTML de productos
  let productosHtml = '';
  productos.forEach(p => {
    let subtotal = (p.precio_unitario || 0) * (p.cantidad || 0);
    productosHtml += `
        <table class="producto-table">
          <tr>
            <td class="prod-badge" >
              <div>
                ${p.cantidad}
              </div>
            </td>
            <td class="prod-info">
              <div class="prod-nombre">
                ${p.nombre}
              </div>
              <div class="prod-precio">
                ${Math.round(p.precio_unitario)} c/u
              </div>
            </td>
            <td class="prod-subtotal" align="right">
              <div>
                $${Math.round(subtotal)}
              </div>
            </td>
          </tr>
        </table>
    `;
  });

  // Formatear fecha de entrega
  let diaEntregaFormateado = 'No especificado';
  if (order.dia_entrega) {
    const fecha = new Date(order.dia_entrega);
    diaEntregaFormateado = fecha.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  const html = `
<div class="confirm-wrap">
 
  <div class="confirm-header">
    <div class="confirm-header-logo">
      <img src="/media_static/iconpng.ico" alt="Plutarco">
    </div>
    <div class="confirm-header-text">
      <strong>Plutarco Almacén</strong>
      <span>Coghlan · CABA</span>
    </div>
    <div class="confirm-header-badge">Pedido #${order.id}</div>
  </div>
 
  <div class="confirm-body">
 
    <!-- Éxito -->
    <div class="confirm-success">
      <div class="confirm-success-icon">✓</div>
      <h2>¡Tu pedido fue recibido!</h2>
      <p>
        Te enviamos una copia de este resumen a tu correo electrónico.<br>
        Confirmamos en cuanto recibamos el comprobante de pago.
      </p>
    </div>
 
    <hr class="section-divider">
 
    <!-- Datos de entrega -->
    <div class="confirm-section-title">Datos de entrega</div>
    <div class="confirm-info-grid">
      <div class="confirm-info-item">
        <div class="label">Nombre</div>
        <div class="value">${order.nombre_completo}</div>
      </div>
      <div class="confirm-info-item">
        <div class="label">Teléfono</div>
        <div class="value">${order.telefono}</div>
      </div>
      <div class="confirm-info-item">
        <div class="label">Día de entrega</div>
        <div class="value">${diaEntregaFormateado}</div>
      </div>
      <div class="confirm-info-item">
        <div class="label">Email</div>
        <div class="value">${order.correo}</div>
      </div>
      <div class="confirm-info-item full">
        <div class="label">Dirección</div>
        <div class="value">${order.direccion}</div>
      </div>
      <div class="confirm-info-item full">
        <div class="label">Comentario</div>
        <div class="value">${order.comentario}</div>
      </div>
    </div>
 
    <hr class="section-divider">
 
    <!-- Productos -->
    <div class="confirm-section-title">Productos</div>
    <div class="confirm-products">
      ${productosHtml}
    </div>
 
    <hr class="section-divider">
 
    <!-- Totales -->
    <div class="confirm-totales">
      <div class="total-row">
        <span>Subtotal</span>
        <span>$${Math.round(order.subtotal)}</span>
      </div>
      <div class="total-row">
        <span>Envío</span>
        <span>$${Math.round(order.envio_cobrado)}</span>
      </div>
      <div class="total-main">
        <span>Total</span>
        <span>$${Math.round(order.total)}</span>
      </div>
    </div>
 
    <hr class="section-divider">
 
    <!-- Info de pago -->
    <div class="confirm-pago">
      <h4>💸 Información de pago</h4>
      <p>Transferí <strong>$${Math.round(order.total)}</strong> al alias <strong>plutarco.almacen</strong></p>
      <p>Cuenta a nombre de <strong>Darío Chapur</strong>.</p>
      <p>
        Envianos el comprobante por
        <a href="https://wa.me/5491150168920?text=Hola Plutarco Almacén! Realicé el pedido #${order.id} de $${Math.round(order.total)} a nombre de ${order.nombre_completo}" target="_blank">
          WhatsApp al 11 5016-8920
        </a>
        o respondé el email de confirmación. Confirmamos tu pedido al recibirlo.
      </p>
    </div>
 
    <!-- Aviso stock -->
    <div class="confirm-stock">
      <p>⚠️ Si algún producto no tiene stock, te avisamos y hacemos la devolución del monto correspondiente.</p>
    </div>
 
  </div>
 
  <!-- FOOTER -->
  <div class="confirm-footer">
    <p>¿Consultas? Escribinos por WhatsApp o respondé el email de confirmación.</p>
    <button class="btn-volver" onclick="location.reload()">Volver a la tienda</button>
    <a href="https://wa.me/5491150168920?text=Hola Plutarco Almacén! Tengo una consulta sobre mi pedido #${order.id} a nombre de ${order.nombre_completo}" target="_blank">
    <button class="btn-wsp">
      Consultar por WhatsApp
    </button>
    </a>
  </div>
 
</div>
  `;

  // Reemplazar el contenido de la página
  document.body.innerHTML = html;
  document.body.style.backgroundColor = '#f4f0e8'; // Color de fondo de la tienda
}

async function enviarPedido() {
  intentoEnviar = true;
  validarCamposEnTiempoReal();
  if (!todosCamposValidados()) return;

  const btn = document.getElementById('submit-btn');
  bloquearBoton(btn);

  let totalProductos = 0;
  let productos = [];

  // Calcular productos y subtotal
  for (const codigo in cart) {
    const prod = products.find(p => p.Codigo === codigo);
    const cantidad = cart[codigo];
    totalProductos += prod.Precio * cantidad;
    productos.push({
      nombre: prod.Nombre,
      codigo: prod.Codigo,
      cantidad: cantidad,
      precio_unitario: prod.Precio,
      subtotal: prod.Precio * cantidad
    });
  }

  // Usar dirección validada por Google si existe
  let direccion = document.getElementById('address').value.trim();
  if (autocomplete && autocomplete.getPlace && autocomplete.getPlace() && autocomplete.getPlace().formatted_address) {
    direccion = autocomplete.getPlace().formatted_address;
  }

  // Construir payload según la API esperada
  const payload = {
    nombre_completo: document.getElementById('name').value.trim(),
    correo: document.getElementById('email').value.trim(),
    telefono: document.getElementById('phone').value.trim(),
    direccion: direccion,
    comentario: document.getElementById('comment').value.trim(),
    dia_entrega: document.getElementById('pickup-day').value || null,
    envio_cobrado: Number(costoEnvioActual) || 0,
    confirmado: false,
    entregado: false,
    productos: productos,
    subtotal: totalProductos,
    total: totalProductos + (Number(costoEnvioActual) || 0)
  };

  try {
      const res = await fetch('https://plutarco-api.fly.dev/orders/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });


    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Error al enviar pedido:', res.status, text);
      alert('Error enviando pedido. Intente nuevamente.');
    } else {

      // --- VACIAR TODO EL CARRITO ---
      cart = {};                      // borra los productos seleccionados
      filteredProducts = [...products]; // resetear listado de productos
      renderProductsByCategory(filteredProducts);
      mostrarMensajeEnvio('', 'black');
      costoEnvioActual = 0;
      updateCart();

      // Limpiar campos del formulario
      document.getElementById('name').value = '';
      document.getElementById('email').value = '';
      document.getElementById('phone').value = '';
      document.getElementById('address').value = '';
      document.getElementById('pickup-day').value = '';
      document.getElementById('comment').value = '';
      const orderData = await res.json();
      mostrarConfirmacionPedido(orderData);

    }
  } catch (err) {
    console.error('Fetch error enviarPedido:', err);
    alert('Error enviando pedido. Intente nuevamente.');
  } finally {
    desbloquearBoton(btn);
    intentoEnviar = false; // reset para el próximo pedido
  }
}



// --- Funcionalidad modal descripción producto ---
function crearModalDescripcion(prod) {
  const oldModal = document.getElementById('modal-descripcion');
  if (oldModal) oldModal.remove();

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'modal-descripcion';
  modalOverlay.className = 'modal-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content modal-content-anim'; // <-- animación

  // Imagen grande
  const img = document.createElement('img');
  img.className = 'modal-img';
  img.id = `modal-img-${prod.Codigo}`;
  img.src = `${escapeHtml(prod.Imagen)}`;
  img.alt = prod.Nombre;
  img.onerror = function() {
    this.onerror = null;
    this.src = '/media_static/placeholder.jpg';
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
  desc.innerHTML = (prod.Descripcion || 'Sin descripción disponible.').replace(/\n/g, '<br>');

  // Precio
  const price = document.createElement('div');
  price.style.fontWeight = 'bold';
  price.style.fontSize = '1.2rem';
  price.style.marginBottom = '1.2rem';
  price.textContent = `$${prod.Precio}`;
  desc.className = 'modal-price';

  // Controles de carrito
  const controls = document.createElement('div');
  controls.className = 'modal-controls quantity-controls'; // Aplica ambas clases

function renderControls() {
    controls.innerHTML = '';
    const cantidad = cart[prod.Codigo] || 0;
    
    if (cantidad > 0) {
      // Si hay productos, aplicamos la clase que hace los botones pequeños y redondos
      controls.className = 'modal-controls quantity-controls'; 
      
      const btnMenos = document.createElement('button');
      btnMenos.textContent = '-';
      btnMenos.className = '';
      btnMenos.onclick = (e) => {
        e.stopPropagation();
        updateQuantity(prod.Codigo, -1);
        renderControls();
      };

      const spanCantidad = document.createElement('span');
      spanCantidad.textContent = cantidad;

      const btnMas = document.createElement('button');
      btnMas.textContent = '+';
      btnMas.className = '';
      btnMas.onclick = (e) => {
        e.stopPropagation();
        updateQuantity(prod.Codigo, 1);
        renderControls();
      };

      controls.appendChild(btnMenos);
      controls.appendChild(spanCantidad);
      controls.appendChild(btnMas);
    } else {
      // Si NO hay productos, le quitamos 'quantity-controls' para que el botón grande se vea bien
      controls.className = 'modal-controls'; 
      
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
  
  // Recuerda declarar el contenedor sin la clase conflictiva inicialmente:
  // const controls = document.createElement('div');
  // (La clase se asignará dinámicamente dentro del renderControls)
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


function toggleZoom(idImagen) {
  const original = document.getElementById(idImagen);
  if (!original) return console.error("Imagen no encontrada:", idImagen);

  const existingClone = document.querySelector('.zoom-clone');
  if (existingClone) {
    closeZoom(existingClone);
    return;
  }

  // Crear overlay si no existe
  let overlay = document.querySelector('.zoom-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'zoom-overlay';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');

  // Crear botón cerrar si no existe
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

  // Posición inicial: justo sobre la imagen original
  const rect = original.getBoundingClientRect();
  clone.style.transition = 'none';
  clone.style.position = 'fixed';
  clone.style.top = rect.top + 'px';
  clone.style.left = rect.left + 'px';
  clone.style.width = rect.width + 'px';
  clone.style.height = rect.height + 'px';
  clone.style.margin = 0;

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

  // Posición final centrada en viewport
  const finalTop = (vh - finalHeight) / 2;
  const finalLeft = (vw - finalWidth) / 2;

  // Animar clon a tamaño y posición final
  setTimeout(() => {
    clone.style.transition = 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease';
    
    const finalTop = (window.innerHeight - finalHeight) / 2;
    const finalLeft = (window.innerWidth - finalWidth) / 2;
    clone.style.top = finalTop + 'px';
    clone.style.left = finalLeft + 'px';
    clone.style.width = finalWidth + 'px';
    clone.style.height = finalHeight + 'px';
  }, 20);

  // Función para cerrar zoom
  function closeZoom(cloneImg) {
    cloneImg.style.top = rect.top + 'px';
    cloneImg.style.left = rect.left + 'px';
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

function mostrarMensajeEstado(){
  const divEstado = document.getElementById("status-div");
  Mostrar(divEstado);
  const estadoTitle = document.getElementById("status-title");
  const estadoMensaje = document.getElementById("status-msg");
  if(estadoTitle) {estadoTitle.textContent = "Tienda pausada";}
  if(estadoMensaje) {estadoMensaje.innerHTML = mensajeEstado} 
  
}


const CATEGORIA_EMOJIS = {
  'Panificados Integrales':    { emoji: '🥖', color: '#fef9f0' },
  'Organicos':                 { emoji: '🌿', color: '#f0f7f3' },
  'Refrigerados':              { emoji: '🥛', color: '#f0f4f7' },
  'Congelados':                { emoji: '❄️', color: '#eef4f8' },
  'Infusiones':                { emoji: '🧉', color: '#f7f3ee' },
  'Productos Sueltos':         { emoji: '🌻', color: '#f7f3ee' },
  'Cereales y Legumbres':      { emoji: '🫘', color: '#fef9f0' },
  'Aceites y Conservas':       { emoji: '🫒', color: '#f7f4ee' },
  'Snack':                     { emoji: '🍿', color: '#fef9f0' },
  'Mieles y Dulces':           { emoji: '🍯', color: '#fff8e8' },
  'Bebidas':                   { emoji: '🍵', color: '#f0f7f3' },
  'Sales y Condimentos':       { emoji: '🧄', color: '#f5f5f5' },
  'Cosmetica natural':         { emoji: '🧴', color: '#fdf0f5' },
  'Pollos y Carnes Pastoril':  { emoji: '🥩', color: '#fdf2f0' },
  'Suplementos':               { emoji: '💪', color: '#f0f5f7' },
  'default':                   { emoji: '🛒', color: '#f7f3ee' },
};

function renderCategoryCards() {
  const container = document.getElementById('categoria-cards');
  if (!container) return;

  container.innerHTML = '';

  // Obtener categorías únicas
  let categorias = [...new Set(products.map(p => p.Categoria))];

  // Respetar orden configurado
  categorias.sort((a, b) => {
    const ia = ordenCategorias.indexOf(a);
    const ib = ordenCategorias.indexOf(b);
    const pa = ia !== -1 ? ia : Infinity;
    const pb = ib !== -1 ? ib : Infinity;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, 'es');
  });

  categorias.forEach(cat => {
    const info = CATEGORIA_EMOJIS[cat] || CATEGORIA_EMOJIS['default'];
    const count = products.filter(p => p.Categoria === cat).length;

    const card = document.createElement('div');
    card.className = 'cat-visual-card';
    card.style.backgroundColor = info.color;
    card.onclick = () => {
      filterCategory(cat);
      indiceCategoria = '';
      // Scroll suave a los productos
      setTimeout(() => {
        const productList = document.getElementById('product-list');
        if (productList) productList.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    };

    card.innerHTML = `
      <div class="cat-visual-emoji">${info.emoji}</div>
      <div class="cat-visual-nombre">${cat}</div>
      <div class="cat-visual-count">${count} producto${count !== 1 ? 's' : ''}</div>
    `;

    container.appendChild(card);
  });
}



function renderQuickCats() {
  const container = document.getElementById('quick-cat-pills');
  if (!container) return;
  const top5 = [...new Set(products.map(p => p.Categoria))].slice(0, 5);
  top5.forEach(cat => {
    const info = CATEGORIA_EMOJIS[cat] || CATEGORIA_EMOJIS['default'];
    const pill = document.createElement('div');
    pill.className = 'quick-pill';
    pill.textContent = `${info.emoji} ${cat}`;
    pill.onclick = () => filterCategory(cat);
    container.appendChild(pill);
  });
}

window.onload = async () => {
  await loadconfig();
  if(estadoTienda){
    loadProducts();
    initAutocomplete();
    const searchInput = document.getElementById('search-input');
    const clickHeader = document.getElementById('click_header');
    const botonContacto = document.getElementById("btn-contacto-tienda");
    if (searchInput) {
      searchInput.addEventListener('input', () => searchProduct());
    }
    if (clickHeader) {
      clickHeader.onclick = () => {
        indiceCategoria = '';
        currentFilter = 'Todas';
        filteredProducts = [...products];
        renderProductsByCategory(filteredProducts);
      };
    }
    Mostrar(botonContacto);
  }
  else{
    mostrarMensajeEstado();
  }



}

