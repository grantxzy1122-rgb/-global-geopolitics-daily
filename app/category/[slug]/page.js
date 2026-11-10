import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseClient } from "../../../lib/supabase";

const siteUrl = "https://global-geopolitics-daily-khan-73f2.vercel.app";

export const dynamic = "force-dynamic";

const categories = [
  { name: "World Politics", slug: "world-politics" },
  { name: "Geopolitics", slug: "geopolitics" },
  { name: "Conflict & Security", slug: "conflict-security" },
  { name: "Economy", slug: "economy" },
  { name: "Diplomacy", slug: "diplomacy" },
  { name: "Middle East", slug: "middle-east" }
];

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const selected = categories.find((item) => item.slug === slug);
  if (!selected) return { title: "Topic not found", robots: { index: false, follow: false } };

  const description = `Latest ${selected.name.toLowerCase()} news, international developments and reporting from Global Geopolitics Daily.`;
  return {
    title: `${selected.name} News`,
    description,
    alternates: { canonical: `/category/${selected.slug}` },
    openGraph: {
      type: "website",
      url: `${siteUrl}/category/${selected.slug}`,
      title: `${selected.name} News | Global Geopolitics Daily`,
      description,
    },
  };
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const selected = categories.find((item) => item.slug === slug);
  if (!selected) notFound();

  const supabase = createSupabaseClient();
  if (!supabase) {
    return <main className="article-shell"><h1 className="article-title">{selected.name}</h1><p className="empty-state">News is temporarily unavailable. Please check back soon.</p><Link className="back-link" href="/">← Back to home</Link></main>;
  }

  const { data: category, error: categoryError } = await supabase
    .from("categories").select("id, name").eq("name", selected.name).maybeSingle();

  if (categoryError) console.error("Category lookup failed:", categoryError);
  if (!category) notFound();

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, slug, summary, published_at")
    .eq("status", "published")
    .eq("category_id", category.id)
    .order("published_at", { ascending: false });

  if (error) console.error("Category articles query failed:", error);

  return (
    <>
      <div className="topbar"><div className="container">GLOBAL NEWS • GEOPOLITICS • WORLD AFFAIRS</div></div>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="logo">GLOBAL <span>GEOPOLITICS</span><div style={{ fontSize: "11px", letterSpacing: "3px" }}>DAILY</div></Link>
          <nav className="nav"><Link href="/">HOME</Link><Link href="/#latest">LATEST NEWS</Link><Link href="/#coverage">TOPICS</Link></nav>
        </div>
      </header>
      <main className="news-section">
        <div className="container">
          <div className="breadcrumb"><Link href="/">Home</Link> / Topics / {selected.name}</div>
          <div className="section-label">GLOBAL COVERAGE</div>
          <h1 className="section-heading">{selected.name}</h1>
          {articles?.length ? (
            <div className="news-grid">
              {articles.map((article) => (
                <Link className="news-card-link" href={"/article/" + article.slug} key={article.id}>
                  <article className="news-card">
                    <div className="category">{selected.name}</div>
                    <h3>{article.title}</h3>
                    <p>{article.summary || "Read the latest global developments."}</p>
                    <div className="card-footer"><span>{article.published_at ? new Date(article.published_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : ""}</span><span className="read-more">Read story →</span></div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">{error ? "We could not load this topic right now." : "There are no published articles in this topic yet. Please check back soon."}</p>
          )}
          <Link className="back-link" href="/">← Back to home</Link>
        </div>
      </main>
      <footer className="footer"><div className="container"><div className="logo">GLOBAL <span>GEOPOLITICS</span></div><p>© 2026 Global Geopolitics Daily. All rights reserved.</p></div></footer>
    </>
  );
}
