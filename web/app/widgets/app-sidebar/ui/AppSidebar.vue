<script setup lang="ts">
// widgets/app-sidebar/ui/AppSidebar — primary navigation for the authenticated
// app shell: brand, main nav, an "Animales" section (7 species calculators),
// the current user and a logout action. Logout goes through the session store
// (FSD §8.1) and then redirects to /login.
//
// Note: several targets (/fields, /stables, /machinery, /speed-calculator,
// /animals/*) land in later stories (H7). The links exist now; their pages are
// added then. <NuxtLink> renders <a> regardless of whether the route exists yet.
import { computed } from 'vue'
import { AppButton } from '~/shared/ui'
import { useSessionStore } from '~/entities/user'
import { FarmSwitcher } from '~/features/farm-switcher'

interface NavLink {
  label: string
  to: string
}

const mainLinks: NavLink[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Campos', to: '/fields' },
  { label: 'Establos', to: '/stables' },
  { label: 'Maquinaria', to: '/machinery' },
  { label: 'Calculadora velocidad', to: '/speed-calculator' },
]

const animalLinks: NavLink[] = [
  { label: 'Vacas', to: '/animals/cows' },
  { label: 'Búfalos', to: '/animals/buffalo' },
  { label: 'Gallinas', to: '/animals/chickens' },
  { label: 'Ovejas', to: '/animals/sheep' },
  { label: 'Cabras', to: '/animals/goats' },
  { label: 'Cerdos', to: '/animals/pigs' },
  { label: 'Caballos', to: '/animals/horses' },
]

const session = useSessionStore()

const displayName = computed(() => session.user?.displayName ?? null)
const email = computed(() => session.user?.email ?? '')

async function onLogout() {
  await session.logout()
  await navigateTo('/login')
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="app-sidebar__brand">
      <span class="app-sidebar__brand-mark">FS25</span>
      <span class="app-sidebar__brand-name">Farm Planner</span>
    </div>

    <FarmSwitcher />

    <nav class="app-sidebar__nav" aria-label="Navegación principal">
      <ul class="app-sidebar__list">
        <li v-for="link in mainLinks" :key="link.to">
          <NuxtLink class="app-sidebar__link" :to="link.to">
            {{ link.label }}
          </NuxtLink>
        </li>
      </ul>

      <p class="app-sidebar__section-title">Animales</p>
      <ul class="app-sidebar__list">
        <li v-for="link in animalLinks" :key="link.to">
          <NuxtLink class="app-sidebar__link" :to="link.to">
            {{ link.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="app-sidebar__user">
      <span class="app-sidebar__user-name">{{ displayName ?? email }}</span>
      <span v-if="displayName" class="app-sidebar__user-email">{{ email }}</span>
      <AppButton
        variant="ghost"
        size="sm"
        block
        @click="onLogout"
      >
        Cerrar sesión
      </AppButton>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.app-sidebar {
  display: flex;
  flex-direction: column;
  gap: $space-lg;
  height: 100%;
  padding: $space-lg;
  background: var(--glass-bg);
  border-right: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-glass));
  -webkit-backdrop-filter: blur(var(--blur-glass));

  &__brand {
    display: flex;
    align-items: baseline;
    gap: $space-sm;
  }

  &__brand-mark {
    color: var(--primary);
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  &__brand-name {
    color: var(--text-strong);
    font-weight: 600;
  }

  &__nav {
    flex: 1 1 auto;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: $space-sm;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__section-title {
    margin: $space-sm 0 0;
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__link {
    @include focus-ring;

    display: block;
    padding: $space-sm $space-md;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.9375rem;
    font-weight: 500;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);

    &:hover {
      background: var(--glass-bg-strong);
      color: var(--text);
    }

    // Nuxt adds these classes to the active route link.
    &.router-link-active,
    &.router-link-exact-active {
      background: var(--glass-bg-strong);
      color: var(--text-strong);
      box-shadow: inset 3px 0 0 var(--primary);
    }
  }

  &__user {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
    padding-top: $space-md;
    border-top: 1px solid var(--glass-border);
  }

  &__user-name {
    color: var(--text-strong);
    font-weight: 600;
    font-size: 0.9375rem;
    word-break: break-word;
  }

  &__user-email {
    color: var(--text-muted);
    font-size: 0.8125rem;
    word-break: break-all;
  }
}
</style>
