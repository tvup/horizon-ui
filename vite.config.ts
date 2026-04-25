import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

/**
 * Library build for @negoziator/horizon-ui.
 *
 * Produces an ESM bundle plus type declarations under dist/. Peer
 * dependencies are externalised so the consumer's bundle uses its own
 * vue / @inertiajs/vue3 / lucide-vue-next / reka-ui instances.
 */
export default defineConfig({
    plugins: [
        vue(),
        dts({
            entryRoot: 'js',
            include: ['js/**/*.ts', 'js/**/*.vue'],
            outDir: 'dist',
            tsconfigPath: 'tsconfig.json',
        }),
    ],
    build: {
        lib: {
            entry: fileURLToPath(new URL('./js/index.ts', import.meta.url)),
            formats: ['es'],
            fileName: () => 'horizon-ui.js',
        },
        rollupOptions: {
            external: [
                'vue',
                '@inertiajs/vue3',
                'lucide-vue-next',
                'reka-ui',
            ],
        },
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
    },
});
