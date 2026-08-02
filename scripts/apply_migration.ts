import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  // Connection string format: postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
  // Project Ref: msxizizltsjgenkczpgs
  // Password: i have no enemies
  const connectionString = "postgres://postgres.msxizizltsjgenkczpgs:i%20have%20no%20enemies@aws-0-eu-west-3.pooler.supabase.com:5432/postgres";

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log("Connecting to PostgreSQL...");
    await client.connect();
    console.log("Connected successfully.");

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260802000000_fix_types.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log("Applying migration...");
    await client.query(sql);
    console.log("Migration applied successfully.");

  } catch (err) {
    console.error("Error applying migration:", err);
  } finally {
    await client.end();
  }
}

applyMigration();
