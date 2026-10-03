# Contributing

Thank you for your interest in contributing!

## 🌱 This Repo Is a Derived Scraper

This is a **derived scraper** — created from the YARDI template at `peviitor-scrapers/epam-systems-international-srl-nodejs-scraper`. It follows the same structure, workflows, and testing layers as all scrapers in the peviitor.ro ecosystem.

To create a new derived scraper for another company, start from the YARDI template repo and follow the derivation checklist there.

## Code Style

- Use ES6+ modules (`type: module` in `package.json`)
- Add tests for new features in the matching `tests/<level>/` folder
- Ensure all tests pass before submitting PR
- Update relevant `.md` files when adding new files

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/yardi-call-center-srl-nodejs-scraper.git

# Install dependencies
npm install

# Run tests
npm test
```

## Reporting Issues

Open a [GitHub Issue](https://github.com/peviitor-scrapers/yardi-call-center-srl-nodejs-scraper/issues) with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
