const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const host = process.env.EMAIL_HOST || (user && user.includes('gmail') ? 'smtp.gmail.com' : null);
  const port = parseInt(process.env.EMAIL_PORT, 10) || (host === 'smtp.gmail.com' ? 465 : 587);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  if (!user || !pass || !host) {
    return null; // Modo consola / desarrollo
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Enviar correo de bienvenida con contraseña autogenerada
 */
async function enviarCorreoRegistro(email, passwordGenerada) {
  const transporter = createTransporter();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const from = process.env.EMAIL_FROM || '"Sistema de Contactos" <no-reply@contactos.com>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #e2e8f0; }
        .card { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); border: 1px solid #334155; }
        .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .title { color: #38bdf8; font-size: 24px; font-weight: 700; margin: 0; }
        .content { margin: 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
        .credential-box { background: #0f172a; border-left: 4px solid #38bdf8; padding: 16px; border-radius: 8px; margin: 20px 0; font-family: monospace; font-size: 16px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; margin-top: 10px; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 class="title">Gestor de Contactos</h1>
        </div>
        <div class="content">
          <p>¡Hola!</p>
          <p>Tu cuenta ha sido creada exitosamente. Para acceder a tu panel de contactos privado, utiliza las siguientes credenciales:</p>
          
          <div class="credential-box">
            <div><strong>Usuario:</strong> ${email}</div>
            <div style="margin-top: 8px;"><strong>Contraseña:</strong> <span style="color: #4ade80; font-size: 18px;">${passwordGenerada}</span></div>
          </div>

          <p>Recuerda que tus datos están aislados y únicamente tú podrás gestionar tus propios contactos.</p>
          <div style="text-align: center;">
            <a href="${appUrl}" class="btn">Acceder al Sistema</a>
          </div>
        </div>
        <div class="footer">
          Si no solicitaste este registro, puedes ignorar este mensaje.
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n============================================================');
    console.log('[MODO DESARROLLO - ENVÍO DE CORREO DE REGISTRO]');
    console.log(`Para: ${email}`);
    console.log(`Contraseña generada: ${passwordGenerada}`);
    console.log(`Enlace de acceso: ${appUrl}`);
    console.log('============================================================\n');
    return { success: true, mode: 'console' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Bienvenido - Tu contraseña para el Gestor de Contactos',
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Error enviando email de registro:', err.message);
    // Fallback visible en consola
    console.log(`[FALLBACK REGISTRO] Email: ${email} | Password: ${passwordGenerada}`);
    return { success: false, error: err.message };
  }
}

/**
 * Enviar correo de alerta de seguridad tras 4 intentos fallidos con opciones Sí / No
 */
async function enviarCorreoAlertaSeguridad(email, token) {
  const transporter = createTransporter();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const from = process.env.EMAIL_FROM || '"Seguridad Contactos" <no-reply@contactos.com>';

  const enlaceSi = `${appUrl}/api/auth/seguridad/respuesta?token=${token}&opcion=si`;
  const enlaceNo = `${appUrl}/api/auth/seguridad/respuesta?token=${token}&opcion=no`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #e2e8f0; }
        .card { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); border: 1px solid #ef4444; }
        .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .title { color: #f87171; font-size: 22px; font-weight: 700; margin: 0; }
        .content { margin: 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
        .warning-box { background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0; color: #fca5a5; }
        .buttons-container { display: flex; gap: 16px; justify-content: center; margin: 28px 0; }
        .btn-yes { display: inline-block; background: #10b981; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 5px; }
        .btn-no { display: inline-block; background: #ef4444; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 5px; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 class="title">ALERTA DE SEGURIDAD</h1>
        </div>
        <div class="content">
          <p>Hola <strong>${email}</strong>,</p>
          <div class="warning-box">
            <strong>Atención:</strong> Se han detectado <strong>4 intentos fallidos consecutivos</strong> de inicio de sesión en tu cuenta. Tu acceso ha sido bloqueado temporalmente por precaución.
          </div>
          
          <p style="text-align: center; font-size: 17px; font-weight: 600; color: #f1f5f9;">
            ¿Fuiste tú quien intentó acceder a tu cuenta?
          </p>

          <div style="text-align: center; margin: 25px 0;">
            <a href="${enlaceSi}" class="btn-yes">SÍ, FUI YO</a>
            &nbsp;&nbsp;
            <a href="${enlaceNo}" class="btn-no">NO, NO FUI YO</a>
          </div>

          <p style="font-size: 13px; color: #94a3b8;">
            • Si seleccionas <strong>"SÍ"</strong>, serás redirigido para restablecer tu contraseña y desbloquear tu cuenta inmediatamente.<br>
            • Si seleccionas <strong>"NO"</strong>, tu cuenta permanecerá protegida y bloqueada para prevenir accesos no autorizados.
          </p>
        </div>
        <div class="footer">
          Este es un aviso automático de seguridad del Sistema de Contactos.
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n============================================================');
    console.log('[MODO DESARROLLO - ALERTA DE 4 INTENTOS FALLIDOS]');
    console.log(`Para: ${email}`);
    console.log('¿Fuiste tú quien intentó acceder?');
    console.log(`Opción [SÍ, FUI YO]: ${enlaceSi}`);
    console.log(`Opción [NO, NO FUI YO]: ${enlaceNo}`);
    console.log('============================================================\n');
    return { success: true, mode: 'console' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Alerta de Seguridad: 4 intentos fallidos de inicio de sesión',
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Error enviando alerta de seguridad:', err.message);
    console.log(`[FALLBACK ALERTA] SI: ${enlaceSi} | NO: ${enlaceNo}`);
    return { success: false, error: err.message };
  }
}

/**
 * Enviar correo de recuperación de contraseña solicitado por el usuario
 * Contiene: asunto, descripción, advertencia y botón de "Reestablecer mi contraseña"
 */
async function enviarCorreoRecuperacion(email, token) {
  const transporter = createTransporter();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const from = process.env.EMAIL_FROM || '"Sistema de Contactos" <no-reply@contactos.com>';
  const enlaceRestablecer = `${appUrl}/restablecer.html?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #e2e8f0; }
        .card { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); border: 1px solid #0284c7; }
        .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; }
        .title { color: #38bdf8; font-size: 24px; font-weight: 700; margin: 0; }
        .content { margin: 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
        .description-box { background: rgba(56, 189, 248, 0.08); border-left: 4px solid #38bdf8; padding: 14px 16px; border-radius: 8px; margin: 18px 0; color: #e2e8f0; }
        .warning-box { background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0; color: #fde68a; font-size: 14px; line-height: 1.5; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn-reset { display: inline-block; background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4); }
        .link-fallback { font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 20px; text-align: center; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 class="title">Restablecimiento de Contraseña</h1>
        </div>
        <div class="content">
          <p>Hola <strong>${email}</strong>,</p>
          
          <div class="description-box">
            <strong>Descripción de la solicitud:</strong><br>
            Hemos recibido una solicitud para restablecer la contraseña de acceso a tu cuenta en el Gestor de Contactos.
          </div>

          <div class="warning-box">
            <strong>Advertencia de Seguridad:</strong><br>
            Si tú no solicitaste este cambio, por favor ignora este correo. Tu cuenta continuará segura y tu contraseña actual no será modificada a menos que uses el botón a continuación. Este enlace expirará en 1 hora.
          </div>

          <div class="btn-container">
            <a href="${enlaceRestablecer}" class="btn-reset">Reestablecer mi contraseña</a>
          </div>

          <div class="link-fallback">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${enlaceRestablecer}" style="color: #38bdf8;">${enlaceRestablecer}</a>
          </div>
        </div>
        <div class="footer">
          Nexus Contactos • Sistema de Seguridad y Notificaciones
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n============================================================');
    console.log('[MODO DESARROLLO - SOLICITUD DE RECUPERACIÓN DE CONTRASEÑA]');
    console.log(`Para: ${email}`);
    console.log('Asunto: Restablecer contraseña - Gestor de Contactos');
    console.log(`Enlace de restablecimiento: ${enlaceRestablecer}`);
    console.log('============================================================\n');
    return { success: true, mode: 'console' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Restablecer contraseña - Gestor de Contactos',
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Error enviando correo de recuperación:', err.message);
    console.log(`[FALLBACK RECUPERACION] Email: ${email} | Enlace: ${enlaceRestablecer}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  enviarCorreoRegistro,
  enviarCorreoAlertaSeguridad,
  enviarCorreoRecuperacion,
};
