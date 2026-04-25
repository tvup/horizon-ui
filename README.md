# Customizable Inertia-powered Horizon dashboard

`negoziator/horizon-ui` drops a fully-featured Horizon dashboard into any Laravel + Inertia application. It is rendered via Inertia (Vue 3) and exposes a complete REST API for queue management — all without requiring Ziggy or Wayfinder.

Features at a glance:

- Live stats: jobs/min, failures, process count, paused supervisors
- Queue metrics and per-supervisor workload
- Recent/failed/pending job browser with retry, forget, and bulk flush
- Batch browser with retry and cancel
- **Full-text job search** across class name, queue, tags, and payload content
- `viewHorizonUi` gate for fine-grained access control
- Optional `horizon-ui:auto-pause` command that pauses idle supervisors automatically
- Vue components shipped via npm — composes with your existing Vite + Inertia setup

## Requirements

| Dependency | Version |
|---|---|
| PHP | ≥ 8.4 |
| Laravel | ^11.0 \| ^12.0 \| ^13.0 |
| Laravel Horizon | ^5.0 |
| inertiajs/inertia-laravel | ^1.0 \| ^2.0 \| ^3.0 |
| **Frontend** | |
| Node.js | ≥ 18 |
| Vue | ^3.3 |
| Tailwind CSS | **v4** |
| reka-ui | ^2.0 |
| lucide-vue-next | ^0.400+ |

> **Tailwind v4 only.** The bundled components use v4 utility classes.

## Installation

The package ships in two halves — a Composer package for the PHP backend, and an npm package for the Vue components:

```bash
composer require negoziator/horizon-ui
npm install @negoziator/horizon-ui
php artisan horizon-ui:install
```

`horizon-ui:install` publishes `config/horizon-ui.php` and prints the dashboard URL. There is no `vendor:publish --tag=horizon-ui-vue` step — the Vue components live in `node_modules/@negoziator/horizon-ui/` and are imported directly.

### Tailwind v4 setup

In your Tailwind entry point (typically `resources/css/app.css`), import the package's `styles.css` so Tailwind picks up the components and declare the dark variant:

```css
@import "tailwindcss";
@import "@negoziator/horizon-ui/styles.css";
@custom-variant dark (@media (prefers-color-scheme: dark));
```

The package's `styles.css` contains `@source` directives pointing at the bundled `.vue` files, so Tailwind v4 generates only the utilities the dashboard actually uses. If your app uses a class-based dark-mode toggle, replace the `@custom-variant` line with:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

### Inertia page resolution

In `app.ts`, return the `HorizonDashboard` component when Inertia asks for it:

```ts
import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { HorizonDashboard } from '@negoziator/horizon-ui';
import type { DefineComponent } from 'vue';

createInertiaApp({
    resolve: async (name) => {
        if (name === 'HorizonDashboard') return HorizonDashboard;

        return await resolvePageComponent(
            `./pages/${name}.vue`,
            import.meta.glob<DefineComponent>('./pages/**/*.vue'),
        );
    },
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .mount(el);
    },
});
```

That's it. Updating later is `composer update && npm update` — no `vendor:publish --force`, no extra `npm run build` steps.

## Configuration

After publishing the config file you will find `config/horizon-ui.php`:

```php
return [
    // URL path for the dashboard
    'path' => 'horizon-ui',

    // Middleware applied to all routes (page + API)
    'middleware' => ['web', 'auth'],

    // Inertia component name — override to use your own page
    'view' => 'HorizonDashboard',

    // Set false to disable the dashboard page (API-only usage)
    'register_dashboard_route' => true,

    // Set false to disable all API routes
    'register_api_routes' => true,

    // Frontend polling interval in milliseconds
    'polling_interval' => 2000,

    // Auto-pause idle supervisors via the scheduler
    'auto_pause' => [
        'enabled' => false,
    ],

    // Job search: max jobs scanned per request
    'search' => [
        'scan_limit' => 1000,
    ],
];
```

## Authorization

The package defines a `viewHorizonUi` gate that defaults to `local` environments only. Override it in your `AppServiceProvider` to fit your app's access rules:

```php
use Illuminate\Support\Facades\Gate;

Gate::define('viewHorizonUi', fn ($user) => $user->isAdmin());
```

To enforce the gate at the routing layer, add it to the middleware list in `config/horizon-ui.php`:

```php
'middleware' => ['web', 'auth', 'can:viewHorizonUi'],
```

## Customizing the data layer

The `HorizonDashboardView` contract drives all dashboard data. Bind your own implementation to customise what is shown:

```php
use Negoziator\HorizonUi\Contracts\HorizonDashboardView;

$this->app->bind(HorizonDashboardView::class, MyCustomDashboardView::class);
```

Your implementation must satisfy the five methods defined in the contract: `stats()`, `queueMetrics()`, `recentJobs()`, `supervisors()`, and `recentBatches()`.

## Customising the Vue components

Vue components are imported by name (`HorizonDashboard`, `BatchesList`, `HorizonControls`, `JobSearchBar`, `JobsList`, `QueueMetrics`). The recommended way to customise is composition — wrap the package components in your own page and use the named slots `HorizonDashboard` exposes:

| Slot | Scope props | Default |
|---|---|---|
| `header` | `{ stats: HorizonStats }` | The gradient "Horizon Dashboard" hero panel |
| `footer` | — | Empty |

```vue
<script setup lang="ts">
import { HorizonDashboard } from '@negoziator/horizon-ui';

const props = defineProps<{
    horizonStats: any;
    queueMetrics: any;
    recentJobs: any[];
    supervisors: any[];
    recentBatches: any[];
    pollingInterval: number;
    routes: Record<string, string>;
}>();
</script>

<template>
    <MyAppLayout>
        <HorizonDashboard v-bind="props">
            <template #header="{ stats }">
                <MyCustomHeader :status="stats.status" />
            </template>

            <template #footer>
                <p class="text-xs text-neutral-500">Powered by your team.</p>
            </template>
        </HorizonDashboard>
    </MyAppLayout>
</template>
```

For deeper changes, fork the relevant component into your own project and import the fork instead of the package's named export. Avoid editing inside `node_modules/` directly — those changes are wiped on `npm install`.

### Route URLs in components

The package does not use Ziggy or Wayfinder. All API route URLs are built server-side in `HorizonDashboardController::buildRouteMap()` and passed to the page as an Inertia `routes` prop. Components receive the prop and call URLs directly:

```ts
router.post(props.routes.pause, {}, { preserveScroll: true })
```

If you add custom API routes, extend `buildRouteMap()` in a subclass or override the controller binding.

## Job search

The package exposes a search endpoint that scans jobs in PHP and filters across class name, queue name, tags, and the decoded payload:

```
GET /{path}/api/jobs/search
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Search term (required, min 2 chars) |
| `type` | string | `recent` | Job set: `recent`, `failed`, `pending`, `completed` |
| `queue` | string | — | Restrict to a specific queue name |
| `limit` | int | `search.page_size` | Max results to return (max `100`) |
| `cursor` | int | `0` | Offset to resume from (use `next_cursor` from the previous response) |

The response includes a `next_cursor` value for fetching the next page; it is `null` when results are exhausted.

The `jobSearch` URL is included in the Inertia `routes` prop so Vue components can call it directly:

```ts
axios.get(props.routes.jobSearch, { params: { q: 'SendEmail', type: 'failed' } })
```

### Search performance

The search fetches jobs from Horizon's Redis sorted sets in pages of 50 (Horizon's fixed page size), stopping once the requested number of results is found or the configured scan ceiling is reached. For large queues, keep queries specific and use the `queue` filter to narrow the scan.

Both the default page size and the scan ceiling are configurable in `config/horizon-ui.php`:

```php
'search' => [
    'page_size'  => 25,   // default results per request (overridable via ?limit=)
    'scan_limit' => 1000, // max jobs scanned per request
],
```

For installations with tens of thousands of jobs, document that search is intended for development and small-to-medium production queues. Very large queues may need an external index (e.g. Redis Search).

## Auto-pause command

When `auto_pause.enabled` is `true`, the package schedules `horizon-ui:auto-pause` every minute. The command checks each supervisor's queues and pauses supervisors whose queues have been empty for a configurable period, then resumes them when jobs arrive again.

You can also run it manually:

```bash
php artisan horizon-ui:auto-pause
```

## Testing

```bash
composer install
./vendor/bin/pest
```

## Building the npm package

The Vue layer is built with Vite library mode. Source `.vue` and `.ts` files live under `js/`; `npm run build` produces `dist/horizon-ui.js` plus type declarations:

```bash
npm install
npm run type-check
npm run build
```

`dist/` is gitignored — only the built artefacts inside it ship to npm (along with `js/styles.css` and the source Vue files referenced by the CSS partial's `@source` directives, so consumer-side Tailwind v4 can scan them).

## Release process

A single git tag (`v2.0.0`, etc.) drives both releases:

1. Bump the version in `composer.json` and `package.json` (must match the tag, minus the leading `v`).
2. Update `CHANGELOG.md`.
3. Tag and push: `git tag v2.0.0 && git push --tags`.
4. The `Release` GitHub Action runs:
   - Creates a GitHub Release from the changelog section.
   - Type-checks, builds, and publishes the npm package with provenance, picking `latest` for stable tags and `next` for prereleases (`v2.0.0-alpha.1`).
5. Packagist auto-publishes the Composer side via its GitHub App webhook — no extra workflow step.

Required repo secret: `NPM_TOKEN` (a granular access token scoped to the `@negoziator/horizon-ui` package, write permission).

## Migrating from v1.x

v2.0 changes how the frontend is distributed.

| | v1.x | v2.0 |
|---|---|---|
| Frontend distribution | `vendor:publish --tag=horizon-ui-vue` (copies `.vue` into `resources/js/vendor/horizon-ui/`) | `npm install @negoziator/horizon-ui` |
| Updates | `composer update && vendor:publish --force && npm run build` | `composer update && npm update` |
| Tailwind setup | Manual `@source '../js/vendor/horizon-ui/**/*.vue';` in `app.css` | One `@import "@negoziator/horizon-ui/styles.css";` |
| Customisation | Edit published `.vue` files in your project | Composition / fork into your own component |

### Migration steps

1. `npm install @negoziator/horizon-ui`
2. Replace your Inertia resolver block with the named-import version (see *Inertia page resolution* above).
3. In `resources/css/app.css`:
   - Remove `@source '../js/vendor/horizon-ui/**/*.vue';` (or any equivalent line auto-injected by the v1 installer).
   - Add `@import "@negoziator/horizon-ui/styles.css";`.
   - Add `@custom-variant dark (...)` if you don't already have one.
4. Delete `resources/js/vendor/horizon-ui/` from your project.
5. If you had forked any of the components, move the fork into your own `resources/js/components/` and import it there instead of the package's named export.

The PHP API surface (controllers, gate, search service, config) is unchanged — only the frontend distribution differs.

## Contributing

Pull requests are welcome. Please open an issue first for significant changes.

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
