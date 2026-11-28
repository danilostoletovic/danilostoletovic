import { achievements, orcidUrl, person, profiles, site, skills } from '../data/public';
import { personId, projectPath, publicationStatus, type PublicWork } from './catalogue';

export type Schema = Record<string, unknown>;
const portrait = person.image;
const portraitId = `${site}/#portrait`;
const imageObject = {
  '@type': 'ImageObject',
  '@id': portraitId,
  contentUrl: portrait.url,
  encodingFormat: portrait.mimeType,
  width: { '@type': 'QuantitativeValue', value: portrait.width, unitText: 'px' },
  height: { '@type': 'QuantitativeValue', value: portrait.height, unitText: 'px' },
  description: portrait.alt,
  caption: portrait.caption,
  about: { '@id': personId },
};
const identity = {
  '@type': 'Person',
  '@id': personId,
  name: person.name,
  alternateName: person.alternateNames,
  url: site + '/',
  image: { '@id': portraitId },
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
  const { proceedings } = work;
  return {
    '@type': 'ScholarlyArticle', '@id': work.url + '#article', url: work.url, headline: work.title,
    name: work.title, description: work.summary, datePublished: work.date,
    creativeWorkStatus: publicationStatus(work),
    genre: work.publicationType,
    identifier: work.doi && { '@type': 'PropertyValue', propertyID: 'DOI', value: work.doi, url: work.doiUrl },
    author: work.authorDetails.map((item, index) => item.orcid === person.orcid ? author : {
      '@type': 'Person', name: work.authors[index], givenName: item.givenName, familyName: item.familyName, sameAs: item.orcidUrl,
    }),
    pageStart: proceedings?.firstPage,
    about: work.project && { '@id': site + projectPath(work.project) + '#project' },
    isPartOf: proceedings ? {
      '@type': 'Book', name: work.venue, isbn: proceedings.isbn,
      bookFormat: 'https://schema.org/PrintBook', datePublished: work.date,
      description: `Conference held in ${proceedings.location}. Organized by ${proceedings.organizers.join(', ')}.`,
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
      imageObject,
      { '@type': 'WebSite', '@id': `${site}/#website`, name: person.name, url: site + '/', publisher: author, inLanguage: 'en' },
      {
        '@type': path === '/' || path === '/cv/' ? 'ProfilePage' : 'WebPage',
        '@id': canonical + '#page', url: canonical, name: title, description, inLanguage: 'en',
        isPartOf: { '@id': `${site}/#website` },
        ...(path === '/' ? { primaryImageOfPage: { '@id': portraitId } } : {}),
        ...(path === '/' || path === '/cv/' ? { mainEntity: author } : { about: author }),
        ...(breadcrumbs.length ? { breadcrumb: { '@id': canonical + '#breadcrumbs' } } : {}),
      },
      ...(breadcrumbs.length ? [{
        '@type': 'BreadcrumbList',
        '@id': canonical + '#breadcrumbs',
        name: title,
        itemListElement: breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: site + item.path })),
      }] : []),
      ...entities,
    ],
  };
}
