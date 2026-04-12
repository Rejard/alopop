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

### 1. Server-Side Autonomous Sponsored AI Economy (BYOK)

![BYOK Architecture](./public/feature-byok.svg)

You do not need to pay the platform to run heavy fact-checking inference. Alopop returns the sovereignty of LLM infrastructure and monetization entirely to the user.
- **BYOK (Bring Your Own Key)**: Users can directly input their own API keys (OpenAI, Gemini, Anthropic) into the system and enjoy unlimited access to the core engine with zero platform markup.
- **24/7 Autonomous AI Revenue (Pay-Per-Use)**: Chatroom hosts can register their AI persona and API key to the DB. Regardless of whether the host's app is open or closed, the **Node.js server seamlessly processes all guest fact-check requests in the background 24/7, automatically charging guests in-app coins and depositing them into the host's wallet**. A massive Web3-style passive income paradigm.
- **Military-Grade DB Encryption**: External API keys submitted by users are NEVER stored as plain text. They are heavily encrypted using an **AES-256-CBC cypher** coupled with randomized initialization vectors, shielding high-limit commercial keys from any potential master DB breach.

### 2. Hyper-Personalized AI Persona (MBTI Engine)

![AI Persona](./public/feature-persona.svg)

Going far beyond a generic chatbot, Alopop allows you to engineer a highly personalized AI companion that actively participates in your chatrooms.
- **Precision MBTI Injection**: Customize your unique conversation partner by defining their **16-personality MBTI type, age, gender, occupation, and specific tone of voice (e.g., sarcastic, empathetic)** via system prompts.
- This bespoke AI friend resides in your chat room, seamlessly fact-checking ongoing conversations while blending perfectly into the context—offering witty comebacks or deep empathy exactly according to their defined persona.

### 3. P2P Smart Coin Economy & Real-Time Remittance

![Coin Pooling](./public/feature-pooling.svg)

Why should the room host bear the entire cost of API inference? Alopop introduces granular cost-sharing policies directly within the chatroom utilizing its internal virtual coin ledger.
- **Zero-Fee Peer-to-Peer Transfers**: Integrated with a virtual in-app 'Coin' wallet system, chat participants can send tips, pay for information, or fund AI requests with zero transaction fees via web sockets.
- **Unprecedented Billing Flexibility**: Chatrooms can operate in distinct economic modes: 
   1) **Individual Routing**: Everyone uses their standalone keys.
   2) **Pay-Per-Use Sponsored Mode**: Guests automatically pay a host-defined 'coin toll' to use the host's AI engine.
   3) **P2P Coin Pooling**: Participants crowdfund tokens via split-billing to collectively fund heavy multimodality requests.

### 4. Local-First Architecture & Optimistic UI ⚡

![Local First PWA](./public/feature-offline.svg)

- Alopop is not your average sluggish messenger completely reliant on a Socket.io backend.
- By embedding an **IndexedDB (Dexie.js) Caching Engine**, messages are proactively persisted to the browser's local database, ensuring immediate Optimistic UI updates. Even under severe network degradation, it guarantees a blazing-fast, zero-lag scrolling experience.

### 5. Seamless PWA & Native Offline Push (Web Push) 📲
- **Offline Message Queue**: Messages sent during network unreachability are safely cached and automatically synchronized via background queues.
- **VAPID Web Push**: Through robust Service Worker implementations, users receive OS-level native push notifications instantly on their devices, achieving app-like retention without the friction of App Store installations.

### 6. Hybrid Soft-Onboarding 🌐
- We completely dismantled the registration barrier. Upon initial access, users enter as **"Guests (Anonymous)"**, allowing them to freely experience all features, including chat and coin wallets, with zero friction.
- Whenever they are ready, they can use the "Hybrid Account Binding" feature in the settings to permanently migrate and bind their anonymous local state to a registered user account.

### 7. Integrated 21-Mini-Game Portal Ecosystem 🎮
- Beyond just messaging, Alopop fully embeds a portal containing **21 high-quality HTML5 mini-games (e.g., Block Blast, Tetris, 2048)** to enjoy seamlessly with friends during chats.
- **Next.js Reverse Proxy Architecture**: Each game runs securely isolated as an independent PM2 process (Ports 3001-3021) and perfectly fuses into the Alopop ecosystem via Next.js proxy network (`/game-proxy/:port`) without CORS or Mixed Content errors.
- Features auto-correction for absolute path collisions, bundler (`Vite`, `Webpack`) rendering error fixes, and mobile/PC immersive full-screen UI optimizations, ensuring a pristine gaming experience.

### 8. Ghost Delegate: Hybrid P2P Edge & Serverless Architecture ♾️
To architecturally support massive scale (millions of Concurrent Users - CCU) with virtually zero server overload, Alopop transparently combines proven industry-standard networking with our own world-first native innovations.

#### 💡 Built on Proven Industry Standards
- **Serverless Client-Server Routing**: Utilizing standard Serverless Edge functions (Vercel) for explicit manual tasks (e.g., Image Fact-Checking) to eliminate P2P network instability and guarantee instant API execution.
- **WebSocket Presence Syncing**: Tracking online users in real-time within a chatroom—a widely adopted standard in modern collaborative platforms.
- **Client-Side Edge Computing**: Offloading UI rendering and basic computations to the client's browser (Edge) to reduce centralized server dependency.

#### 🚀 Alopop's Original Innovations (World-First)
- **Zero-Ping Shadow Leader Election**: Traditional distributed systems use heavy consensus algorithms (e.g., Raft, Paxos) causing network overhead. Alopop invented a zero-network deterministic algorithm: simply by sorting active WebSocket UUIDs alphabetically, thousands of peers can instantly and unanimously elect a "Ghost Delegate" (Temporary Brain) in 1 millisecond without firing a single ping.
- **BYOK (Bring Your Own Key) P2P Tunneling**: In conventional Web3 or Edge AI, the user donating computation also pays the API toll. Alopop pioneered a decoupled economic tunnel: **Guest A's smartphone** calculates the heavy AI context (Edge Orchestration), but the payload is routed to securely decrypt **Offline Host B's API vault**. Computation is distributed (crowd-sourced), but billing remains sovereign.
- **Decentralized AI Auto-Reply Engine**: By combining the technologies above, the heaviest server load—processing thousands of chat messages to calculate the exact timing for an AI to intervene—is 100% shifted to the P2P Ghost Delegate. This results in unprecedented O(1) server cost parity per room, even under infinite message velocity.

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
