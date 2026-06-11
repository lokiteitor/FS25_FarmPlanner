<script setup lang="ts">
// pages/login — public route (the global auth guard allows /login). Composes the
// auth feature's LoginForm inside a centered GlassCard and links to register.
// Uses the minimal 'auth' layout (no sidebar).
import { GlassCard } from '~/shared/ui'
import { LoginForm } from '~/features/auth'

definePageMeta({
  layout: 'auth',
})
</script>

<template>
  <GlassCard
    title="Iniciar sesión"
    subtitle="Accede a tu planificador de FS25"
  >
    <LoginForm />

    <template #footer>
      <span class="login-page__hint">¿No tienes cuenta?</span>
      <NuxtLink class="login-page__link" to="/register">Crear cuenta</NuxtLink>
    </template>
  </GlassCard>
</template>

<style scoped lang="scss">
.login-page {
  &__hint {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  &__link {
    @include focus-ring;

    color: var(--primary);
    font-weight: 600;
    font-size: 0.875rem;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
