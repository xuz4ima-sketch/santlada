// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Адрес сайта после покупки домена. Нужен для карты сайта и ссылок в заявках.
  site: process.env.SITE_URL ?? 'https://santlada.ru',
  // На GitHub Pages сайт лежит в подпапке (SITE_BASE=/santlada/), на своём домене — в корне.
  base: process.env.SITE_BASE ?? '/',
  // Разрешаем открывать превью через туннель (ссылка для проверки на телефоне).
  server: { allowedHosts: true },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
