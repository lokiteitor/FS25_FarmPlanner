<script setup lang="ts">
// Label + control + helper/error wrapper. Wraps an arbitrary control via the
// default slot and wires accessibility: pass `controlId` and forward it to the
// control's `id`; this component points its <label> at it and exposes the
// describedby id for helper/error text.
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    /** id of the control inside the slot; links the <label> and aria wiring. */
    controlId?: string
    helper?: string
    error?: string
    required?: boolean
  }>(),
  {
    label: undefined,
    controlId: undefined,
    helper: undefined,
    error: undefined,
    required: false,
  },
)

const describedById = computed(() =>
  props.controlId ? `${props.controlId}-desc` : undefined,
)
</script>

<template>
  <div class="form-field" :class="{ 'form-field--invalid': !!error }">
    <label v-if="label" class="form-field__label" :for="controlId">
      {{ label }}
      <span v-if="required" class="form-field__required" aria-hidden="true">*</span>
    </label>

    <div class="form-field__control">
      <slot :described-by="describedById" :invalid="!!error" />
    </div>

    <p v-if="error" :id="describedById" class="form-field__error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="helper" :id="describedById" class="form-field__helper">
      {{ helper }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.form-field {
  display: flex;
  flex-direction: column;
  gap: $space-xs;

  &__label {
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
  }

  &__required {
    color: var(--danger);
    margin-left: 0.15em;
  }

  &__control {
    display: flex;
    flex-direction: column;
  }

  &__helper {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  &__error {
    margin: 0;
    color: var(--danger);
    font-size: 0.8125rem;
  }
}
</style>
