<script setup lang="ts" generic="Row extends Record<string, unknown>">
// Generic table. Columns describe headers + alignment + width; rows are plain
// records keyed by `rowKey`. Each column may be customised via a `#cell-<key>`
// slot receiving `{ row, value }`; otherwise the raw value is rendered. An
// `#empty` slot replaces the default empty-state message.
import { computed } from 'vue'

export type ColumnAlign = 'left' | 'center' | 'right'

export interface DataTableColumn {
  key: string
  label: string
  align?: ColumnAlign
  /** Any valid CSS width, e.g. "120px" or "20%". */
  width?: string
}

const props = withDefaults(
  defineProps<{
    columns: DataTableColumn[]
    rows: Row[]
    /** Property whose value uniquely identifies each row. */
    rowKey: keyof Row & string
    caption?: string
  }>(),
  {
    caption: undefined,
  },
)

defineSlots<
  {
    empty(): unknown
  } & Record<`cell-${string}`, (props: { row: Row; value: unknown }) => unknown>
>()

const isEmpty = computed(() => props.rows.length === 0)

function rowId(row: Row): string {
  return String(row[props.rowKey])
}
</script>

<template>
  <div class="data-table" role="region" :aria-label="caption">
    <table class="data-table__table">
      <caption v-if="caption" class="data-table__caption">{{ caption }}</caption>
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            scope="col"
            class="data-table__th"
            :class="`data-table__cell--${col.align ?? 'left'}`"
            :style="col.width ? { width: col.width } : undefined"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="isEmpty">
          <td :colspan="columns.length" class="data-table__empty">
            <slot name="empty">
              <span class="data-table__empty-text">No data available.</span>
            </slot>
          </td>
        </tr>
        <tr v-for="row in rows" v-else :key="rowId(row)" class="data-table__row">
          <td
            v-for="col in columns"
            :key="col.key"
            class="data-table__td"
            :class="`data-table__cell--${col.align ?? 'left'}`"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.data-table {
  width: 100%;
  overflow-x: auto;

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }

  &__caption {
    padding: 0 0 $space-sm;
    color: var(--text-muted);
    font-size: 0.8125rem;
    text-align: left;
  }

  &__th {
    padding: $space-sm $space-md;
    border-bottom: 1px solid var(--glass-border);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  &__row {
    transition: background var(--transition-fast);

    &:hover {
      background: var(--glass-bg);
    }
  }

  &__td {
    padding: $space-sm $space-md;
    border-bottom: 1px solid var(--glass-border);
    color: var(--text);
    vertical-align: middle;
  }

  &__cell {
    &--left {
      text-align: left;
    }

    &--center {
      text-align: center;
    }

    &--right {
      text-align: right;
    }
  }

  &__empty {
    padding: $space-xl $space-md;
    text-align: center;
  }

  &__empty-text {
    color: var(--text-muted);
  }
}
</style>
