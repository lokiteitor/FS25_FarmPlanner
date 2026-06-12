// features/production-manage/lib/errorMessages — map backend error codes to
// Spanish user-facing messages for production building operations.

import { isApiError } from '~/shared/api'

const ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_PRODUCTION_BUILDING_NAME: 'Ya existe un edificio con ese nombre en esta partida.',
  DUPLICATE_CHAIN_ID: 'Error interno: receta duplicada. Por favor, intenta de nuevo.',
  VALIDATION_ERROR: 'Los datos del edificio no son válidos.',
  PRODUCTION_BUILDING_NOT_FOUND: 'Edificio no encontrado.',
  FARM_NOT_FOUND: 'Partida no encontrada.',
}

export const GENERIC_BUILDING_ERROR =
  'Error inesperado al guardar el edificio. Inténtalo de nuevo.'

/** Map an error to a Spanish banner message, or null if none applies. */
export function buildingErrorMessage(err: unknown): string | null {
  if (isApiError(err)) {
    return ERROR_MESSAGES[err.code] ?? GENERIC_BUILDING_ERROR
  }
  if (err instanceof Error) return err.message
  return GENERIC_BUILDING_ERROR
}
