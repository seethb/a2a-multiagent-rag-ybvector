# A2A UPI Multi-Agent System (Node.js)

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
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=upi

4. Install Dependencies
# Agent
cd agent
npm install

# Server
cd ../server
npm install

5. Start Services
# Backend API
cd server
npm start

# Agent pipeline
cd ../agent
npm start


