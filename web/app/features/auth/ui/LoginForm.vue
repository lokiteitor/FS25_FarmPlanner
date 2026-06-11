<script setup lang="ts">
// features/auth/ui/LoginForm — credential form. Submits via the session store
// (never calls the api directly, FSD §8.1) and maps ApiError codes to Spanish:
//   - 422 VALIDATION_ERROR -> per-field errors (details[].path)
//   - 401 INVALID_CREDENTIALS -> general error
//   - 429 RATE_LIMITED -> "demasiados intentos"
// On success navigates to '/'.
import { reactive, ref } from 'vue'
import { AppButton, AppInput } from '~/shared/ui'
import { useSessionStore } from '~/entities/user'
import {
  authErrorMessage,
  fieldErrorsFrom,
} from '../lib/errorMessages'

const session = useSessionStore()

const form = reactive({
  email: '',
  password: '',
})

const fieldErrors = reactive<{ email?: string; password?: string }>({})
const generalError = ref('')
const submitting = ref(false)

function clearErrors() {
  fieldErrors.email = undefined
  fieldErrors.password = undefined
  generalError.value = ''
}

async function onSubmit() {
  if (submitting.value) return
  clearErrors()
  submitting.value = true
  try {
    await session.login(form.email.trim(), form.password)
    await navigateTo('/')
  } catch (err) {
    const fields = fieldErrorsFrom(err)
    fieldErrors.email = fields.email
    fieldErrors.password = fields.password
    // Show a general message unless the error was fully explained per-field.
    if (Object.keys(fields).length === 0) {
      generalError.value = authErrorMessage(err)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="login-form" novalidate @submit.prevent="onSubmit">
    <p
      v-if="generalError"
      class="login-form__general-error"
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
      v-model="form.password"
      label="Contraseña"
      type="password"
      placeholder="••••••••"
      required
      :disabled="submitting"
      :error="fieldErrors.password"
    />

    <AppButton type="submit" block :loading="submitting">
      Iniciar sesión
    </AppButton>
  </form>
</template>

<style scoped lang="scss">
.login-form {
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
