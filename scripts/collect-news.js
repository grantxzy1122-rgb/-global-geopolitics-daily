const Parser = require("rss-parser");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }
});
const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "GlobalGeopoliticsDaily/1.0" },
  customFields: { item: ["source", "dc:creator", "creator"] }
});

// Use publisher RSS feeds directly, plus Yahoo News' public top-stories feed.
// Google News RSS is intentionally not used for automated website publishing:
// its feed notice restricts use to personal, non-commercial feed readers.
const FEEDS = [
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Associated Press", url: "https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "Deutsche Welle", url: "https://rss.dw.com/xml/rss-en-all" },
  { name: "Yahoo News", url: "https://news.yahoo.com/rss/topstories" }
];

const CATEGORIES = [
  "World Politics",
  "Geopolitics",
  "Conflict & Security",
  "Economy",
  "Diplomacy",
  "Middle East"
];
const MAX_PER_CATEGORY = 10;
const MAX_ITEMS_PER_RUN = 60;
const MAX_AGE_HOURS = 36;
const AI_BATCH_SIZE = 4;
const GEO_KEYWORDS = /\b(president|prime minister|government|election|elections|vote|parliament|congress|senate|lawmakers|minister|diplomat|diplomacy|foreign ministry|state department|white house|kremlin|military|army|armed forces|war|conflict|attack|airstrike|strike|missile|drone|troops|ceasefire|peace deal|peace talks|security|nato|united nations|\bun\b|sanctions|tariff|trade deal|trade war|central bank|interest rate|inflation|oil prices|energy supply|border|migration|refugee|coup|treaty|summit|sovereignty|territory|occupation|nuclear|geopolit|iran|israel|ukraine|russia|china|taiwan|gaza|palestine|syria|yemen|sudan|north korea|south korea|european union|\beu\b|afghanistan|pakistan|india|saudi arabia|turkey|venezuela|cuba|myanmar|libya|lebanon|iraq|somalia|western sahara)\b/i;
const SPORTS_KEYWORDS = /\b(sport|sports|football|soccer|basketball|nba|nfl|cricket|tennis|golf|baseball|rugby|formula one|f1|premier league|champions league|world cup|match report|live scores|top 25)\b/i;

function isGeopoliticalStory(item) {
  const url = String(item.url || "").toLowerCase();
  const text = String(item.title || "") + " " + String(item.description || "");
  if (/\/(video|videos)\//.test(url) || /\.(mp4|m3u8)(\?|$)/.test(url)) return false;
  if (SPORTS_KEYWORDS.test(text)) return false;
  return GEO_KEYWORDS.test(text);
}

function makeSlug(title, url) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65);
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 8);
  return base + "-" + hash;
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function getPublisher(item, feed) {
  const source = item.source;
  if (feed.name === "Associated Press" &&
      (!source || (typeof source === "string" && /^(top stories|flipboard)$/i.test(source.trim())))) {
    return "Associated Press";
  }
  if (source && typeof source === "object" && source.title) return cleanText(source.title);
  if (typeof source === "string" && source.trim()) return cleanText(source);
  if (item["dc:creator"]) return cleanText(item["dc:creator"]);
  if (item.creator) return cleanText(item.creator);

  // Many syndicated RSS headlines append the original publisher after " - ".
  const match = String(item.title || "").match(/\s[-|]\s([^-|]+)$/);
  if (match && feed.name === "Yahoo News") return cleanText(match[1]);
  return feed.name;
}

function cleanHeadline(title, publisher) {
  let value = cleanText(title);
  const suffix = " - " + publisher;
  if (value.toLowerCase().endsWith(suffix.toLowerCase())) {
    value = value.slice(0, -suffix.length).trim();
  }
  return value;
}

async function collectNews() {
  const allItems = [];

  for (const feed of FEEDS) {
    try {
      console.log("Reading " + feed.name + "...");
      const result = await parser.parseURL(feed.url);

      for (const item of result.items || []) {
        const date = new Date(item.isoDate || item.pubDate);
        if (!item.title || !item.link || !Number.isFinite(date.getTime())) continue;

        const hoursOld = (Date.now() - date.getTime()) / 3600000;
        if (hoursOld < -1 || hoursOld > MAX_AGE_HOURS) continue;

        const publisher = getPublisher(item, feed);
        const title = cleanHeadline(item.title, publisher);
        const description = cleanText(
          item.contentSnippet || item.content || item.summary || item.description || ""
        ).slice(0, 1800);

        if (title.length < 12) continue;

        allItems.push({
          source: publisher,
          source_feed: feed.name,
          title,
          description,
          url: item.link,
          date: date.toISOString()
        });
      }
    } catch (error) {
      console.log("Feed unavailable: " + feed.name + ": " + error.message);
    }
  }

  // Remove duplicate links and repeated headlines from syndicated feeds.
  const unique = [];
  const seen = new Set();
  for (const item of allItems.sort((a, b) => new Date(b.date) - new Date(a.date))) {
    const key = item.url || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const relevant = unique.filter(isGeopoliticalStory);
  console.log("Collected " + unique.length + " fresh items; " +
    (unique.length - relevant.length) + " excluded by geopolitical relevance filters.");
  console.log("Retained " + relevant.length + " geopolitical candidates.");
  return relevant.slice(0, MAX_ITEMS_PER_RUN);
}

function parseAiArticles(aiResponse) {
  let parsed = aiResponse;
  if (typeof parsed === "string") {
    let cleaned = parsed.trim()
      .replace(/^\`\`\`(?:json)?\s*/i, "")
      .replace(/\s*\`\`\`$/, "");
    try {
      parsed = JSON.parse(cleaned);
    } catch (firstError) {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start < 0 || end <= start) throw firstError;
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.articles)) return parsed.articles;
  if (parsed && parsed.response && Array.isArray(parsed.response.articles)) return parsed.response.articles;
  if (parsed && parsed.id !== undefined && (parsed.summary || parsed.content || parsed.title)) return [parsed];
  throw new Error("AI response did not contain an articles array.");
}

async function generateSummaries(items) {
  const prompt = [
    "You write concise, neutral news summaries for Global Geopolitics Daily.",
    "This is summarization and categorization, not an independent fact-checking task.",
    "Use only information present in each supplied headline and description. Do not add outside facts, context, quotes, numbers, motives or predictions.",
    "Only summarize the supplied items. Do not add outside facts, quotes, numbers, motives or predictions.",
    "Return one result for every input item, preserving its numeric id exactly. Return valid JSON only.",
    "Required shape: { \"articles\": [{ \"id\": 1, \"title\": \"...\", \"summary\": \"...\", \"content\": \"...\", \"category\": \"...\" }] }.",
    "Title: clear English. Summary: 1-2 factual sentences. Content: 2-3 concise sentences. Do not pad short descriptions.",
    "Choose exactly one category from: " + CATEGORIES.join(", ") + ".",
    "NEWS ITEMS:",
    JSON.stringify(items.map((item, index) => ({
      id: index + 1,
      publisher: item.source,
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
        max_tokens: 2048,
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
    throw new Error("Cloudflare returned an empty response: " + JSON.stringify(result).slice(0, 1200));
  }
  return parseAiArticles(aiResponse);
}

async function main() {
  console.log("Starting automated news collection and AI summarization...");
  const items = await collectNews();

  if (items.length === 0) {
    console.log("No fresh stories found. Nothing to publish.");
    return;
  }

  const urls = items.map(item => item.url);
  const { data: existing, error: existingError } = await supabase
    .from("articles")
    .select("id, source_url, status")
    .in("source_url", urls);
  if (existingError) throw existingError;

  const existingRows = existing || [];
  const existingUrls = new Set(existingRows.map(item => item.source_url));
  const newItems = items.filter(item => !existingUrls.has(item.url));

  console.log("Found " + newItems.length + " new stories; " + existingUrls.size + " already exist.");
  if (newItems.length === 0) {
    console.log("No new stories to process.");
    return;
  }

  const { data: categories, error: categoryError } = await supabase
    .from("categories").select("id, name");
  if (categoryError) throw categoryError;

  const categoryMap = new Map((categories || []).map(category => [
    category.name.toLowerCase().trim(), category.id
  ]));

  const rows = [];
  const categoryCounts = new Map();
  const batches = [];
  for (let i = 0; i < newItems.length; i += AI_BATCH_SIZE) batches.push(newItems.slice(i, i + AI_BATCH_SIZE));

  async function processBatch(batch) {
    let articles;
    try {
      articles = await generateSummaries(batch);
    } catch (error) {
      if (batch.length > 1) {
        const midpoint = Math.ceil(batch.length / 2);
        console.warn("AI batch failed (" + error.message + "); retrying smaller batches.");
        await processBatch(batch.slice(0, midpoint));
        await processBatch(batch.slice(midpoint));
      } else {
        console.error("AI could not summarize story: " + batch[0].title + " — " + error.message);
      }
      return;
    }

    const returnedIds = new Set();
    for (const article of articles) {
      const articleId = Number(article.id);
      if (!Number.isInteger(articleId) || articleId < 1 || articleId > batch.length || returnedIds.has(articleId)) continue;
      returnedIds.add(articleId);
      const original = batch[articleId - 1];
      if (!original) continue;

      const title = cleanText(article.title || original.title);
      const summary = cleanText(article.summary);
      const content = cleanText(article.content || article.summary);
      if (title.length < 12 || summary.length < 20 || content.length < 40) {
        console.log("Skipped incomplete AI summary for: " + original.title);
        continue;
      }

      let category = cleanText(article.category).toLowerCase();
      if (!categoryMap.has(category)) {
        category = categoryMap.has("geopolitics") ? "geopolitics" : "world politics";
      }
      const categoryId = categoryMap.get(category);
      if (!categoryId) {
        console.log("Category not found in database: " + category);
        continue;
      }

      const count = categoryCounts.get(category) || 0;
      if (count >= MAX_PER_CATEGORY) continue;

      rows.push({
        title: title.slice(0, 180),
        slug: makeSlug(title, original.url),
        summary: summary.slice(0, 500),
        content: content.slice(0, 5000),
        category_id: categoryId,
        source_name: original.source,
        source_url: original.url,
        status: "draft",
        published_at: original.date
      });
      categoryCounts.set(category, count + 1);
    }
    for (let expectedId = 1; expectedId <= batch.length; expectedId++) {
      if (!returnedIds.has(expectedId)) {
        console.warn("AI omitted item " + expectedId + " in batch; story left unpublished: " + batch[expectedId - 1].title);
      }
    }
  }

  for (const batch of batches) await processBatch(batch);

  if (rows.length === 0) {
    console.log("No complete AI summaries were returned. Nothing was published.");
    return;
  }

  const { data, error } = await supabase
    .from("articles").insert(rows).select("id, title");
  if (error) throw error;

  console.log("Successfully saved " + data.length + " articles as drafts for editorial review.");
  for (const [category, count] of categoryCounts) {
    console.log("CATEGORY " + category + ": " + count);
  }
  for (const article of data) console.log("DRAFT: " + article.title);
}

main().catch(error => {
  console.error("Automation failed:", error);
  process.exit(1);
});
