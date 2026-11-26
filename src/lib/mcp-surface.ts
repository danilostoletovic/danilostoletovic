export const toolDescriptions = {
  get_profile: 'Retrieve Danilo Stoletović’s professional profile and verified public links.',
  get_experience: 'Retrieve documented independent and freelance experience.',
  list_services: 'List commercial software, consulting, and deployment services.',
  list_projects: 'List public projects. Filter by category or development status.',
  get_project: 'Retrieve a project by its stable identifier.',
  list_case_studies: 'List case studies, optionally for one project.',
  get_case_study: 'Retrieve a case study by its stable identifier.',
  list_publications: 'List verified publication records, optionally by publication status.',
  list_achievements: 'List verified achievements, optionally for one project.',
  list_news: 'List public coverage and official results, optionally by year.',
  list_profiles: 'List verified public profiles. Filter by category or identity type.',
  get_contact: 'Retrieve the public professional email address and telephone number.',
  search_content: 'Search projects, cases, services, publications, achievements, news, and public profiles.',
} as const;

export const resources = [
  { id: 'professional', key: 'profile', title: 'Professional profile' },
  { id: 'experience', key: 'experience', title: 'Experience' },
  { id: 'services', key: 'services', title: 'Services' },
  { id: 'projects', key: 'projects', title: 'Projects' },
  { id: 'publications', key: 'publications', title: 'Publications' },
  { id: 'case-studies', key: 'case-studies', title: 'Case studies' },
  { id: 'achievements', key: 'achievements', title: 'Achievements' },
  { id: 'news', key: 'news', title: 'News and recognition' },
  { id: 'links', key: 'links', title: 'Public profiles' },
  { id: 'contact', key: 'contact', title: 'Professional contact' },
] as const;

export const resourceUri = (id: string) => `profile://${id}`;
