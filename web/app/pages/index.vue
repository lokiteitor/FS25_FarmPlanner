<script setup lang="ts">
// pages/index — authenticated dashboard placeholder (H6 shell). The full
// dashboard (farm summary widgets, KPIs) lands in H7; for now it greets the
// logged-in user and prompts them to select or create a partida. Uses the
// default layout (app shell with sidebar).
import { computed } from 'vue'
import { GlassCard, StatCard } from '~/shared/ui'
import { useSessionStore } from '~/entities/user'

const session = useSessionStore()

const greetingName = computed(
  () => session.user?.displayName ?? session.user?.email ?? '',
)
const email = computed(() => session.user?.email ?? '—')
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__header">
      <h1 class="dashboard__title">Hola, {{ greetingName }}</h1>
      <p class="dashboard__subtitle">Bienvenido a FS25 Farm Planner</p>
    </header>

    <div class="dashboard__stats">
      <StatCard label="Cuenta" :value="email" />
      <StatCard label="Partida activa" value="Ninguna" hint="Aún no hay partida seleccionada" />
    </div>

    <GlassCard
      title="Selecciona o crea una partida"
      subtitle="Trabajarás siempre sobre una partida activa"
    >
      <p class="dashboard__note">
        Elige una partida existente o crea una nueva para empezar a gestionar
        campos, establos y maquinaria. El panel completo llegará pronto.
      </p>
    </GlassCard>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__header {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-strong);
  }

  &__subtitle {
    margin: 0;
    color: var(--text-muted);
  }

  &__stats {
    display: grid;
    gap: $space-md;
    grid-template-columns: 1fr;

    @include respond-to('sm') {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  &__note {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.5;
  }
}
</style>
