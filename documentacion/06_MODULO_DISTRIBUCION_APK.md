# Módulo 06: Proyecto Android Studio (APK Nativo) y Distribución

Este módulo documenta la arquitectura técnica del proyecto nativo Android ubicado en `C:\Users\Lenovo\AndroidStudioProjects\crud_contactos`, su enlace con el backend, sincronización offline, autenticación y el canal de distribución pública del binario APK.

---

## 1. Arquitectura de Conexión de la APK

La aplicación móvil **nunca se conecta directamente al puerto de PostgreSQL (`5432`)** por razones de seguridad perimetral. En su lugar, se comunica de forma cifrada y autenticada con la **API REST del backend**:

```
[ Teléfono Android / APK ] 
          │
          ▼ (HTTP / JSON con Token JWT)
[ Backend Node.js en VPS / Dokploy ]
          │
          ▼ (Red Interna Privada Docker)
[ PostgreSQL 16 (bd_contacto) ]
```

---

## 2. Componentes del Proyecto Android (`crud_contactos`)

El proyecto está desarrollado en **Kotlin** con **Retrofit 2**, **Gson**, **OkHttp3** y base de datos local **SQLite**:

### 2.1. Gestión de Sesión y URL Dinámica (`SessionManager.kt`)
- Administra las credenciales en `SharedPreferences`.
- Permite configurar la dirección del backend de forma interactiva desde la pantalla de login:
  - **Emulador de Android Studio:** `http://10.0.2.2:3000/` (apunta a localhost de tu PC).
  - **Teléfono Físico en Wi-Fi:** `http://192.168.1.X:3000/` (apunta a tu máquina en la red local).
  - **Producción en VPS Dokploy:** `https://contactos.tudominio.com/` o `http://IP_VPS:3000/`.

### 2.2. Inyección Automática de Token JWT (`RetrofitClient.kt`)
- Un interceptor de red de OkHttp inyecta automáticamente la cabecera:
  `Authorization: Bearer <token>`
- Configura timeouts rápidos (7s) para conmutar sin demoras al modo offline si la red se pierde.

### 2.3. Autenticación Completa (`LoginActivity.kt` + `activity_login.xml`)
- Formulario de acceso con correo y contraseña.
- Control de intentos fallidos y bloqueo (a los 4 intentos advierte que la cuenta ha sido bloqueada y se envió correo).
- Diálogo de **"Olvidé mi contraseña"** conectado a `POST /api/auth/olvide-password`.
- Diálogo de **"Registrarme"** conectado a `POST /api/auth/registro`.
- Opción de acceso en **Modo Offline** si el servidor no responde y existen datos locales.

### 2.4. Modo Offline y Sincronización Bidireccional (`LocalDatabaseHelper.kt`)
- Base de datos local SQLite con dos tablas:
  - `contactos`: Almacena en caché local los contactos del usuario.
  - `pendientes`: Encola las operaciones realizadas sin internet (`crear`, `editar`, `eliminar`).
- **Comportamiento Offline:**
  - Si el usuario agrega, edita o borra contactos sin internet, los cambios se aplican de inmediato en la base de datos local y se encolan en `pendientes`.
  - El usuario puede seguir consultando, buscando y gestionando sus contactos normalmente.
- **Comportamiento al Reconectar:**
  - Al detectar conexión, `MainActivity.kt` envía el paquete de pendientes al endpoint `POST /api/contactos/sincronizar`.
  - El servidor valida conflictos de duplicados en base de datos, aplica las operaciones y devuelve la lista actualizada.
  - La cola local se vacía y se actualiza el contador: `Pendientes [0]`.

### 2.5. Validación de Duplicados en la APK (`AgregarActivity.kt` y `EditarActivity.kt`)
- **Validación Local previa:** Impide registrar cédulas o teléfonos repetidos verificando en SQLite antes de enviar la solicitud.
- **Validación en Servidor:** Si el servidor responde `HTTP 400`, la aplicación extrae el mensaje del error y muestra una alerta limpia al usuario.
- **Validación de Caracteres:** Cédula y teléfono aceptan únicamente dígitos numéricos; nombres y apellidos no permiten números.
- **Cero Emojis:** Todos los diálogos, botones y mensajes utilizan tipografía estándar profesional.

---

## 3. Distribución Pública del APK

El backend integra un canal directo de distribución:

1. **Compilación:**
   - La APK compilada desde Android Studio (`app-debug.apk` o `app-release.apk`) se sincroniza en el backend en:
     `public/apk/app-contactos.apk`
2. **Descarga Directa (`GET /api/descargar-apk`):**
   - Sirve el instalador con cabecera `Content-Type: application/vnd.android.package-archive` y nombre `ContactosApp.apk`.
3. **Banner Web Automático:**
   - Si un usuario ingresa a la versión web desde un teléfono móvil, se le ofrece un botón directo para instalar la APK nativa.
