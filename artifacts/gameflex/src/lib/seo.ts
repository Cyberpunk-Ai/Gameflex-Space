export type PageSeo = {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
};

/**
 * Builds a per-route head() payload with unique title/description and
 * matching Open Graph + Twitter tags.
 */
export function pageSeo({ title, description, image, noindex }: PageSeo) {
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
    meta.push({ name: "twitter:card", content: "summary_large_image" });
  }
  if (noindex) meta.push({ name: "robots", content: "noindex, nofollow" });
  return { meta };
}
