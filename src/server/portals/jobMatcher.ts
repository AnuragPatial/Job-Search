import type {
  EligibilityRegion,
  ExperienceTier,
  JobListing,
  PortalId,
  RoleTrack,
} from '../../types/jobs';

export interface RawScrapedJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  countryCode?: string;
  isRemote?: boolean;
  url: string;
  postedAt: string;
  salaryText?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  jobType?: string | null;
  tags?: string[];
  seniorityTags?: string[];
  description?: string;
  excerpt?: string;
  structuredMinExp?: number | null;
  structuredMaxExp?: number | null;
  portalId: PortalId;
  portalName: string;
  portalEngine: 'JobSpy' | 'Community Portals';
  portalAttributionUrl: string;
  portalEntryLevelHint?: boolean;
  linkedinJobId?: string;
}

export interface RoleClassification {
  track: RoleTrack | null;
  matchedKeywords: string[];
  titleScore: number;
}

export interface ExperienceAnalysis {
  tier: ExperienceTier | 'senior_excluded';
  label: string;
  reason: string;
  scoreBonus: number;
}

export const KEYWORD_GROUPS = {
  software: [
    'Software Developer',
    'Software Engineer',
    'SWE',
    'Full-Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Junior Developer',
    'Associate Engineer',
    'Web / Application Dev',
    'React / Node / Python / Java Dev',
  ],
  salesforce: [
    'Salesforce Developer',
    'SFDC Developer',
    'Apex Developer',
    'LWC / Lightning Dev',
    'Salesforce Engineer',
    'Platform Developer',
    'Salesforce Technical Consultant',
    'Salesforce Admin / Dev',
  ],
} as const;

const NON_DEV_EXCLUSION_RE =
  /\b(business development|sales development|sales rep|sales representative|account executive|account manager|\bsdr\b|\bbdr\b|real estate developer|property developer|land developer|curriculum developer|workforce development|fundraising|donor development|partnerships manager|recruiter|talent acquisition|marketing manager|content writer|graphic designer|ux researcher|customer success|support representative|office manager|payroll|bookkeeper|nurse|physician|therapist|counselor|warehouse|driver|cashier)\b/i;

const SALESFORCE_TITLE_RULES: Array<{ label: string; regex: RegExp; weight: number }> = [
  { label: 'Salesforce Developer', regex: /\bsalesforce\b.*\b(developer|dev|engineer|programmer)\b|\b(developer|dev|engineer)\b.*\bsalesforce\b/i, weight: 40 },
  { label: 'SFDC Developer', regex: /\bsfdc\b.*\b(developer|dev|engineer|consultant|admin)?\b/i, weight: 38 },
  { label: 'Apex Developer', regex: /\bapex\b.*\b(developer|dev|engineer|salesforce)\b|\bsalesforce\b.*\bapex\b/i, weight: 36 },
  { label: 'LWC / Lightning', regex: /\b(lwc|lightning web components?|lightning developer|visualforce)\b/i, weight: 36 },
  { label: 'Salesforce Platform', regex: /\bsalesforce\b.*\b(platform|technical|consultant|specialist|administrator|admin|analyst|crm|cloud|cpq|mulesoft|commerce|marketing cloud|service cloud|sales cloud)\b/i, weight: 30 },
  { label: 'CRM Developer (Salesforce)', regex: /\bcrm\b.*\b(developer|engineer)\b/i, weight: 18 },
];

const SALESFORCE_CONTEXT_RE = /\b(salesforce|sfdc|apex|lightning web components?|lwc|visualforce|soql|trailhead)\b/i;

const SOFTWARE_TITLE_RULES: Array<{ label: string; regex: RegExp; weight: number }> = [
  { label: 'Software Developer', regex: /\bsoftware\s+(developer|dev)\b/i, weight: 38 },
  { label: 'Software Engineer', regex: /\bsoftware\s+engineer(ing)?\b|\bswe\b|\bsde\b/i, weight: 38 },
  { label: 'Full-Stack Developer', regex: /\bfull[\s-]?stack\b/i, weight: 34 },
  { label: 'Frontend Developer', regex: /\bfront[\s-]?end\b|\bui\s+developer\b|\bui\s+engineer\b/i, weight: 32 },
  { label: 'Backend Developer', regex: /\bback[\s-]?end\b|\bapi\s+(developer|engineer)\b/i, weight: 32 },
  { label: 'Web Developer', regex: /\bweb\s+(developer|engineer)\b/i, weight: 30 },
  { label: 'Application Developer', regex: /\b(application|systems?|platform|cloud|integration|product)\s+(developer|engineer)\b/i, weight: 28 },
  { label: 'Mobile Developer', regex: /\b(mobile|ios|android|flutter|react native)\s+(developer|engineer)\b/i, weight: 30 },
  { label: 'Language / Stack Dev', regex: /\b(javascript|typescript|react|angular|vue|node\.?js|python|java|kotlin|swift|golang|go|rust|c#|c\+\+|\.net|php|ruby|rails|django|spring)\s+(developer|engineer)\b/i, weight: 32 },
  { label: 'QA / SDET Engineer', regex: /\b(sdet|qa\s+automation|test\s+automation)\s*(engineer|developer)?\b/i, weight: 24 },
  { label: 'Developer / Programmer', regex: /\b(junior|associate|entry[\s-]?level|graduate|grad|intern|trainee)\s+(developer|engineer|programmer)\b|\bprogrammer\b/i, weight: 26 },
  { label: 'Developer', regex: /\bdeveloper\b/i, weight: 18 },
];

const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|principal|lead|architect|director|vp|vice\s+president|head\s+of|chief|\bcto\b|\bcio\b|engineering\s+manager|manager|distinguished|fellow|mid[\s-]?senior|\biii\b|\biv\b|\blevel\s*[3-9]\b|\bl[4-9]\b|\bsde[\s-]?[2-9]\b|\bswe[\s-]?[2-9]\b|\bengineer\s+(ii|iii|iv|2|3|4)\b|\bdeveloper\s+(ii|iii|iv|2|3|4)\b)\b/i;

const ENTRY_TITLE_RE =
  /\b(junior|jr\.?|entry[\s-]?level|entry\s+level|associate|new\s+grad|graduate|grad\b|fresher|intern|internship|trainee|apprentice|early\s+career|level\s*1|\bl1\b|\bl2\b|sde[\s-]?1|sde[\s-]?i\b|swe[\s-]?1|swe[\s-]?i\b|developer\s+i\b|engineer\s+i\b|0[\s-]*[-–to]+\s*[12]\s*(?:years?|yrs?))\b/i;

const SENIOR_TAG_RE = /\b(senior|sr\.?|lead|principal|staff|executive|director|manager|mid[\s-]?senior)\b/i;
const ENTRY_TAG_RE = /\b(junior|entry|entry[\s-]?level|associate|intern|internship|graduate|new\s+grad|early\s+career)\b/i;

export function stripHtmlToText(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function classifyRoleTrack(
  title: string,
  tags: string[] = [],
  description = ''
): RoleClassification {
  const cleanTitle = title.trim();
  if (!cleanTitle || NON_DEV_EXCLUSION_RE.test(cleanTitle)) {
    return { track: null, matchedKeywords: [], titleScore: 0 };
  }

  const sfKeywords: string[] = [];
  let sfScore = 0;

  for (const rule of SALESFORCE_TITLE_RULES) {
    if (rule.regex.test(cleanTitle)) {
      if (rule.label === 'CRM Developer (Salesforce)') {
        const context = `${cleanTitle} ${tags.join(' ')} ${description.slice(0, 1200)}`;
        if (!SALESFORCE_CONTEXT_RE.test(context)) continue;
      }
      sfKeywords.push(rule.label);
      sfScore = Math.max(sfScore, rule.weight);
    }
  }

  // Also detect Salesforce Developer if title says Developer/Engineer and tags/intro explicitly focus on Salesforce/Apex/LWC
  if (sfScore === 0 && /\b(developer|engineer|consultant)\b/i.test(cleanTitle)) {
    const tagBlob = tags.join(' ');
    if (SALESFORCE_CONTEXT_RE.test(tagBlob)) {
      sfKeywords.push('Salesforce Stack');
      sfScore = 28;
    }
  }

  const swKeywords: string[] = [];
  let swScore = 0;

  for (const rule of SOFTWARE_TITLE_RULES) {
    if (rule.regex.test(cleanTitle)) {
      swKeywords.push(rule.label);
      swScore = Math.max(swScore, rule.weight);
    }
  }

  if (sfScore > 0) {
    return {
      track: 'salesforce',
      matchedKeywords: Array.from(new Set([...sfKeywords, ...swKeywords])).slice(0, 4),
      titleScore: sfScore,
    };
  }

  if (swScore > 0) {
    return {
      track: 'software',
      matchedKeywords: Array.from(new Set(swKeywords)).slice(0, 4),
      titleScore: swScore,
    };
  }

  return { track: null, matchedKeywords: [], titleScore: 0 };
}

interface ExtractedYearClaim {
  min: number;
  max: number | null;
  snippet: string;
}

const EXPERIENCE_CONTEXT_HINT_RE =
  /\b(experience|exp\.?|working|developing|development|engineering|coding|programming|salesforce|apex|lwc|software|hands[\s-]?on|professional|industry|commercial|background|minimum|at\s+least|required|qualifications?|preferred|years?\s+in\s+(?:software|web|full|front|back|salesforce|tech|it|programming|building))\b/i;

const NON_EXPERIENCE_YEAR_RE =
  /\b(degree|bachelor|master|phd|university|founded|in\s+business|company\s+history|anniversary|fiscal|stock|vesting|cliff|pto|vacation|sabbatical|old|age|prison|sentence|warranty|lease|contract\s+term)\b/i;

export function extractExperienceClaims(text: string): ExtractedYearClaim[] {
  if (!text) return [];
  const normalized = text.replace(/\s+/g, ' ');
  const claims: ExtractedYearClaim[] = [];

  const patterns: Array<{
    regex: RegExp;
    parse: (m: RegExpExecArray) => { min: number; max: number | null };
  }> = [
    // Range: "0-2 years", "1 to 2 years", "3–5 yrs", "0 - 2+ years"
    {
      regex: /\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\+?\s*(?:years?|yrs?)\b/gi,
      parse: (m) => ({ min: Number(m[1]), max: Number(m[2]) }),
    },
    // Plus: "2+ years", "5+ yrs", "1+ year"
    {
      regex: /\b(\d{1,2})\s*\+\s*(?:years?|yrs?)\b/gi,
      parse: (m) => ({ min: Number(m[1]), max: null }),
    },
    // Minimum / At least: "at least 2 years", "minimum 3 years", "minimum of 1 year"
    {
      regex: /\b(?:minimum(?:\s+of)?|min\.?|at\s+least|over|more\s+than)\s+(\d{1,2})\+?\s*(?:years?|yrs?)\b/gi,
      parse: (m) => ({ min: Number(m[1]), max: null }),
    },
    // Up to / Less than: "up to 2 years", "less than 2 years"
    {
      regex: /\b(?:up\s+to|less\s+than|under|max(?:imum)?\s+of?)\s+(\d{1,2})\s*(?:years?|yrs?)\b/gi,
      parse: (m) => ({ min: 0, max: Number(m[1]) }),
    },
    // Plain "1 year of experience" / "2 years experience"
    {
      regex: /\b(\d{1,2})\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[\w-]+\s+){0,3}(?:experience|exp\.?)\b/gi,
      parse: (m) => ({ min: Number(m[1]), max: Number(m[1]) }),
    },
  ];

  const matchedSpans: Array<[number, number]> = [];

  for (const { regex, parse } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized)) !== null) {
      const mStart = match.index;
      const mEnd = match.index + match[0].length;
      if (matchedSpans.some(([s, e]) => mStart < e && mEnd > s)) continue;

      const { min, max } = parse(match);
      if (Number.isNaN(min) || min > 15 || (max !== null && max > 20)) continue;
      if (max !== null && max < min) continue;

      const start = Math.max(0, mStart - 45);
      const end = Math.min(normalized.length, mEnd + 55);
      const windowText = normalized.slice(start, end);

      const tightStart = Math.max(0, mStart - 10);
      const tightEnd = Math.min(normalized.length, mEnd + 20);
      const tightWindow = normalized.slice(tightStart, tightEnd);

      if (NON_EXPERIENCE_YEAR_RE.test(tightWindow)) continue;
      if (!EXPERIENCE_CONTEXT_HINT_RE.test(windowText)) continue;

      matchedSpans.push([mStart, mEnd]);
      claims.push({
        min,
        max,
        snippet: match[0].trim(),
      });
    }
  }

  return claims;
}

export function analyzeExperience(params: {
  title: string;
  description?: string;
  seniorityTags?: string[];
  portalEntryLevelHint?: boolean;
  structuredMinExp?: number | null;
  structuredMaxExp?: number | null;
}): ExperienceAnalysis {
  const {
    title,
    description = '',
    seniorityTags = [],
    portalEntryLevelHint = false,
    structuredMinExp = null,
    structuredMaxExp = null,
  } = params;
  const hasEntryTitle = ENTRY_TITLE_RE.test(title);
  const hasSeniorTitle = SENIOR_TITLE_RE.test(title);

  // 1. Reject clear senior titles unless explicitly junior/entry/associate/intern
  if (hasSeniorTitle && !hasEntryTitle) {
    return {
      tier: 'senior_excluded',
      label: 'Senior / Mid+',
      reason: 'Title indicates mid-senior, lead, or management seniority',
      scoreBonus: -100,
    };
  }

  const tagBlob = seniorityTags.join(' ');
  const hasEntryTag = ENTRY_TAG_RE.test(tagBlob);
  const hasSeniorTag = SENIOR_TAG_RE.test(tagBlob);

  if (hasSeniorTag && !hasEntryTag && !hasEntryTitle) {
    return {
      tier: 'senior_excluded',
      label: 'Senior / Mid+',
      reason: `Portal seniority tag indicates higher experience (${tagBlob.trim()})`,
      scoreBonus: -100,
    };
  }

  // 1b. Structured min/max experience from portals like Naukri
  if (structuredMinExp !== null && !Number.isNaN(structuredMinExp)) {
    if (structuredMinExp >= 3 && !hasEntryTitle) {
      return {
        tier: 'senior_excluded',
        label: `${structuredMinExp}+ yrs`,
        reason: `Portal requires minimum ${structuredMinExp} years experience`,
        scoreBonus: -100,
      };
    }
    const maxVal =
      structuredMaxExp !== null && !Number.isNaN(structuredMaxExp)
        ? structuredMaxExp
        : null;
    if (structuredMinExp <= 2 && (maxVal === null || maxVal <= 3)) {
      const label =
        maxVal !== null && maxVal !== structuredMinExp
          ? `${structuredMinExp}–${maxVal} yrs`
          : structuredMinExp === 0
            ? '0–2 yrs'
            : `${structuredMinExp} ${structuredMinExp === 1 ? 'yr' : 'yrs'}`;
      return {
        tier: 'verified_0_2',
        label,
        reason: `Structured portal experience range (${structuredMinExp}${maxVal !== null ? `–${maxVal}` : '+'} yrs)`,
        scoreBonus: 36,
      };
    }
    if (structuredMinExp <= 2 && maxVal !== null && maxVal <= 5) {
      return {
        tier: 'unspecified_open',
        label: `${structuredMinExp}–${maxVal} yrs`,
        reason: `Accepts ${structuredMinExp}–2 yr candidates within a broader ${structuredMinExp}–${maxVal} yr band`,
        scoreBonus: 14,
      };
    }
    if (maxVal !== null && maxVal > 5 && !hasEntryTitle) {
      return {
        tier: 'senior_excluded',
        label: `${structuredMinExp}–${maxVal} yrs`,
        reason: `Broader mid-senior band (${structuredMinExp}–${maxVal} yrs)`,
        scoreBonus: -100,
      };
    }
  }

  // 2. Inspect explicit years mentioned in title + description
  const claims = extractExperienceClaims(`${title}. ${description}`);
  if (claims.length > 0) {
    // Reject if the posting requires 3+ years of experience (even if another secondary skill asks for 1 yr)
    const highClaim = claims.find((c) => c.min >= 3);
    if (highClaim && !hasEntryTitle) {
      return {
        tier: 'senior_excluded',
        label: `${highClaim.min}+ yrs`,
        reason: `Requires 3+ years experience ("${highClaim.snippet}")`,
        scoreBonus: -100,
      };
    }

    // Check for explicit 0-2 year match
    const entryClaim = claims.find(
      (c) => c.min <= 2 && (c.max === null || c.max <= 3)
    );
    if (entryClaim) {
      let rangeLabel: string;
      if (entryClaim.max !== null) {
        const cappedMax = Math.min(entryClaim.max, 2);
        rangeLabel =
          entryClaim.min === cappedMax
            ? `${entryClaim.min} ${entryClaim.min === 1 ? 'yr' : 'yrs'}`
            : `${entryClaim.min}–${cappedMax} yrs`;
      } else if (entryClaim.min === 0) {
        rangeLabel = '0–2 yrs';
      } else if (entryClaim.min === 1) {
        rangeLabel = '1–2 yrs';
      } else {
        rangeLabel = '2 yrs';
      }
      return {
        tier: 'verified_0_2',
        label: rangeLabel,
        reason: `Explicitly matches 0–2 yrs requirement ("${entryClaim.snippet}")`,
        scoreBonus: 35,
      };
    }
  }

  // 3. Explicit Entry-Level / Junior / Associate / Intern / New Grad title or tag
  if (hasEntryTitle) {
    return {
      tier: 'verified_0_2',
      label: '0–2 yrs (Entry / Junior)',
      reason: 'Title specifies junior, associate, graduate, intern, or entry-level role',
      scoreBonus: 30,
    };
  }

  if (hasEntryTag) {
    return {
      tier: 'verified_0_2',
      label: '0–2 yrs (Entry Tag)',
      reason: `Tagged as entry-level or junior (${tagBlob.trim()})`,
      scoreBonus: 26,
    };
  }

  // 4. LinkedIn JobSpy Entry-Level filter (f_E=1,2)
  if (portalEntryLevelHint) {
    return {
      tier: 'verified_0_2',
      label: '0–2 yrs (Entry-Level)',
      reason: 'Matched LinkedIn Internship / Entry-Level (f_E=1,2) filter',
      scoreBonus: 22,
    };
  }

  // 5. Non-senior Software/Salesforce role with no explicit years mentioned
  return {
    tier: 'unspecified_open',
    label: 'Exp. unspecified',
    reason: 'Non-senior role with no 3+ year requirement detected',
    scoreBonus: 5,
  };
}

export function normalizeDedupeKey(company: string, title: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(inc|llc|ltd|corp|corporation|co|gmbh|limited)\b/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  return `${norm(company)}::${norm(title)}`;
}

const INDIA_LOCATION_RE =
  /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|navi mumbai|thane|new delhi|delhi|ncr|noida|greater noida|gurugram|gurgaon|chennai|kolkata|ahmedabad|jaipur|kochi|cochin|chandigarh|mohali|indore|coimbatore|thiruvananthapuram|trivandrum|bhubaneswar|nagpur|vadodara|surat|lucknow|visakhapatnam|mysuru|mysore|mangaluru|karnataka|maharashtra|telangana|tamil nadu|uttar pradesh|haryana|gujarat|kerala|west bengal|rajasthan)\b/i;

const GLOBAL_OPEN_RE =
  /\b(worldwide|anywhere|global|international|all countries|work from anywhere|emea|apac|asia|remote\s*\(worldwide\)|remote\s*\(global\)|anywhere in the world)\b/i;

const NON_INDIA_COUNTRY_RESTRICTION_RE =
  /\b(united states|u\.s\.a?\.?|usa only|us only|us-based|us remote|north america|canada|united kingdom|\buk\b|england|scotland|ireland|germany|deutschland|berlin|munich|frankfurt|hamburg|france|paris|switzerland|zurich|zürich|geneva|netherlands|amsterdam|spain|madrid|barcelona|italy|poland|sweden|norway|denmark|finland|austria|vienna|belgium|portugal|australia|sydney|melbourne|new zealand|brazil|mexico|latin america|latam|europe only|eu only|eea|,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b)\b/i;

export function classifyEligibility(params: {
  location: string;
  countryCode?: string;
  isRemote: boolean;
  portalId: PortalId;
  description?: string;
}): { eligibility: EligibilityRegion; eligibilityLabel: string } {
  const loc = (params.location || '').trim();
  const country = (params.countryCode || '').toUpperCase();

  // 1. Direct India signals (Naukri, IN countryCode, or Indian city/state/country)
  if (params.portalId === 'naukri' || country === 'IN' || INDIA_LOCATION_RE.test(loc)) {
    return {
      eligibility: 'india',
      eligibilityLabel: params.isRemote ? 'India (Remote)' : 'India',
    };
  }

  // 2. Explicit Global / Worldwide / Anywhere / APAC signals
  if (GLOBAL_OPEN_RE.test(loc)) {
    return {
      eligibility: 'global',
      eligibilityLabel: 'Global Remote',
    };
  }

  // 3. Unrestricted Remote (e.g., "Remote", "Unspecified" on global remote portals without US/EU-only lock)
  if (
    params.isRemote &&
    country !== 'US' &&
    !NON_INDIA_COUNTRY_RESTRICTION_RE.test(loc)
  ) {
    // Double-check description intro for strict US work authorization lock
    const descIntro = (params.description || '').slice(0, 700);
    if (!/\b(us citizens? only|authorized to work in the united states|must reside in the u\.?s\.?)\b/i.test(descIntro)) {
      return {
        eligibility: 'global',
        eligibilityLabel: 'Global Remote',
      };
    }
  }

  return {
    eligibility: 'other_region',
    eligibilityLabel: country === 'US' ? 'US Region' : 'Other Region',
  };
}

export function formatSalary(
  min?: number | null,
  max?: number | null,
  currency?: string | null,
  rawText?: string | null
): string | null {
  if (rawText && rawText.trim().length > 0) {
    return rawText.trim();
  }
  if (!min && !max) return null;
  const code = (currency || 'USD').toUpperCase();

  if (code === 'INR') {
    const fmtInr = (n: number) => {
      if (n >= 100000) {
        const lakhs = n / 100000;
        return `₹${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(1)}L`;
      }
      if (n >= 1000) {
        return `₹${Math.round(n / 1000)}k`;
      }
      return `₹${n}`;
    };
    if (min && max && min !== max) {
      return `${fmtInr(min)}–${fmtInr(max)}`;
    }
    const val = min || max;
    return val ? fmtInr(val) : null;
  }

  const sym =
    code === 'USD'
      ? '$'
      : code === 'EUR'
        ? '€'
        : code === 'GBP'
          ? '£'
          : `${code} `;

  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;

  if (min && max && min !== max) {
    return `${sym}${fmt(min)}–${sym}${fmt(max)}`;
  }
  const val = min || max;
  return val ? `${sym}${fmt(val)}` : null;
}

export function processRawJobs(rawJobs: RawScrapedJob[]): JobListing[] {
  const accepted: JobListing[] = [];

  for (const raw of rawJobs) {
    const cleanDescription = stripHtmlToText(raw.description || raw.excerpt || '');
    const classification = classifyRoleTrack(
      raw.title,
      raw.tags || [],
      cleanDescription
    );

    if (!classification.track) continue;

    const exp = analyzeExperience({
      title: raw.title,
      description: cleanDescription,
      seniorityTags: raw.seniorityTags,
      portalEntryLevelHint: raw.portalEntryLevelHint,
      structuredMinExp: raw.structuredMinExp,
      structuredMaxExp: raw.structuredMaxExp,
    });

    if (exp.tier === 'senior_excluded') continue;

    const isRemote =
      raw.isRemote ??
      /\b(remote|anywhere|work from home|wfh|worldwide)\b/i.test(
        `${raw.location} ${raw.title} ${(raw.tags || []).join(' ')}`
      );

    const { eligibility, eligibilityLabel } = classifyEligibility({
      location: raw.location,
      countryCode: raw.countryCode,
      isRemote,
      portalId: raw.portalId,
      description: cleanDescription,
    });

    const excerptSource = stripHtmlToText(raw.excerpt) || cleanDescription;
    const excerpt =
      excerptSource.length > 220
        ? `${excerptSource.slice(0, 217).trim()}...`
        : excerptSource;

    const postedMs = Date.parse(raw.postedAt);
    const ageDays = Number.isNaN(postedMs)
      ? 14
      : Math.max(0, (Date.now() - postedMs) / (1000 * 60 * 60 * 24));
    const recencyBonus = Math.max(0, 20 - Math.floor(ageDays));

    const salaryText = formatSalary(
      raw.salaryMin,
      raw.salaryMax,
      raw.salaryCurrency,
      raw.salaryText
    );

    const id = `${raw.portalId}-${raw.externalId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    accepted.push({
      id,
      externalId: raw.externalId,
      title: raw.title.trim(),
      company: raw.company.trim() || 'Confidential',
      location: raw.location.trim() || (isRemote ? 'Remote' : 'Unspecified'),
      isRemote,
      eligibility,
      eligibilityLabel,
      track: classification.track,
      matchedKeywords: classification.matchedKeywords,
      experienceTier: exp.tier,
      experienceLabel: exp.label,
      experienceReason: exp.reason,
      portalId: raw.portalId,
      portalName: raw.portalName,
      portalEngine: raw.portalEngine,
      portalAttributionUrl: raw.portalAttributionUrl,
      crossPostedPortals: [],
      url: raw.url,
      postedAt: Number.isNaN(postedMs) ? new Date().toISOString() : new Date(postedMs).toISOString(),
      salaryText,
      salaryMin: raw.salaryMin ?? null,
      salaryMax: raw.salaryMax ?? null,
      salaryCurrency: raw.salaryCurrency ?? null,
      jobType: raw.jobType ?? null,
      tags: Array.from(new Set((raw.tags || []).filter(Boolean))).slice(0, 6),
      excerpt,
      description: cleanDescription,
      hasFullDescription: cleanDescription.length > 140,
      linkedinJobId: raw.linkedinJobId,
      relevanceScore: classification.titleScore + exp.scoreBonus + recencyBonus,
    });
  }

  return deduplicateJobs(accepted);
}

export function deduplicateJobs(jobs: JobListing[]): JobListing[] {
  const map = new Map<string, JobListing>();

  for (const job of jobs) {
    const key = normalizeDedupeKey(job.company, job.title);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, job);
      continue;
    }

    // Keep the richer listing (prefer verified_0_2, longer description, salary)
    const score = (j: JobListing) =>
      (j.experienceTier === 'verified_0_2' ? 100 : 0) +
      (j.hasFullDescription ? 40 : 0) +
      (j.salaryText ? 25 : 0) +
      j.relevanceScore;

    const winner = score(job) > score(existing) ? { ...job } : { ...existing };
    const loser = score(job) > score(existing) ? existing : job;

    if (
      loser.portalName !== winner.portalName &&
      !winner.crossPostedPortals.includes(loser.portalName)
    ) {
      winner.crossPostedPortals = [...winner.crossPostedPortals, loser.portalName];
    }
    if (!winner.salaryText && loser.salaryText) {
      winner.salaryText = loser.salaryText;
      winner.salaryMin = loser.salaryMin;
      winner.salaryMax = loser.salaryMax;
    }
    if (!winner.hasFullDescription && loser.hasFullDescription) {
      winner.description = loser.description;
      winner.excerpt = loser.excerpt;
      winner.hasFullDescription = true;
    }

    map.set(key, winner);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return Date.parse(b.postedAt) - Date.parse(a.postedAt);
  });
}
