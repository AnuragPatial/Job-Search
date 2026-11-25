import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeExperience,
  classifyRoleTrack,
  deduplicateJobs,
  extractExperienceClaims,
  processRawJobs,
  type RawScrapedJob,
} from './jobMatcher';

test('classifyRoleTrack identifies Software Developer and related titles', () => {
  assert.equal(classifyRoleTrack('Junior Software Developer').track, 'software');
  assert.equal(classifyRoleTrack('Associate Full-Stack Engineer').track, 'software');
  assert.equal(classifyRoleTrack('Frontend React Developer').track, 'software');
  assert.equal(classifyRoleTrack('New Grad SWE - Backend Python').track, 'software');
  assert.equal(classifyRoleTrack('Graduate Application Developer').track, 'software');
});

test('classifyRoleTrack identifies Salesforce Developer and related terms', () => {
  assert.equal(classifyRoleTrack('Salesforce Developer').track, 'salesforce');
  assert.equal(classifyRoleTrack('Junior SFDC Apex Developer').track, 'salesforce');
  assert.equal(classifyRoleTrack('LWC / Lightning Web Components Engineer').track, 'salesforce');
  assert.equal(classifyRoleTrack('Associate Salesforce Platform Developer').track, 'salesforce');
  assert.equal(
    classifyRoleTrack('Junior CRM Developer', ['Salesforce', 'Apex']).track,
    'salesforce'
  );
});

test('classifyRoleTrack rejects non-developer business and sales roles', () => {
  assert.equal(classifyRoleTrack('Business Development Representative').track, null);
  assert.equal(classifyRoleTrack('Sales Development Representative (SDR)').track, null);
  assert.equal(classifyRoleTrack('Salesforce Account Executive').track, null);
  assert.equal(classifyRoleTrack('Marketing Manager').track, null);
});

test('analyzeExperience accepts 0-2 years, junior, associate, graduate, and LinkedIn entry-level', () => {
  const res1 = analyzeExperience({
    title: 'Software Developer',
    description: 'We are looking for candidates with 0-2 years of software engineering experience.',
  });
  assert.equal(res1.tier, 'verified_0_2');

  const res2 = analyzeExperience({
    title: 'Junior Salesforce Developer',
    description: 'Build Apex triggers and LWC components with our CRM team.',
  });
  assert.equal(res2.tier, 'verified_0_2');

  const res3 = analyzeExperience({
    title: 'Salesforce Developer',
    description: 'At least 1 year of hands-on Salesforce development experience required.',
  });
  assert.equal(res3.tier, 'verified_0_2');

  const res4 = analyzeExperience({
    title: 'Software Engineer',
    description: '',
    portalEntryLevelHint: true,
  });
  assert.equal(res4.tier, 'verified_0_2');

  const res5 = analyzeExperience({
    title: 'Backend Software Engineer',
    description: 'Requires 2+ years of software engineering experience.',
  });
  assert.equal(res5.tier, 'verified_0_2');
  assert.equal(res5.label, '2 yrs');
});

test('analyzeExperience rejects senior titles and 3+ years experience requirements', () => {
  assert.equal(
    analyzeExperience({
      title: 'Senior Software Engineer',
      description: 'Great team culture.',
    }).tier,
    'senior_excluded'
  );

  assert.equal(
    analyzeExperience({
      title: 'Staff Salesforce Architect',
      description: 'Lead enterprise CRM migrations.',
    }).tier,
    'senior_excluded'
  );

  assert.equal(
    analyzeExperience({
      title: 'Software Developer',
      description: 'Requirements: 3-5 years of professional backend development experience.',
    }).tier,
    'senior_excluded'
  );

  assert.equal(
    analyzeExperience({
      title: 'Salesforce Developer',
      description: 'Minimum 4 years of Salesforce Apex and LWC experience required.',
    }).tier,
    'senior_excluded'
  );
});

test('extractExperienceClaims ignores company history and degree years', () => {
  const claims = extractExperienceClaims(
    'Founded over 20 years ago in business. Requires a 4-year bachelor degree and 1-2 years of coding experience.'
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].min, 1);
  assert.equal(claims[0].max, 2);
});

test('processRawJobs filters and deduplicates cross-posted jobs while preserving richest fields', () => {
  const raw: RawScrapedJob[] = [
    {
      externalId: 'li-1',
      title: 'Junior Salesforce Developer',
      company: 'Acme Cloud Inc.',
      location: 'Remote, US',
      url: 'https://linkedin.com/jobs/view/1',
      postedAt: new Date().toISOString(),
      portalId: 'linkedin',
      portalName: 'LinkedIn',
      portalEngine: 'JobSpy',
      portalAttributionUrl: 'https://www.linkedin.com/jobs',
      portalEntryLevelHint: true,
      description: '',
    },
    {
      externalId: 'rem-1',
      title: 'Junior Salesforce Developer',
      company: 'Acme Cloud',
      location: 'Remote',
      url: 'https://remotive.com/jobs/1',
      postedAt: new Date().toISOString(),
      portalId: 'remotive',
      portalName: 'Remotive',
      portalEngine: 'Community Portals',
      portalAttributionUrl: 'https://remotive.com',
      salaryMin: 75000,
      salaryMax: 95000,
      salaryCurrency: 'USD',
      description:
        'We seek a Junior Salesforce Developer with 0-2 years of Apex and Lightning Web Components experience to build CRM automations and APIs for our customers worldwide.',
    },
    {
      externalId: 'rem-2',
      title: 'Senior Software Engineer',
      company: 'BigTech',
      location: 'Remote',
      url: 'https://remotive.com/jobs/2',
      postedAt: new Date().toISOString(),
      portalId: 'remotive',
      portalName: 'Remotive',
      portalEngine: 'Community Portals',
      portalAttributionUrl: 'https://remotive.com',
      description: '7+ years of distributed systems experience.',
    },
  ];

  const processed = processRawJobs(raw);
  assert.equal(processed.length, 1);
  assert.equal(processed[0].track, 'salesforce');
  assert.equal(processed[0].salaryText, '$75k–$95k');
  assert.equal(processed[0].crossPostedPortals.length, 1);
  assert.equal(deduplicateJobs(processed).length, 1);
});

test('classifyEligibility distinguishes India, Global Remote, and US/EU restricted roles', async () => {
  const { classifyEligibility, formatSalary } = await import('./jobMatcher');

  assert.equal(
    classifyEligibility({
      location: 'Bengaluru, Karnataka',
      countryCode: 'IN',
      isRemote: false,
      portalId: 'indeed',
    }).eligibility,
    'india'
  );

  assert.equal(
    classifyEligibility({
      location: 'Pune',
      isRemote: false,
      portalId: 'naukri',
    }).eligibility,
    'india'
  );

  assert.equal(
    classifyEligibility({
      location: 'Worldwide',
      isRemote: true,
      portalId: 'remotive',
    }).eligibility,
    'global'
  );

  assert.equal(
    classifyEligibility({
      location: 'Austin, TX',
      countryCode: 'US',
      isRemote: false,
      portalId: 'linkedin',
    }).eligibility,
    'other_region'
  );

  assert.equal(formatSalary(600000, 1200000, 'INR'), '₹6L–₹12L');
});

test('analyzeExperience handles structured Naukri min/max experience accurately', () => {
  const entry = analyzeExperience({
    title: 'Salesforce Developer',
    structuredMinExp: 0,
    structuredMaxExp: 2,
  });
  assert.equal(entry.tier, 'verified_0_2');
  assert.equal(entry.label, '0–2 yrs');

  const broader = analyzeExperience({
    title: 'Salesforce Developer',
    structuredMinExp: 1,
    structuredMaxExp: 5,
  });
  assert.equal(broader.tier, 'unspecified_open');

  const senior = analyzeExperience({
    title: 'Software Developer',
    structuredMinExp: 4,
    structuredMaxExp: 7,
  });
  assert.equal(senior.tier, 'senior_excluded');
});
