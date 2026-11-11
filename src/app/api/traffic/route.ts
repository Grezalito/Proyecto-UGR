import { connection } from "next/server";
import { INAPPROPRIATE_MESSAGES } from "@/lib/initial-data";
import { errorResponse, sendChatMessage } from "@/lib/turso";

/* ════════════════════ Oyentes de la región ════════════════════ */

const REGION = ["Venado Tuerto", "Firmat", "Murphy", "Chovet", "Rufino", "Rosario"] as const;

const NAMES = [
  "Marta",
  "Juan Cruz",
  "Lucía",
  "Don Rubén",
  "Sofi",
  "Carlos",
  "Esteban",
  "Graciela",
  "Nacho",
  "Pocha",
  "Mati",
  "Belén",
  "Tito",
  "Romina",
  "Valen",
  "Chiche",
  "Norma",
  "Fede",
  "Antonella",
  "Coco",
  "Mirta",
  "Lauti",
] as const;

/* ════════════════════ Repertorio para pedidos ════════════════════ */

const ROCK_NACIONAL = [
  "Charly García",
  "Spinetta",
  "Los Redondos",
  "Soda Stereo",
  "Fito Páez",
  "Gustavo Cerati",
  "Divididos",
  "Los Piojos",
  "La Renga",
  "Andrés Calamaro",
  "Virus",
  "Sumo",
  "Los Enanitos Verdes",
  "Babasónicos",
  "Los Fabulosos Cadillacs",
] as const;

const CUMBIA_SANTAFESINA = [
  "Los Palmeras",
  "Leo Mattioli",
  "Grupo Alegría",
  "Los Leales",
  "Uriel Lozano",
  "Mario Luis",
  "Grupo Cali",
] as const;

const CLASICOS_POPULARES = [
  "Sandro",
  "Leo Dan",
  "Palito Ortega",
  "Mercedes Sosa",
  "León Gieco",
  "Soledad",
  "Abel Pintos",
  "Los Auténticos Decadentes",
  "La Mona Jiménez",
  "Rodrigo",
] as const;

const GENRES = [ROCK_NACIONAL, CUMBIA_SANTAFESINA, CLASICOS_POPULARES] as const;

const PRODUCTS = [
  "la yerba",
  "el litro de leche",
  "los fideos",
  "el pan francés",
  "la gaseosa de 2 litros",
  "el limpiador multiuso",
  "el kilo de azúcar",
  "el aceite de girasol",
  "la docena de huevos",
  "el paquete de galletitas",
  "el queso cremoso",
] as const;

/* ════════════════════ Plantillas ════════════════════ */
/*
 * Los pedidos musicales SIEMPRE incluyen "tema de", "temita de", "canción de"
 * o "clásico de" + {artist}, seguido de signo de puntuación o " para ":
 * RadioChat detecta ese patrón para ofrecer "Sumar al Deck".
 */

/** Situaciones cotidianas de la región y saludos. */
const GREETINGS = [
  "Manden un saludo para los chicos del taller metalúrgico en Venado Tuerto.",
  "Escuchando acá en la estación de servicio de Murphy, ¡buen día a todos!",
  "Yendo por la 33 para Firmat con la radio al palo.",
  "¡Saludos desde {city} a los alumnos de la UGR!",
  "Acá en {city} se escucha bárbaro, ¡felicitaciones a los chicos del taller!",
  "Un abrazo grande a toda la gente de {city} que está escuchando.",
  "¡Qué lindo programa! Lo seguimos en familia desde {city}.",
  "Saludos a mi sobrino que estudia en la UGR, ¡dale que sos un capo!",
  "Me sumo desde la cosechadora, en un campo entre Chovet y Firmat.",
  "Tomando unos mates en la vereda en Rufino, con la radio de compañía.",
  "Desde la panadería de {city} los escuchamos mientras sale la tanda de bizcochos.",
  "Saludos a los profes de la UGR, ¡qué lindo lo que están haciendo con los chicos!",
  "Escuchando en el colectivo de Rosario a Venado, ¡se escucha clarito!",
  "Les mando un saludo desde el club de bochas de Murphy.",
  "¡Hola radio! Estoy en la peluquería de {city} y pusimos la UGR de fondo.",
  "Saludo especial para los chicos del taller de cocina, ¡ayer probé las tortas fritas!",
  "Acá en el taller mecánico de {city} no apagamos la radio en todo el día.",
  "Escuchando desde la plaza de {city} con los nenes jugando, ¡qué linda tarde!",
  "Un saludo grande para la gente del hospital de Venado Tuerto que está de guardia.",
  "Volviendo del trabajo por la ruta 8, a la altura de {city}. ¡Aguante la radio!",
  "Les cuento que en {city} está lloviendo, ¡pero con este programa no importa!",
  "Saludos desde la escuela de {city}, la seño nos dejó escuchar el programa.",
  "Mi abuela de 90 años los escucha todos los días en {city}. ¡Un beso para ella!",
  "Desde la verdulería de {city} les mando un saludo a todos los clientes.",
  "Acabo de llegar de la cancha en {city}, ¡ganamos! Saludos a la hinchada.",
  "¡Qué bien suenan los chicos hoy! Escucho desde la oficina en Rosario.",
  "Saludos a los camioneros que van por la 33, ¡cuídense en la ruta!",
  "Estamos en la cooperativa de {city} siguiendo el programa en la hora del almuerzo.",
] as const;

const SONG_REQUESTS = [
  "¿Sale un tema de {artist}?",
  "¡Pongan un tema de {artist} para los chicos de la UGR!",
  "¿Pueden pasar un tema de {artist}? Lo escuchamos desde {city}.",
  "Pido un tema de {artist} para mi vieja que cumple años.",
  "¡Desde {city} pedimos un tema de {artist}!",
  "¿Me pasás un temita de {artist} para arrancar la tarde?",
  "Estamos de asado en {city}, ¡queremos una canción de {artist}!",
  "Un clásico de {artist} para los que vamos manejando por la ruta, por favor.",
  "¿Hay chance de escuchar algún tema de {artist}? Saludos desde {city}.",
  "Mi hija me pide un temita de {artist}, ¿se puede?",
  "Para levantar el ánimo: ¡una canción de {artist}!",
  "Desde la estación de servicio pedimos un clásico de {artist}.",
  "¿Y si meten un tema de {artist} para cerrar la hora?",
  "Dedico una canción de {artist} a todos los alumnos del taller.",
] as const;

const PRICE_QUESTIONS = [
  "¿A cuánto está {product} en el súper de la UGR?",
  "¿Tienen {product} en oferta esta semana?",
  "¿Hacen envíos a {city}? Necesito {product}.",
  "¿Hasta qué hora atiende el súper? Quiero pasar a buscar {product}.",
  "¿Me guardan {product}? Paso a la tarde desde {city}.",
  "¿Aceptan tarjeta en el súper o solo efectivo?",
  "¿Cuánto me sale {product} si llevo tres?",
  "¿Llegó {product}? La semana pasada no había.",
] as const;

/** Comentarios sobre el programa y la conducción. */
const SHOW_COMMENTS = [
  "¡Qué bien que conducen los chicos, se nota que practicaron!",
  "Me encantó el efecto de los aplausos, ¡muy profesional!",
  "¿Mañana a qué hora arranca el programa?",
  "La música de hoy está buenísima, ¡no cambien nada!",
  "¿Pueden repetir el número de WhatsApp de la radio?",
  "Ayer me perdí el programa, ¿lo suben a algún lado?",
  "¡Qué buena onda tienen! Se los escucha contentos.",
  "Pregunta: ¿los chicos del taller eligen ellos la música?",
] as const;

type Kind = "saludo" | "pedido" | "precio" | "comentario" | "inapropiado";

const WEIGHTS: [Kind, number][] = [
  ["saludo", 0.34],
  ["pedido", 0.32],
  ["precio", 0.14],
  ["comentario", 0.1],
  ["inapropiado", 0.1],
];

/* ════════════════════ Generación sin repeticiones ════════════════════ */

const RECENT_LIMIT = 15;
/** Últimos textos/autores emitidos por esta instancia (mitiga repeticiones seguidas). */
const recentTexts: string[] = [];
const recentAuthors: string[] = [];

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

function remember(queue: string[], value: string, limit: number) {
  queue.push(value);
  if (queue.length > limit) queue.shift();
}

/** Elige evitando los valores usados recientemente (con tope de intentos). */
function pickFresh<T extends string>(list: readonly T[], recent: readonly string[]): T {
  for (let i = 0; i < 8; i++) {
    const candidate = pick(list);
    if (!recent.includes(candidate)) return candidate;
  }
  return pick(list);
}

function pickKind(): Kind {
  let r = Math.random();
  for (const [kind, weight] of WEIGHTS) {
    if ((r -= weight) < 0) return kind;
  }
  return "saludo";
}

function fill(template: string, city: string): string {
  return template
    .replaceAll("{city}", city)
    .replaceAll("{artist}", pick(pick(GENRES)))
    .replaceAll("{product}", pick(PRODUCTS));
}

function buildMessage() {
  const city = pick(REGION);
  const kind = pickKind();
  if (kind === "inapropiado") {
    return { author: `Usuario${Math.floor(100 + Math.random() * 900)}`, city, text: pick(INAPPROPRIATE_MESSAGES) };
  }
  const bank =
    kind === "pedido"
      ? SONG_REQUESTS
      : kind === "precio"
        ? PRICE_QUESTIONS
        : kind === "comentario"
          ? SHOW_COMMENTS
          : GREETINGS;

  // Hasta 5 intentos de producir un texto final que no se haya dicho hace poco.
  let text = fill(pickFresh(bank, recentTexts), city);
  for (let i = 0; i < 4 && recentTexts.includes(text); i++) text = fill(pick(bank), city);

  const author = pickFresh(NAMES, recentAuthors);
  remember(recentTexts, text, RECENT_LIMIT);
  remember(recentAuthors, author, 6);
  return { author, city, text };
}

async function inject() {
  await connection();
  try {
    const msg = await sendChatMessage({ role: "oyente", ...buildMessage() });
    return Response.json(msg, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = inject;
export const POST = inject;
