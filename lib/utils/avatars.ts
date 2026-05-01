/**
 * Avatar URL resolver. Used to map a stored avatar reference (which can be a
 * full URL, a Firebase Storage path, or null) to a renderable URL.
 *
 * For v1 we return the input as-is and let consumers handle null fallbacks.
 */
export function resolveAvatarUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    return value;
}
