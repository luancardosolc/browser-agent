# Plugins

## Interface

```ts
interface Plugin {
  name: string
  canHandle(context: PageContext): boolean
  execute(context: PageContext, data: Record<string, unknown>): Promise<PluginResult>
}
```

## Plugins built-in

| Plugin | `canHandle` | Descrição |
|---|---|---|
| `form_autofill` | `form`, `greenhouse`, `lever`, `workday`, `generic` | Preenche formulários genéricos usando knowledge base + respostas fornecidas |
| `job_apply_helper` | `linkedin`, `linkedin_easy_apply` | Extrai dados de vaga LinkedIn e abre/navega Easy Apply modal |
| `scraper_basic` | todos | Extrai dados estruturados de qualquer página |

## Criando um novo plugin

```ts
// src/plugins/my-plugin/index.ts
import type { Plugin, PageContext, PluginResult } from '@/types';

export const myPlugin: Plugin = {
  name: 'my_plugin',

  canHandle(ctx: PageContext): boolean {
    return ctx.url.includes('mysite.com');
  },

  async execute(ctx, data): Promise<PluginResult> {
    // lógica aqui
    return { status: 'success', data: { result: 'ok' } };
  },
};
```

Registrar no content script:

```ts
// src/entrypoints/content.ts
import { myPlugin } from '@/plugins/my-plugin';
engine.registry.register(myPlugin);
```
