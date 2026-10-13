import type { Locale } from '@ratrace/content';
import type { Problem } from './parse';

/** The terminal's own labels and prompts. Everything about the game itself comes from the content package. */
export interface Ui {
  title: string;
  tagline: string;
  chooseLife: string;
  lifePrompt: (count: number) => string;
  age: string;
  round: (n: number, of: number) => string;
  seed: string;
  news: string;
  lastNews: (held: number, total: number) => string;
  rates: string;
  inflation: string;
  economy: string;
  crypto: string;
  you: string;
  cash: string;
  savings: string;
  pension: string;
  netWorth: string;
  status: string;
  salary: string;
  passive: string;
  expenses: string;
  perYear: string;
  focus: string;
  careerSkill: string;
  financeSkill: string;
  noJob: string;
  lifestyle: string;
  home: string;
  partner: string;
  children: (n: number) => string;
  insured: string;
  movingTo: string;
  card: (n: number, of: number) => string;
  worldCard: string;
  locked: string;
  pick: (count: number) => string;
  youChose: string;
  nothing: string;
  finance: string;
  financeHint: string;
  prompt: string;
  added: string;
  removed: string;
  nothingToUndo: string;
  refused: string;
  cashAfterRound: string;
  problems: Record<Problem, string>;
  resolve: string;
  promoted: string;
  jobHunt: [yes: string, no: string];
  financeSkillUp: string;
  moved: string;
  lapsed: string;
  escaped: string;
  escapeLost: string;
  bankrupt: string;
  theEnd: string;
  score: string;
  wealthPoints: string;
  statusPoints: string;
  /** Says that the status counted is the average over the life. */
  statusNote: string;
  escapeBonus: string;
  neverEscaped: string;
  escapedAtAge: string;
  realNetWorth: string;
  replay: string;
  goodbye: string;
  headers: {
    market: string; portfolio: string; shop: string; tax: string; cities: string; homes: string; orders: string; help: string; debts: string; properties: string; items: string;
  };
  columns: {
    asset: string; change: string; yield: string; held: string; price: string; upkeep: string; owned: string; needsSkill: string;
    medianSalary: string; living: string; moveCost: string; incomeTax: string; gainsTax: string; down: string; rent: string; rented: string; livedIn: string;
    value: string; gain: string; owed: string; rate: string; roundsLeft: string; cashNeeded: string; cardOnly: string;
  };
  taxLines: { income: string; investment: string; property: string; purchase: string; total: string; escape: string; escapeYes: string; escapeNo: string };
  noOrders: string;
  empty: string;
  help: string[];
  /** Short phrases that describe what a card option does. */
  effects: {
    salaryMod: string; salaryBoost: string; careerSkill: string; financeSkill: string; status: string; focus: string;
    yearly: (amount: string, years: number | null) => string;
    leaveJob: string; newCareer: string; promotion: string; demotion: string; moveTo: string; partnerIn: string; partnerOut: string;
    child: (n: number) => string; get: string; invest: (amount: string, asset: string) => string; pension: string; loan: string;
    buyHome: string; toRentOut: string; refinance: [fixed: string, variable: string]; sellHome: string; homeValue: string;
    lose: (pct: number, what: string) => string; savingsWord: string; lifestyleFloor: string;
  };
}

const en: Ui = {
  title: 'THE RAT RACE',
  tagline: 'Forty years, twenty rounds. Get rich, get status, get out.',
  chooseLife: 'Choose a life',
  lifePrompt: (count) => `Life (1-${count}) > `,
  age: 'Age',
  round: (n, of) => `Round ${n} of ${of}`,
  seed: 'seed',
  news: 'NEWS',
  lastNews: (held, total) => `Of last round's ${total} headlines, ${held} came true.`,
  rates: 'Rates',
  inflation: 'Inflation',
  economy: 'Economy',
  crypto: 'Crypto',
  you: 'YOU',
  cash: 'Cash',
  savings: 'Savings',
  pension: 'Pension',
  netWorth: 'Net worth',
  status: 'Status',
  salary: 'Salary',
  passive: 'Passive income',
  expenses: 'Expenses',
  perYear: '/yr',
  focus: 'Focus',
  careerSkill: 'Career skill',
  financeSkill: 'Finance skill',
  noJob: 'No job',
  lifestyle: 'Lifestyle',
  home: 'Home',
  partner: 'Partner',
  children: (n) => (n === 1 ? '1 child' : `${n} children`),
  insured: 'Insured',
  movingTo: 'Moving to',
  card: (n, of) => `CARD ${n} of ${of}`,
  worldCard: 'world event',
  locked: 'locked',
  pick: (count) => `Your choice (1-${count}, Enter for 1) > `,
  youChose: 'You chose',
  nothing: 'nothing happens',
  finance: 'FINANCE',
  financeHint: "Type an order, 'help' for the list, 'done' to play the round.",
  prompt: '> ',
  added: 'added',
  removed: 'removed',
  nothingToUndo: 'There is nothing to undo.',
  refused: 'Refused',
  cashAfterRound: 'cash after the round',
  problems: {
    'unknown-command': "I do not know that command. Type 'help'.",
    'missing-words': 'That command needs more words.',
    'bad-amount': 'I need an amount above zero.',
    'unknown-asset': "No such asset. Type 'market' to see them.",
    'unknown-item': "No such item. Type 'shop' to see them.",
    'unknown-city': "No such city. Type 'cities' to see them.",
    'unknown-home': "No such kind of home. Type 'homes' to see them.",
    'unknown-number': "No such number. Type 'me' to see your list.",
    'unknown-insurance': 'The insurances are: health, home, life, liability.',
    'needs-on-off': "Say 'on' or 'off'.",
    'bad-tier': 'The lifestyles are 0 to 3.',
  },
  resolve: 'RESOLVE',
  promoted: 'Promoted',
  jobHunt: ['The job hunt paid off: a lasting raise.', 'The job hunt led nowhere this time.'],
  financeSkillUp: 'Experience pays: your finance skill is now',
  moved: 'You moved to',
  lapsed: 'Left behind with the move:',
  escaped: 'You are out of the rat race. Your passive income covers your life.',
  escapeLost: 'Back in the rat race: your passive income no longer covers your life.',
  bankrupt: 'Bankrupt. Everything is sold and every debt is cleared.',
  theEnd: 'THE END',
  score: 'Score',
  wealthPoints: 'Wealth',
  statusPoints: 'Status',
  statusNote: 'Status counts as you lived it: the average over all twenty rounds.',
  escapeBonus: 'Escape bonus',
  neverEscaped: 'You never left the rat race.',
  escapedAtAge: 'You left the rat race at',
  realNetWorth: 'Net worth after inflation',
  replay: 'To play this life again',
  goodbye: 'See you next life.',
  headers: {
    market: 'MARKET', portfolio: 'PORTFOLIO', shop: 'SHOP', tax: 'THIS ROUND', cities: 'CITIES', homes: 'HOMES', orders: 'YOUR ORDERS', help: 'COMMANDS',
    debts: 'Debts', properties: 'Properties', items: 'Things',
  },
  columns: {
    asset: 'asset', change: 'last round', yield: 'yield', held: 'you hold', price: 'price', upkeep: 'upkeep', owned: 'owned', needsSkill: 'needs finance skill',
    medianSalary: 'median salary', living: 'living cost', moveCost: 'to move there', incomeTax: 'income tax', gainsTax: 'gains', down: 'smallest down payment',
    rent: 'rent', rented: 'rented out', livedIn: 'lived in', value: 'value', gain: 'gain', owed: 'owed', rate: 'rate', roundsLeft: 'rounds left',
    cashNeeded: 'cash needed', cardOnly: 'by card only',
  },
  taxLines: {
    income: 'Income tax', investment: 'Tax on investments', property: 'Property tax', purchase: 'Purchase tax paid', total: 'Tax this round',
    escape: 'Escape test: passive income after tax against expenses', escapeYes: 'covered', escapeNo: 'not yet',
  },
  noOrders: 'No orders yet.',
  empty: 'nothing',
  help: [
    'buy <asset> <amount>        sell <asset> <amount|all>',
    'save <amount>               withdraw <amount|all>',
    'pension <amount>            borrow <amount>          repay <n> <amount|all>',
    'home <type> [down%] [fixed|variable|cash] [rent]',
    'sellhome <n>                rent <n> on|off',
    'get <item>                  drop <item>',
    'lifestyle <0-3>             room | flat              insure <kind> [on|off]',
    'overtime | study | hunt     move <city>',
    'Screens: me, news, market, port, shop, homes, cities, tax, orders',
    'undo removes the last order. done plays the round. quit leaves the game.',
    'Amounts: 5000, 5,000, 5k, 1.5m, 50%, all.',
  ],
  effects: {
    salaryMod: 'salary for good', salaryBoost: 'pay this round', careerSkill: 'career skill', financeSkill: 'finance skill', status: 'status', focus: 'focus',
    yearly: (amount, years) => `${amount}/yr${years === null ? '' : ` for ${years} years`}`,
    leaveJob: 'you stop working', newCareer: 'new career:', promotion: 'a step up', demotion: 'a step down', moveTo: 'you move to',
    partnerIn: 'you share your life and your bills', partnerOut: 'you separate',
    child: (n) => (n === 1 ? 'a child' : `${n} children`), get: 'you get', invest: (amount, asset) => `${amount} into ${asset}`, pension: 'into your pension',
    loan: 'loan of', buyHome: 'you buy:', toRentOut: 'to rent out', refinance: ['mortgage becomes fixed', 'mortgage becomes variable'],
    sellHome: 'you sell your home', homeValue: 'home value', lose: (pct, what) => `you lose ${pct}% of your ${what}`, savingsWord: 'savings',
    lifestyleFloor: 'lifestyle at least',
  },
};

const es: Ui = {
  title: 'THE RAT RACE',
  tagline: 'Cuarenta años, veinte rondas. Hazte rico, gana estatus y sal de la rueda.',
  chooseLife: 'Elige una vida',
  lifePrompt: (count) => `Vida (1-${count}) > `,
  age: 'Edad',
  round: (n, of) => `Ronda ${n} de ${of}`,
  seed: 'semilla',
  news: 'NOTICIAS',
  lastNews: (held, total) => `De los ${total} titulares de la ronda pasada, se cumplieron ${held}.`,
  rates: 'Tipos',
  inflation: 'Inflación',
  economy: 'Economía',
  crypto: 'Cripto',
  you: 'TÚ',
  cash: 'Efectivo',
  savings: 'Ahorro',
  pension: 'Pensión',
  netWorth: 'Patrimonio',
  status: 'Estatus',
  salary: 'Sueldo',
  passive: 'Ingresos pasivos',
  expenses: 'Gastos',
  perYear: '/año',
  focus: 'Foco',
  careerSkill: 'Experiencia',
  financeSkill: 'Finanzas',
  noJob: 'Sin trabajo',
  lifestyle: 'Estilo de vida',
  home: 'Casa',
  partner: 'Pareja',
  children: (n) => (n === 1 ? '1 hijo' : `${n} hijos`),
  insured: 'Seguros',
  movingTo: 'Mudanza a',
  card: (n, of) => `CARTA ${n} de ${of}`,
  worldCard: 'suceso mundial',
  locked: 'bloqueada',
  pick: (count) => `Tu elección (1-${count}, Intro para 1) > `,
  youChose: 'Elegiste',
  nothing: 'no pasa nada',
  finance: 'FINANZAS',
  financeHint: "Escribe una orden, 'ayuda' para ver la lista, 'listo' para jugar la ronda.",
  prompt: '> ',
  added: 'añadida',
  removed: 'quitada',
  nothingToUndo: 'No hay nada que deshacer.',
  refused: 'Rechazada',
  cashAfterRound: 'efectivo tras la ronda',
  problems: {
    'unknown-command': "No conozco esa orden. Escribe 'ayuda'.",
    'missing-words': 'A esa orden le faltan palabras.',
    'bad-amount': 'Necesito un importe mayor que cero.',
    'unknown-asset': "Ese activo no existe. Escribe 'mercado' para verlos.",
    'unknown-item': "Ese artículo no existe. Escribe 'tienda' para verlos.",
    'unknown-city': "Esa ciudad no existe. Escribe 'ciudades' para verlas.",
    'unknown-home': "Ese tipo de casa no existe. Escribe 'casas' para verlos.",
    'unknown-number': "Ese número no existe. Escribe 'yo' para ver tu lista.",
    'unknown-insurance': 'Los seguros son: salud, hogar, vida, civil.',
    'needs-on-off': "Di 'si' o 'no'.",
    'bad-tier': 'Los estilos de vida van de 0 a 3.',
  },
  resolve: 'RESULTADO',
  promoted: 'Ascenso',
  jobHunt: ['La búsqueda dio fruto: una subida para siempre.', 'Esta vez la búsqueda no llevó a nada.'],
  financeSkillUp: 'La experiencia cuenta: tu nivel de finanzas es ahora',
  moved: 'Te has mudado a',
  lapsed: 'Se queda atrás con la mudanza:',
  escaped: 'Has salido de la rueda. Tus ingresos pasivos pagan tu vida.',
  escapeLost: 'De vuelta a la rueda: tus ingresos pasivos ya no pagan tu vida.',
  bankrupt: 'Quiebra. Se vende todo y se cancelan todas las deudas.',
  theEnd: 'FIN',
  score: 'Puntuación',
  wealthPoints: 'Riqueza',
  statusPoints: 'Estatus',
  statusNote: 'El estatus cuenta como lo viviste: la media de las veinte rondas.',
  escapeBonus: 'Bonus por salir',
  neverEscaped: 'Nunca saliste de la rueda.',
  escapedAtAge: 'Saliste de la rueda a los',
  realNetWorth: 'Patrimonio descontando la inflación',
  replay: 'Para volver a jugar esta vida',
  goodbye: 'Hasta la próxima vida.',
  headers: {
    market: 'MERCADO', portfolio: 'CARTERA', shop: 'TIENDA', tax: 'ESTA RONDA', cities: 'CIUDADES', homes: 'CASAS', orders: 'TUS ÓRDENES', help: 'ÓRDENES',
    debts: 'Deudas', properties: 'Viviendas', items: 'Cosas',
  },
  columns: {
    asset: 'activo', change: 'última ronda', yield: 'rendimiento', held: 'tienes', price: 'precio', upkeep: 'mantenimiento', owned: 'tuyo', needsSkill: 'pide nivel de finanzas',
    medianSalary: 'sueldo medio', living: 'coste de vida', moveCost: 'mudarte allí', incomeTax: 'impuesto sobre la renta', gainsTax: 'ganancias', down: 'entrada mínima',
    rent: 'alquiler', rented: 'en alquiler', livedIn: 'tu hogar', value: 'valor', gain: 'ganancia', owed: 'debes', rate: 'tipo', roundsLeft: 'rondas',
    cashNeeded: 'efectivo necesario', cardOnly: 'solo por carta',
  },
  taxLines: {
    income: 'Impuesto sobre la renta', investment: 'Impuestos sobre inversiones', property: 'Impuesto sobre la vivienda', purchase: 'Impuesto de compra pagado',
    total: 'Impuestos de esta ronda', escape: 'Prueba de salida: ingresos pasivos tras impuestos frente a gastos', escapeYes: 'cubiertos', escapeNo: 'todavía no',
  },
  noOrders: 'Aún no hay órdenes.',
  empty: 'nada',
  help: [
    'comprar <activo> <importe>  vender <activo> <importe|todo>',
    'ahorrar <importe>           retirar <importe|todo>',
    'pension <importe>           pedir <importe>          pagar <n> <importe|todo>',
    'casa <tipo> [entrada%] [fija|variable|contado] [alquilar]',
    'vendercasa <n>              alquilar <n> si|no',
    'adquirir <artículo>         soltar <artículo>',
    'vida <0-3>                  habitacion | piso        seguro <tipo> [si|no]',
    'extras | estudiar | buscar  mudar <ciudad>',
    'Pantallas: yo, noticias, mercado, cartera, tienda, casas, ciudades, impuestos, ordenes',
    'deshacer quita la última orden. listo juega la ronda. salir deja la partida.',
    'Importes: 5000, 5.000, 5k, 1,5m, 50%, todo.',
  ],
  effects: {
    salaryMod: 'de sueldo para siempre', salaryBoost: 'de sueldo esta ronda', careerSkill: 'de experiencia', financeSkill: 'de finanzas', status: 'de estatus', focus: 'de foco',
    yearly: (amount, years) => `${amount}/año${years === null ? '' : ` durante ${years} años`}`,
    leaveJob: 'dejas de trabajar', newCareer: 'nueva carrera:', promotion: 'un ascenso', demotion: 'un paso atrás', moveTo: 'te mudas a',
    partnerIn: 'compartes tu vida y tus facturas', partnerOut: 'os separáis',
    child: (n) => (n === 1 ? 'un hijo' : `${n} hijos`), get: 'te llevas', invest: (amount, asset) => `${amount} en ${asset}`, pension: 'a tu plan de pensiones',
    loan: 'préstamo de', buyHome: 'compras:', toRentOut: 'para alquilar', refinance: ['la hipoteca pasa a fija', 'la hipoteca pasa a variable'],
    sellHome: 'vendes tu casa', homeValue: 'valor de tu casa', lose: (pct, what) => `pierdes el ${pct} % de tu ${what}`, savingsWord: 'ahorro',
    lifestyleFloor: 'estilo de vida mínimo:',
  },
};

export const ui: Record<Locale, Ui> = { en, es };
