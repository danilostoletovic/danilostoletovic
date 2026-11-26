import { discovery } from '../config/discovery';
import { filterProjects } from '../lib/project-filter';

interface InputField {
  type?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  default?: unknown;
}
type InputSchema = { type: 'object'; properties: Record<string, InputField>; required?: string[] };
type Tool = { name: string; description: string; inputSchema: InputSchema; page?: string; endpoint?: string; readOnly: boolean };
type ModelContext = {
  registerTool(tool: {
    name: string; description: string; inputSchema: InputSchema;
    annotations: { readOnlyHint: boolean };
    execute(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
  }): unknown;
  waitForToolsUntil?(registration: Promise<void>): void;
};

function matchesInput(schema: InputSchema, input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const values = input as Record<string, unknown>;
  if (schema.required?.some(key => !Object.hasOwn(values, key))) return false;
  return Object.entries(values).every(([key, value]) => {
    if (!Object.hasOwn(schema.properties, key)) return false;
    const field = schema.properties[key];
    if (field.enum) return typeof value === 'string' && field.enum.includes(value);
    return field.type === 'integer' && typeof value === 'number' && Number.isInteger(value) &&
      value >= (field.minimum ?? -Infinity) && value <= (field.maximum ?? Infinity) &&
      (field.multipleOf === undefined || value % field.multipleOf === 0);
  });
}

async function register(context: ModelContext) {
  const response = await fetch(discovery.webmcp.path, { redirect: 'error' });
  if (!response.ok) throw new Error('Tool metadata unavailable');
  const { tools } = await response.json() as { tools: Tool[] };
  for (const { name, description, inputSchema, page, endpoint, readOnly } of tools) {
    if (page && page !== location.pathname) continue;
    await context.registerTool({
      name, description, inputSchema, annotations: { readOnlyHint: readOnly },
      async execute(input, options) {
        if (!matchesInput(inputSchema, input)) return { error: 'Invalid tool input.' };
        if (name === 'estimate_budget') {
          if (typeof input.scope !== 'string' || typeof input.budget !== 'number') return { error: 'Invalid budget or project type.' };
          const { estimateBudget } = await import('../lib/budget-estimate');
          return estimateBudget(input.scope, input.budget) ?? { error: 'Invalid budget or project type.' };
        }
        if (!endpoint?.startsWith('/') || endpoint.startsWith('//')) return { error: 'Tool endpoint unavailable.' };
        const data = await fetch(endpoint, { signal: options?.signal, redirect: 'error' });
        if (!data.ok) return { error: 'Public catalogue unavailable.' };
        const result = await data.json();
        if (!Array.isArray(result)) return result;
        const items = name === 'list_projects' ? filterProjects(result, {
          category: typeof input.category === 'string' ? input.category : undefined,
          status: typeof input.status === 'string' ? input.status : undefined,
        }) : result;
        return { items: items.slice(0, Number(input.limit ?? inputSchema.properties.limit?.default)), total: items.length };
      },
    });
  }
}

const context = (document as Document & { modelContext?: ModelContext }).modelContext ??
  (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
if (typeof context?.registerTool === 'function') {
  const registration = register(context).catch(() => {
    // An unavailable experimental API does not affect the site's ordinary controls.
  });
  context.waitForToolsUntil?.(registration);
}
