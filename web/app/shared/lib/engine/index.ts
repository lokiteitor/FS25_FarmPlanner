// shared/lib/engine — public API of the pure calculation engine (ADR-F04).
//
// Parametrized by (catalog, farmContext, inputs); no stores, no network.
// Higher layers (widgets/animal-calculator-panels, widgets/crop-comparison-table)
// import the functions from here and feed them catalog data + farm context.

export {
  areaM2,
  effectiveYieldBonus,
  cropPricePerLiter,
  seedLitersNeeded,
  seedLitersForHectares,
  cropYieldLiters,
  silageYieldLiters,
  incomeByDifficulty,
  cropProjection,
  compareCrops,
} from './cropEngine'

export {
  animalProjection,
  projectFor,
  animalYieldBonus,
  feedProductivityFactor,
  strawBonusFactor,
  computeProductPrice,
} from './animalEngine'

export {
  capacityHaPerH,
  clampEfficiency,
  workSpeedProjection,
  toSpeedMachineInputs,
  MIN_EFFICIENCY,
  MAX_EFFICIENCY,
} from './workSpeedEngine'

export {
  activeChains,
  effectiveCyclesPerMonth,
  quantityPerMonth,
  chainProjection,
  productionProjection,
} from './productionEngine'

export type {
  Difficulty,
  SellPriceType,
  AnimalSpecies,
  DifficultyScalars,
  ByDifficulty,
  EngineCrop,
  EngineSilageCrop,
  EngineAnimalProduct,
  EngineFeedComponent,
  EngineFeedOptions,
  EngineAnimalType,
  EngineMilkPriceScalars,
  EngineConstants,
  EngineCatalog,
  FarmContext,
  CropProjectionInput,
  CropProjectionResult,
  AnimalInputs,
  AnimalProjectionResult,
  FieldworkRequirement,
  SpeedMachineInput,
  SpeedMachineBreakdown,
  WorkSpeedInput,
  WorkSpeedResult,
  EngineProductionIO,
  EngineProductionChain,
  EngineProductionBuilding,
  ProductionChainResult,
  ProductionBuildingResult,
} from './types'
