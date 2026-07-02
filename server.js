const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// CONEXIÓN A POSTGRESQL
// ============================================
const pool = new Pool({
    user: 'postgres',          // Usuario por defecto
    host: 'localhost',
    database: 'bd_contacto',  // La base que creaste
    password: '123456',        // La contraseña que pusiste al instalar
    port: 5432,
});

// Probar conexión
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.stack);
    } else {
        console.log('✅ Conectado a PostgreSQL');
        release();
    }
});

// ============================================
// ENDPOINTS (RUTAS DE LA API)
// ============================================

// GET - Obtener todos los contactos
app.get('/api/contactos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contactos ORDER BY nombres ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener contactos' });
    }
});

// POST - Agregar un nuevo contacto
app.post('/api/contactos', async (req, res) => {
    const { cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion } = req.body;

    // Validar campos obligatorios
    if (!cc || !nombres || !apellidos || !contacto) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
        // Verificar si ya existe
        const existe = await pool.query('SELECT * FROM contactos WHERE cc = $1', [cc]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe un contacto con esa cédula' });
        }

        const existeContacto = await pool.query('SELECT * FROM contactos WHERE contacto = $1', [contacto]);
        if (existeContacto.rows.length > 0) {
            return res.status(400).json({ 
                error: 'El número de teléfono ya está registrado por otra persona' 
            });
        }

        const result = await pool.query(
            `INSERT INTO contactos (cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [cc, nombres, apellidos, contacto, direccion || null, fecha_nacimiento || null, profesion || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al agregar contacto' });
    }
});

// PUT - Actualizar un contacto existente
app.put('/api/contactos/:cc', async (req, res) => {
    const { cc } = req.params;
    const { nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion } = req.body;

    try {
        // Verificar si existe
        const existe = await pool.query('SELECT * FROM contactos WHERE cc = $1', [cc]);
        if (existe.rows.length === 0) {
            return res.status(404).json({ error: 'Contacto no encontrado' });
        }

        const result = await pool.query(
            `UPDATE contactos 
             SET nombres = $1, apellidos = $2, contacto = $3, direccion = $4, 
                 fecha_nacimiento = $5, profesion = $6, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE cc = $7 RETURNING *`,
            [nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion, cc]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar contacto' });
    }
});

// DELETE - Eliminar un contacto
app.delete('/api/contactos/:cc', async (req, res) => {
    const { cc } = req.params;

    try {
        const result = await pool.query('DELETE FROM contactos WHERE cc = $1 RETURNING *', [cc]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contacto no encontrado' });
        }
        res.json({ mensaje: 'Contacto eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar contacto' });
    }
});

// GET - Buscar contactos por nombre, apellido o cédula
app.get('/api/contactos/buscar', async (req, res) => {
    const { q } = req.query; // q = query (lo que escribe el usuario)

    if (!q || q.trim() === '') {
        // Si no hay búsqueda, devolver todos
        const result = await pool.query('SELECT * FROM contactos ORDER BY nombres ASC');
        return res.json(result.rows);
    }

    try {
        const busqueda = `%${q.trim()}%`; // Para búsqueda parcial (contiene)
        
        const result = await pool.query(
            `SELECT * FROM contactos 
             WHERE LOWER(nombres) LIKE LOWER($1) 
                OR LOWER(apellidos) LIKE LOWER($1) 
                OR cc LIKE $2
             ORDER BY nombres ASC`,
            [busqueda, `%${q.trim()}%`]
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al buscar contactos' });
    }
});

// GET - Obtener un contacto por cédula
app.get('/api/contactos/:cc', async (req, res) => {
    const { cc } = req.params;
    try {
        const result = await pool.query('SELECT * FROM contactos WHERE cc = $1', [cc]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contacto no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener contacto' });
    }
});

// ============================================
// INICIAR EL SERVIDOR
// ============================================
app.listen(port, () => {
    console.log(`✅ API funcionando en http://localhost:${port}`);
    console.log(`📋 Conectado a PostgreSQL (contactos_db)`);
    console.log(`🚀 Endpoint: http://localhost:${port}/api/contactos`);
});