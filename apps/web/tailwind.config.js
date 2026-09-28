/** @type {import('tailwindcss').Config} */
export default {
  // The app toggle writes `dark`/`light` onto <html> (see App.tsx + the
  // pre-paint script in index.html). Without this key Tailwind 3 defaults to
  // `darkMode: 'media'`, which gates every `dark:` variant behind
  // `@media (prefers-color-scheme: dark)` and silently ignores the toggle.
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic surfaces. Use these instead of raw hex so light/dark stay
        // paired. `surface` is the page base, `card` the raised surface.
        surface: {
          DEFAULT: '#0a0e16',
          subtle: '#10141f',
          raised: '#0f131c',
          elevated: '#141824',
          hover: '#1a2030',
        },
        // Text on top of the surfaces above.
        content: {
          DEFAULT: '#dfe2ee',
          muted: '#94a3b8',
          faint: '#64748b',
        },
      },
    },
  },
  plugins: [],
}
