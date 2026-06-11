<script setup lang="ts">
// layouts/auth — minimal, sidebar-less shell for the public auth pages
// (/login, /register). Centers its content vertically and horizontally over the
// global glassmorphism background. Selected per-page via
// definePageMeta({ layout: 'auth' }).
</script>

<template>
  <main class="auth-layout">
    <div class="auth-layout__content">
      <slot />
    </div>
  </main>
</template>

<style scoped lang="scss">
.auth-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: $space-lg;

  &__content {
    width: 100%;
    max-width: 26rem;
  }
}
</style>
