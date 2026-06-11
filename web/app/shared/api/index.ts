// shared/api — public API of the base HTTP client slice.
//
// Components/features/entities import from here ('~/shared/api'); they must
// never call `$fetch` directly (docs/arquitectura-frontend.md §8.1).

export {
  request,
  requestData,
  get,
  getData,
  post,
  postFull,
  patch,
  put,
  del,
  setAuthHooks,
  resetAuthHooks,
} from './client'

export type { AuthHooks, HttpMethod, RequestOptions } from './client'

export { ApiError, isApiError, normalizeError, ERROR_CODES } from './errors'

export type {
  ApiEnvelope,
  ResponseMeta,
  Pagination,
  ApiErrorDetail,
  ApiErrorPayload,
  ApiErrorEnvelope,
} from './types'
