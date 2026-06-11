# Autorización Backend – FS25 Farm Planner

## **Proyecto:** FS25 Farm Planner API

**Versión:** 1.0

**Fecha:** 2026-06-11

> **Nota de alcance — autorización por propiedad, sin RBAC.** Esta aplicación es multiusuario simple **sin sistema de roles** (ADR-009 de `docs/arquitectura-api.md`). No existe tabla `roles`, ni permisos persistidos, ni rol de administrador en la API. La autorización es exclusivamente **por propiedad (ownership)**: cada usuario solo accede a los recursos que le pertenecen. Este documento adapta la plantilla RBAC a ese modelo y deja indicado, en la sección [Pendientes / Riesgos](#pendientes--riesgos), qué se añadiría si en el futuro hicieran falta roles.

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

Se conserva el formato de la plantilla por homogeneidad documental, aunque en v1 los permisos no se persisten ni se evalúan dinámicamente: son implícitos en el diseño de cada handler.

```
resource:action:scope
```

**Componentes:**

- **Resource**: Recurso del dominio (`farms`, `fields`, `stables`, `machinery`, `animal-configs`, `calculator-states`, `user-settings`, `catalog`)
- **Action**: Operación (`create`, `read`, `update`, `delete`)
- **Scope**: Alcance del permiso. En v1 solo existen dos: `own` (recursos del usuario autenticado) y `public` (catálogos, legibles por cualquier usuario autenticado)

### Ejemplos

```ts
"fields:read:own"      // un usuario lee sus propios campos
"farms:delete:own"     // un usuario borra su propia partida
"catalog:read:public"  // cualquier usuario autenticado lee catálogos
```

> No existe `*:*:*`: no hay superusuario en la API. Los catálogos se administran fuera de la API, mediante seeds de migración.

### Scopes Disponibles

| Scope    | Descripción                                  | Regla de Filtro                                              |
| -------- | -------------------------------------------- | ----------------------------------------------------------- |
| own      | Recursos propios del usuario autenticado     | Directo o transitivo hasta `farms.user_id = currentUser.id` |
| public   | Catálogos del juego (solo lectura)           | Sin filtro de propiedad; requiere estar autenticado         |
| ~~all~~  | *No usado en v1*                             | —                                                           |
| ~~assigned~~ | *No usado en v1*                         | —                                                           |

---

## Definición de Roles del Sistema

**No aplica en v1.** No existe la tabla `roles` ni asignación de roles a usuarios. Todo usuario autenticado tiene exactamente el mismo conjunto de capacidades: gestionar sus propios recursos (`*:*:own`) y leer catálogos (`catalog:read:public`).

A efectos de trazabilidad, el único "rol" implícito es:

#### USUARIO_AUTENTICADO (implícito)

```json
{
  "code": "AUTHENTICATED_USER",
  "name": "Usuario autenticado",
  "description": "Cualquier cuenta con sesión válida. Acceso por propiedad a sus recursos y lectura de catálogos.",
  "is_system_role": true,
  "permissions": [
    "farms:create:own", "farms:read:own", "farms:update:own", "farms:delete:own",
    "fields:create:own", "fields:read:own", "fields:update:own", "fields:delete:own",
    "stables:create:own", "stables:read:own", "stables:update:own", "stables:delete:own",
    "machinery:create:own", "machinery:read:own", "machinery:update:own", "machinery:delete:own",
    "animal-configs:read:own", "animal-configs:update:own", "animal-configs:delete:own",
    "calculator-states:read:own", "calculator-states:update:own",
    "user-settings:read:own", "user-settings:update:own",
    "catalog:read:public"
  ]
}
```

**Reglas:**

- No hay bypass de validaciones para ninguna cuenta.
- La administración de catálogos (crops, animal_types, game_versions, game_constants) **no se expone en la API**; se realiza por seeds/migraciones con acceso directo a la base de datos.

---

## Permisos por Recurso

La columna de scope indica el único alcance disponible en v1. La tabla es plana porque solo hay un perfil de usuario.

### Recurso: `farms`

**Tabla:** `farms` — Regla de propiedad: `farms.user_id = currentUser.id`

| Permiso              | AUTHENTICATED_USER |
| -------------------- | ------------------ |
| farms:create:own     | ✅ |
| farms:read:own       | ✅ |
| farms:update:own     | ✅ |
| farms:delete:own     | ✅ |

### Recursos anidados: `fields`, `stables`, `machinery`, `animal-configs`, `calculator-states`

**Tablas:** `fields`, `stables`, `machinery`, `animal_calculator_configs`, `calculator_states`
**Regla de propiedad (transitiva):** `recurso.farm_id = :farmId` **AND** `farms.user_id = currentUser.id`

| Permiso                       | AUTHENTICATED_USER |
| ----------------------------- | ------------------ |
| `<recurso>`:create:own        | ✅ (no aplica a animal-configs/calculator-states, que usan upsert vía PUT) |
| `<recurso>`:read:own          | ✅ |
| `<recurso>`:update:own        | ✅ |
| `<recurso>`:delete:own        | ✅ (calculator-states no expone delete en v1) |

### Recurso: `user-settings`

**Tabla:** `user_settings` — Regla de propiedad: `user_settings.user_id = currentUser.id`

| Permiso                  | AUTHENTICATED_USER |
| ------------------------ | ------------------ |
| user-settings:read:own   | ✅ |
| user-settings:update:own | ✅ |

### Recurso: `catalog` (game-versions, crops, silage-crops, animal-types, constants)

**Tablas:** `game_versions`, `crops`, `silage_crops`, `animal_types`, `game_constants` — Solo lectura.

| Permiso              | AUTHENTICATED_USER |
| -------------------- | ------------------ |
| catalog:read:public  | ✅ |
| catalog:create/update/delete | ❌ (no existe endpoint; solo seeds) |

### Endpoints (resumen — contrato completo en `docs/openapi.yaml`)

- `GET/POST /api/v1/farms` → `farms:read:own` / `farms:create:own`
- `GET/PATCH/DELETE /api/v1/farms/{farmId}` → `farms:{read,update,delete}:own`
- `GET/POST /api/v1/farms/{farmId}/fields` y `.../fields/{fieldId}` → `fields:*:own`
- `GET/POST /api/v1/farms/{farmId}/stables` y `.../stables/{stableId}` → `stables:*:own`
- `GET/POST /api/v1/farms/{farmId}/machinery` y `.../machinery/{machineId}` → `machinery:*:own`
- `GET /api/v1/farms/{farmId}/animal-configs`, `GET/PUT/DELETE .../animal-configs/{species}` → `animal-configs:*:own`
- `GET/PUT /api/v1/farms/{farmId}/calculator-states/{toolKey}` → `calculator-states:*:own`
- `GET/PATCH /api/v1/me/settings` → `user-settings:*:own`
- `GET /api/v1/catalog/*` → `catalog:read:public`
- `POST /api/v1/auth/*`, `GET/PATCH /api/v1/auth/me` → sin permiso de recurso (identidad del propio usuario)
- `GET /api/v1/health` → público, sin autenticación

---

## Implementación de Scopes

### Scope `public`

```ts
// Catálogos: requiere autenticación, sin filtro de propiedad.
// El único parámetro es la versión de juego (por defecto, la activa).
const gameVersionId = query.gameVersionId ?? (await getActiveGameVersionId());
return catalogRepository.list(resource, gameVersionId);
```

### Scope `own` — propiedad directa

| Recurso | Regla de Propiedad |
| ------- | ------------------ |
| farms | `farms.user_id = currentUser.id` |
| user_settings | `user_settings.user_id = currentUser.id` |
| auth/me | El recurso ES el propio usuario (`users.id = currentUser.id`) |

```ts
// farms: el filtro de propiedad va en la propia query, nunca en post-filtrado.
const farm = await db.query.farms.findFirst({
  where: and(eq(farms.id, farmId), eq(farms.userId, currentUser.id)),
});
if (!farm) throw new NotFoundError('FARM_NOT_FOUND'); // 404, no 403 (ADR-005)
```

### Scope `own` — propiedad transitiva (recursos anidados)

| Recurso | Regla de Propiedad |
| ------- | ------------------ |
| fields | `fields.farm_id = :farmId` AND la farm es del usuario |
| stables | `stables.farm_id = :farmId` AND la farm es del usuario |
| machinery | `machinery.farm_id = :farmId` AND la farm es del usuario |
| animal_calculator_configs | `... .farm_id = :farmId` AND la farm es del usuario |
| calculator_states | `... .farm_id = :farmId` AND la farm es del usuario |

```ts
// El plugin farm-scope resuelve y valida la farm UNA vez por request anidada.
// Los handlers de recursos hijos confían en request.farm y filtran por farm_id.
const field = await db.query.fields.findFirst({
  where: and(eq(fields.id, fieldId), eq(fields.farmId, request.farm.id)),
});
if (!field) throw new NotFoundError('FIELD_NOT_FOUND'); // 404
```

---

## Middleware y Validaciones

En lugar de un `checkPermission('resource','action','scope')` dinámico (innecesario sin roles), la autorización se implementa con **dos plugins de Fastify** encadenados:

```ts
// 1) Plugin auth: verifica el access token y decora request.user.
//    Registrado globalmente salvo lista blanca (auth/register, auth/login,
//    auth/refresh, auth/logout, health). logout solo usa el refresh token
//    del cuerpo, por lo que no exige access token.
fastify.addHook('onRequest', authenticate); // 401 TOKEN_EXPIRED / UNAUTHORIZED

// 2) Plugin farm-scope: SOLO en rutas bajo /farms/:farmId.
//    Resuelve la farm verificando propiedad y la decora en request.farm.
async function farmScope(request) {
  const farm = await farmsRepository.findOwned(request.params.farmId, request.user.id);
  if (!farm) throw new NotFoundError('FARM_NOT_FOUND'); // 404 (no revela existencia)
  request.farm = farm;
}
```

**Reglas especiales:**

- **404 en vez de 403 (ADR-005):** acceder a un recurso de otro usuario es indistinguible de uno inexistente. `403` no se emite en v1.
- **El filtro de propiedad va siempre dentro de la query** (`WHERE ... AND user_id/farm_id = ...`), nunca como post-filtrado en memoria, para evitar fugas por error de lógica.
- **Scoping centralizado:** ningún handler anidado consulta por `params.farmId` directamente; usa `request.farm.id` provisto por el plugin. Esto hace imposible olvidar la verificación de propiedad de la farm en un endpoint nuevo.
- **Sin superusuario:** no hay rama de bypass; el código de autorización es uniforme para toda cuenta.

---

## Pendientes / Riesgos

- **Olvidar el scoping en un handler nuevo.** *Mitigación:* el plugin `farm-scope` es obligatorio para todo el árbol `/farms/:farmId/*` y provee `request.farm`; los repositorios de recursos hijos exigen `farmId` como argumento. Reforzar con tests de integración que intenten acceso cruzado entre dos usuarios (deben devolver 404).
- **Enumeración de recursos.** *Mitigación:* UUID v7 no adivinable + respuesta 404 uniforme; los catálogos (públicos) no exponen datos de usuarios.
- **Catálogos sin endpoint de escritura.** Es una decisión, no un olvido: actualizarlos requiere acceso a BD (seed/migración). *Riesgo futuro:* si se quiere administración de catálogos vía API, no hay modelo de permisos para limitarla.
- **Camino de evolución a RBAC (si llega a necesitarse):**
  1. Añadir tablas `roles` (con `permissions JSONB`) y `user_roles` (o columna `role_id` en `users`).
  2. Introducir un rol `SUPER_ADMIN` con `*:*:*` para administrar catálogos y `game_versions` vía API.
  3. Sustituir la autorización implícita por un `checkPermission(resource, action, scope)` evaluado contra los permisos del rol, **manteniendo** la verificación de propiedad como capa adicional para scope `own`.
  4. Reservar `403 FORBIDDEN` para "autenticado pero sin permiso" (recurso existe pero el rol no alcanza), distinto del `404` de ownership actual.

---

## Casos de Uso por Endpoint

| Endpoint | Actor | Permiso | Resultado |
| -------- | ----- | ------- | --------- |
| `GET /api/v1/farms` | Usuario A | farms:read:own | ✅ Lista solo las farms de A |
| `GET /api/v1/farms/{idDeB}` | Usuario A (farm de B) | farms:read:own | ❌ `404 FARM_NOT_FOUND` (no revela que existe) |
| `POST /api/v1/farms/{farmA}/fields` | Usuario A | fields:create:own | ✅ Crea campo en su farm |
| `PATCH /api/v1/farms/{farmA}/fields/{idDeB}` | Usuario A (field de B) | fields:update:own | ❌ `404 FIELD_NOT_FOUND` |
| `DELETE /api/v1/farms/{farmA}` | Usuario A | farms:delete:own | ✅ Borra en cascada fields/stables/machinery/configs |
| `PUT /api/v1/farms/{farmA}/animal-configs/cow` | Usuario A | animal-configs:update:own | ✅ Upsert de la config de vacas |
| `GET /api/v1/catalog/crops` | Cualquier usuario autenticado | catalog:read:public | ✅ Catálogo de la versión activa |
| `GET /api/v1/catalog/crops` | Sin token | — | ❌ `401 UNAUTHORIZED` |
| `PATCH /api/v1/me/settings` con `activeFarmId` de B | Usuario A | user-settings:update:own | ❌ `422 FARM_NOT_OWNED` |
| `GET /api/v1/health` | Cualquiera (sin token) | — | ✅ Público (healthcheck) |

---

**Última actualización:** 2026-06-11  **Versión:** 1.0
