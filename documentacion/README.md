# 📇 Nexus Contactos - Documentación Técnica del Sistema

Bienvenido a la documentación técnica de **Nexus Contactos**. Este documento recopila la arquitectura integral, los módulos funcionales del sistema y las instrucciones para el despliegue en producción en un servidor VPS mediante **Dokploy**.

---

## 🧭 Mapa de Documentación por Módulos

| Módulo | Archivo | Descripción Principal |
| :--- | :--- | :--- |
| **01. Despliegue en Dokploy & VPS** | [01_DESPLIEGUE_DOKPLOY_VPS.md](file:///c:/Users/Lenovo/Documents/SENA/Apk_CRUD/backend_contactos/documentacion/01_DESPLIEGUE_DOKPLOY_VPS.md) | Guía paso a paso para desplegar en Dokploy (Docker, Compose, Traefik, SSL, Variables). |
| **02. Autenticación y Seguridad** | [02_MODULO_AUTENTICACION_Y_SEGURIDAD.md](file:///c:/Users/Lenovo/Documents/SENA/Apk_CRUD/backend_contactos/documentacion/02_MODULO_AUTENTICACION_Y_SEGURIDAD.md) | Registro por correo, JWT (30 min), alerta por 4 intentos fallidos (Sí/No), flujo "Olvidé mi contraseña". |
| **03. Gestión de Contactos** | [03_MODULO_CONTACTOS_Y_VALIDACIONES.md](file:///c:/Users/Lenovo/Documents/SENA/Apk_CRUD/backend_contactos/documentacion/03_MODULO_CONTACTOS_Y_VALIDACIONES.md) | CRUD multi-inquilino (`usuario_id`), búsqueda en tiempo real y validaciones estrictas de tipos de datos. |
| **04. Modo Offline y Módulo Pendientes** | [04_MODULO_OFFLINE_Y_PENDIENTES.md](file:///c:/Users/Lenovo/Documents/SENA/Apk_CRUD/backend_contactos/documentacion/04_MODULO_OFFLINE_Y_PENDIENTES.md) | Arquitectura offline, apartado "Pendientes [X]", cola de sincronización y resolución de conflictos. |
| **05. Notificaciones y Correo SMTP** | [05_MODULO_NOTIFICACIONES_CORREO.md](file:///c:/Users/Lenovo/Documents/SENA/Apk_CRUD/backend_contactos/documentacion/05_MODULO_NOTIFICACIONES_CORREO.md) | Configuración de Nodemailer, soporte para Gmail App Passwords y plantillas HTML dinámicas. |
| **06. Distribución de APK Móvil** | [06_MODULO_DISTRIBUCION_APK.md](file:///c:/Users/Lenovo/Documents/SENA/Apk_CRUD/backend_contactos/documentacion/06_MODULO_DISTRIBUCION_APK.md) | Endpoint de descarga `/api/descargar-apk`, detección de navegadores móviles y banner contextual. |

---

## 🏗️ Resumen de Arquitectura del Software

```
                             [ CLIENTES ]
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[ Navegador Web Desktop/Móvil ]                    [ App Nativa Android (APK) ]
(SPA Glassmorphism / Vanilla JS / PWA)             (Java / Kotlin Android Studio)
         │                                                 │
         │  HTTP/REST + JWT                                │  HTTP/REST + JWT
         └────────────────────────┬────────────────────────┘
                                  ▼
                         [ SERVIDOR VPS ]
               (Traefik Reverse Proxy + SSL Let's Encrypt)
                                  │
                                  ▼
                        [ DOKPLOY CONTAINER ]
                    ┌───────────────────────────┐
                    │       Node.js 20 LTS      │
                    │   Express 5 + Middleware   │
                    │      EmailService SMTP    │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                        [ POSTGRESQL 16 ]
                    (Base de datos: bd_contacto)
                    (Volumen persistente: postgres_data)
```

---

## 🛠️ Stack Tecnológico

- **Backend:** Node.js (v20 LTS), Express.js (v5), pg (node-postgres), bcryptjs, jsonwebtoken, nodemailer, dotenv.
- **Base de Datos:** PostgreSQL 16 con índices compuestos y claves foráneas en cascada.
- **Frontend:** HTML5 Semántico, CSS3 Moderno (Glassmorphism, Dark Theme HSL, Variables CSS), JavaScript Nativo (ES6+ sin frameworks pesados).
- **Despliegue & Contenedores:** Docker, Docker Compose, Dokploy, Traefik, Alpine Linux.
