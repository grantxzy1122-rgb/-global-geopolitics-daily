
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseClient } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const supabase = createSupabaseClient();
  if (!supabase) notFound();

  const { data: article, error } = await supabase
    .from("articles")
    .select("id, title, slug, summary, content, category_id, source_name, source_url, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) console.error("Article page query failed:", error);
  if (!article) notFound();

  const { data: category } = await supabase
    .from("categories").select("name").eq("id", article.category_id).maybeSingle();

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <>
      <div className="topbar"><div className="container">GLOBAL NEWS • GEOPOLITICS • WORLD AFFAIRS</div></div>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="logo">GLOBAL <span>GEOPOLITICS</span><div style={{ fontSize: "11px", letterSpacing: "3px" }}>DAILY</div></Link>
          <nav className="nav"><Link href="/">HOME</Link><Link href="/#latest">LATEST NEWS</Link><Link href="/#coverage">TOPICS</Link></nav>
        </div>
      </header>
      <main className="article-shell">
        <div className="breadcrumb"><Link href="/">Home</Link> / <Link href="/#latest">Latest News</Link> / Article</div>
        <div className="article-category">{category?.name || "GLOBAL NEWS"}</div>
        <h1 className="article-title">{article.title}</h1>
        <div className="article-meta">{date}{article.source_name ? "  •  Source: " + article.source_name : ""}</div>
        {article.summary ? <p className="article-summary">{article.summary}</p> : null}
        <div className="article-content">{article.content}</div>
        {article.source_url ? <a className="source-link" href={article.source_url} target="_blank" rel="noopener noreferrer">Read original report at {article.source_name || "the source"} ↗</a> : null}
        <div><Link className="back-link" href="/">← Back to Global News</Link></div>
      </main>
      <footer className="footer"><div className="container"><div className="logo">GLOBAL <span>GEOPOLITICS</span></div><p>© 2026 Global Geopolitics Daily. All rights reserved.</p></div></footer>
    </>
  );
}
