# Contributing to Alopop 🚀

First off, thank you for considering contributing to Alopop! It's people like you that make Alopop such a great and innovative fact-checking messenger.

By contributing, you are expected to uphold our [Code of Conduct](./CODE_OF_CONDUCT.md).

## 🛠️ How Can I Contribute?

### 1. Reporting Bugs
Bugs are tracked as GitHub issues. When creating an issue, please use the **Bug Report** template and include:
- A clear and descriptive title.
- Steps to reproduce the bug.
- Expected behavior vs actual behavior.
- Screenshots, if applicable.
- Your OS, browser, and environment details.

### 2. Suggesting Enhancements
Enhancement suggestions are also tracked as GitHub issues. Please use the **Feature Request** template to propose new functionality or improvements to existing features (e.g., adding a new AI provider, enhancing the MBTI engine).

### 3. Submitting Pull Requests (PR)
1. **Fork the repository** and create your branch from `main`.
2. Ensure you have the proper environment set up:
   ```bash
   npm install
   npx prisma generate
   ```
3. If you've added code that should be tested, add tests.
4. Ensure your code passes standard styling and linting (`npm run lint`).
5. Prefix your commit messages according to the **Conventional Commits** standard (see below).
6. Push your branch to your fork and submit a PR to the original repository.

## 📝 Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/). Please format your commit messages accordingly:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools and libraries

**Example:**
```
feat: add support for local Ollama LLM endpoint
```

## 🏗️ Local Development Setup

Alopop relies on Next.js, Prisma SQLite (for dev), and a custom Express WebSocket relay.

1. **Environment Setup:** Create a `.env.local` based on `.env.example` (if missing, check the README).
2. **Database Schema:** `npx prisma db push`
3. **Run Dev Server:** `npm run dev` (This spins up `server.js` matching port 3099 by default).

## 🌠 Code Style & Architecture
- **State Management:** We heavily rely on `Zustand`. Avoid deeply nested React contexts where unnecessary.
- **Local-first Data:** We use `Dexie.js` for optimistic UI. Ensure your data mutations hit Dexie before hitting Socket.io.
- **Fact-checking Engine:** Any changes to the core prompt should be thoroughly tested to avoid regressions in AI hallucinations.

## ⚖️ License Considerations
Alopop dual-licenses its software. Any code contributed to this repository will be licensed under the **AGPL-3.0 License**. By submitting a Pull Request, you agree to license your work under these terms to Alonics Inc.

Thank you for making Alopop better! 🦄
