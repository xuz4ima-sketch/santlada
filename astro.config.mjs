// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Адрес сайта после покупки домена. Нужен для карты сайта и ссылок в заявках.
  site: 'https://santlada.ru',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
