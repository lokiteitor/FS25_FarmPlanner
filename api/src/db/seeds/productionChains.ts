/**
 * Seed data — production chains (FS25 v1.0).
 *
 * Each chain is a recipe that belongs to a building type. At full capacity
 * (one active chain in the building) it runs `cyclesPerMonth` cycles per game
 * month. Each cycle consumes the listed inputs and produces the listed outputs.
 * When multiple chains are active in the same building, cycles are split equally
 * (the engine divides by the count of active chains — not done here).
 *
 * Input/output slugs reference either crops.slug (e.g. 'wheat', 'canola') or
 * production_products.slug (e.g. 'flour', 'oil', 'fabric'). The engine treats
 * them as opaque strings; the frontend resolves display names.
 *
 * Sources: Guides4Nerds FS25 production chain guide.
 * Omitted (incomplete data): Cake variants, Biogas, Cooperage, Wagon Maker,
 *   Playground Workshop, Cannery. These can be added as custom chains by the user.
 *
 * "Mijo" in the Spanish game corresponds to the sorghum crop slug in the catalog
 * (the game uses sorghum as the base grain for sorghum flour production).
 */

export interface ProductionChainIOSeed {
  slug: string;
  quantityPerCycle: number;
}

export interface ProductionChainSeed {
  buildingTypeSlug: string;
  slug: string;
  nameEs: string;
  nameEn: string;
  cyclesPerMonth: number;
  inputs: ProductionChainIOSeed[];
  outputs: ProductionChainIOSeed[];
}

export const productionChainsSeed: ProductionChainSeed[] = [
  // ── Molino (Mill) ────────────────────────────────────────────────────────
  {
    buildingTypeSlug: 'mill',
    slug: 'mill_wheat_flour',
    nameEs: 'Harina de Trigo',
    nameEn: 'Wheat Flour',
    cyclesPerMonth: 2520,
    inputs:  [{ slug: 'wheat',           quantityPerCycle: 5  }],
    outputs: [{ slug: 'flour',           quantityPerCycle: 4  }],
  },
  {
    buildingTypeSlug: 'mill',
    slug: 'mill_barley_flour',
    nameEs: 'Harina de Cebada',
    nameEn: 'Barley Flour',
    cyclesPerMonth: 480,
    inputs:  [{ slug: 'barley',          quantityPerCycle: 30 }],
    outputs: [{ slug: 'flour',           quantityPerCycle: 22 }],
  },
  {
    buildingTypeSlug: 'mill',
    slug: 'mill_oat_flour',
    nameEs: 'Harina de Avena',
    nameEn: 'Oat Flour',
    cyclesPerMonth: 1200,
    inputs:  [{ slug: 'oat',             quantityPerCycle: 15 }],
    outputs: [{ slug: 'flour',           quantityPerCycle: 15 }],
  },
  {
    buildingTypeSlug: 'mill',
    slug: 'mill_sorghum_flour',
    nameEs: 'Harina de Mijo',
    nameEn: 'Sorghum Flour',
    cyclesPerMonth: 1200,
    inputs:  [{ slug: 'sorghum',         quantityPerCycle: 15 }],
    outputs: [{ slug: 'flour',           quantityPerCycle: 13 }],
  },
  {
    buildingTypeSlug: 'mill',
    slug: 'mill_rice_long_grain_flour',
    nameEs: 'Harina de Arroz (Largo)',
    nameEn: 'Long Grain Rice Flour',
    cyclesPerMonth: 720,
    inputs:  [{ slug: 'rice_long_grain', quantityPerCycle: 15 }],
    outputs: [{ slug: 'rice_flour',      quantityPerCycle: 13 }],
  },
  {
    buildingTypeSlug: 'mill',
    slug: 'mill_rice_flour',
    nameEs: 'Harina de Arroz',
    nameEn: 'Rice Flour',
    cyclesPerMonth: 720,
    inputs:  [{ slug: 'rice',            quantityPerCycle: 9  }],
    outputs: [{ slug: 'rice_flour',      quantityPerCycle: 15 }],
  },

  // ── Panadería (Bakery) ───────────────────────────────────────────────────
  {
    buildingTypeSlug: 'bakery',
    slug: 'bakery_bread_wheat',
    nameEs: 'Pan (Trigo)',
    nameEn: 'Bread (Wheat)',
    cyclesPerMonth: 120,
    inputs:  [{ slug: 'flour',           quantityPerCycle: 90 }],
    outputs: [{ slug: 'bread',           quantityPerCycle: 45 }],
  },
  {
    buildingTypeSlug: 'bakery',
    slug: 'bakery_bread_rice',
    nameEs: 'Pan (Arroz)',
    nameEn: 'Bread (Rice)',
    cyclesPerMonth: 48,
    inputs:  [{ slug: 'rice_flour',      quantityPerCycle: 68 }],
    outputs: [{ slug: 'bread',           quantityPerCycle: 45 }],
  },

  // ── Almazara (Oil Mill) ──────────────────────────────────────────────────
  {
    buildingTypeSlug: 'oil_mill',
    slug: 'oil_mill_sunflower',
    nameEs: 'Aceite de Girasol',
    nameEn: 'Sunflower Oil',
    cyclesPerMonth: 480,
    inputs:  [{ slug: 'sunflower',       quantityPerCycle: 20 }],
    outputs: [{ slug: 'oil',             quantityPerCycle: 10 }],
  },
  {
    buildingTypeSlug: 'oil_mill',
    slug: 'oil_mill_canola',
    nameEs: 'Aceite de Canola',
    nameEn: 'Canola Oil',
    cyclesPerMonth: 480,
    inputs:  [{ slug: 'canola',          quantityPerCycle: 20 }],
    outputs: [{ slug: 'oil',             quantityPerCycle: 10 }],
  },
  {
    buildingTypeSlug: 'oil_mill',
    slug: 'oil_mill_olive',
    nameEs: 'Aceite de Oliva',
    nameEn: 'Olive Oil',
    cyclesPerMonth: 240,
    inputs:  [{ slug: 'olive',           quantityPerCycle: 25 }],
    outputs: [{ slug: 'oil',             quantityPerCycle: 10 }],
  },
  {
    buildingTypeSlug: 'oil_mill',
    slug: 'oil_mill_rice_long_grain',
    nameEs: 'Aceite de Arroz (Largo)',
    nameEn: 'Long Grain Rice Oil',
    cyclesPerMonth: 480,
    inputs:  [{ slug: 'rice_long_grain', quantityPerCycle: 25 }],
    outputs: [{ slug: 'oil',             quantityPerCycle: 10 }],
  },
  {
    buildingTypeSlug: 'oil_mill',
    slug: 'oil_mill_rice',
    nameEs: 'Aceite de Arroz',
    nameEn: 'Rice Oil',
    cyclesPerMonth: 480,
    inputs:  [{ slug: 'rice',            quantityPerCycle: 12 }],
    outputs: [{ slug: 'oil',             quantityPerCycle: 10 }],
  },

  // ── Hilandería (Spinnery) ────────────────────────────────────────────────
  {
    buildingTypeSlug: 'spinnery',
    slug: 'spinnery_cotton_fabric',
    nameEs: 'Tela de Algodón',
    nameEn: 'Cotton Fabric',
    cyclesPerMonth: 2400,
    inputs:  [{ slug: 'cotton',          quantityPerCycle: 9  }],
    outputs: [{ slug: 'fabric',          quantityPerCycle: 3  }],
  },
  {
    buildingTypeSlug: 'spinnery',
    slug: 'spinnery_wool_fabric',
    nameEs: 'Tela de Lana',
    nameEn: 'Wool Fabric',
    cyclesPerMonth: 1440,
    inputs:  [{ slug: 'wool',            quantityPerCycle: 3  }],
    outputs: [{ slug: 'fabric',          quantityPerCycle: 1  }],
  },

  // ── Sastrería (Tailor Shop) ──────────────────────────────────────────────
  {
    buildingTypeSlug: 'tailor_shop',
    slug: 'tailor_clothing',
    nameEs: 'Ropa',
    nameEn: 'Clothing',
    cyclesPerMonth: 2400,
    inputs:  [{ slug: 'fabric',          quantityPerCycle: 4  }],
    outputs: [{ slug: 'clothing',        quantityPerCycle: 2  }],
  },

  // ── Aserradero (Sawmill) ─────────────────────────────────────────────────
  {
    buildingTypeSlug: 'sawmill',
    slug: 'sawmill_planks',
    nameEs: 'Tablas',
    nameEn: 'Planks',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'wood',            quantityPerCycle: 416 }],
    outputs: [{ slug: 'planks',          quantityPerCycle: 410 }],
  },
  {
    buildingTypeSlug: 'sawmill',
    slug: 'sawmill_long_planks',
    nameEs: 'Tablas Largas',
    nameEn: 'Long Planks',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'wood',            quantityPerCycle: 416 }],
    outputs: [{ slug: 'long_planks',     quantityPerCycle: 275 }],
  },
  {
    buildingTypeSlug: 'sawmill',
    slug: 'sawmill_beams',
    nameEs: 'Vigas',
    nameEn: 'Beams',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'wood',            quantityPerCycle: 416 }],
    outputs: [{ slug: 'beams',           quantityPerCycle: 183 }],
  },
  {
    buildingTypeSlug: 'sawmill',
    slug: 'sawmill_walls',
    nameEs: 'Muros Prefabricados',
    nameEn: 'Prefabricated Walls',
    cyclesPerMonth: 33.6,
    inputs:  [{ slug: 'wood',            quantityPerCycle: 412 }],
    outputs: [{ slug: 'walls',           quantityPerCycle: 100 }],
  },

  // ── Fábrica de Papel (Paper Factory) ─────────────────────────────────────
  {
    buildingTypeSlug: 'paper_factory',
    slug: 'paper_factory_cardboard',
    nameEs: 'Cartón',
    nameEn: 'Cardboard',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'wood',            quantityPerCycle: 420 }],
    outputs: [{ slug: 'cardboard',       quantityPerCycle: 215 }],
  },
  {
    buildingTypeSlug: 'paper_factory',
    slug: 'paper_factory_paper',
    nameEs: 'Papel',
    nameEn: 'Paper',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'wood',            quantityPerCycle: 535 }],
    outputs: [{ slug: 'paper',           quantityPerCycle: 230 }],
  },

  // ── Cordelería (Ropery) ──────────────────────────────────────────────────
  {
    buildingTypeSlug: 'ropery',
    slug: 'ropery_cotton_rope',
    nameEs: 'Cuerda de Algodón',
    nameEn: 'Cotton Rope',
    cyclesPerMonth: 192,
    inputs:  [{ slug: 'cotton',          quantityPerCycle: 150 }],
    outputs: [{ slug: 'rope',            quantityPerCycle: 40  }],
  },
  {
    buildingTypeSlug: 'ropery',
    slug: 'ropery_wool_rope',
    nameEs: 'Cuerda de Lana',
    nameEn: 'Wool Rope',
    cyclesPerMonth: 240,
    inputs:  [{ slug: 'wool',            quantityPerCycle: 20  }],
    outputs: [{ slug: 'rope',            quantityPerCycle: 3   }],
  },

  // ── Invernadero (Greenhouse) ──────────────────────────────────────────────
  //
  // Los tres tamaños (Small/Medium/Large) usan las mismas recetas; la diferencia
  // es la cantidad de ciclos disponibles. Cuando se activan varios productos a la
  // vez, los ciclos se reparten equitativamente entre las recetas activas (la
  // lógica de división la aplica el motor en tiempo de ejecución, no aquí).
  //
  // Fuente: XMLs del juego extraídos por la comunidad (modland.net).
  {
    buildingTypeSlug: 'greenhouse',
    slug: 'greenhouse_lettuce',
    nameEs: 'Lechuga',
    nameEn: 'Lettuce',
    cyclesPerMonth: 5040,
    inputs:  [{ slug: 'water',        quantityPerCycle: 2   }],
    outputs: [{ slug: 'lettuce',      quantityPerCycle: 1   }],
  },
  {
    buildingTypeSlug: 'greenhouse',
    slug: 'greenhouse_tomato',
    nameEs: 'Tomate',
    nameEn: 'Tomato',
    cyclesPerMonth: 2640,
    inputs:  [{ slug: 'water',        quantityPerCycle: 1   }],
    outputs: [{ slug: 'tomato',       quantityPerCycle: 1   }],
  },
  {
    buildingTypeSlug: 'greenhouse',
    slug: 'greenhouse_strawberry',
    nameEs: 'Fresa',
    nameEn: 'Strawberry',
    cyclesPerMonth: 2640,
    inputs:  [{ slug: 'water',        quantityPerCycle: 1   }],
    outputs: [{ slug: 'strawberry',   quantityPerCycle: 2   }],
  },
  {
    buildingTypeSlug: 'greenhouse',
    slug: 'greenhouse_spring_onion',
    nameEs: 'Cebollín',
    nameEn: 'Spring Onion',
    cyclesPerMonth: 1680,
    inputs:  [{ slug: 'water',        quantityPerCycle: 1.5 }],
    outputs: [{ slug: 'spring_onion', quantityPerCycle: 3   }],
  },
  {
    buildingTypeSlug: 'greenhouse',
    slug: 'greenhouse_napa_cabbage',
    nameEs: 'Col China',
    nameEn: 'Napa Cabbage',
    cyclesPerMonth: 3360,
    inputs:  [{ slug: 'water',        quantityPerCycle: 3   }],
    outputs: [{ slug: 'napa_cabbage', quantityPerCycle: 2   }],
  },
  {
    buildingTypeSlug: 'greenhouse',
    slug: 'greenhouse_chili',
    nameEs: 'Chile',
    nameEn: 'Chili',
    cyclesPerMonth: 2640,
    inputs:  [{ slug: 'water',        quantityPerCycle: 3   }],
    outputs: [{ slug: 'chili',        quantityPerCycle: 2   }],
  },
  {
    buildingTypeSlug: 'greenhouse',
    slug: 'greenhouse_garlic',
    nameEs: 'Ajo',
    nameEn: 'Garlic',
    cyclesPerMonth: 3600,
    inputs:  [{ slug: 'water',        quantityPerCycle: 3   }],
    outputs: [{ slug: 'garlic',       quantityPerCycle: 1.5 }],
  },

  // ── Fábrica de Cemento (Cement Factory) ──────────────────────────────────
  {
    buildingTypeSlug: 'cement_factory',
    slug: 'cement_bricks',
    nameEs: 'Ladrillos de Concreto',
    nameEn: 'Concrete Bricks',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'stone',           quantityPerCycle: 1000 }],
    outputs: [{ slug: 'bricks',          quantityPerCycle: 125  }],
  },
  {
    buildingTypeSlug: 'cement_factory',
    slug: 'cement_roof_tiles',
    nameEs: 'Tejas',
    nameEn: 'Roof Tiles',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'stone',           quantityPerCycle: 1000 }],
    outputs: [{ slug: 'roof_tiles',      quantityPerCycle: 125  }],
  },
  {
    buildingTypeSlug: 'cement_factory',
    slug: 'cement_bags',
    nameEs: 'Sacos de Cemento',
    nameEn: 'Cement Bags',
    cyclesPerMonth: 24,
    inputs:  [{ slug: 'stone',           quantityPerCycle: 1000 }],
    outputs: [{ slug: 'cement_bags',     quantityPerCycle: 180  }],
  },
];
