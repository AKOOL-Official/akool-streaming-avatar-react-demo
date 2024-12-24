import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: `/streaming/avatar`,
  server: {
    host: '0.0.0.0'
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

})
