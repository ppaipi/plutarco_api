import sqlite3

# Conectar a la base de datos
conn = sqlite3.connect('/home/felipe/Documentos/plutarco_api/pedidos_productos.db')
cursor = conn.cursor()

try:
    # Agregar columna anuncio_habilitado
    cursor.execute("""
        ALTER TABLE configuracion ADD COLUMN anuncio_habilitado INTEGER DEFAULT 0;
    """)
    print("✓ Columna 'anuncio_habilitado' agregada exitosamente")
except sqlite3.OperationalError as e:
    print(f"⚠️ Error en anuncio_habilitado: {e}")

try:
    # Agregar columna anuncio_imagen_url
    cursor.execute("""
        ALTER TABLE configuracion ADD COLUMN anuncio_imagen_url TEXT;
    """)
    print("✓ Columna 'anuncio_imagen_url' agregada exitosamente")
except sqlite3.OperationalError as e:
    print(f"⚠️ Error en anuncio_imagen_url: {e}")

# Confirmar los cambios
conn.commit()
conn.close()

print("\n✓ Base de datos actualizada correctamente")