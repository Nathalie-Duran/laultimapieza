# La última pieza

Aplicación Node.js 22 con historias de misterio, decisiones y partidas individuales o compartidas.

## Desarrollo

Instalar dependencias con npm install. Ejecutar npm run build, npm test y npm start. El servidor escucha en PORT (3000 por defecto).

public.zip conserva los casos y recursos multimedia originales. unpack.mjs lo extrae y superpone los archivos de web/, que son las fuentes editables de la interfaz. No editar public/: se regenera al iniciar. El servidor admite peticiones parciales de audio y vídeo.

## Cuentas y progreso

Implementación preparada: Firebase Authentication para Google y correo/contraseña, verificación de correo, recuperación de contraseña, sesión por pestaña o persistente mediante Recordarme, cierre de sesión y recuperación explícita de partidas locales.

La API verifica el token de Firebase y el correo confirmado. MySQL almacena perfiles y partidas, con pertenencia comprobada en cada acceso, transacciones y control de versión para las decisiones. Las invitaciones caducan en 24 horas y se almacenan como hash. No se almacenan contraseñas en la base de datos del juego.

Al salir o cambiar de cuenta se limpian los datos visibles y se cancelan peticiones pendientes. Un fallo de guardado se muestra como error; no se convierte silenciosamente en guardado local.

## Configuración y estado

Firebase admite Google y correo/contraseña. La autenticación y el perfil son independientes de la suscripción. La portada, el catálogo, el registro y #planes distinguen una escena gratuita de los casos completos de pago, con precio previsto de 29,95 €/mes (IVA incluido).

El pago aún no está conectado. La interfaz lo indica y no simula cobros ni suscripciones. En producción, createGameApi deniega el juego por defecto; solo un futuro proveedor de permisos verificados en servidor podrá autorizarlo. Crear cuenta, editar perfil o recuperar partidas locales nunca concede acceso. Se conservan perfiles e historial, pero nuevas partidas, reanudación, decisiones e invitaciones requieren permiso vigente. Los recursos narrativos históricos fueron distribuidos públicamente y esta comprobación no constituye protección DRM de esos archivos.

web/membership.js y web/membership.css contienen la presentación comercial. La escena gratuita se conserva separada del juego completo. Al integrar pagos reales habrá que verificar firmas de webhooks, vincular el cliente con el UID autenticado y comprobar estado y fecha de vigencia antes de proporcionar authorizePlay; no confiar en redirecciones de éxito ni datos del navegador.

## Configuración de otro entorno

Configurar Firebase Authentication, dominios autorizados e identificadores públicos mediante firebase-config.json o FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID y FIREBASE_APP_ID. Configurar DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD; DB_SSL_CA permite indicar una CA cuando se exige TLS. APP_ORIGINS define los orígenes permitidos separados por comas. Las tablas lup_* se crean al primer acceso autenticado. Vista previa y publicación de GoDaddy comparten base de datos.

## Validación realizada

18 pruebas automatizadas aprobadas (incluyen bloqueo de pago y conservación del progreso): separación entre usuarios, tokens inválidos/revocados, almacenamiento de decisiones, versiones concurrentes, invitaciones, importación local, limpieza de sesión, respuestas tardías, API HTTP y entrega de recursos. Las pruebas de persistencia usan un almacén simulado; no sustituyen la prueba de integración con MySQL. verify.mjs revisa los casos y medios del paquete.

La red del terminal no permite publicar por git; los archivos se han subido mediante GitHub y desplegado en GoDaddy. Consultar DEPLOYMENT.md para el estado de publicación y las comprobaciones pendientes.
