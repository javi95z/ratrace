import { c } from './types';
import type { CardText } from './types';

const lotteryResults = [
  'Nada. Como siempre.',
  'Te devuelven lo jugado. Sabe a premio.',
  'Un premio pequeño. La cena la pagas tú.',
  'Un premio de verdad. Compruebas el número tres veces.',
  'Uno gordo. Te tiemblan las manos.',
  'El Gordo. Te sientas en el suelo de la cocina.',
];

export const cards: Record<string, CardText> = {
  // Carrera
  career_raise: c('Pedir un aumento', 'La semana que viene tienes la evaluación y el alquiler te ha subido dos veces desde la última.', [
    'No decir nada',
    ['Pedirlo', 'Dicen que sí, y antes de lo que esperabas.', 'Una sonrisa amable y un «este año no».', 'Cae mal. La gente lo ha notado.'],
    ['Preparar bien los argumentos', 'Cifras sobre la mesa. Firman.', 'Buenos argumentos, presupuesto congelado.'],
    ['Negociarlo en serio', 'Sabías tu cifra y la consigues.', 'No entera. Más de lo que pensaban darte.'],
  ]),
  career_competitor_offer: c('Llama la competencia', 'La empresa rival te quiere, y ofrece más.', [
    'Ser leal',
    'Aceptar el puesto',
    ['Enseñársela a tu jefe', 'A mediodía llega la contraoferta.', 'Tu jefe te desea suerte. Te quedas, y la incomodidad se nota.', 'Ahora eres «riesgo de fuga». El bonus se olvida de ti.'],
  ]),
  career_relocation: c('Un ascenso con letra pequeña', 'El ascenso es tuyo. La mesa está en {city:london}.', [
    'Rechazarlo',
    'Hacer las maletas',
  ]),
  career_transfer_east: c('Una oficina en el este', 'La empresa abre mesas en {city:tokyo} y {city:moscow}, y busca a alguien que conozca el trabajo.', [
    'Quedarte donde estás',
    'Irte a {city:tokyo}',
    'Irte a {city:moscow}',
  ]),
  career_transfer_west: c('Una oficina en el oeste', 'Dos plazas, con todo pagado: una en {city:mexico_city} y otra en {city:zurich}.', [
    'Quedarte donde estás',
    'Irte a {city:mexico_city}',
    'Irte a {city:zurich}',
  ]),
  career_overtime_crunch: c('Semanas de entrega', 'Han adelantado la fecha. Alguien tiene que quedarse hasta tarde un mes.', [
    ['Hacer lo justo', 'Nadie se da cuenta.', 'Alguien se ha dado cuenta.'],
    'Echar horas',
  ]),
  career_layoff: c('Una ronda de despidos', 'En tu calendario aparece una reunión general sin orden del día.', [
    'Aceptar la indemnización',
    ['Pelear por tu puesto', 'Sobrevives al recorte.', 'Te vas igualmente, y con menos en el sobre.'],
    'Formarte mientras buscas',
  ]),
  career_toxic_boss: c('El jefe nuevo', 'Correos a medianoche. Elogios en privado, broncas en público.', [
    'Aguantar',
    ['Denunciarlo a Recursos Humanos', 'Recursos Humanos actúa. Te dan las gracias en el pasillo.', 'Se ponen de parte del jefe. Tu próxima subida se evapora.'],
    'Cambiar de equipo',
  ]),
  career_switch: c('Otra escalera', 'Un amigo que trabaja en banca dice que buscan gente con «experiencia del mundo real».', [
    'Quedarte donde estás',
    'Empezar desde abajo en finanzas',
    ['Pagar un curso y presentarte', 'Te hacen la oferta.', 'Cuarenta candidaturas, ninguna oferta.'],
  ]),
  career_big_offer: c('El gran nombre', '{brand:google}, {brand:inditex} o {brand:goldman_sachs}: quien manda en tu sector quiere hablar contigo.', [
    'Quedarte',
    'Aceptar la oferta',
    ['Negociar fuerte', 'Aceptan tu cifra.', 'Retiran la oferta.'],
  ]),
  career_shares_vs_salary: c('Acciones o sueldo', 'Tu subida puede llegar en efectivo cada mes o en acciones que se liberan en dos años.', [
    'Coger el efectivo',
    ['Coger las acciones', 'La empresa se dispara. Tú también.', 'Un resultado decente. Más o menos lo que habría valido la subida.', 'Las acciones se liberan valiendo menos.'],
  ]),
  career_remote_work: c('Teletrabajo aprobado', 'Puedes trabajar desde casa para siempre, si quieres.', [
    'Seguir yendo a la oficina',
    'Pasarte al teletrabajo',
    ['Pedir a cambio un aumento', 'Prefieren pagarte a quedarse sin la mesa.', 'No.'],
  ]),
  career_boss_leaves: c('Tu jefe se va', 'Tu jefe se marcha a la competencia y te quiere en su equipo. Promete más sueldo.', [
    'Quedarte',
    ['Irte con él', 'La nueva empresa va como un tiro. Y tú con ella.', 'A los seis meses lo echan a él. Y tú te quedas sin padrino.'],
    ['Usar la oferta para negociar', 'Tu empresa no quiere perderte y te sube el sueldo.', 'Te dicen que la puerta está abierta. Para salir.'],
  ]),
  career_become_manager: c('Dirigir el equipo', 'Tu responsable se va y ha propuesto tu nombre.', [
    'Seguir en lo técnico',
    'Aceptar el equipo',
  ]),
  career_law_firm: c('El bufete busca pasantes', 'Un despacho contrata pasantes. Las horas son largas y la escalera, la más alta de la ciudad.', [
    'Quedarte donde estás',
    'Empezar desde abajo en derecho',
    ['Pagar el curso de acceso', 'Apruebas. El despacho llama el lunes.', 'Suspendes el examen por cuatro puntos.'],
  ]),
  career_market: c('Sábado en el mercado', 'Un puesto necesita quien venda. Nadie pide currículum.', [
    'Seguir andando',
    'Vender en el puesto',
  ]),
  career_bar: c('Se necesita personal', 'El bar de la esquina no da abasto, y el bote de propinas está lleno.', [
    'Pasar de largo',
    'Ponerte el delantal',
  ]),
  career_teaching: c('Buscan profesor', 'El colegio del barrio se ha quedado sin profesor a mitad de curso. Tu título vale.', [
    'No es lo tuyo',
    'Coger la plaza',
  ]),
  career_creator: c('El vídeo que se compartió', 'Lo grabaste en tu habitación y lo han visto cien mil personas. Te escriben marcas.', [
    'Seguir con tu trabajo',
    'Dedicarte a esto',
  ]),
  career_out_of_town: c('Una oferta a cuarenta minutos', 'Una empresa del polígono paga mejor. No hay tren: habría que ir en coche.', [
    'Quedarte donde estás',
    'Aceptarla',
    ['Pedir más', 'Aceptan.', 'Contratan a otra persona.'],
  ]),
  career_headhunter: c('Llama un cazatalentos', '«¿Tienes un rato para un café confidencial?»', [
    'No me interesa',
    ['Ir a la reunión', 'Mejores condiciones en una empresa mejor.', 'Un café agradable y nada más.'],
    'Aceptar el puesto en {city:new_york}',
  ]),

  // Formación
  edu_masters: c('Un máster', 'Dos años de tardes y fines de semana, y un título en el currículum.', [
    'Ahora no',
    'Pagarlo',
    'Pedir un préstamo para pagarlo',
  ]),
  edu_finance_course: c('Un curso de inversión', 'Doce semanas, una tarde cada una: bonos, acciones y cómo no perderlo todo.', [
    'Pasar',
    'Apuntarte',
  ]),
  edu_finance_book: c('Un libro sobre dinero', 'Una compañera te presta el libro que «le cambió la forma de pensar en el dinero».', [
    'Dejarlo en la estantería',
    ['Leerlo', 'Hace clic. Ya entiendes qué es un bono.', 'Te duermes en la página cuarenta.'],
  ]),
  edu_mba: c('El MBA', 'Tienes plaza en el {item:edu_mba}. Cuesta una fortuna y se come dos años de tardes.', [
    'No es para mí',
    'Matricularte y pagar',
    'Matricularte con un préstamo',
  ]),
  edu_bootcamp: c('Bootcamp de programación', 'Dieciséis semanas para ser programador júnior. Dicen que todos encuentran trabajo.', [
    'Pasar',
    'Apuntarte y pasarte a tecnología',
  ]),
  edu_language: c('Un idioma nuevo', 'Una profesora da clases por las tardes a dos calles de casa.', [
    'Quizá el año que viene',
    'Apuntarte',
  ]),

  // Negocios
  biz_freelance_gig: c('Un encargo por tu cuenta', 'Un antiguo cliente necesita un trabajo que te ocupará tres fines de semana.', [
    'Pasar',
    'Aceptarlo',
    'Aceptarlo, y el de su otra sede en coche',
  ]),
  biz_self_employed: c('Trabajar por tu cuenta', 'Podrías hacer tu trabajo para tres clientes en vez de para un jefe.', [
    'Seguir con la nómina',
    ['Darte de alta por tu cuenta', 'Los clientes hacen cola. Subes tus tarifas.', 'Sale más o menos igual, con más papeleo.', 'Dos clientes pagan tarde y uno no paga.'],
    ['Empezar con gente de donde eres socio', 'Te recomiendan unos a otros. Subes tus tarifas.', 'Sale más o menos igual, con más papeleo.', 'Mucha palmada en la espalda y pocos encargos.'],
  ]),
  biz_bar: c('Un bar propio', 'Se traspasa el bar de la esquina. El dueño quiere dejarlo antes de primavera.', [
    'Pasar de largo',
    ['Comprarlo y llevarlo', 'Lleno todos los fines de semana. Te da un buen dinero.', 'Va tirando. Poco dinero y muchas noches.', 'Cierra antes de un año.'],
    ['Poner dinero para que lo lleve un amigo', 'Tu parte te deja un cheque modesto cada año.', 'Nunca llega a abrir.'],
  ]),
  biz_online_shop: c('Una tienda online', 'Has encontrado un producto por el que la gente no deja de preguntar.', [
    'Dejarlo',
    ['Lanzarla', 'Llueven los pedidos.', 'Un ingreso extra, casi todos los meses.', 'Un garaje lleno de género sin vender.'],
  ]),
  biz_airbnb: c('La habitación que sobra', 'Esa habitación podría ganarse el sueldo en {brand:airbnb}.', [
    'Conservar tu intimidad',
    'Anunciarla',
  ]),
  biz_app: c('Lanzar una app', 'Llevas un año con la idea. Te costaría todas las noches de seis meses.', [
    'Dejarla en el cajón',
    ['Hacerla', 'Despega. Empiezan a entrar suscripciones.', 'Unos pocos usuarios fieles pagan el servidor y algo más.', 'No la descarga nadie. Aprendiste mucho.'],
  ]),
  biz_cofounder: c('La propuesta del socio', 'Un excompañero brillante monta una empresa y te quiere dentro.', [
    'Desearle suerte',
    ['Poner dinero', 'La compran. Tu parte se multiplica por nueve.', 'Una venta modesta. Recuperas lo puesto y algo más.', 'La empresa cierra.'],
    ['Entrar en el equipo fundador', 'La compran. Dinero que te cambia la vida.', 'Una venta pequeña y una historia muy buena.', 'Cierra. Sales con más experiencia.'],
  ]),
  biz_acquisition: c('Una oferta por el negocio', 'Una empresa más grande quiere comprarte. La cifra va en serio.', [
    'Quedarte con el negocio',
    'Vender',
    ['Pedir más', 'Lo pagan.', 'Se levantan de la mesa.'],
  ]),

  // Inversión
  inv_hot_tip: c('El chivatazo de tu primo', '«Hazme caso. {asset:tesla}. Es imposible que baje.»', [
    'Cambiar de tema',
    'Meter un poco',
    'Ir a lo grande',
  ]),
  inv_share_plan: c('El plan de acciones para empleados', 'Tu empresa te vende acciones de {asset:microsoft} con un 15 % de descuento.', [
    'Pasar',
    'Comprar algunas',
    'Comprar el máximo',
  ]),
  inv_memecoin: c('La moneda del perro', 'Todo el gimnasio tiene {asset:dogecoin}. Uno se acaba de comprar un coche con eso.', [
    'No entrar',
    'Una apuesta pequeña',
    'Con todo',
  ]),
  inv_friend_startup: c('La startup de un amigo', 'Un amigo busca dinero entre «gente que cree en nosotros».', [
    'Esta vez no',
    ['Invertir', 'Venden la empresa. De repente eres un genio.', 'Un pequeño beneficio, años después.', 'Se queda sin dinero.'],
    'Dar consejos, no dinero',
  ]),
  inv_ipo_hype: c('La salida a bolsa de moda', 'Mañana debuta la empresa de la que habla todo el mundo y tu bróker tiene acciones para ti.', [
    'Mirar desde la barrera',
    ['Acudir', 'Se dispara el primer día.', 'Se queda un poco por debajo del precio.', 'En un mes vale la mitad.'],
  ]),
  inv_ponzi: c('«Un 20 % al mes, garantizado»', 'El amigo trajeado de un amigo tiene un fondo que nunca pierde. Te enseña sus extractos.', [
    'Marcharte',
    ['Probar con poco', 'Te pagan, de momento. Lo coges y sales corriendo.', 'El lunes la web ya no existe.'],
    ['Meterlo todo', 'Sales una semana antes del derrumbe.', 'Era una pirámide. Siempre lo es.'],
  ]),
  inv_exchange_freeze: c('Retiradas suspendidas', 'La plataforma que guarda tus monedas ha «pausado las retiradas por mantenimiento».', [
    ['Esperar', 'Vuelve a abrir. Está todo.', 'No vuelve a abrir. Una parte de tus monedas ha desaparecido.'],
    'Pagar la comisión y salir',
  ]),
  inv_offplan_dubai: c('Sobre plano en {city:dubai}', 'Un folleto brillante, una torre que aún no existe y un plan de pagos.', [
    'Tirar el folleto',
    ['Reservar una unidad', 'Vendes el contrato con beneficio antes de que la construyan.', 'Recuperas la señal, tarde.', 'El promotor deja de contestar. Recuperas una parte.'],
  ]),
  inv_guru_course: c('El gurú del trading', 'Publica desde un deportivo alquilado y su curso está «casi agotado».', [
    'Pasar de largo',
    ['Comprar el curso', 'Bajo el ruido hay una buena lección sobre el riesgo.', 'Seis horas de frases motivadoras.'],
  ]),
  inv_crowdfunding: c('Crowdfunding inmobiliario', 'Una plataforma te deja comprar un trozo de un edificio en alquiler.', [
    'Pasar',
    ['Comprar una parte', 'El alquiler llega cada trimestre.', 'La plataforma cierra y los pagos se acaban.'],
  ]),

  // Vivienda
  house_rent_hike: c('Sube el alquiler', 'Una carta del casero: «para ajustarlo al mercado».', [
    'Pagar',
    ['Negociar', 'Prefiere conservar a un buen inquilino.', 'No cede ni un céntimo.'],
  ]),
  house_first_flat: c('Tu primer piso', 'Una ayuda para primera vivienda te deja entrar con la décima parte del precio.', [
    'Seguir de alquiler',
    'Comprar un estudio',
    'Comprar un piso, con ayuda de casa',
  ]),
  house_landlord_sells: c('El casero vende', 'Te lo ofrece a ti primero, un poco por debajo del precio.', [
    'Mudarte',
    'Comprarlo',
  ]),
  house_refinance: c('Fija o variable', 'Tu banco te ofrece cambiar el tipo de tu hipoteca, esta vez sin comisión.', [
    'Dejarla como está',
    'Pasar tus hipotecas variables a tipo fijo',
    'Pasar tus hipotecas fijas a variable',
  ]),
  house_tenant_default: c('El inquilino deja de pagar', 'Tres meses de silencio y el buzón lleno.', [
    'Esperar y asumir la pérdida',
    ['Contratar a un abogado', 'El inquilino paga y se va.', 'Un año de juicio y un piso que pintar.'],
  ]),
  house_renovation: c('Reformar', 'La cocina es de otro siglo y el baño gotea.', [
    'Poner parches',
    'Hacerlo bien',
    'Reforma de lujo',
  ]),
  house_flood: c('Daños por agua', 'Revienta una tubería mientras pasas el fin de semana fuera. El piso es tuyo, y la factura también.', [
    'Llamar a una empresa',
    'Hacerlo casi todo tú',
  ]),
  house_move_in: c('Iros a vivir juntos', 'Dos alquileres, dos neveras, y siempre estás en su casa.', [
    'Todavía no',
    'Iros a vivir juntos',
  ]),

  // Estilo de vida
  life_sports_car: c('El coche nuevo de un compañero', 'Lo aparca ocupando dos plazas. Baja todo el mundo a verlo.', [
    'Encogerte de hombros',
    'Comprarle barato su viejo {item:car_vw_golf_gti}',
    'Financiar un {item:car_bmw_m3}',
  ]),
  life_retreat: c('Un retiro en Tulum', 'Una amiga vuelve de una semana de yoga y silencio y no para de hablar de ello.', [
    'Seguir currando',
    'Una semana sencilla',
    ['El retiro de lujo, con chamán', 'Vuelves como nuevo. Hasta duermes mejor.', 'Bonito, carísimo y te picaron los mosquitos.'],
  ]),
  house_trendy_area: c('El barrio de moda', 'Se queda libre un piso en el barrio del que todo el mundo habla. Cafés de especialidad, galerías y un alquiler a la altura.', [
    'Quedarte donde estás',
    'Mudarte al piso entero',
    'Compartir piso en el barrio',
  ]),
  life_ibiza: c('Ibiza', 'En el grupo ya hay villa, fechas y un plazo para pagar la señal.', [
    'Quedarte en casa',
    'Ir',
    'Ir, con mesa en la discoteca',
  ]),
  life_new_phone: c('El nuevo {item:tech_phone}', 'El tuyo funciona. Este tiene mejor cámara.', [
    'Seguir con el viejo',
    'Comprarlo',
  ]),
  life_wedding_abroad: c('Una boda en el extranjero', 'Tu amiga se casa junto a un lago: cuatro días y etiqueta «elegante».', [
    'Mandar un regalo',
    'Ir',
    'Ir a lo grande',
  ]),
  life_rolex_call: c('La lista de espera', 'Llaman de la joyería. Después de dos años, ha llegado tu {item:watch_rolex}.', [
    'Dejarlo pasar',
    'Comprarlo y llevarlo',
    'Comprarlo y revenderlo',
  ]),
  life_upgrade: c('Mejora en la puerta de embarque', 'Por una fracción del billete, el asiento se convierte en cama.', [
    'Quedarte en turista',
    'Aceptar la mejora',
  ]),
  life_designer_sale: c('Venta privada', 'Un cuarenta por ciento menos, solo esta noche y con invitación.', [
    'Borrar el correo',
    '{item:fashion_loafers}',
    'La {item:fashion_duffel}',
  ]),
  life_car_finance: c('Necesitas coche', 'El metro cierra a medianoche y tu nuevo trabajo no.', [
    'Seguir en metro',
    'Comprar un {item:car_toyota_corolla} al contado',
    'Financiar un {item:car_tesla_model_3}',
  ]),
  life_club_contacts: c('En la barra del club', 'Alguien a quien saludas cada semana se inclina hacia ti con una oportunidad.', [
    'Cambiar de tema',
    ['Preguntar si buscan gente', 'Te presenta a quien contrata. Sales con una subida.', 'Buenas palabras y nada más.'],
    ['Entrar en su negocio', 'Funciona. Tu parte llega cada año.', 'No vuelves a ver ese dinero.'],
    ['Pedir que te presente a quien decide', 'Una cena después, te ofrecen el puesto de encima del tuyo.', 'Te escuchan con interés. Ya te llamarán.'],
  ]),
  life_bottle_service: c('Mesa con botella', 'Alguien propone coger mesa. El camarero ya tiene la carta en la mano.', [
    'Irte pronto a casa',
    ['Poner tu parte', 'Conoces a gente que merece la pena.', 'Dolor de cabeza y un tique.'],
    'Pagar la mesa con tu tarjeta',
  ]),
  life_black_friday: c('Black Friday', 'Tienes la cesta llena desde el martes.', [
    'Cerrar la pestaña',
    'La {item:tech_console}',
    'El {item:tech_laptop}',
  ]),

  // Familia
  fam_dating: c('Empezar a salir con alguien', 'Una amiga quiere presentarte a alguien. Se te han acabado las excusas.', [
    'Seguir sin pareja',
    'Decir que sí',
  ]),
  fam_wedding: c('La boda', 'Te casas. La única duda es cómo.', [
    'Juzgado y comida',
    'Una boda clásica',
    'La gran boda',
  ]),
  fam_first_child: c('¿Un hijo?', 'Últimamente pasáis más despacio junto a los carritos.', [
    'Todavía no',
    'Sí',
  ]),
  fam_prenup: c('Separación de bienes', 'Tu notario lo menciona, con cuidado.', [
    'No hace falta',
    'Firmarla',
  ]),
  fam_sibling_loan: c('Tu hermano necesita dinero', '«Solo hasta el verano.»', [
    'Decir que no',
    ['Prestárselo', 'Te lo devuelve entero, con una botella de vino.', 'No te lo devuelve, pero no olvida que estuviste ahí.'],
    'Regalarle una cantidad menor',
  ]),
  fam_cosign: c('Avalar un préstamo', 'Tu amigo de toda la vida necesita un avalista.', [
    'Negarte',
    ['Firmar', 'Paga todos los meses. La amistad sale reforzada.', 'Deja de pagar. El banco viene a por ti.'],
  ]),
  fam_support_parents: c('Tus padres necesitan ayuda', 'La pensión ya no llega como antes.', [
    'Ahora no puedes',
    'Mandar dinero cada mes',
    'Pagar a una cuidadora',
  ]),
  fam_inheritance: c('Una herencia', 'Tu abuela te ha dejado algo, y una nota que dice «usa la cabeza».', [
    'Coger el dinero',
    'Meterlo todo en un fondo indexado',
    'Usarlo de entrada para un piso de alquiler',
  ]),
  fam_divorce: c('Divorcio', 'Se veía venir desde hace tiempo.', [
    'Llegar a un acuerdo discreto',
    'Contratar a un buen abogado',
    ['Probar terapia de pareja', 'Funciona. Seguís juntos.', 'Solo ha dejado más claro el final.'],
  ]),
  fam_school: c('Qué colegio', 'El colegio del barrio está bien. El otro tiene lista de espera y uniforme.', [
    'El colegio del barrio',
    'Un colegio privado',
    'El colegio internacional',
  ]),

  // Salud
  health_illness: c('Una enfermedad grave', 'Pruebas, un diagnóstico y un tratamiento con precio.', [
    'Ir por la privada, ya',
    'Ir por la pública y esperar',
    'Cobrar tu seguro de vida',
  ]),
  health_burnout: c('Agotamiento', 'Llevas una hora mirando el mismo correo.', [
    'Seguir tirando',
    'Pedir un permiso sin sueldo',
    'Ir a terapia',
  ]),
  health_dental: c('Una urgencia dental', 'Se te parte una muela con un hueso de aceituna.', [
    'Arreglarlo bien',
    ['Buscar una clínica barata', 'Un buen trabajo por la tercera parte.', 'Hay que repetirlo. Esta vez, bien.'],
  ]),
  health_injury: c('Una lesión deportiva', 'Una pachanga, el campo mojado, una rodilla.', [
    'Fisio privada',
    'Lista de espera pública',
    ['Jugar con dolor', 'Aguanta: nadie nota nada.', 'Cede del todo, y esta vez son meses.'],
    'Recuperarte entrenando',
  ]),
  health_gym_habit: c('Apuntarte al gimnasio', 'Hay un gimnasio abajo y te ahogas subiendo las escaleras.', [
    'Quizá el año que viene',
    'Apuntarte, e ir de verdad',
  ]),

  // Suerte
  luck_lottery: c('{brand:el_gordo}', 'En la oficina se compra lotería de Navidad. Participa todo el mundo.', [
    'No jugar',
    ['Comprar un décimo', ...lotteryResults],
    ['Comprar diez', ...lotteryResults],
  ]),
  luck_car_breakdown: c('El coche no arranca', 'Un clic, un testigo encendido y una grúa.', [
    'El taller oficial',
    ['Un taller barato', 'Arreglado en una tarde.', 'Se vuelve a romper, y ahora es peor.'],
  ]),
  luck_tax_refund: c('Hacienda te devuelve', 'Hacienda te debe dinero. A veces pasa.', [
    'Coger el dinero',
    'Meterlo en el plan de pensiones',
  ]),
  luck_stolen_phone: c('Te roban el móvil', 'Hace un segundo estaba en la mesa de la terraza.', [
    'Comprar otro',
    'Rescatar uno viejo',
  ]),
  luck_bonus: c('Un bonus inesperado', 'Un buen año. Tu jefa te llama, sonriendo.', [
    'Coger el bonus',
    ['Pedir a cambio un aumento', 'Consigues el aumento.', 'Consigues un bonus menor y un sermón.'],
  ]),
  luck_phishing: c('Un mensaje de «tu banco»', 'Parece auténtico. Dice que tu cuenta está bloqueada.', [
    ['Resolverlo rápido', 'Era de verdad, y no era nada.', 'No era tu banco.'],
    'Comprobarlo con calma',
  ]),
  luck_speeding_fine: c('Una multa por exceso de velocidad', 'Te llega por correo una foto de tu coche.', [
    'Pagarla',
    ['Recurrirla', 'Te anulan la multa.', 'Desestimado, con recargo.'],
  ]),
  luck_betting_app: c('La app de apuestas', 'Una apuesta gratis para empezar. Esta noche juega tu equipo.', [
    'Borrar la app',
    ['Una apuesta pequeña', 'Gol en el descuento. Ganas.', 'Pierdes.'],
    ['Ir a por un premio grande', 'Sale.', 'No sale.'],
  ]),

  // Mundo
  world_recession: c('Recesión', 'Las fábricas frenan, las tiendas cierran y todos los titulares llevan la misma palabra.', [
    'Aguantar',
    'Recortar y ahorrar',
    'Comprar en la caída',
  ]),
  world_rate_hike: c('Suben los tipos', 'El banco central sube los tipos. Hipotecas y depósitos se despiertan a la vez.', [
    'Tomar nota',
    'Pasar tu hipoteca a tipo fijo',
    'Comprar bonos a corto plazo',
  ]),
  world_rate_cut: c('Bajan los tipos', 'El banco central recorta. Pedir prestado vuelve a ser barato.', [
    'Tomar nota',
    'Pasar tu hipoteca a variable',
    'Pedir prestado e invertir',
  ]),
  world_inflation: c('Los precios se disparan', 'La compra de la semana cuesta lo que antes una cena fuera.', [
    'Apretarte el cinturón',
    ['Pedir una subida por el coste de la vida', 'Te la dan.', 'No hay presupuesto.'],
    'Comprar oro',
  ]),
  world_crypto_bull: c('Fiebre cripto', 'Las criptomonedas salen en portada y tu taxista tiene una opinión.', [
    'No entrar',
    'Comprar algo de {asset:bitcoin}',
    'Hacer antes un curso',
  ]),
  world_crypto_winter: c('Invierno cripto', 'Los gráficos están en rojo y los foros en silencio.', [
    'Mirar para otro lado',
    'Comprar cuando hay miedo',
  ]),
  world_housing_crash: c('Se rompe el mercado de la vivienda', 'Carteles de «se vende» por toda tu ciudad, y los precios cayendo.', [
    'Esperar',
    'Comprar un estudio de ocasión para vivir',
    'Comprar uno para alquilar',
  ]),
  world_tech_bubble: c('Manía tecnológica', 'De repente todas las empresas son tecnológicas.', [
    'Mantener la cartera repartida',
    'Subirte con {asset:nvidia}',
  ]),
  world_ai_boom: c('El auge de la IA', 'Herramientas nuevas cada semana. La mitad de tu trabajo podría hacerse de otra manera.', [
    'Seguir como siempre',
    'Aprender las herramientas',
    ['Pedir liderar el trabajo de IA', 'El puesto es tuyo, con aumento.', 'Contratan a alguien de fuera.'],
  ]),
  world_pandemic: c('Pandemia', 'Se cierran las fronteras y se vacían las calles. Todo el mundo aprende a hacer pan.', [
    'Quedarte en casa',
    'Hacer voluntariado',
    'Especular desde el sofá',
  ]),
  world_tax_reform: c('Reforma fiscal', 'Unos presupuestos nuevos cambian los tipos en alguna parte. Mira la pestaña Impuestos: puede ser tu ciudad.', [
    'Leer el resumen',
    'Ir a un asesor fiscal',
  ]),
  crisis_crash_panic: c('Lunes negro', 'Las pantallas están en rojo de Tokio a Nueva York. El móvil no deja de vibrar: todos preguntan qué vas a hacer.', [
    'No mirar y aguantar',
    'Comprar mientras todos venden',
    'Tirar de tu línea de crédito mientras el banco aún presta',
  ]),
  crisis_crash_layoffs: c('La segunda ola', 'Un año después, el crac ha llegado a las nóminas. Tu empresa convoca a toda la plantilla el viernes.', [
    ['No llamar la atención', 'Conservas el puesto y el sueldo.', 'Conservas el puesto, con menos sueldo.'],
    'Ofrecerte a cobrar menos',
    'Aprovechar los meses flojos para formarte',
  ]),
  crisis_energy_bills: c('La factura', 'La calefacción, la gasolina y la compra han subido a la vez. El sobre del buzón pesa más que de costumbre.', [
    'Pagarla',
    'Apretarte el cinturón',
  ]),
  crisis_energy_wages: c('Sueldos contra precios', 'Los precios llevan dos años por delante de los sueldos. Se habla de huelga, y de quién cederá antes.', [
    'Esperar',
    ['Parar con los demás', 'Se gana la subida.', 'La huelga fracasa y te descuentan los días.'],
    'Recortar gastos en casa',
  ]),
  crisis_debt_spreads: c('La prima de riesgo', 'Los prestamistas piden el doble por la deuda de tu gobierno. Todo préstamo que se calcula sobre ella va detrás.', [
    'Esperar a ver',
    'Fijar ya el tipo de tu hipoteca',
    'Refugiarte en el {asset:bund}',
  ]),
  crisis_debt_austerity: c('Recortes', 'Las cuentas se cuadran por las malas: una derrama, sueldos congelados y gangas para quien tenga efectivo.', [
    'Pagar la derrama',
    'Pagarla, y hacer el trabajo de dos',
    'Pagarla, y comprar un estudio embargado para alquilar',
  ]),
  world_bank_failure: c('Quiebra un banco', 'Un banco mediano cierra y se forman colas delante de los demás.', [
    ['Confiar en la garantía', 'Tus ahorros están a salvo.', 'Parte de tus ahorros superaba el límite.'],
    'Hacer cola y mover tu dinero',
  ]),

  // Impuestos
  tax_advisor: c('¿Te llevas la renta a una gestoría?', 'Hacerla tú cuesta un programa, un fin de semana y algún error. La gestoría cobra más, pero halla deducciones y te cubre ante Hacienda.', [
    ['Seguir haciéndola tú', 'La presentas a tiempo, con tres pestañas abiertas y un café.', 'Un error en una casilla: Hacienda te cobra un recargo.'],
    ['Contratar la gestoría', 'Encuentra deducciones que no sabías que existían: se paga sola y sobra.', 'Este año no encuentra nada que deducir, pero ya tienes quien te defienda ante Hacienda.'],
  ]),
  tax_pension_topup: c('Aportación al plan de pensiones', 'Este año tu empresa iguala lo que aportes a tu plan.', [
    'Pasar',
    'Aportar un poco',
    'Aportar el máximo',
  ]),
  tax_optimise: c('La declaración de la renta', 'Una caja de zapatos llena de facturas y una fecha límite.', [
    'Presentarla como siempre',
    'Repasar todas las facturas',
  ]),
  tax_letter: c('Una carta de Hacienda', 'Hacienda dice que tu declaración tenía un error y te propone lo que debes.', [
    'Pagar y olvidarte',
    ['Recurrir', 'Tenías razón: archivan el expediente.', 'Pierdes, y pagas con intereses.'],
    ['Pagar a una gestora para que lo mire', 'Lo arregla con una llamada.', 'Ni ella puede: toca pagar.'],
  ]),
  tax_audit: c('Una inspección de Hacienda', 'Una carta certificada. Quieren tres años de papeles.', [
    'Pagar lo que piden',
    ['Recurrir', 'Lo dejan pasar.', 'Encuentran más.'],
  ]),
  tax_undeclared: c('En negro', 'Un cliente te ofrece pagar más si no hay factura.', [
    'Facturarlo como es debido',
    ['Coger el sobre', 'Nadie pregunta nunca.', 'Alguien pregunta. La multa es mayor que el trabajo.'],
  ]),
  tax_residency: c('Cambiar de residencia fiscal', 'Un asesor te enseña lo que conservarías si vivieras en {city:dubai}.', [
    'Quedarte',
    'Mudarte a {city:dubai}',
    'Pagar antes un buen asesoramiento',
  ]),

  // Madurez
  late_porsche: c('Un {item:car_porsche_911}', 'Pasas por delante del concesionario todos los días. Hoy entras.', [
    'Volver a salir',
    'Comprarlo',
    'Financiarlo',
  ]),
  late_university: c('La universidad', 'A tu hijo lo han admitido en una buena universidad extranjera.', [
    'La universidad pública de aquí',
    'La buena, en el extranjero',
    'Que pida un préstamo de estudios',
  ]),
  late_early_retirement: c('Prejubilación', 'La empresa ofrece un paquete a quien se vaya este año.', [
    'Seguir trabajando',
    'Aceptar el paquete',
  ]),
  late_downsizing: c('Una casa más pequeña', 'La casa se ha quedado grande. Bastaría un pisito de alquiler junto al mar.', [
    'Quedarte',
    'Vender y alquilar junto al mar',
  ]),
  late_will: c('Hacer testamento', 'A nadie le apetece la cita. Todo el mundo se alegra después.', [
    'Más adelante',
    'Hacerlo',
  ]),
  career_restructuring: c('Reestructuración', 'La empresa revisa quién cobra más. Tu nombre está en la lista.', [
    'Aceptar un puesto por debajo',
    'Aceptar la salida con indemnización',
    ['Pelear tu puesto', 'Te quedas. Esta vez.', 'Pierdes la pelea: sales con una indemnización menor.'],
  ]),
  late_gift: c('Herencia en vida', 'Tus hijos están en la edad en que más ayuda un empujón. Lo que des paga hoy el impuesto de donaciones.', [
    'Que esperen a la herencia',
    'Ayudarles con la entrada de un piso',
    'Repartir la mitad en vida',
  ]),
  late_business_handover: c('El futuro del negocio', 'Llevas años al frente. Un comprador pregunta por él, y en casa alguien querría seguir.', [
    'Seguir al frente',
    'Vendérselo al comprador',
    'Dárselo a tus hijos',
  ]),
  late_parents_care: c('Tus padres ya no pueden solos', 'Tu madre se cayó el mes pasado. Alguien tiene que estar pendiente, y no basta con una llamada.', [
    'Que se ocupen tus hermanos',
    'Pagar una residencia',
    'Cuidarlos tú',
  ]),
  career_four_day_week: c('Semana de cuatro días', 'La empresa prueba la jornada de cuatro días: un 20 % menos de sueldo a cambio de un día libre más, para siempre.', [
    'Seguir a jornada completa',
    'Pasar a cuatro días',
  ]),
  edu_company_course: c('Un curso pagado por la empresa', 'Te pagan un curso caro. La letra pequeña: dos años de permanencia o lo devuelves.', [
    'No, gracias',
    'Aceptar, con dos años de permanencia',
    'Pagártelo tú, sin ataduras',
  ]),
  biz_rival: c('Abre la competencia al lado', 'Un local idéntico al tuyo acaba de abrir en la misma calle, y con inauguración.', [
    ['Aguantar y ver', 'Te quita clientes: tu negocio pierde valor.', 'Sus clientes vuelven a ti en un mes.'],
    'Bajar precios',
    'Reformar el local',
  ]),
  biz_viral_review: c('Una reseña se hace viral', 'Alguien ha escrito sobre tu negocio y medio barrio lo ha compartido. Aún no sabes en qué tono.', [
    ['Dejarlo correr', 'Era buena: tienes cola en la puerta.', 'Era mala, y se nota en la caja.'],
    ['Responder con mimo', 'Tu respuesta gusta más que la reseña.', 'Nadie lee las respuestas.'],
    'Comprar reseñas falsas',
  ]),
  biz_labour_inspection: c('Inspección de trabajo', 'Un inspector pide los contratos, los horarios y las nóminas de tu negocio.', [
    ['Que vengan', 'Todo en orden. Se van con un café.', 'Un contrato mal hecho: multa.'],
    'Llamar antes a una asesoría laboral',
  ]),
  inv_bank_product: c('Un producto «garantizado»', 'Tu banco te ofrece un bono a dos años «sin riesgo». Comisión de entrada incluida, en letra pequeña.', [
    'No, gracias',
    'Contratarlo',
    'Pedir un fondo indexado sin comisión',
  ]),
  inv_leveraged_etf: c('Un fondo que multiplica por tres', 'Un influencer jura por un ETF apalancado: el triple de lo que haga el mercado. Hacia arriba y hacia abajo.', [
    'Pasar',
    ['Meter dinero', 'El mercado subió: lo triplicas.', 'El mercado se quedó quieto: recuperas lo que pusiste.', 'El mercado bajó: se evapora.'],
  ]),
  house_noisy_neighbours: c('Vecinos ruidosos', 'Los de arriba ensayan con la batería a la hora de cenar. Y a la de dormir.', [
    'Aguantar',
    ['Subir a hablar con ellos', 'Se disculpan y bajan el volumen.', 'Te miran raro y suben el volumen.'],
    'Buscar otro piso de alquiler',
    'Insonorizar tu casa',
  ]),
  house_levy: c('Derrama en la comunidad', 'Hay que cambiar el ascensor y la junta ha votado una derrama. Tu parte, para este mes.', [
    'Pagar tu parte',
    ['Recurrirla', 'El juez te da la razón.', 'Pierdes, y pagas con intereses.'],
  ]),
  house_lodger: c('Alquilar una habitación', 'Te sobra una habitación y una amiga busca dónde vivir. Pagaría bien.', [
    'Mejor no',
    'Alquilársela',
  ]),
  life_bali_wedding: c('Una boda en Bali', 'Tu mejor amigo se casa en Bali. Viaje, hotel, regalo y una semana sin trabajar.', [
    'Excusarte',
    'Ir a Bali',
  ]),
  fam_dog: c('Un perro en la protectora', 'Un perro de tres años te mira desde la jaula como si ya te conociera.', [
    'Mejor no',
    'Adoptarlo',
  ]),
  fam_partner_startup: c('Tu pareja quiere emprender', 'Tu pareja quiere dejar su trabajo para montar algo propio. Necesita tu apoyo, y un tiempo sin sueldo.', [
    'Pedirle que no lo haga',
    ['Apoyarle', 'Funciona: gana más que nunca.', 'No sale: vuelve a trabajar, por menos.'],
  ]),
  tax_no_vat: c('¿Sin IVA?', 'Un cliente te propone pagarte en efectivo y sin factura. Para los dos sale más barato.', [
    'Con factura y con IVA',
    'Sin IVA, en mano',
  ]),
  tax_amnesty: c('Amnistía fiscal', 'El Gobierno anuncia una amnistía: quien regularice ahora paga un 10 % de lo que no declaró y queda limpio.', [
    'Arriesgarte',
    'Regularizar',
  ]),
  late_motorbike: c('Una moto, a tu edad', 'Una Ducati en el escaparate y la sensación de que la vida se pasa.', [
    'Ni hablar',
    'Comprarla',
    'Comprarla a plazos',
  ]),
  late_mentor: c('Ser mentor', 'Una asociación busca jubilados que guíen a jóvenes que empiezan. Unas horas a la semana.', [
    'Prefieres tu huerto',
    'Ser mentor',
  ]),
  late_scam_call: c('Un mensaje urgente', '«Mamá, papá, se me ha roto el móvil. Este es mi número nuevo. Necesito 3.000 $ hoy.»', [
    ['Ignorarlo', 'Era una estafa. Bien hecho.', 'Era de verdad, y no te lo perdonan.'],
    ['Hacer la transferencia', 'Era una estafa. El dinero no vuelve.', 'Era de verdad. Te lo agradecen.'],
    'Llamar al número de siempre',
    'Reconocer la estafa al vuelo',
  ]),
  city_madrid_cana: c('Solo una caña', 'Un compañero dice de tomar una caña al salir. En Madrid, una caña acaba en cena a medianoche.', [
    'Irte a casa',
    'Quedarte a cenar',
  ]),
  city_madrid_tourist_flat: c('Agosto en Madrid', 'En agosto todo el mundo se va. Tu piso podría ganarse el sueldo mientras no estás.', [
    'Dejarlo vacío',
    'Alquilarlo legal, con papeles',
    'Alquilarlo en negro, sin preguntas',
  ]),
  city_london_tube_strike: c('Huelga de metro', 'Una semana sin metro, y la oficina sigue abriendo a las nueve.', [
    'Ir en taxi toda la semana',
    'Trabajar desde casa y retrasarte',
  ]),
  city_london_club: c('Te quieren en un club', 'Un socio de un club privado de Mayfair se ofrece a proponerte.', [
    'Declinarlo con educación',
    'Pagar la cuota de entrada',
  ]),
  city_new_york_rent_hike: c('El alquiler sube un 20 %', 'Tu casero escribe: el contrato se renueva un veinte por ciento más caro.', [
    'Pagarlo',
    ['Recurrir ante la junta de alquileres', 'La junta limita la subida. Sigues con el alquiler de antes.', 'La junta da la razón al casero, y encima pagas las costas.'],
  ]),
  city_new_york_elevator_pitch: c('Cuarenta pisos con un inversor', 'Un inversor famoso entra en tu ascensor. Tienes unos cuarenta segundos.', [
    'Mirar el móvil',
    ['Contarle tu idea', 'Te da su tarjeta. Un mes después tienes un trabajo mejor.', 'Asiente con educación y se baja en el piso treinta.'],
  ]),
  city_dubai_visa: c('Caduca el visado', 'Hay que renovar el visado de residencia: reconocimiento médico, formulario y tasa.', [
    'Pagar a un gestor',
    'Pasar un día haciendo colas',
  ]),
  city_dubai_golden_visa: c('Un visado dorado', 'Con lo que tienes, podrías tener diez años de residencia y el estatus que conlleva.', [
    'No hace falta',
    'Solicitarlo',
  ]),
  city_singapore_ballot: c('Sorteo de vivienda pública', 'El Estado construye pisos a una fracción del precio de mercado. Hay sorteo.', [
    'No apuntarte',
    ['Apuntarte al sorteo', 'Sale tu número: un piso nuevo a una fracción del precio.', 'Esta vez no sale tu número.'],
  ]),
  city_singapore_gum: c('Te pillan con chicle', 'Un vigilante te ve con chicle en el metro. Singapur es una ciudad de multas.', [
    'Pagar la multa',
    'Recurrir y recoger basura una mañana',
  ]),
  city_bangkok_flood: c('Llegan las lluvias', 'El monzón inunda tu calle y, con ella, la planta baja.', [
    'Que se encargue el seguro',
    'Sacos de arena y limpiar tú',
  ]),
  city_bangkok_beach_bar: c('Un bar en la playa', 'Un amigo en Koh Samui busca un socio más para un bar en la arena.', [
    'Quedarte en la ciudad',
    ['Poner dinero', 'Una buena temporada: el bar te devuelve el doble.', 'Una temporada lluviosa y vacía. El dinero se queda en la arena.'],
  ]),
  city_tokyo_earthquake: c('Tiembla la tierra', 'Un terremoto fuerte sacude la ciudad. Tu casa sigue en pie, pero no ilesa.', [
    'Llamar al seguro',
    'Arreglar tú lo que puedas',
  ]),
  city_tokyo_karaoke: c('Karaoke con el jefe', 'Tras la cena de fin de año, tu jefe reserva una sala de karaoke y te mira.', [
    'Poner una excusa',
    ['Coger el micrófono', 'Tu balada hace llorar a la sala. El lunes el jefe se acuerda de ti.', 'Nadie recuerda la canción. Todos recuerdan la resaca.'],
  ]),
  city_moscow_rouble: c('Se hunde el rublo', 'El rublo cae un tercio frente al dólar en una noche, y tu sueldo con él.', [
    'Aguantar',
    'Negociar el sueldo en dólares',
  ]),
  city_moscow_dacha: c('Una dacha en la familia', 'Una tía te deja su dacha de madera a una hora de la ciudad.', [
    'Venderla',
    'Quedártela para los fines de semana',
  ]),
  city_mexico_city_mordida: c('El inspector espera', 'Un inspector encuentra un problema en tus papeles, y te deja claro que podría desaparecer.', [
    ['Negarte y arriesgarte', 'Llega la multa, con todos los sellos.', 'El inspector se encoge de hombros y se va a visitar a otro.'],
    'Pagar la mordida',
  ]),
  city_mexico_city_taqueria: c('Un socio para la taquería', 'El taquero de tu esquina busca socio para abrir un segundo puesto.', [
    'Desearle suerte',
    'Poner dinero',
  ]),
  city_zurich_numbered_account: c('Una cuenta con número', 'Un banquero discreto te sugiere una cuenta que solo se conoce por su número.', [
    'Darle las gracias e irte',
    ['Abrir la cuenta', 'La cuenta crece en silencio, y nadie pregunta.', 'Una filtración, una lista, y Hacienda lee tu nombre en ella.'],
  ]),
  city_zurich_referendum: c('Un referéndum sobre impuestos', 'El cantón vota bajar el impuesto sobre la renta. Podrías hacer campaña.', [
    'Solo votar',
    ['Hacer campaña por la bajada', 'La bajada sale adelante, y tu próxima factura encoge.', 'El cantón vota que no. Te quedas con los folletos.'],
  ]),
  crime_trial: c('Tu día en el juzgado', 'Los cargos siguen adelante. Un juzgado, una jueza que ha oído todas las excusas, y tú.', [
    ['Abogado de oficio', 'Encuentra un resquicio que nadie esperaba. Sales libre.', 'Lee tu expediente diez minutos antes de la vista. Dos rondas dentro.'],
    ['Contratar al mejor abogado', 'Caro, brillante y engreído. Absuelto.', 'Hasta los mejores pierden a veces. Una ronda dentro.'],
    'Pactar y delatar a tu socio',
  ]),
  crime_wrongly_accused: c('Inocente, de verdad', 'La policía está segura de que hiciste algo que no hiciste. Estabas en el dentista.', [
    ['Fiarte del abogado de oficio', 'El dentista declara. Quedas libre, y tus dientes están bien.', 'El dentista está de vacaciones. Una ronda dentro por nada.'],
    'Pagar un buen abogado',
  ]),
  crime_jail_cellmate: c('Tu compañero de celda, banquero', 'El de la litera de arriba dirigía un fondo de inversión. Tiene opiniones sobre tu cartera.', [
    'Hacerte el dormido',
    'Tomar apuntes',
  ]),
  crime_jail_commissary: c('La economía de los fideos', 'Dentro, los fideos instantáneos son dinero. Todo el mundo los quiere y nadie tiene bastantes.', [
    'Comprar lo que necesitas',
    ['Montar el negocio de fideos', 'Te conviertes en el banco central del módulo.', 'Te pillan con doscientos sobres. Te alargan la condena.'],
  ]),
  crime_jail_library: c('La biblioteca de la cárcel', 'Tres estanterías, un diccionario y mucho tiempo.', [
    'Dormir',
    'Aprender un idioma',
    'Estudiar para tu oficio',
  ]),
  crime_memoirs: c('Memorias desde la celda', 'Una editorial cree que tu historia vendería. Un pódcast también.', [
    'Guardártela',
    ['Contarlo todo', 'Un superventas, una gira y una opción para película.', 'Doce ejemplares vendidos, nueve a tu madre.'],
  ]),
  crime_fake_mba: c('Una pequeña mejora', 'Nadie comprueba un currículum. Un MBA quedaría muy bien en el tuyo.', [
    'Dejar el currículum como está',
    'Añadir el MBA',
  ]),
  crime_fake_mba_found: c('Recursos Humanos pregunta', 'Recursos Humanos quiere una copia de tu título de MBA. Para el viernes.', [
    ['Tirarte el farol', 'No vuelven a preguntar. Respiras.', 'Llaman a la escuela de negocios. A mediodía has recogido tu mesa.'],
    'Confesar',
  ]),
  crime_ham_smuggling: c('Una maleta llena de jamón', 'Un amigo pagará bien unos jamones ibéricos traídos en tu equipaje. La aduana puede no estar de acuerdo.', [
    'Llevar solo ropa',
    ['Meter los jamones', 'El escáner ve zapatos. Tu amigo paga en efectivo.', 'Un perro rastreador, una multa y un agente muy confundido.'],
  ]),
  crime_memecoin: c('Lanza tu propia moneda', 'Llámala $RATA, paga a unos influencers y vende antes de que nadie se entere. ¿Qué puede salir mal?', [
    'Conservar la dignidad',
    ['Lanzar $RATA', 'Se multiplica por cien. Vendes en lo alto.', 'Sube, vendes, y el regulador lee tus mensajes.', 'Nadie compra. El logo era bonito.'],
  ]),
  crime_illegal_betting: c('Una apuesta segura', 'Un señor en un bar jura que el partido de Segunda del domingo ya está decidido.', [
    'Verlo gratis',
    ['Apostar dos mil', 'Tenía razón. Cobras, sin hacer ruido.', 'No tenía razón. Tanto para lo seguro.', 'El partido estaba amañado, y la policía vigilaba las apuestas.'],
  ]),
  crime_enchufe: c('Un primo en el ministerio', 'Tu primo puede conseguirte una plaza pública, sin oposición. La familia ayuda a la familia.', [
    'Decir que no, gracias',
    ['Aceptar el favor', 'Una plaza para toda la vida, y un primo al que le debes para siempre.', 'Una denuncia anónima, y un inspector leyendo el expediente.'],
  ]),
  crime_insider_tip: c('Tu cuñado sabe algo', 'Trabaja en un banco. El lunes se anuncia una opa, y nadie lo sabe todavía.', [
    'Cambiar de tema',
    ['Comprar antes del lunes', 'Llega el lunes, las acciones suben. Vendes.', 'Suben, vendes con prisas… y el regulador te imputa por uso de información privilegiada.', 'No había opa: era otro banco. Vendes con pérdidas.'],
  ]),
  crime_laundering: c('Dinero limpio', 'Tu negocio cobra mucho en efectivo. Un amigo te explica cómo podría cobrar un poco más, sobre el papel.', [
    'Llevar las cuentas honestas',
    'Lavar lo que tienes oculto',
  ]),
  lodger_good: c('El inquilino perfecto', 'Paga el día uno, riega las plantas y nunca usa tu taza.', [
    'Dejarlo todo como está',
    ['Subirle un poco el alquiler', 'Lo paga sin rechistar.', 'Se busca otra cosa. Mejor haberlo dejado.'],
  ]),
  lodger_unpaid: c('El alquiler se retrasa', 'Tu inquilino no ha pagado este mes, ni el anterior. Detrás de la puerta suena música.', [
    ['Darle un mes más', 'Lo paga todo, con una disculpa y un bizcocho.', 'Se va de noche debiéndote tres meses.'],
    'Pedirle que se vaya',
  ]),
  lodger_friend: c('Un inquilino con contactos', 'Tu inquilino quiere presentarte a una amiga que trabaja donde te gustaría trabajar a ti.', [
    'Una cena y poco más',
    'Coger su tarjeta y escribirle',
  ]),
  lodger_tension: c('Tensión en casa', 'Tu pareja no soporta encontrarse al inquilino en el sofá todas las noches.', [
    'Tiene razón: el inquilino se va',
    ['Es solo un poco más', 'Aguantáis, con un ambiente gélido.', 'Tu pareja se va antes que el inquilino.'],
  ]),
  red_licence: c('Sin licencia todavía', 'Tu negocio tiene que cerrar unas semanas: falta un papel que nadie sabe quién firma.', [
    'Esperar a que llegue',
    'Pagar a un gestor que lo mueva',
    ['Abrir igualmente', 'Nadie pasa a mirar.', 'Pasa un inspector: multa y una ficha a tu nombre.'],
  ]),
  red_appointment: c('Cita previa', 'Para renovar un papel hace falta cita. La primera libre es dentro de tres semanas, un martes a las 9:00.', [
    'Pedir el día libre e ir',
    'Pagar a una gestoría',
  ]),
  red_works_stopped: c('Obra paralizada', 'Un aviso en la puerta: tu reforma no tiene el permiso que el ayuntamiento cambió el mes pasado.', [
    'Esperar a que lo resuelvan',
    'Pagar la tasa extra y seguir',
  ]),
  red_inheritance: c('Una herencia en trámite', 'Una tía lejana te deja algo. Entre notarios, sucesiones y sellos, cobrarlo es otra historia.', [
    'Pagar el impuesto y cobrar ya',
    ['Esperar a que acabe el trámite', 'Llega entera, aunque tarde.', 'Entre plazos y recargos, llega la mitad de la mitad.'],
  ]),
  red_grant: c('Una subvención', 'Hay una ayuda para negocios como el tuyo. El formulario tiene cuarenta páginas.', [
    'No merece la pena',
    ['Rellenarlo todo', 'Te la conceden.', 'Falta un sello. Denegada.'],
  ]),
  refuge_bank_freeze: c('Corralito', 'Los bancos limitan las retiradas de efectivo «por su seguridad». Las colas dan la vuelta a la manzana.', [
    'Hacer cola y esperar',
    'Pedir dinero a la familia',
    'Tirar de tu oro',
    'Pagar en cripto',
  ]),
  // The famous, as parodies.
  celeb_mosk: c('Elon Mosk quiere tu negocio', 'Lo ha visto en una publicación. En una respuesta, te ofrece el triple de lo que vale.', [
    'Decir que no',
    ['Cerrar el trato', 'Paga. El triple. Enmarcas la publicación.', 'Cambia de idea en otra publicación. El abogado te manda la factura igual.'],
  ]),
  celeb_grump: c('Un piso en la Grump Tower', 'Ronald Grump te la enseña en persona: «Los mejores pisos. Lo dice todo el mundo». Cuestan un 30 % más que el de al lado.', [
    'Seguir buscando',
    ['Firmar', 'Grifos dorados, portero y su nombre en la puerta. Se nota.', 'A la semana quitan su nombre del edificio. Ahora es solo un piso, y caro.'],
  ]),
  celeb_poutine: c('El yate de un oligarca, barato', 'Un señor nervioso vende su yate esta semana, muy por debajo de su precio. Vladimir Poutine mira desde el final de una mesa larguísima.', [
    'No es tu barco',
    ['Comprarlo', 'Es tuyo, y nadie pregunta de dónde salió.', 'Las sanciones lo congelan en el puerto. Los abogados para recuperarlo cuestan una fortuna.'],
  ]),
  celeb_bufe: c('Comida con Warren Bufé', 'El viejo inversor te invita a una hamburguesa y una cola de cereza. Puedes preguntarle una sola cosa.', [
    'Hablar del tiempo',
    'Preguntarle cómo lo hizo',
    'Preguntarle qué comprar',
  ]),
  celeb_bozos: c('Vender a través de Jeff Bozos', 'Su plataforma llevaría tu negocio a todas las casas del país. A cambio de un treinta por ciento de cada venta.', [
    'Seguir por tu cuenta',
    ['Entrar en la plataforma', 'Pedidos de todas partes. Tu negocio nunca ha valido tanto.', 'Copia tu producto estrella y lo vende más barato. Pierdes terreno.'],
  ]),
  celeb_zuckerbot: c('Terreno en el metaverso', 'Mark Zuckerbot vende parcelas en su mundo virtual: «Todos viviremos aquí». Serías de los primeros.', [
    'Quedarte en el mundo real',
    ['Comprar una parcela', 'Una marca te compra la parcela para su tienda virtual. Vendes, y aún no te lo crees.', 'El metaverso se vacía. Tu parcela es un cuadrado de píxeles verdes que no visita nadie.'],
  ]),
  celeb_puertas: c('Una gala con Bill Puertas', 'Pasa la hucha en una gala benéfica, y la sala se queda en silencio cuando llega a ti.', [
    'Pasarla sin echar nada',
    'Dar una décima parte de todo lo que tienes',
    'Echar un poco',
  ]),
  celeb_nakamoro: c('Un portátil viejo en el trastero', 'Tiene una cartera de monedas de los primeros tiempos. Bloqueada. La contraseña es algo que usarías entonces.', [
    'Dejarlo en la caja',
    ['Probar todas tus contraseñas', 'Se abre. Vendes antes de que te dejen de temblar las manos.', 'Ninguna funciona. Pierdes el finde, y una figura encapuchada sonríe en la pantalla.'],
  ]),
  celeb_kardashion: c('Una publicación patrocinada', 'Kim Kardashion quiere que salgas en una foto con su nueva agua: «Tú sonríe y di que te ha cambiado la vida».', [
    'Decir que no',
    'Hacer la foto',
    'Hacerlo en serio, para tus seguidores',
  ]),
  celeb_mrfeast: c('Un reto de MrFeast', 'Quien aguante una semana dentro de un círculo de luz gana una fortuna. Lo verán millones.', [
    'Verlo desde casa',
    ['Participar', 'Eres quien aguanta hasta el final. El cheque es enorme, y de verdad.', 'Aguantas once horas. El vídeo de tu rendición tiene ocho millones de visitas.'],
  ]),
  celeb_ronalgo: c('La ropa interior de Cristiano Ronalgo', 'Su representante busca inversores para una nueva línea: «Se vende sola. Míralo».', [
    'No es tu estilo',
    ['Poner dinero', 'Se vende en todas partes. Llega un cheque cada año.', 'La moda pasa. Las cajas de calzoncillos no.'],
  ]),
  celeb_swiftly: c('Taylor Swiftly está de gira', 'Las entradas se agotaron en un minuto. Tienes dos, a un precio que te obliga a sentarte.', [
    'Regalarlas',
    'Ir al concierto',
    ['Revenderlas', 'Las vendes por mucho más. Alguien llora de alegría.', 'Eran falsas. Pierdes la noche y el dinero.'],
  ]),
  celeb_bellfort: c('Una llamada de Jordan Bellfort', '«Tengo una acción que solo sube. Solo sube». Habla muy deprisa. Tienes un minuto.', [
    'Colgar',
    ['Comprar lo que vende', 'No se sabe cómo, pero sube. Vendes y no vuelves a cogerle el teléfono.', 'La empresa no existe. Tu dinero, ahora, tampoco.'],
  ]),
  celeb_ortiga: c('Amancio Ortiga abre enfrente', 'Una tienda enorme justo delante de tu negocio. Viene él en persona: «O te puedes unir a nosotros».', [
    'Aguantar',
    'Aceptar su franquicia',
  ]),
  luck_barn_car: c('Un clásico en el granero', 'En el granero del abuelo, bajo una lona, hay un deportivo de los setenta. Lleno de polvo y entero.', [
    'Venderlo tal cual',
    ['Restaurarlo y venderlo', 'Un coleccionista paga lo que vale. Y algo más.', 'El motor estaba peor de lo que parecía. Sacas poco.'],
    'Restaurarlo y quedártelo',
  ]),
  life_mlm: c('«¿Has pensado en ser tu propio jefe?»', 'Una amiga del colegio te escribe por primera vez en diez años. Vende batidos y busca «socios».', [
    'Decirle que no',
    ['Comprar el kit de inicio', 'Vendes más de lo que esperabas. Sobre todo a tu familia.', 'Le vendes uno a tu madre. El resto, al trastero.'],
    ['Comprar el kit y meter a otros', 'Tu red crece y cobras comisiones. Tus amigos te esquivan.', 'Nadie entra. Y ya nadie te coge el teléfono.'],
  ]),
  house_squatters: c('Okupas en tu piso', 'El piso que alquilabas estaba vacío entre inquilinos. Ya no lo está: han cambiado la cerradura.', [
    'Ir a juicio',
    'Pagarles para que se vayan',
    ['Llamar a una empresa de desokupación', 'Una visita y se van esa misma tarde.', 'Sale en las noticias. Y tú también.'],
  ]),
  house_solar: c('Placas solares', 'Un instalador ha pasado por la urbanización: con el tejado que tienes, dice, la luz te saldría casi gratis.', [
    'Seguir con la factura de siempre',
    'Instalarlas',
    'Instalarlas con batería',
  ]),
  fam_village_house: c('La casa del pueblo', 'Te dejan la casa de la familia en el pueblo. El tejado tiene goteras y la higuera, higos.', [
    'Venderla como está',
    'Arreglarla para los veranos',
    'Arreglarla y alquilarla a turistas',
  ]),
  career_company_ipo: c('Tu empresa sale a bolsa', 'La empresa sale a bolsa y tus acciones de empleado por fin valen algo. Las puedes vender el primer día o esperar.', [
    'Venderlo todo el primer día',
    ['Aguantar seis meses', 'Las acciones se disparan. Hay quien deja de trabajar.', 'Siguen donde estaban.', 'Caen por debajo del precio de salida.'],
    ['Vender la mitad', 'La mitad que guardaste sube bien.', 'La mitad que guardaste se queda en nada.'],
  ]),
  biz_metro_works: c('Obras delante de tu negocio', 'El ayuntamiento abre una zanja delante de tu puerta para una línea de metro. Dicen que serán dos años.', [
    'Aguantar',
    ['Reclamar al ayuntamiento', 'Te dan una indemnización. Tarde, pero llega.', 'Te dan cita para dentro de un año.'],
    'Empezar a llevarlo a domicilio',
  ]),
  career_strike: c('Huelga en la empresa', 'Convocan huelga por los sueldos. El jefe pregunta, sin preguntar, quién va a venir.', [
    ['Ir a trabajar', 'El jefe se acuerda de quién vino.', 'Nadie se acuerda de nada. Salvo tus compañeros.'],
    ['Unirte a la huelga', 'La huelga sale bien: sube el sueldo de todos.', 'No consiguen nada. Pierdes el día.'],
    ['Ser quien negocia', 'Sales con un acuerdo y con nombre propio.', 'La empresa se acuerda de ti. Para mal.'],
  ]),
  life_school_reunion: c('La reunión de antiguos alumnos', 'Veinte años después, cena con la clase. Ya se sabe quién va a contar que le va genial.', [
    'No ir',
    'Ir a aparentar',
    ['Ir y contar la verdad', 'Alguien de la clase busca a alguien como tú.', 'Os reís mucho. Nada más, y nada menos.'],
  ]),
  fam_child_streamer: c('Tu hijo quiere ser streamer', 'Tu hijo quiere dejarlo todo para hacer directos. Necesita un ordenador, cámara, micro y luces.', [
    'Que estudie primero',
    ['Comprarle el equipo', 'Un directo se hace viral. Hay patrocinadores llamando.', 'Doce espectadores. Tres son la familia.'],
    ['Comprarle el equipo y llevarle la carrera', 'Con contratos y horarios, lo petáis.', 'Doce espectadores y un mánager muy implicado.'],
  ]),
  life_stag_party: c('Te toca organizar la despedida', 'Se casa tu mejor amigo y la despedida te toca a ti. El grupo ya habla de Las Vegas.', [
    'Escaquearte',
    'Algo sencillo, aquí',
    'A lo grande, en Las Vegas',
  ]),
  career_linkedin_post: c('El post de LinkedIn', 'Has escrito un post sobre «lo que aprendí cuando todo salió mal». Solo falta darle a publicar.', [
    'Borrarlo',
    ['Publicarlo', 'Se comparte miles de veces. Te escriben dos empresas.', 'Unos cuantos likes y contactos nuevos.', 'Tus compañeros lo leen en voz alta en la oficina.'],
  ]),
  life_podcast: c('Te invitan a un pódcast', 'Un pódcast de finanzas personales quiere entrevistarte. Saben que entiendes de dinero.', [
    'Decir que no',
    ['Ir tal cual', 'Buena charla. Te escriben oyentes.', 'Un corte de diez segundos tuyo diciendo una barbaridad se hace viral.'],
    ['Prepararlo a fondo', 'Te preparaste las cifras y se nota.', 'Aun así, alguien recorta la frase equivocada.'],
  ]),
  career_ai_agent: c('Una IA para tu puesto', 'La empresa prueba un agente de IA que hace buena parte de tu trabajo. Tú eres quien debe enseñarle.', [
    ['Seguir como siempre', 'La prueba no convence. Todo sigue igual.', 'Funciona. Te recolocan en algo peor pagado.'],
    'Aprender a manejarla',
    ['Volcarte en lo que no hace la máquina', 'Tratar con personas sigue siendo cosa tuya.', 'La máquina también aprende a negociar.'],
  ]),
  life_gig_apps: c('Fines de semana con una app', 'Las apps de reparto y de coche con conductor buscan gente para los fines de semana.', [
    'Descansar el fin de semana',
    'Repartir en bici',
    ['Conducir con tu coche', 'Dos años de carreras sin un rasguño.', 'Un golpe tonto en una rotonda. El seguro no cubre el trabajo.'],
  ]),
  inv_copy_trading: c('Copiar a un trader', 'Un trader de redes enseña un 400 % en un año. Una app copia sus operaciones automáticamente en tu cuenta.', [
    'No tocarlo',
    ['Probar con poco', 'Sale bien. De momento.', 'Recuperas la mitad.', 'El trader borra la cuenta. Y tu dinero con ella.'],
    ['Ir en serio', 'Triplicas lo que pusiste.', 'Recuperas la mitad.', 'El trader borra la cuenta. Y tu dinero con ella.'],
  ]),
  luck_hacked: c('Te han hackeado', 'Te roban el correo y piden un rescate por tus fotos y tus documentos.', [
    'Cambiar todas las claves y empezar de cero',
    ['Pagar el rescate', 'Te devuelven el acceso.', 'Pagas, y aun así publican algunas fotos.'],
    ['Denunciarlo', 'La policía cierra la cuenta de los ladrones a tiempo.', 'Antes de que hagan nada, tus fotos ya circulan.'],
  ]),
  fam_signal_group: c('El grupo de tu suegro', 'Tu suegro te añade a un grupo de WhatsApp que invierte siguiendo las «señales» de un gurú anónimo.', [
    'Silenciar el grupo',
    'Salirte del grupo',
    ['Seguir las señales', 'Una señal sale bien. Tu suegro te lo recuerda en cada comida.', 'Casi todo se pierde. Nadie en el grupo vuelve a hablar del tema.'],
  ]),
  house_remote_outskirts: c('Una casa a una hora, con fibra', 'Teletrabajas y pagas alquiler en la ciudad. A una hora hay casas con jardín y fibra por menos de la mitad.', [
    'Seguir en la ciudad',
    'Comprar una casa en las afueras',
  ]),
  house_back_home: c('Volver a casa de tus padres', 'Pasados los treinta y con las cuentas justas, tus padres te ofrecen tu antigua habitación. Sin alquiler.', [
    'Seguir de alquiler',
    'Volver un par de años',
    'Volver solo un año',
  ]),
  life_midlife: c('La crisis de los cuarenta', 'Te miras al espejo y algo tiene que cambiar. Ya.', [
    'Ir a terapia',
    'Moto, tatuaje y un viaje',
    'Pedir una excedencia y dar la vuelta al mundo',
  ]),
  fam_grandchild: c('Tu primer nieto', 'Vas a ser abuelo o abuela. Los padres primerizos están agotados y algo justos de dinero.', [
    'Felicitarles y ya',
    'Ayudarles con dinero',
    'Cuidar del bebé unos días a la semana',
  ]),
  life_black_card: c('La tarjeta negra', 'El banco te ofrece su tarjeta más exclusiva: metal pesado, sala VIP en los aeropuertos y una cuota anual a juego.', [
    'No, gracias',
    'Aceptarla',
    'Aceptarla y estrenarla a lo grande',
  ]),
  fam_piggy_bank: c('La hucha', 'Tu hijo ha roto la hucha y quiere «invertir como los mayores».', [
    'Guardarlo en un cajón',
    'Abrirle una cuenta en un fondo indexado',
    'Enseñarle cómo funciona el dinero',
  ]),
  house_lift_levy: c('La comunidad vota una mejora', 'Los vecinos votan poner ascensor y arreglar los accesos. Toca derrama, y la casa valdrá más.', [
    ['Votar en contra', 'No sale adelante. Hasta la próxima junta.', 'Sale igualmente. Pagas tu parte.'],
    'Votar a favor',
  ]),
  biz_street_contest: c('El concurso del barrio', 'El barrio premia la mejor terraza y el mejor escaparate. El premio son clientes.', [
    'No participar',
    ['Ir a por el premio', 'Ganas. Sales en el periódico del barrio y se nota en caja.', 'Quedas a mitad de tabla. Algo de clientela nueva, al menos.'],
  ]),
  career_xmas_dinner: c('La cena de Navidad', 'La cena de empresa va por el tercer vino. El jefe está solo en la barra.', [
    'Irte pronto',
    'Quedarte y hacer contactos',
    ['Decirle al jefe lo que piensas', 'Te escucha, y en enero te sube el sueldo.', 'Mañana nadie te mira a los ojos.', 'En enero te apartan de los proyectos buenos. Y del bonus.'],
  ]),
  career_sabbatical: c('Un año sabático', 'La empresa ofrece un año sin sueldo a quien quiera. Te guardan el puesto. O uno parecido.', [
    'No, gracias',
    ['Tomarte el año', 'Vuelves al mismo sitio, con otra cara.', 'Tu puesto ya lo hace otro. Te dan uno algo peor.'],
  ]),
  career_credit_stolen: c('Se lleva tu mérito', 'Un compañero presenta tu proyecto como suyo en la reunión con dirección.', [
    'Callarte',
    ['Enfrentarte a él', 'Lo aclaras delante de todos. Dirección toma nota.', 'Queda como una pelea. Nadie sale bien.'],
    ['Ir a Recursos Humanos con pruebas', 'Las pruebas hablan. El proyecto vuelve a ser tuyo.', 'Te dicen que «es cosa del equipo».'],
  ]),
  luck_office_pool: c('La quiniela de la oficina', 'Todos ponen veinte y el boleto lo guardas tú. Ha tocado.', [
    'Repartir el premio',
    ['Decir que no ha tocado', 'Nadie lo comprueba nunca.', 'Alguien lo comprueba.'],
  ]),
  life_cooking_show: c('Un concurso de cocina en la tele', 'Buscan concursantes para un programa de cocina. Tus amigos dicen que tu tortilla merece la tele.', [
    'Dejarlo estar',
    ['Presentarte', 'Ganas. Premio y entrevistas.', 'Llegas lejos. Te conocen en el barrio.', 'Se te quema la tortilla en directo.'],
    ['Presentarte y entrenar a fondo', 'Ganas. Premio y entrevistas.', 'Llegas lejos. Te conocen en el barrio.', 'Los nervios pueden más.'],
  ]),
  luck_viral_bad: c('Viral, para mal', 'Alguien grabó tu discusión en un bar y el vídeo da la vuelta al mundo. Ya tienes apodo.', [
    'Desaparecer de las redes',
    ['Pedir perdón en un vídeo', 'La gente te perdona. Hasta te cae bien.', 'Nadie lo ve. El original sigue circulando.'],
    ['Aprovecharlo y vender camisetas', 'Las camisetas se agotan. Dos veces.', 'Vendes unas cuantas. La fama, entera.'],
  ]),
  biz_influencer_review: c('Un influencer quiere comer gratis', 'Un influencer de la zona te ofrece una reseña estupenda a cambio de comer gratis todo el año.', [
    ['Decirle que no', 'No pasa nada. Ni se acuerda.', 'Publica una reseña horrible. Por despecho.'],
    ['Aceptar el trato', 'La reseña funciona: hay cola en la puerta.', 'Unos cuantos clientes nuevos. Y un comensal fijo.'],
  ]),
  health_smartwatch: c('El reloj te avisa', 'Tu reloj inteligente te avisa de un ritmo cardíaco raro. Dos veces esta semana.', [
    ['Pensar que el reloj exagera', 'Exageraba.', 'No exageraba. Un susto en urgencias.'],
    'Ir al médico a que lo miren',
  ]),
  house_festival_rental: c('Llega el festival', 'Un festival enorme llega a la ciudad y te ofrecen una fortuna por tu casa durante una semana.', [
    'Quedarte en casa',
    ['Alquilarla esa semana', 'Te la devuelven impecable. Hasta con flores.', 'Te la devuelven con una fiesta dentro. Toca pintar.'],
  ]),
  fam_school_treasurer: c('Las cuentas del AMPA', 'El grupo de padres del colegio te propone llevar las cuentas. Nadie más levanta la mano.', [
    'Escaquearte',
    'Aceptar',
    'Aceptar y organizar la fiesta de fin de curso',
  ]),
  luck_drone_crash: c('Un dron en tu terraza', 'Un dron se estrella en tu terraza. Su dueño llama al timbre y ofrece pagarte para que no lo denuncies.', [
    'Devolverle el dron sin más',
    'Aceptar el dinero',
    ['Denunciarlo', 'Te indemnizan por los daños, y bien.', 'La denuncia se pierde en un cajón.'],
  ]),
  life_concert: c('Tu grupo favorito toca en la ciudad', 'Las entradas se agotaron en un minuto. Quedan las de reventa, al triple.', [
    'Quedarte sin ir',
    'Pagar la reventa',
    'Pista, primera fila y fiesta después',
  ]),
  luck_police_auction: c('La subasta de la policía', 'La policía subasta lo que ha requisado: coches, relojes, hasta un jet ski.', [
    'Mirar y no pujar',
    ['Pujar por un coche', 'Lo revendes con beneficio en un mes.', 'Era un cacharro. Lo vendes por piezas.'],
    ['Pujar por un reloj de lujo', 'Auténtico. Y en tu muñeca.', 'Falso. Lo revendes como falso.'],
  ]),
  house_protected_flat: c('Te toca un piso protegido', 'Te ha tocado el sorteo de vivienda protegida: un piso a un precio muy por debajo del de mercado.', [
    'Renunciar',
    'Comprarlo',
  ]),
  career_startup_advisor: c('Asesor a cambio de acciones', 'Una startup te pide consejo financiero los fines de semana. No pueden pagarte: te ofrecen acciones.', [
    'Decir que no',
    ['Aceptar las acciones', 'La startup cierra. Las acciones no valen nada.', 'Una empresa grande la compra. Te toca algo.', 'Se convierte en una de las grandes. Tus acciones también.'],
  ]),
  house_upstairs_leak: c('El vecino de arriba te inunda', 'Se rompe una tubería en el piso de arriba y tu techo gotea. Su seguro dice que pagará. Algún día.', [
    ['Esperar a que pague su seguro', 'El seguro paga y la obra se hace.', 'Meses de humedad. Al final, parte de la obra la pagas tú.'],
    ['Adelantar la obra tú', 'El seguro te lo devuelve todo.', 'El seguro encuentra una cláusula. Pagas tú.'],
  ]),
};
