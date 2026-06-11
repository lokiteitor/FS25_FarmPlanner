# RBAC Backend – Plantilla de Referencia

## **Proyecto:**&#x20;

**Versión:** \<x.y>

**Fecha:**&#x20;

## 📋 Tabla de Contenidos

1. [Estructura de Permisos](#estructura-de-permisos)
2. [Definición de Roles del Sistema](#definición-de-roles-del-sistema)
3. [Permisos por Recurso](#permisos-por-recurso)
4. [Implementación de Scopes](#implementación-de-scopes)
5. [Middleware y Validaciones](#middleware-y-validaciones)
6. [Pendientes / Riesgos](#pendientes--riesgos)
7. [Casos de Uso por Endpoint](#casos-de-uso-por-endpoint)

---

## Estructura de Permisos

### Formato Base

```
resource:action:scope
```

**Componentes:**

- **Resource**: Recurso del dominio (ej. users, orders, vehicles)
- **Action**: Operación (create, read, update, delete, export, etc.)
- **Scope**: Alcance del permiso (all, assigned, own)

### Ejemplos

```ts
"resource:read:all"
"resource:update:assigned"
"*:*:*" // Solo SUPER_ADMIN
```

### Scopes Disponibles

| Scope    | Descripción        | Regla de Filtro    |
| -------- | ------------------ | ------------------ |
| all      | Acceso total       | Sin filtro         |
| assigned | Recursos asignados | Regla por relación |
| own      | Recursos propios   | userId / ownerId   |

---

## Definición de Roles del Sistema

### Tabla `roles`

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  permissions JSONB NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Roles Base

#### SUPER\_ADMIN

```json
{
  "code": "SUPER_ADMIN",
  "permissions": ["*:*:*"]
}
```

**Reglas:**

- Bypass completo de validaciones
- Puede administrar roles del sistema

---

#### \<ROLE\_CODE>

```json
{
  "code": "<ROLE_CODE>",
  "name": "<Nombre legible>",
  "description": "<Descripción>",
  "is_system_role": true | false,
  "permissions": []
}
```

---

## Permisos por Recurso

###

**Tabla:** `<tabla>`

| Permiso               | SUPER\_ADMIN | ADMIN | OTRO\_ROL |
| --------------------- | ------------ | ----- | --------- |
| resource\:create\:all | ✅            | ✅     | ❌         |
| resource\:read\:all   | ✅            | ✅     | ✅         |
| resource\:update\:own | ✅            | ✅     | ✅         |

### Endpoints

- `GET /api/<resource>` → Permiso requerido
- `POST /api/<resource>` → Permiso requerido

### Implementación de Scope

```ts
// Ejemplo de filtro por scope
if (scope === 'assigned') {
  // lógica de asignación
}
```

---

## Implementación de Scopes

### Scope `all`

```ts
// Sin filtros adicionales
```

### Scope `assigned`

| Recurso | Regla de Asignación |
| ------- | ------------------- |
|         |                     |

```ts
// Lógica assigned
```

### Scope `own`

| Recurso | Regla de Propiedad |
| ------- | ------------------ |
|         |                    |

```ts
// Lógica own
```

---

## Middleware y Validaciones

```ts
checkPermission('resource', 'action', 'scope');
```

**Reglas especiales:**

- SUPER\_ADMIN ignora validaciones
- ADMIN no puede modificar system roles

---

## Pendientes / Riesgos

-

---

## Casos de Uso por Endpoint

| Endpoint  | Rol   | Permiso             | Resultado |
| --------- | ----- | ------------------- | --------- |
| GET /api/ | ADMIN | resource\:read\:all | ✅         |
| GET /api/ | USER  | resource\:read\:own | ✅         |

---

**Última actualización:**  **Versión:** \<x.y>

