require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { enviarCorreoRegistro, enviarCorreoAlertaSeguridad, enviarCorreoRecuperacion } = require('./services/emailService');

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'clave_secreta_default_contactos_2026';

// 1. CABECERAS DE SEGURIDAD HTTP (HELMET)
// Protege contra clickjacking, MIME-sniffing, XSS y oculta X-Powered-By
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CONTROL DE ORIGEN CORS (Protección contra solicitudes cruzadas no autorizadas)
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,capacitor://localhost';
const allowedOrigins = rawAllowedOrigins.split(',').map(o => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como apps móviles APK, herramientas del servidor o curl interno)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Acceso bloqueado por política de seguridad CORS'), false);
  },
  credentials: true,
}));

// 3. PROTECCIÓN CONTRA PAYLOADS MASIVOS (Límite estricto a 50KB por solicitud)
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 4. LIMITADORES DE TASA CONTRA SCRIPTS MASIVOS (RATE LIMITING)

// Limitador general para todas las rutas /api/ (Máximo 300 peticiones por cada 15 min por IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de solicitudes alcanzado desde tu dirección IP. Intenta nuevamente en 15 minutos.' }
});

// Limitador estricto para Login (Máximo 10 intentos por IP en 15 min) -> Evita saturación de CPU por bcrypt
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso desde tu red. Acceso temporalmente pausado por 15 minutos.' }
});

// Limitador estricto para Registro y Recuperación (Máximo 5 correos cada 15 min por IP) -> Evita saturación SMTP / Email Bombing
const emailActionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de solicitudes de correo alcanzado. Por seguridad, espera 15 minutos para enviar otro correo.' }
});

// Limitador para Sincronización en lote (Máximo 30 sincronizaciones en 5 min)
const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas operaciones de sincronización en poco tiempo. Espera unos minutos.' }
});

// Aplicar limitador general a todas las APIs
app.use('/api/', apiLimiter);

// ============================================
// CONEXIÓN A POSTGRESQL
// ============================================
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bd_contacto',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
});

// Probar conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('[ERROR] Error conectando a PostgreSQL:', err.stack);
  } else {
    console.log('[OK] Conectado a PostgreSQL (' + (process.env.DB_NAME || 'bd_contacto') + ')');
    release();
  }
});

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN (JWT - 30 MIN)
// ============================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado. Debe iniciar sesión.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.usuario = decoded; // { id, email }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Tu sesión ha expirado por inactividad (30 min). Por favor inicia sesión de nuevo.',
        sesionExpirada: true 
      });
    }
    return res.status(401).json({ error: 'Token inválido o manipulado.' });
  }
}

// Función generadora de contraseña temporal segura
function generarPasswordSegura(longitud = 9) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pass = '';
  for (let i = 0; i < longitud; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// ============================================
// RUTAS DE AUTENTICACIÓN Y SEGURIDAD
// ============================================

// POST - Registro de usuario por correo electrónico (Protegido con límite de 5 intentos cada 15 min)
app.post('/api/auth/registro', emailActionsLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Debe ingresar un correo electrónico válido' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Verificar si ya existe
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [cleanEmail]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    // Generar contraseña y cifrar
    const passwordGenerada = generarPasswordSegura(9);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordGenerada, salt);

    // Guardar usuario
    const nuevoUsuario = await pool.query(
      `INSERT INTO usuarios (email, password_hash)
       VALUES ($1, $2) RETURNING id, email, fecha_creacion`,
      [cleanEmail, passwordHash]
    );

    // Enviar correo con la contraseña
    await enviarCorreoRegistro(cleanEmail, passwordGenerada);

    res.status(201).json({
      mensaje: 'Registro exitoso. Te hemos enviado la contraseña a tu correo electrónico.',
      email: cleanEmail,
      usuarioId: nuevoUsuario.rows[0].id,
    });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// POST - Inicio de sesión con límite de 4 intentos por cuenta y 10 por IP en 15 min
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [cleanEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = result.rows[0];

    // Verificar si ya está bloqueado
    if (usuario.bloqueado) {
      return res.status(403).json({
        error: 'Tu cuenta se encuentra bloqueada por seguridad debido a 4 intentos fallidos. Revisa tu correo para desbloquearla.',
        bloqueado: true,
      });
    }

    // Comprobar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;

      if (nuevosIntentos >= 4) {
        // Bloquear cuenta y generar token de alerta
        const tokenSeguridad = crypto.randomBytes(32).toString('hex');
        const tokenExpira = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

        await pool.query(
          `UPDATE usuarios 
           SET intentos_fallidos = $1, bloqueado = TRUE, token_seguridad = $2, token_expira = $3
           WHERE id = $4`,
          [nuevosIntentos, tokenSeguridad, tokenExpira, usuario.id]
        );

        // Disparar correo de alerta con Sí / No
        await enviarCorreoAlertaSeguridad(cleanEmail, tokenSeguridad);

        return res.status(403).json({
          error: 'Has alcanzado el límite de 4 intentos fallidos. Tu cuenta ha sido bloqueada y se envió un correo de alerta a tu buzón.',
          bloqueado: true,
          intentosFallidos: 4,
        });
      } else {
        // Incrementar contador
        await pool.query(
          'UPDATE usuarios SET intentos_fallidos = $1 WHERE id = $2',
          [nuevosIntentos, usuario.id]
        );

        const intentosRestantes = 4 - nuevosIntentos;
        return res.status(401).json({
          error: `Contraseña incorrecta. Te quedan ${intentosRestantes} intento(s) antes del bloqueo.`,
          intentosFallidos: nuevosIntentos,
          intentosRestantes,
        });
      }
    }

    // Si la contraseña es válida: reiniciar intentos y generar token JWT (30 min)
    await pool.query(
      `UPDATE usuarios 
       SET intentos_fallidos = 0, bloqueado = FALSE, token_seguridad = NULL, token_expira = NULL 
       WHERE id = $1`,
      [usuario.id]
    );

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      jwtSecret,
      { expiresIn: '30m' } // Límite de sesión de 30 minutos
    );

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
      },
      expiraEnSegundos: 1800, // 30 minutos
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// GET - Procesar respuesta de la alerta de seguridad (SÍ / NO)
app.get('/api/auth/seguridad/respuesta', async (req, res) => {
  const { token, opcion } = req.query;

  if (!token || !opcion) {
    return res.status(400).send('Parámetros inválidos');
  }

  try {
    const userRes = await pool.query(
      'SELECT * FROM usuarios WHERE token_seguridad = $1 AND token_expira > NOW()',
      [token]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Enlace Inválido</title>
        <style>body{font-family:sans-serif;background:#0f172a;color:#fff;text-align:center;padding:50px;}</style>
        </head><body>
          <h2>Enlace Inválido o Expirado</h2>
          <p>Este enlace de seguridad ya no es válido o ha expirado. Si tu cuenta sigue bloqueada, contacta a soporte.</p>
        </body></html>
      `);
    }

    const usuario = userRes.rows[0];

    if (opcion.toLowerCase() === 'si') {
      // Redirigir a la pantalla web de restablecimiento de contraseña
      return res.redirect(`/#restablecer?token=${token}&email=${encodeURIComponent(usuario.email)}`);
    } else {
      // Opción 'no': Confirmar protección y mantener la cuenta bloqueada
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Seguridad Confirmada</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h2 { color: #f87171; margin-top: 0; }
            p { color: #94a3b8; line-height: 1.6; }
            .btn { display: inline-block; background: #38bdf8; color: #0f172a; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Cuenta Protegida</h2>
            <p>Has indicado que <strong>no fuiste tú</strong> quien intentó acceder a la cuenta <strong>${usuario.email}</strong>.</p>
            <p>Tu cuenta permanece <strong>bloqueada de forma preventiva</strong> para salvaguardar todos tus contactos e información personal.</p>
            <a href="/" class="btn">Ir al Inicio</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('Error en respuesta de seguridad:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// Ruta amigable para la página de restablecimiento de contraseña
app.get('/restablecer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'restablecer.html'));
});

// POST - Solicitar recuperación de contraseña (Protegido con límite de 5 intentos cada 15 min)
app.post('/api/auth/olvide-password', emailActionsLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Debe ingresar un correo electrónico válido' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Validar si el correo existe en la base de datos
    const userRes = await pool.query('SELECT id, email FROM usuarios WHERE email = $1', [cleanEmail]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'El correo electrónico no se encuentra registrado en el sistema.' });
    }

    const usuario = userRes.rows[0];

    // Generar token criptográfico y expiración (1 hora)
    const tokenSeguridad = crypto.randomBytes(32).toString('hex');
    const tokenExpira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Guardar token en la base de datos
    await pool.query(
      `UPDATE usuarios 
       SET token_seguridad = $1, token_expira = $2 
       WHERE id = $3`,
      [tokenSeguridad, tokenExpira, usuario.id]
    );

    // Enviar correo con asunto, descripción, advertencia y botón de restablecer
    await enviarCorreoRecuperacion(cleanEmail, tokenSeguridad);

    res.json({
      mensaje: 'Hemos enviado un correo electrónico con el enlace para restablecer tu contraseña. Revisa tu bandeja de entrada o carpeta de spam.',
      email: cleanEmail,
    });
  } catch (err) {
    console.error('Error en olvide-password:', err);
    res.status(500).json({ error: 'Error interno al procesar la solicitud de recuperación' });
  }
});

// GET - Verificar si un token de restablecimiento sigue siendo válido
app.get('/api/auth/verificar-token', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ valido: false, error: 'Token no proporcionado' });
  }

  try {
    const userRes = await pool.query(
      'SELECT id, email FROM usuarios WHERE token_seguridad = $1 AND token_expira > NOW()',
      [token]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ valido: false, error: 'El enlace de restablecimiento ha expirado o no es válido' });
    }

    res.json({
      valido: true,
      email: userRes.rows[0].email,
    });
  } catch (err) {
    console.error('Error al verificar token:', err);
    res.status(500).json({ valido: false, error: 'Error al validar el token de seguridad' });
  }
});

// POST - Restablecer contraseña con el token de alerta
app.post('/api/auth/restablecer-password', async (req, res) => {
  const { token, nuevaPassword } = req.body;

  if (!token || !nuevaPassword || nuevaPassword.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const userRes = await pool.query(
      'SELECT id, email FROM usuarios WHERE token_seguridad = $1 AND token_expira > NOW()',
      [token]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'El enlace de restablecimiento ha expirado o no es válido' });
    }

    const usuario = userRes.rows[0];

    // Cifrar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(nuevaPassword, salt);

    // Desbloquear usuario y reiniciar intentos a 0
    await pool.query(
      `UPDATE usuarios 
       SET password_hash = $1, intentos_fallidos = 0, bloqueado = FALSE, token_seguridad = NULL, token_expira = NULL, fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, usuario.id]
    );

    res.json({
      mensaje: 'Contraseña actualizada exitosamente. Tu cuenta ha sido desbloqueada y tus intentos se restablecieron a 0.',
      email: usuario.email,
    });
  } catch (err) {
    console.error('Error al restablecer contraseña:', err);
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

// ============================================
// ENDPOINTS CRUD DE CONTACTOS (AISLADOS POR USUARIO)
// ============================================

// Validación estricta: Cédula y Teléfono SOLO números; Nombres y Apellidos SOLO letras
function validarCamposContacto({ cc, nombres, apellidos, contacto, esEdicion = false }) {
  if (!esEdicion) {
    if (!cc || !/^\d+$/.test(String(cc).trim())) {
      return 'La cédula (CC) es obligatoria y solo debe contener números.';
    }
  }
  if (!contacto || !/^\d+$/.test(String(contacto).trim())) {
    return 'El teléfono / celular es obligatorio y solo debe contener números.';
  }
  const soloLetrasRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
  if (!nombres || !soloLetrasRegex.test(String(nombres).trim())) {
    return 'Los nombres solo deben contener letras y espacios (no se permiten números).';
  }
  if (!apellidos || !soloLetrasRegex.test(String(apellidos).trim())) {
    return 'Los apellidos solo deben contener letras y espacios (no se permiten números).';
  }
  return null;
}

// GET - Obtener todos los contactos del usuario autenticado
app.get('/api/contactos', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 AND eliminado_en IS NULL ORDER BY nombres ASC',
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
});

// POST - Agregar un nuevo contacto para el usuario autenticado
app.post('/api/contactos', authMiddleware, async (req, res) => {
  const { cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion } = req.body;
  const usuarioId = req.usuario.id;

  // Validación estricta de tipos de datos
  const errorValidacion = validarCamposContacto({ cc, nombres, apellidos, contacto });
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  try {
    // Verificar si ya existe esa cédula en los contactos de ESTE usuario
    const existeCc = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 AND cc = $2 AND eliminado_en IS NULL',
      [usuarioId, cc]
    );
    if (existeCc.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes un contacto registrado con esa cédula' });
    }

    // Verificar si ya existe ese teléfono en los contactos de ESTE usuario
    const existeTel = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 AND contacto = $2 AND eliminado_en IS NULL',
      [usuarioId, contacto]
    );
    if (existeTel.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes un contacto registrado con ese número telefónico' });
    }

    const result = await pool.query(
      `INSERT INTO contactos (cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [cc, nombres, apellidos, contacto, direccion || null, fecha_nacimiento || null, profesion || null, usuarioId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar contacto' });
  }
});

// GET - Buscar contactos por nombre, apellido o cédula (del usuario)
app.get('/api/contactos/buscar', authMiddleware, async (req, res) => {
  const { q } = req.query;
  const usuarioId = req.usuario.id;

  if (!q || q.trim() === '') {
    const result = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 AND eliminado_en IS NULL ORDER BY nombres ASC',
      [usuarioId]
    );
    return res.json(result.rows);
  }

  try {
    const busqueda = `%${q.trim()}%`;
    const result = await pool.query(
      `SELECT * FROM contactos 
       WHERE usuario_id = $1 AND eliminado_en IS NULL AND (
          LOWER(nombres) LIKE LOWER($2) 
          OR LOWER(apellidos) LIKE LOWER($2) 
          OR cc LIKE $3
          OR contacto LIKE $3
       )
       ORDER BY nombres ASC`,
      [usuarioId, busqueda, `%${q.trim()}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar contactos' });
  }
});

// GET - Obtener un contacto por cédula (del usuario)
app.get('/api/contactos/:cc', authMiddleware, async (req, res) => {
  const { cc } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const result = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 AND cc = $2 AND eliminado_en IS NULL',
      [usuarioId, cc]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener contacto' });
  }
});

// PUT - Actualizar un contacto existente (del usuario)
app.put('/api/contactos/:cc', authMiddleware, async (req, res) => {
  const { cc } = req.params;
  const { nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion } = req.body;
  const usuarioId = req.usuario.id;

  // Validación estricta
  const errorValidacion = validarCamposContacto({ cc, nombres, apellidos, contacto, esEdicion: true });
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  try {
    const existe = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 AND cc = $2 AND eliminado_en IS NULL',
      [usuarioId, cc]
    );
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    // Validar que el teléfono no pertenezca ya a otro contacto del usuario
    const existeTel = await pool.query(
      'SELECT cc FROM contactos WHERE usuario_id = $1 AND contacto = $2 AND cc != $3 AND eliminado_en IS NULL',
      [usuarioId, contacto, cc]
    );
    if (existeTel.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes otro contacto registrado con ese número telefónico' });
    }

    const result = await pool.query(
      `UPDATE contactos 
       SET nombres = $1, apellidos = $2, contacto = $3, direccion = $4, 
           fecha_nacimiento = $5, profesion = $6, fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE usuario_id = $7 AND cc = $8 RETURNING *`,
      [nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion, usuarioId, cc]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar contacto' });
  }
});

// DELETE - Eliminar un contacto (del usuario)
app.delete('/api/contactos/:cc', authMiddleware, async (req, res) => {
  const { cc } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const result = await pool.query(
      'DELETE FROM contactos WHERE usuario_id = $1 AND cc = $2 RETURNING *',
      [usuarioId, cc]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json({ mensaje: 'Contacto eliminado correctamente', contacto: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar contacto' });
  }
});

// POST - Sincronización offline / online bidireccional (Protegida contra inundación masiva)
app.post('/api/contactos/sincronizar', authMiddleware, syncLimiter, async (req, res) => {
  const usuarioId = req.usuario.id;
  const { operacionesPendientes } = req.body; // Array de { tipo: 'crear'|'editar'|'eliminar', contacto }

  // Protección DoS: Evitar que un script envíe miles de operaciones bloqueando la base de datos
  if (operacionesPendientes && (!Array.isArray(operacionesPendientes) || operacionesPendientes.length > 100)) {
    return res.status(400).json({ error: 'Límite de sincronización excedido. Máximo 100 operaciones por lote.' });
  }

  try {
    if (Array.isArray(operacionesPendientes) && operacionesPendientes.length > 0) {
      for (const op of operacionesPendientes) {
        if (op.tipo === 'crear' || op.tipo === 'editar') {
          if (!op.contacto) continue;
          const errorVal = validarCamposContacto({
            cc: op.contacto.cc,
            nombres: op.contacto.nombres,
            apellidos: op.contacto.apellidos,
            contacto: op.contacto.contacto,
            esEdicion: op.tipo === 'editar'
          });
          if (errorVal) {
            console.warn(`[SYNC] Operación ${op.tipo} omitida por validación: ${errorVal}`);
            continue;
          }

          // Validar que el teléfono no esté duplicado con OTRO contacto
          const dupTel = await pool.query(
            'SELECT cc FROM contactos WHERE usuario_id = $1 AND contacto = $2 AND cc != $3 AND eliminado_en IS NULL',
            [usuarioId, op.contacto.contacto, op.contacto.cc]
          );
          if (dupTel.rows.length > 0) {
            console.warn(`[SYNC] Teléfono duplicado para CC ${op.contacto.cc} con contacto existente CC ${dupTel.rows[0].cc}. Operación omitida.`);
            continue;
          }
        }

        if (op.tipo === 'crear') {
          const { cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion } = op.contacto;
          await pool.query(
            `INSERT INTO contactos (cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion, usuario_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (usuario_id, cc) DO UPDATE 
             SET nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos, contacto = EXCLUDED.contacto, 
                 direccion = EXCLUDED.direccion, fecha_nacimiento = EXCLUDED.fecha_nacimiento, profesion = EXCLUDED.profesion, 
                 fecha_actualizacion = CURRENT_TIMESTAMP`,
            [cc, nombres, apellidos, contacto, direccion || null, fecha_nacimiento || null, profesion || null, usuarioId]
          );
        } else if (op.tipo === 'editar') {
          const { cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion } = op.contacto;
          await pool.query(
            `UPDATE contactos 
             SET nombres = $1, apellidos = $2, contacto = $3, direccion = $4, 
                 fecha_nacimiento = $5, profesion = $6, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE usuario_id = $7 AND cc = $8`,
            [nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion, usuarioId, cc]
          );
        } else if (op.tipo === 'eliminar') {
          await pool.query('DELETE FROM contactos WHERE usuario_id = $1 AND cc = $2', [usuarioId, op.contacto.cc]);
        }
      }
    }

    // Devolver la lista consolidada y actualizada de contactos
    const listadoActualizado = await pool.query(
      'SELECT * FROM contactos WHERE usuario_id = $1 AND eliminado_en IS NULL ORDER BY nombres ASC',
      [usuarioId]
    );

    res.json({
      mensaje: 'Sincronización completada con éxito',
      contactos: listadoActualizado.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error en sincronización:', err);
    res.status(500).json({ error: 'Error durante la sincronización' });
  }
});

// ============================================
// DESCARGA DE APK PARA DISPOSITIVOS MÓVILES
// ============================================
app.get('/api/descargar-apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', 'apk', 'app-contactos.apk');
  const fs = require('fs');

  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'ContactosApp.apk');
  } else {
    // Si aún no se ha compilado el APK de release, enviar un instalador de prueba / información
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Descarga APK</title>
      <style>body{font-family:sans-serif;background:#0f172a;color:#fff;text-align:center;padding:40px;}</style>
      </head>
      <body>
        <h2>Descarga de APK para Android</h2>
        <p>El archivo APK compilado debe colocarse en <code>public/apk/app-contactos.apk</code>.</p>
        <p>Una vez colocado el archivo .apk generado desde Android Studio, la descarga iniciará inmediatamente.</p>
        <a href="/" style="color:#38bdf8;">Volver a la aplicación</a>
      </body>
      </html>
    `);
  }
});

// Fallback para SPA (Single Page Application) - Compatible con Express v5
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// INICIAR EL SERVIDOR
// ============================================
app.listen(port, () => {
  console.log(`\n[INFO] Servidor funcionando en http://localhost:${port}`);
  console.log(`[INFO] Base de datos: PostgreSQL (${process.env.DB_NAME || 'bd_contacto'})`);
  console.log(`[INFO] Seguridad: Sesión de 30 min | 4 intentos fallidos con correo de alerta`);
  console.log(`[INFO] Descarga APK: http://localhost:${port}/api/descargar-apk\n`);
});