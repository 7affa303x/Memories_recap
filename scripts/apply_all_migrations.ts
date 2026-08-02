import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function applyAllMigrations() {
  const connectionString = "postgres://postgres.msxizizltsjgenkczpgs:i%20have%20no%20enemies@aws-0-eu-west-3.pooler.supabase.com:5432/postgres";

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log("Connecting to PostgreSQL...");
    await client.connect();
    console.log("Connected successfully.");

    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          await client.query(sql);
          console.log(`Migration ${file} applied successfully.`);
        } catch (err: any) {
          // If it's a "already exists" error, we can often ignore it
          if (err.code === '42P07' || err.code === '42710' || err.code === '42P04') {
            console.log(`Skipping ${file}: Some objects already exist.`);
          } else {
            console.error(`Error applying ${file}:`, err.message);
            // Don't stop, try next
          }
        }
      }
    }

    console.log("All migrations processed.");

  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    await client.end();
  }
}

applyAllMigrations();
