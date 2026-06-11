<script setup lang="ts">
const title = 'FS25 Farm Planner'
</script>

<template>
  <main class="dashboard">
    <section class="glass-card dashboard__card">
      <h1 class="dashboard__title">{{ title }}</h1>
      <p class="dashboard__note">Scaffolding listo (H1)</p>
    </section>
  </main>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: $space-lg;

  &__card {
    max-width: 32rem;
    text-align: center;
  }

  &__title {
    margin: 0 0 $space-sm;
    font-size: 2rem;
    color: var(--primary);
  }

  &__note {
    margin: 0;
    color: var(--text-muted);
  }
}
</style>
