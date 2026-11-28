# La Última Pieza · Arquitectura y validación

## Fase 1

| Trabajo | Responsable sugerido | Procedimiento y evidencia de cierre |
| --- | --- | --- |
| Fijar la versión de partida | Responsable de publicación | Registrar el commit que sirve el dominio y conservarlo en una rama de respaldo. Para esta actualización la referencia es `respaldo-plataforma-20261128`, en el commit `31fc736`. |
| Auditar los recorridos | Desarrollo y pruebas | Seguir desde la portada y el catálogo los destinos de visitante, cuenta sin pase y cuenta con acceso. Verificar «Ficha», «Jugar», continuación, modo individual y modo en pareja. Incluir demo y salas de juegos. |
| Respaldar el servicio | Responsable de alojamiento | Exportar desde GoDaddy la estructura y los datos de todas las tablas. Conservar el SQL en una ubicación privada, con acceso restringido. Anotar fecha, número de tablas y huella del archivo. Guardar por separado la referencia de código que le corresponde. |
| Revisar la persistencia | Responsable de datos | Contrastar las tablas del esquema con el respaldo. Comprobar vínculos de cuentas, partidas, inventarios, derechos adquiridos, llaves, parejas y ediciones. Verificar que un reintento de la misma acción conserva un único movimiento. |
| Preparar un entorno aislado | Desarrollo de plataforma | Abrir una rama de trabajo y una solicitud de integración contra `la-ultima-pieza`. El flujo «Ensayo de plataforma» construye la aplicación, ejecuta la batería y levanta un MySQL temporal con dos bases. Solo utiliza registros sintéticos. La vista previa del alojamiento comparte base con el sitio público. |
| Acordar el contrato de pruebas | Desarrollo de juegos y diseño narrativo | Definir qué observa cada papel, qué puede manipular y qué evidencia explica el resultado. El motor acepta decisiones, conjuntos, secuencias, campos o una mecánica parametrizada. La edición privada decide la respuesta válida. |
| Validar el piloto | Diseño y pruebas | En «El secreto de los dos mundos», fallar y corregir una prueba, intercambiar un objeto entre las dos casas, salir, retomar la escena y llegar al desenlace. Comprobar el mismo recorrido con dos dispositivos y dos permisos de acceso. |
| Autorizar la salida | Responsable de publicación | Revisar el resultado del ensayo, la versión del dominio, un recorrido anónimo y otro con acceso. Una actualización de código puede revertirse al commit registrado. Cualquier recuperación de datos se ensaya en una base vacía antes de considerar la base activa. |

## Cómo atraviesa una prueba la plataforma

1. La edición describe el escenario, los materiales y las acciones visibles para el papel del jugador. La interfaz representa los objetos y registra lo que mueve, ordena, elige o escribe.
2. La demo sin cuenta comprueba su propia deducción en el dispositivo. En una aventura de suscripción, el servicio valida acceso, papel, edición y etapa antes de evaluar el intento. El navegador solo recibe la información jugable.
3. El motor contrasta la respuesta con las reglas de la edición. En una simulación importa la secuencia de movimientos y la posición final del mecanismo. En una deducción pueden importar la selección de fuentes, el orden o las dos lecturas aportadas.
4. El servicio guarda el avance y los premios correspondientes. Al reabrir se recupera la edición y el progreso de la partida. El taller permite publicar otra revisión para partidas nuevas.

## Pruebas de una versión

| Área | Comprobación |
| --- | --- |
| Jugabilidad | Intento incorrecto con orientación, respuesta correcta y reapertura en la etapa siguiente. Ambos papeles pueden participar. En solitario se accede a las dos perspectivas. |
| Diseño | Fichas y mesa del bloque 1, catálogos de las cuatro temporadas, enlaces de la demo, controles de teclado y móvil. |
| Economía | Cuatro derechos por cuota confirmada, progresión entre temporadas, descuento de pareja, gasto de llaves y un solo premio por logro. |
| Cuenta | Derechos diferentes de los dos jugadores, recuperación del guardado, cierre de sesión y confirmación de baja en el perfil. |
| Operación | Cola de correos con receptor de prueba, estadísticas con datos registrados, publicación de borradores y acceso de gestión. |
| Persistencia | En MySQL se crea un episodio de ensayo, se guarda una partida y se provoca una reversión. A continuación se exporta la base y se restaura en otra, donde se releen la edición, la partida, el inventario, la llave y la prueba resuelta. |

El ensayo de MySQL verifica el procedimiento con datos sintéticos. La recuperación completa del negocio requiere además un ensayo privado con la copia del alojamiento. La duración de cada aventura se mide con jugadores, registrando el tiempo activo y las pausas por separado.
