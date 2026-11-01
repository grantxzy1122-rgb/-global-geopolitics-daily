
import { createSupabaseClient } from "../lib/supabase";

// Fetch published articles on each request instead of freezing them at build time.
export const dynamic = "force-dynamic";

const categories = [
  "World Politics",
  "Geopolitics",
  "Conflict & Security",
  "Economy",
  "Diplomacy",
  "Middle East"
];

export default async function Home() {
  const supabase = createSupabaseClient();

  let articles = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("articles")
      .select("id, title, slug, summary, category_id, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(6);

    if (!error && data) {
      articles = data;
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="container">
          GLOBAL NEWS • GEOPOLITICS • WORLD AFFAIRS
        </div>
      </div>

      <header className="header">
        <div className="container header-inner">
          <a href="/" className="logo">
            GLOBAL <span>GEOPOLITICS</span>
            <div style={{ fontSize: "11px", letterSpacing: "3px" }}>
              DAILY
            </div>
          </a>

          <nav className="nav">
            <a href="/">HOME</a>
            <a href="#coverage">WORLD</a>
            <a href="#coverage">POLITICS</a>
            <a href="#coverage">GEOPOLITICS</a>
            <a href="#about">ABOUT</a>
          </nav>
        </div>
      </header>

      <div className="breaking">
        <div className="container">
          GLOBAL GEOPOLITICS DAILY
          <span style={{ marginLeft: "15px", fontWeight: 400 }}>
            Independent perspective on world affairs
          </span>
        </div>
      </div>

      <main>
        <section className="hero">
          <div className="container">
            <div className="section-label">
              YOUR WORLD. YOUR UNDERSTANDING.
            </div>

            <h1>
              Understanding the World Beyond Headlines.
            </h1>

            <p>
              Your source for international politics, geopolitical
              developments, global conflicts, diplomacy and world affairs.
              Stay informed about the events shaping our world.
            </p>
          </div>
        </section>

        <section className="news-section">
          <div className="container">
            <div className="section-label">LATEST UPDATES</div>

            <h2 className="section-heading">Latest Global News</h2>

            {articles.length > 0 ? (
              <div className="news-grid">
                {articles.map((article) => (
                  <article className="news-card" key={article.id}>
                    <div className="category">GLOBAL NEWS</div>
                    <h3>{article.title}</h3>
                    <p>{article.summary || "Read the latest global developments."}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ color: "#777", lineHeight: 1.8 }}>
                No published articles yet. Our latest global news
                updates will appear here after editorial approval.
              </p>
            )}
          </div>
        </section>

        <section className="news-section" id="coverage">
          <div className="container">
            <div className="section-label">EXPLORE OUR COVERAGE</div>
            <h2 className="section-heading">Global Affairs & Topics</h2>

            <div className="news-grid">
              {categories.map((category) => (
                <article className="news-card" key={category}>
                  <div className="category">GLOBAL COVERAGE</div>
                  <h3>{category}</h3>
                  <p>
                    Explore international developments and analysis
                    from around the world.
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="news-section" id="about">
          <div className="container">
            <div className="section-label">ABOUT US</div>
            <h2 className="section-heading">
              A Clearer View of Global Affairs
            </h2>
            <p style={{ maxWidth: "750px", lineHeight: 1.9, color: "#666" }}>
              Global Geopolitics Daily provides informative coverage
              of international politics, security, diplomacy and
              economic developments.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="logo">
            GLOBAL <span>GEOPOLITICS</span>
          </div>
          <p>© 2026 Global Geopolitics Daily. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
