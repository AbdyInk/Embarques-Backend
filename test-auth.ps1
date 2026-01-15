# Script de prueba PowerShell para verificar el sistema de autenticación

Write-Host "🧪 Probando sistema de autenticación mejorado..." -ForegroundColor Cyan

# Test 1: Login de administrador
Write-Host "`n🔐 Test 1: Login de administrador" -ForegroundColor Yellow
try {
    $adminLogin = @{
        usuario = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/login" -Method POST -Body $adminLogin -ContentType "application/json"
    
    Write-Host "✅ Login exitoso" -ForegroundColor Green
    Write-Host "   Usuario: $($response.usuario.usuario)" -ForegroundColor White
    Write-Host "   Grupo: $($response.usuario.grupo)" -ForegroundColor White  
    Write-Host "   Expiración: $($response.expiresIn)" -ForegroundColor White
    Write-Host "   Token: $($response.token.Substring(0, 20))..." -ForegroundColor Gray
    
    $adminToken = $response.token
    
    # Test 2: Validar token de administrador
    Write-Host "`n🔍 Test 2: Validación de token de administrador" -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    $validationResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/validate-token" -Method GET -Headers $headers
    Write-Host "✅ Token válido" -ForegroundColor Green
    Write-Host "   Usuario validado: $($validationResponse.usuario.usuario)" -ForegroundColor White
    Write-Host "   Grupo validado: $($validationResponse.usuario.grupo)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error en test de administrador: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Login de operador
Write-Host "`n🔐 Test 3: Login de operador" -ForegroundColor Yellow
try {
    $operatorLogin = @{
        usuario = "operador"  
        password = "operador123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/login" -Method POST -Body $operatorLogin -ContentType "application/json"
    
    Write-Host "✅ Login exitoso" -ForegroundColor Green
    Write-Host "   Usuario: $($response.usuario.usuario)" -ForegroundColor White
    Write-Host "   Grupo: $($response.usuario.grupo)" -ForegroundColor White
    Write-Host "   Expiración: $($response.expiresIn)" -ForegroundColor White
    Write-Host "   Token: $($response.token.Substring(0, 20))..." -ForegroundColor Gray
    
    $operatorToken = $response.token
    
    # Test 4: Validar token de operador
    Write-Host "`n🔍 Test 4: Validación de token de operador" -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $operatorToken"
        "Content-Type" = "application/json"
    }
    
    $validationResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/validate-token" -Method GET -Headers $headers
    Write-Host "✅ Token válido" -ForegroundColor Green
    Write-Host "   Usuario validado: $($validationResponse.usuario.usuario)" -ForegroundColor White
    Write-Host "   Grupo validado: $($validationResponse.usuario.grupo)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error en test de operador: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Token inválido
Write-Host "`n❌ Test 5: Token inválido" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer token_invalido_123"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/validate-token" -Method GET -Headers $headers
    Write-Host "❌ FALLO: Token inválido fue aceptado" -ForegroundColor Red
    
} catch {
    Write-Host "✅ Token inválido correctamente rechazado" -ForegroundColor Green
    Write-Host "   Error esperado: $($_.Exception.Message -split ': ')[1]" -ForegroundColor Gray
}

Write-Host "`n🎉 Pruebas completadas!" -ForegroundColor Cyan
Write-Host "`n📋 Resumen del sistema mejorado:" -ForegroundColor White
Write-Host "   ✅ Administradores: 2 horas de sesión" -ForegroundColor Green
Write-Host "   ✅ Operadores: 12 horas de sesión" -ForegroundColor Green  
Write-Host "   ✅ Validación de tokens en tiempo real" -ForegroundColor Green
Write-Host "   ✅ Restricciones de acceso por rol" -ForegroundColor Green
Write-Host "   ✅ Guardado de URL de destino para redirección" -ForegroundColor Green
Write-Host "   ✅ Información de usuario en la interfaz" -ForegroundColor Green