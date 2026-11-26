import { publicationPath, publicationStatus, type PublicWork } from './catalogue';

export const citationFormats = {
  'citation.bib': { label: 'BibTeX', contentType: 'application/x-bibtex; charset=utf-8' },
  'citation.ris': { label: 'RIS', contentType: 'application/x-research-info-systems; charset=utf-8' },
} as const;

export type CitationFile = keyof typeof citationFormats;

export const citationLinks = (work: PublicWork) => (Object.keys(citationFormats) as CitationFile[]).map(file => ({
  file,
  path: publicationPath(work.id) + file,
  ...citationFormats[file],
}));

export function makeCitation(work: PublicWork, file: CitationFile) {
  const { proceedings } = work;
  const names = work.authorDetails.map(author => `${author.familyName}, ${author.givenName}`);
  const url = work.doiUrl ?? work.url;
  const year = work.date.slice(0, 4);
  if (file === 'citation.ris') {
    const fields = [
      ['TY', proceedings ? 'CONF' : 'GEN'],
      ['TI', work.title],
      ...names.map(name => ['AU', name]),
      ['T2', work.venue], ['PY', year], ['CY', proceedings?.location],
      ['SP', proceedings?.firstPage], ['SN', proceedings?.isbn],
      ['DO', work.doi], ['UR', url], ['N1', publicationStatus(work)],
    ];
    return fields.filter(([, value]) => value !== undefined).map(([key, value]) => `${key}  - ${value}`).concat('ER  - ', '').join('\r\n');
  }
  const fields = [
    ['title', `{${work.title}}`], ['author', names.join(' and ')],
    [proceedings ? 'booktitle' : 'howpublished', work.venue],
    ['year', year], ['address', proceedings?.location],
    ['isbn', proceedings?.isbn], ['doi', work.doi], ['url', url],
    ['note', publicationStatus(work) + (proceedings ? `. Starts on page ${proceedings.firstPage}` : '')],
  ];
  const entries = fields.filter(([, value]) => value !== undefined).map(([key, value]) => `  ${key} = {${value}}`);
  return `@${proceedings ? 'inproceedings' : 'misc'}{${work.id},\n${entries.join(',\n')}\n}\n`;
}
