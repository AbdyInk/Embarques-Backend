# 🚀 GUÍA RÁPIDA DE DESPLIEGUE - CULLIGAN BACKEND

## ⚡ Despliegue Rápido en Ubuntu

### 1. Preparar Servidor Ubuntu
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar herramientas
sudo npm install -g pm2
sudo apt install nginx docker.io -y
```

### 2. Configurar SQL Server (Docker - Recomendado)
```bash
# Iniciar Docker
sudo systemctl start docker && sudo systemctl enable docker

# Ejecutar SQL Server
sudo docker run -e "ACCEPT_EULA=Y" \
  -e "SA_PASSWORD=CulliganSecure2025!" \
  -p 1433:1433 \
  --name culligan-sqlserver \
  --restart unless-stopped \
  -d mcr.microsoft.com/mssql/server:2019-latest

# Verificar
sudo docker ps
```

### 3. Configurar Aplicación
```bash
# Crear usuario de aplicación
sudo adduser culligan
su - culligan

# Subir archivos del proyecto a /home/culligan/app
mkdir -p /home/culligan/app
cd /home/culligan/app

# Instalar dependencias
npm install --production

# Configurar entorno
cp .env.example .env
nano .env  # Editar configuración

# Crear base de datos
sqlcmd -S localhost -U sa -P 'CulliganSecure2025!' -i database/schema.sql
```

### 4. Migrar de Archivos a MSSQL (Si tienes datos existentes)
```bash
# Para migración automática desde archivos JSON
node migrate-data.js

# O migración manual usando el script de PowerShell/Bash
./migrate-to-mssql.sh
```

### 5. Iniciar con PM2
```bash
# Iniciar aplicación
pm2 start ecosystem.config.js

# Configurar inicio automático
pm2 startup
pm2 save

# Verificar estado
pm2 status
```

### 6. Configurar Nginx (Opcional)
```bash
# Crear configuración
sudo nano /etc/nginx/sites-available/culligan-backend
# Copiar configuración del README.md

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/culligan-backend /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

---

## 🔧 Variables de Entorno Críticas (.env)

```env
# PRODUCCIÓN - ¡CAMBIAR VALORES!
NODE_ENV=production
PORT=4000

# Base de datos
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=CulliganEmbarques
DB_USER=sa
DB_PASSWORD=CulliganSecure2025!

# JWT - ¡CAMBIAR!
JWT_SECRET=tu_clave_jwt_super_segura_2025
JWT_EXPIRES_IN=24h

# CORS (ajustar por tu dominio)
CORS_ORIGINS=http://localhost:3000,https://tu-dominio.com
```

---

## 📋 Lista de Verificación

- [ ] ✅ Ubuntu actualizado y Node.js 18+ instalado
- [ ] 🐳 SQL Server corriendo (Docker o instalación)
- [ ] 📁 Archivos del proyecto subidos a `/home/culligan/app`
- [ ] 📦 Dependencias instaladas (`npm install`)
- [ ] ⚙️ Archivo .env configurado correctamente
- [ ] 🗄️ Base de datos creada (`database/schema.sql` ejecutado)
- [ ] 📊 Datos migrados (si es necesario)
- [ ] 🚀 PM2 configurado y aplicación ejecutándose
- [ ] 🌐 Nginx configurado (opcional)
- [ ] 🔒 Firewall configurado (UFW)
- [ ] ✨ Health check funcionando: `curl http://localhost:4000/health`

---

## 🚨 Troubleshooting Rápido

### Error de conexión a BD:
```bash
# Verificar SQL Server
sudo docker ps
sudo docker logs culligan-sqlserver

# Probar conexión
sqlcmd -S localhost -U sa -P 'CulliganSecure2025!' -Q "SELECT @@VERSION"
```

### Error de permisos:
```bash
# Cambiar propietario
sudo chown -R culligan:culligan /home/culligan/app
```

### Puerto ocupado:
```bash
# Ver qué usa el puerto 4000
sudo netstat -tlnp | grep :4000
# Cambiar PORT in .env si es necesario
```

### PM2 no arranca:
```bash
# Verificar logs
pm2 logs culligan-backend
# Reiniciar
pm2 restart culligan-backend
```

---

## 🎯 URLs de Verificación

- **Health Check:** `http://tu-servidor:4000/health`
- **API Base:** `http://tu-servidor:4000/api/andenes`
- **Login:** `POST http://tu-servidor:4000/api/login`

---

## 📞 Comandos de Administración

```bash
# Ver estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs culligan-backend --lines 50

# Reiniciar aplicación
pm2 restart culligan-backend

# Backup de base de datos
sqlcmd -S localhost -U sa -P 'password' -Q "BACKUP DATABASE CulliganEmbarques TO DISK = '/var/opt/mssql/data/backup.bak'"

# Ver métricas del sistema
pm2 monit
```

---

**¡Tu backend está listo para producción!** 🎉

Para soporte: revisar logs de PM2 y verificar conectividad de red y base de datos.