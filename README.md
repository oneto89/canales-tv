# Canales TV para Samsung Tizen

Reproductor de listas M3U para televisores Samsung Tizen. Permite guardar la lista y favoritos en el televisor, cambiar canales con CH+/CH− y mostrar la guía de programación cuando hay datos disponibles.

## Instalar y recibir versiones desde Apps2Samsung

1. Agrega este repositorio como fuente en Apps2Samsung 3.2: **Settings → Installing → Your sources**.
2. Como el repositorio es privado, configura en Apps2Samsung un token de GitHub que tenga acceso de lectura al repositorio. No guardes el token en este proyecto ni lo compartas.
3. Instala Canales TV desde esa fuente con Apps2Samsung. Conserva el mismo ID de app y firma para que el instalador pueda actualizar la app existente.
4. Las nuevas versiones se publican como lanzamientos de GitHub con un WGT adjunto. Apps2Samsung puede comparar la versión instalada con la del catálogo y ofrecer **Update**.

La actualización puede requerir pulsar **Update** en Apps2Samsung; no se instala silenciosamente desde el televisor.

## Publicar una versión

Actualiza el atributo `version` de `config.xml` y crea una etiqueta con el mismo número, por ejemplo `v1.1.9`. Al subir la etiqueta, GitHub Actions empaqueta los archivos de la app como WGT y los adjunta al lanzamiento.

El proyecto es Tizen TV 4.0 o posterior. `preview_server.js` sirve una vista previa local en `http://127.0.0.1:8765/`.

## Controles

- **CH+/CH−:** cambia de canal.
- **↑:** abre Favoritos; **←/→** recorre en ciclo y **OK** reproduce el seleccionado.
- **↓:** abre Lista M3U y Favorito.
- **→:** abre la lista completa de canales.
- **Atrás:** cierra el panel actual; mientras se reproduce un canal, permite confirmar el cierre de la aplicación.
