# A2A(Agent 2 Agent) UPI Multi-Agent System (Node.js)

This repository implements a **multi-agent orchestration pipeline** for analyzing UPI transactions in the BFSI domain.  
It provides **fraud detection, risk scoring, and compliance validation** with modular agents, a backend API, and database support.

---

## ✨ Features

- **Retriever Agent** – Fetches UPI transaction details from the database  
- **FraudDetectionBot** – Identifies suspicious or anomalous transactions  
- **RiskScoringBot** – Assigns a low / medium / high risk score  
- **Writer Agent** – Persists enriched analysis back into the database  
- **ComplianceBot** – Validates transactions against compliance rules  
- **Pipeline Orchestration** – Sequential execution flow:  
  `Retriever → FraudDetection → RiskScoring → Writer → Compliance`  

---

## 📂 Project Structure

a2a-upi-multiagent-js/
│
├── agent/ # Multi-agent pipeline
│ └── src/
│ ├── roles/ # Agent role implementations
│ │ ├── compliance.js
│ │ ├── fraudDetection.js
│ │ ├── retriever.js
│ │ ├── riskScoring.js
│ │ └── writer.js
│ ├── agent_loop.js # Orchestrator
│ ├── agent.js # Agent entrypoint
│ ├── db.js # DB connection for agents
│ ├── embedding.js # Embedding utilities
│ └── store.js # Shared state management
│
├── server/ # Backend service
│ ├── scripts/
│ │ └── schema.sql # DB schema
│ └── src/
│ ├── db.js # Database connector
│ ├── ingest.js # Transaction ingestion
│ ├── queue.js # Queue handler
│ └── server.js # Express API server
│
├── web/ # (optional) frontend UI
├── .env # Environment configuration
├── package.json # Dependencies
└── README.md

---

## ⚙️ Setup & Installation

Prerequisites
- Node.js v18+  
- PostgreSQL or YugabyteDB  
- npm or yarn  

1. Clone the Repository
git clone https://github.com/<your-org>/a2a-upi-multiagent-js.git
cd a2a-upi-multiagent-js

2. Configure Database
cd server/scripts
psql -U <user> -d <database> -f schema.sql

3. Configure Environment
# Create .env in both agent/ and server/
 A2A_SERVER_BASE=http://127.0.0.1:3000
 AGENT_ID=agent-1
 AGENT_ROLE=retriever  # or writer
 PGHOST=10.33.16.10
 PGPORT=5433
 PGUSER=yugabyte
 PGPASSWORD=xxxxxxx
 PGDATABASE=upi
 DATABASE_URL=postgres://yugabyte:xxxxxxxx@localhost:5433/upi
 EMBED_DIM=1536
 PORT=3000

 CLAUDE_API_KEY=
 ANTHROPIC_API_KEY=
 CLAUDE_API_URL=https://api.anthropic.com/v1/messages
 OPENAI_API_KEY=
 
 ANTHROPIC_MODEL=claude-3-5-sonnet-20240620
 ANTHROPIC_MAX_TOKENS=400
 LLM_STEP_TIMEOUT_MS=6000
 W_CRYPTO=15
 W_LABELED_FRAUD=20
 RISK_REVIEW=60
 RISK_ESCALATE=80
 FLAGS_REVIEW=3
 FLAGS_ESCALATE=5


4. Install Dependencies
# Agent Pipeline
cd agent
npm install

# Backend API
cd ../server
npm i
npm run start
> a2a-upi-server@1.0.0 start
> node src/server.js

API listening on http://localhost:3000

# Web Application
cd ../agent/web
npm i
npm run dev

Output:
 VITE v5.4.19  ready in 107 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help



