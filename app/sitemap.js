import { createSupabaseClient } from "../lib/supabase";

const siteUrl = "https://global-geopolitics-daily-khan-73f2.vercel.app";

const categorySlugs = [
  "world-politics",
  "geopolitics",
  "conflict-security",
  "economy",
  "diplomacy",
  "middle-east",
];

export default async function sitemap() {
  const now = new Date();
  const staticPages = [
    { url: siteUrl, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...categorySlugs.map((slug) => ({
      url: `${siteUrl}/category/${slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    })),
  ];

  const supabase = createSupabaseClient();
  if (!supabase) return staticPages;

  const { data, error } = await supabase
    .from("articles")
    .select("slug, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50000);

  if (error) {
    console.error("Sitemap article query failed:", error);
    return staticPages;
  }

  const articlePages = (data || [])
    .filter((article) => article.slug)
    .map((article) => ({
      url: `${siteUrl}/article/${article.slug}`,
      lastModified: article.published_at ? new Date(article.published_at) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [...staticPages, ...articlePages];
}
