# 🚀 Módulo 01: Guía de Despliegue en Dokploy con VPS

Esta guía detalla el proceso completo para desplegar la aplicación **Nexus Contactos** en un servidor VPS utilizando **Dokploy** (panel de despliegue PaaS de código abierto basado en Docker y Traefik).

---

## 1. Requisitos Previos

1. **Servidor VPS** (Ubuntu 22.04 LTS / 24.04 LTS recomendado, mínimo 1 vCPU y 1 GB RAM).
2. **Dokploy instalado** en el VPS (instalable con `curl -sSL https://dokploy.com/install.sh | sh`).
3. **Nombre de Dominio o Subdominio** apuntando a la IP pública del VPS (registro tipo `A`, ej: `contactos.tudominio.com`).
4. **Repositorio Git** con el código fuente del proyecto (GitHub, GitLab o Git local).

---

## 2. Métodos de Despliegue en Dokploy

Existen dos maneras óptimas de desplegar el sistema en Dokploy:

### Opción A: Despliegue con Docker Compose (Recomendado - Todo en uno)
Despliega simultáneamente la aplicación Node.js y el contenedor de base de datos PostgreSQL con volumen persistente e inicialización automática.

1. En el panel de **Dokploy**, dirígete a tu proyecto y selecciona **"Create Service"** -> **"Compose"**.
2. Asigna un nombre al servicio (ej: `nexus-contactos`).
3. En la pestaña **Source**, selecciona tu proveedor Git y vincula el repositorio y rama (`main`).
4. En **Compose File**, Dokploy detectará automáticamente el archivo `docker-compose.yml` del repositorio.
5. Ve a la pestaña **Environment** y copia las variables de entorno basadas en `.env.dokploy.example`:
   ```env
   APP_URL=https://contactos.tudominio.com
   NODE_ENV=production
   PORT=4000
   DB_HOST=postgres_db
   DB_PORT=5432
   DB_NAME=bd_contacto
   DB_USER=postgres
   DB_PASSWORD=TuPasswordSuperSeguraPostgres!
   JWT_SECRET=tu_clave_secreta_jwt_larga_y_aleatoria
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=465
   EMAIL_SECURE=true
   EMAIL_USER=pvfduni@gmail.com
   EMAIL_PASS=tu_clave_de_aplicacion_gmail
   EMAIL_FROM="Nexus Contactos <pvfduni@gmail.com>"
   ```
6. En la pestaña **Domains**, añade tu dominio:
   - **Host:** `contactos.tudominio.com`
   - **Path:** `/`
   - **Container Port:** `4000`
   - **HTTPS / SSL:** Activa la casilla de SSL (Dokploy solicitará el certificado gratuito con Let's Encrypt automáticamente).
7. Haz clic en **"Deploy"**.

---

### Opción B: Despliegue con Dockerfile + Base de Datos Gestionada de Dokploy
Si prefieres administrar la base de datos PostgreSQL desde la sección nativa de Dokploy:

1. **Crear la Base de Datos:**
   - En Dokploy, haz clic en **"Create Service"** -> **"Database"** -> **"PostgreSQL"**.
   - Nombre de BD: `bd_contacto`.
   - Usuario: `postgres`.
   - Contraseña: La que elijas.
   - Una vez creada, ejecuta el script `init_database.sql` en la pestaña de consultas SQL o terminal de Dokploy.
2. **Crear la Aplicación Web:**
   - Haz clic en **"Create Service"** -> **"Application"**.
   - Tipo de build: **Dockerfile**.
   - Dokploy usará el archivo `Dockerfile` incluido en la raíz.
   - En variables de entorno, coloca la conexión interna de PostgreSQL (`DB_HOST` será el nombre interno del servicio de base de datos generado por Dokploy).
   - Configura el dominio en el puerto `4000` con HTTPS y despliega.

---

## 3. Persistencia de Datos y Volúmenes

- La base de datos guarda sus datos en el volumen `postgres_data`, asegurando que al reiniciar o actualizar contenedores nunca se pierda la información ni los contactos.
- El archivo `init_database.sql` se ejecuta únicamente la primera vez que se crea el volumen para garantizar tablas, claves e índices óptimos.

---

## 4. Verificación Post-Despliegue

1. Accede a `https://contactos.tudominio.com`.
2. Verifica que el candado SSL (HTTPS) esté activo y válido.
3. Inicia sesión con el usuario administrador por defecto:
   - **Correo:** `admin@contactos.com`
   - **Contraseña Inicial:** `Contactos2026*`
4. Prueba el envío de correo solicitando "Olvidé mi contraseña" para validar la conexión SMTP del servidor.
