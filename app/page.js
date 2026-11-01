
import Link from "next/link";
import { createSupabaseClient } from "../lib/supabase";

export const dynamic = "force-dynamic";

const categories = [
  { name: "World Politics", slug: "world-politics" },
  { name: "Geopolitics", slug: "geopolitics" },
  { name: "Conflict & Security", slug: "conflict-security" },
  { name: "Economy", slug: "economy" },
  { name: "Diplomacy", slug: "diplomacy" },
  { name: "Middle East", slug: "middle-east" }
];

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });
}

export default async function Home() {
  const supabase = createSupabaseClient();
  let articles = [];
  let categoryNames = new Map();
  let diagnosticMessage = "";

  if (!supabase) {
    diagnosticMessage = "News is temporarily unavailable. Please check back soon.";
  } else {
    const [{ data, error }, { data: categoryRows }] = await Promise.all([
      supabase.from("articles")
        .select("id, title, slug, summary, category_id, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(9),
      supabase.from("categories").select("id, name")
    ]);

    if (error) {
      console.error("Homepage Supabase query failed:", error);
      diagnosticMessage = "We could not load the latest news right now.";
    } else {
      articles = data || [];
    }
    categoryNames = new Map((categoryRows || []).map((item) => [String(item.id), item.name]));
  }

  return (
    <>
      <div className="topbar">
        <div className="container">GLOBAL NEWS • GEOPOLITICS • WORLD AFFAIRS</div>
      </div>

      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="logo">
            GLOBAL <span>GEOPOLITICS</span>
            <div style={{ fontSize: "11px", letterSpacing: "3px" }}>DAILY</div>
          </Link>
          <nav className="nav">
            <Link href="/">HOME</Link>
            <Link href="/#latest">LATEST NEWS</Link>
            <Link href="/#coverage">TOPICS</Link>
            <Link href="/#about">ABOUT</Link>
          </nav>
        </div>
      </header>

      <div className="breaking">
        <div className="container">GLOBAL GEOPOLITICS DAILY <span style={{ marginLeft: "15px", fontWeight: 400 }}>Independent perspective on world affairs</span></div>
      </div>

      <main>
        <section className="hero">
          <div className="container">
            <div className="section-label">YOUR WORLD. YOUR UNDERSTANDING.</div>
            <h1>Understanding the World Beyond Headlines.</h1>
            <p>Your source for international politics, geopolitical developments, global conflicts, diplomacy and world affairs. Stay informed about the events shaping our world.</p>
            <Link className="primary-link" href="/#latest">Explore latest news <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="news-section" id="latest">
          <div className="container">
            <div className="section-label">LATEST UPDATES</div>
            <h2 className="section-heading">Latest Global News</h2>
            {articles.length > 0 ? (
              <div className="news-grid">
                {articles.map((article) => (
                  <Link className="news-card-link" href={"/article/" + article.slug} key={article.id}>
                    <article className="news-card">
                      <div className="category">{categoryNames.get(String(article.category_id)) || "GLOBAL NEWS"}</div>
                      <h3>{article.title}</h3>
                      <p>{article.summary || "Read the latest global developments."}</p>
                      <div className="card-footer"><span>{formatDate(article.published_at)}</span><span className="read-more">Read story →</span></div>
                    </article>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">{diagnosticMessage || "No published articles are available yet. Please check back soon."}</p>
            )}
          </div>
        </section>

        <section className="news-section" id="coverage">
          <div className="container">
            <div className="section-label">EXPLORE OUR COVERAGE</div>
            <h2 className="section-heading">Global Affairs & Topics</h2>
            <div className="news-grid">
              {categories.map((category) => (
                <Link className="news-card-link" href={"/category/" + category.slug} key={category.slug}>
                  <article className="news-card topic-card">
                    <div className="category">GLOBAL COVERAGE</div>
                    <h3>{category.name}</h3>
                    <p>Explore the latest reporting and analysis on {category.name.toLowerCase()}.</p>
                    <div className="card-footer"><span>Explore topic</span><span className="read-more">View news →</span></div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="news-section" id="about">
          <div className="container">
            <div className="section-label">ABOUT US</div>
            <h2 className="section-heading">A Clearer View of Global Affairs</h2>
            <p style={{ maxWidth: "750px", lineHeight: 1.9, color: "#666" }}>Global Geopolitics Daily provides informative coverage of international politics, security, diplomacy and economic developments.</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="logo">GLOBAL <span>GEOPOLITICS</span></div>
          <p>© 2026 Global Geopolitics Daily. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
