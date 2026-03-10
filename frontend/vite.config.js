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
        }
    },
    envPrefix: ['VITE_', 'TAURI_'],
})
