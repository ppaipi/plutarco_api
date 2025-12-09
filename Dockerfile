# Dockerfile
FROM python:3.11-slim

# evitar prompts locales
ENV DEBIAN_FRONTEND=noninteractive

# directorio de la app
WORKDIR /app

# dependencias del sistema
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential gcc libpq-dev \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# copiar requirements primero para cachear layer
COPY requirements.txt .

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# copiar el resto del código
COPY . .

# crear carpeta para la base de datos (el volumen hará mount en /data)
RUN mkdir -p /data
RUN chmod 755 /data

# puerto que usa fly (env PORT)
ENV PORT=8080

# comando de arranque
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
