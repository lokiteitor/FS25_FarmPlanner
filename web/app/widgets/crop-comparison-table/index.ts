// widgets/crop-comparison-table — public API of the crop-comparison widget.
//
// Consumed by pages/fields. Parametrized by (catalog, farm context, hectares)
// and emits `sow` with the chosen crop slug; the host wires that to a field.
export { default as CropComparisonTable } from './ui/CropComparisonTable.vue'
