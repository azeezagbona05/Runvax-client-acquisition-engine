/**
 * Runvax Blog Keyword Generator
 *
 * Generates long-tail SEO keyword ideas for blog content planning.
 * Run: node keyword-generator.mjs
 * Run with a seed: node keyword-generator.mjs "web design clients"
 *
 * Output: console table + writes to content/blog/keyword-targets.md (appends new ones)
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';

// ─── CONFIG ────────────────────────────────────────────────────────────────

const NIGERIAN_CITIES = [
  'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu',
  'Benin City', 'Kaduna', 'Jos', 'Owerri', 'Abeokuta', 'Warri',
  'Asaba', 'Uyo', 'Calabar', 'Maiduguri', 'Sokoto', 'Akure',
];

const AFRICAN_CITIES = [
  'Nairobi', 'Accra', 'Johannesburg', 'Cape Town', 'Dar es Salaam',
  'Kampala', 'Dakar', 'Addis Ababa', 'Lusaka', 'Harare',
];

const UK_CITIES = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow',
  'Bristol', 'Sheffield', 'Liverpool', 'Edinburgh', 'Cardiff',
];

const INDUSTRIES = [
  'restaurant', 'clinic', 'hotel', 'school', 'law firm',
  'real estate', 'salon', 'pharmacy', 'gym', 'logistics company',
  'church', 'engineering firm', 'construction company', 'NGO',
  'fashion boutique', 'dentist', 'optician', 'consultant',
  'accounting firm', 'event centre', 'nightclub', 'bakery',
];

const SEED_KEYWORDS = [
  'web design clients',
  'web designer',
  'web design business',
  'how to find clients web design',
  'web design course',
  'freelance web design',
  'how to make money web design',
  'AI web design',
  'website cost',
  'build websites with AI',
  'web design proposal',
  'cold email web designers',
  'web design pricing',
  'web design agency',
  'web design portfolio',
  'how to start web design',
  'website builder',
  'Lovable web design',
  'Framer web design',
  'web design without coding',
];

// ─── PATTERN GENERATORS ────────────────────────────────────────────────────

function generateLocationKeywords(seed) {
  const keywords = [];

  // Nigerian cities
  for (const city of NIGERIAN_CITIES) {
    keywords.push({
      keyword: `${seed} in ${city}`,
      type: 'location',
      market: 'Nigeria',
      difficulty: city === 'Lagos' || city === 'Abuja' ? 'Low' : 'Very Low',
      priority: city === 'Lagos' || city === 'Abuja' || city === 'Port Harcourt' ? 'HIGH' : 'MEDIUM',
    });
    keywords.push({
      keyword: `${seed} ${city}`,
      type: 'location-bare',
      market: 'Nigeria',
      difficulty: 'Very Low',
      priority: city === 'Lagos' || city === 'Abuja' || city === 'Port Harcourt' ? 'HIGH' : 'MEDIUM',
    });
  }

  // Africa
  for (const city of AFRICAN_CITIES) {
    keywords.push({
      keyword: `${seed} in ${city}`,
      type: 'location',
      market: 'Africa',
      difficulty: 'Low',
      priority: 'MEDIUM',
    });
  }

  // UK diaspora
  for (const city of UK_CITIES) {
    keywords.push({
      keyword: `${seed} in ${city}`,
      type: 'location',
      market: 'UK',
      difficulty: city === 'London' ? 'High' : 'Medium',
      priority: city === 'London' ? 'MEDIUM' : 'LOW',
    });
  }

  return keywords;
}

function generateCountryKeywords(seed) {
  const countries = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Uganda', 'Tanzania'];
  return countries.map(country => ({
    keyword: `${seed} ${country}`,
    type: 'country',
    market: country,
    difficulty: country === 'Nigeria' ? 'Low' : 'Low',
    priority: country === 'Nigeria' ? 'HIGH' : 'MEDIUM',
  }));
}

function generateIntentKeywords(seed) {
  const modifiers = [
    'how to',
    'best',
    'top',
    'free',
    'affordable',
    'cheap',
    'professional',
    'how much does',
    'is it worth',
    'tips for',
    'guide to',
    'step by step',
    'beginners guide',
    '2026',
    '2026 guide',
  ];

  return modifiers.map(mod => ({
    keyword: `${mod} ${seed}`,
    type: 'intent',
    market: 'Global',
    difficulty: 'Low',
    priority: 'MEDIUM',
  }));
}

function generateIndustryKeywords() {
  const results = [];
  const cities = ['Lagos', 'Abuja', 'Port Harcourt', 'Kano'];
  for (const industry of INDUSTRIES) {
    for (const city of cities) {
      results.push({
        keyword: `find ${industry} without website ${city}`,
        type: 'industry-location',
        market: 'Nigeria',
        difficulty: 'Very Low',
        priority: 'MEDIUM',
      });
      results.push({
        keyword: `${industry} website design ${city}`,
        type: 'industry-location',
        market: 'Nigeria',
        difficulty: 'Very Low',
        priority: 'LOW',
      });
    }
  }
  return results;
}

function generateToolKeywords() {
  const tools = ['Lovable', 'Framer', 'Webflow', 'WordPress', 'Squarespace', 'Wix', 'Claude AI'];
  const contexts = ['Nigeria', 'beginners', 'web designers', 'freelancers', 'agencies'];

  return tools.flatMap(tool =>
    contexts.map(ctx => ({
      keyword: `${tool} for ${ctx}`,
      type: 'tool',
      market: ctx === 'Nigeria' ? 'Nigeria' : 'Global',
      difficulty: 'Low',
      priority: ctx === 'Nigeria' ? 'HIGH' : 'LOW',
    }))
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

function generate() {
  const seedArg = process.argv[2];
  const seeds = seedArg ? [seedArg] : SEED_KEYWORDS;

  console.log('\n🔍 Runvax Keyword Generator\n');
  console.log(`Seeds: ${seeds.join(', ')}\n`);

  const allKeywords = [];

  for (const seed of seeds) {
    allKeywords.push(...generateLocationKeywords(seed));
    allKeywords.push(...generateCountryKeywords(seed));
    allKeywords.push(...generateIntentKeywords(seed));
  }

  allKeywords.push(...generateIndustryKeywords());
  allKeywords.push(...generateToolKeywords());

  // Deduplicate
  const seen = new Set();
  const unique = allKeywords.filter(k => {
    const key = k.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  unique.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

  // Display
  const byPriority = {
    HIGH: unique.filter(k => k.priority === 'HIGH'),
    MEDIUM: unique.filter(k => k.priority === 'MEDIUM'),
    LOW: unique.filter(k => k.priority === 'LOW'),
  };

  for (const [pri, kws] of Object.entries(byPriority)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${pri} PRIORITY (${kws.length} keywords)`);
    console.log('='.repeat(60));
    for (const kw of kws.slice(0, 20)) {
      console.log(`  [${kw.difficulty.padEnd(9)}] [${kw.market.padEnd(12)}] ${kw.keyword}`);
    }
    if (kws.length > 20) {
      console.log(`  ... and ${kws.length - 20} more.`);
    }
  }

  console.log(`\n✅ Total keywords generated: ${unique.length}`);

  // Write to a CSV for import into SEO tools
  const csvPath = 'content/blog/keywords-export.csv';
  const csvLines = ['Keyword,Type,Market,Difficulty,Priority'];
  for (const kw of unique) {
    csvLines.push(`"${kw.keyword}","${kw.type}","${kw.market}","${kw.difficulty}","${kw.priority}"`);
  }
  writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`\n📄 Exported ${unique.length} keywords to ${csvPath}`);

  // Surface top Nigeria HIGH keywords as blog post suggestions
  const nigeriaHigh = unique.filter(k => k.priority === 'HIGH' && k.market === 'Nigeria').slice(0, 20);
  console.log('\n📝 Top suggested blog posts (Nigeria, HIGH priority):');
  console.log('-'.repeat(60));
  for (const kw of nigeriaHigh) {
    const title = toTitle(kw.keyword);
    console.log(`  • "${title}"`);
    console.log(`    Keyword: "${kw.keyword}" | Difficulty: ${kw.difficulty}`);
  }

  console.log('\n');
}

function toTitle(keyword) {
  // Convert keyword to a blog post title format
  const k = keyword.trim();
  if (k.startsWith('how to ')) return `How to ${capitalise(k.slice(7))} (2026 Guide)`;
  if (k.startsWith('best ')) return `Best ${capitalise(k.slice(5))} in 2026`;
  if (k.startsWith('top ')) return `Top ${capitalise(k.slice(4))} in 2026`;
  if (k.startsWith('free ')) return `Free ${capitalise(k.slice(5))}`;
  if (k.includes(' Nigeria') || k.includes(' Lagos') || k.includes(' Abuja')) {
    return `${capitalise(k)} — Complete 2026 Guide`;
  }
  return capitalise(k) + ' — 2026 Guide';
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

generate();
