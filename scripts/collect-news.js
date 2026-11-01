
const Parser = require("rss-parser");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "GlobalGeopoliticsDaily/1.0" }
});

const FEEDS = [
  {
    name: "BBC News",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml"
  },
  {
    name: "Associated Press",
    url: "https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss"
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml"
  },
  {
    name: "Deutsche Welle",
    url: "https://rss.dw.com/xml/rss-en-all"
  }
];

const CATEGORIES = [
  "Asia Pacific",
  "Conflict & Security",
  "Diplomacy",
  "Economy",
  "Europe",
  "Geopolitics",
  "Middle East",
  "Technology",
  "United States",
  "World Politics"
];

function makeSlug(title, url) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 65);

  const hash = crypto
    .createHash("sha1")
    .update(url)
    .digest("hex")
    .slice(0, 8);

  return `${base}-${hash}`;
}

async function collectNews() {
  const allItems = [];

  for (const feed of FEEDS) {
    try {
      console.log(`Reading ${feed.name}...`);

      const result = await parser.parseURL(feed.url);

      for (const item of result.items || []) {
        const date = new Date(item.isoDate || item.pubDate);

        if (
          !item.title ||
          !item.link ||
          !Number.isFinite(date.getTime())
        ) {
          continue;
        }

        const hoursOld =
          (Date.now() - date.getTime()) / 3600000;

        if (hoursOld < 0 || hoursOld > 36) {
          continue;
        }

        allItems.push({
          source: feed.name,
          title: item.title.trim(),
          description: (
            item.contentSnippet ||
            item.content ||
            item.summary ||
            ""
          ).replace(/<[^>]*>/g, "").slice(0, 1200),
          url: item.link,
          date: date.toISOString()
        });
      }
    } catch (error) {
      console.log(`Feed unavailable: ${feed.name}: ${error.message}`);
    }
  }

  const unique = [
    ...new Map(allItems.map(item => [item.url, item])).values()
  ];

  unique.sort((a, b) => new Date(b.date) - new Date(a.date));

  return unique.slice(0, 10);
}

async function generateSummaries(items) {
  const prompt = `
You are a professional international geopolitical news editor.

Select only important geopolitical, diplomatic, political,
security and economic stories from the supplied RSS items.

Return one JSON object with this exact structure:
{
  "articles": [
    {
      "id": 1,
      "keep": true,
      "title": "Factual headline",
      "summary": "One or two sentence summary.",
      "content": "A concise original news report in English.",
      "category": "World Politics"
    }
  ]
}

STRICT RULES:
- Output JSON only. No Markdown, Python, JavaScript, or explanations.
- Use double quotes for all JSON keys and string values.
- The top-level object must contain an "articles" array.
- Each id must be the numeric id of the matching supplied item.
- Use only facts in the supplied headline and description.
- Never invent facts, dates, quotes, figures, or background.
- If details are insufficient, keep the report brief and cautious.
- Do not copy RSS descriptions word for word.
- Do not create opinion or political propaganda.
- Ignore entertainment, sports, and unrelated stories.
- Choose only one category from this exact list:
${CATEGORIES.join(", ")}
- Keep headlines neutral and factual.
- Do not include stories that are not geopolitically relevant.
- If no stories qualify, return {"articles": []}.

NEWS ITEMS:
${JSON.stringify(items.map((item, index) => ({
    id: index + 1,
    source: item.source,
    headline: item.title,
    description: item.description,
    published: item.date
  })))}
`;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        max_tokens: 4096,
        temperature: 0.1,
        response_format: {
          type: "json_object"
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      `Cloudflare AI error: ${JSON.stringify(result)}`
    );
  }

  const aiResponse = result.result?.response;

  if (
    aiResponse === undefined ||
    aiResponse === null ||
    aiResponse === ""
  ) {
    console.error("Cloudflare response metadata:", JSON.stringify({
      success: result.success,
      errors: result.errors,
      messages: result.messages,
      resultKeys: Object.keys(result.result || {})
    }));
    throw new Error("Cloudflare returned an empty response.");
  }

  let parsed;

  if (typeof aiResponse === "object" && !Array.isArray(aiResponse)) {
    // Workers AI JSON Mode may return the structured object directly.
    parsed = aiResponse;
  } else if (typeof aiResponse === "string") {
    try {
      parsed = JSON.parse(aiResponse);
    } catch (error) {
      console.error("Invalid Cloudflare AI response text:", aiResponse);
      throw new Error("Cloudflare AI did not return valid JSON.");
    }
  } else {
    throw new Error("Cloudflare AI returned an unsupported response format.");
  }

  // Some model/API responses wrap the JSON payload in another response field.
  if (
    parsed &&
    !Array.isArray(parsed.articles) &&
    parsed.response &&
    Array.isArray(parsed.response.articles)
  ) {
    parsed = parsed.response;
  }

  if (!parsed || !Array.isArray(parsed.articles)) {
    console.error("Unexpected Cloudflare AI response structure:", JSON.stringify(parsed));
    throw new Error('AI response must contain an "articles" array.');
  }

  return parsed;
}

async function main() {
  console.log("Starting geopolitical news collection...");

  const items = await collectNews();

  console.log(`Collected ${items.length} recent news items.`);

  if (items.length === 0) {
    console.log("No recent news found. Ending run.");
    return;
  }

  const urls = items.map(item => item.url);

  const { data: existing, error: existingError } = await supabase
    .from("articles")
    .select("source_url")
    .in("source_url", urls);

  if (existingError) throw existingError;

  const existingUrls = new Set(
    (existing || []).map(item => item.source_url)
  );

  const newItems = items.filter(item => !existingUrls.has(item.url));

  console.log(`${newItems.length} new stories need processing.`);

  if (newItems.length === 0) {
    console.log("All stories already exist.");
    return;
  }

  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id, name");

  if (categoryError) throw categoryError;

  const categoryMap = new Map(
    categories.map(category => [
      category.name.toLowerCase(),
      category.id
    ])
  );

  const aiResult = await generateSummaries(newItems);

  const rows = [];

  for (const article of aiResult.articles || []) {
    if (!article.keep) continue;

    const original = newItems[Number(article.id) - 1];

    if (!original || !article.title || !article.content) continue;

    const categoryId = categoryMap.get(
      String(article.category).toLowerCase()
    );

    if (!categoryId) {
      console.log(`Unknown category: ${article.category}`);
      continue;
    }

    rows.push({
      title: article.title,
      slug: makeSlug(article.title, original.url),
      summary: article.summary || article.title,
      content: article.content,
      category_id: categoryId,
      source_name: original.source,
      source_url: original.url,
      status: "draft",
      published_at: original.date
    });
  }

  if (rows.length === 0) {
    console.log("No suitable articles generated.");
    return;
  }

  const { data, error } = await supabase
    .from("articles")
    .insert(rows)
    .select("id, title");

  if (error) throw error;

  console.log(`Successfully saved ${data.length} draft articles.`);

  for (const article of data) {
    console.log(`DRAFT: ${article.title}`);
  }
}

main().catch(error => {
  console.error("Automation failed:", error);
  process.exit(1);
});
