# Script de migración a MSSQL Server para Culligan Backend (Windows)
# Este script migra el servidor actual basado en archivos a MSSQL Server

Write-Host "🔄 Iniciando migración a MSSQL Server..." -ForegroundColor Cyan

# Verificar que estamos en el directorio correcto
if (!(Test-Path "server.js")) {
    Write-Host "❌ Error: No se encuentra server.js. Ejecuta este script desde el directorio backend/" -ForegroundColor Red
    exit 1
}

# Crear backup de archivos actuales
Write-Host "📦 Creando backup de archivos actuales..." -ForegroundColor Yellow
$BackupDir = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

# Copiar archivos importantes
$FilesToBackup = @("server.js", "package.json", "usuarios.json", "andenesHistorial.json")
foreach ($File in $FilesToBackup) {
    if (Test-Path $File) {
        Copy-Item $File $BackupDir\
    }
}

# Copiar directorio data si existe
if (Test-Path "data") {
    Copy-Item "data" $BackupDir\ -Recurse -ErrorAction SilentlyContinue
}

Write-Host "✅ Backup creado en: $BackupDir" -ForegroundColor Green

# Verificar que existe el archivo .env
if (!(Test-Path ".env")) {
    Write-Host "⚠️  Archivo .env no encontrado. Copiando desde .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "📝 Archivo .env creado. Por favor, edítalo con tus configuraciones:" -ForegroundColor Blue
        Write-Host "   - DB_SERVER (servidor SQL)" -ForegroundColor Blue
        Write-Host "   - DB_USER y DB_PASSWORD" -ForegroundColor Blue
        Write-Host "   - JWT_SECRET (¡importante cambiar!)" -ForegroundColor Blue
    } else {
        Write-Host "❌ No se encontró .env.example. Creando .env básico..." -ForegroundColor Yellow
        @"
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
"@ | Out-File -FilePath ".env" -Encoding UTF8
    }
}

# Instalar dependencias de MSSQL si no están
Write-Host "📥 Verificando dependencias..." -ForegroundColor Yellow

$Dependencies = @("mssql", "dotenv", "helmet", "express-rate-limit", "compression")
foreach ($Dep in $Dependencies) {
    try {
        $null = npm list $Dep 2>$null
    } catch {
        Write-Host "Instalando $Dep..." -ForegroundColor Blue
        npm install $Dep
    }
}

# Renombrar servidor actual
Write-Host "🔄 Renombrando servidor actual..." -ForegroundColor Yellow
if (Test-Path "server-old.js") {
    $OldServerName = "server-old-$(Get-Date -Format 'yyyyMMdd_HHmmss').js"
    Write-Host "⚠️  server-old.js ya existe, creando $OldServerName" -ForegroundColor Yellow
    Move-Item "server.js" $OldServerName
} else {
    Move-Item "server.js" "server-old.js"
}

# Activar nuevo servidor
Write-Host "🔄 Activando nuevo servidor..." -ForegroundColor Yellow
Move-Item "server-new.js" "server.js"

# Crear directorios necesarios
Write-Host "📁 Creando directorios..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "data" -Force | Out-Null
New-Item -ItemType Directory -Path "logs" -Force | Out-Null

# Verificar estructura de base de datos
Write-Host "🗄️  Verificando configuración de base de datos..." -ForegroundColor Yellow

# Leer configuración de .env
$EnvContent = Get-Content ".env"
$DBServer = ($EnvContent | Where-Object { $_ -match "^DB_SERVER=" }) -replace "^DB_SERVER=", ""
$DBUser = ($EnvContent | Where-Object { $_ -match "^DB_USER=" }) -replace "^DB_USER=", ""
$DBDatabase = ($EnvContent | Where-Object { $_ -match "^DB_DATABASE=" }) -replace "^DB_DATABASE=", ""
$DBPassword = ($EnvContent | Where-Object { $_ -match "^DB_PASSWORD=" }) -replace "^DB_PASSWORD=", ""

Write-Host "Configuración de BD encontrada:" -ForegroundColor Blue
Write-Host "  Servidor: $DBServer" -ForegroundColor Blue
Write-Host "  Usuario: $DBUser" -ForegroundColor Blue
Write-Host "  Base de datos: $DBDatabase" -ForegroundColor Blue

# Intentar ejecutar schema si sqlcmd está disponible
$SqlCmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if ($SqlCmd) {
    Write-Host "🔧 sqlcmd encontrado, intentando crear schema..." -ForegroundColor Blue
    if (Test-Path "database\schema.sql") {
        Write-Host "Ejecutando schema.sql..." -ForegroundColor Blue
        $Result = sqlcmd -S $DBServer -U $DBUser -P $DBPassword -i "database\schema.sql"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Schema ejecutado correctamente" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Error ejecutando schema. Verifica la conexión a BD y ejecútalo manualmente:" -ForegroundColor Yellow
            Write-Host "sqlcmd -S $DBServer -U $DBUser -P [password] -i database\schema.sql" -ForegroundColor Blue
        }
    } else {
        Write-Host "⚠️  No se encontró database\schema.sql" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  sqlcmd no encontrado. Instala SQL Server Command Line Tools" -ForegroundColor Yellow
    Write-Host "Descarga desde: https://docs.microsoft.com/sql/tools/sqlcmd-utility" -ForegroundColor Blue
    Write-Host "O ejecuta el schema manualmente en SQL Server Management Studio" -ForegroundColor Blue
}

# Migrar datos existentes si es posible
Write-Host "📊 Verificando datos existentes para migración..." -ForegroundColor Yellow

if (Test-Path "$BackupDir\usuarios.json") {
    Write-Host "Encontrados usuarios en backup, considera migrar manualmente a la BD" -ForegroundColor Blue
}

# Actualizar package.json scripts
Write-Host "📝 Actualizando scripts de package.json..." -ForegroundColor Yellow
npm pkg set scripts.start="node server.js"
npm pkg set scripts.dev="nodemon server.js"
npm pkg set scripts.prod="NODE_ENV=production node server.js"

Write-Host ""
Write-Host "🎉 ¡Migración completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Edita el archivo .env con tu configuración de BD" -ForegroundColor White
Write-Host "2. Asegúrate de que SQL Server esté ejecutándose" -ForegroundColor White
Write-Host "3. Ejecuta el schema:" -ForegroundColor White
Write-Host "   sqlcmd -S servidor -U usuario -P password -i database\schema.sql" -ForegroundColor Gray
Write-Host "4. Migra los datos existentes manualmente si es necesario" -ForegroundColor White
Write-Host "5. Prueba la aplicación: npm start" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Verificación:" -ForegroundColor Cyan
Write-Host "- Invoke-RestMethod http://localhost:4000/health" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 Backup de archivos antiguos: $BackupDir" -ForegroundColor Blue
Write-Host "🔧 Servidor anterior: server-old.js" -ForegroundColor Blue
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Red
Write-Host "- Cambia JWT_SECRET en .env por algo seguro" -ForegroundColor Yellow
Write-Host "- Configura credenciales correctas de BD en .env" -ForegroundColor Yellow
Write-Host "- Verifica que el firewall permita conexiones a SQL Server (puerto 1433)" -ForegroundColor Yellow
Write-Host "- Si usas SQL Server en Docker, asegúrate de que el contenedor esté ejecutándose" -ForegroundColor Yellow
Write-Host ""

# Pausa para que el usuario pueda leer la información
Write-Host "Presiona cualquier tecla para continuar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")