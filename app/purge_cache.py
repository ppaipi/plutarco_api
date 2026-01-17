from app.config import PURGE_CACHE_URL, TOKEN_CLOUDFLARE_API
import requests

def purgue_cache():
    if not PURGE_CACHE_URL or not TOKEN_CLOUDFLARE_API:
        print("⚠️ PURGE_CACHE_URL o TOKEN_CLOUDFLARE_API no está configurado.")
        return

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN_CLOUDFLARE_API}",
        }
        data = {
            "purge_everything": True
        }  

        response = requests.post(PURGE_CACHE_URL, headers=headers, json=data)
        if response.ok:
            print("✅ Caché purgueado correctamente.\nRespuesta:", response.json())
        else:
            print(f"❌ Error al purgar caché: {response.status_code} | {response.text}")
    except Exception as e:
        print("🔥 Error al purgar caché:", e)