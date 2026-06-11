# 🌱 Catálogo de Seeds — FS25 Farm Planner

## Datos seed de los catálogos versionados del juego (cultivos, ensilajes, tipos de animales y constantes de balance). **Fuente de verdad autocontenida**: este documento reemplaza la antigua dependencia de los valores embebidos en el prototipo (`planner/app/utils/*.ts`). El seeder de `api/src/db/seeds/` consume estos valores; no es necesario abrir el prototipo.

**Versión:** 1.0 · **Fecha:** 2026-06-11

---

## 📋 Información General

- **Destino**: tablas `game_versions`, `crops`, `silage_crops`, `animal_types`, `game_constants` (ver esquema en `docs/base-de-datos.md`).
- **Versionado**: todos los catálogos cuelgan de una `game_version`. Un parche de balance = nueva `game_version` + re-seed completo; las versiones anteriores quedan intactas.
- **Validación**: cada bloque JSONB (`monthly_rates`, `feed_options`, `value` de constantes) se valida con zod en el seed; el seed falla si no valida (ver `docs/plan-implementacion.md` H2.4).
- **Precisión**: los decimales largos (p. ej. `0.9523809524`, `58.8235294117647`) se escriben como número JSON, nunca como string. La BD usa `numeric`; el motor opera en `number` (float) con tolerancias.
- **`name_en`** de cultivos: etiquetas estándar en inglés derivadas del slug (no son datos de balance; pueden ajustarse sin impacto en cálculos).

### Correcciones aplicadas respecto al prototipo

Estos valores corrigen deliberadamente al prototipo (no portar tal cual):

1. **Cabra con escalares de dificultad propios.** En el prototipo la calculadora de cabras reutilizaba `difficultyScalars.Sheep`. Aquí la cabra tiene sus propios escalares (idénticos en v1: 3.0/1.8/1.0, pero independientes).
2. **Precios de venta a columna `sale_price`.** Estaban hardcodeados en funciones: vaca 3500, búfalo 3000, cerdo 2500, caballo 5000.
3. **Oveja y cabra vendibles** (`sale_price = 1000`). El prototipo no las modelaba como vendibles; por decisión de producto ambas producen su producto (lana/leche) **y** se pueden vender.
4. **Mes corregido `AGU` → `AUG`** en `milk_price_scalars.monthly` (el resto de meses están en inglés).
5. **Caballo con `sellCount` y `grassHarvests`** en el contrato (ver `docs/openapi.yaml`); el caballo solo se vende y necesita paja + comida.

---

## 1. `game_versions`

Una versión activa en v1.

| label | is_active | released_at |
|---|---|---|
| FS25 1.0 | true | null |

```json
[
  { "label": "FS25 1.0", "isActive": true, "releasedAt": null }
]
```

---

## 2. `crops` (25)

`yield_per_m2` en L/m² · `base_price` en $/L · `max_price_factor` multiplicador del precio máximo estacional · `seed_rate` en L/m² · `weight_per_liter` en t/m³.

| slug | name_es | name_en | yield_per_m2 | base_price | max_price_factor | seed_rate | weight_per_liter |
|---|---|---|---|---|---|---|---|
| barley | Cebada | Barley | 0.96 | 0.313 | 1.21 | 0.0265 | 0.68 |
| onion | Cebollas | Onion | 7.0 | 0.75 | 3.0 | 0.0005 | 1.0 |
| redbeet | Remolacha | Red Beet | 5.78 | 0.122 | 1.15 | 0.004 | 0.52 |
| canola | Canola | Canola | 0.58 | 0.603 | 1.21 | 0.0049 | 0.6 |
| carrot | Zanahoria | Carrot | 7.7 | 0.132 | 1.15 | 0.001 | 0.64 |
| corn | Maíz | Maize | 0.92 | 0.38 | 1.33 | 0.0053 | 0.8 |
| cotton | Algodón | Cotton | 0.497 | 1.252 | 1.11 | 0.005 | 0.23 |
| grape | Uva | Grape | 1.84 | 0.603 | 1.2 | 0.0 | 0.6 |
| green_beans | Judías Verdes | Green Beans | 0.6975 | 0.72 | 1.05 | 0.028 | 0.42 |
| oat | Avena | Oat | 0.57 | 0.532 | 1.21 | 0.034 | 0.5 |
| olive | Oliva | Olive | 1.84 | 0.603 | 1.2 | 0.0 | 0.6 |
| parsnip | Chirivía | Parsnip | 6.95 | 0.131 | 1.15 | 0.001 | 0.58 |
| pea | Guisantes | Pea | 0.96 | 1.04 | 1.1 | 0.025 | 0.72 |
| potato | Patatas | Potato | 4.13 | 0.222 | 1.15 | 0.3733 | 0.75 |
| rice_long_grain | Arroz (Largo) | Rice (Long Grain) | 0.9 | 0.53 | 1.05 | 0.05 | 0.77 |
| rice | Arroz (Corto) | Rice | 0.66 | 1.1 | 1.05 | 0.015625 | 0.79 |
| sorghum | Sorgo | Sorghum | 0.82 | 0.43 | 1.22 | 0.0035 | 0.85 |
| soybean | Soja | Soybean | 0.45 | 0.778 | 1.59 | 0.0214 | 0.7 |
| spinach | Espinacas | Spinach | 2.31 | 0.22 | 1.05 | 0.001 | 0.13 |
| sugarbeet | Remolacha Azucarera | Sugar Beet | 5.78 | 0.172 | 1.15 | 0.0034 | 0.7 |
| sugarcane | Caña de Azúcar | Sugarcane | 11.34 | 0.119 | 1.05 | 1.2 | 0.18 |
| sunflower | Girasol | Sunflower | 0.52 | 0.673 | 1.2 | 0.0143 | 0.35 |
| wheat | Trigo | Wheat | 0.89 | 0.337 | 1.21 | 0.0308 | 0.78 |
| grass | Hierba | Grass | 4.37 | 0.045 | 1.11 | 0.012 | 0.3 |
| poplar | Álamo (Astillas de Madera) | Poplar (Wood Chips) | 19.881 | 0.32 | 1.69 | 0.15 | 0.35 |

```json
[
  { "slug": "barley", "nameEs": "Cebada", "nameEn": "Barley", "yieldPerM2": 0.96, "basePrice": 0.313, "maxPriceFactor": 1.21, "seedRate": 0.0265, "weightPerLiter": 0.68 },
  { "slug": "onion", "nameEs": "Cebollas", "nameEn": "Onion", "yieldPerM2": 7.0, "basePrice": 0.75, "maxPriceFactor": 3.0, "seedRate": 0.0005, "weightPerLiter": 1.0 },
  { "slug": "redbeet", "nameEs": "Remolacha", "nameEn": "Red Beet", "yieldPerM2": 5.78, "basePrice": 0.122, "maxPriceFactor": 1.15, "seedRate": 0.004, "weightPerLiter": 0.52 },
  { "slug": "canola", "nameEs": "Canola", "nameEn": "Canola", "yieldPerM2": 0.58, "basePrice": 0.603, "maxPriceFactor": 1.21, "seedRate": 0.0049, "weightPerLiter": 0.6 },
  { "slug": "carrot", "nameEs": "Zanahoria", "nameEn": "Carrot", "yieldPerM2": 7.7, "basePrice": 0.132, "maxPriceFactor": 1.15, "seedRate": 0.001, "weightPerLiter": 0.64 },
  { "slug": "corn", "nameEs": "Maíz", "nameEn": "Maize", "yieldPerM2": 0.92, "basePrice": 0.38, "maxPriceFactor": 1.33, "seedRate": 0.0053, "weightPerLiter": 0.8 },
  { "slug": "cotton", "nameEs": "Algodón", "nameEn": "Cotton", "yieldPerM2": 0.497, "basePrice": 1.252, "maxPriceFactor": 1.11, "seedRate": 0.005, "weightPerLiter": 0.23 },
  { "slug": "grape", "nameEs": "Uva", "nameEn": "Grape", "yieldPerM2": 1.84, "basePrice": 0.603, "maxPriceFactor": 1.2, "seedRate": 0.0, "weightPerLiter": 0.6 },
  { "slug": "green_beans", "nameEs": "Judías Verdes", "nameEn": "Green Beans", "yieldPerM2": 0.6975, "basePrice": 0.72, "maxPriceFactor": 1.05, "seedRate": 0.028, "weightPerLiter": 0.42 },
  { "slug": "oat", "nameEs": "Avena", "nameEn": "Oat", "yieldPerM2": 0.57, "basePrice": 0.532, "maxPriceFactor": 1.21, "seedRate": 0.034, "weightPerLiter": 0.5 },
  { "slug": "olive", "nameEs": "Oliva", "nameEn": "Olive", "yieldPerM2": 1.84, "basePrice": 0.603, "maxPriceFactor": 1.2, "seedRate": 0.0, "weightPerLiter": 0.6 },
  { "slug": "parsnip", "nameEs": "Chirivía", "nameEn": "Parsnip", "yieldPerM2": 6.95, "basePrice": 0.131, "maxPriceFactor": 1.15, "seedRate": 0.001, "weightPerLiter": 0.58 },
  { "slug": "pea", "nameEs": "Guisantes", "nameEn": "Pea", "yieldPerM2": 0.96, "basePrice": 1.04, "maxPriceFactor": 1.1, "seedRate": 0.025, "weightPerLiter": 0.72 },
  { "slug": "potato", "nameEs": "Patatas", "nameEn": "Potato", "yieldPerM2": 4.13, "basePrice": 0.222, "maxPriceFactor": 1.15, "seedRate": 0.3733, "weightPerLiter": 0.75 },
  { "slug": "rice_long_grain", "nameEs": "Arroz (Largo)", "nameEn": "Rice (Long Grain)", "yieldPerM2": 0.9, "basePrice": 0.53, "maxPriceFactor": 1.05, "seedRate": 0.05, "weightPerLiter": 0.77 },
  { "slug": "rice", "nameEs": "Arroz (Corto)", "nameEn": "Rice", "yieldPerM2": 0.66, "basePrice": 1.1, "maxPriceFactor": 1.05, "seedRate": 0.015625, "weightPerLiter": 0.79 },
  { "slug": "sorghum", "nameEs": "Sorgo", "nameEn": "Sorghum", "yieldPerM2": 0.82, "basePrice": 0.43, "maxPriceFactor": 1.22, "seedRate": 0.0035, "weightPerLiter": 0.85 },
  { "slug": "soybean", "nameEs": "Soja", "nameEn": "Soybean", "yieldPerM2": 0.45, "basePrice": 0.778, "maxPriceFactor": 1.59, "seedRate": 0.0214, "weightPerLiter": 0.7 },
  { "slug": "spinach", "nameEs": "Espinacas", "nameEn": "Spinach", "yieldPerM2": 2.31, "basePrice": 0.22, "maxPriceFactor": 1.05, "seedRate": 0.001, "weightPerLiter": 0.13 },
  { "slug": "sugarbeet", "nameEs": "Remolacha Azucarera", "nameEn": "Sugar Beet", "yieldPerM2": 5.78, "basePrice": 0.172, "maxPriceFactor": 1.15, "seedRate": 0.0034, "weightPerLiter": 0.7 },
  { "slug": "sugarcane", "nameEs": "Caña de Azúcar", "nameEn": "Sugarcane", "yieldPerM2": 11.34, "basePrice": 0.119, "maxPriceFactor": 1.05, "seedRate": 1.2, "weightPerLiter": 0.18 },
  { "slug": "sunflower", "nameEs": "Girasol", "nameEn": "Sunflower", "yieldPerM2": 0.52, "basePrice": 0.673, "maxPriceFactor": 1.2, "seedRate": 0.0143, "weightPerLiter": 0.35 },
  { "slug": "wheat", "nameEs": "Trigo", "nameEn": "Wheat", "yieldPerM2": 0.89, "basePrice": 0.337, "maxPriceFactor": 1.21, "seedRate": 0.0308, "weightPerLiter": 0.78 },
  { "slug": "grass", "nameEs": "Hierba", "nameEn": "Grass", "yieldPerM2": 4.37, "basePrice": 0.045, "maxPriceFactor": 1.11, "seedRate": 0.012, "weightPerLiter": 0.3 },
  { "slug": "poplar", "nameEs": "Álamo (Astillas de Madera)", "nameEn": "Poplar (Wood Chips)", "yieldPerM2": 19.881, "basePrice": 0.32, "maxPriceFactor": 1.69, "seedRate": 0.15, "weightPerLiter": 0.35 }
]
```

---

## 3. `silage_crops` (10)

Referencian un cultivo de `crops` por `crop_slug` (misma versión). El rendimiento de ensilaje es **propio**, no derivado del cultivo base (p. ej. álamo ensilaje 6.627 vs cultivo 19.881). Precio y densidad del ensilaje son globales (ver `game_constants`: `silage_price`, `silage_weight`).

| crop_slug | yield_per_m2 | chaff_factor |
|---|---|---|
| barley | 0.96 | 4.0 |
| canola | 0.58 | 4.0 |
| corn | 0.92 | 7.8 |
| oat | 0.57 | 4.0 |
| sorghum | 0.82 | 4.0 |
| soybean | 0.45 | 4.0 |
| sunflower | 0.52 | 6.0 |
| wheat | 0.89 | 4.0 |
| grass | 4.37 | 1.0 |
| poplar | 6.627 | 3.0 |

```json
[
  { "cropSlug": "barley", "yieldPerM2": 0.96, "chaffFactor": 4.0 },
  { "cropSlug": "canola", "yieldPerM2": 0.58, "chaffFactor": 4.0 },
  { "cropSlug": "corn", "yieldPerM2": 0.92, "chaffFactor": 7.8 },
  { "cropSlug": "oat", "yieldPerM2": 0.57, "chaffFactor": 4.0 },
  { "cropSlug": "sorghum", "yieldPerM2": 0.82, "chaffFactor": 4.0 },
  { "cropSlug": "soybean", "yieldPerM2": 0.45, "chaffFactor": 4.0 },
  { "cropSlug": "sunflower", "yieldPerM2": 0.52, "chaffFactor": 6.0 },
  { "cropSlug": "wheat", "yieldPerM2": 0.89, "chaffFactor": 4.0 },
  { "cropSlug": "grass", "yieldPerM2": 4.37, "chaffFactor": 1.0 },
  { "cropSlug": "poplar", "yieldPerM2": 6.627, "chaffFactor": 3.0 }
]
```

> **Verificación cruzada:** estos valores coinciden con la tabla `ANIMAL_FIELDWORK_YIELDS` del prototipo (yield de cultivo + multiplicador de chaff), que por tanto no requiere un seed propio: el motor lo deriva de `crops` + `silage_crops`.

---

## 4. `animal_types` (7)

Modelo híbrido (ADR-004): columnas para lo uniforme (escalares de dificultad, precio de venta, producto principal) y JSONB para lo heterogéneo (`monthly_rates`, `feed_options`).

- **Escalares de dificultad**: todas las especies en v1 usan `easy 3.0 / normal 1.8 / hard 1.0` (independientes por especie; la cabra tiene los suyos, ver corrección #1).
- **`monthly_rates`**: litros/mes por animal. Negativo = consumo. Claves según especie (producción + consumo + estiércol/purín cuando aplica).
- **`product_price_scalar`**: `null` en vaca/búfalo porque su precio usa los escalares mensuales de la leche (`game_constants.milk_price_scalars`).
- **`feed_options`**: estructura por especie. En cerdo/caballo incluye `litersPerAnimalMonth` por componente de pienso (consumo mensual de cada componente) además de los cultivos admitidos.

| species | name_es | sale_price | product_slug | product_base_price | product_price_scalar |
|---|---|---|---|---|---|
| cow | Vacas | 3500 | milk | 0.7 | null |
| buffalo | Búfalos | 3000 | buffalo_milk | 3.5 | null |
| chicken | Gallinas | null | eggs | 1.12 | 1.25 |
| sheep | Ovejas | 1000 | wool | 0.94 | 1.29 |
| goat | Cabras | 1000 | goat_milk | 2.82 | 1.08 |
| pig | Cerdos | 2500 | null | null | null |
| horse | Caballos | 5000 | null | null | null |

### `monthly_rates` por especie

| species | monthly_rates |
|---|---|
| cow | `{ "milk": 135, "food": -350, "slurry": 250, "manure": 200, "straw": -95 }` |
| buffalo | `{ "milk": 4100, "food": -10500, "slurry": 2400, "manure": 3600, "straw": -200 }` |
| chicken | `{ "eggs": 5, "food": -5 }` |
| sheep | `{ "wool": 58.8235294117647, "food": -48.5588235294117 }` |
| goat | `{ "milk": 25, "food": -50 }` |
| pig | `{ "slurry": 65, "manure": 35, "straw": -20 }` |
| horse | `{ "manure": 200, "straw": -80 }` |

> En cerdo y caballo el consumo de comida no es un escalar plano de `food`: se reparte por componentes de pienso (ver `feed_options.components[*].litersPerAnimalMonth`).

### JSON completo

```json
[
  {
    "species": "cow",
    "nameEs": "Vacas",
    "difficultyScalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
    "salePrice": 3500,
    "product": { "slug": "milk", "basePrice": 0.7, "priceScalar": null },
    "monthlyRates": { "milk": 135, "food": -350, "slurry": 250, "manure": 200, "straw": -95 },
    "feedOptions": {
      "productivityFactors": { "tmr": 1.0, "simple": 1.0, "hay": 0.8, "grass": 0.4 },
      "tmrRatios": { "hay": 0.3744, "silage": 0.3744, "straw": 0.2032, "mineralFeed": 0.048 },
      "silageCrops": ["corn", "barley", "wheat", "sorghum", "sunflower", "oat", "canola", "soybean", "grass", "poplar"]
    }
  },
  {
    "species": "buffalo",
    "nameEs": "Búfalos",
    "difficultyScalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
    "salePrice": 3000,
    "product": { "slug": "buffalo_milk", "basePrice": 3.5, "priceScalar": null },
    "monthlyRates": { "milk": 4100, "food": -10500, "slurry": 2400, "manure": 3600, "straw": -200 },
    "feedOptions": {
      "productivityFactors": { "tmr": 1.0, "hay": 0.8, "grass": 0.4 },
      "tmrRatios": { "hay": 0.3744, "silage": 0.3744, "straw": 0.2032, "mineralFeed": 0.048 },
      "silageCrops": ["corn", "barley", "wheat", "sorghum", "sunflower", "oat", "canola", "soybean", "grass", "poplar"]
    }
  },
  {
    "species": "chicken",
    "nameEs": "Gallinas",
    "difficultyScalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
    "salePrice": null,
    "product": { "slug": "eggs", "basePrice": 1.12, "priceScalar": 1.25 },
    "monthlyRates": { "eggs": 5, "food": -5 },
    "feedOptions": {
      "boughtFeedTypes": ["oat", "wheat"],
      "fieldworkCrops": ["barley", "wheat", "sorghum"]
    }
  },
  {
    "species": "sheep",
    "nameEs": "Ovejas",
    "difficultyScalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
    "salePrice": 1000,
    "product": { "slug": "wool", "basePrice": 0.94, "priceScalar": 1.29 },
    "monthlyRates": { "wool": 58.8235294117647, "food": -48.5588235294117 },
    "feedOptions": {}
  },
  {
    "species": "goat",
    "nameEs": "Cabras",
    "difficultyScalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
    "salePrice": 1000,
    "product": { "slug": "goat_milk", "basePrice": 2.82, "priceScalar": 1.08 },
    "monthlyRates": { "milk": 25, "food": -50 },
    "feedOptions": {}
  },
  {
    "species": "pig",
    "nameEs": "Cerdos",
    "difficultyScalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
    "salePrice": 2500,
    "product": null,
    "monthlyRates": { "slurry": 65, "manure": 35, "straw": -20 },
    "feedOptions": {
      "components": {
        "base": { "crops": ["corn", "sorghum"], "litersPerAnimalMonth": 30 },
        "grain": { "crops": ["wheat", "barley"], "litersPerAnimalMonth": 15 },
        "protein": { "crops": ["soybean", "canola", "sunflower"], "litersPerAnimalMonth": 12 },
        "root": { "crops": ["potato", "sugarbeet", "redbeet", "parsnip", "carrot"], "litersPerAnimalMonth": 3 }
      }
    }
  },
  {
    "species": "horse",
    "nameEs": "Caballos",
    "difficultyScalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
    "salePrice": 5000,
    "product": null,
    "monthlyRates": { "manure": 200, "straw": -80 },
    "feedOptions": {
      "components": {
        "base": { "crops": ["oat", "sorghum"], "litersPerAnimalMonth": 95.25 },
        "hay": { "litersPerAnimalMonth": 285.75 },
        "root": { "crops": ["potato", "sugarbeet", "redbeet", "parsnip", "carrot"], "litersPerAnimalMonth": 19.0625 }
      }
    }
  }
]
```

> **Pendiente de implementación (no afecta al seed):** definir en el motor si la venta de oveja/cabra (`sale_price = 1000`) se escala por dificultad. En el prototipo la venta de cerdo/caballo no se escalaba por dificultad; las ventas de oveja/cabra son nuevas.

---

## 5. `game_constants` (KV, JSONB versionado)

| key | value | Descripción |
|---|---|---|
| `default_yield_bonus` | `0.425` | Yield bonus por defecto (42.5%) |
| `straw_bonus` | `0.11111111` | Bonus por proveer paja (+11.1%) |
| `mineral_feed_price` | `0.9523809524` | $/L alimento mineral |
| `silage_price` | `0.121` | $/L ensilaje |
| `silage_weight` | `0.3` | t/m³ ensilaje |
| `straw_yield_per_m2` | `5.244` | Rendimiento de paja para fieldwork |
| `grass_yield_per_m2` | `4.37` | Rendimiento de hierba para fieldwork |
| `income_difficulty_scalars` | `{"easy":3.0,"normal":1.8,"hard":1.0}` | Multiplicadores de ingresos de cultivos |
| `milk_price_scalars` | ver JSON abajo | Escalares mensuales del precio de la leche (año de juego empieza en marzo) |
| `feed_purchase_prices` | `{"oat":1.4,"wheat":1.5}` | Escalares de precio de alimento comprado |
| `yield_bonus_scalar` | `1.425` | Escalar de bono de rendimiento animal |

```json
{
  "default_yield_bonus": 0.425,
  "straw_bonus": 0.11111111,
  "mineral_feed_price": 0.9523809524,
  "silage_price": 0.121,
  "silage_weight": 0.3,
  "straw_yield_per_m2": 5.244,
  "grass_yield_per_m2": 4.37,
  "income_difficulty_scalars": { "easy": 3.0, "normal": 1.8, "hard": 1.0 },
  "milk_price_scalars": {
    "average": 1.003333333,
    "max": 1.09,
    "monthly": [
      { "month": 1, "name": "MAR", "value": 1.06 },
      { "month": 2, "name": "APR", "value": 1.01 },
      { "month": 3, "name": "MAY", "value": 0.96 },
      { "month": 4, "name": "JUN", "value": 0.90 },
      { "month": 5, "name": "JUL", "value": 0.95 },
      { "month": 6, "name": "AUG", "value": 0.95 },
      { "month": 7, "name": "SEP", "value": 1.03 },
      { "month": 8, "name": "OCT", "value": 1.09 },
      { "month": 9, "name": "NOV", "value": 0.98 },
      { "month": 10, "name": "DEC", "value": 0.96 },
      { "month": 11, "name": "JAN", "value": 1.08 },
      { "month": 12, "name": "FEB", "value": 1.07 }
    ]
  },
  "feed_purchase_prices": { "oat": 1.4, "wheat": 1.5 },
  "yield_bonus_scalar": 1.425
}
```

> `milk_price_scalars.average` (1.003333333) ≈ media de los 12 valores mensuales; `max` (1.09) coincide con el mayor (OCT). El año de juego empieza en marzo (mes 1 = MAR).

---

## Documentos relacionados

- `docs/base-de-datos.md` — esquema de las tablas destino y reglas de negocio.
- `docs/openapi.yaml` — contrato (las respuestas de `/catalog/*` exponen estos catálogos).
- `docs/plan-implementacion.md` — historia H2 (esquema y seeds).
