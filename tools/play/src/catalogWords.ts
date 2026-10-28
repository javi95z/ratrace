/**
 * The catalogue's own words: its headings, its table heads and the sentences it builds around the
 * game's numbers. Everything the game itself says (names, cards, perks, badges) comes from the
 * content's text for the same language; these are only the words the generator adds.
 *
 * Russian addresses the player as «ты» and never gives them a gender (docs/i18n/russian.md).
 */
export type CatalogLocale = 'es' | 'ru';

/** How a language writes the numbers the catalogue prints. */
export interface Numbers {
  usd: (cents: number) => string;
  /** A rate in basis points, as a percentage. */
  pct: (bp: number) => string;
  /** A percentage already worked out, with the sign as the language sets it. */
  pc: (value: number | string) => string;
  /** A whole number with its sign: +3, 0, -2 (Russian writes the minus sign, −2). */
  signed: (n: number) => string;
}

// Spanish leaves four-digit numbers ungrouped; German groups them the same way and always.
const esWhole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
// Russian groups with a no-break space, four digits too, as the game's own formats do.
// (`useGrouping: 'always'` is newer than this package's typings, so the options go in untyped.)
const ruWhole = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
const NBSP = ' ';

export const NUMBERS: Record<CatalogLocale, Numbers> = {
  es: {
    usd: (cents) => `${esWhole.format(Math.round(cents / 100))} $`,
    pct: (bp) => `${(bp / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`,
    pc: (value) => `${value} %`,
    signed: (n) => (n > 0 ? `+${n}` : `${n}`),
  },
  ru: {
    usd: (cents) => `${ruWhole.format(Math.round(cents / 100))}${NBSP}$`,
    pct: (bp) => `${(bp / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`,
    pc: (value) => `${value}%`,
    signed: (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'),
  },
};

/** The Russian form of a noun after a whole number: 1 год, 2 года, 5 лет. */
const ru = (n: number, one: string, few: string, many: string): string => {
  const ten = n % 10;
  const hundred = n % 100;
  if (ten === 1 && hundred !== 11) return one;
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return few;
  return many;
};
const years = (n: number) => `${n}${NBSP}${ru(n, 'год', 'года', 'лет')}`;
/** An age after «с» or «до»: с 21 года, с 30 лет. */
const ageAfter = (n: number) => `${n}${NBSP}${n % 10 === 1 && n % 100 !== 11 ? 'года' : 'лет'}`;
const quoted = (name: string) => `«${name}»`;

export interface Words {
  title: string;
  /** Which content the catalogue shows, for its title page and its foot. */
  version: (version: string) => string;
  intro: (version: string) => string[];
  toc: { head: [string, string]; rules: (n: number) => string; items: (n: number, cars: number) => string };
  sections: {
    lives: string; challenge: string; careers: string; business: string; cities: string; items: string;
    properties: string; investments: string; lifestyle: string; evasion: string; cards: string; crises: string; badges: string;
  };
  lives: {
    ages: string;
    portraitAlt: (name: string, age: number) => string;
    noJob: string;
    debt: (kind: string, amount: string, rate: string) => string;
    owned: (home: string) => string;
    holding: (amount: string, asset: string) => string;
    recurring: (passive: boolean, amount: string) => string;
    startsIn: string;
    startsInValue: (city: string, cash: string) => string;
    job: string;
    skills: string;
    lifestyle: string;
    noLower: (tier: string) => string;
    startsWith: string;
    nothing: string;
    perk: string;
    handicap: string;
    unlock: string;
  };
  challenge: { week: string; head: [string, string, string] };
  careers: {
    about: string;
    overtime: (pct: string) => string;
    focus: (n: number) => string;
    cycle: (list: string) => string;
    fade: (age: number, pct: string, max: string) => string;
    head: [string, string, string, string];
    salary: (pct: string) => string;
    movesHead: [string, string, string, string];
    rungs: (from: string, to: string) => string;
    skillBonus: (points: number, skill: string) => string;
  };
  business: {
    about: (b: { neglect: string; decay: string; max: number; min: string; top: string }) => string;
    head: [string, string, string, string, string, string, string];
    upTo: (pct: string) => string;
    ofProfit: (pct: string) => string;
  };
  cities: {
    about: string;
    moving: (m: { cost: string; distance: string | null; partner: string; child: string; rungs: number; years: number }) => string;
    night: (city: string) => string;
    day: (city: string) => string;
    boom: (city: string) => string;
    crisis: (city: string) => string;
    salary: string;
    perYear: (amount: string) => string;
    living: string;
    flat: string;
    rentYield: string;
    rentYieldValue: (pct: string) => string;
    incomeTax: string;
    gainsTax: string;
    prestige: string;
    pays: string;
  };
  items: {
    lesser: (pct: string) => string;
    counted: (ladder: string, counted: number, pct: string) => string;
    rest: (ladder: string, pct: number, value: string) => string;
    uses: string;
    aging: (ladders: string[], floor: string) => string;
    resale: string;
    finance: (price: string, down: string) => string;
    used: string;
    usedHead: [string, string, string, string];
    usedPrice: (pct: string) => string;
    usedRepair: (chance: string, cost: string) => string;
    moveCostOff: (pct: string) => string;
    studySkill: (n: number) => string;
    salary: (pct: string) => string;
    jobHunt: (n: number) => string;
    focus: (n: number) => string;
    head: [string, string, string, string, string, string, string, string];
    perYear: (amount: string) => string;
    resaleValue: (start: string, drift: string) => string;
    membership: string;
    experience: (years: number) => string;
    cardOnly: string;
    onlyIn: (cities: string[]) => string;
  };
  properties: {
    about: (city: string) => string;
    estates: (min: number, pct: string, counted: number) => string;
    head: (city: string) => [string, string, string, string, string, string, string];
    price: (pct: string) => string;
    rentalOnly: string;
    liveOrLet: string;
    rent: (pct: string) => string;
    renting: string;
    rentHead: [string, string, string, string];
    aged: (room: string[], frugal: string[], names: { room: string; frugal: string }) => string;
    agedStep: (age: number, status: string) => string;
  };
  investments: {
    about: (points: number, levels: string) => string;
    head: [string, string, string, string, string, string];
    coupon: string;
    perYear: (pct: string) => string;
  };
  lifestyle: {
    head: [string, string, string, string];
    insuranceHead: [string, string, string];
    premium: (pct: string) => string;
    focusHead: [string, string, string];
    overtime: (o: { tiredFrom: number; health: number; burnoutFrom: number; chance: string; burnoutHealth: number; focus: number }) => string;
    studyCareer: (study: number, work: number, perRung: number) => string;
    jobHunt: (j: { chance: string; raise: string; rest: number; miss: number; floor: string }) => string;
    study: (points: number, skill: string) => string;
    skills: (levels: string, study: number, practice: number, management: string) => string;
    skillsHead: [string, string, string, string];
    negotiation: (hunt: string, promotion: string, sale: string) => string;
    negotiationPractice: string;
    languages: (move: string, keepRung: number, partner: number) => string;
    languagesPractice: string;
    network: (hunt: number, status: number) => string;
    networkPractice: string;
    management: (profit: string, manager: number, extra: number) => string;
    managementPractice: string;
    health: (premium: string, focus: number) => string;
    healthPractice: string;
    family: (partner: string, child: string, years: number) => string;
  };
  evasion: {
    about: string;
    head: [string, string, string, string];
    perRound: (list: string) => string;
    black: [string, string, string];
    shell: (cut: string) => [string, string];
    shellNotes: (skill: number, fee: string) => string;
    crypto: [string, string, string];
    cryptoSuspicion: (n: number, age: number) => string;
    invoice: (discount: string) => [string, string];
    invoiceSuspicion: (n: number) => string;
    and: string;
    audit: (a: { decay: number; max: string; years: number; fine: string; goods: string; status: number }) => string;
  };
  cards: { about: (n: number) => string; head: [string, string, string] };
  crises: {
    about: (chance: string, age: number) => string;
    how: string;
    head: [string, string, string, string];
    crypto: (phase: string) => string;
    rates: string; inflation: string; equity: string; property: string; gold: string; cryptoShift: string;
  };
  badges: { head: [string, string, string] };
}

const es: Words = {
  title: 'Catálogo del juego',
  version: (version) => `contenido ${version}`,
  intro: (version) => [
    `Todo lo que hay en The Rat Race, con su dibujo y sus números. Generado desde el contenido y los textos del juego (contenido ${version}) con \`pnpm catalog\`: no lo edites a mano.`,
    'Los precios son en dólares del inicio de la partida; en el juego suben con la inflación.',
  ],
  toc: { head: ['Qué', 'Cuántos'], rules: (n) => `${n} reglas`, items: (n, cars) => `${n}, de ellos ${cars} coches` },
  sections: {
    lives: 'Vidas', challenge: 'Reto de la semana', careers: 'Carreras', business: 'Negocios', cities: 'Ciudades', items: 'Objetos',
    properties: 'Inmuebles', investments: 'Inversiones', lifestyle: 'Modo de vida, alquiler, seguros y foco', evasion: 'Lo que no se declara',
    cards: 'Cartas', crises: 'Crisis', badges: 'Insignias',
  },
  lives: {
    ages: 'Cada vida se dibuja a los 22, 32, 45 y 58 años.',
    portraitAlt: (name, age) => `${name} a los ${age}`,
    noJob: 'Sin trabajo',
    debt: (kind, amount, rate) => `${kind} de ${amount} al ${rate}`,
    owned: (home) => `${home} en propiedad`,
    holding: (amount, asset) => `${amount} en ${asset}`,
    recurring: (passive, amount) => `${passive ? 'Ingreso' : 'Gasto'} fijo de ${amount} al año`,
    startsIn: 'Empieza en',
    startsInValue: (city, cash) => `${city}, con ${cash}`,
    job: 'Trabajo',
    skills: 'Experiencia · Finanzas · Foco',
    lifestyle: 'Modo de vida',
    noLower: (tier) => ` (no puede bajar de ${tier})`,
    startsWith: 'Empieza con',
    nothing: 'Nada más',
    perk: 'Ventaja',
    handicap: 'Desventaja',
    unlock: 'Se desbloquea',
  },
  challenge: {
    week: 'Cada semana ISO va de lunes a domingo en UTC. La semana determina una vida y una regla para todos; el servidor guarda la semilla que hace iguales los mercados y las cartas del intento oficial.',
    head: ['', 'Regla', 'Condición'],
  },
  careers: {
    about: 'El sueldo es un porcentaje del sueldo medio de la ciudad donde vives. Se asciende al llegar a la experiencia que pide el puesto siguiente.',
    overtime: (pct) => `Horas extra: +${pct} de sueldo esa ronda.`,
    focus: (n) => `Deja tiempo libre: +${n} de foco cada ronda.`,
    cycle: (list) => `El sueldo sigue a la economía: ${list}.`,
    fade: (age, pct, max) => `Oficio de jóvenes: desde los ${age} años, ${pct} menos de sueldo cada ronda, hasta un ${max} menos.`,
    head: ['Puesto', 'Sueldo', 'Experiencia', 'Estatus'],
    salary: (pct) => `${pct} del sueldo medio`,
    movesHead: ['Movimiento', 'En los puestos', 'Rondas · descanso', 'Qué puede salir'],
    rungs: (from, to) => `${from} a ${to}`,
    skillBonus: (points, skill) => `+${points} puntos de probabilidad por nivel de ${skill}`,
  },
  business: {
    about: (b) => `Un negocio rinde sobre el capital que trabaja en él: todo el de uno pequeño, y cada vez menos de cada dólar cuando crece por encima del tamaño para el que está hecho. La economía mueve el beneficio, y una ronda lo bastante mala es una pérdida. Pide 1 de foco cada ronda o un encargado; sin ninguno gana el ${b.neglect} y pierde un ${b.decay} de su capital. Se pueden llevar hasta ${b.max}. Vendido desde la pestaña vale entre el ${b.min} y el ${b.top} de lo que tiene dentro, según la economía; solo una carta paga más.`,
    head: ['Negocio', 'Capital mínimo', 'Rinde al año', 'Hecho para', 'Con la economía', 'Encargado', 'Finanzas'],
    upTo: (pct) => `hasta ${pct}`,
    ofProfit: (pct) => `${pct} del beneficio`,
  },
  cities: {
    about: 'Cada ciudad tiene su perfil de noche, de día, en bonanza y en crisis, y un icono.',
    moving: (m) => `Mudarse cuesta el ${m.cost} del coste de vida anual del destino${m.distance ? `, un ${m.distance} más por cada 1.000 km de distancia` : ''}, y 1 de foco; con pareja, un ${m.partner} más, y un ${m.child} más por cada hijo. Quien se muda por su cuenta llega ${m.rungs} puesto por debajo, hasta su siguiente ascenso, y su pareja pasa ${m.years} años sin sueldo. Un traslado ofrecido por una carta no cuesta nada de eso.`,
    night: (city) => `${city} de noche`,
    day: (city) => `${city} de día`,
    boom: (city) => `${city} en bonanza`,
    crisis: (city) => `${city} en crisis`,
    salary: 'Sueldo medio',
    perYear: (amount) => `${amount} al año`,
    living: 'Coste de vida',
    flat: 'Piso de referencia',
    rentYield: 'Alquiler que rinde un inmueble',
    rentYieldValue: (pct) => `${pct} de su valor al año`,
    incomeTax: 'Impuesto sobre la renta',
    gainsTax: 'Impuesto sobre ganancias',
    prestige: 'Estatus por vivir aquí',
    pays: 'Carreras que paga mejor',
  },
  items: {
    lesser: (pct) => `Dentro de una misma gama, la mejor cosa da su estatus entero y las demás un ${pct} del suyo.`,
    counted: (ladder, counted, pct) => `${ladder}: solo cuentan ${counted === 1 ? 'la mejor' : `las ${counted} mejores, la primera entera y las otras un ${pct}`}.`,
    rest: (ladder, pct, value) => `${ladder}: ${pct === 0 ? 'solo cuenta la mejor; las demás no dan estatus' : `las demás un ${value}`}.`,
    uses: '«Sirve para» es lo que da además del estatus. Dentro de una gama solo cuenta lo mejor que se tenga; entre gamas, se suma. Con coche se abre además una opción mejor en la carta del encargo por cuenta propia, y siendo socio de algo, en la de trabajar por tu cuenta.',
    aging: (ladders, floor) => `Los objetos de ${ladders.map((ladder) => ladder.toLowerCase()).join(' y ')} pierden estatus al envejecer, al mismo ritmo que pierden valor, hasta quedarse en el ${floor} de lo que daban nuevos.`,
    resale: '«Reventa» es lo que vale el día que se compra, sobre su precio, y lo que cambia cada ronda aparte de la inflación.',
    finance: (price, down) => `A plazos se vende lo que dura y cuesta ${price} o más: un ${down} de entrada y el resto como préstamo personal, dentro del límite de préstamos. Si se vende, la deuda sigue.`,
    used: 'De segunda mano se venden algunas gamas, solo al contado. Lo usado tiene ya unos años: si es de una gama que envejece, da menos estatus. El día de la compra vale el mismo porcentaje de lo que costó que uno nuevo, así que comprar y vender en la misma ronda nunca gana. La ronda de la compra la cubre la garantía; después, cada ronda puede necesitar una reparación, pagada con las facturas de la ronda.',
    usedHead: ['Gama', 'Precio', 'Años', 'Reparación'],
    usedPrice: (pct) => `${pct} del nuevo`,
    usedRepair: (chance, cost) => `${chance} por ronda, un ${cost} del precio nuevo`,
    moveCostOff: (pct) => `Mudarse cuesta un ${pct} menos`,
    studySkill: (n) => `+${n} de experiencia al estudiar`,
    salary: (pct) => `+${pct} de sueldo`,
    jobHunt: (n) => `+${n} puntos al buscar trabajo`,
    focus: (n) => `+${n} de foco la ronda siguiente`,
    head: ['', 'Objeto', 'Precio', 'Mantenimiento', 'Estatus', 'Reventa', 'Sirve para', 'Notas'],
    perYear: (amount) => `${amount}/año`,
    resaleValue: (start, drift) => `${start}, ${drift} por ronda`,
    membership: 'Cuota mientras lo tengas',
    experience: (years) => `El estatus dura ${years} años`,
    cardOnly: 'Solo lo da una carta',
    onlyIn: (cities) => `Solo en ${cities.join(', ')}; se pierde al mudarse`,
  },
  properties: {
    about: (city) => `El precio es un porcentaje del piso de referencia de cada ciudad. Como ejemplo va el precio en ${city}.`,
    estates: (min, pct, counted) => `El estatus de la vivienda es el de la casa en la que vives. Además, las viviendas de lujo que tengas sin vivir en ellas (desde +${min}), alquiladas o en otra ciudad, dan un ${pct} del suyo: las ${counted} mejores.`,
    head: (city) => ['', 'Inmueble', 'Precio', `En ${city}`, 'Estatus si vives en él', 'Uso', 'Alquiler'],
    price: (pct) => `${pct} del piso`,
    rentalOnly: 'Solo para alquilar',
    liveOrLet: 'Para vivir o alquilar',
    rent: (pct) => `${pct} de lo que rinde una vivienda`,
    renting: 'Quien no tiene casa propia vive de alquiler:',
    rentHead: ['', 'Alquiler', 'Gasto de vivienda', 'Estatus'],
    aged: (room, frugal) => `Con los años, la habitación alquilada y el modo de vida austero restan más estatus: ${room.join(', ')} la habitación; ${frugal.join(', ')} el modo austero.`,
    agedStep: (age, status) => `${age} años ${status}`,
  },
  investments: {
    about: (points, levels) => `Finanzas dice qué se puede comprar por cuenta propia. Se mide como cualquier habilidad: cada ronda con dinero invertido da +${points} punto, y los niveles llegan a ${levels} puntos. Un curso o un buen libro sube un nivel, hasta el 2; el 3 solo llega invirtiendo. Una carta puede dar algo de un nivel más alto.`,
    head: ['Inversión', 'Ticker', 'Clase', 'Finanzas', 'Renta', 'Qué es'],
    coupon: 'Cupón según los tipos',
    perYear: (pct) => `${pct} al año`,
  },
  lifestyle: {
    head: ['', 'Modo de vida', 'Coste de vida', 'Estatus'],
    insuranceHead: ['', 'Seguro', 'Prima al año'],
    premium: (pct) => `${pct} del coste de vida de la ciudad`,
    focusHead: ['', 'En qué poner el foco', 'Qué da'],
    overtime: (o) => `Más sueldo esa ronda, según la carrera. Desde ${o.tiredFrom} rondas seguidas, −${o.health} de salud; desde ${o.burnoutFrom}, un ${o.chance} de quemarte: −${o.burnoutHealth} de salud más y −${o.focus} de foco la ronda siguiente`,
    studyCareer: (study, work, perRung) => `+${study} de experiencia, además del +${work} por trabajar; como mucho ${perRung} por puesto, y nada en el último`,
    jobHunt: (j) => `${j.chance} de probabilidad de un +${j.raise} de sueldo para siempre. Tras una subida, ${j.rest} ronda sin buscar; cada búsqueda fallida seguida resta ${j.miss} puntos, hasta un mínimo del ${j.floor}`,
    study: (points, skill) => `+${points} puntos de ${skill}; nada al nivel 3`,
    skills: (levels, study, practice) => `Habilidades: todas, como Finanzas, van del nivel 0 al 3, a ${levels} puntos, cada nivel más caro que el anterior. Se ganan ${study} por ronda estudiando con foco, y ${practice} por ronda viviéndola. Gestión solo se aprende llevando un negocio.`,
    skillsHead: ['', 'Habilidad', 'Por nivel', 'Se practica'],
    negotiation: (hunt, promotion, sale) => `+${hunt} al buscar trabajo, +${promotion} por ascenso, negocio vendido un ${sale} más caro`,
    negotiationPractice: 'Buscando trabajo',
    languages: (move, keepRung, partner) => `Mudanza un ${move} más barata; desde ${keepRung} sin perder puesto; desde ${partner} la pareja trabaja al llegar`,
    languagesPractice: 'Fuera de la ciudad de origen',
    network: (hunt, status) => `+${hunt} puntos al buscar trabajo, +${status} de estatus`,
    networkPractice: 'Socio de un club',
    management: (profit, manager, extra) => `+${profit} de beneficio, encargado ${manager} puntos más barato; desde ${extra} un negocio más`,
    managementPractice: 'Llevando un negocio',
    health: (premium, focus) => `Seguro de salud un ${premium} más barato; desde ${focus} +1 de foco`,
    healthPractice: 'Gimnasio',
    family: (partner, child, years) => `Familia: una pareja añade un ${partner} del coste de vida, y cada hijo un ${child} durante ${years} años.`,
  },
  evasion: {
    about: 'Cada forma de ocultar algo a Hacienda ahorra impuestos esa ronda y suma sospecha. Al jugar cada ronda, la probabilidad de una inspección es la sospecha misma, hasta un tope. Sin ocultar nada, la sospecha baja.',
    head: ['Forma', 'Qué ahorra', 'Sospecha', 'Notas'],
    perRound: (list) => `${list} por ronda`,
    black: ['Sueldo en negro', 'El IRPF de esa parte del sueldo', 'Hace falta trabajo'],
    shell: (cut) => ['Sociedad en un paraíso fiscal', `El ${cut} del impuesto de las inversiones`],
    shellNotes: (skill, fee) => `Finanzas ${skill}; cuota de ${fee} al año`,
    crypto: ['No declarar la cripto', 'El impuesto de las ganancias en cripto', 'Los exchanges informan a Hacienda'],
    cryptoSuspicion: (n, age) => `+${n} por ronda con ganancias; el doble desde los ${age} años`,
    invoice: (discount) => ['Comprar sin factura', `Un ${discount} del precio`],
    invoiceSuspicion: (n) => `+${n} al venderlo`,
    and: ' y ',
    audit: (a) => `La sospecha baja ${a.decay} por ronda sin ocultar nada, y la probabilidad de inspección nunca pasa del ${a.max}. Una inspección cobra lo ocultado en los últimos ${a.years} años más un ${a.fine} de multa y el ${a.goods} del valor de lo comprado sin factura; resta ${a.status} de estatus y lo cancela todo.`,
  },
  cards: {
    about: (n) => `Cada ronda reparte ${n}. La primera opción de cada carta es la que no cuesta ni compra nada.`,
    head: ['', 'Carta', 'Opciones'],
  },
  crises: {
    about: (chance, age) => `Una partida de cada tres, más o menos (${chance}), tiene una crisis: unas rondas seguidas en las que el mundo se sale de su curso. Nunca antes de los ${age} años, y nunca más de una por vida.`,
    how: 'Cada ronda de una crisis cambia primero el mundo en el que se despierta el jugador (economía, tipos, inflación) y luego pesa sobre lo que rinden las inversiones de esa ronda.',
    head: ['Año', 'Qué pasa', 'Al llegar', 'Sobre lo que rinde la ronda'],
    crypto: (phase) => `cripto: ${phase}`,
    rates: 'tipos', inflation: 'inflación', equity: 'bolsa', property: 'vivienda', gold: 'oro', cryptoShift: 'cripto',
  },
  badges: { head: ['', 'Insignia', 'Cómo se consigue'] },
};

const ruWords: Words = {
  title: 'Каталог игры',
  version: (version) => `контент ${version}`,
  intro: (version) => [
    `Всё, что есть в The Rat Race, с картинками и цифрами. Собрано из содержимого и текстов игры (контент ${version}) командой \`pnpm catalog --locale=ru\`: не правь его вручную.`,
    'Цены указаны в долларах на начало жизни; в игре они растут вместе с инфляцией.',
  ],
  toc: {
    head: ['Что', 'Сколько'],
    rules: (n) => `${n} ${ru(n, 'правило', 'правила', 'правил')}`,
    items: (n, cars) => `${n}, из них машин: ${cars}`,
  },
  sections: {
    lives: 'Жизни', challenge: 'Испытание недели', careers: 'Карьеры', business: 'Бизнес', cities: 'Города', items: 'Вещи',
    properties: 'Недвижимость', investments: 'Инвестиции', lifestyle: 'Образ жизни, аренда, страховки и фокус', evasion: 'Мимо налоговой',
    cards: 'Карты', crises: 'Кризисы', badges: 'Значки',
  },
  lives: {
    ages: 'Каждая жизнь нарисована в 22, 32, 45 и 58 лет.',
    portraitAlt: (name, age) => `${name}, ${years(age)}`,
    noJob: 'Без работы',
    debt: (kind, amount, rate) => `${kind}: ${amount} под ${rate}`,
    owned: (home) => `${home} в собственности`,
    holding: (amount, asset) => `${asset}: ${amount}`,
    recurring: (passive, amount) => `${passive ? 'Постоянный доход' : 'Постоянный расход'}: ${amount} в год`,
    startsIn: 'Старт',
    startsInValue: (city, cash) => `${city}, ${cash}`,
    job: 'Работа',
    skills: 'Карьерный навык · Финансовая грамотность · Фокус',
    lifestyle: 'Образ жизни',
    noLower: (tier) => ` (не ниже уровня ${quoted(tier)})`,
    startsWith: 'На старте',
    nothing: 'Больше ничего',
    perk: 'Плюс',
    handicap: 'Минус',
    unlock: 'Чтобы открыть',
  },
  challenge: {
    week: 'Неделя ISO идёт с понедельника по воскресенье по UTC. Неделя задаёт одну жизнь и одно правило для всех; сервер хранит зерно, от которого рынки и карты официальной попытки у всех одинаковы.',
    head: ['', 'Правило', 'Условие'],
  },
  careers: {
    about: 'Зарплата — это процент от средней зарплаты в городе, где ты живёшь. Повышение приходит, когда карьерный навык дорастает до того, что требует следующая должность.',
    overtime: (pct) => `Сверхурочные: +${pct} к зарплате в этом раунде.`,
    focus: (n) => `Оставляет свободное время: +${n} к фокусу каждый раунд.`,
    cycle: (list) => `Зарплата следует за экономикой: ${list}.`,
    fade: (age, pct, max) => `Профессия для молодых: с ${ageAfter(age)} зарплата каждый раунд падает на ${pct}, но не больше чем на ${max} в сумме.`,
    head: ['Должность', 'Зарплата', 'Карьерный навык', 'Статус'],
    salary: (pct) => `${pct} средней зарплаты`,
    movesHead: ['Карьерный шаг', 'На должностях', 'Раунды · отдых', 'Что может выйти'],
    rungs: (from, to) => `${from} — ${to}`,
    skillBonus: (points, skill) => `+${points} ${ru(points, 'пункт', 'пункта', 'пунктов')} к шансу за каждый уровень навыка ${quoted(skill)}`,
  },
  business: {
    about: (b) => `Бизнес приносит доход с капитала, который в нём работает: пока он небольшой — со всего капитала, а когда перерастает то, на что рассчитан, — всё меньше с каждого доллара. Прибыль следует за экономикой, а достаточно плохой раунд приносит убыток. Каждый раунд бизнесу нужна единица фокуса или управляющий; без них он даёт ${b.neglect} прибыли и теряет ${b.decay} капитала. Вести можно до ${b.max} ${ru(b.max, 'бизнеса', 'бизнесов', 'бизнесов')} сразу. Проданный со вкладки, он стоит от ${b.min} до ${b.top} того, что в нём лежит, в зависимости от экономики; больше платит только карта.`,
    head: ['Бизнес', 'Минимальный капитал', 'Доход в год', 'Рассчитан на', 'С экономикой', 'Управляющий', 'Финансовая грамотность'],
    upTo: (pct) => `до ${pct}`,
    ofProfit: (pct) => `${pct} прибыли`,
  },
  cities: {
    about: 'У каждого города есть вид ночью, днём, в бум и в кризис, и своя иконка.',
    moving: (m) => `Переезд стоит ${m.cost} годовых расходов на жизнь в новом городе${m.distance ? `, ещё ${m.distance} за каждые 1${NBSP}000${NBSP}км пути` : ''}, и единицу фокуса; с партнёром — на ${m.partner} больше, и ещё на ${m.child} за каждого ребёнка. Переезд по своей воле опускает на ${m.rungs} ${ru(m.rungs, 'ступень', 'ступени', 'ступеней')} до следующего повышения, а партнёр ${years(m.years)} остаётся без зарплаты. Переезд, который предлагает карта, ничего из этого не стоит.`,
    night: (city) => `${city} ночью`,
    day: (city) => `${city} днём`,
    boom: (city) => `${city} во время бума`,
    crisis: (city) => `${city} во время кризиса`,
    salary: 'Средняя зарплата',
    perYear: (amount) => `${amount} в год`,
    living: 'Расходы на жизнь',
    flat: 'Эталонная квартира',
    rentYield: 'Доход от сдачи недвижимости',
    rentYieldValue: (pct) => `${pct} её стоимости в год`,
    incomeTax: 'Подоходный налог',
    gainsTax: 'Налог на прирост капитала',
    prestige: 'Статус за жизнь здесь',
    pays: 'Где платят больше',
  },
  items: {
    lesser: (pct) => `В одной категории лучшая вещь даёт весь свой статус, а остальные — ${pct} своего.`,
    counted: (ladder, counted, pct) => `${quoted(ladder)}: ${counted === 1 ? 'считается только лучшая' : `считаются только лучшие (${counted}), первая целиком, остальные — ${pct}`}.`,
    rest: (ladder, pct, value) => `${quoted(ladder)}: ${pct === 0 ? 'считается только лучшая, остальные статуса не дают' : `остальные — ${value}`}.`,
    uses: '«Польза» — то, что вещь даёт помимо статуса. Внутри категории считается только лучшее из того, что есть; между категориями всё складывается. С машиной открывается вариант получше в карте с подработкой на себя, а с членством в клубе — в карте о работе на себя.',
    aging: (ladders, floor) => `Вещи из категорий ${ladders.map(quoted).join(' и ')} с годами теряют статус так же, как теряют в цене, пока не останется ${floor} того, что они давали новыми.`,
    resale: '«Перепродажа» — сколько вещь стоит в день покупки относительно своей цены, и как это меняется каждый раунд помимо инфляции.',
    finance: (price, down) => `В рассрочку продаётся то, что служит долго и стоит от ${price}: ${down} первым взносом, остальное — потребительским кредитом в пределах лимита кредитов. Если вещь продать, долг остаётся.`,
    used: 'С рук продаются вещи некоторых категорий, только за наличные. Подержанной вещи уже несколько лет: если её категория стареет, статуса она даёт меньше. В день покупки она стоит тот же процент от уплаченного, что и новая, так что купить и продать в одном раунде никогда не выгодно. Раунд покупки покрывает гарантия; потом каждый раунд может понадобиться ремонт, который оплачивается вместе со счетами раунда.',
    usedHead: ['Категория', 'Цена', 'Возраст, лет', 'Ремонт'],
    usedPrice: (pct) => `${pct} цены новой`,
    usedRepair: (chance, cost) => `${chance} за раунд, ${cost} цены новой`,
    moveCostOff: (pct) => `Переезд на ${pct} дешевле`,
    studySkill: (n) => `+${n} к карьерному навыку при учёбе`,
    salary: (pct) => `+${pct} к зарплате`,
    jobHunt: (n) => `+${n} ${ru(n, 'пункт', 'пункта', 'пунктов')} к поиску работы`,
    focus: (n) => `+${n} к фокусу в следующем раунде`,
    head: ['', 'Вещь', 'Цена', 'Содержание', 'Статус', 'Перепродажа', 'Польза', 'Примечания'],
    perYear: (amount) => `${amount}/год`,
    resaleValue: (start, drift) => `${start}, ${drift} за раунд`,
    membership: 'Взнос, пока членство действует',
    experience: (n) => `Статус держится ${years(n)}`,
    cardOnly: 'Даёт только карта',
    onlyIn: (cities) => `${cities.length === 1 ? `Только в городе ${cities[0]}` : `Только в городах: ${cities.join(', ')}`}; при переезде теряется`,
  },
  properties: {
    about: (city) => `Цена — процент от эталонной квартиры в каждом городе. Для примера дана цена в городе ${city}.`,
    estates: (min, pct, counted) => `Статус жилья — это статус дома, в котором ты живёшь. Кроме того, роскошное жильё (от +${min}), в котором ты не живёшь, сданное или в другом городе, даёт ${pct} своего статуса: считаются лучшие (${counted}).`,
    head: (city) => ['', 'Объект', 'Цена', city, 'Статус, если жить в нём', 'Назначение', 'Аренда'],
    price: (pct) => `${pct} эталонной квартиры`,
    rentalOnly: 'Только сдавать',
    liveOrLet: 'Жить или сдавать',
    rent: (pct) => `${pct} дохода от сдачи жилья`,
    renting: 'Без своего жилья приходится снимать:',
    rentHead: ['', 'Аренда', 'Расходы на жильё', 'Статус'],
    aged: (room, frugal, names) => `С годами ${quoted(names.room.toLowerCase())} и образ жизни ${quoted(names.frugal)} отнимают больше статуса. Комната: ${room.join(', ')}. ${names.frugal}: ${frugal.join(', ')}.`,
    agedStep: (age, status) => `${status} с ${ageAfter(age)}`,
  },
  investments: {
    about: (points, levels) => `Финансовая грамотность решает, что можно покупать самостоятельно. Она растёт как любой навык: каждый раунд с вложенными деньгами даёт +${points} ${ru(points, 'балл', 'балла', 'баллов')}, а уровни наступают на ${levels} баллах. Курс или хорошая книга поднимают на уровень, до 2-го; 3-й приходит только с инвестициями. Карта может дать то, что требует уровня выше.`,
    head: ['Актив', 'Тикер', 'Класс', 'Финансовая грамотность', 'Доход', 'Что это'],
    coupon: 'Купон зависит от ставок',
    perYear: (pct) => `${pct} в год`,
  },
  lifestyle: {
    head: ['', 'Образ жизни', 'Расходы на жизнь', 'Статус'],
    insuranceHead: ['', 'Страховка', 'Взнос в год'],
    premium: (pct) => `${pct} расходов на жизнь в городе`,
    focusHead: ['', 'На что тратить фокус', 'Что даёт'],
    overtime: (o) => `Больше зарплаты в этом раунде, в зависимости от карьеры. С ${o.tiredFrom}-го раунда подряд — −${o.health} к здоровью; с ${o.burnoutFrom}-го — шанс выгорания ${o.chance}: ещё −${o.burnoutHealth} к здоровью и −${o.focus} к фокусу в следующем раунде`,
    studyCareer: (study, work, perRung) => `+${study} к карьерному навыку сверх +${work} за работу; не больше ${perRung} на одной должности и ничего на последней`,
    jobHunt: (j) => `Шанс ${j.chance} на прибавку +${j.raise} к зарплате навсегда. После прибавки — ${j.rest} ${ru(j.rest, 'раунд', 'раунда', 'раундов')} без поиска; каждый неудачный поиск подряд отнимает ${j.miss} ${ru(j.miss, 'пункт', 'пункта', 'пунктов')}, но шанс не падает ниже ${j.floor}`,
    study: (points, skill) => `+${points} ${ru(points, 'балл', 'балла', 'баллов')} к навыку ${quoted(skill)}; на 3-м уровне ничего`,
    skills: (levels, study, practice, management) => `Навыки: все они, как и финансовая грамотность, идут от уровня 0 до 3, на ${levels} баллах, и каждый уровень дороже предыдущего. Раунд учёбы с фокусом даёт ${study} ${ru(study, 'балл', 'балла', 'баллов')}, раунд практики — ${practice}. Навык ${quoted(management)} растёт только от ведения бизнеса.`,
    skillsHead: ['', 'Навык', 'За уровень', 'Практика'],
    negotiation: (hunt, promotion, sale) => `+${hunt} при поиске работы, +${promotion} за повышение, бизнес продаётся на ${sale} дороже`,
    negotiationPractice: 'Поиск работы',
    languages: (move, keepRung, partner) => `Переезд на ${move} дешевле; с уровня ${keepRung} — без потери ступени; с уровня ${partner} партнёр работает сразу по приезде`,
    languagesPractice: 'Жизнь вне родного города',
    network: (hunt, status) => `+${hunt} ${ru(hunt, 'пункт', 'пункта', 'пунктов')} к поиску работы, +${status} к статусу`,
    networkPractice: 'Членство в клубе',
    management: (profit, manager, extra) => `+${profit} к прибыли, управляющий на ${manager} ${ru(manager, 'пункт', 'пункта', 'пунктов')} дешевле; с уровня ${extra} — ещё один бизнес`,
    managementPractice: 'Ведение бизнеса',
    health: (premium, focus) => `Медицинская страховка на ${premium} дешевле; с уровня ${focus} — +1 к фокусу`,
    healthPractice: 'Спортзал',
    family: (partner, child, n) => `Семья: партнёр добавляет ${partner} к расходам на жизнь, а каждый ребёнок — ${child} на ${years(n)}.`,
  },
  evasion: {
    about: 'Каждый способ что-то скрыть от налоговой экономит налоги в этом раунде и добавляет подозрений. В каждом раунде шанс проверки равен самому подозрению, до потолка. Если ничего не скрывать, подозрение снижается.',
    head: ['Способ', 'Что экономит', 'Подозрение', 'Примечания'],
    perRound: (list) => `${list} за раунд`,
    black: ['Зарплата в конверте', 'Подоходный налог с этой части зарплаты', 'Нужна работа'],
    shell: (cut) => ['Офшорная компания', `${cut} налога на инвестиции`],
    shellNotes: (skill, fee) => `Финансовая грамотность ${skill}; плата ${fee} в год`,
    crypto: ['Скрыть крипту', 'Налог с прибыли от крипты', 'Биржи сообщают в налоговую'],
    cryptoSuspicion: (n, age) => `+${n} за раунд с прибылью; вдвое больше с ${ageAfter(age)}`,
    invoice: (discount) => ['Покупка без чека', `${discount} цены`],
    invoiceSuspicion: (n) => `+${n} при продаже`,
    and: ' и ',
    audit: (a) => `Подозрение снижается на ${a.decay} за каждый раунд без сокрытия, а шанс проверки никогда не выше ${a.max}. Проверка взыскивает скрытое за последние ${years(a.years)}, штраф ${a.fine} и ${a.goods} стоимости купленного без чека; она даёт −${a.status} к статусу и закрывает все схемы.`,
  },
  cards: {
    about: (n) => `Каждый раунд раздаётся ${n} ${ru(n, 'карта', 'карты', 'карт')}. Первый вариант каждой карты ничего не стоит и ничего не покупает.`,
    head: ['', 'Карта', 'Варианты'],
  },
  crises: {
    about: (chance, age) => `Примерно в одной жизни из трёх (${chance}) случается кризис: несколько раундов подряд мир сходит с привычного курса. Никогда до ${ageAfter(age)} и не больше одного за жизнь.`,
    how: 'Каждый раунд кризиса сначала меняет мир, в котором просыпается игрок (экономику, ставки, инфляцию), а затем давит на доходность инвестиций в этом раунде.',
    head: ['Год', 'Что происходит', 'В начале раунда', 'На доходность раунда'],
    crypto: (phase) => `крипта: ${phase}`,
    rates: 'ставки', inflation: 'инфляция', equity: 'акции', property: 'жильё', gold: 'золото', cryptoShift: 'крипта',
  },
  badges: { head: ['', 'Значок', 'Как получить'] },
};

export const WORDS: Record<CatalogLocale, Words> = { es, ru: ruWords };
