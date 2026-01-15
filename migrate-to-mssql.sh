#!/bin/bash

# Script de migración a MSSQL Server para Culligan Backend
# Este script migra el servidor actual basado en archivos a MSSQL Server

echo "🔄 Iniciando migración a MSSQL Server..."

# Verificar que estamos en el directorio correcto
if [ ! -f "server.js" ]; then
    echo "❌ Error: No se encuentra server.js. Ejecuta este script desde el directorio backend/"
    exit 1
fi

# Crear backup de archivos actuales
echo "📦 Creando backup de archivos actuales..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Copiar archivos importantes
cp server.js "$BACKUP_DIR/" 2>/dev/null || true
cp package.json "$BACKUP_DIR/" 2>/dev/null || true
cp usuarios.json "$BACKUP_DIR/" 2>/dev/null || true
cp andenesHistorial.json "$BACKUP_DIR/" 2>/dev/null || true
cp -r data/ "$BACKUP_DIR/" 2>/dev/null || true

echo "✅ Backup creado en: $BACKUP_DIR"

# Verificar que existe el archivo .env
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Copiando desde .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Archivo .env creado. Por favor, edítalo con tus configuraciones:"
        echo "   - DB_SERVER (servidor SQL)"
        echo "   - DB_USER y DB_PASSWORD"
        echo "   - JWT_SECRET (¡importante cambiar!)"
    else
        echo "❌ No se encontró .env.example. Creando .env básico..."
        cat > .env << 'EOF'
# Configuración de producción
NODE_ENV=production
PORT=4000

# Base de datos
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=CulliganEmbarques
DB_USER=culligan_user
DB_PASSWORD=CAMBIAR_ESTE_PASSWORD

# JWT - ¡IMPORTANTE: CAMBIAR!
JWT_SECRET=tu_clave_jwt_muy_segura_2025_cambiar_en_produccion
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGINS=http://localhost:3000

# Otros
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
DATA_DIR=./data
ENABLE_JSON_BACKUP=true
LOG_LEVEL=info
LOG_DIR=./logs
EOF
    fi
fi

# Instalar dependencias de MSSQL si no están
echo "📥 Verificando dependencias..."
if ! npm list mssql &> /dev/null; then
    echo "Instalando mssql..."
    npm install mssql
fi

if ! npm list dotenv &> /dev/null; then
    echo "Instalando dotenv..."
    npm install dotenv
fi

if ! npm list helmet &> /dev/null; then
    echo "Instalando helmet..."
    npm install helmet
fi

if ! npm list express-rate-limit &> /dev/null; then
    echo "Instalando express-rate-limit..."
    npm install express-rate-limit
fi

if ! npm list compression &> /dev/null; then
    echo "Instalando compression..."
    npm install compression
fi

# Renombrar servidor actual
echo "🔄 Renombrando servidor actual..."
if [ -f "server-old.js" ]; then
    echo "⚠️  server-old.js ya existe, creando server-old-$(date +%Y%m%d_%H%M%S).js"
    mv server.js "server-old-$(date +%Y%m%d_%H%M%S).js"
else
    mv server.js server-old.js
fi

# Activar nuevo servidor
echo "🔄 Activando nuevo servidor..."
mv server-new.js server.js

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p data logs

# Verificar estructura de base de datos
echo "🗄️  Verificando base de datos..."

# Cargar configuración de .env para verificar conexión
DB_SERVER=$(grep "^DB_SERVER=" .env | cut -d'=' -f2)
DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2)
DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2)
DB_DATABASE=$(grep "^DB_DATABASE=" .env | cut -d'=' -f2)

echo "Configuración de BD encontrada:"
echo "  Servidor: $DB_SERVER"
echo "  Usuario: $DB_USER"
echo "  Base de datos: $DB_DATABASE"

# Intentar ejecutar schema si sqlcmd está disponible
if command -v sqlcmd &> /dev/null; then
    echo "🔧 sqlcmd encontrado, intentando crear schema..."
    if [ -f "database/schema.sql" ]; then
        echo "Ejecutando schema.sql..."
        sqlcmd -S "$DB_SERVER" -U "$DB_USER" -P "$DB_PASSWORD" -i database/schema.sql
        if [ $? -eq 0 ]; then
            echo "✅ Schema ejecutado correctamente"
        else
            echo "⚠️  Error ejecutando schema. Verifica la conexión a BD y ejecútalo manualmente:"
            echo "sqlcmd -S $DB_SERVER -U $DB_USER -P [password] -i database/schema.sql"
        fi
    else
        echo "⚠️  No se encontró database/schema.sql"
    fi
else
    echo "⚠️  sqlcmd no encontrado. Ejecuta el schema manualmente:"
    echo "sqlcmd -S $DB_SERVER -U $DB_USER -P [password] -i database/schema.sql"
fi

# Migrar datos existentes si es posible
echo "📊 Migrando datos existentes..."

if [ -f "$BACKUP_DIR/usuarios.json" ]; then
    echo "Encontrados usuarios en backup, considera migrar manualmente a la BD"
fi

# Actualizar package.json scripts
echo "📝 Actualizando scripts de package.json..."
npm pkg set scripts.start="node server.js"
npm pkg set scripts.dev="nodemon server.js"
npm pkg set scripts.prod="NODE_ENV=production node server.js"

echo ""
echo "🎉 ¡Migración completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Edita el archivo .env con tu configuración de BD"
echo "2. Asegúrate de que SQL Server esté ejecutándose"
echo "3. Ejecuta el schema: sqlcmd -S server -U user -P pass -i database/schema.sql"
echo "4. Migra los datos existentes manualmente si es necesario"
echo "5. Prueba la conexión: npm start"
echo ""
echo "🔍 Verificación:"
echo "- curl http://localhost:4000/health"
echo ""
echo "📁 Backup de archivos antiguos: $BACKUP_DIR"
echo "🔧 Servidor anterior: server-old.js"
echo ""
echo "⚠️  IMPORTANTE:"
echo "- Cambia JWT_SECRET en .env"
echo "- Configura credenciales de BD"
echo "- Verifica que el firewall permita conexiones a SQL Server"
echo ""