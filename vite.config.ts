/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages など、サブフォルダ（/リポジトリ名/）に置いても動くよう相対パスにする
  base: './',
  test: {
    include: ['src/**/*.test.ts', 'gas/**/*.test.ts'],
  },
});
