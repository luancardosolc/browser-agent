// ─── Page Context ───────────────────────────────────────────────────────────

export type PageType =
  | 'linkedin'
  | 'linkedin_easy_apply'
  | 'greenhouse'
  | 'workday'
  | 'lever'
  | 'indeed'
  | 'glassdoor'
  | 'form'
  | 'generic';

export const EXTERNAL_FORM_PAGE_TYPES: PageType[] = [
  'greenhouse', 'workday', 'lever', 'indeed', 'glassdoor', 'form', 'generic',
];

export interface PageContext {
  url: string;
  pageType: PageType;
  title: string;
  metadata: Record<string, unknown>;
}

// ─── Plugin System ───────────────────────────────────────────────────────────

export interface PluginResult {
  status: 'success' | 'error' | 'pending';
  data?: Record<string, unknown>;
  pendingQuestions?: PendingQuestion[];
  error?: string;
}

export interface PendingQuestion {
  label: string;
  fieldType: FieldType;
  options?: string[];
  required: boolean;
}

export interface Plugin {
  name: string;
  canHandle(context: PageContext): boolean;
  execute(context: PageContext, data: Record<string, unknown>): Promise<PluginResult>;
}

// ─── Form Intelligence ───────────────────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'file';

export interface DetectedField {
  element: HTMLElement;
  label: string;
  fieldType: FieldType;
  required: boolean;
  options?: string[];       // for select/radio/checkbox
  currentValue?: string;
  validationError?: string;
  groupName?: string;
}

export interface FillInstruction {
  label: string;
  value: string;
}

// ─── Commands (from backend) ─────────────────────────────────────────────────

export type CommandIntent =
  | 'autofill_form'
  | 'extract_data'
  | 'click'
  | 'navigate'
  | 'get_context'
  | 'resume_apply'
  | 'send_snapshot';

export interface Command {
  id: string;
  intent: CommandIntent;
  context?: string;
  data: Record<string, unknown>;
}

export interface CommandResult {
  commandId: string;
  status: 'success' | 'error' | 'pending';
  data?: Record<string, unknown>;
  error?: string;
}

// ─── Extension-driven Apply Session ─────────────────────────────────────────

/** DetectedField serializado (sem referência ao HTMLElement) para envio à API. */
export interface SnapshotField {
  label: string;
  fieldType: FieldType;
  required: boolean;
  options?: string[];
  currentValue?: string;
  validationError?: string;
}

/** Snapshot completo do DOM enviado pela extensão para a API a cada ciclo. */
export interface DomSnapshot {
  jobId: string;
  sessionToken: string;
  url: string;
  pageType: PageType;
  title: string;
  fields: SnapshotField[];
  buttons: { label: string; selector: string; role?: 'start' | 'next' | 'review' | 'submit' | 'upload' | 'other' }[];
  errors: string[];
  metadata: Record<string, unknown>;
  timestamp: number;
}

/** Estado local da sessão de apply na extensão. */
export interface ApplySession {
  jobId: string;
  sessionToken: string;
  status: 'idle' | 'running' | 'paused' | 'done';
}

export interface ApplyQueueItem {
  jobId: string;
  sessionToken: string;
  url: string;
}

// ─── Backend Memory ──────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  pattern: string;
  answer: string;
  updatedAt: string;
}

// ─── Extension Messages (between content <-> background) ─────────────────────

export type ExtensionMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'EXECUTE_COMMAND'; command: Command }
  | { type: 'START_APPLY_SESSION'; jobId: string; sessionToken: string; url: string }
  | { type: 'START_APPLY_QUEUE'; sessions: ApplyQueueItem[] }
  | { type: 'CONTENT_SCRIPT_READY' }
  | { type: 'QUEUE_PROGRESS'; status: 'next_job' | 'queue_finished'; detail?: string }
  | { type: 'PENDING_QUESTION'; question: PendingQuestion; jobId?: string }
  | { type: 'STATUS_UPDATE'; status: string; jobId?: string; sessionToken?: string; detail?: string };
