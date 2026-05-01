/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        geist: ["Geist_400Regular", "sans-serif"],
        "geist-semibold": ["Geist_600SemiBold", "sans-serif"],
      },
      // ─────────────────────────────────────────────────────────────────
      // SPACING TOKENS (matches LayoutConstants.ts)
      // Use: gap-item, p-screen, m-section, etc.
      // ─────────────────────────────────────────────────────────────────
      spacing: {
        // Base scale (4px unit)
        'xs': '4px',      // Micro spacing
        'sm': '8px',      // Tight spacing
        'md': '12px',     // Compact spacing
        'lg': '16px',     // Default spacing
        'xl': '20px',     // Comfortable spacing
        '2xl': '24px',    // Roomy spacing
        '3xl': '32px',    // Section spacing
        '4xl': '48px',    // Large section spacing
        // Semantic aliases
        'screen': '16px', // Screen horizontal padding (px-screen)
        'section': '24px', // Gap between sections (gap-section)
        'item': '8px',   // Gap between list items (gap-item)
      },
      // ─────────────────────────────────────────────────────────────────
      // BORDER RADIUS TOKENS (matches LayoutConstants.ts)
      // Use: rounded-card, rounded-button, rounded-input, etc.
      // ─────────────────────────────────────────────────────────────────
      borderRadius: {
        // Base scale
        'xs': '4px',      // Subtle rounding
        'sm': '8px',      // Small rounding (tags)
        'md': '12px',     // Medium rounding (buttons)
        'lg': '16px',     // Large rounding (cards)
        'xl': '20px',     // Extra large (sheets)
        '2xl': '24px',    // Prominent rounding
        // Semantic aliases
        'input': '8px',   // Input fields, tags
        'button': '12px', // Buttons, action items
        'card': '6px',    // Cards, containers (grid aesthetic)
        'sheet': '24px',  // Bottom sheets, modals
      },
    },
  },
  plugins: [],
};
