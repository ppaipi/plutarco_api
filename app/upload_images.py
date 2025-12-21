import os
import requests

# ================= CONFIG =================
API_URL_BASE = "https://plutarco-api.fly.dev/images/upload"
API_KEY = "2006f04013-pppp-plutarco-supersecretk3y"
IMG_DIR = "app/PRODUCTOS"
# ==========================================

if not os.path.isdir(IMG_DIR):
    print("❌ La carpeta no existe:", IMG_DIR)
    exit(1)

headers = {
    "x-api-key": API_KEY
}

for filename in os.listdir(IMG_DIR):
    if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        continue

    filepath = os.path.join(IMG_DIR, filename)

    # CODIGO = nombre del archivo sin extensión
    codigo = os.path.splitext(filename)[0]

    url = f"{API_URL_BASE}/{codigo}/"

    with open(filepath, "rb") as img:
        files = {
            "file": (filename, img, "image/jpeg")
        }

        try:
            response = requests.post(url, headers=headers, files=files)
            if response.ok:
                print(f"✅ {filename} → OK")
            else:
                print(f"❌ {filename} → {response.status_code} | {response.text}")
        except Exception as e:
            print(f"🔥 {filename} → ERROR:", e)
