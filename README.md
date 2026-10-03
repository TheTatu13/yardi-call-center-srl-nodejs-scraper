# job_seeker_ro_spider — YARDI CALL CENTER SRL Careers Romania Scraper

[![Oportunitati SI Cariere](https://github.com/peviitor-scrapers/yardi-call-center-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml/badge.svg)](https://github.com/peviitor-scrapers/yardi-call-center-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml)
[![Automation Tests](https://github.com/peviitor-scrapers/yardi-call-center-srl-nodejs-scraper/actions/workflows/automation-testing.yml/badge.svg)](https://github.com/peviitor-scrapers/yardi-call-center-srl-nodejs-scraper/actions/workflows/automation-testing.yml)

[![Version](https://img.shields.io/github/package-json/v/peviitor-scrapers/yardi-call-center-srl-nodejs-scraper?label=version&color=blue)](CHANGELOG.md)
[![Test Results](https://img.shields.io/badge/test--results-HTML-9b59b6)](https://peviitor-scrapers.github.io/yardi-call-center-srl-nodejs-scraper/test-results/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/javascript-ESM-F7DF1E?logo=javascript&logoColor=black)](https://ecma-international.org/)
[![Node.js](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fpeviitor.ro&label=peviitor.ro)](https://peviitor.ro)
[![API](https://img.shields.io/website?url=https%3A%2F%2Fapi.peviitor.ro%2F&label=api.peviitor.ro)](https://api.peviitor.ro/)
[![SOLR](https://img.shields.io/website?url=https%3A%2F%2Fsolr.peviitor.ro%2Fsolr%2F&label=solr.peviitor.ro)](https://solr.peviitor.ro/solr/)
[![GitHub Pages](https://img.shields.io/github/deployments/peviitor-scrapers/yardi-call-center-srl-nodejs-scraper/github-pages?label=GitHub%20Pages)](https://peviitor-scrapers.github.io/yardi-call-center-srl-nodejs-scraper/)

**job_seeker_ro_spider** — un scraper pentru job-urile YARDI din România. Extrage anunțurile de pe [Yardi Romania Careers](https://yardiromania.breezy.hr) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul SOLR.

> **🌱 Acest repo este un scraper derivat.** A fost creat din template-ul [peviitor-scrapers/epam-systems-international-srl-nodejs-scraper](https://github.com/peviitor-scrapers/epam-systems-international-srl-nodejs-scraper).

## Overview

Proiectul automatizează colectarea zilnică a job-urilor YARDI din România, menținând board-ul peviitor.ro la zi cu cele mai recente oportunități de carieră.

## Features

- Extrage job-uri din API-ul public Breezy.hr JSON
- Validează compania via ANAF (CUI, status activ/inactiv, adresă completă)
- **Cache ANAF la 7 zile** — committed în repo, nu lovește demoANAF la fiecare scrape
- **Fallback la cache stale** dacă ANAF e indisponibil
- Cross-validează cu Peviitor API
- Stochează în SOLR (job core + company core)
- Generează `docs/jobs.md` automat — accesibil pe GitHub Pages
- **Identitate companie într-un singur fișier** (`config/company.json`)
- GitHub Actions: scrape zilnic + testare automată (unit, integration, e2e, consistency)
- Teste SOLR condiționale — auto-skip când `SOLR_AUTH` nu e setat
- Se identifică prin User-Agent: `job_seeker_ro_spider`

## Project Structure

```
├── index.js                    # Main scraper entry point
├── company.js                  # Company validation via ANAF + Peviitor + SOLR
├── demoanaf.js                 # CLI wrapper for src/anaf.js
├── solr.js                     # SOLR operations (query, upsert, delete, company)
├── validate-jobs.js            # Job URL validator — checks active/expired, deletes stale jobs
├── config/
│   ├── company.json            # Single source of truth: CIF, brand, URLs, API params
│   └── company.js              # ESM loader for company.json
├── src/
│   ├── anaf.js                 # ANAF API core module (search + company details)
│   ├── markdown-generator.js   # Generates docs/jobs.md from scraped data
│   └── job-validator.js        # Shared validateByHead + validateByContent
├── tests/
│   ├── package.json            # Jest config for test suite
│   ├── validate-yardi-jobs.js  # SOLR job URL validation script
│   ├── unit/
│   │   ├── index.test.js       # Tests for parseApiJobs, mapToJobModel, transformJobsForSOLR
│   │   ├── company.test.js     # Tests for validateAndGetCompany, fallback caching
│   │   ├── solr.test.js        # Tests for query, upsert, delete operations
│   │   └── demoanaf.test.js    # Tests for ANAF search and company retrieval
│   ├── integration/
│   │   └── workflow.test.js    # Live ANAF + SOLR integration tests
│   ├── e2e/
│   │   └── scraper.test.js     # Full pipeline tests with real Breezy API
│   └── consistency/
│       ├── public.test.js      # Verifies repo is public
│       ├── repo.test.js        # Verifies branch, Pages, secrets, workflows
│       ├── topics.test.js      # Verifies required repo topics
│       └── workflow-naming.test.js  # Validates workflow naming conventions
├── docs/
│   ├── index.html              # Live job board (GitHub Pages)
│   ├── jobs.md                 # Scraped jobs in markdown (generated by CI)
│   ├── README.md
│   └── test-results/           # Test reports (generated by CI)
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
│       ├── job-seeker-ro-spider.yml     # Daily scraping at 6 AM UTC
│       └── automation-testing.yml       # Automation Tests on push/PR
└── package.json
```

## Setup

### Prerequisites

- Node.js 24+
- npm

### Installation

```bash
npm install
```

### Configuration

Set the `SOLR_AUTH` environment variable with your Solr credentials:

```bash
export SOLR_AUTH="username:password"
```

## Usage

### Run the Scraper

```bash
npm run scrape
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Workflows

### Daily Scraping

The `job-seeker-ro-spider.yml` workflow runs daily at 6 AM UTC via GitHub Actions.

### Test Automation

The `automation-testing.yml` workflow runs on every push and pull request.

## Acknowledgments

This project was developed with assistance from **[Claude Code](https://claude.ai/code)** by Anthropic.

Derived from [peviitor-scrapers/epam-systems-international-srl-nodejs-scraper](https://github.com/peviitor-scrapers/epam-systems-international-srl-nodejs-scraper).

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE

Licensed under the [MIT License](LICENSE).

## Managed By

This project is managed by [ASOCIATIA OPORTUNITATI SI CARIERE](https://oportunitatisicariere.ro) and used as a web scraper for the [peviitor.ro](https://peviitor.ro) job board project.

## Robots.txt Policy

Acest scraper respectă regulile din [robots.txt](https://yardiromania.breezy.hr/robots.txt). Pentru analiza completă, vezi [ROBOTS.md](ROBOTS.md).

## Disclaimer

This scraper is designed for educational purposes and legitimate job data aggregation for the Romanian job market. Please respect Yardi's Terms of Service and robots.txt when using this scraper.
