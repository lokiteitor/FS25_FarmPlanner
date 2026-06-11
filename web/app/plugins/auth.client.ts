// app/plugins/auth.client — Nuxt entry point that runs the app-layer auth
// bootstrap. The real logic lives in the FSD "app" layer
// (~/app/providers/auth.client); this thin plugin only invokes it so Nuxt
// auto-registers and executes it.
//
// `.client` suffix => client-only. `@pinia/nuxt` registers its plugin first, so
// Pinia is active by the time `setupAuth()` calls `useSessionStore()`. We await
// it so the initial route guard sees the restored session.

import { setupAuth } from '~/app/providers/auth.client'

export default defineNuxtPlugin(async () => {
  await setupAuth()
})
