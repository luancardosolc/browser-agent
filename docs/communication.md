# Comunicação com o Backend

## Backend base URL

`http://localhost:3001` (NestJS job-tracker API)

## Endpoints esperados

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/automation/knowledge` | Retorna `KnowledgeEntry[]` |
| `POST` | `/automation/knowledge` | Salva nova entrada de conhecimento |
| `POST` | `/automation/execute` | Executa um `Command` e retorna `CommandResult` |
| `POST` | `/automation/pending-question` | Envia pergunta pendente para o usuário responder no Job Tracker UI |

## Formato de comando

```json
{
  "id": "uuid",
  "intent": "autofill_form",
  "context": "generic_form",
  "data": { "answers": { "Campo X": "valor" } }
}
```

## Formato de resultado

```json
{
  "commandId": "uuid",
  "status": "success",
  "data": { "filledCount": 5 }
}
```

## Mensagens internas (content ↔ background ↔ popup)

Usam `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`:

```ts
// GET_CONTEXT
{ type: 'GET_CONTEXT' }

// EXECUTE_COMMAND
{ type: 'EXECUTE_COMMAND', command: Command }
```
