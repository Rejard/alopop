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

### 1. Unlimited API Key Routing (BYOK & Sponsored)

![BYOK Architecture](./public/feature-byok.svg)

You do not need to pay the platform to run the heavy fact-checking inference. Alopop returns the sovereignty of LLM cost management entirely to the user.
- **BYOK (Bring Your Own Key)**: Users can directly input their own API keys (OpenAI, Gemini, Anthropic) into the system and enjoy unlimited access to the core engine.
- **Sponsored Key Routing**: If a room host or developer provisions a shared API key on the server, regular guest users without keys can seamlessly tap into premium AI features without any restrictions.

### 2. Hyper-Personalized AI Persona (MBTI Engine)

![AI Persona](./public/feature-persona.svg)

Going far beyond a generic chatbot, Alopop allows you to engineer a highly personalized AI companion that actively participates in your chatrooms.
- **Precision MBTI Injection**: Customize your unique conversation partner by defining their **16-personality MBTI type, age, gender, occupation, and specific tone of voice (e.g., sarcastic, empathetic)** via system prompts.
- This bespoke AI friend resides in your chat room, seamlessly fact-checking ongoing conversations while blending perfectly into the context—offering witty comebacks or deep empathy exactly according to their defined persona.

### 3. P2P AI Token Pooling Economy

![Coin Pooling](./public/feature-pooling.svg)

Why should the room host bear the entire cost of API inference? Alopop introduces granular cost-sharing policies directly within the chatroom.
- **P2P Coin Pooling**: Integrated with a virtual in-app 'Coin' wallet system, chat participants can chip in (crowdfund) their tokens to collectively fund heavy AI context requests. A truly unique, Web3-inspired sustainable ecosystem.
- **Unprecedented Flexibility**: Supports seamless toggling between "Individual Billing (BYOK)" and "Sponsored Mode", catering to any economic use case.

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
