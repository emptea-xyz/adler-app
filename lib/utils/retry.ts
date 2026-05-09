export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: { tries: number; baseMs: number },
): Promise<T> {
    const { tries, baseMs } = options;
    let attempt = 0;
    let lastError: unknown;
    while (attempt < tries) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            attempt += 1;
            if (attempt >= tries) break;
            const delayMs = baseMs * attempt;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    throw lastError instanceof Error ? lastError : new Error('retryWithBackoff failed');
}
