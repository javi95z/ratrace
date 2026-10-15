/**
 * What each kind of home is called in each city: the same eleven steps of the property ladder, as
 * the city has them. A kind a city does not name goes by its plain name. Places are written as the
 * player of each language would.
 */
type CityHomes = Record<string, Record<string, string>>;

export const cityHomesEs: CityHomes = {
  madrid: {
    studio: 'Estudio en Lavapiés', flat: 'Piso en Chamberí', loft: 'Loft en Malasaña', townhouse: 'Adosado en Las Rozas', house: 'Casa en Aravaca', duplex: 'Dúplex en Chueca',
    chalet: 'Chalet en Pozuelo', penthouse: 'Ático en Salamanca', estate: 'Finca en la sierra', villa: 'Villa en La Finca', mansion: 'Palacete en El Viso',
  },
  london: {
    studio: 'Estudio en la zona 3', flat: 'Piso en Islington', loft: 'Loft en Shoreditch', townhouse: 'Casa adosada en Clapham', house: 'Casa en Wimbledon', duplex: 'Dúplex en Camden',
    chalet: 'Casa de campo en los Cotswolds', penthouse: 'Ático en South Bank', estate: 'Finca en Surrey', villa: 'Villa en Hampstead', mansion: 'Mansión en Kensington',
  },
  new_york: {
    studio: 'Estudio sin ascensor en Queens', flat: 'Piso en Brooklyn', loft: 'Loft en SoHo', townhouse: 'Brownstone en Harlem', house: 'Casa en Staten Island', duplex: 'Dúplex en el Village',
    chalet: 'Cabaña en los Catskills', penthouse: 'Ático en la Quinta Avenida', estate: 'Finca en los Hamptons', villa: 'Villa en Westchester', mansion: 'Mansión en el Upper East Side',
  },
  dubai: {
    studio: 'Estudio en JLT', flat: 'Piso en la Marina', loft: 'Loft en Business Bay', townhouse: 'Adosado en Arabian Ranches', house: 'Casa en Mirdif', duplex: 'Dúplex en Downtown',
    chalet: 'Refugio en el desierto de Al Qudra', penthouse: 'Ático en Sheikh Zayed Road', estate: 'Finca en Emirates Hills', villa: 'Villa en Palm Jumeirah', mansion: 'Mansión en Jumeirah Bay',
  },
  singapore: {
    studio: 'Estudio en Geylang', flat: 'Piso HDB en Tampines', loft: 'Loft en Tanjong Pagar', townhouse: 'Shophouse en Tiong Bahru', house: 'Casa en Serangoon', duplex: 'Dúplex en Novena',
    chalet: 'Casa colonial en Alexandra', penthouse: 'Ático en Marina Bay', estate: 'Bungaló en Bukit Timah', villa: 'Villa en Sentosa', mansion: 'Gran bungaló en Nassim Road',
  },
  bangkok: {
    studio: 'Estudio en On Nut', flat: 'Condo en Sukhumvit', loft: 'Loft en Ari', townhouse: 'Shophouse en Chinatown', house: 'Casa en Bang Na', duplex: 'Dúplex en Thonglor',
    chalet: 'Casa de teca en Nonthaburi', penthouse: 'Ático junto al río', estate: 'Finca en Hua Hin', villa: 'Villa con piscina en Ekkamai', mansion: 'Mansión en Sathorn',
  },
  tokyo: {
    studio: 'Estudio en Koenji', flat: 'Piso en Nakameguro', loft: 'Loft en Kuramae', townhouse: 'Casa estrecha en Shimokitazawa', house: 'Casa en Setagaya', duplex: 'Dúplex en Ebisu',
    chalet: 'Refugio en Hakone', penthouse: 'Ático en Roppongi', estate: 'Finca en Karuizawa', villa: 'Villa en Hayama', mansion: 'Mansión en Den-en-chofu',
  },
  moscow: {
    studio: 'Estudio en una jrushchovka de Biriuliovo', flat: 'Piso en Marino', loft: 'Loft en Krasny Oktiabr', townhouse: 'Adosado en Kommunarka', house: 'Dacha en Peredélkino', duplex: 'Dúplex en Patriarshie Prudí',
    chalet: 'Cabaña de troncos junto al Volga', penthouse: 'Ático en Moscow City', estate: 'Finca en Barvija', villa: 'Villa en la Rubliovka', mansion: 'Palacete en Ostozhenka',
  },
  mexico_city: {
    studio: 'Cuarto de azotea en Iztapalapa', flat: 'Depa en la Narvarte', loft: 'Loft en la Roma', townhouse: 'Casa colonial en Coyoacán', house: 'Casa en Ciudad Satélite', duplex: 'Dúplex en la Condesa',
    chalet: 'Casa de fin de semana en Valle de Bravo', penthouse: 'Penthouse en Polanco', estate: 'Hacienda en Morelos', villa: 'Villa en Lomas de Chapultepec', mansion: 'Mansión en San Ángel',
  },
  zurich: {
    studio: 'Estudio en Schwamendingen', flat: 'Piso en Wiedikon', loft: 'Loft en Zürich-West', townhouse: 'Casa en el casco antiguo', house: 'Casa en Küsnacht', duplex: 'Dúplex en Seefeld',
    chalet: 'Chalet en los Alpes', penthouse: 'Ático junto a la Prime Tower', estate: 'Finca en la Costa Dorada del lago', villa: 'Villa en el Zürichberg', mansion: 'Mansión a orillas del lago',
  },
};

export const cityHomesEn: CityHomes = {
  madrid: {
    studio: 'Studio in Lavapiés', flat: 'Flat in Chamberí', loft: 'Loft in Malasaña', townhouse: 'Townhouse in Las Rozas', house: 'House in Aravaca', duplex: 'Duplex in Chueca',
    chalet: 'Chalet in Pozuelo', penthouse: 'Penthouse in Salamanca', estate: 'Estate in the sierra', villa: 'Villa in La Finca', mansion: 'Mansion in El Viso',
  },
  london: {
    studio: 'Studio in Zone 3', flat: 'Flat in Islington', loft: 'Loft in Shoreditch', townhouse: 'Terraced house in Clapham', house: 'House in Wimbledon', duplex: 'Maisonette in Camden',
    chalet: 'Cottage in the Cotswolds', penthouse: 'Penthouse on the South Bank', estate: 'Estate in Surrey', villa: 'Villa in Hampstead', mansion: 'Mansion in Kensington',
  },
  new_york: {
    studio: 'Walk-up in Queens', flat: 'Apartment in Brooklyn', loft: 'Loft in SoHo', townhouse: 'Brownstone in Harlem', house: 'House on Staten Island', duplex: 'Duplex in the Village',
    chalet: 'Cabin in the Catskills', penthouse: 'Penthouse on Fifth Avenue', estate: 'Estate in the Hamptons', villa: 'Villa in Westchester', mansion: 'Mansion on the Upper East Side',
  },
  dubai: {
    studio: 'Studio in JLT', flat: 'Apartment in the Marina', loft: 'Loft in Business Bay', townhouse: 'Townhouse in Arabian Ranches', house: 'House in Mirdif', duplex: 'Duplex in Downtown',
    chalet: 'Desert retreat in Al Qudra', penthouse: 'Penthouse on Sheikh Zayed Road', estate: 'Estate in Emirates Hills', villa: 'Villa on Palm Jumeirah', mansion: 'Mansion on Jumeirah Bay',
  },
  singapore: {
    studio: 'Studio in Geylang', flat: 'HDB flat in Tampines', loft: 'Loft in Tanjong Pagar', townhouse: 'Shophouse in Tiong Bahru', house: 'Terrace in Serangoon', duplex: 'Duplex in Novena',
    chalet: 'Black-and-white in Alexandra', penthouse: 'Penthouse at Marina Bay', estate: 'Bungalow in Bukit Timah', villa: 'Villa on Sentosa', mansion: 'Good Class Bungalow on Nassim Road',
  },
  bangkok: {
    studio: 'Studio in On Nut', flat: 'Condo on Sukhumvit', loft: 'Loft in Ari', townhouse: 'Shophouse in Chinatown', house: 'House in Bang Na', duplex: 'Duplex in Thonglor',
    chalet: 'Teak house in Nonthaburi', penthouse: 'Riverside penthouse', estate: 'Estate in Hua Hin', villa: 'Pool villa in Ekkamai', mansion: 'Mansion in Sathorn',
  },
  tokyo: {
    studio: 'Studio in Koenji', flat: 'Flat in Nakameguro', loft: 'Loft in Kuramae', townhouse: 'Narrow house in Shimokitazawa', house: 'House in Setagaya', duplex: 'Duplex in Ebisu',
    chalet: 'Retreat in Hakone', penthouse: 'Penthouse in Roppongi', estate: 'Estate in Karuizawa', villa: 'Villa in Hayama', mansion: 'Mansion in Den-en-chofu',
  },
  moscow: {
    studio: 'Studio in a Biryulyovo khrushchyovka', flat: 'Flat in Maryino', loft: 'Loft at Krasny Oktyabr', townhouse: 'Townhouse in Kommunarka', house: 'Dacha in Peredelkino', duplex: 'Duplex on the Patriarch\'s Ponds',
    chalet: 'Log cabin on the Volga', penthouse: 'Penthouse in Moscow City', estate: 'Estate in Barvikha', villa: 'Villa on the Rublyovka', mansion: 'Mansion on the Ostozhenka',
  },
  mexico_city: {
    studio: 'Rooftop room in Iztapalapa', flat: 'Flat in Narvarte', loft: 'Loft in Roma', townhouse: 'Colonial house in Coyoacán', house: 'House in Ciudad Satélite', duplex: 'Duplex in Condesa',
    chalet: 'Weekend house in Valle de Bravo', penthouse: 'Penthouse in Polanco', estate: 'Hacienda in Morelos', villa: 'Villa in Lomas de Chapultepec', mansion: 'Mansion in San Ángel',
  },
  zurich: {
    studio: 'Studio in Schwamendingen', flat: 'Flat in Wiedikon', loft: 'Loft in Zürich-West', townhouse: 'Old-town house', house: 'House in Küsnacht', duplex: 'Duplex in Seefeld',
    chalet: 'Chalet in the Alps', penthouse: 'Penthouse by the Prime Tower', estate: 'Estate on the Gold Coast', villa: 'Villa on the Zürichberg', mansion: 'Lakeside mansion',
  },
};

export const cityHomesRu: CityHomes = {
  madrid: {
    studio: 'Студия в Лавапьес', flat: 'Квартира в Чамбери', loft: 'Лофт в Маласанье', townhouse: 'Таунхаус в Лас-Росас', house: 'Дом в Араваке', duplex: 'Дуплекс в Чуэке',
    chalet: 'Шале в Посуэло', penthouse: 'Пентхаус в Саламанке', estate: 'Поместье в горах', villa: 'Вилла в Ла-Финке', mansion: 'Особняк в Эль-Висо',
  },
  london: {
    studio: 'Студия в третьей зоне', flat: 'Квартира в Ислингтоне', loft: 'Лофт в Шордиче', townhouse: 'Таунхаус в Клэпеме', house: 'Дом в Уимблдоне', duplex: 'Дуплекс в Камдене',
    chalet: 'Коттедж в Котсуолдсе', penthouse: 'Пентхаус на Саут-Бэнк', estate: 'Поместье в Суррее', villa: 'Вилла в Хэмпстеде', mansion: 'Особняк в Кенсингтоне',
  },
  new_york: {
    studio: 'Студия без лифта в Квинсе', flat: 'Квартира в Бруклине', loft: 'Лофт в Сохо', townhouse: 'Браунстоун в Гарлеме', house: 'Дом на Статен-Айленде', duplex: 'Дуплекс в Виллидже',
    chalet: 'Хижина в Катскиллах', penthouse: 'Пентхаус на Пятой авеню', estate: 'Поместье в Хэмптонсе', villa: 'Вилла в Уэстчестере', mansion: 'Особняк в Верхнем Ист-Сайде',
  },
  dubai: {
    studio: 'Студия в JLT', flat: 'Квартира в Марине', loft: 'Лофт в Бизнес-Бэй', townhouse: 'Таунхаус в Арабиан-Ранчес', house: 'Дом в Мирдифе', duplex: 'Дуплекс в Даунтауне',
    chalet: 'Дом в пустыне Аль-Кудра', penthouse: 'Пентхаус на Шейх-Зайед-роуд', estate: 'Поместье в Эмирейтс-Хиллс', villa: 'Вилла на Пальме Джумейра', mansion: 'Особняк на Джумейра-Бэй',
  },
  singapore: {
    studio: 'Студия в Гейланге', flat: 'Квартира HDB в Тампинесе', loft: 'Лофт в Танджонг-Пагаре', townhouse: 'Шопхаус в Тионг-Бару', house: 'Дом в Серангуне', duplex: 'Дуплекс в Новене',
    chalet: 'Колониальный дом в Александре', penthouse: 'Пентхаус в Марина-Бэй', estate: 'Бунгало в Букит-Тима', villa: 'Вилла на Сентозе', mansion: 'Большое бунгало на Нассим-роуд',
  },
  bangkok: {
    studio: 'Студия в Он-Нут', flat: 'Кондо на Сукхумвите', loft: 'Лофт в Ари', townhouse: 'Шопхаус в Чайнатауне', house: 'Дом в Банг-На', duplex: 'Дуплекс в Тхонглоре',
    chalet: 'Тиковый дом в Нонтхабури', penthouse: 'Пентхаус у реки', estate: 'Поместье в Хуахине', villa: 'Вилла с бассейном в Эккамае', mansion: 'Особняк в Саторне',
  },
  tokyo: {
    studio: 'Студия в Коэндзи', flat: 'Квартира в Накамэгуро', loft: 'Лофт в Курамаэ', townhouse: 'Узкий дом в Симокитадзаве', house: 'Дом в Сэтагае', duplex: 'Дуплекс в Эбису',
    chalet: 'Дом в горах Хаконэ', penthouse: 'Пентхаус в Роппонги', estate: 'Поместье в Каруидзаве', villa: 'Вилла в Хаяме', mansion: 'Особняк в Дэнъэнтёфу',
  },
  moscow: {
    studio: 'Студия в хрущёвке в Бирюлёве', flat: 'Квартира в Марьине', loft: 'Лофт на «Красном Октябре»', townhouse: 'Таунхаус в Коммунарке', house: 'Дача в Переделкине', duplex: 'Дуплекс на Патриарших',
    chalet: 'Бревенчатый дом на Волге', penthouse: 'Пентхаус в «Москва-Сити»', estate: 'Поместье в Барвихе', villa: 'Вилла на Рублёвке', mansion: 'Особняк на Остоженке',
  },
  mexico_city: {
    studio: 'Комната на крыше в Истапалапе', flat: 'Квартира в Нарварте', loft: 'Лофт в Роме', townhouse: 'Колониальный дом в Койоакане', house: 'Дом в Сьюдад-Сателите', duplex: 'Дуплекс в Кондесе',
    chalet: 'Загородный дом в Валье-де-Браво', penthouse: 'Пентхаус в Поланко', estate: 'Асьенда в Морелосе', villa: 'Вилла в Ломас-де-Чапультепек', mansion: 'Особняк в Сан-Анхеле',
  },
  zurich: {
    studio: 'Студия в Швамендингене', flat: 'Квартира в Видиконе', loft: 'Лофт в Цюрих-Весте', townhouse: 'Дом в старом городе', house: 'Дом в Кюснахте', duplex: 'Дуплекс в Зеефельде',
    chalet: 'Шале в Альпах', penthouse: 'Пентхаус у Прайм-тауэр', estate: 'Поместье на Золотом берегу', villa: 'Вилла на Цюрихберге', mansion: 'Особняк на берегу озера',
  },
};
