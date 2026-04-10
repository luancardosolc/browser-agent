// ─── Page Context ───────────────────────────────────────────────────────────

export type PageType =
  | 'linkedin'
  | 'linkedin_easy_apply'
  | 'greenhouse'
  | 'workday'
  | 'lever'
  | 'form'
  | 'generic';

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
  | 'resume_apply';

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
  | { type: 'PENDING_QUESTION'; question: PendingQuestion; jobId?: string }
  | { type: 'STATUS_UPDATE'; status: string; detail?: string };
