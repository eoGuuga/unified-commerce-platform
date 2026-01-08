# ⚡ Comandos Rápidos - Unified Commerce Platform

> **Guia rápido de comandos para desenvolvimento**

---

## 🔧 Solução PowerShell

**Se `npm` não funcionar, use `npm.cmd`:**

```powershell
npm.cmd run start:dev
```

**Ou criar alias:**
```powershell
Set-Alias npm npm.cmd
```

---

## 🚀 Comandos Essenciais

### Docker
```powershell
# Verificar containers
docker ps

# Iniciar PostgreSQL + Redis
docker-compose up -d postgres redis

# Ver logs
docker-compose logs -f postgres
```

---

### Backend
```powershell
cd backend

# Instalar dependências
npm.cmd install

# Iniciar desenvolvimento
npm.cmd run start:dev

# Testar ACID
npm.cmd run test:acid

# Cadastrar produtos
npm.cmd run seed:mae
```

---

### Frontend
```powershell
cd frontend

# Instalar dependências
npm.cmd install

# Iniciar desenvolvimento
npm.cmd run dev
```

---

## 🌐 URLs

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3001/api/v1
- **Health Check:** http://localhost:3001/api/v1/health
- **PDV:** http://localhost:3000/pdv
- **Admin:** http://localhost:3000/admin

---

## 📋 Checklist Rápido

### Setup Inicial:
```powershell
# 1. Docker
docker-compose up -d postgres redis

# 2. Backend (Terminal 1)
cd backend
npm.cmd run start:dev

# 3. Frontend (Terminal 2)
cd frontend
npm.cmd run dev
```

### Testes:
```powershell
# Testar ACID
cd backend
npm.cmd run test:acid

# Cadastrar produtos
cd backend
npm.cmd run seed:mae
```

---

## 🔍 Troubleshooting

### Backend não inicia
```powershell
# Verificar Docker
docker ps

# Verificar .env
cat backend\.env

# Verificar porta
netstat -ano | findstr :3001
```

### Frontend não conecta
```powershell
# Verificar backend
curl http://localhost:3001/api/v1/health

# Verificar .env.local
cat frontend\.env.local
```

---

**Última atualização:** 07/01/2025
