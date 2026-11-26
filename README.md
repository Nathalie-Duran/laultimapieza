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


## Investigación y calendario (15/11/2026)
Demo nueva con deducción de reloj y autor. Los doce enigmas tienen controles distintos; el servidor verifica respuestas y guarda ayudas/intentos. Llegar al final sin resolver no concede la pieza. Hitos a 3/6/9 y epílogo con decisión persistente. Conserva el progreso narrativo anterior; las piezas pendientes se recuperan al contrastar el enigma.

Cada temporada tiene su propio pase. Valdemar incluye los casos 01–12, El Tablero de Ámbar los casos 13–24 y Umbravía los casos 25–36. Cada pago mensual confirmado de 29,95 EUR abre cuatro casos de ese pase, con un máximo de tres pagos. Stripe cancela el cobro al terminar el calendario del pase. Mientras el pase está activo se puede jugar a los bloques pagados. Una vez pagados los tres bloques, se puede terminar esa temporada aunque haya finalizado el periodo de pago. Para contratar la siguiente hay que completar los doce casos de cada temporada anterior y elegir el nuevo pase expresamente.

### Activar contratación (pendiente de cuenta real y pruebas de integración)
La integración está desactivada por defecto. En el alojamiento, configurar STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID (EUR 2995, mensual, impuestos incluidos), STRIPE_PORTAL_CONFIGURATION (cancelación habilitada), BILLING_TERMS_URL y BILLING_PRIVACY_URL con datos legales reales. Primero usar claves de prueba; completar compra, webhook, renovación, cancelación, reembolso y recuperación de acceso. Solo entonces establecer BILLING_ENABLED=true con claves del entorno correspondiente. Nunca escribir secretos en Git.
Webhook: POST /api/billing/webhook, versión 2026-10-28.endive. Suscribir checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted, charge.refunded y charge.dispute.created. El cliente Stripe se vincula al UID en el servidor; el retorno del navegador nunca concede acceso. Se comprueba factura pagada e importe. El endpoint exige firma HMAC y tolerancia de 5 minutos.
No se ha conectado una cuenta de Stripe real ni procesado cobros. La gestión de cancelación y los reembolsos requieren validación con Stripe de pruebas antes de activar.

### Avisos y métricas
/api/waitlist guarda y retira una solicitud con el correo verificado de Firebase. No envía correos; el envío de apertura requiere servicio de correo y ejecución posterior autorizada. Tabla lup_member_data, campo waitlist. Contadores diarios agregados en lup_metrics; la demo solicita opt-in y no guarda respuestas, identificadores o IP. Los eventos de partidas se cuentan en el servidor. Son recuentos, no tasas de retención por cohortes ni visitantes únicos.
27 pruebas automatizadas y verificación de historias/medios. Las pruebas de base de datos/pago usan dobles; no equivalen a una compra ni a una prueba real MySQL.


## Owner access and sign-in domain
The verified owner identity has editorial access to the classic archive and all three seasons (36 cases), independent of billing, prior completions and the release calendar. The server compares the Firebase-verified email identifier in admin-access.mjs. Browser role/profile fields cannot grant access. This role does not allow reading other users' private games. Owner Checkout requests are rejected to avoid an unnecessary subscription.

Google sign-in uses the same Firebase project and account IDs. The custom callback is https://laultimapieza.es/__/auth/handler, authorized on the existing OAuth client. firebase-proxy.mjs forwards only reserved Firebase helper paths to the fixed project; no arbitrary destination, app bearer token or app cookie is forwarded. Google configuration propagation must be checked end to end before treating the custom domain as ready. 30 automated tests passed, including owner access boundaries and helper proxy requests. Billing remains disabled until provider settings and test-mode validation are complete.
