import './web/motor-aventuras.js';
import {createHash} from 'node:crypto';

function estacion(huecos, huella, sinOrden = false) {
  return Object.freeze({huecos, huella, sinOrden});
}

const salas = {
  2: {
    "luces": estacion(2, 'b55463c20d5b4b8fd3b6793f4c4880882e105e60acd7a926029eb84821062a13', true),
    "portulano": estacion(4, '2c58fccdc0d0a5c65829b64fde665405d721eba6f8a7049e9f72b69dfe9feb4c'),
    "compases": estacion(3, '42c2d1a3d9a2766c53f536897c347a838ab8f912d402eda1d24777104779ae6a'),
    "atraques": estacion(3, 'b9d67f6ad29205db0f85d6c8d9e412e89c5ae94e47d16177299bdb161b4d553b'),
    "calcos": estacion(2, '2bcba006a0326a2198eac98db8c92903b3401e1180a7dd055572a2a2ef55d2c6', true),
    "mareas": estacion(4, 'e480a4b386d9d13698c9af463122365967e1e4cf6cd085e14f0ac999acc9af72')
  },
  3: {
    "negativos": estacion(2, '8c1a70ebf5e9029ff10f835750b4a93f0c09d2b903263e47ae176617d96992d6', true),
    "bobina": estacion(4, '6b30d231ac9296f351cd91b1fb1c4e969ed90193b5e7c8a971cb562b1cb52943'),
    "focos": estacion(3, 'bc60dd099b83bad5928ca01bb81ccc7c54f2fe4105385b8b5e6e10d8a4ed6698'),
    "guardarropa": estacion(3, '09af7e885229fbd6623e834920ca0a958fc935b759fd46ccd5e4f2c261c2d8c1'),
    "domino": estacion(4, '34a14edb2a34e1ea17448cca5cfeaa661db4930ec4f2db092c52edd4bd2bccc5'),
    "tercera-silla": estacion(3, '8e65087ba1fb3cc459aba9ac88d1a9da58caa7129d954ef557b3e1fa864462e6')
  },
  4: {
    "improntas": estacion(2, '63d2a4b7914a34b67685b3d5c6f4e85f27c653c3d245b8893421d155c03a783f', true),
    "vasijas": estacion(3, 'f0cb2f496c23158fcec23f86ea0c362ed39da42384de3f3791bc5cf0f541c8e9'),
    "sombras": estacion(3, '60f7dbe034e71e3ae800fdf74446a87220a372c179973aa5dcf9f3288bb4d2b7'),
    "balanza": estacion(3, 'ef6f7944faccc03921118fb0535d8941f6814e66404471a8c43dfbe19bf9d9ef'),
    "lino": estacion(4, '5fd96fc9e80068ab5fd7f051c8f2ed13ebd6a7f058f3e225f733d70f446443c4'),
    "barca": estacion(4, '33044fa8fe4f39b688a0f178995805b4ec7780d145dae27747790254e37d36f9')
  }
};

export function estacionesDeSala(temporada) {
  return Number.isInteger(temporada) && Object.hasOwn(salas, temporada) ? Object.keys(salas[temporada]) : [];
}

export function validaEstacion(temporada, id, intento) {
  if (!Number.isInteger(temporada) || !Object.hasOwn(salas, temporada) ||
      typeof id !== 'string' || !Object.hasOwn(salas[temporada], id)) return false;
  const regla = salas[temporada][id];
  const valores=globalThis.MotorAventuras.canonizarPiezas(regla.sinOrden?'conjunto':'secuencia',intento,regla.huecos);
  if (!valores) return false;
  for (const valor of valores) {
    if (typeof valor !== 'string' || !/^[a-zA-Z0-9-]{1,32}$/.test(valor)) return false;
  }
  const huella = createHash('sha256').update(JSON.stringify([temporada, id, valores])).digest('hex');
  return globalThis.MotorAventuras.evaluarPrueba({tipo:'seleccion',respuesta:regla.huella},huella);
}
