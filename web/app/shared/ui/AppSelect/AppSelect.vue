<script setup lang="ts">
// Native <select> with v-model, label, helper and error text. Built on FormField
// for consistent layout/accessibility. Option values may be string or number;
// the emitted model value preserves the original option's value type.
import { computed, useId } from 'vue'
import { FormField } from '../FormField'

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    options: SelectOption[]
    label?: string
    helper?: string
    error?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    id?: string
  }>(),
  {
    label: undefined,
    helper: undefined,
    error: undefined,
    placeholder: undefined,
    required: false,
    disabled: false,
    id: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const generatedId = useId()
const selectId = computed(() => props.id ?? generatedId)

function onChange(event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  // Restore the original value type by matching against the supplied options.
  const match = props.options.find((opt) => String(opt.value) === raw)
  emit('update:modelValue', match ? match.value : raw)
}
</script>

<template>
  <FormField
    :label="label"
    :control-id="selectId"
    :helper="helper"
    :error="error"
    :required="required"
  >
    <template #default="{ describedBy, invalid }">
      <div class="app-select" :class="{ 'app-select--invalid': invalid }">
        <select
          :id="selectId"
          class="app-select__control"
          :value="modelValue ?? ''"
          :required="required"
          :disabled="disabled"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          @change="onChange"
        >
          <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
          <option
            v-for="opt in options"
            :key="String(opt.value)"
            :value="opt.value"
            :disabled="opt.disabled"
          >
            {{ opt.label }}
          </option>
        </select>
        <span class="app-select__caret" aria-hidden="true" />
      </div>
    </template>
  </FormField>
</template>

<style scoped lang="scss">
.app-select {
  position: relative;
  display: flex;

  &__control {
    @include focus-ring;

    width: 100%;
    appearance: none;
    padding: $space-sm $space-xl $space-sm $space-md;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
    color: var(--text);
    font-family: inherit;
    font-size: 0.9375rem;
    line-height: 1.4;
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      background var(--transition-fast);

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

    // Native option list renders with the OS palette; force dark background.
    option {
      background: var(--bg-base);
      color: var(--text);
    }
  }

  &__caret {
    position: absolute;
    top: 50%;
    right: $space-md;
    width: 0.5rem;
    height: 0.5rem;
    border-right: 2px solid var(--text-muted);
    border-bottom: 2px solid var(--text-muted);
    transform: translateY(-65%) rotate(45deg);
    pointer-events: none;
  }

  &--invalid &__control {
    border-color: var(--danger);
  }
}
</style>
