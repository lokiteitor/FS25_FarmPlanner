<script setup lang="ts">
// pages/animals/horses — the horse calculator (hay + base/root feed, straw,
// sale only). Renders the reusable screen widget with species "horse".
// Default layout + auth.
import { AnimalCalculatorScreen } from '~/widgets/animal-calculator-panels'
</script>

<template>
  <AnimalCalculatorScreen species="horse" />
</template>
