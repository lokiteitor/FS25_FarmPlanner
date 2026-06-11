# 📚 Documentación Base de Datos — {{NOMBRE\_DEL\_SISTEMA}}

## {{Descripción corta del sistema / contexto general}}

---

## 📋 Información General

### Componentes de Datos

Describir los componentes de datos que conforman la arquitectura:

- **Base de datos principal**: {{motor / propósito}}
- **Bases de datos auxiliares**: {{si aplica}}
- **Cache / Search / Otros**: {{Redis, Elasticsearch, etc.}}

> Alcance del documento (qué sí y qué no cubre).

---

### {{Motor Principal}} ({{tipo de base de datos}})

- **Motor**: {{ej. PostgreSQL 16}}
- **Encoding**: {{UTF-8}}
- **Host**: {{host}}
- **Puerto**: {{puerto}}
- **Usuario**: {{usuario}}
- **Schema**: {{schema}}
- **Estrategia de IDs**: {{UUID, SERIAL, etc.}}

**Nombre de base de datos**:

- {{local / producción / multi-tenant}}

---

### Otras Bases de Datos / Servicios

#### {{Nombre}}

- **Motor**: {{versión}}
- **Uso**: {{propósito}}
- **Colecciones / Índices clave**:
  - {{lista}}

---

## 🎯 Propósito del Modelo de Datos

Descripción de los dominios que cubre la base de datos:

- ✅ {{Dominio 1}}
- ✅ {{Dominio 2}}
- ✅ {{Dominio N}}

---

## 📊 Estadísticas Generales

```
Total de Tablas: {{N}}
Total de Enums: {{N}}
Total de Índices: {{N}}
Total de Relaciones (FK): {{N}}
```

---

## 🗂️ Estructura de Base de Datos

### Fuente de Verdad del Esquema

- **ORM / DDL**: {{ruta o herramienta}}
- **Migraciones**: {{ruta}}
- **Seeds**: {{ruta}}

---

## 🔐 {{Nombre del Módulo}}

### {{#}} {{NOMBRE\_DE\_TABLA}}

**Descripción**: {{descripción funcional de la tabla}}

```sql
-- Enums (si aplica)
CREATE TYPE {{ENUM_NAME}} AS ENUM (...);

-- Tabla
CREATE TABLE {{table_name}} (
    id {{tipo}} PRIMARY KEY,
    {{campo}} {{tipo}} {{constraints}},
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

#### DDL de Índices y Constraints

```sql
-- Índices
CREATE INDEX {{index_name}} ON {{table}}({{campo}});
CREATE UNIQUE INDEX {{unique_index_name}} ON {{table}}({{campo}});

-- Constraints
ALTER TABLE {{table}} ADD CONSTRAINT {{constraint_name}} FOREIGN KEY ({{fk_field}}) REFERENCES {{ref_table}}({{ref_field}});
ALTER TABLE {{table}} ADD CONSTRAINT {{constraint_name}} CHECK ({{condition}});
ALTER TABLE {{table}} ADD CONSTRAINT {{constraint_name}} UNIQUE ({{campo}});
```

#### Enums Relacionados

##### {{ENUM\_NAME}}

| Valor     | Descripción               |
| --------- | ------------------------- |
| {{VALUE}} | {{significado funcional}} |
| {{VALUE}} | {{significado funcional}} |

#### Diccionario de Campos

| Campo     | Tipo     | Descripción        |
| --------- | -------- | ------------------ |
| {{campo}} | {{tipo}} | {{para qué sirve}} |
| {{campo}} | {{tipo}} | {{para qué sirve}} |

#### Reglas de Negocio

- {{regla}}
- {{regla}}

---

## 🧩 Relaciones Entre Tablas

```mermaid
erDiagram
    {{TABLA_A}} ||--o{ {{TABLA_B}} : "FK"
```

---

## 📈 Métricas y Crecimiento

| Tabla     | Registros/día | Retención | Tamaño estimado | Crecimiento anual |
| --------- | ------------- | --------- | --------------- | ----------------- |
| {{tabla}} | {{valor}}     | {{valor}} | {{valor}}       | {{valor}}         |

---

## 🚀 Operación y Mantenimiento

### Migraciones

- {{estrategia}}

### Retención / Limpieza

- {{política}}

### Consideraciones de Performance

- {{índices críticos}}

---

## 📌 Notas y Decisiones de Diseño

- {{decisión}}
- {{trade-off}}

