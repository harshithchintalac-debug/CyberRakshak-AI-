/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#080B12',
        bg2: '#0D1220',
        surface: 'rgba(21,28,45,0.55)',
        border1: 'rgba(255,255,255,0.08)',
        teal: '#00D9C0',
        violet: '#7C6CF0',
        danger: '#FF4D6A',
        warning: '#FFB020',
        safe: '#2ED47A',
        muted: '#8B93A7',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: { xl2: '16px' },
    },
  },
  plugins: [],
}
