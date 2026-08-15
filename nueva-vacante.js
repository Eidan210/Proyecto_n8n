(() => {
  'use strict';

  // --- Configuración de n8n ---
  const N8N_CONFIG = {
    baseUrl: 'https://flatly-handbook-epiphany.ngrok-free.dev',
    webhooks: {
      // Endpoint para listar las filas de Tabla_Vacantes desde Google Sheets
      listarVacantes: '/webhook/3a9f40c0-aa9c-4151-8cde-cd3fca0e4a4e',
      // Endpoint para registrar una nueva fila en Tabla_Vacantes (opcional/si configuras el webhook POST)
      crearVacante: '/webhook/7ade266f-9b3a-48e9-b47e-c755c23932a1'
    },
    debug: true
  };

  // Lista en memoria de vacantes
  let vacantes = [];

  // --- Elementos del DOM ---
  const form = document.getElementById('form-nueva-vacante');
  const inputVacante = document.getElementById('vacante');
  const inputCodigo = document.getElementById('codigo');
  const inputTecnologias = document.getElementById('tecnologias');
  const inputExperiencia = document.getElementById('experiencia');
  const inputNivelMinimo = document.getElementById('nivel-minimo');
  const btnSubmit = document.getElementById('btn-submit-vacante');
  const btnText = document.getElementById('btn-text');
  const tablaBody = document.getElementById('tabla-vacantes-body');
  const contadorVacantes = document.getElementById('contador-vacantes');
  const btnRecargar = document.getElementById('btn-recargar-vacantes');
  const iconoRecargar = document.getElementById('icono-recargar');
  const toastContainer = document.getElementById('toast-container');

  // Tema
  const btnTema = document.getElementById('btn-tema');
  const iconoTema = document.getElementById('icono-tema');
  const textoTema = document.getElementById('texto-tema');

  // --- Manejo del Modo Claro / Oscuro ---
  function inicializarTema() {
    const temaGuardado = localStorage.getItem('portal-vacantes-tema') || 'light';
    aplicarTema(temaGuardado);

    if (btnTema) {
      btnTema.addEventListener('click', () => {
        const temaActual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const nuevoTema = temaActual === 'dark' ? 'light' : 'dark';
        aplicarTema(nuevoTema);
        localStorage.setItem('portal-vacantes-tema', nuevoTema);
      });
    }
  }

  function aplicarTema(tema) {
    if (tema === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (iconoTema) iconoTema.textContent = '☀️';
      if (textoTema) textoTema.textContent = 'Modo Claro';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (iconoTema) iconoTema.textContent = '🌙';
      if (textoTema) textoTema.textContent = 'Modo Oscuro';
    }
  }

  inicializarTema();

  // --- Auto-generar código (slug) al escribir el título de la vacante ---
  let codigoModificadoManualmente = false;

  if (inputCodigo) {
    inputCodigo.addEventListener('input', () => {
      codigoModificadoManualmente = inputCodigo.value.trim().length > 0;
    });
  }

  if (inputVacante && inputCodigo) {
    inputVacante.addEventListener('input', () => {
      if (!codigoModificadoManualmente) {
        inputCodigo.value = generarSlug(inputVacante.value);
      }
    });
  }

  function generarSlug(texto) {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  // --- Notificaciones Toast ---
  function mostrarToast(titulo, mensaje, tipo = 'exito') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
      <div class="toast-titulo">${titulo}</div>
      <div class="toast-mensaje">${mensaje}</div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4500);
  }

  // --- Renderizado de la Tabla de Vacantes ---
  function renderizarTablaVacantes(lista) {
    tablaBody.innerHTML = '';

    if (!lista || lista.length === 0) {
      tablaBody.innerHTML = `
        <tr>
          <td colspan="5" class="sin-resultados">
            📭 No hay vacantes disponibles en la hoja de cálculo aún.
          </td>
        </tr>
      `;
      if (contadorVacantes) contadorVacantes.textContent = '0 vacantes registradas';
      return;
    }

    lista.forEach(item => {
      // Normalizar nombres de columnas de Google Sheets
      const vacante = item.Vacante || item.vacante || 'Sin título';
      const codigo = item['Código'] || item.Codigo || item.codigo || 'sin-codigo';
      const tecnologias = item['Tecnologías'] || item.Tecnologias || item.tecnologias || 'No especificadas';
      const experiencia = item.Experiencia || item.experiencia || item.Experier || '0 años';
      const nivelMinimo = item['Nivel_Mínimo'] || item['Nivel_Minimo'] || item.Nivel_Míni || item.nivel_minimo || 'Técnico';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-nombre">${vacante}</td>
        <td><span class="badge-codigo">${codigo}</span></td>
        <td>${tecnologias}</td>
        <td><span class="badge-experiencia">${experiencia}</span></td>
        <td><span class="badge-nivel">${nivelMinimo}</span></td>
      `;
      tablaBody.appendChild(tr);
    });

    if (contadorVacantes) {
      contadorVacantes.textContent = `${lista.length} vacantes activas en Google Sheets`;
    }
  }

  // --- Función para Consultar Vacantes desde Google Sheets vía n8n ---
  async function cargarVacantesDesdeN8N() {
    if (iconoRecargar) iconoRecargar.style.animation = 'girar 0.8s linear infinite';

    const url = `${N8N_CONFIG.baseUrl}${N8N_CONFIG.webhooks.listarVacantes}`;

    try {
      if (N8N_CONFIG.debug) {
        console.log('Consultando Tabla_Vacantes desde n8n:', url);
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (response.ok) {
        const rawData = await response.json();
        if (N8N_CONFIG.debug) console.log('Vacantes recibidas de n8n:', rawData);

        let lista = [];
        if (Array.isArray(rawData)) {
          lista = rawData;
        } else if (rawData && typeof rawData === 'object') {
          lista = rawData.data || rawData.items || rawData.vacantes || [rawData];
        }

        vacantes = lista;
        renderizarTablaVacantes(vacantes);
        mostrarToast('Vacantes sincronizadas', `Se cargaron ${vacantes.length} vacantes de Google Sheets.`, 'exito');
      } else {
        renderizarTablaVacantes(vacantes);
      }
    } catch (error) {
      console.warn('Esperando webhook de n8n para listar vacantes.');
      renderizarTablaVacantes(vacantes);
    } finally {
      if (iconoRecargar) iconoRecargar.style.animation = 'none';
    }
  }

  // --- Envío del Formulario de Nueva Vacante ---
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      btnSubmit.classList.add('cargando');
      const originalText = btnText.textContent;
      btnText.textContent = 'Guardando en Google Sheets...';

      const nuevaVacante = {
        Vacante: inputVacante.value.trim(),
        'Código': inputCodigo.value.trim(),
        'Tecnologías': inputTecnologias.value.trim(),
        Experiencia: inputExperiencia.value.trim(),
        'Nivel_Mínimo': inputNivelMinimo.value.trim()
      };

      try {
        const urlCrear = `${N8N_CONFIG.baseUrl}${N8N_CONFIG.webhooks.crearVacante}`;
        
        const response = await fetch(urlCrear, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify(nuevaVacante)
        });

        if (response.ok) {
          mostrarToast('¡Vacante Guardada!', `"${nuevaVacante.Vacante}" se registró en Google Sheets.`, 'exito');
          form.reset();
          codigoModificadoManualmente = false;
          // Recargar tabla desde Google Sheets
          cargarVacantesDesdeN8N();
        } else {
          // Si el webhook de creación aún no está activo, añadimos a la tabla local
          vacantes.unshift(nuevaVacante);
          renderizarTablaVacantes(vacantes);
          mostrarToast('Vacante agregada localmente', `"${nuevaVacante.Vacante}" fue añadida a la vista.`, 'exito');
          form.reset();
          codigoModificadoManualmente = false;
        }
      } catch (error) {
        // Fallback local
        vacantes.unshift(nuevaVacante);
        renderizarTablaVacantes(vacantes);
        mostrarToast('Vacante agregada', `"${nuevaVacante.Vacante}" agregada a la lista.`, 'exito');
        form.reset();
        codigoModificadoManualmente = false;
      } finally {
        btnSubmit.classList.remove('cargando');
        btnText.textContent = originalText;
      }
    });
  }

  // Inyección global
  window.actualizarVacantes = function(nuevasVacantes) {
    if (Array.isArray(nuevasVacantes)) {
      vacantes = nuevasVacantes;
      renderizarTablaVacantes(vacantes);
    }
  };

  // Event listener del botón recargar
  if (btnRecargar) btnRecargar.addEventListener('click', cargarVacantesDesdeN8N);

  // Carga inicial
  cargarVacantesDesdeN8N();

})();
