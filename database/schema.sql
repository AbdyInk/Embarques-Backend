-- ================================================
-- CULLIGAN EMBARQUES - ESQUEMA DE BASE DE DATOS
-- ================================================
-- Sistema de gestión de embarques y andenes
-- Versión: 1.0.0
-- Fecha: 2025-01-15
-- ================================================

USE master;
GO

-- Crear base de datos si no existe
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'CulliganEmbarques')
BEGIN
    CREATE DATABASE CulliganEmbarques
    COLLATE SQL_Latin1_General_CP1_CI_AS;
END
GO

USE CulliganEmbarques;
GO

-- ================================================
-- TABLA: Usuarios
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
BEGIN
    CREATE TABLE Usuarios (
        id INT IDENTITY(1,1) PRIMARY KEY,
        usuario NVARCHAR(50) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        grupo NVARCHAR(20) NOT NULL DEFAULT 'operador',
        activo BIT NOT NULL DEFAULT 1,
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaModificacion DATETIME2 NULL,
        creadoPor NVARCHAR(50) NULL,
        modificadoPor NVARCHAR(50) NULL,
        
        CONSTRAINT CHK_Usuarios_Grupo CHECK (grupo IN ('administrador', 'operador', 'supervisor')),
        CONSTRAINT CHK_Usuarios_Usuario_Length CHECK (LEN(usuario) >= 3)
    );

    -- Índices
    CREATE INDEX IX_Usuarios_Usuario ON Usuarios(usuario);
    CREATE INDEX IX_Usuarios_Grupo ON Usuarios(grupo);
    CREATE INDEX IX_Usuarios_Activo ON Usuarios(activo);
END
GO

-- ================================================
-- TABLA: Andenes
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Andenes')
BEGIN
    CREATE TABLE Andenes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        numero INT NOT NULL UNIQUE,
        status NVARCHAR(50) NOT NULL DEFAULT 'Disponible',
        cantidad INT NOT NULL DEFAULT 0,
        limiteCamion INT NOT NULL DEFAULT 30,
        numeroCajaCamion NVARCHAR(50) NULL,
        destino NVARCHAR(50) NULL,
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaModificacion DATETIME2 NULL,
        creadoPor NVARCHAR(50) NULL,
        modificadoPor NVARCHAR(50) NULL,
        
        CONSTRAINT CHK_Andenes_Numero CHECK (numero BETWEEN 1 AND 99),
        CONSTRAINT CHK_Andenes_Status CHECK (status IN ('Disponible', 'En espera', 'Cargando', 'Completado', 'Documentado', 'Embarcado', 'Limite')),
        CONSTRAINT CHK_Andenes_Cantidad CHECK (cantidad >= 0),
        CONSTRAINT CHK_Andenes_LimiteCamion CHECK (limiteCamion > 0),
        CONSTRAINT CHK_Andenes_Destino CHECK (destino IN ('Dallas', 'Toronto', 'Mc Allen') OR destino IS NULL)
    );

    -- Índices
    CREATE INDEX IX_Andenes_Numero ON Andenes(numero);
    CREATE INDEX IX_Andenes_Status ON Andenes(status);
    CREATE INDEX IX_Andenes_Destino ON Andenes(destino);
END
GO

-- ================================================
-- TABLA: Pallets
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Pallets')
BEGIN
    CREATE TABLE Pallets (
        id INT IDENTITY(1,1) PRIMARY KEY,
        andenId INT NOT NULL,
        numeroParte NVARCHAR(100) NOT NULL,
        piezas INT NOT NULL DEFAULT 1,
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaModificacion DATETIME2 NULL,
        creadoPor NVARCHAR(50) NULL,
        activo BIT NOT NULL DEFAULT 1,
        
        CONSTRAINT FK_Pallets_Andenes FOREIGN KEY (andenId) REFERENCES Andenes(id) ON DELETE CASCADE,
        CONSTRAINT CHK_Pallets_Piezas CHECK (piezas > 0),
        CONSTRAINT CHK_Pallets_NumeroParte_Length CHECK (LEN(numeroParte) >= 1)
    );

    -- Índices
    CREATE INDEX IX_Pallets_AndenId ON Pallets(andenId);
    CREATE INDEX IX_Pallets_NumeroParte ON Pallets(numeroParte);
    CREATE INDEX IX_Pallets_FechaCreacion ON Pallets(fechaCreacion);
    CREATE INDEX IX_Pallets_Activo ON Pallets(activo);
END
GO

-- ================================================
-- TABLA: Historial
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Historial')
BEGIN
    CREATE TABLE Historial (
        id INT IDENTITY(1,1) PRIMARY KEY,
        andenId INT NULL,
        tipo NVARCHAR(50) NOT NULL,
        codigo NVARCHAR(100) NULL,
        accion NVARCHAR(255) NOT NULL,
        valorAnterior NVARCHAR(MAX) NULL,
        valorNuevo NVARCHAR(MAX) NULL,
        usuario NVARCHAR(50) NULL,
        fechaHora DATETIME2 NOT NULL DEFAULT GETDATE(),
        metadatos NVARCHAR(MAX) NULL, -- JSON adicional
        
        CONSTRAINT FK_Historial_Andenes FOREIGN KEY (andenId) REFERENCES Andenes(id) ON DELETE SET NULL,
        CONSTRAINT CHK_Historial_Tipo CHECK (tipo IN ('pallet', 'status', 'destino', 'caja', 'limite', 'sistema', 'usuario')),
        CONSTRAINT CHK_Historial_Accion_Length CHECK (LEN(accion) >= 1)
    );

    -- Índices
    CREATE INDEX IX_Historial_AndenId ON Historial(andenId);
    CREATE INDEX IX_Historial_Tipo ON Historial(tipo);
    CREATE INDEX IX_Historial_Usuario ON Historial(usuario);
    CREATE INDEX IX_Historial_FechaHora ON Historial(fechaHora DESC);
END
GO

-- ================================================
-- TABLA: Escaneos
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Escaneos')
BEGIN
    CREATE TABLE Escaneos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        andenId INT NOT NULL,
        numeroParte NVARCHAR(100) NOT NULL,
        piezas INT NOT NULL DEFAULT 1,
        usuario NVARCHAR(50) NULL,
        fechaHora DATETIME2 NOT NULL DEFAULT GETDATE(),
        procesado BIT NOT NULL DEFAULT 0,
        tipoEscaneo NVARCHAR(20) NOT NULL DEFAULT 'manual',
        
        CONSTRAINT FK_Escaneos_Andenes FOREIGN KEY (andenId) REFERENCES Andenes(id) ON DELETE CASCADE,
        CONSTRAINT CHK_Escaneos_Piezas CHECK (piezas > 0),
        CONSTRAINT CHK_Escaneos_TipoEscaneo CHECK (tipoEscaneo IN ('manual', 'automatico', 'correcion'))
    );

    -- Índices
    CREATE INDEX IX_Escaneos_AndenId ON Escaneos(andenId);
    CREATE INDEX IX_Escaneos_NumeroParte ON Escaneos(numeroParte);
    CREATE INDEX IX_Escaneos_Usuario ON Escaneos(usuario);
    CREATE INDEX IX_Escaneos_FechaHora ON Escaneos(fechaHora DESC);
    CREATE INDEX IX_Escaneos_Procesado ON Escaneos(procesado);
END
GO

-- ================================================
-- DATOS INICIALES
-- ================================================

-- Insertar usuarios por defecto
IF NOT EXISTS (SELECT * FROM Usuarios WHERE usuario = 'admin')
BEGIN
    INSERT INTO Usuarios (usuario, password, grupo, activo, fechaCreacion, creadoPor)
    VALUES ('admin', 'admin123', 'administrador', 1, GETDATE(), 'SISTEMA');
END

IF NOT EXISTS (SELECT * FROM Usuarios WHERE usuario = 'operador')
BEGIN
    INSERT INTO Usuarios (usuario, password, grupo, activo, fechaCreacion, creadoPor)
    VALUES ('operador', 'operador123', 'operador', 1, GETDATE(), 'SISTEMA');
END

-- Insertar andenes iniciales (6 andenes)
DECLARE @i INT = 1;
WHILE @i <= 6
BEGIN
    IF NOT EXISTS (SELECT * FROM Andenes WHERE numero = @i)
    BEGIN
        INSERT INTO Andenes (numero, status, cantidad, limiteCamion, fechaCreacion, creadoPor)
        VALUES (@i, 'Disponible', 0, 30, GETDATE(), 'SISTEMA');
    END
    SET @i = @i + 1;
END

-- ================================================
-- STORED PROCEDURES
-- ================================================

-- Procedimiento para registrar historial
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_RegistrarHistorial')
    DROP PROCEDURE sp_RegistrarHistorial;
GO

CREATE PROCEDURE sp_RegistrarHistorial
    @andenId INT = NULL,
    @tipo NVARCHAR(50),
    @codigo NVARCHAR(100) = NULL,
    @accion NVARCHAR(255),
    @valorAnterior NVARCHAR(MAX) = NULL,
    @valorNuevo NVARCHAR(MAX) = NULL,
    @usuario NVARCHAR(50) = NULL,
    @metadatos NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO Historial (andenId, tipo, codigo, accion, valorAnterior, valorNuevo, usuario, fechaHora, metadatos)
    VALUES (@andenId, @tipo, @codigo, @accion, @valorAnterior, @valorNuevo, @usuario, GETDATE(), @metadatos);
END
GO

-- Procedimiento para obtener estadísticas del sistema
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_ObtenerEstadisticas')
    DROP PROCEDURE sp_ObtenerEstadisticas;
GO

CREATE PROCEDURE sp_ObtenerEstadisticas
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) as TotalAndenes,
        SUM(CASE WHEN status = 'Disponible' THEN 1 ELSE 0 END) as AndenesDisponibles,
        SUM(CASE WHEN status = 'Completado' THEN 1 ELSE 0 END) as AndenesCompletados,
        SUM(cantidad) as TotalPallets,
        SUM(limiteCamion) as CapacidadTotal,
        CASE 
            WHEN SUM(limiteCamion) > 0 THEN (SUM(cantidad) * 100.0 / SUM(limiteCamion))
            ELSE 0 
        END as PorcentajeOcupacion
    FROM Andenes;
END
GO

-- ================================================
-- VISTAS
-- ================================================

-- Vista consolidada de andenes con información de pallets
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_AndenesDetalle')
    DROP VIEW vw_AndenesDetalle;
GO

CREATE VIEW vw_AndenesDetalle
AS
SELECT 
    a.id,
    a.numero,
    a.status,
    a.cantidad,
    a.limiteCamion,
    a.numeroCajaCamion,
    a.destino,
    a.fechaCreacion,
    a.fechaModificacion,
    COUNT(p.id) as TotalPalletsRegistrados,
    CASE 
        WHEN a.limiteCamion > 0 THEN (a.cantidad * 100.0 / a.limiteCamion)
        ELSE 0 
    END as PorcentajeOcupacion
FROM Andenes a
LEFT JOIN Pallets p ON a.id = p.andenId AND p.activo = 1
GROUP BY a.id, a.numero, a.status, a.cantidad, a.limiteCamion, 
         a.numeroCajaCamion, a.destino, a.fechaCreacion, a.fechaModificacion;
GO

-- ================================================
-- PERMISOS Y SEGURIDAD
-- ================================================

-- Crear usuario de aplicación (ejecutar solo si no existe)
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'culligan_app')
BEGIN
    -- Descomentar y ajustar según tu configuración de seguridad
    -- CREATE LOGIN culligan_app WITH PASSWORD = 'your_secure_password_here';
END

IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'culligan_app')
BEGIN
    -- Descomentar y ajustar según tu configuración de seguridad
    -- CREATE USER culligan_app FOR LOGIN culligan_app;
    -- ALTER ROLE db_datareader ADD MEMBER culligan_app;
    -- ALTER ROLE db_datawriter ADD MEMBER culligan_app;
    -- GRANT EXECUTE ON SCHEMA::dbo TO culligan_app;
END

PRINT 'Base de datos CulliganEmbarques configurada correctamente.';
GO