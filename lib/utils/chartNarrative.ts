/**
 * Accessibility narration helpers for charts. Kept as no-ops for v1 — the chart
 * primitives still call them so the module needs to exist. Re-implement when
 * we ship marketplace analytics dashboards that need VoiceOver/TalkBack support.
 */

export function generateChartNarrative(..._args: unknown[]): string {
    return '';
}

export function generateHeatmapNarrative(..._args: unknown[]): string {
    return '';
}
