import type { Profile } from '@/lib/types/profile';

/**
 * Derive a single creator/brand role for legacy paths that haven't been
 * migrated to the dual-side `isCreator` / `isBrand` model. Picks creator
 * over brand when both are set up. Returns null when neither is.
 *
 * @deprecated Use `profile.isCreator` / `profile.isBrand` directly. This
 * shim only exists so the step-1 UI keeps compiling. ViewModeContext in
 * step 2 replaces every consumer with a persisted preference + ProfileGate.
 */
export function viewModeFor(
    profile: Profile | null | undefined,
): 'creator' | 'brand' | null {
    if (!profile) return null;
    if (profile.isCreator) return 'creator';
    if (profile.isBrand) return 'brand';
    return null;
}
