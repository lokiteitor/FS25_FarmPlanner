<script setup lang="ts">
// Text-like input with v-model, label, helper and error text. Built on FormField
// for consistent label/error layout and accessibility wiring.
import { computed, useId } from 'vue'
import { FormField } from '../FormField'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    label?: string
    type?: string
    placeholder?: string
    helper?: string
    error?: string
    required?: boolean
    disabled?: boolean
    /** Optional explicit id; defaults to a generated stable id. */
    id?: string
  }>(),
  {
    label: undefined,
    type: 'text',
    placeholder: undefined,
    helper: undefined,
    error: undefined,
    required: false,
    disabled: false,
    id: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <FormField
    :label="label"
    :control-id="inputId"
    :helper="helper"
    :error="error"
    :required="required"
  >
    <template #default="{ describedBy, invalid }">
      <input
        :id="inputId"
        class="app-input"
        :class="{ 'app-input--invalid': invalid }"
        :type="type"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedBy"
        @input="onInput"
      />
    </template>
  </FormField>
</template>

<style scoped lang="scss">
.app-input {
  @include focus-ring;

  width: 100%;
  padding: $space-sm $space-md;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  color: var(--text);
  font-family: inherit;
  font-size: 0.9375rem;
  line-height: 1.4;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);

  &::placeholder {
    color: var(--text-muted);
  }

  &:hover:not(:disabled) {
    border-color: var(--text-muted);
  }

  &:focus {
    border-color: var(--primary);
    background: var(--glass-bg-strong);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &--invalid {
    border-color: var(--danger);
  }
}
</style>
