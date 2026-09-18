"""
Root entrypoint for uvicorn deployment on Render, Railway, Docker, etc.
Exposes 'app' from app.main so both `uvicorn main:app` and `uvicorn app.main:app` work seamlessly.
"""
from app.main import app

if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
