<script setup lang="ts">
// layouts/default — the authenticated app shell: a persistent sidebar plus the
// routed page content. Nuxt 4 auto-registers layouts from app/layouts/.
//
// Responsive (mobile-first): on small screens the sidebar sits on top as a
// horizontal scroll strip; from the `lg` breakpoint it becomes a fixed-width
// left column (respond-to('lg')). Auth pages opt out via layout: 'auth'.
import { AppSidebar } from '~/widgets/app-sidebar'
</script>

<template>
  <div class="app-shell">
    <div class="app-shell__sidebar">
      <AppSidebar />
    </div>
    <main class="app-shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100dvh;

  @include respond-to('lg') {
    grid-template-rows: none;
    grid-template-columns: 18rem 1fr;
  }

  &__sidebar {
    // On mobile the sidebar is a top band; from lg it becomes a sticky column.
    min-height: 0;

    @include respond-to('lg') {
      position: sticky;
      top: 0;
      height: 100dvh;
    }
  }

  &__main {
    min-width: 0;
    padding: $space-lg;

    @include respond-to('lg') {
      padding: $space-xl;
    }
  }
}
</style>
