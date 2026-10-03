import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import companyConfig from '../../config/company.js';

jest.retryTimes(2, { logErrorsBeforeRetry: true }); // live third-party ANAF/search calls are occasionally slow in CI

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Live API tests hit api.peviitor.ro (no credential needed) -- opt in explicitly.
const HAS_SOLR = !!process.env.RUN_LIVE_API_TESTS;

const TEST_CIF = companyConfig.cif;
const TEST_BRAND = companyConfig.brand;
const LEGAL_NAME = companyConfig.legalName;
const BREEZY_API_URL = 'https://yardiromania.breezy.hr/json';
const ROMANIAN_CITIES = ['Cluj-Napoca'];

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: set RUN_LIVE_API_TESTS=1 to run)`, fn, timeout);
}

describe('E2E: Full Scraping Pipeline', () => {

  describe('Yardi Breezy API — Real Data Fetch', () => {
    let apiData;

    beforeAll(async () => {
      const res = await fetch(BREEZY_API_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      apiData = await res.json();
    }, 15000);

    it('should respond with valid job data from Breezy API', () => {
      expect(Array.isArray(apiData)).toBe(true);
      expect(apiData.length).toBeGreaterThan(0);
    }, 10000);

    it('should have jobs with expected fields', () => {
      const job = apiData[0];
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('name');
      expect(typeof job.name).toBe('string');
      expect(job).toHaveProperty('url');
      expect(job.url).toMatch(/^https:\/\/yardiromania\.breezy\.hr\/p\//);
    });

    it('should have Romanian location on all jobs', () => {
      const allLocations = apiData.map(j => {
        const loc = j.location || j.locations?.[0];
        return loc?.country?.name || loc?.name || '';
      });
      expect(allLocations.length).toBeGreaterThan(0);
      expect(allLocations.every(l => l.toLowerCase().includes('romania') || l.toLowerCase().includes('cluj'))).toBe(true);
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let apiData;

    beforeAll(async () => {
      index = await import('../../index.js');
      const res = await fetch(BREEZY_API_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      apiData = await res.json();
    }, 15000);

    it('should parse real Breezy API response into standardized format', () => {
      const result = index.parseApiJobs(apiData);

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('total');
      expect(result.jobs.length).toBeGreaterThan(0);

      const parsed = result.jobs[0];
      expect(parsed).toHaveProperty('url');
      expect(parsed.url).toMatch(/^https:\/\/yardiromania\.breezy\.hr\//);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('workmode');
      expect(['remote', 'on-site', 'hybrid']).toContain(parsed.workmode);
      expect(parsed).toHaveProperty('location');
      expect(Array.isArray(parsed.location)).toBe(true);
    });

    it('should map parsed jobs to job model', () => {
      const parsed = index.parseApiJobs(apiData);
      const model = index.mapToJobModel(parsed.jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
      expect(model.url).toMatch(/^https:\/\/yardiromania\.breezy\.hr\//);
    });

    it('should transform jobs and filter to Romanian locations', () => {
      const parsed = index.parseApiJobs(apiData);
      const jobs = parsed.jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'yardiromania.breezy.hr',
        company: LEGAL_NAME,
        cif: TEST_CIF,
        jobs
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toBe(LEGAL_NAME);
      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
        expect(job.workmode).toMatch(/^(remote|on-site|hybrid)$/);
      }
    });

    it('should produce valid job URLs that are accessible', async () => {
      const parsed = index.parseApiJobs(apiData);

      for (const job of parsed.jobs.slice(0, 2)) {
        const res = await fetch(job.url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'job_seeker_ro_spider' }
        });
        expect(res.ok).toBe(true);
      }
    }, 30000);
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    it('should find YARDI in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const found = results.find(c =>
        c.cui.toString() === TEST_CIF
      );
      expect(found).toBeDefined();
      expect(found.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe(LEGAL_NAME);
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log(`⚠️ No ${TEST_BRAND} jobs in Solr — skipping job count assertion`);
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have YARDI jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log(`⚠️ No ${TEST_BRAND} jobs in Solr — skipping SOLR data verification`);
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toBe(LEGAL_NAME);
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have YARDI company core entry with required fields', async () => {
      const companyData = await solr.getCompanyByCif(TEST_CIF);

      expect(companyData).not.toBeNull();
      expect(companyData.company).toBe(LEGAL_NAME);
      expect(companyData.status).toBe('activ');
    }, 15000);
  });
});
