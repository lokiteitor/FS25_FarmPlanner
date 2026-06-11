// app/middleware/auth.global — Nuxt global route middleware. The `.global`
// suffix makes Nuxt run it on every navigation. The actual rule lives in the
// FSD "app" layer (~/app/router/auth.guard); this file only registers it.

import { runAuthGuard } from '~/app/router/auth.guard'

export default defineNuxtRouteMiddleware((to) => {
  return runAuthGuard(to)
})
