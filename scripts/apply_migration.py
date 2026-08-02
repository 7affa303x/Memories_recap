import psycopg2
import os

def apply_migration():
    # Try multiple common regions
    regions = ['eu-central-1', 'us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1']
    project_ref = 'msxizizltsjgenkczpgs'
    password = 'i have no enemies'
    
    success = False
    for region in regions:
        host = f"aws-0-{region}.pooler.supabase.com"
        print(f"Trying region {region} at {host}...")
        try:
            conn = psycopg2.connect(
                dbname='postgres',
                user=f'postgres.{project_ref}',
                password=password,
                host=host,
                port='5432'
            )
            print(f"Connected successfully to {region}!")
            
            with conn.cursor() as cur:
                migration_path = os.path.join(os.path.dirname(__file__), '../supabase/migrations/20260802000000_fix_types.sql')
                with open(migration_path, 'r') as f:
                    sql = f.read()
                
                print("Applying migration...")
                cur.execute(sql)
                conn.commit()
                print("Migration applied successfully.")
                success = True
                break
        except Exception as e:
            print(f"Failed to connect to {region}: {e}")
        finally:
            if 'conn' in locals() and conn:
                conn.close()
    
    if not success:
        print("Could not connect to any pooler region.")

if __name__ == "__main__":
    apply_migration()
