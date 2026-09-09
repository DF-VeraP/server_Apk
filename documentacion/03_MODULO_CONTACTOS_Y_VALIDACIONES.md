# 👥 Módulo 03: Gestión de Contactos y Validaciones Estrictas

Este módulo documenta las operaciones CRUD de la libreta de contactos, el modelo de aislamiento multi-usuario y las reglas estrictas de validación de campos.

---

## 1. Modelo de Datos y Aislamiento por Usuario

Cada registro de contacto pertenece exclusivamente a un usuario identificado por `usuario_id`. Un usuario no puede ver, editar, ni eliminar los contactos de otros usuarios.

### Estructura de la Tabla `public.contactos`:
| Campo | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `usuario_id` | `INTEGER` | Clave Foránea (`fk_contactos_usuario`) | ID del usuario propietario |
| `cc` | `VARCHAR(20)` | Parte de Clave Primaria Compuesta | Cédula del contacto (única por usuario) |
| `nombres` | `VARCHAR(100)` | `NOT NULL` | Nombres del contacto (solo letras y espacios) |
| `apellidos` | `VARCHAR(100)` | `NOT NULL` | Apellidos del contacto (solo letras y espacios) |
| `contacto` | `VARCHAR(20)` | `NOT NULL` | Teléfono / Celular (solo números) |
| `direccion` | `TEXT` | Opcional | Dirección de residencia |
| `fecha_nacimiento` | `DATE` | Opcional | Fecha de nacimiento |
| `profesion` | `VARCHAR(100)` | Opcional | Ocupación profesional |
| `eliminado_en` | `TIMESTAMP` | Opcional | Control de borrado lógico |

---

## 2. Reglas de Validación Estricta (Cliente y Servidor)

Para garantizar la integridad y calidad de la información, se implementaron filtros bidireccionales obligatorios:

### A. Cédula de Ciudadanía (`cc`) y Teléfono / Celular (`contacto`)
- **Regla:** **SOLO NÚMEROS (`0-9`)**.
- **Bloqueo en el Cliente:**
  - `pattern="[0-9]+"` e `inputmode="numeric"`.
  - Intercepción en tiempo real del evento `input`: `e.target.value = e.target.value.replace(/\D/g, '')`.
  - Bloqueo en eventos `keypress` y filtrado al pegar contenido (`paste`).
- **Validación en el Servidor (`server.js`):**
  - Expresión regular `/^\d+$/`. Si contiene cualquier letra o símbolo, retorna HTTP `400`:
    `"La cédula (CC) es obligatoria y solo debe contener números."`
    `"El teléfono / celular es obligatorio y solo debe contener números."`

### B. Nombres (`nombres`) y Apellidos (`apellidos`)
- **Regla:** **SOLO LETRAS Y ESPACIOS**. No se permiten números (`0-9`) ni caracteres especiales.
- **Bloqueo en el Cliente:**
  - `pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+"`.
  - Intercepción en tiempo real del evento `input`: `e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')`.
  - Bloqueo de teclas numéricas en `keypress` y depuración al pegar (`paste`).
- **Validación en el Servidor (`server.js`):**
  - Expresión regular `/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/`. Si contiene números o caracteres inválidos, retorna HTTP `400`:
    `"Los nombres solo deben contener letras y espacios (no se permiten números)."`
    `"Los apellidos solo deben contener letras y espacios (no se permiten números)."`

---

## 3. Endpoints de la API

- `GET /api/contactos`: Lista todos los contactos del usuario autenticado ordenados alfabéticamente por nombres.
- `GET /api/contactos/buscar?q=...`: Búsqueda en tiempo real por nombre, apellido, cédula o teléfono.
- `GET /api/contactos/:cc`: Obtiene los detalles de un contacto específico.
- `POST /api/contactos`: Crea un nuevo contacto validando duplicidad de cédula o teléfono para ese usuario.
- `PUT /api/contactos/:cc`: Actualiza la información de un contacto existente con validación estricta.
- `DELETE /api/contactos/:cc`: Elimina físicamente el contacto del directorio personal.
