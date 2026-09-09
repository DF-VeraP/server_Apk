# 📶 Módulo 04: Modo Offline y Apartado de Pendientes

Este módulo describe la capacidad *Offline-First* del sistema, el almacenamiento local en el navegador, el nuevo apartado interactivo de "Pendientes [X]" y la sincronización con PostgreSQL.

---

## 1. Arquitectura Offline-First

El sistema está diseñado para que el usuario pueda operar de forma continua, incluso cuando se corta la conexión a internet o cuando viaja en zonas sin cobertura.

```
       [ OPERACIÓN DEL USUARIO: CREAR / EDITAR / ELIMINAR ]
                                │
                 ¿Hay conexión a Internet?
                                │
               ┌────────────────┴────────────────┐
             [ SÍ ]                            [ NO ]
               ▼                                 ▼
   Guarda directamente en              Guarda en Caché Local
   PostgreSQL vía API REST              (`localStorage`)
               │                                 │
   Muestra confirmación                Encola en `nexus_sync_queue`
                                       Incrementa contador `Pendientes [X]`
                                       Alerta visual interactiva
                                                 │
                                     ¿Se restablece conexión?
                                                 ▼
                                     Sincroniza automáticamente en
                                     lote con PostgreSQL
```

---

## 2. Apartado / Módulo "Pendientes [X]"

### Características del Módulo:
1. **Botón en Barra Superior:**
   - Ubicado permanentemente en el panel de contactos:
     `Pendientes [X]`
   - El número `[X]` refleja en tiempo real cuántas operaciones están guardadas en el dispositivo esperando ser subidas a PostgreSQL.
   - Si `X > 0`, el botón activa un resplandor ámbar con animación de pulso (`pulseAmber`) para llamar la atención del usuario.
2. **Ventana Emergente de Detalle (`#pendingSyncModal`):**
   - Al presionar el botón, se abre la vista detallada de pendientes.
   - Muestra cada operación en tarjetas con distintivos de color:
     - <span style="color:#34d399">● CREAR:</span> Nombre, Cédula y Hora.
     - <span style="color:#38bdf8">● EDITAR:</span> Nombre, Cédula y Hora.
     - <span style="color:#fb7185">● ELIMINAR:</span> Cédula y Hora.
   - Si no hay pendientes, muestra el mensaje de confirmación:
     *"No hay registros pendientes. Todos tus contactos están guardados y sincronizados en la base de datos PostgreSQL."*
3. **Botón "Sincronizar Ahora":**
   - Permite al usuario forzar la sincronización manual inmediata en cuanto recupera la conexión.
   - Si intenta sincronizar sin red, el sistema le notifica amablemente que sus datos están seguros y se subirán al volver la conexión.

---

## 3. Protocolo de Sincronización en Backend (`POST /api/contactos/sincronizar`)

- **Procesamiento por Lote:** El servidor recibe un arreglo `operacionesPendientes`.
- **Idempotencia y Resolución de Conflictos:**
  ```sql
  INSERT INTO contactos (cc, nombres, apellidos, contacto, direccion, fecha_nacimiento, profesion, usuario_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  ON CONFLICT (usuario_id, cc) DO UPDATE 
  SET nombres = EXCLUDED.nombres, 
      apellidos = EXCLUDED.apellidos, 
      contacto = EXCLUDED.contacto, 
      direccion = EXCLUDED.direccion, 
      fecha_nacimiento = EXCLUDED.fecha_nacimiento, 
      profesion = EXCLUDED.profesion, 
      fecha_actualizacion = CURRENT_TIMESTAMP;
  ```
- **Consolidación:** Al finalizar, el servidor retorna la lista oficial actualizada de todos los contactos del usuario para actualizar el estado del navegador.
