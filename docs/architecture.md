# Arquitetura — Browser Automation Agent Extension

## Visão geral

```
Backend (NestJS :3001)
        │  HTTP REST
        ▼
┌─────────────────────────────────────────────┐
│  Chrome Extension                           │
│                                             │
│  popup ──► background ──► content script   │
│                               │             │
│                          CoreEngine         │
│                          ├─ PluginRegistry  │
│                          ├─ ContextDetector │
│                          ├─ ActionExecutor  │
│                          └─ FormIntelligence│
└─────────────────────────────────────────────┘
```

## Módulos

| Módulo | Arquivo | Responsabilidade |
|---|---|---|
| Types | `src/types/index.ts` | Interfaces e tipos compartilhados |
| CoreEngine | `src/core/engine.ts` | Orquestrador central de comandos |
| PluginRegistry | `src/core/plugin-registry.ts` | Registro e despacho de plugins |
| FormIntelligence | `src/core/form-intelligence.ts` | Detecção de campos, leitura de erros, autocorreção |
| ContextDetector | `src/context/detector.ts` | Detecta tipo de página atual |
| ActionExecutor | `src/actions/executor.ts` | click, fill, select, navigate — resiliente a React |
| DomExtractor | `src/extractors/dom-extractor.ts` | Extração de dados estruturados |
| BackendClient | `src/communication/client.ts` | REST com o backend NestJS |
| Background | `src/entrypoints/background.ts` | Service worker, relay de mensagens |
| Content | `src/entrypoints/content.ts` | Entry point injetado na página |
| Popup | `src/entrypoints/popup/` | UI mínima de controle |

## Fluxo de execução

1. Popup ou backend envia `Command` para o content script
2. `CoreEngine.dispatch()` avalia o `intent`
3. Para `autofill_form`/`resume_apply`: delega ao `PluginRegistry`
4. O plugin correto é selecionado via `canHandle(context)`
5. Plugin usa `FormIntelligence` para detectar campos e preencher
6. Se faltar resposta: retorna `status: pending` com `pendingQuestions`
7. Resultado é retornado ao chamador
