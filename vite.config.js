import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` must match the repository name, because GitHub Pages serves a project
// site from https://<user>.github.io/<repo>/ rather than from the domain root.
// Without it the built index.html asks for /assets/... and gets a 404, which
// shows up as a blank page with no console error worth reading.
// Dev is unaffected: base only applies to the build.
export default defineConfig({
  base: '/neurolympics/',
  plugins: [react()],
})
