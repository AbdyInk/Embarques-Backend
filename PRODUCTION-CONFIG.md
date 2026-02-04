# Configuración para Producción - Culligan Backend

## Variables de Entorno para Producción
Crear un archivo `.env` en la carpeta backend con:

```env
# Configuración de Producción
NODE_ENV=production
PORT=4000

# JWT Secret (cambiar por uno más seguro)
JWT_SECRET=culligan_secret_production_2026_vitotechnologies_secure_key

# CORS Origins (Frontend en producción)
CORS_ORIGINS=https://culligan.vitotechnologies.com,http://culligan.vitotechnologies.com

# Base de datos (opcional si usas SQL Server)
# DB_SERVER=servidor_sql
# DB_DATABASE=culligan_db
# DB_USER=usuario
# DB_PASSWORD=password

# Configuración TCP
TCP_PORT=4040

# Configuración de logs
LOG_LEVEL=info
```

## Configuración Actual del Backend

✅ **USE_DEV_DATA = false** - Configurado para producción (datos vacíos)
✅ **CORS configurado** - Permite culligan.vitotechnologies.com
✅ **Red binding** - Escucha en 0.0.0.0 (todas las interfaces)
✅ **Puertos configurados** - HTTP: 4000, TCP: 4040
✅ **JWT mejorado** - Secret más seguro para producción

## Comandos de Producción

```bash
# Instalar dependencias
npm install --only=production

# Iniciar en modo producción
npm start

# O usar PM2 (recomendado para producción)
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

## URLs de Acceso en Producción

- **API Backend**: `http://TU_IP_SERVIDOR:4000`
- **TCP Scanner**: `TU_IP_SERVIDOR:4040`
- **Frontend**: `https://culligan.vitotechnologies.com`

## Verificaciones de Funcionamiento

1. **Test CORS**: `curl -H "Origin: https://culligan.vitotechnologies.com" http://TU_IP:4000/api/andenes`
2. **Test Authentication**: POST a `/api/login`
3. **Test TCP**: Conectar scanner a puerto 4040

## Estado del Sistema

- 🏭 **Modo**: Producción (USE_DEV_DATA = false)
- 🌐 **Frontend**: culligan.vitotechnologies.com
- 🔒 **Seguridad**: CORS restringido, JWT configurado
- 📡 **Red**: Accessible desde cualquier IP (0.0.0.0)