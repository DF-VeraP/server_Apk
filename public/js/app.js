/**
 * NEXUS CONTACTOS - LOGICA DE CLIENTE (WEB SPA)
 * Gestión Online / Offline, Autenticación, 30m Inactividad, Alertas y CRUD
 */

(function () {
  'use strict';

  // Configuración y variables de estado
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos
  let inactivityTimer = null;
  let remainingSeconds = 30 * 60;
  let countdownInterval = null;
  let lastActiveTimestamp = Date.now();

  let authToken = localStorage.getItem('nexus_auth_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('nexus_auth_user') || 'null');
  let contactsCache = JSON.parse(localStorage.getItem('nexus_contacts_cache') || '[]');
  let pendingSyncQueue = JSON.parse(localStorage.getItem('nexus_sync_queue') || '[]');
  let contactToDelete = null;

  // Elementos del DOM
  const authSection = document.getElementById('authSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const userSessionArea = document.getElementById('userSessionArea');
  const userEmailDisplay = document.getElementById('userEmailDisplay');
  const inactivityTimerDisplay = document.getElementById('inactivityTimerDisplay');
  const btnLogout = document.getElementById('btnLogout');

  // Tabs de Auth
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const resetForm = document.getElementById('resetForm');
  const authTabs = document.getElementById('authTabs');

  // Formularios
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginAlertBox = document.getElementById('loginAlertBox');
  const registerEmail = document.getElementById('registerEmail');
  const registerAlertBox = document.getElementById('registerAlertBox');
  const newPassword = document.getElementById('newPassword');
  const confirmNewPassword = document.getElementById('confirmNewPassword');
  const resetAlertBox = document.getElementById('resetAlertBox');

  // Modal Olvidé mi Contraseña
  const btnOpenForgotModal = document.getElementById('btnOpenForgotModal');
  const forgotPasswordModal = document.getElementById('forgotPasswordModal');
  const btnCloseForgotModal = document.getElementById('btnCloseForgotModal');
  const btnCancelForgot = document.getElementById('btnCancelForgot');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const forgotEmail = document.getElementById('forgotEmail');
  const forgotAlertBox = document.getElementById('forgotAlertBox');
  const btnSubmitForgot = document.getElementById('btnSubmitForgot');

  // Dashboard & Contactos
  const searchInput = document.getElementById('searchInput');
  const contactCountBadge = document.getElementById('contactCountBadge');
  const contactsTableBody = document.getElementById('contactsTableBody');
  const contactsCardsContainer = document.getElementById('contactsCardsContainer');
  const btnFabAddContact = document.getElementById('btnFabAddContact');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const btnOpenAddModal = document.getElementById('btnOpenAddModal');
  const btnRefreshContacts = document.getElementById('btnRefreshContacts');
  const offlineSyncBanner = document.getElementById('offlineSyncBanner');
  const offlineSyncText = document.getElementById('offlineSyncText');
  const networkStatusBadge = document.getElementById('networkStatusBadge');
  const networkStatusText = document.getElementById('networkStatusText');

  // Modal Contacto
  const contactModal = document.getElementById('contactModal');
  const contactForm = document.getElementById('contactForm');
  const modalTitle = document.getElementById('modalTitle');
  const modalMode = document.getElementById('modalMode');
  const inputCc = document.getElementById('inputCc');
  const inputNombres = document.getElementById('inputNombres');
  const inputApellidos = document.getElementById('inputApellidos');
  const inputContacto = document.getElementById('inputContacto');
  const inputProfesion = document.getElementById('inputProfesion');
  const inputFechaNac = document.getElementById('inputFechaNac');
  const inputDireccion = document.getElementById('inputDireccion');
  const modalAlertBox = document.getElementById('modalAlertBox');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');

  const deleteModal = document.getElementById('deleteModal');
  const btnCancelDelete = document.getElementById('btnCancelDelete');
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');
  const deleteModalText = document.getElementById('deleteModalText');
  const inactivityModal = document.getElementById('inactivityModal');
  const btnInactivityOk = document.getElementById('btnInactivityOk');

  // Módulo Pendientes de Sincronización
  const btnVerPendientes = document.getElementById('btnVerPendientes');
  const pendingCountBadge = document.getElementById('pendingCountBadge');
  const pendingSyncModal = document.getElementById('pendingSyncModal');
  const modalPendingCount = document.getElementById('modalPendingCount');
  const pendingListContainer = document.getElementById('pendingListContainer');
  const pendingSyncAlertBox = document.getElementById('pendingSyncAlertBox');
  const btnClosePendingModal = document.getElementById('btnClosePendingModal');
  const btnCancelPending = document.getElementById('btnCancelPending');
  const btnForceSyncNow = document.getElementById('btnForceSyncNow');

  // Banner Móvil APK
  const mobileApkBanner = document.getElementById('mobileApkBanner');
  const btnCloseBanner = document.getElementById('btnCloseBanner');

  // =========================================================================
  // 1. INICIALIZACIÓN
  // =========================================================================
  function init() {
    detectMobileDevice();
    checkNetworkStatus();
    setupEventListeners();
    handleUrlHashRouting();
    actualizarContadorPendientes();

    if (authToken && currentUser) {
      showDashboard();
      cargarContactos();
      iniciarControlInactividad();
    } else {
      showAuth();
    }
  }

  // Detectar si el usuario está en móvil para sugerir el APK
  function detectMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const bannerDismissed = sessionStorage.getItem('nexus_apk_banner_dismissed');

    if (isMobile && !bannerDismissed) {
      mobileApkBanner.classList.remove('hidden');
    }
  }

  // =========================================================================
  // 2. DETECCIÓN DE RED Y MODO OFFLINE
  // =========================================================================
  function checkNetworkStatus() {
    actualizarContadorPendientes();
    const isOnline = navigator.onLine;
    if (isOnline) {
      networkStatusBadge.className = 'status-badge online';
      networkStatusText.textContent = 'Online';
      offlineSyncBanner.classList.add('hidden');

      // Si tenemos operaciones pendientes en cola, sincronizar con el servidor
      if (pendingSyncQueue.length > 0 && authToken) {
        sincronizarConServidor();
      }
    } else {
      networkStatusBadge.className = 'status-badge offline';
      networkStatusText.textContent = 'Offline';
      offlineSyncBanner.classList.remove('hidden');
      offlineSyncText.textContent = `Modo Offline: Operando en almacenamiento local (${pendingSyncQueue.length} cambio(s) pendiente(s)).`;
    }
  }

  // =========================================================================
  // 3. CONTROL DE INACTIVIDAD (30 MINUTOS)
  // =========================================================================
  function resetearInactividad() {
    if (!authToken) return;
    lastActiveTimestamp = Date.now();
    remainingSeconds = INACTIVITY_LIMIT_MS / 1000;
    actualizarDisplayInactividad();
  }

  function actualizarDisplayInactividad() {
    if (!inactivityTimerDisplay) return;
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    inactivityTimerDisplay.innerHTML = `<i class="bi bi-clock"></i> ${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (remainingSeconds <= 120) {
      inactivityTimerDisplay.style.color = '#ef4444'; // Rojo cuando faltan < 2 min
    } else {
      inactivityTimerDisplay.style.color = 'var(--accent-amber)';
    }
  }

  function iniciarControlInactividad() {
    detenerControlInactividad();
    resetearInactividad();

    // Eventos de usuario para detectar interacción
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
      window.addEventListener(evt, resetearInactividad, { passive: true });
    });

    // Tick cada segundo
    countdownInterval = setInterval(() => {
      const transcurrido = Date.now() - lastActiveTimestamp;
      remainingSeconds = Math.max(0, Math.floor((INACTIVITY_LIMIT_MS - transcurrido) / 1000));
      actualizarDisplayInactividad();

      if (remainingSeconds <= 0) {
        cerrarSesionPorInactividad();
      }
    }, 1000);
  }

  function detenerControlInactividad() {
    if (countdownInterval) clearInterval(countdownInterval);
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
      window.removeEventListener(evt, resetearInactividad);
    });
  }

  function cerrarSesionPorInactividad() {
    detenerControlInactividad();
    logout(false);
    inactivityModal.classList.remove('hidden');
  }

  // =========================================================================
  // 4. MANEJO DE RUTAS POR HASH (RESTABLECER DESDE CORREO)
  // =========================================================================
  function handleUrlHashRouting() {
    const hash = window.location.hash;
    if (hash.startsWith('#restablecer')) {
      const urlParams = new URLSearchParams(hash.replace('#restablecer?', ''));
      const token = urlParams.get('token');
      const email = urlParams.get('email');

      if (token) {
        showAuth();
        authTabs.classList.add('hidden');
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        resetForm.classList.remove('hidden');

        document.getElementById('resetSubtext').textContent = 
          `Confirmaste el acceso para ${email || 'tu cuenta'}. Ingresa tu nueva contraseña para reactivar tu cuenta y resetear intentos a 0.`;
        resetForm.dataset.token = token;
      }
    }
  }

  // =========================================================================
  // 5. EVENT LISTENERS
  // =========================================================================
  function setupEventListeners() {
    // Escucha de estado de conexión
    window.addEventListener('online', checkNetworkStatus);
    window.addEventListener('offline', checkNetworkStatus);

    // Banner móvil
    btnCloseBanner.addEventListener('click', () => {
      mobileApkBanner.classList.add('hidden');
      sessionStorage.setItem('nexus_apk_banner_dismissed', 'true');
    });

    // Toggle universal de visibilidad de contraseñas (Ojo abrir / cerrar)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-toggle-pwd');
      if (!btn) return;
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        const isCurrentlyPassword = input.type === 'password';
        input.type = isCurrentlyPassword ? 'text' : 'password';
        btn.innerHTML = isCurrentlyPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        btn.setAttribute('title', isCurrentlyPassword ? 'Ocultar contraseña' : 'Ver contraseña');
      }
    });

    // Pestañas Login / Registro
    tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
    tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

    // Envío de formularios Auth
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    resetForm.addEventListener('submit', handleResetPassword);

    // Logout
    btnLogout.addEventListener('click', () => logout(true));
    btnInactivityOk.addEventListener('click', () => {
      inactivityModal.classList.add('hidden');
      showAuth();
      switchAuthTab('login');
    });

    // Búsqueda en tiempo real
    searchInput.addEventListener('input', filtrarContactosEnTabla);
    btnRefreshContacts.addEventListener('click', () => cargarContactos(true));

    // Modales de Contacto (Boton superior y Boton Flotante FAB para móviles)
    btnOpenAddModal.addEventListener('click', () => abrirModalContacto('create'));
    if (btnFabAddContact) {
      btnFabAddContact.addEventListener('click', () => abrirModalContacto('create'));
    }
    btnCloseModal.addEventListener('click', cerrarModalContacto);
    btnCancelModal.addEventListener('click', cerrarModalContacto);
    contactForm.addEventListener('submit', guardarContacto);

    // Modal de Eliminación
    btnCancelDelete.addEventListener('click', () => deleteModal.classList.add('hidden'));
    btnConfirmDelete.addEventListener('click', ejecutarEliminacionContacto);

    // Modal Olvidé mi contraseña
    if (btnOpenForgotModal) {
      btnOpenForgotModal.addEventListener('click', abrirModalOlvidePassword);
    }
    if (btnCloseForgotModal) {
      btnCloseForgotModal.addEventListener('click', cerrarModalOlvidePassword);
    }
    if (btnCancelForgot) {
      btnCancelForgot.addEventListener('click', cerrarModalOlvidePassword);
    }
    if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', handleOlvidePassword);
    }

    // Modal Módulo Pendientes de Sincronización
    if (btnVerPendientes) {
      btnVerPendientes.addEventListener('click', abrirModalPendientes);
    }
    if (btnClosePendingModal) {
      btnClosePendingModal.addEventListener('click', cerrarModalPendientes);
    }
    if (btnCancelPending) {
      btnCancelPending.addEventListener('click', cerrarModalPendientes);
    }
    if (btnForceSyncNow) {
      btnForceSyncNow.addEventListener('click', forzarSincronizacionManual);
    }

    // Restricciones de entrada: Solo números en Cédula (CC) y Teléfono
    [inputCc, inputContacto].forEach(input => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
      });
      input.addEventListener('keypress', (e) => {
        if (!/[0-9]/.test(e.key) && !['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'].includes(e.key)) {
          e.preventDefault();
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const texto = (e.clipboardData || window.clipboardData).getData('text');
        const soloNumeros = texto.replace(/\D/g, '');
        document.execCommand('insertText', false, soloNumeros);
      });
    });

    // Restricciones de entrada: Solo letras y espacios en Nombres y Apellidos
    [inputNombres, inputApellidos].forEach(input => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
      });
      input.addEventListener('keypress', (e) => {
        if (/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const texto = (e.clipboardData || window.clipboardData).getData('text');
        const soloLetras = texto.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        document.execCommand('insertText', false, soloLetras);
      });
    });
  }

  // =========================================================================
  // 6. FLUJOS DE AUTENTICACIÓN
  // =========================================================================
  function switchAuthTab(tab) {
    loginAlertBox.classList.add('hidden');
    registerAlertBox.classList.add('hidden');
    resetAlertBox.classList.add('hidden');
    authTabs.classList.remove('hidden');
    resetForm.classList.add('hidden');

    if (tab === 'login') {
      tabLoginBtn.classList.add('active');
      tabRegisterBtn.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      tabLoginBtn.classList.remove('active');
      tabRegisterBtn.classList.add('active');
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    loginAlertBox.classList.add('hidden');
    const submitBtn = document.getElementById('btnLoginSubmit');
    setLoadingBtn(submitBtn, true);

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { error: 'Error del servidor (' + res.status + '). Verifica la conexión.' };
      }

      if (!res.ok) {
        // Manejo de intentos y bloqueo
        if (data.bloqueado) {
          mostrarAlerta(loginAlertBox, 'error', `
            <strong><i class="bi bi-shield-x"></i> Cuenta Bloqueada (4 Intentos Fallidos)</strong><br>
            ${data.error}<br><br>
            <em>Revisa tu bandeja de entrada o spam. Hemos enviado un correo con las opciones [SÍ] y [NO] para restablecer tu contraseña.</em>
          `);
        } else if (data.intentosRestantes !== undefined) {
          mostrarAlerta(loginAlertBox, 'warning', `
            <strong><i class="bi bi-exclamation-triangle"></i> Acceso Incorrecto</strong><br>
            ${data.error}
          `);
        } else {
          mostrarAlerta(loginAlertBox, 'error', data.error || 'Credenciales inválidas');
        }
        return;
      }

      // Login exitoso
      authToken = data.token;
      currentUser = data.usuario;
      localStorage.setItem('nexus_auth_token', authToken);
      localStorage.setItem('nexus_auth_user', JSON.stringify(currentUser));

      mostrarToast('success', '¡Bienvenido! Sesión iniciada.');
      loginForm.reset();
      showDashboard();
      cargarContactos();
      iniciarControlInactividad();

    } catch (err) {
      console.error(err);
      mostrarAlerta(loginAlertBox, 'error', 'Error de conexión con el servidor. Verifica que esté en línea.');
    } finally {
      setLoadingBtn(submitBtn, false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    registerAlertBox.classList.add('hidden');
    const submitBtn = document.getElementById('btnRegisterSubmit');
    setLoadingBtn(submitBtn, true);

    const email = registerEmail.value.trim();

    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarAlerta(registerAlertBox, 'error', data.error || 'Error al registrar usuario');
        return;
      }

      mostrarAlerta(registerAlertBox, 'success', `
        <strong><i class="bi bi-check-circle"></i> Registro Exitoso</strong><br>
        ${data.mensaje}<br><br>
        <em>Revisa tu correo electrónico para obtener la contraseña autogenerada y luego inicia sesión.</em>
      `);

      registerForm.reset();
      setTimeout(() => {
        switchAuthTab('login');
        loginEmail.value = email;
        mostrarAlerta(loginAlertBox, 'success', 'Ingresa la contraseña que recibiste en tu correo para acceder.');
      }, 3500);

    } catch (err) {
      console.error(err);
      mostrarAlerta(registerAlertBox, 'error', 'Error al procesar el registro.');
    } finally {
      setLoadingBtn(submitBtn, false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    resetAlertBox.classList.add('hidden');
    const submitBtn = document.getElementById('btnResetSubmit');
    setLoadingBtn(submitBtn, true);

    const token = resetForm.dataset.token;
    const pwd1 = newPassword.value;
    const pwd2 = confirmNewPassword.value;

    if (pwd1 !== pwd2) {
      mostrarAlerta(resetAlertBox, 'error', 'Las contraseñas no coinciden');
      setLoadingBtn(submitBtn, false);
      return;
    }

    try {
      const res = await fetch('/api/auth/restablecer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nuevaPassword: pwd1 }),
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarAlerta(resetAlertBox, 'error', data.error || 'No se pudo restablecer la contraseña');
        return;
      }

      window.location.hash = '';
      mostrarToast('success', '¡Cuenta desbloqueada y contraseña actualizada!');
      resetForm.reset();
      switchAuthTab('login');
      mostrarAlerta(loginAlertBox, 'success', 'Cuenta desbloqueada con éxito. Ya puedes iniciar sesión con tu nueva contraseña.');

    } catch (err) {
      console.error(err);
      mostrarAlerta(resetAlertBox, 'error', 'Error al restablecer contraseña.');
    } finally {
      setLoadingBtn(submitBtn, false);
    }
  }

  function abrirModalOlvidePassword() {
    forgotAlertBox.classList.add('hidden');
    forgotPasswordForm.reset();
    if (loginEmail && loginEmail.value.trim()) {
      forgotEmail.value = loginEmail.value.trim();
    }
    forgotPasswordModal.classList.remove('hidden');
    setTimeout(() => forgotEmail.focus(), 50);
  }

  function cerrarModalOlvidePassword() {
    forgotPasswordModal.classList.add('hidden');
    forgotAlertBox.classList.add('hidden');
  }

  async function handleOlvidePassword(e) {
    e.preventDefault();
    forgotAlertBox.classList.add('hidden');
    const submitBtn = document.getElementById('btnSubmitForgot');
    setLoadingBtn(submitBtn, true);

    const email = forgotEmail.value.trim();

    try {
      const res = await fetch('/api/auth/olvide-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarAlerta(forgotAlertBox, 'error', data.error || 'No se pudo procesar la solicitud.');
        return;
      }

      mostrarAlerta(forgotAlertBox, 'success', `
        <strong><i class="bi bi-envelope-check"></i> Notificación Enviada</strong><br>
        ${data.mensaje}
      `);
      mostrarToast('success', 'Enlace de restablecimiento enviado a tu correo.');
      forgotPasswordForm.reset();

      setTimeout(() => {
        cerrarModalOlvidePassword();
      }, 4000);

    } catch (err) {
      console.error('Error al solicitar recuperación de contraseña:', err);
      mostrarAlerta(forgotAlertBox, 'error', 'Error de conexión con el servidor. Intenta de nuevo.');
    } finally {
      setLoadingBtn(submitBtn, false);
    }
  }

  function logout(notify = true) {
    detenerControlInactividad();
    authToken = null;
    currentUser = null;
    localStorage.removeItem('nexus_auth_token');
    localStorage.removeItem('nexus_auth_user');
    showAuth();
    switchAuthTab('login');

    if (notify) {
      mostrarToast('info', 'Has cerrado sesión.');
    }
  }

  // =========================================================================
  // 7. VISTAS PRINCIPALES
  // =========================================================================
  function showAuth() {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    userSessionArea.classList.add('hidden');
  }

  function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    userSessionArea.classList.remove('hidden');
    userEmailDisplay.textContent = currentUser ? currentUser.email : 'Usuario';
  }

  // =========================================================================
  // 8. GESTIÓN CRUD DE CONTACTOS (ONLINE & OFFLINE)
  // =========================================================================
  async function cargarContactos(forzarRefresh = false) {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Primero renderizamos desde caché local si existe
    if (contactsCache && contactsCache.length > 0) {
      renderizarTabla(contactsCache);
      loadingState.classList.add('hidden');
    }

    // Si no hay red, nos quedamos con la caché
    if (!navigator.onLine) {
      loadingState.classList.add('hidden');
      renderizarTabla(contactsCache);
      return;
    }

    try {
      const res = await fetch('/api/contactos', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (res.status === 401) {
        cerrarSesionPorInactividad();
        return;
      }

      if (!res.ok) throw new Error('Error al cargar contactos');

      const data = await res.json();
      contactsCache = data;
      localStorage.setItem('nexus_contacts_cache', JSON.stringify(contactsCache));
      renderizarTabla(contactsCache);

    } catch (err) {
      console.warn('Cargando en modo offline por error de red:', err.message);
      renderizarTabla(contactsCache);
    } finally {
      loadingState.classList.add('hidden');
    }
  }

  function renderizarTabla(contactos) {
    contactsTableBody.innerHTML = '';
    if (contactsCardsContainer) contactsCardsContainer.innerHTML = '';
    contactCountBadge.textContent = `${contactos.length} contacto(s)`;

    if (contactos.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    contactos.forEach(c => {
      const inicial = (c.nombres || 'C').charAt(0).toUpperCase();

      // 1. FILA PARA TABLA DE ESCRITORIO (Laptops y Desktop)
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="cc-badge">${escapeHtml(c.cc)}</span></td>
        <td>
          <div class="contact-user-cell">
            <div class="avatar-circle">${inicial}</div>
            <div class="contact-name">${escapeHtml(c.nombres)} ${escapeHtml(c.apellidos || '')}</div>
          </div>
        </td>
        <td>
          <a href="tel:${escapeHtml(c.contacto)}" class="phone-link" title="Llamar">
            <i class="bi bi-telephone"></i> ${escapeHtml(c.contacto)}
          </a>
        </td>
        <td>${escapeHtml(c.profesion || '—')}</td>
        <td>${escapeHtml(c.direccion || '—')}</td>
        <td>${c.fecha_nacimiento ? c.fecha_nacimiento.split('T')[0] : '—'}</td>
        <td class="text-right">
          <div class="table-actions">
            <button class="btn-action-edit" data-cc="${escapeHtml(c.cc)}" title="Editar"><i class="bi bi-pencil-square"></i> Editar</button>
            <button class="btn-action-delete" data-cc="${escapeHtml(c.cc)}" data-name="${escapeHtml(c.nombres)}" title="Eliminar"><i class="bi bi-trash3"></i> Borrar</button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-action-edit').addEventListener('click', () => abrirModalContacto('edit', c));
      tr.querySelector('.btn-action-delete').addEventListener('click', () => abrirModalEliminar(c));
      contactsTableBody.appendChild(tr);

      // 2. TARJETA ESTRUCTURAL TRANSFORMADA (Tablets en cuadrícula y Móviles estilo libreta)
      if (contactsCardsContainer) {
        const card = document.createElement('div');
        card.className = 'contact-card-responsive';
        card.innerHTML = `
          <div class="card-header-row">
            <div class="card-avatar-group">
              <div class="card-avatar">${inicial}</div>
              <div class="card-user-info">
                <h4 class="card-user-name">${escapeHtml(c.nombres)} ${escapeHtml(c.apellidos || '')}</h4>
                <div class="card-badges">
                  <span class="cc-badge">CC ${escapeHtml(c.cc)}</span>
                  ${c.profesion ? `<span class="card-prof-badge"><i class="bi bi-briefcase"></i> ${escapeHtml(c.profesion)}</span>` : ''}
                </div>
              </div>
            </div>
            <a href="tel:${escapeHtml(c.contacto)}" class="btn-quick-call" title="Llamar directamente a ${escapeHtml(c.nombres)}" aria-label="Llamar">
              <i class="bi bi-telephone-fill"></i>
            </a>
          </div>

          <div class="card-details-grid">
            <div class="card-detail-item">
              <span class="detail-label"><i class="bi bi-telephone"></i> Teléfono</span>
              <a href="tel:${escapeHtml(c.contacto)}" class="detail-value phone-value">${escapeHtml(c.contacto)}</a>
            </div>
            ${c.direccion ? `
            <div class="card-detail-item">
              <span class="detail-label"><i class="bi bi-geo-alt"></i> Dirección</span>
              <span class="detail-value">${escapeHtml(c.direccion)}</span>
            </div>` : ''}
            ${c.fecha_nacimiento ? `
            <div class="card-detail-item">
              <span class="detail-label"><i class="bi bi-calendar3"></i> Nacimiento</span>
              <span class="detail-value">${c.fecha_nacimiento.split('T')[0]}</span>
            </div>` : ''}
          </div>

          <div class="card-actions-bar">
            <button class="btn-card-edit" data-cc="${escapeHtml(c.cc)}" title="Editar"><i class="bi bi-pencil-square"></i> Editar</button>
            <button class="btn-card-delete" data-cc="${escapeHtml(c.cc)}" title="Eliminar"><i class="bi bi-trash3"></i> Eliminar</button>
          </div>
        `;

        card.querySelector('.btn-card-edit').addEventListener('click', () => abrirModalContacto('edit', c));
        card.querySelector('.btn-card-delete').addEventListener('click', () => abrirModalEliminar(c));
        contactsCardsContainer.appendChild(card);
      }
    });
  }

  function filtrarContactosEnTabla() {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      renderizarTabla(contactsCache);
      return;
    }

    const filtrados = contactsCache.filter(c => {
      const nom = `${c.nombres} ${c.apellidos}`.toLowerCase();
      const cc = (c.cc || '').toLowerCase();
      const tel = (c.contacto || '').toLowerCase();
      const prof = (c.profesion || '').toLowerCase();
      return nom.includes(q) || cc.includes(q) || tel.includes(q) || prof.includes(q);
    });

    renderizarTabla(filtrados);
  }

  // =========================================================================
  // 9. MODAL AGREGAR / EDITAR
  // =========================================================================
  function abrirModalContacto(mode, contacto = null) {
    modalAlertBox.classList.add('hidden');
    contactForm.reset();
    modalMode.value = mode;

    if (mode === 'create') {
      modalTitle.textContent = 'Nuevo Contacto';
      inputCc.disabled = false;
    } else {
      modalTitle.textContent = 'Editar Contacto';
      inputCc.value = contacto.cc;
      inputCc.disabled = true; // La cédula actúa como clave primaria del contacto
      inputNombres.value = contacto.nombres || '';
      inputApellidos.value = contacto.apellidos || '';
      inputContacto.value = contacto.contacto || '';
      inputProfesion.value = contacto.profesion || '';
      inputDireccion.value = contacto.direccion || '';
      if (contacto.fecha_nacimiento) {
        inputFechaNac.value = contacto.fecha_nacimiento.split('T')[0];
      }
    }

    contactModal.classList.remove('hidden');
  }

  function cerrarModalContacto() {
    contactModal.classList.add('hidden');
    contactForm.reset();
  }

  async function guardarContacto(e) {
    e.preventDefault();
    modalAlertBox.classList.add('hidden');
    const submitBtn = document.getElementById('btnSaveContact');
    setLoadingBtn(submitBtn, true);

    const mode = modalMode.value;
    const contactoData = {
      cc: inputCc.value.trim(),
      nombres: inputNombres.value.trim(),
      apellidos: inputApellidos.value.trim(),
      contacto: inputContacto.value.trim(),
      profesion: inputProfesion.value.trim() || null,
      fecha_nacimiento: inputFechaNac.value || null,
      direccion: inputDireccion.value.trim() || null,
    };

    // Validaciones estrictas: Solo números en CC y Teléfono; Solo letras y espacios en Nombres y Apellidos
    if (!/^\d+$/.test(contactoData.cc)) {
      mostrarAlerta(modalAlertBox, 'error', 'La cédula (CC) solo debe contener números.');
      setLoadingBtn(submitBtn, false);
      inputCc.focus();
      return;
    }

    if (!/^\d+$/.test(contactoData.contacto)) {
      mostrarAlerta(modalAlertBox, 'error', 'El teléfono / celular solo debe contener números.');
      setLoadingBtn(submitBtn, false);
      inputContacto.focus();
      return;
    }

    const soloLetrasRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!soloLetrasRegex.test(contactoData.nombres)) {
      mostrarAlerta(modalAlertBox, 'error', 'Los nombres solo deben contener letras y espacios (no se permiten números ni símbolos).');
      setLoadingBtn(submitBtn, false);
      inputNombres.focus();
      return;
    }

    if (!soloLetrasRegex.test(contactoData.apellidos)) {
      mostrarAlerta(modalAlertBox, 'error', 'Los apellidos solo deben contener letras y espacios (no se permiten números ni símbolos).');
      setLoadingBtn(submitBtn, false);
      inputApellidos.focus();
      return;
    }

    // Caso Offline
    if (!navigator.onLine) {
      if (mode === 'create') {
        const existeCc = contactsCache.some(c => String(c.cc).trim() === String(contactoData.cc).trim());
        if (existeCc) {
          mostrarAlerta(modalAlertBox, 'error', 'Ya tienes un contacto registrado con esa cédula.');
          setLoadingBtn(submitBtn, false);
          inputCc.focus();
          return;
        }
      }

      // Validar si ya existe ese teléfono en modo offline
      const existeTel = contactsCache.some(c => {
        const mismoTel = String(c.contacto).trim() === String(contactoData.contacto).trim();
        if (mode === 'create') return mismoTel;
        return mismoTel && String(c.cc).trim() !== String(contactoData.cc).trim();
      });
      if (existeTel) {
        mostrarAlerta(modalAlertBox, 'error', 'Ya tienes un contacto registrado con ese número telefónico.');
        setLoadingBtn(submitBtn, false);
        inputContacto.focus();
        return;
      }

      if (mode === 'create') {
        contactsCache.unshift(contactoData);
        encolarOperacionSync('crear', contactoData);
      } else {
        const idx = contactsCache.findIndex(c => String(c.cc).trim() === String(contactoData.cc).trim());
        if (idx !== -1) contactsCache[idx] = { ...contactsCache[idx], ...contactoData };
        encolarOperacionSync('editar', contactoData);
      }

      localStorage.setItem('nexus_contacts_cache', JSON.stringify(contactsCache));
      renderizarTabla(contactsCache);
      cerrarModalContacto();
      setLoadingBtn(submitBtn, false);
      mostrarToast('warning', 'Guardado localmente en modo Offline. Se sincronizará al reconectar.');
      checkNetworkStatus();
      return;
    }

    // Caso Online
    try {
      const url = mode === 'create' ? '/api/contactos' : `/api/contactos/${contactoData.cc}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(contactoData),
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarAlerta(modalAlertBox, 'error', data.error || 'Error al guardar contacto');
        return;
      }

      mostrarToast('success', mode === 'create' ? 'Contacto creado exitosamente' : 'Contacto actualizado');
      cerrarModalContacto();
      cargarContactos(true);

    } catch (err) {
      console.error(err);
      mostrarAlerta(modalAlertBox, 'error', 'Error al comunicar con el servidor.');
    } finally {
      setLoadingBtn(submitBtn, false);
    }
  }

  // =========================================================================
  // 10. ELIMINACIÓN DE CONTACTOS
  // =========================================================================
  function abrirModalEliminar(contacto) {
    contactToDelete = contacto;
    deleteModalText.textContent = `¿Estás seguro de eliminar a ${contacto.nombres} ${contacto.apellidos || ''} (CC: ${contacto.cc})?`;
    deleteModal.classList.remove('hidden');
  }

  async function ejecutarEliminacionContacto() {
    if (!contactToDelete) return;
    const cc = contactToDelete.cc;
    deleteModal.classList.add('hidden');

    // Caso Offline
    if (!navigator.onLine) {
      contactsCache = contactsCache.filter(c => c.cc !== cc);
      localStorage.setItem('nexus_contacts_cache', JSON.stringify(contactsCache));
      encolarOperacionSync('eliminar', { cc });
      renderizarTabla(contactsCache);
      mostrarToast('warning', 'Eliminado localmente. Se sincronizará al reconectar.');
      checkNetworkStatus();
      contactToDelete = null;
      return;
    }

    // Caso Online
    try {
      const res = await fetch(`/api/contactos/${cc}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarToast('error', data.error || 'Error al eliminar');
        return;
      }

      mostrarToast('success', 'Contacto eliminado correctamente');
      cargarContactos(true);
    } catch (err) {
      console.error(err);
      mostrarToast('error', 'Error al eliminar el contacto');
    } finally {
      contactToDelete = null;
    }
  }

  // =========================================================================
  // 11. COLA DE SINCRONIZACIÓN OFFLINE -> ONLINE Y MÓDULO PENDIENTES
  // =========================================================================
  function encolarOperacionSync(tipo, contacto) {
    pendingSyncQueue.push({ tipo, contacto, timestamp: Date.now() });
    localStorage.setItem('nexus_sync_queue', JSON.stringify(pendingSyncQueue));
    actualizarContadorPendientes();
  }

  function actualizarContadorPendientes() {
    const count = pendingSyncQueue.length;
    if (pendingCountBadge) pendingCountBadge.textContent = count;
    if (modalPendingCount) modalPendingCount.textContent = count;
    if (btnVerPendientes) {
      if (count > 0) {
        btnVerPendientes.classList.add('has-pending');
      } else {
        btnVerPendientes.classList.remove('has-pending');
      }
    }
  }

  function abrirModalPendientes() {
    if (pendingSyncAlertBox) pendingSyncAlertBox.classList.add('hidden');
    actualizarContadorPendientes();
    renderizarListaPendientes();
    if (pendingSyncModal) pendingSyncModal.classList.remove('hidden');
  }

  function cerrarModalPendientes() {
    if (pendingSyncModal) pendingSyncModal.classList.add('hidden');
    if (pendingSyncAlertBox) pendingSyncAlertBox.classList.add('hidden');
  }

  function renderizarListaPendientes() {
    if (!pendingListContainer) return;
    pendingListContainer.innerHTML = '';

    if (pendingSyncQueue.length === 0) {
      pendingListContainer.innerHTML = `
        <div class="empty-pending">
          <div style="font-size: 36px; margin-bottom: 8px; color: var(--accent-emerald);"><i class="bi bi-check-circle"></i></div>
          <strong style="color: #f1f5f9;">No hay registros pendientes</strong>
          <p style="margin-top: 4px; font-size: 13px; color: var(--text-muted);">
            Todos tus contactos están guardados y sincronizados en la base de datos PostgreSQL.
          </p>
        </div>
      `;
      return;
    }

    pendingSyncQueue.forEach((item) => {
      const fecha = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const itemEl = document.createElement('div');
      itemEl.className = 'pending-item';

      const tipoClass = item.tipo ? item.tipo.toLowerCase() : 'crear';
      const tipoLabel = item.tipo === 'crear' ? 'CREAR' : item.tipo === 'editar' ? 'EDITAR' : 'ELIMINAR';
      const contacto = item.contacto || {};
      const nombre = contacto.nombres ? `${contacto.nombres} ${contacto.apellidos || ''}` : `Cédula: ${contacto.cc || 'N/A'}`;
      const meta = contacto.cc ? `Cédula: ${contacto.cc}` : '';

      itemEl.innerHTML = `
        <div class="pending-item-main">
          <span class="pending-badge ${tipoClass}">${tipoLabel}</span>
          <div class="pending-item-details">
            <span class="pending-item-name">${escapeHtml(nombre)}</span>
            <span class="pending-item-meta">${escapeHtml(meta)}</span>
          </div>
        </div>
        <span class="pending-item-time"><i class="bi bi-clock"></i> ${fecha}</span>
      `;
      pendingListContainer.appendChild(itemEl);
    });
  }

  async function forzarSincronizacionManual() {
    if (pendingSyncAlertBox) pendingSyncAlertBox.classList.add('hidden');

    if (!navigator.onLine) {
      mostrarAlerta(pendingSyncAlertBox, 'warning', `
        <strong><i class="bi bi-wifi-off"></i> Modo sin internet</strong><br>
        Actualmente te encuentras desconectado de la red. Tus operaciones permanecen protegidas localmente y se guardarán en la base de datos cuando regrese la conexión.
      `);
      return;
    }

    if (pendingSyncQueue.length === 0) {
      mostrarAlerta(pendingSyncAlertBox, 'info', 'No tienes registros pendientes para sincronizar.');
      return;
    }

    setLoadingBtn(btnForceSyncNow, true);

    try {
      await sincronizarConServidor();
      mostrarAlerta(pendingSyncAlertBox, 'success', '¡Registros guardados en la base de datos exitosamente!');
      renderizarListaPendientes();
      actualizarContadorPendientes();
    } catch (err) {
      console.error(err);
      mostrarAlerta(pendingSyncAlertBox, 'error', 'Error al sincronizar con la base de datos.');
    } finally {
      setLoadingBtn(btnForceSyncNow, false);
    }
  }

  async function sincronizarConServidor() {
    if (!navigator.onLine || pendingSyncQueue.length === 0 || !authToken) return;

    try {
      const opsToSend = [...pendingSyncQueue];
      const res = await fetch('/api/contactos/sincronizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ operacionesPendientes: opsToSend }),
      });

      if (!res.ok) throw new Error('Fallo al sincronizar');

      const data = await res.json();
      pendingSyncQueue = [];
      localStorage.removeItem('nexus_sync_queue');
      contactsCache = data.contactos;
      localStorage.setItem('nexus_contacts_cache', JSON.stringify(contactsCache));

      renderizarTabla(contactsCache);
      checkNetworkStatus();
      actualizarContadorPendientes();
      mostrarToast('success', 'Sincronización completada con éxito.');

    } catch (err) {
      console.error('Error durante la sincronización:', err);
      throw err;
    }
  }

  // =========================================================================
  // 12. UTILIDADES Y NOTIFICACIONES
  // =========================================================================
  function mostrarAlerta(el, tipo, html) {
    el.className = `alert-box ${tipo}`;
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  function mostrarToast(tipo, mensaje) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;

    const icon = tipo === 'success' ? '<i class="bi bi-check-circle-fill"></i>' : tipo === 'error' ? '<i class="bi bi-x-circle-fill"></i>' : tipo === 'warning' ? '<i class="bi bi-exclamation-triangle-fill"></i>' : '<i class="bi bi-info-circle-fill"></i>';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(mensaje)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function setLoadingBtn(btn, loading) {
    if (!btn) return;
    const textSpan = btn.querySelector('.btn-text');
    const spinnerSpan = btn.querySelector('.btn-spinner');

    if (loading) {
      btn.disabled = true;
      if (textSpan) textSpan.classList.add('hidden');
      if (spinnerSpan) spinnerSpan.classList.remove('hidden');
    } else {
      btn.disabled = false;
      if (textSpan) textSpan.classList.remove('hidden');
      if (spinnerSpan) spinnerSpan.classList.add('hidden');
    }
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[tag] || tag));
  }

  // Registro del Service Worker para persistencia Offline y recargas (PWA)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado exitosamente con alcance:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Fallo en el registro del Service Worker:', err);
        });
    });
  }

  // Arranque de la app
  document.addEventListener('DOMContentLoaded', init);

})();
