import { achievements, orcidUrl, person, profiles, site, skills } from '../data/public';
import { personId, projectPath, publicationStatus, type PublicWork } from './catalogue';

export type Schema = Record<string, unknown>;
const identity = {
  '@type': 'Person',
  '@id': personId,
  name: person.name,
  alternateName: person.alternateNames,
  url: site + '/',
  image: site + person.portrait,
  email: person.email,
  telephone: person.telephone,
  identifier: { '@type': 'PropertyValue', propertyID: 'ORCID', value: person.orcid, url: orcidUrl(person.orcid) },
  jobTitle: person.title,
  knowsAbout: skills.flatMap(group => [...group.items]),
  award: achievements.map(item => item.title),
  sameAs: profiles.filter(profile => profile.identity === 'personal').map(profile => profile.url),
};

export const author = { '@id': personId };

export function publicationSchema(work: PublicWork): Schema {
  const event = {
    '@type': 'Event', name: work.venue,
    location: work.proceedings && { '@type': 'Place', name: work.proceedings.location },
    organizer: work.proceedings?.organizers.map(name => ({ '@type': 'Organization', name })),
  };
  return {
    '@type': 'ScholarlyArticle', '@id': work.url + '#article', url: work.url, headline: work.title,
    name: work.title, description: work.summary, datePublished: work.date,
    creativeWorkStatus: publicationStatus(work),
    genre: work.publicationType,
    identifier: work.doi && { '@type': 'PropertyValue', propertyID: 'DOI', value: work.doi, url: work.doiUrl },
    author: work.authorDetails.map((item, index) => item.orcid === person.orcid ? author : {
      '@type': 'Person', name: work.authors[index], givenName: item.givenName, familyName: item.familyName, sameAs: item.orcidUrl,
    }),
    pageStart: work.proceedings?.firstPage,
    about: work.project && { '@id': site + projectPath(work.project) + '#project' },
    isPartOf: work.proceedings ? {
      '@type': 'Book', name: work.venue, isbn: work.proceedings.isbn,
      bookFormat: 'https://schema.org/PrintBook', datePublished: work.date, about: event,
    } : { '@type': 'CreativeWork', name: work.venue },
    mainEntityOfPage: { '@id': work.url + '#page' },
  };
}

export function structuredData(title: string, description: string, path: string, section?: { name: string; path: string }, entities: Schema[] = []) {
  const canonical = site + path;
  const breadcrumbs = path === '/' ? [] : [
    { name: 'Home', path: '/' },
    ...(section ? [section] : []),
    { name: title, path },
  ];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      identity,
      { '@type': 'WebSite', '@id': `${site}/#website`, name: person.name, url: site + '/', publisher: author, inLanguage: 'en' },
      {
        '@type': path === '/' || path === '/cv/' ? 'ProfilePage' : 'WebPage',
        '@id': canonical + '#page', url: canonical, name: title, description, inLanguage: 'en',
        isPartOf: { '@id': `${site}/#website` },
        ...(path === '/' || path === '/cv/' ? { mainEntity: author } : { about: author }),
        ...(breadcrumbs.length ? { breadcrumb: { '@id': canonical + '#breadcrumbs' } } : {}),
      },
      ...(breadcrumbs.length ? [{
        '@type': 'BreadcrumbList',
        '@id': canonical + '#breadcrumbs',
        itemListElement: breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: site + item.path })),
      }] : []),
      ...entities,
    ],
  };
}
