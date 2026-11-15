# La última pieza

Aplicación Node.js 22 con historias de misterio, decisiones y partidas individuales o compartidas.

## Desarrollo

Instalar dependencias con npm install. Ejecutar npm run build, npm test y npm start. El servidor escucha en PORT (3000 por defecto).

public.zip conserva los casos y recursos multimedia originales. unpack.mjs lo extrae y superpone los archivos de web/, que son las fuentes editables de la interfaz. No editar public/: se regenera al iniciar. El servidor admite peticiones parciales de audio y vídeo.

## Cuentas y progreso

Implementación preparada: Firebase Authentication para Google y correo/contraseña, verificación de correo, recuperación de contraseña, sesión por pestaña o persistente mediante Recordarme, cierre de sesión y recuperación explícita de partidas locales.

La API verifica el token de Firebase y el correo confirmado. MySQL almacena perfiles y partidas, con pertenencia comprobada en cada acceso, transacciones y control de versión para las decisiones. Las invitaciones caducan en 24 horas y se almacenan como hash. No se almacenan contraseñas en la base de datos del juego.

Al salir o cambiar de cuenta se limpian los datos visibles y se cancelan peticiones pendientes. Un fallo de guardado se muestra como error; no se convierte silenciosamente en guardado local.

## Activación pendiente

La implementación aún no está desplegada ni validada con Firebase y MySQL reales. firebase-config.json está vacío a propósito. El sitio publicado conserva por ahora la versión anterior con perfiles locales.

1. Crear el proyecto Firebase tras la aceptación de condiciones por la titular.
2. Registrar una aplicación web y habilitar Google y correo/contraseña en Authentication. Configurar una contraseña mínima de 12 caracteres y protección contra enumeración de correos.
3. Añadir los dominios autorizados: laultimapieza.es, www.laultimapieza.es, yxkiqfgt3l.c35.airoapp.ai y yxkiqfgt3l.preview.c35.airoapp.ai. Configurar remitente y textos de verificación/recuperación en español.
4. Completar los identificadores públicos apiKey, authDomain, projectId y appId en firebase-config.json, o usar FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID y FIREBASE_APP_ID. Nunca introducir credenciales privadas de servicio en ese JSON.
5. Verificar la base de datos de GoDaddy y sus variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD. El controlador mysql2 debe instalarse durante el despliegue. DB_SSL_CA permite configurar una CA cuando el proveedor exige TLS. Las tres tablas lup_* se crean al primer acceso autenticado.
6. Desplegar primero en vista previa. APP_ORIGINS admite una lista de orígenes separados por comas. Vista previa y publicación comparten base de datos según el panel de GoDaddy.
7. Comprobar con dos cuentas reales: alta/verificación, Google, recuperación de contraseña, cierre de sesión, cambio de cuenta, recarga y recuperación del progreso en otro dispositivo. Probar también dos decisiones concurrentes y un fallo de conexión. Publicar después de estas comprobaciones.

Sin configuración completa, /api/auth/config devuelve enabled:false y las cuentas no se anuncian como activadas.

## Validación realizada

14 pruebas automatizadas aprobadas: separación entre usuarios, tokens inválidos/revocados, almacenamiento de decisiones, versiones concurrentes, invitaciones, importación local, limpieza de sesión, respuestas tardías, API HTTP y entrega de recursos. Las pruebas de persistencia usan un almacén simulado; no sustituyen la prueba de integración con MySQL. verify.mjs revisa los casos y medios del paquete.

El entorno de edición no pudo descargar mysql2 ni publicar por git debido a restricciones de red. Pendiente instalar dependencias y completar el despliegue, además de configurar Firebase. El dominio personalizado tenía la activación pendiente; usar la dirección pública de GoDaddy para las primeras pruebas.
