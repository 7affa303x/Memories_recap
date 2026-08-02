import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function applySchema() {
  const connectionString = "postgres://postgres.msxizizltsjgenkczpgs:i%20have%20no%20enemies@aws-0-eu-west-3.pooler.supabase.com:5432/postgres";

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log("Connecting to PostgreSQL...");
    await client.connect();
    console.log("Connected successfully.");

    const schemaPath = path.join(__dirname, '../supabase/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log("Applying schema...");
    await client.query(sql);
    console.log("Schema applied successfully.");

  } catch (err) {
    console.error("Error applying schema:", err);
  } finally {
    await client.end();
  }
}

applySchema();
