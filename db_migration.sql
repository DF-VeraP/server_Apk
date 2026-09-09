-- Migración para soporte de Usuarios, Seguridad y Aislamiento de Contactos

-- 1. Crear tabla de usuarios
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

-- 2. Modificar tabla de contactos para relacionarla con usuarios
ALTER TABLE public.contactos 
ADD COLUMN IF NOT EXISTS usuario_id INTEGER;

ALTER TABLE public.contactos 
ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP DEFAULT NULL;

-- 3. Crear usuario por defecto para vincular los contactos existentes si los hay
DO $$
DECLARE
    v_user_id INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'admin@contactos.com') THEN
        -- Contraseña por defecto: Contactos2026* (hash bcryptjs)
        INSERT INTO public.usuarios (email, password_hash)
        VALUES ('admin@contactos.com', '$2a$10$eE61K0Wf9G4hX.rLgY6.kOPeE953sDqfFomxkWgRau5k6G0y4uJae')
        RETURNING id INTO v_user_id;
    ELSE
        SELECT id INTO v_user_id FROM public.usuarios WHERE email = 'admin@contactos.com';
    END IF;

    -- Asignar contactos huérfanos al usuario administrador
    UPDATE public.contactos 
    SET usuario_id = v_user_id 
    WHERE usuario_id IS NULL;
END $$;

-- 4. Agregar clave foránea si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_contactos_usuario'
    ) THEN
        ALTER TABLE public.contactos
        ADD CONSTRAINT fk_contactos_usuario
        FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Modificar clave primaria para que sea compuesta (usuario_id, cc) permitiendo que cada usuario gestione sus contactos libremente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contactos_pkey'
    ) THEN
        ALTER TABLE public.contactos DROP CONSTRAINT contactos_pkey;
        ALTER TABLE public.contactos ADD CONSTRAINT contactos_pkey PRIMARY KEY (usuario_id, cc);
    END IF;
END $$;

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_contactos_usuario_id ON public.contactos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
