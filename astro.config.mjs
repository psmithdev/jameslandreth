// @ts-check
import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  // Suppress the auto-configured Cloudflare KV session binding — this app
  // does not use Astro sessions. Memory driver is a no-op stand-in.
  session: {
    driver: sessionDrivers.memory(),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
