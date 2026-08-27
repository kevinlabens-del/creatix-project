import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const database = new DatabaseSync(':memory:');
database.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));

const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => row.name);
assert.deepEqual(tables, ['admin_sessions', 'client_events', 'contributions', 'rate_limits', 'support_events', 'support_goals', 'webhook_events']);

const insertContribution = database.prepare(`INSERT INTO contributions(
  id,idempotency_key,project_id,project_name_snapshot,amount_cents,is_anonymous,public_name,public_consent,created_at,updated_at
) VALUES(?,?,?,?,?,?,?,?,?,?)`);
const timestamp = '2026-08-27T00:00:00.000Z';
insertContribution.run('123e4567-e89b-42d3-a456-426614174000', '123e4567-e89b-42d3-a456-426614174000', 'snake', 'Snake 2.0', 1000, 1, null, 0, timestamp, timestamp);
assert.equal(database.prepare('SELECT status FROM contributions WHERE project_id=?').get('snake').status, 'pending');

assert.throws(() => insertContribution.run('223e4567-e89b-42d3-a456-426614174000', '123e4567-e89b-42d3-a456-426614174000', 'runner', 'Runner', 1000, 1, null, 0, timestamp, timestamp));
assert.throws(() => insertContribution.run('323e4567-e89b-42d3-a456-426614174000', '323e4567-e89b-42d3-a456-426614174000', 'runner', 'Runner', 199, 1, null, 0, timestamp, timestamp));
assert.throws(() => insertContribution.run('423e4567-e89b-42d3-a456-426614174000', '423e4567-e89b-42d3-a456-426614174000', 'runner', 'Runner', 500, 0, 'Pseudo', 0, timestamp, timestamp));

database.prepare("INSERT INTO webhook_events(event_id,event_type,processing_status,received_at) VALUES(?,?,'processing',?)").run('evt_unique_123', 'checkout.session.completed', timestamp);
assert.throws(() => database.prepare("INSERT INTO webhook_events(event_id,event_type,processing_status,received_at) VALUES(?,?,'processing',?)").run('evt_unique_123', 'checkout.session.completed', timestamp));

database.close();
console.log('Schéma D1 : tables et contraintes critiques validées.');
