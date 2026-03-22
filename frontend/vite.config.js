import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    server: {
        port: 1423,
        strictPort: true,
        host: true,
        watch: {
            ignored: ["**/src-tauri/**", "**/models/**", "**/uploads/**"]
        },
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:1425',
                changeOrigin: true,
                ws: true
            },
            '/uploads': {
                target: 'http://127.0.0.1:1425',
                changeOrigin: true
            }
        }
    },
    envPrefix: ['VITE_', 'TAURI_'],
})
