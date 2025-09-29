// server/src/queue.js
import { db } from './db.js';

export async function enqueue({ role, question_id, payload }) {
  await db.query(
    `INSERT INTO jobs (role, status, payload_json)
    VALUES ($1, 'queued', $2)
    RETURNING role`,
   [role, payload]
  );
}

export async function writeAnswer({ question_id, status = 'done', output = null }) {
  await db.query(
    `INSERT INTO answers ( status, output)
     VALUES ($1, $2::jsonb)
    `,
    [status, output ? JSON.stringify(output) : null]
  );
  await db.query(`UPDATE questions SET status = $2 WHERE id = $1`, [question_id, status]);
}
