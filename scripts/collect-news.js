const Parser = require("rss-parser");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }
});
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "GlobalGeopoliticsDaily/1.0" }
});

// RSS feeds are accepted only when each story links to the publisher's own domain.
const FEEDS = [
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", allowedHosts: ["bbc.co.uk", "bbc.com"] },
  { name: "Associated Press", url: "https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss", allowedHosts: ["apnews.com"] },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", allowedHosts: ["aljazeera.com"] },
  { name: "Deutsche Welle", url: "https://rss.dw.com/xml/rss-en-all", allowedHosts: ["dw.com"] }
];

const CATEGORIES = [
  "Asia Pacific", "Conflict & Security", "Diplomacy", "Economy", "Europe",
  "Geopolitics", "Middle East", "Technology", "United States", "World Politics"
];

function isTrustedArticleUrl(url, allowedHosts) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return allowedHosts.some(domain => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

function makeSlug(title, url) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65);
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 8);
  return base + "-" + hash;
}

async function collectNews() {
  const allItems = [];
  let rejectedUntrusted = 0;

  for (const feed of FEEDS) {
    try {
      console.log("Reading " + feed.name + "...");
      const result = await parser.parseURL(feed.url);

      for (const item of result.items || []) {
        const date = new Date(item.isoDate || item.pubDate);
        if (!item.title || !item.link || !Number.isFinite(date.getTime())) continue;

        if (!isTrustedArticleUrl(item.link, feed.allowedHosts)) {
          rejectedUntrusted++;
          continue;
        }

        const hoursOld = (Date.now() - date.getTime()) / 3600000;
        if (hoursOld < 0 || hoursOld > 36) continue;

        const description = (item.contentSnippet || item.content || item.summary || "")
          .replace(/<[^>]*>/g, "").trim().slice(0, 1200);
        if (description.length < 60) continue;

        allItems.push({
          source: feed.name,
          title: item.title.trim(),
          description,
          url: item.link,
          date: date.toISOString()
        });
      }
    } catch (error) {
      console.log("Feed unavailable: " + feed.name + ": " + error.message);
    }
  }

  console.log("Rejected " + rejectedUntrusted + " links outside trusted publisher domains.");
  const unique = [...new Map(allItems.map(item => [item.url, item])).values()];
  unique.sort((a, b) => new Date(b.date) - new Date(a.date));
  return unique.slice(0, 10);
}

async function generateSummaries(items) {
  const prompt = [
    "You are a cautious professional international news editor for a factual news website.",
    "Select only important geopolitical, diplomatic, political, security and economic stories.",
    "Return one JSON object: { articles: [{ id, keep, title, summary, content, category }] }.",
    "Output valid JSON only, with double-quoted keys and string values. No Markdown.",
    "Each id must be the numeric id of the matching supplied item.",
    "Use ONLY facts explicitly present in that item's headline and description.",
    "Never invent or infer facts, dates, quotes, figures, names, motives, outcomes or background.",
    "Do not combine facts from different stories.",
    "If the description is insufficient for a reliable report, set keep to false.",
    "Do not make a claim stronger or more certain than the source text.",
    "Attribute allegations and claims to the person or institution making them.",
    "Do not copy RSS descriptions word for word.",
    "No opinion, propaganda, predictions, sensational headlines, entertainment or sports.",
    "Choose one category from: " + CATEGORIES.join(", ") + ".",
    "If no stories qualify, return {\"articles\": []}.",
    "NEWS ITEMS:",
    JSON.stringify(items.map((item, index) => ({
      id: index + 1,
      source: item.source,
      headline: item.title,
      description: item.description,
      published: item.date
    })))
  ].join("\n");

  const response = await fetch(
    "https://api.cloudflare.com/client/v4/accounts/" +
      process.env.CLOUDFLARE_ACCOUNT_ID +
      "/ai/run/@cf/meta/llama-3.1-8b-instruct",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        max_tokens: 4096,
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    }
  );

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error("Cloudflare AI error: " + JSON.stringify(result));
  }

  const aiResponse = result.result && result.result.response;
  if (aiResponse === undefined || aiResponse === null || aiResponse === "") {
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
    parsed = aiResponse;
  } else if (typeof aiResponse === "string") {
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      console.error("Invalid Cloudflare AI response text:", aiResponse);
      throw new Error("Cloudflare AI did not return valid JSON.");
    }
  } else {
    throw new Error("Cloudflare AI returned an unsupported response format.");
  }

  if (!Array.isArray(parsed.articles) && parsed.response && Array.isArray(parsed.response.articles)) {
    parsed = parsed.response;
  }
  if (!parsed || !Array.isArray(parsed.articles)) {
    console.error("Unexpected Cloudflare AI response structure:", JSON.stringify(parsed));
    throw new Error('AI response must contain an "articles" array.');
  }
  return parsed;
}

async function main() {
  console.log("Starting trusted-source geopolitical news collection...");
  const items = await collectNews();
  console.log("Collected " + items.length + " recent stories from trusted publisher domains.");

  if (items.length === 0) {
    console.log("No qualifying trusted-source stories found. Nothing was published.");
    return;
  }

  const urls = items.map(item => item.url);
  const { data: existing, error: existingError } = await supabase
    .from("articles").select("source_url").in("source_url", urls);
  if (existingError) throw existingError;

  const existingUrls = new Set((existing || []).map(item => item.source_url));
  const newItems = items.filter(item => !existingUrls.has(item.url));
  console.log(newItems.length + " new trusted stories need processing.");
  if (newItems.length === 0) {
    console.log("All trusted stories already exist.");
    return;
  }

  const { data: categories, error: categoryError } = await supabase
    .from("categories").select("id, name");
  if (categoryError) throw categoryError;

  const categoryMap = new Map(categories.map(category => [category.name.toLowerCase(), category.id]));
  const aiResult = await generateSummaries(newItems);
  const rows = [];
  const usedIds = new Set();

  for (const article of aiResult.articles) {
    const articleId = Number(article.id);
    if (article.keep !== true || !Number.isInteger(articleId) || usedIds.has(articleId)) continue;

    const original = newItems[articleId - 1];
    if (!original || !article.title || !article.summary || !article.content) continue;

    const feed = FEEDS.find(item => item.name === original.source);
    if (!feed || !isTrustedArticleUrl(original.url, feed.allowedHosts)) continue;

    const title = String(article.title).trim();
    const summary = String(article.summary).trim();
    const content = String(article.content).trim();

    if (title.length < 12 || title.length > 180 ||
        summary.length < 30 || summary.length > 500 ||
        content.length < 80 || content.length > 5000) {
      console.log("Skipped article with invalid content length: " + original.title);
      continue;
    }

    const categoryId = categoryMap.get(String(article.category).toLowerCase());
    if (!categoryId) {
      console.log("Unknown category: " + article.category);
      continue;
    }

    usedIds.add(articleId);
    rows.push({
      title,
      slug: makeSlug(title, original.url),
      summary,
      content,
      category_id: categoryId,
      source_name: original.source,
      source_url: original.url,
      status: "published",
      published_at: original.date
    });
  }

  if (rows.length === 0) {
    console.log("No articles passed the trusted-source and editorial checks. Nothing was published.");
    return;
  }

  const { data, error } = await supabase
    .from("articles").insert(rows).select("id, title");
  if (error) throw error;

  console.log("Successfully published " + data.length + " trusted-source articles.");
  for (const article of data) console.log("PUBLISHED: " + article.title);
}

main().catch(error => {
  console.error("Automation failed:", error);
  process.exit(1);
});
