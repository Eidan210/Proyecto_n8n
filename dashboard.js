(() => {
  'use strict';

  // --- Configuración de n8n ---
  const N8N_CONFIG = {
    baseUrl: 'https://flatly-handbook-epiphany.ngrok-free.dev',
    webhooks: {
      listarCandidatos: '/webhook/9465088c-85c4-4849-9743-dc4a79c2361a',
    },
    debug: true
  };

  // Lista en memoria de candidatos
  let candidatos = [];

  // --- Elementos del DOM ---
  const tbody = document.getElementById('tabla-candidatos-body');
  const filtroVacante = document.getElementById('filtro-vacante');
  const filtroEstado = document.getElementById('filtro-estado');
  const filtroBuscar = document.getElementById('filtro-buscar');
  const btnRecargar = document.getElementById('btn-recargar');
  const iconoRecargar = document.getElementById('icono-recargar');

  // KPIs
  const kpiTotal = document.getElementById('kpi-total');
  const kpiScore = document.getElementById('kpi-score');
  const kpiAnalizados = document.getElementById('kpi-analizados');
  const kpiAceptados = document.getElementById('kpi-aceptados');
  const kpiRechazados = document.getElementById('kpi-rechazados');

  // Tema
  const btnTema = document.getElementById('btn-tema');
  const iconoTema = document.getElementById('icono-tema');
  const textoTema = document.getElementById('texto-tema');
  const toastContainer = document.getElementById('toast-container');

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
    }, 4000);
  }

  // --- Helper para obtener el score seguro ---
  function obtenerScore(c) {
    const val = c.score !== undefined ? c.score : (c.Score_Compatibilidad !== undefined ? c.Score_Compatibilidad : (c.Score || 0));
    if (typeof val === 'string') {
      return parseFloat(val.replace('%', '').trim()) || 0;
    }
    return Number(val || 0);
  }

  // --- Renderizado de Candidatos en la Tabla ---
  function renderizarTabla(lista) {
    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="sin-resultados">
            📭 No hay candidatos registrados o no coinciden con los filtros aplicados.
          </td>
        </tr>
      `;
      actualizarKPIs([]);
      return;
    }

    lista.forEach(c => {
      const id = c.id || c.ID || c.ID_Candidato || 'N/A';
      const nombre = c.nombre || c.Nombre || 'Sin nombre';
      const vacante = c.vacante || c.Vacante || 'No especificada';
      const experiencia = c.experiencia || c.Experiencia || '0 años';
      const estado = c.estado || c.Estado || 'Pendiente';
      const revision = c.revision || c.Revision_RRHH || c['Revisión RRHH'] || c['Revision RRHH'] || c.revision_rrhh || c.Revision || c.decision || c.Decision_RRHH || c['Revisión_RRHH'] || 'Sin revisar';
      const score = obtenerScore(c);

      const estadoUpper = estado.toUpperCase();
      let estadoClass = 'badge-estado analizado';
      if (estadoUpper.includes('RECHAZAD')) {
        estadoClass = 'badge-estado rechazado';
      } else if (estadoUpper.includes('PRIORITARIA') || estadoUpper.includes('ACEPTAD') || estadoUpper.includes('CONTRATAD')) {
        estadoClass = 'badge-estado aceptado';
      } else if (estadoUpper.includes('MANUAL') || estadoUpper.includes('ANALIZAD') || estadoUpper.includes('REVISION') || estadoUpper.includes('REVISIÓN')) {
        estadoClass = 'badge-estado analizado';
      }

      const revisionLower = revision.toLowerCase();
      let revisionClass = 'td-revision';
      if (revisionLower.includes('rechazad')) {
        revisionClass = 'td-revision rechazado';
      } else if (revisionLower.includes('contratad')) {
        revisionClass = 'td-revision contratado';
      } else if (revisionLower.includes('prioritaria')) {
        revisionClass = 'td-revision prioritaria';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-id">${id}</td>
        <td class="td-nombre">${nombre}</td>
        <td>${vacante}</td>
        <td>${experiencia}</td>
        <td class="td-score ${score >= 80 ? 'score-alto' : score >= 50 ? 'score-medio' : 'score-bajo'}">${score}%</td>
        <td><span class="badge-estado ${estadoClass}">${estado}</span></td>
        <td class="${revisionClass}">${revision}</td>
      `;
      tbody.appendChild(tr);
    });

    actualizarKPIs(lista);
  }

  // --- Cálculo de Métricas KPI ---
  function actualizarKPIs(lista) {
    const total = lista.length;
    let sumaScore = 0;
    let analizados = 0;
    let aceptados = 0;
    let rechazados = 0;

    lista.forEach(c => {
      const score = obtenerScore(c);
      sumaScore += score;
      
      const estado = (c.estado || c.Estado || '').toUpperCase();
      const revision = (c.revision || c.Revision_RRHH || c['Revisión RRHH'] || c['Revision RRHH'] || c.revision_rrhh || c.Revision || '').toUpperCase();
      const textoEval = `${estado} ${revision}`;

      // Si la decisión final en Revisión RRHH o Estado es Rechazado
      if (textoEval.includes('RECHAZAD') || textoEval.includes('NO APTO') || textoEval.includes('DESCARTAD')) {
        rechazados++;
      } else if (textoEval.includes('CONTRATAD') || textoEval.includes('ACEPTAD') || textoEval.includes('PRIORITARIA') || textoEval.includes('APROBAD')) {
        aceptados++;
      } else if (textoEval.includes('ANALIZAD') || textoEval.includes('MANUAL') || textoEval.includes('REVISION') || textoEval.includes('REVISIÓN') || textoEval.includes('PENDIENTE') || textoEval.includes('SECUNDARIA')) {
        analizados++;
      } else {
        analizados++;
      }
    });

    const scorePromedio = total > 0 ? Math.round(sumaScore / total) : 0;

    kpiTotal.textContent = total;
    kpiScore.textContent = `${scorePromedio}%`;
    kpiAnalizados.textContent = analizados;
    kpiAceptados.textContent = aceptados;
    kpiRechazados.textContent = rechazados;
  }

  // --- Filtros en Tiempo Real ---
  function filtrarCandidatos() {
    const vacanteSeleccionada = filtroVacante.value.toLowerCase();
    const estadoSeleccionado = filtroEstado.value.toLowerCase();
    const textoBuscar = filtroBuscar.value.trim().toLowerCase();

    const filtrados = candidatos.filter(c => {
      const vacante = (c.vacante || c.Vacante || '').toLowerCase();
      const estado = (c.estado || c.Estado || '').toLowerCase();
      const revision = (c.revision || c.Revision_RRHH || c['Revisión RRHH'] || c['Revision RRHH'] || '').toLowerCase();
      const nombre = (c.nombre || c.Nombre || '').toLowerCase();
      const id = (c.id || c.ID || c.ID_Candidato || '').toLowerCase();

      const coincideVacante = vacanteSeleccionada === 'todas' || vacante.includes(vacanteSeleccionada);
      
      const coincideEstado = estadoSeleccionado === 'todos' || 
                             estado.includes(estadoSeleccionado) || 
                             revision.includes(estadoSeleccionado) ||
                             (estadoSeleccionado === 'aceptado' && (revision.includes('contratado') || estado.includes('prioritaria'))) ||
                             (estadoSeleccionado === 'analizado' && (estado.includes('manual') || estado.includes('revisión') || estado.includes('revision')));

      const coincideBusqueda = textoBuscar === '' || nombre.includes(textoBuscar) || id.includes(textoBuscar);

      return coincideVacante && coincideEstado && coincideBusqueda;
    });

    renderizarTabla(filtrados);
  }

  // --- Cargar Candidatos desde n8n ---
  async function cargarCandidatosDesdeN8N() {
    if (iconoRecargar) iconoRecargar.style.animation = 'girar 0.8s linear infinite';

    const url = `${N8N_CONFIG.baseUrl}${N8N_CONFIG.webhooks.listarCandidatos}`;

    try {
      if (N8N_CONFIG.debug) {
        console.log('Consultando candidatos a n8n:', url);
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
        if (N8N_CONFIG.debug) console.log('Datos recibidos de n8n:', rawData);

        let lista = [];
        if (Array.isArray(rawData)) {
          lista = rawData;
        } else if (rawData && typeof rawData === 'object') {
          lista = rawData.data || rawData.items || rawData.candidatos || [rawData];
        }

        candidatos = lista;
        renderizarTabla(candidatos);
        mostrarToast('Datos sincronizados', `Se cargaron ${candidatos.length} candidatos desde Google Sheets.`, 'exito');
      } else {
        console.error('Error HTTP de n8n:', response.status);
        mostrarToast('Error del Webhook', `El webhook respondió con código ${response.status}.`, 'error');
        renderizarTabla(candidatos);
      }
    } catch (error) {
      console.error('Error al consultar n8n:', error);
      mostrarToast('Error de conexión o CORS', 'No se pudo conectar con n8n. Revisa las cabeceras CORS en Respond to Webhook.', 'error');
      renderizarTabla(candidatos);
    } finally {
      if (iconoRecargar) iconoRecargar.style.animation = 'none';
    }
  }

  // Inyección global
  window.actualizarCandidatos = function(nuevosCandidatos) {
    if (Array.isArray(nuevosCandidatos)) {
      candidatos = nuevosCandidatos;
      renderizarTabla(candidatos);
      mostrarToast('Datos recibidos', `Se actualizaron ${candidatos.length} registros.`, 'exito');
    }
  };

  // Event Listeners
  if (filtroVacante) filtroVacante.addEventListener('change', filtrarCandidatos);
  if (filtroEstado) filtroEstado.addEventListener('change', filtrarCandidatos);
  if (filtroBuscar) filtroBuscar.addEventListener('input', filtrarCandidatos);
  if (btnRecargar) btnRecargar.addEventListener('click', cargarCandidatosDesdeN8N);

  // Carga inicial
  cargarCandidatosDesdeN8N();

})();
