<script setup lang="ts">
// pages/animals/cows — the cow calculator. Renders the reusable screen widget
// with species "cow"; the widget ensures catalog/farm/stables are loaded and
// drives all numbers through the pure engine. Default layout + auth (global guard).
import { AnimalCalculatorScreen } from '~/widgets/animal-calculator-panels'
</script>

<template>
  <AnimalCalculatorScreen species="cow" />
</template>
