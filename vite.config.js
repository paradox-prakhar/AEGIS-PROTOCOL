import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Tailwind v4 runs as a Vite plugin; `@/` matches the alias shadcn/Vengeance components import from.
export default defineConfig({
  plugins: [tailwindcss()],
  // Automatic JSX runtime: shadcn/Vengeance components don't import React.
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // framer-motion ships "use client" directives (for Next RSC); harmless in Vite,
      // and rollup then can't map them in sourcemaps. Both warnings are noise.
      onwarn(w, warn) { if (w.code !== 'MODULE_LEVEL_DIRECTIVE' && w.code !== 'SOURCEMAP_ERROR') warn(w); },
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          ethers: ['ethers'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
