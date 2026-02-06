/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#6366f1',
                    hover: '#4f46e5',
                },
                bg: '#0f172a',
                'card-bg': '#1e293b',
                text: {
                    DEFAULT: '#f8fafc',
                    muted: '#94a3b8',
                },
                accent: '#a855f7',
            },
            fontFamily: {
                sans: ['"Outfit"', '"Inter"', 'sans-serif'],
            },
            animation: {
                pulse: 'pulse 8s ease-in-out infinite alternate',
            }
        },
    },
    plugins: [],
}
