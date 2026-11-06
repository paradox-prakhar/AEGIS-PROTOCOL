import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Tailwind v4 runs as a Vite plugin; `@/` matches the alias shadcn/Vengeance components import from.
export default defineConfig({
  plugins: [tailwindcss()],
  // Automatic JSX runtime: shadcn/Vengeance components don't import React.
  esbuild: { jsx: 'automatic' },
  build: {
    rollupOptions: {
      // framer-motion ships "use client" directives (for Next RSC); harmless in Vite.
      onwarn(w, warn) { if (w.code !== 'MODULE_LEVEL_DIRECTIVE') warn(w); },
    },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
