import { Toast } from 'toastify-react-native'

type ToastPosition = 'top' | 'bottom' | 'center'

/**
 * Configuration options for displaying a toast notification.
 */
type ToastOptions = {
  /** Additional text to display below the main message */
  description?: string
  /** Position of the toast on screen */
  position?: ToastPosition
  /** Duration in milliseconds to show the toast (default: 3000) */
  duration?: number
  /** Callback function when toast is pressed */
  onPress?: () => void
}

const DEFAULT_POSITION: ToastPosition = 'top'
const DEFAULT_DURATION = 3000

const isToastOptions = (value: unknown): value is ToastOptions => {
  if (typeof value !== 'object' || value === null) return false
  return 'description' in value || 'position' in value || 'duration' in value || 'onPress' in value
}

/**
 * Utility for displaying toast notifications.
 * Wrapper around toastify-react-native with consistent styling and options.
 */
export const toast = {
  /**
   * Show a success toast
   * @param message - Main message text
   * @param options - Optional configuration (description, duration, etc.)
   */
  success: (message: string, options?: ToastOptions) => {
    const { position } = options ?? {}

    Toast.success(message, position ?? DEFAULT_POSITION)

    // Show description as a separate toast if provided
    if (options?.description?.trim()) {
      setTimeout(() => {
        Toast.info(options.description!, position ?? DEFAULT_POSITION)
      }, 100)
    }
  },

  /**
   * Show an error toast
   * @param message - Main error message
   * @param errorOrOptions - Optional error object or options
   * @param maybeOptions - Options if second argument was an error object
   */
  error: (message: string, errorOrOptions?: unknown, maybeOptions?: ToastOptions) => {
    let options = maybeOptions

    if (isToastOptions(errorOrOptions)) {
      options = errorOrOptions as ToastOptions
    }

    const { position } = options ?? {}

    Toast.error(message, position ?? DEFAULT_POSITION)

    // Show description as a separate toast if provided
    if (options?.description?.trim()) {
      setTimeout(() => {
        Toast.error(options.description!, position ?? DEFAULT_POSITION)
      }, 100)
    }
  },

  /**
   * Show an info toast
   * @param message - Main message text
   * @param options - Optional configuration
   */
  info: (message: string, options?: ToastOptions) => {
    const { position } = options ?? {}

    Toast.info(message, position ?? DEFAULT_POSITION)

    // Show description as a separate toast if provided
    if (options?.description?.trim()) {
      setTimeout(() => {
        Toast.info(options.description!, position ?? DEFAULT_POSITION)
      }, 100)
    }
  },

  /**
   * Show a warning toast
   * @param message - Main message text
   * @param options - Optional configuration
   */
  warn: (message: string, options?: ToastOptions) => {
    const { position } = options ?? {}

    Toast.warn(message, position ?? DEFAULT_POSITION)

    // Show description as a separate toast if provided
    if (options?.description?.trim()) {
      setTimeout(() => {
        Toast.warn(options.description!, position ?? DEFAULT_POSITION)
      }, 100)
    }
  },

  /**
   * Hide the currently visible toast
   */
  hide: () => {
    Toast.hide()
  },
}

