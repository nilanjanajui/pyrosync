/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0B1014',           // Deep slate / near-black shell
          surface1: '#11181E',     // Primary surface
          surface2: '#151E25',     // Secondary surface
          elevated: '#1A252D',     // Elevated surface
          border: '#1E2B35',       // Low-contrast cool gray border
          borderLight: '#2C3E4C',  // Focus / active border
          text: '#F0F4F8',         // Near-white primary text
          textMuted: '#8C9BAE',    // Muted gray-blue secondary text
          textSubdued: '#5A6B7C',  // Subdued cool gray metadata
          accent: '#F97316',       // Tactical fire orange
          accentGlow: 'rgba(249, 115, 22, 0.4)',
          contour: 'rgba(168, 85, 247, 0.25)', // Isolines purple
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
