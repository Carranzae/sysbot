# 🐳 INSTALAR DOCKER EN KALI LINUX

## 📋 INSTALACIÓN COMPLETA DE DOCKER

### 1️⃣ Actualizar el sistema

```bash
sudo apt update
sudo apt upgrade -y
```

### 2️⃣ Instalar Docker

```bash
# Instalar Docker desde los repositorios de Kali
sudo apt install -y docker.io

# Habilitar el servicio Docker
sudo systemctl enable docker --now

# Verificar que Docker esté corriendo
sudo systemctl status docker
```

### 3️⃣ Instalar Docker Compose

```bash
# Instalar Docker Compose
sudo apt install -y docker-compose

# Verificar instalación
docker-compose --version
```

### 4️⃣ Agregar tu usuario al grupo docker (opcional pero recomendado)

```bash
# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Aplicar cambios (necesitas cerrar sesión y volver a entrar)
newgrp docker

# Verificar que puedes usar docker sin sudo
docker ps
```

---

## ✅ VERIFICAR INSTALACIÓN

```bash
# Ver versión de Docker
docker --version

# Ver versión de Docker Compose
docker-compose --version

# Ver contenedores corriendo
docker ps

# Ver estado del servicio
sudo systemctl status docker
```

---

## 🚀 INICIAR SERVICIOS DEL PROYECTO

Una vez Docker esté instalado:

```bash
cd /home/bmrx/Desktop/SYSTINF

# Iniciar servicios
docker-compose up -d postgres redis qdrant

# Verificar que estén corriendo
docker ps
```

Deberías ver:
- ✅ syst-postgres (puerto 5432)
- ✅ syst-redis (puerto 6379)
- ✅ syst-qdrant (puerto 6333)

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error: "Cannot connect to Docker daemon"

```bash
# Iniciar Docker
sudo systemctl start docker

# Verificar estado
sudo systemctl status docker
```

### Error: "Permission denied"

```bash
# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Cerrar sesión y volver a entrar, o ejecutar:
newgrp docker
```

### Docker no inicia

```bash
# Ver logs
sudo journalctl -u docker

# Reiniciar Docker
sudo systemctl restart docker
```

---

## 📝 COMANDOS ÚTILES DE DOCKER

```bash
# Ver contenedores corriendo
docker ps

# Ver todos los contenedores (incluso detenidos)
docker ps -a

# Ver logs de un contenedor
docker logs <container_name>

# Detener todos los contenedores
docker stop $(docker ps -q)

# Eliminar todos los contenedores detenidos
docker rm $(docker ps -a -q)

# Ver imágenes
docker images

# Limpiar sistema (cuidado, elimina todo lo no usado)
docker system prune -a
```

---

## ✅ SIGUIENTE PASO

Después de instalar Docker, continúa con los pasos de inicio del sistema en `COMANDOS_INICIO.md`
