# ==============================================================================
# Dockerfile para Producción - Nexus Contactos
# Optimizado para despliegue en VPS mediante Dokploy
# ==============================================================================

FROM node:20-alpine AS runner

# Definir directorio de trabajo
WORKDIR /app

# Instalar dependencias necesarias para compilar o utilitarios
RUN apk add --no-cache tzdata

# Definir zona horaria
ENV TZ=America/Bogota
ENV NODE_ENV=production
ENV PORT=4000

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción limpias
RUN npm ci --omit=dev

# Copiar el código fuente de la aplicación
COPY server.js ./
COPY services/ ./services/
COPY public/ ./public/
COPY db_migration.sql ./

# Exponer el puerto de la aplicación
EXPOSE 4000

# Usuario sin privilegios por seguridad
USER node

# Comando de inicio del servidor
CMD ["node", "server.js"]
