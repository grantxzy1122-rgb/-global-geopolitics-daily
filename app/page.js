
const categories = [
  {
    name: "World Politics",
    description: "Political developments, elections and decisions shaping the world."
  },
  {
    name: "Geopolitics",
    description: "Global power struggles, strategic alliances and international relations."
  },
  {
    name: "Conflict & Security",
    description: "Wars, military developments and international security."
  },
  {
    name: "Economy",
    description: "Global markets, trade, sanctions and economic policy."
  },
  {
    name: "Diplomacy",
    description: "International negotiations, treaties and diplomatic relations."
  },
  {
    name: "Middle East",
    description: "Political and strategic developments across the Middle East."
  }
];

export default function Home() {
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
            <div style={{fontSize: "11px", letterSpacing: "3px"}}>
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
          <span style={{marginLeft: "15px", fontWeight: 400}}>
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

            <a
              href="#coverage"
              style={{
                display: "inline-block",
                marginTop: "25px",
                background: "#b42318",
                color: "white",
                padding: "14px 24px",
                fontSize: "12px",
                fontWeight: 700
              }}
            >
              EXPLORE GLOBAL NEWS →
            </a>
          </div>
        </section>

        <section className="news-section" id="coverage">
          <div className="container">
            <div className="section-label">
              EXPLORE OUR COVERAGE
            </div>

            <h2 className="section-heading">
              Global Affairs & Topics
            </h2>

            <div className="news-grid">
              {categories.map((category) => (
                <article className="news-card" key={category.name}>
                  <div className="category">
                    GLOBAL COVERAGE
                  </div>

                  <h3>{category.name}</h3>

                  <p>{category.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="news-section" id="about">
          <div className="container">
            <div className="section-label">
              ABOUT US
            </div>

            <h2 className="section-heading">
              A Clearer View of Global Affairs
            </h2>

            <p style={{
              maxWidth: "750px",
              lineHeight: 1.9,
              color: "#666"
            }}>
              Global Geopolitics Daily is dedicated to providing
              clear, informative coverage of international events.
              Our focus includes global politics, international
              relations, security, diplomacy and economic developments.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="logo">
            GLOBAL <span>GEOPOLITICS</span>
          </div>

          <p>
            © 2026 Global Geopolitics Daily. All rights reserved.
          </p>

          <p>
            Independent coverage of a changing world.
          </p>
        </div>
      </footer>
    </>
  );
}
