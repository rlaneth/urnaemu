import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// Deployed under https://eleicoes.rlaneth.com/urnaemu/ (a dedicated Cloudflare Worker
			// routed at /urnaemu/*). The build is nested under build/urnaemu so the files sit at the
			// same paths the base-prefixed URLs use; serve build/ and the app lives at /urnaemu/.
			adapter: adapter({ pages: 'build/urnaemu', assets: 'build/urnaemu', strict: true }),
			paths: { base: '/urnaemu' }
		})
	],
	server: { fs: { strict: true } }
});
