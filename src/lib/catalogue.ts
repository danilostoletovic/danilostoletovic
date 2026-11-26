import {
  achievements, cases, collaboration, education, experience, news, person,
  profiles, projects, publications, services, site, skills, orcidUrl, type Entry, type Publication,
} from '../data/public';

export const personId = `${site}/#person`;
export const mcpUrl = `${site}/mcp`;
export const contact = { email: person.email, telephone: person.telephone, url: `${site}/#contact` };
export const telephoneHref = `tel:${person.telephone}`;
export const telephoneLabel = person.telephone.replace(/^(\+381)(\d{2})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
export const projectPath = (id: string) => `/side-projects/${id}/`;
export const casePath = (id: string) => `/case/${id}/`;
export const publicationPath = (id: string) => `/academia/${id}/`;

const publicWorks = publications.map(work => ({
  ...work,
  authors: work.authors.map(author => `${author.givenName} ${author.familyName}`),
  authorDetails: work.authors.map(author => ({ ...author, orcidUrl: author.orcid ? orcidUrl(author.orcid) : undefined })),
  url: site + publicationPath(work.id),
  doiUrl: work.doi ? `https://doi.org/${work.doi}` : undefined,
}));

export type PublicWork = typeof publicWorks[number];
export const publicationStatus = (work: Publication | PublicWork) =>
  work.status === 'Published' && work.proceedings?.format === 'Print' ? 'Published in printed conference proceedings' : work.status;

export function publicationReference(work: PublicWork) {
  return [
    work.authors.join(', '), work.venue, work.proceedings?.location, work.date, work.publicationType,
    work.proceedings && `Starts on page ${work.proceedings.firstPage}`,
    work.proceedings && `ISBN ${work.proceedings.isbn}`, work.doi && `DOI ${work.doi}`,
    publicationStatus(work),
  ].filter(Boolean).join(' · ');
}

export const publicProfile = { ...person, orcidUrl: orcidUrl(person.orcid), site, contact, profiles, experience, education, skills, publications: publicWorks };

export const catalogue = {
  profile: publicProfile,
  experience,
  projects: projects.map(project => ({ ...project, url: site + projectPath(project.id) })),
  'case-studies': cases.map(study => ({ ...study, url: site + casePath(study.id) })),
  publications: publicWorks,
  services,
  achievements,
  news,
  links: profiles,
  contact,
};

export const cv = {
  ...person,
  links: profiles.filter(profile => profile.primary || profile.id === 'orcid'),
  sections: [
    { title: 'Professional experience', items: experience },
    { title: 'Technical skills', items: skills.map(group => ({ title: group.title, summary: group.items.join(', ') })) },
    {
      title: 'Selected software',
      items: catalogue.projects
        .filter(project => project.includeInCv)
        .map(project => ({ title: project.title, summary: project.summary, url: project.url })),
    },
    {
      title: 'Research & recognition',
      items: [
        ...publicWorks.map(work => ({
          title: work.title, summary: publicationReference(work), url: work.url,
        })),
        ...achievements.map(item => ({ title: item.title, summary: item.summary, url: item.sources[0]?.url })),
      ],
    },
    { title: 'Education', items: education },
  ] satisfies { title: string; items: readonly { title: string; summary: string; url?: string }[] }[],
};

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/;

function requireHttps(value: string, hint: string) {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`Invalid URL for ${hint}`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`Expected a public HTTPS URL for ${hint}`);
}

export function validateCatalogue() {
  const collections = { experience, education, projects, cases, publications, services, achievements, news, profiles };
  for (const [name, items] of Object.entries(collections)) {
    const identifiers = new Set<string>();
    for (const item of items as readonly Entry[]) {
      if (!idPattern.test(item.id) || identifiers.has(item.id)) throw new Error(`Invalid or duplicate ID ${name}/${item.id}`);
      identifiers.add(item.id);
      if (!item.title.trim() || !item.summary.trim() || !item.sources.length) throw new Error(`Incomplete content in ${name}/${item.id}`);
      for (const source of item.sources) {
        if (!source.label.trim()) throw new Error(`Unlabelled source in ${name}/${item.id}`);
        requireHttps(source.url, item.id);
      }
    }
  }
  const projectIds = new Set(projects.map(project => project.id));
  for (const item of [...cases, ...publications, ...achievements, ...news]) {
    if (item.project && !projectIds.has(item.project)) throw new Error(`Unknown project ${item.project} in ${item.id}`);
  }
  for (const item of [...publications, ...achievements, ...news]) {
    if (!datePattern.test(item.date) || (item.date.length === 10 && new Date(item.date).toISOString().slice(0, 10) !== item.date)) {
      throw new Error(`Invalid date in ${item.id}`);
    }
  }
  const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
  if (!orcidPattern.test(person.orcid)) throw new Error('Invalid professional ORCID');
  for (const work of publications) {
    if (!work.venue.trim() || !work.authors.length || work.authors.some(author => !author.givenName.trim() || !author.familyName.trim() || (author.orcid && !orcidPattern.test(author.orcid)))) throw new Error(`Missing or invalid publication metadata in ${work.id}`);
    if (work.doi && !/^10\.\d{4,9}\/\S+$/.test(work.doi)) throw new Error(`Invalid DOI in ${work.id}`);
    if (work.proceedings) {
      const { isbn, firstPage, location, organizers } = work.proceedings;
      const digits = isbn.replaceAll('-', '');
      const checksum = [...digits].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0);
      if (!/^97[89]\d{10}$/.test(digits) || checksum % 10 !== 0 || !Number.isInteger(firstPage) || firstPage < 1 || !location.trim() || !organizers.length || organizers.some(value => !value.trim())) {
        throw new Error(`Invalid conference proceedings metadata in ${work.id}`);
      }
    }
  }
  for (const item of [...profiles, ...news, ...projects.flatMap(project => project.links)]) requireHttps(item.url, item.url);
  for (const project of projects) {
    if (!project.role.trim() || !project.stack.length || !project.links.length) throw new Error(`Missing project details in ${project.id}`);
    if (project.image && (!project.image.alt.trim() || !project.image.file.startsWith('/images/') || project.image.width <= 0 || project.image.height <= 0)) {
      throw new Error(`Invalid project image in ${project.id}`);
    }
  }
  if (!/^\+[1-9]\d{1,14}$/.test(person.telephone)) throw new Error('Expected an E.164 professional telephone number');
  if (!person.name.trim() || !person.title.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) throw new Error('Incomplete professional identity');
}

export const directories = [
  { href: '/commerce/', title: 'Commercial work', nav: 'Commerce', summary: 'Software, web, AI, and infrastructure services', icon: 'briefcase' },
  { href: '/academia/', title: 'Academic work', nav: 'Academia', summary: 'Research, demonstrations, and awards', icon: 'cap' },
  { href: '/side-projects/', title: 'Independent projects', nav: 'Projects', summary: 'Released apps, open source, and experiments', icon: 'code' },
  { href: '/case/', title: 'Case studies', nav: 'Case studies', summary: 'Engineering decisions and implementation', icon: 'case' },
  { href: '/news/', title: 'News & recognition', nav: 'News', summary: 'Press coverage and official results', icon: 'news' },
  { href: '/cv/', title: 'Curriculum vitae', nav: 'CV', summary: 'Experience, skills, and a downloadable CV', icon: 'file' },
] as const;

export { collaboration };
