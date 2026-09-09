# 📧 Módulo 05: Notificaciones y Servicio de Correo SMTP

Este módulo describe la arquitectura de entrega de correos electrónicos mediante `services/emailService.js`, la integración con proveedores SMTP como Gmail y las plantillas transaccionales.

---

## 1. Configuración del Transporter (`services/emailService.js`)

El servicio utiliza `nodemailer` y soporta tanto servidores SMTP dedicados como cuentas de Gmail:

```javascript
function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const host = process.env.EMAIL_HOST || (user && user.includes('gmail') ? 'smtp.gmail.com' : null);
  const port = parseInt(process.env.EMAIL_PORT, 10) || (host === 'smtp.gmail.com' ? 465 : 587);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  if (!user || !pass || !host) {
    return null; // Modo consola / desarrollo automático
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}
```

### Modo Consola (Fallback de Desarrollo):
Si las variables de entorno de correo no están configuradas, el sistema **no falla**: imprime el enlace o las credenciales en la consola del servidor para permitir pruebas ágiles en entornos locales.

---

## 2. Tipos de Correos Transaccionales

### A. Correo de Bienvenida y Registro (`enviarCorreoRegistro`)
- **Disparador:** Registro de un nuevo correo electrónico.
- **Contenido:**
  - Saludo formal y confirmación de creación de cuenta.
  - Credenciales: Usuario (correo) y Contraseña autogenerada en una caja destacada.
  - Botón de llamada a la acción: *"Acceder al Sistema"*.

### B. Correo de Alerta de Seguridad (`enviarCorreoAlertaSeguridad`)
- **Disparador:** 4 intentos consecutivos de contraseña errónea.
- **Contenido:**
  - Alerta en color rojo de bloqueo preventivo de cuenta.
  - Pregunta de seguridad: *¿Fuiste tú quien intentó acceder a tu cuenta?*
  - Botón verde: **"SÍ, FUI YO"** (redirige para restablecer y desbloquear).
  - Botón rojo: **"NO, NO FUI YO"** (mantiene la cuenta blindada y bloqueada).

### C. Correo de Recuperación de Contraseña (`enviarCorreoRecuperacion`)
- **Disparador:** Solicitud desde el modal *"Olvidé mi contraseña"*.
- **Contenido estructurado:**
  - **Asunto:** `🔑 Restablecer contraseña - Gestor de Contactos`.
  - **Descripción:** Notificación clara de la solicitud recibida.
  - **Advertencia de Seguridad:** Mensaje de seguridad alertando que si no fue el usuario quien lo pidió, puede ignorar el correo con tranquilidad.
  - **Botón:** *"Reestablecer mi contraseña"*, con enlace directo a `/restablecer.html?token=...` (expira en 1 hora).

---

## 3. Configuración para Gmail en Producción (Dokploy / VPS)

Para usar Gmail en producción:
1. En tu cuenta de Google, activa la **Verificación en 2 pasos**.
2. Ve a **Seguridad** -> **Contraseñas de aplicaciones**.
3. Genera una contraseña para *"Correo"* y nómbrala *"Nexus Dokploy"*.
4. Obtendrás un código de 16 letras (ej: `xbpy ojok suvm twuo`).
5. En las variables de entorno de Dokploy, coloca:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=465
   EMAIL_SECURE=true
   EMAIL_USER=tucorreo@gmail.com
   EMAIL_PASS=xbpyojoksuvmtwuo
   EMAIL_FROM="Nexus Contactos <tucorreo@gmail.com>"
   ```
