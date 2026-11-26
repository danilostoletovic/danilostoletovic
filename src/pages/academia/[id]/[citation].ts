import type { APIRoute, GetStaticPaths } from 'astro';
import { catalogue, type PublicWork } from '../../../lib/catalogue';
import { citationLinks, makeCitation } from '../../../lib/citations';

export const getStaticPaths = (() => catalogue.publications
  .filter(work => work.status === 'Published')
  .flatMap(work => citationLinks(work).map(link => ({
    params: { id: work.id, citation: link.file }, props: { work, link },
  })))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { work, link } = props as { work: PublicWork; link: ReturnType<typeof citationLinks>[number] };
  return new Response(makeCitation(work, link.file), { headers: { 'Content-Type': link.contentType } });
};
