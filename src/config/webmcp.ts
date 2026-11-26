import * as z from 'zod/v4';
import { budgetPlanner } from '../data/budget.ts';
import { mcpTools, resourcePath } from '../lib/mcp-surface.ts';
import { jsonSchema } from '../lib/catalogue-schema.ts';

export const webmcpForms = {
  budget: {
    name: 'preview_budget',
    description: 'Fill the budget planner and show a local example scope. This does not send an inquiry.',
    fields: { scope: 'Type of project to estimate.', budget: 'Planning budget in euros.' },
    autoSubmit: true,
  },
  ana: {
    name: 'prepare_ana_question',
    description: 'Prepare a question about public services or projects for Ana. The visitor must review and submit it.',
    fields: { message: 'A question about public professional information. Leave out private or confidential details.' },
    maxLength: 2000,
    autoSubmit: false,
  },
} as const;

export function formAttributes(tool: { name: string; description: string; autoSubmit: boolean }) {
  return { toolname: tool.name, tooldescription: tool.description, ...(tool.autoSubmit ? { toolautosubmit: '' } : {}) };
}

const { minimum, maximum, step, scopes } = budgetPlanner;
const budgetInput = z.strictObject({
  scope: z.enum(scopes.map(scope => scope.name)),
  budget: z.number().int().min(minimum).max(maximum).multipleOf(step),
});

const catalogueTools = {
  list_services: 'services',
  list_projects: 'projects',
  get_contact: 'contact',
  get_profile: 'profile',
} as const;

export function webmcpManifest() {
  return {
    forms: webmcpForms,
    tools: [
      ...Object.entries(catalogueTools).map(([name, resource]) => {
        const capability = mcpTools[name as keyof typeof catalogueTools];
        return {
          name, description: capability.description, inputSchema: jsonSchema(capability.input, { io: 'input' }),
          endpoint: resourcePath(resource), readOnly: true,
        };
      }),
      {
        name: 'estimate_budget',
        description: 'Return an example software project scope for a planning budget in euros.',
        inputSchema: jsonSchema(budgetInput, { io: 'input' }),
        page: '/commerce/', readOnly: true,
      },
    ],
  };
}
