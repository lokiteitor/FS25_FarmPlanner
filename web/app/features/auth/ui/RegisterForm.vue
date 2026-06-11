<script setup lang="ts">
// features/auth/ui/RegisterForm — account creation. Submits via the session
// store (FSD §8.1) and maps ApiError codes to Spanish:
//   - 409 EMAIL_ALREADY_REGISTERED -> general error (also flagged on the email field)
//   - 422 VALIDATION_ERROR -> per-field errors (details[].path)
//   - 429 RATE_LIMITED -> "demasiados intentos"
// On success navigates to '/'. displayName is optional (contract: not required).
import { reactive, ref } from 'vue'
import { AppButton, AppInput } from '~/shared/ui'
import { useSessionStore } from '~/entities/user'
import type { RegisterRequest } from '~/entities/user'
import {
  authErrorMessage,
  fieldErrorsFrom,
} from '../lib/errorMessages'
import { isApiError } from '~/shared/api'

const session = useSessionStore()

const form = reactive({
  email: '',
  password: '',
  displayName: '',
})

const fieldErrors = reactive<{
  email?: string
  password?: string
  displayName?: string
}>({})
const generalError = ref('')
const submitting = ref(false)

function clearErrors() {
  fieldErrors.email = undefined
  fieldErrors.password = undefined
  fieldErrors.displayName = undefined
  generalError.value = ''
}

async function onSubmit() {
  if (submitting.value) return
  clearErrors()
  submitting.value = true
  try {
    const body: RegisterRequest = {
      email: form.email.trim(),
      password: form.password,
    }
    const displayName = form.displayName.trim()
    if (displayName) body.displayName = displayName

    await session.register(body)
    await navigateTo('/')
  } catch (err) {
    const fields = fieldErrorsFrom(err)
    fieldErrors.email = fields.email
    fieldErrors.password = fields.password
    fieldErrors.displayName = fields.displayName

    // 409 EMAIL_ALREADY_REGISTERED carries no details[]; surface it both as a
    // general banner and against the email field for clarity.
    if (isApiError(err) && err.code === 'EMAIL_ALREADY_REGISTERED') {
      generalError.value = authErrorMessage(err)
      fieldErrors.email = fieldErrors.email ?? authErrorMessage(err)
    } else if (Object.keys(fields).length === 0) {
      generalError.value = authErrorMessage(err)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="register-form" novalidate @submit.prevent="onSubmit">
    <p
      v-if="generalError"
      class="register-form__general-error"
      role="alert"
    >
      {{ generalError }}
    </p>

    <AppInput
      v-model="form.email"
      label="Email"
      type="email"
      placeholder="tu@email.com"
      required
      :disabled="submitting"
      :error="fieldErrors.email"
    />

    <AppInput
      v-model="form.displayName"
      label="Nombre"
      type="text"
      placeholder="Cómo quieres que te llamemos"
      helper="Opcional"
      :disabled="submitting"
      :error="fieldErrors.displayName"
    />

    <AppInput
      v-model="form.password"
      label="Contraseña"
      type="password"
      placeholder="Mínimo 8 caracteres"
      required
      :disabled="submitting"
      :error="fieldErrors.password"
    />

    <AppButton type="submit" block :loading="submitting">
      Crear cuenta
    </AppButton>
  </form>
</template>

<style scoped lang="scss">
.register-form {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__general-error {
    margin: 0;
    padding: $space-sm $space-md;
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    background: rgba(255, 71, 87, 0.12);
    color: var(--danger);
    font-size: 0.875rem;
  }
}
</style>
