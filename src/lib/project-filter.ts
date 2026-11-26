export function filterProjects<T extends { category: string; status: string }>(
  projects: readonly T[], { category, status }: { category?: string; status?: string },
) {
  return projects.filter(project => (!category || project.category === category) && (!status || project.status === status));
}
