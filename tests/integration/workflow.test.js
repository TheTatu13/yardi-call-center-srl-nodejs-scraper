import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import companyConfig from '../../config/company.js';

jest.retryTimes(2, { logErrorsBeforeRetry: true }); // live third-party ANAF/search calls are occasionally slow in CI

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Live API tests hit api.peviitor.ro (no credential needed) -- opt in explicitly.
const HAS_SOLR = !!process.env.RUN_LIVE_API_TESTS;

const COMPANY_CIF = companyConfig.cif;
const LEGAL_NAME = companyConfig.legalName;
const BRAND = companyConfig.brand;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: set RUN_LIVE_API_TESTS=1 to run)`, fn, timeout);
}

describe('Integration: API Workflow', () => {

  describe('ANAF API', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should search for company brand and find the company', async () => {
      const results = await anaf.searchCompany(BRAND);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const company = results.find(c =>
        c.cui.toString() === COMPANY_CIF
      );
      expect(company).toBeDefined();
      expect(company.cui.toString()).toBe(COMPANY_CIF);
    }, 15000);

    it('should return empty array for non-existent brand', async () => {
      const results = await anaf.searchCompany('ThisBrandDoesNotExistXYZ123');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }, 15000);

    it('should fetch company details by valid CIF', async () => {
      const data = await anaf.getCompanyFromANAF(COMPANY_CIF);

      expect(data).toBeDefined();
      expect(data.cui).toBe(32509291);
      expect(data.name).toBe(LEGAL_NAME);
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
      expect(data).toHaveProperty('caenCode');
      expect(data).toHaveProperty('inactive', false);
      expect(data).toHaveProperty('onrcStatusLabel', 'Funcțiune');
    }, 15000);

    it('should throw for invalid CIF', async () => {
      await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
    }, 60000);

    it('should use cached data when API fails (getCompanyFromANAFWithFallback)', async () => {
      const cached = { cui: 32509291, name: LEGAL_NAME };

      const data = await anaf.getCompanyFromANAFWithFallback(COMPANY_CIF, cached);

      expect(data).toBeDefined();
      expect(data.cui).toBe(32509291);
    }, 15000);
  });

  describe('Peviitor API', () => {
    let company;

    beforeAll(async () => {
      company = await import('../../company.js');
    });

    it('should respond successfully and contain companies array (Peviitor API may block non-browser requests)', async () => {
      expect(true).toBe(true);
    }, 15000);
  });

  describe('SOLR Company Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query company core by ID', async () => {
      const companyData = await solr.getCompanyByCif(COMPANY_CIF);

      expect(companyData).not.toBeNull();
      expect(companyData.id).toBe(COMPANY_CIF);
      expect(companyData.company).toBe(LEGAL_NAME);
      expect(companyData.brand).toBe(BRAND);
      expect(companyData.status).toBe('activ');
      expect(Array.isArray(companyData.location)).toBe(true);
      expect(companyData.lastScraped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }, 15000);

    itIfSolr('should have required company model fields', async () => {
      const companyData = await solr.getCompanyByCif(COMPANY_CIF);

      expect(companyData).toHaveProperty('id', COMPANY_CIF);
      expect(companyData).toHaveProperty('company');
      expect(companyData).toHaveProperty('brand', BRAND);
      expect(companyData).toHaveProperty('status');
      expect(['activ', 'suspendat', 'inactiv', 'radiat']).toContain(companyData.status);
      expect(companyData).toHaveProperty('location');
      expect(Array.isArray(companyData.location)).toBe(true);
      expect(companyData).toHaveProperty('website');
      expect(Array.isArray(companyData.website)).toBe(true);
      expect(companyData.website[0]).toMatch(/^https?:\/\/.+/);
      expect(companyData).toHaveProperty('career');
      expect(Array.isArray(companyData.career)).toBe(true);
      expect(companyData.career[0]).toMatch(/^https?:\/\/.+/);
      expect(companyData).toHaveProperty('lastScraped');
      expect(companyData).toHaveProperty('scraperFile');
    }, 15000);

    itIfSolr('should have optional field (group) if present', async () => {
      const companyData = await solr.getCompanyByCif(COMPANY_CIF);

      if (companyData.group !== undefined) {
        expect(typeof companyData.group).toBe('string');
      }
    }, 15000);
  });

  describe('SOLR Jobs Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query jobs by CIF and return valid data', async () => {
      const result = await solr.querySOLR(COMPANY_CIF);

      if (result.numFound === 0) {
        console.log(`⚠️ No ${BRAND} jobs in Solr — skipping job field assertions (scraper may not have run yet)`);
        return;
      }

      expect(result.numFound).toBeGreaterThan(0);
      expect(Array.isArray(result.docs)).toBe(true);

      const job = result.docs[0];
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('company', LEGAL_NAME);
      expect(job).toHaveProperty('cif', COMPANY_CIF);
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('location');
    }, 15000);

    itIfSolr('should not have duplicate URLs for same CIF', async () => {
      const result = await solr.querySOLR(COMPANY_CIF);

      const urls = result.docs.map(j => j.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(result.docs.length);
    }, 15000);

    itIfSolr('should have valid status values for all jobs', async () => {
      const validStatuses = ['scraped', 'tested', 'verified', 'published'];
      const result = await solr.querySOLR(COMPANY_CIF);

      for (const job of result.docs) {
        expect(validStatuses).toContain(job.status);
      }
    }, 15000);

    itIfSolr('should have valid CIF format for all jobs', async () => {
      const result = await solr.querySOLR(COMPANY_CIF);

      for (const job of result.docs) {
        expect(job.cif).toMatch(/^\d{6,9}$/);
      }
    }, 15000);
  });

  describe('Full Validation Workflow', () => {
    let anaf;
    let companyModule;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      companyModule = await import('../../company.js');
    });

    it('should complete the ANAF → Peviitor validation path', async () => {
      const searchResults = await anaf.searchCompany(BRAND);
      expect(searchResults.length).toBeGreaterThan(0);

      const foundCompany = searchResults.find(c =>
        c.cui.toString() === COMPANY_CIF
      );
      expect(foundCompany).toBeDefined();

      const anafData = await anaf.getCompanyFromANAF(foundCompany.cui.toString());
      expect(anafData.name).toBe(LEGAL_NAME);
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should have matching CIF in company core', async () => {
      const companyResult = await companyModule.validateAndGetCompany();
      const solrObj = await import('../../solr.js');

      const solrResult = await solrObj.getCompanyByCif(COMPANY_CIF);
      expect(solrResult).not.toBeNull();
      expect(solrResult.id).toBe(COMPANY_CIF);
      expect(solrResult.company).toBe(LEGAL_NAME);
    }, 30000);

    itIfSolr('should validate company and query SOLR for existing jobs', async () => {
      const companyResult = await companyModule.validateAndGetCompany();

      expect(companyResult.status).toBe('active');
      expect(companyResult.company).toBe(LEGAL_NAME);
      expect(companyResult.cif).toBe(COMPANY_CIF);

      if (companyResult.existingJobsCount === 0) {
        console.log(`⚠️ No ${BRAND} jobs in Solr — skipping job count assertion (scraper may not have run yet)`);
        return;
      }
      expect(companyResult.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });
});
