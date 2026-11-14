# La última pieza

Web de misterio preparada para Node.js 22. Incluye el caso La habitación 309, doce casos de temporada y el expediente documental clásico.

## Ejecutar

```sh
npm run build
npm test
npm start
```

El servidor escucha en `PORT` (3000 por defecto). No necesita dependencias externas. El paquete versionado `public.zip` contiene todo el código de la interfaz y los medios; `npm run build` lo extrae a `public/` y verifica los casos. Admite peticiones parciales para reproducir y buscar dentro de audios y vídeos.

Para modificar la interfaz, extraer primero con `npm run build`, editar `public/` y regenerar `public.zip` con el contenido de esa carpeta en la raíz del ZIP antes de confirmar los cambios.

## Despliegue en GoDaddy

Seleccionar el repositorio `Nathalie-Duran/laultimapieza` y la rama `la-ultima-pieza`. Compilación: `npm run build`. Inicio: `npm start`. No se necesitan secretos para esta versión. GoDaddy requiere asociar un plan de hosting para activar la publicación pública.

## Estado real de esta versión

Los perfiles y el progreso se guardan únicamente en el navegador. Se puede jugar individualmente o compartir el dispositivo. Esta migración no incluye todavía autenticación con Google/correo, sincronización entre dispositivos ni cobros. No se presenta el perfil local como una cuenta autenticada. Estos servicios deben configurarse antes de anunciar esas funciones.

Se ha recuperado la copia guardada `La_ultima_pieza_Redisenada.html`, versión 9 del 14/11/2026. Sus recursos multimedia se sirven como archivos independientes. Se han retirado del recorrido principal los avisos de beta y las ofertas de suscripción sin activar.
