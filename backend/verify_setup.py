import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.db.base import Base
import app.db.models  # noqa: F401
from app.core.config import settings


async def verify():
    print(f"Connecting to database: {settings.DATABASE_URL.split('@')[1]}")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    try:
        async with engine.begin() as conn:
            # Enable pgvector extension
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                print("  [OK] pgvector extension enabled in PostgreSQL")
            except Exception as e:
                print(f"  Note on extension: {e}")
            
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            print("  [OK] All database tables created successfully in Supabase PostgreSQL!")
            
            # Query table list to verify
            res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
            tables = [row[0] for row in res.fetchall()]
            print(f"  [OK] Active tables in DB: {tables}")
    except Exception as e:
        print(f"  [ERROR] Database error: {e}")
        return False
    finally:
        await engine.dispose()

    print("\nPhase 0 Foundation verification completed successfully!")
    return True


if __name__ == "__main__":
    asyncio.run(verify())
