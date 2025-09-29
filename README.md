This project implements a multi-agent orchestration pipeline to analyze UPI transactions for fraud detection, risk scoring, and compliance validation.

It is built with Node.js services and designed for BFSI-grade transaction processing and explainability.

Retriever Agent – Fetches UPI transaction data from the database.

FraudDetectionBot – Flags suspicious transactions based on heuristics and vector embeddings.

RiskScoringBot – Assigns low/medium/high risk scores.

Writer Agent – Persists enriched results (fraud flags, scores, compliance notes).

ComplianceBot – Validates transactions against compliance rules.

Agent Loop – Ensures sequential execution:
Retriever → FraudDetection → RiskScoring → Writer → Compliance

a2a-upi-multiagent-js/
│
├── agent/                   # Multi-agent logic
│   └── src/
│       ├── roles/           # Agent role implementations
│       │   ├── compliance.js
│       │   ├── fraudDetection.js
│       │   ├── retriever.js
│       │   ├── riskScoring.js
│       │   └── writer.js
│       ├── agent_loop.js    # Orchestrates pipeline execution
│       ├── agent.js         # Agent entrypoint
│       ├── db.js            # DB connector for agent
│       ├── embedding.js     # Embedding/vector utilities
│       └── store.js         # State management
│
├── server/                  # Backend service
│   ├── scripts/
│   │   └── schema.sql       # DB schema for transactions
│   └── src/
│       ├── db.js            # Database pool/connection
│       ├── ingest.js        # Transaction ingestion logic
│       ├── queue.js         # Queue/async pipeline handler
│       └── server.js        # Express API server
│
├── web/                     # (Optional) Frontend UI folder
│
├── .env                     # Environment variables (create from .env.example)
├── package.json             # Root package file
└── README.md

⚙️ Setup & Installation
Prerequisites

Node.js v18+

PostgreSQL or YugabyteDB

npm or yarn

1. Clone the Repository

git clone https://github.com/<your-org>/a2a-upi-multiagent-js.git
cd a2a-upi-multiagent-js

2. Database Setup
Create database and schema:

cd server/scripts
move this schema.sql to yugabyte home directory (e.g. /home/yugabyte/tserver/bin or /home/yugabyte/bin (if you installed yugabyted)
./ysqlsh -h <DB host> -U <user> -d <database> -f schema.sql

3. Configure Environment

Copy .env.example → .env in both agent/ and server/:

4. Install dependencies

# In agent
cd agent
npm install

# In server
cd ../server
npm install

5. Run services
Run Services

Start backend API:
cd server
npm start

Start agent pipeline:

cd ../agent
npm start

Data Flow
Transactions are ingested into the DB (ingest.js).

Agent Loop picks a transaction.

Roles run sequentially:

retriever.js loads transaction details

fraudDetection.js checks fraud signals

riskScoring.js assigns risk level

writer.js saves enriched data

compliance.js validates rules

API (server.js) exposes results for integration/UI.
