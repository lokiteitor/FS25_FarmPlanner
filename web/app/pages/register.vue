<script setup lang="ts">
// pages/register — public route (the global auth guard allows /register).
// Composes the auth feature's RegisterForm inside a centered GlassCard and links
// back to login. Uses the minimal 'auth' layout (no sidebar).
import { GlassCard } from '~/shared/ui'
import { RegisterForm } from '~/features/auth'

definePageMeta({
  layout: 'auth',
})
</script>

<template>
  <GlassCard
    title="Crear cuenta"
    subtitle="Empieza a planificar tu granja"
  >
    <RegisterForm />

    <template #footer>
      <span class="register-page__hint">¿Ya tienes cuenta?</span>
      <NuxtLink class="register-page__link" to="/login">Iniciar sesión</NuxtLink>
    </template>
  </GlassCard>
</template>

<style scoped lang="scss">
.register-page {
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
