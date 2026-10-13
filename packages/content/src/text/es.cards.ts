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
  house_refinance: c('Fija o variable', 'Tu banco te cambia la hipoteca a cambio de una comisión.', [
    'Dejarla como está',
    'Pasarla a tipo fijo',
    'Pasarla a variable',
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
    'Ir por la pública y esperar',
    'Ir por la privada, ya',
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
    'Fisioterapia',
    'Reposo',
  ]),
  health_gym_habit: c('Apuntarte al gimnasio', 'Hay un {item:member_gym} abajo y te ahogas subiendo las escaleras.', [
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
    'Aislar el piso y olvidarte',
    'Pagarla, y pasar ahorros a oro',
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
  tax_advisor: c('Contratar a un asesor fiscal', 'Una amiga jura que la suya se pagó sola el primer año.', [
    'Hacerlo tú',
    ['Contratar a una', 'Encuentra deducciones que no sabías que existían.', 'Este año no hay nada. Aun así, tienes las espaldas cubiertas.'],
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
};
