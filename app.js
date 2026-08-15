(() => {
  'use strict';

  const N8N_CONFIG = {
    baseUrl: 'https://flatly-handbook-epiphany.ngrok-free.dev',
    webhooks: {
      postulacion: '/webhook/7f6f1634-9472-4fcb-a3b5-a3e055c9b8f4',
      listarVacantes: '/webhook/3a9f40c0-aa9c-4151-8cde-cd3fca0e4a4e',
    },
    debug: true
  };


  // --- Elementos del DOM ---
  const form = document.getElementById('form-postulacion');
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = document.getElementById('btn-text');
  const fileInput = document.getElementById('hoja-vida');
  const dropzone = document.getElementById('dropzone');
  const fileBadge = document.getElementById('file-selected-badge');
  const fileNameText = document.getElementById('file-name-text');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const toastContainer = document.getElementById('toast-container');
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

  // --- Manejo del archivo PDF seleccionado ---
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      mostrarArchivo(e.target.files);
    });

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.backgroundColor = 'rgba(79, 70, 229, 0.08)';
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.style.borderColor = 'var(--border-color)';
          dropzone.style.backgroundColor = 'var(--bg-input)';
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          fileInput.files = files;
          mostrarArchivo(files);
        }
      });
    }

    if (btnRemoveFile) {
      btnRemoveFile.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        fileInput.value = '';
        fileBadge.style.display = 'none';
      });
    }
  }

  function mostrarArchivo(files) {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        mostrarToast('Formato no válido', 'Por favor selecciona un documento en formato PDF.', 'error');
        fileInput.value = '';
        fileBadge.style.display = 'none';
        return;
      }
      fileNameText.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      fileBadge.style.display = 'inline-flex';
    } else {
      fileBadge.style.display = 'none';
    }
  }

  // --- Notificaciones Toast Modernas ---
  function mostrarToast(titulo, mensaje, tipo = 'exito') {
    if (!toastContainer) {
      alert(`${titulo}: ${mensaje}`);
      return;
    }

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

  // --- Envío del Formulario a n8n ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    btnSubmit.classList.add('cargando');
    const originalText = btnText.textContent;
    btnText.textContent = 'Enviando...';

    const formData = new FormData(form);

    try {
      if (N8N_CONFIG.debug) {
        console.log('Enviando a n8n:', `${N8N_CONFIG.baseUrl}${N8N_CONFIG.webhooks.postulacion}`);
      }

      const response = await fetch(`${N8N_CONFIG.baseUrl}${N8N_CONFIG.webhooks.postulacion}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        mostrarToast('Postulación enviada', 'Tus datos fueron recibidos con éxito.', 'exito');
        form.reset();
        if (fileBadge) fileBadge.style.display = 'none';
      } else {
        mostrarToast('Error al enviar', 'El servidor no pudo procesar la solicitud.', 'error');
      }
    } catch (error) {
      console.error('Error de red o conexión:', error);
      mostrarToast('Error de conexión', 'No se pudo conectar con el servicio de automatización n8n.', 'error');
    } finally {
      btnSubmit.classList.remove('cargando');
      btnText.textContent = originalText;
    }
  });

  // --- Cargar Vacantes en el Select desde Google Sheets / n8n ---
  async function cargarVacantesSelect() {
    const selectVacante = document.getElementById('vacante');
    if (!selectVacante) return;

    try {
      const url = `${N8N_CONFIG.baseUrl}${N8N_CONFIG.webhooks.listarVacantes}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'ngrok-skip-browser-warning': 'true' }
      });

      if (response.ok) {
        const rawData = await response.json();
        let lista = Array.isArray(rawData) ? rawData : (rawData.data || rawData.items || rawData.vacantes || []);
        
        if (lista.length > 0) {
          selectVacante.innerHTML = '<option value="" disabled selected>Selecciona una vacante disponible...</option>';
          lista.forEach(item => {
            const codigo = item.codigo || item['Código'] || item.Codigo || '';
            const titulo = item.vacante || item.Vacante || codigo;
            const opt = document.createElement('option');
            opt.value = codigo || titulo;
            opt.textContent = titulo;
            selectVacante.appendChild(opt);
          });
        }
      }
    } catch (e) {
      console.warn('Usando opciones predeterminadas para vacantes.');
    }
  }

  cargarVacantesSelect();

})();