<script setup lang="ts">
// pages/migrate — data migration from the prototype's IndexedDB into the user's
// account (H8). Uses the default layout (sidebar) and the global auth guard
// (auth required). Composition only: it renders the MigratePanel feature.
import { MigratePanel } from '~/features/data-migration'
</script>

<template>
  <div class="migrate-page">
    <header class="migrate-page__header">
      <h1 class="migrate-page__title">Migrar datos</h1>
      <p class="migrate-page__subtitle">
        Exporta tus datos del prototipo (IndexedDB) e impórtalos como una partida nueva.
      </p>
    </header>

    <MigratePanel />
  </div>
</template>

<style scoped lang="scss">
.migrate-page {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__title {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-strong);
  }

  &__subtitle {
    margin: $space-xs 0 0;
    color: var(--text-muted);
  }
}
</style>
