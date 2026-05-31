# Alopop - The Fact-Checking Messenger
[🇰🇷 한국어로 읽기 (Read in Korean)](./README.ko.md)

![Alopop Architecture](./public/alopop-architecture.svg)

**Alopop** is far more than just a real-time chat application. It is a **"Fact-Checking AI Messenger"** engineered from the ground up to validate the empirical truth of every data packet—combating fake news, manipulated media, and deepfakes seamlessly within everyday conversations.

---

## 💡 Core Philosophy & Engineering Vision

> **"Validating the absolute truth of every message, image, and data flowing through the chat."**

In today's hyper-connected society, messengers have become the fastest conduits for misinformation. To combat this at a systemic level, Alopop is powered by an innovative core engine that understands the context of user conversations, performs real-time Internet searches (via DuckDuckGo, etc.), and renders immediate verdicts on the authenticity of shared information.

### Key Differentiators (Why Alopop?)
- **Real-Time Cross-Validation**: Whenever suspicious claims (e.g., controversial news, skewed facts) or AI-generated deepfakes surface in the chat, our core AI engine executes parallel web-scraping and vision analysis to verify the truth. It then automatically attaches a **Fact-Check Badge** directly to the chat bubble.
  
  ![Fact Check UI](./public/factcheck-ui.svg)
  
  - **🤖 AI-Generated Image Badge**: Visualizes the probability that a submitted photo is an AI-manipulated or synthesized deepfake.
  - **🚨 Fake News Alert Badge**: Instantly attaches a red warning badge when phishing attempts, fake news, or distorted facts are detected, preventing the spread of misinformation.
  - **🔍 Real-Time Evidence Pop-up**: Clicking the badge reveals a detailed pop-up containing the **Reasoning (Evidence)** acquired through real-time cross-validation, along with the **AI Confidence Score (%)**, empowering users to make informed judgments.
- **Zero-Trust No-Log Architecture**: Operating entirely as a socket-relay mechanism without persistent centralized chat storage, Alopop guarantees absolute privacy and data sovereignty.

---

## 🚀 Enterprise-Grade Features

Alopop provides a robust, highly customizable ecosystem built on top of our fact-checking core engine.

### 1. Multi-Domain Personal AI Studio & Orchestration 🛠️
Alopop transcends standard chat interfaces by providing dedicated **Multi-Domain Personal AI Studios** for every user.
- **Dedicated Workspaces**: Upon onboarding, users are automatically granted 4 independent professional studios: Game Development, Event/Concert Planning, Law Firm, and Tax/Accounting Firm.
- **Multi-Agent Pipeline**: Each studio is powered by a dynamic pipeline of domain-specific agents (e.g., PM, Designer, Developer, QA for games). These agents collaborate in real-time via WebSockets to autonomously fulfill complex project requests.
- **Auto-Healing Architecture**: The system dynamically seeds and self-heals corrupted agent configurations using a resilient template engine (`studio_templates.json`), guaranteeing zero downtime.

### 2. Per-Studio Dynamic AI Model Selection (Advanced BYOK) 🧠
Why settle for a single AI model? Alopop's `AiModelSelector` allows unparalleled granular control over your AI infrastructure.
- **Studio-Level Modularity**: Users can assign entirely different AI models to each of their personal studios (e.g., OpenAI `gpt-4o` for the Law Firm, Anthropic `claude-3.5-sonnet` for Game Development, and Google `gemini-1.5-pro` for Fact-Checking).
- **Decoupled Key Management**: The BYOK (Bring Your Own Key) architecture securely maps the correct API keys per provider on-the-fly, ensuring maximum cost-efficiency and model specialization.

### 3. Pet365Care Integrated Ecosystem 🐾
Previously a standalone service, the **Pet365Care** health and social management platform is now seamlessly integrated directly into the Alopop Next.js ecosystem.
- Features real-time pet health tracking, hospital synchronization, and a fully functional social feed for pet owners—all leveraging Alopop's underlying core infrastructure.

### 4. Server-Side Autonomous Sponsored AI Economy (BYOK)
You do not need to pay the platform to run heavy inference. Alopop returns the sovereignty of LLM infrastructure and monetization entirely to the user.
- **24/7 Autonomous AI Revenue (Pay-Per-Use)**: Chatroom hosts can register their AI persona and API key to the DB. The **Node.js server seamlessly processes all guest fact-check requests in the background 24/7, automatically charging guests in-app coins and depositing them into the host's wallet**.
- **Military-Grade DB Encryption**: External API keys submitted by users are NEVER stored as plain text. They are heavily encrypted using an **AES-256-CBC cypher**, shielding high-limit commercial keys from any potential master DB breach.

### 5. Hyper-Personalized AI Persona (MBTI Engine)
Going far beyond a generic chatbot, Alopop allows you to engineer a highly personalized AI companion that actively participates in your chatrooms.
- **Precision MBTI Injection**: Customize your unique conversation partner by defining their **16-personality MBTI type, age, gender, occupation, and specific tone of voice**.
- This bespoke AI friend seamlessly fact-checks ongoing conversations while blending perfectly into the context.

### 6. P2P Smart Coin Economy & Real-Time Remittance
Alopop introduces granular cost-sharing policies directly within the chatroom utilizing its internal virtual coin ledger.
- **Zero-Fee Peer-to-Peer Transfers**: Integrated with a virtual in-app 'Coin' wallet system, chat participants can send tips, pay for information, or fund AI requests with zero transaction fees via web sockets.
- **Unprecedented Billing Flexibility**: Individual Routing, Pay-Per-Use Sponsored Mode, or P2P Coin Pooling for heavy multimodality requests.

### 7. Admin-Sponsored "Free AI Events" & CMS Dashboard 👑
Alopop breaks the entry barrier for new users lacking API keys by empowering administrators with a full-fledged robust **CMS (Content Management System) Dashboard**.
- **Frictionless Onboarding (Free AI Events)**: Admins can dynamically issue "Free AI Events". The system automatically detects new users, grants them a Daily Quota of free AI inferences paid by the Admin's configured vault, and displays interactive `[EVENT]` purple UI badges.

### 8. Local-First Architecture & Optimistic UI ⚡
- By embedding an **IndexedDB (Dexie.js) Caching Engine**, messages are proactively persisted to the browser's local database, ensuring immediate Optimistic UI updates. Even under severe network degradation, it guarantees a blazing-fast, zero-lag scrolling experience.

### 9. Seamless PWA & Native Offline Push (Web Push) 📲
- **Offline Message Queue**: Messages sent during network unreachability are safely cached and automatically synchronized.
- **VAPID Web Push**: Users receive OS-level native push notifications instantly on their devices.

### 10. Hybrid Soft-Onboarding & 21-Mini-Game Portal 🎮
- **Guest Access**: Users enter as "Guests (Anonymous)", allowing them to freely experience all features. They can bind their account later.
- **Game Portal**: Beyond messaging, Alopop embeds a portal containing **21 high-quality HTML5 mini-games** running securely isolated as PM2 processes perfectly fused via a Next.js proxy network.

### 11. Ghost Delegate: Hybrid P2P Edge & Serverless Architecture ♾️
- **Zero-Ping Shadow Leader Election**: Thousands of peers can instantly and unanimously elect a "Ghost Delegate" (Temporary Brain) in 1 millisecond without firing a single ping by sorting active WebSocket UUIDs.
- **BYOK P2P Tunneling**: Guest A's smartphone calculates the heavy AI context (Edge Orchestration), but the payload is routed to securely decrypt Offline Host B's API vault.

### 12. Redis-Free 10k CCU Infrastructure & Chaos Monkey 💥
- **In-Memory Rate Limiting**: A lightweight custom rate limiter shields the expensive APIs from malicious floods.
- **Integrated Chaos Monkey**: Administrators can deploy hundreds of automated "Ghost Agents" that mercilessly spam sockets to validate infrastructure stability.

### 13. Fully Autonomous AI Agent Integration (OpenClaw Bridge) 💻
Features a built-in **OpenClaw AI Agent** bridge capable of linking directly to the user's local PC to autonomously perform coding tasks and browser automation via the chat interface.
- **Physical Sandbox Isolation**: A hardcoded sandbox quarantines all write operations, guaranteeing a 100% safe autonomous AI control environment.

---

## 🛠 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) or SQLite environment (`prisma/dev.db`)

### Local Setup Instructions

1. **Clone the repository**
   ```bash
   git clone git@github.com:Rejard/alopop.git
   cd alopop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables & Initialize Database**
   Create a `.env.local` file in the project root and configure your database URL.
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the application**
   To support real-time socket communication, this project is wrapped in a custom express server (`server.js`).
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:3099` in your browser to experience the future of fact-checking messengers!

---

## 💻 Tech Stack
- **Frontend**: Next.js (React 19), Tailwind CSS, Zustand, PWA (Service Worker)
- **Backend**: Node.js, Express, Socket.io (Custom Relay Node)
- **AI & Engine**: Vercel AI SDK (Google, OpenAI, Anthropic), DuckDuckGo Search Integration
- **Database**: Prisma ORM, PostgreSQL / SQLite

---

## ⚖️ License & Commercial Inquiries

**Alopop** is fully open-sourced to encourage technical contributions and educational use within the community. To rigorously protect our intellectual property, this project operates under a strict **Dual License Policy**.

### 1. Non-Commercial & Open Source Use
Open-source contributors and individual developers are free to view, modify, and use the source code for non-commercial purposes under the `AGPL-3.0 License`. However, any derivative work or service built upon this code must also be publicly released as open-source under the identical license.

### 2. Commercial Use & Integrations
If enterprises, startups, or individuals intend to use Alopop for **any commercial or proprietary purposes (e.g., launching a commercial service, integrating into internal corporate solutions, or reselling)**, the AGPL-3.0 license is strictly insufficient. **You must obtain explicit prior consent and acquire a separate 'Commercial License' from the original author (Rejard).**

If you wish to integrate Alopop's architecture into a commercial product or require enterprise-level technical support, please reach out via the email below to discuss a Commercial License.

*Acquiring a commercial license waives the obligation to open-source your proprietary code modifications and opens the door for dedicated technical support.*

* 📫 **Commercial & Technical Inquiries:** lemaiii@alonics.com
* **Copyright:** © 2026 Alonics Inc. All Rights Reserved.
