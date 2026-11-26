import { budgetPlanner } from '../data/budget.ts';

export const euros = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function estimateBudget(scope: string, budget: number) {
  const { minimum, maximum, step } = budgetPlanner;
  const project = budgetPlanner.scopes.find(project => project.name === scope);
  if (!project || !Number.isInteger(budget) || budget < minimum || budget > maximum || (budget - minimum) % step) return;
  const example = project.examples.reduce((last, example) => example.budget <= budget ? example : last);
  return { project: project.name, budget, currency: 'EUR', display: euros.format(budget) + (budget === maximum ? '+' : ''), scope: example.scope };
}
