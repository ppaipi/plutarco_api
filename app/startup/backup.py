import os
import shutil
from datetime import datetime
import glob

DB_PATH = "/data/pedidos_productos.db"
BACKUP_DIR = "/data/backups"
MAX_BACKUPS = 15


def backup_sqlite():
    try:
        if not os.path.exists(DB_PATH):
            print(f"ℹ DB not found, skipping backup: {DB_PATH}")
            return

        os.makedirs(BACKUP_DIR, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"{BACKUP_DIR}/backup_{timestamp}.db"

        shutil.copy2(DB_PATH, backup_file)
        print(f"✅ SQLite backup created: {backup_file}")

        # Rotación
        backups = sorted(
            glob.glob(f"{BACKUP_DIR}/backup_*.db"),
            reverse=True
        )

        for old in backups[MAX_BACKUPS:]:
            os.remove(old)
            print(f"🗑 Old backup deleted: {old}")

    except Exception as e:
        print("⚠️ Backup failed:", e)
