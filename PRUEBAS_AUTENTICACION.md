# 🧪 PRUEBAS DE AUTENTICACIÓN - SYST

## ✅ Cambios Realizados

### 1. **Mejora del Servicio de Autenticación**
- ✅ Agregada validación para evitar emails duplicados
- ✅ Manejo de errores mejorado con `ConflictException`
- ✅ Verificación de usuario existente antes de crear

### 2. **Scripts de Prueba Creados**
- ✅ `test-auth.sh` - Script completo de pruebas de autenticación
- ✅ `iniciar-y-probar.sh` - Script que inicia servicios y ejecuta pruebas

---

## 🚀 CÓMO PROBAR EL REGISTRO Y LOGIN

### Opción 1: Usar el Script Automático (Recomendado)

```bash
cd /home/bmrx/Desktop/SYSTINF
./test-auth.sh
```

Este script:
1. ✅ Verifica que el backend esté corriendo
2. ✅ Prueba el registro de usuario
3. ✅ Prueba el login
4. ✅ Prueba login con contraseña incorrecta
5. ✅ Prueba registro con email duplicado

### Opción 2: Prueba Manual con curl

**1. Registrar un usuario:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+1234567890"
  }'
```

**Respuesta esperada:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+1234567890",
    "role": "BUSINESS_OWNER"
  }
}
```

**2. Hacer login:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

**Respuesta esperada:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "role": "BUSINESS_OWNER"
  }
}
```

---

## 🔍 VERIFICAR PROBLEMAS

### Error: "User with this email already exists"

**Causa:** Intentas registrar un email que ya existe.

**Solución:**
- Usa un email diferente
- O elimina el usuario existente de la base de datos

### Error: "Invalid credentials"

**Causa:** Email o contraseña incorrectos.

**Solución:**
- Verifica que el email y contraseña sean correctos
- Asegúrate de que el usuario exista (registrado previamente)

### Error: "CORS request did not succeed"

**Causa:** El backend no está corriendo.

**Solución:**
```bash
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev:nocheck
```

Espera a ver:
```
🔓 CORS: Allowing all origins in development mode
✅ Database connected
🚀 SYST Backend running on: http://localhost:3001/api/v1
```

### Error: "Database connection failed"

**Causa:** Docker no está corriendo o PostgreSQL no está iniciado.

**Solución:**
```bash
# Iniciar Docker (necesitas permisos o usar sudo)
cd /home/bmrx/Desktop/SYSTINF
sudo docker-compose up -d postgres redis qdrant

# Verificar que estén corriendo
docker ps | grep syst
```

---

## 📋 CHECKLIST DE PRUEBAS

Antes de probar, verifica:

- [ ] Docker está corriendo (`docker ps` muestra contenedores)
- [ ] Backend está corriendo (`curl http://localhost:3001/api/v1` responde)
- [ ] Base de datos está conectada (ver mensaje "✅ Database connected" en logs del backend)

---

## 🧪 PRUEBAS INCLUIDAS EN EL SCRIPT

El script `test-auth.sh` ejecuta estas pruebas:

1. **Prueba de Registro**
   - Crea un usuario nuevo
   - Verifica que se reciba un token
   - Verifica que se reciba la información del usuario

2. **Prueba de Login**
   - Inicia sesión con credenciales válidas
   - Verifica que se reciba un token
   - Verifica que se reciba la información del usuario

3. **Prueba de Login con Contraseña Incorrecta**
   - Intenta login con contraseña incorrecta
   - Verifica que se rechace correctamente (HTTP 401)

4. **Prueba de Registro con Email Duplicado**
   - Intenta registrar un email que ya existe
   - Verifica que se rechace correctamente (HTTP 409)

---

## 📝 ESTRUCTURA DE DATOS

### RegisterDto (Registro)
```typescript
{
  email: string;        // Requerido, debe ser email válido
  password: string;     // Requerido, mínimo 6 caracteres
  firstName: string;    // Requerido
  lastName: string;     // Requerido
  phone?: string;       // Opcional
}
```

### LoginDto (Login)
```typescript
{
  email: string;        // Requerido, debe ser email válido
  password: string;     // Requerido
}
```

### Respuesta de Registro/Login
```typescript
{
  access_token: string; // JWT token para autenticación
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: "ADMIN" | "BUSINESS_OWNER" | "STAFF";
    createdAt: string;
    updatedAt: string;
  }
}
```

---

## 🔐 SEGURIDAD

- ✅ Las contraseñas se hashean con bcrypt (10 rounds)
- ✅ Los tokens JWT se generan con el secreto configurado
- ✅ Los emails son únicos en la base de datos
- ✅ CORS configurado para desarrollo

---

## 🆘 SI ALGO NO FUNCIONA

1. **Verifica los logs del backend:**
   ```bash
   # Los logs deberían mostrar:
   # - "🔓 CORS: Allowing all origins in development mode"
   # - "✅ Database connected"
   # - "🚀 SYST Backend running on: http://localhost:3001/api/v1"
   ```

2. **Verifica la base de datos:**
   ```bash
   # Conectar a PostgreSQL
   docker exec -it syst-postgres psql -U syst_user -d syst_db
   
   # Ver usuarios
   SELECT id, email, "firstName", "lastName" FROM users;
   ```

3. **Reinicia todo:**
   ```bash
   # Detener backend (Ctrl+C)
   # Detener Docker
   docker-compose down
   
   # Reiniciar Docker
   docker-compose up -d postgres redis qdrant
   
   # Reiniciar backend
   cd apps/backend && pnpm dev:nocheck
   ```

---

**¡Las pruebas están listas para ejecutarse!** 🚀

Ejecuta `./test-auth.sh` para probar todo el flujo de autenticación.



























