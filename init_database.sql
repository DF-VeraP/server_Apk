-- ==============================================================================
-- Script de Inicialización de Base de Datos para Producción (Dokploy / VPS)
-- Base de Datos: bd_contacto
-- ==============================================================================

-- 1. Crear tabla de usuarios con soporte de seguridad
CREATE TABLE IF NOT EXISTS public.usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    intentos_fallidos INTEGER DEFAULT 0,
    bloqueado BOOLEAN DEFAULT FALSE,
    token_seguridad VARCHAR(255),
    token_expira TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear tabla de contactos asociada a usuarios (aislamiento multi-inquilino)
CREATE TABLE IF NOT EXISTS public.contactos (
    usuario_id INTEGER NOT NULL,
    cc VARCHAR(20) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    contacto VARCHAR(20) NOT NULL,
    direccion TEXT,
    fecha_nacimiento DATE,
    profesion VARCHAR(100),
    eliminado_en TIMESTAMP DEFAULT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contactos_pkey PRIMARY KEY (usuario_id, cc),
    CONSTRAINT fk_contactos_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE
);

-- 3. Índices de optimización de rendimiento
CREATE INDEX IF NOT EXISTS idx_contactos_usuario_id ON public.contactos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contactos_cc ON public.contactos(cc);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_token ON public.usuarios(token_seguridad);

-- 4. Insertar usuario administrador por defecto si no existe
-- Clave inicial: Contactos2026*
INSERT INTO public.usuarios (email, password_hash)
VALUES ('admin@contactos.com', '$2a$10$eE61K0Wf9G4hX.rLgY6.kOPeE953sDqfFomxkWgRau5k6G0y4uJae')
ON CONFLICT (email) DO NOTHING;
