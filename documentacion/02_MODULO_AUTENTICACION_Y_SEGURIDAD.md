# 🔐 Módulo 02: Autenticación y Seguridad

Este módulo describe los componentes de seguridad, control de acceso, políticas de bloqueo y flujos de recuperación de credenciales del sistema.

---

## 1. Registro de Usuarios (`POST /api/auth/registro`)
- **Mecanismo:** El usuario ingresa su correo electrónico válido.
- **Contraseña Autogenerada:** El servidor genera aleatoriamente una contraseña robusta de 9 caracteres alfanuméricos y símbolos (`generarPasswordSegura`).
- **Cifrado:** Se almacena en la tabla `usuarios` usando `bcryptjs` con un factor de costo de 10 rondas de salteo.
- **Despacho:** Se envía un correo electrónico de bienvenida mediante `emailService.enviarCorreoRegistro` conteniendo las credenciales para su primer ingreso.

---

## 2. Inicio de Sesión y Control de Sesión (`POST /api/auth/login`)
- **Autenticación:** Valida email y password comparando con el hash de la base de datos.
- **Token JWT:** Al autenticar exitosamente, se genera un JSON Web Token firmado con la clave `JWT_SECRET` y una vigencia fija de **30 minutos**:
  ```javascript
  jwt.sign({ id: usuario.id, email: usuario.email }, jwtSecret, { expiresIn: '30m' });
  ```
- **Control de Inactividad en Cliente:** En el frontend (`public/js/app.js`), se monitorean eventos del usuario (`mousemove`, `keydown`, `touchstart`, `scroll`, `click`). Si transcurren 30 minutos sin actividad:
  1. Se destruye el token en `localStorage`.
  2. Se muestra el modal de aviso de expiración por inactividad.
  3. Se redirige al formulario de inicio de sesión.

---

## 3. Prevención de Ataques de Fuerza Bruta (Bloqueo a 4 Intentos)
- Cada intento de contraseña incorrecta incrementa la columna `intentos_fallidos` en la tabla `usuarios`.
- Al llegar al **4to intento fallido consecutivo**:
  1. La cuenta se bloquea (`bloqueado = TRUE`).
  2. Se genera un token criptográfico de seguridad de 32 bytes (`token_seguridad`) con validez de 2 horas.
  3. Se dispara un correo de alerta de seguridad (`enviarCorreoAlertaSeguridad`) con dos opciones interactivas:
     - **Opción "SÍ, FUI YO":** Redirige a la pantalla de restablecimiento para definir una nueva contraseña y reactivar la cuenta.
     - **Opción "NO, NO FUI YO":** Confirma que la cuenta permanezca bloqueada de forma preventiva para proteger los contactos.

---

## 4. Flujo "Olvidé mi Contraseña"

### Componentes del Flujo:
1. **Enlace en Login:** Botón interactivo *"¿Olvidaste tu contraseña?"* ubicado bajo el campo de clave.
2. **Ventana Emergente (Modal):**
   - Campo para ingresar el correo electrónico.
   - Botón **Cancelar** y botón **Enviar** con spinner de carga.
3. **Validación en Backend (`POST /api/auth/olvide-password`):**
   - Comprueba si el correo existe en la base de datos.
   - Si no existe: Retorna HTTP `404` con mensaje claro de error.
   - Si existe: Genera un token aleatorio con vigencia de 1 hora y actualiza `token_seguridad` y `token_expira`.
4. **Notificación por Correo Estructurada:**
   - **Asunto:** `🔑 Restablecer contraseña - Gestor de Contactos`
   - **Descripción:** Aviso formal de la solicitud de recuperación.
   - **Advertencia:** Aviso de seguridad indicando que si no fue el titular quien lo solicitó, puede ignorar el correo.
   - **Botón:** *"Reestablecer mi contraseña"*, enlazando a `/restablecer.html?token=...`.
5. **Página Aparte de Restablecimiento (`/restablecer.html`):**
   - Valida el token con `GET /api/auth/verificar-token`.
   - Si el enlace expiró o fue manipulado, muestra una pantalla de error.
   - Si es válido, habilita el formulario con 2 campos:
     - **Nueva Contraseña** (mínimo 6 caracteres con botón 👁️ para alternar visibilidad).
     - **Confirmar Nueva Contraseña** (con botón 👁️).
     - Botón **Cambiar Contraseña**.
   - Al enviar (`POST /api/auth/restablecer-password`), cifra la nueva clave, desbloquea la cuenta, resetea los intentos a 0 e invalida el token.

---

## 5. Blindaje contra Scripts Masivos y Ataques Automatizados (DoS / Fuerza Bruta)

Para proteger el sistema contra bots, crawlers, scripts masivos y ataques de denegación de servicio por saturación de CPU o bombardeo SMTP:

### 5.1. Limitadores de Tasa (`express-rate-limit`)
- **API General (`apiLimiter`):** Máximo 300 peticiones por ventana de 15 minutos por dirección IP en todas las rutas `/api/`.
- **Protección de Login (`loginLimiter`):** Máximo 10 intentos de autenticación cada 15 minutos por IP en `/api/auth/login`. Esto impide ataques de *password spraying* y evita el agotamiento de CPU por el procesamiento repetitivo de `bcrypt.compare`.
- **Protección de Correo (`emailActionsLimiter`):** Máximo 5 solicitudes cada 15 minutos por IP en `/api/auth/registro` y `/api/auth/olvide-password`. Previene que un atacante use el servidor para realizar bombardeo de correos (*Email Bombing*) y protege la reputación del buzón SMTP.
- **Sincronización en Lote (`syncLimiter`):** Máximo 30 sincronizaciones en ventanas de 5 minutos.

### 5.2. Límite Estricto de Carga Útil (Payload Limit)
- El middleware `express.json({ limit: '50kb' })` restringe el tamaño de las solicitudes entrantes a 50 Kilobytes. Cualquier petición superior es rechazada inmediatamente con código `HTTP 413 (Payload Too Large)` antes de consumir memoria en Node.js.
- Adicionalmente, el endpoint `/api/contactos/sincronizar` rechaza lotes que superen 100 operaciones por solicitud (`HTTP 400`).

### 5.3. Cabeceras de Seguridad HTTP (`helmet`)
- Oculta la cabecera identificadora `X-Powered-By: Express`.
- Activa protección contra Clickjacking (`X-Frame-Options: SAMEORIGIN`).
- Bloquea suplantación de tipos MIME (`X-Content-Type-Options: nosniff`).
- Implementa Content Security Policy (CSP) permitiendo únicamente los recursos autorizados (Google Fonts, Bootstrap Icons CDN).

### 5.4. Política de Orígenes Cruzados (CORS Configurable)
- Permite configurar los orígenes autorizados mediante la variable `ALLOWED_ORIGINS` (por ejemplo, el dominio de producción en Dokploy y las llamadas nativas de Android / Capacitor), bloqueando solicitudes no autorizadas desde otros sitios web.
