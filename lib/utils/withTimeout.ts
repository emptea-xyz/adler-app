/**
 * Error class for timeout failures
 */
class TimeoutError extends Error {
    constructor(message = 'Operation timed out') {
        super(message);
        this.name = 'TimeoutError';
    }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within the specified time, it rejects with a TimeoutError.
 *
 * @param promise - The promise to wrap
 * @param ms - Timeout in milliseconds
 * @param errorMessage - Optional custom error message
 * @returns The resolved value if completed in time
 * @throws TimeoutError if the timeout is exceeded
 *
 * @example
 * ```typescript
 * const data = await withTimeout(fetch('/api'), 5000, 'API request timed out');
 * ```
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    errorMessage?: string
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new TimeoutError(errorMessage ?? `Operation timed out after ${ms}ms`));
            }, ms);
        }),
    ]);
}
