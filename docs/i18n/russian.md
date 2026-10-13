# Russian: how the game is written

For whoever adds or changes Russian text: `apps/web/messages/ru.json`, `packages/content/src/text/ru*.ts`, the Russian names in `packages/content/src/names.ts`, and the Russian terminal strings in `tools/play`. The tests hold the mechanical rules (keys, placeholders, plurals, typesetting, lengths). This page holds the ones a test cannot check.

## Voice

- The game speaks to the player as **ты**, never вы. Short sentences. Dry, a little wry, never cute. Translate what the line does, not its words: an English idiom becomes a Russian one, or a plain sentence.
- **Never give the player a gender.** The player may be anyone. No past-tense verb, short adjective or participle that agrees with «ты»: not «ты купил», «ты готов», «ты уволен». Say it another way:
  - present or future: «Ты выходишь из бегов», «Ты получишь…»
  - an impersonal or dative turn: «Тебе удалось…», «Тебе отказали», «У тебя не осталось…», «Пришлось продать…»
  - a noun: «Банкротство», «Повышение», «Ты — банкрот» (a noun is fine)
  - the thing as subject: «Сделка сорвалась», «Зарплата выросла»
- Other people in a card may have a gender if the sentence needs one, but prefer words that do not force it: «начальство», «коллеги», «партнёр» (used for either), «вторая половина».
- Names of lives and jobs follow the Spanish where the Spanish chose a gender (Enfermera → «Медсестра»); otherwise the usual dictionary form («Разработчик», «Курьер»).
- No exclamation marks the English does not have. No emoji. No anglicisms where a Russian word is as short («заявка» not «ордер»), but the money words people really use stay: «крипта», «ипотека», «дивиденды», «индексный фонд».

## Numbers and their nouns

Russian nouns change with the number: 1 год, 2 года, 5 лет; and again after a preposition: с 21 года, с 22 лет.

- Where a sentence counts something, use ICU plural with **all four** branches: `{n, plural, one {# год} few {# года} many {# лет} other {# года}}`. `other` is what a fraction takes (2,5 года). An `=0` branch may be kept where English has one.
- A plain `{n}` can be turned into a plural only if the code passes a number (look at the call: `t('key', { n: … })`). An amount of money, a rate or anything the code has already formatted is a string, and stays `{amount}`.
- Where a number cannot be made to agree, turn the sentence so it does not have to: «Раунд {n} из {total}», «Осталось фокуса: {left} из {total}», «Возраст: {age}».
- Content text (`ru*.ts`) has no plural syntax at all: write sentences that hold no variable count.

## Names that are put into a sentence

A name the code puts into a placeholder arrives as it is, in the nominative: a city (`{city}`, `{city:london}`), a life, a career, a home, a thing, an asset. Russian would decline it; the code cannot. Build the sentence so the name stands in the nominative, or reads naturally undeclined:

- «Жильё: {city}» or «Жильё в городе {city}», not «Жильё в {city}».
- «Переезд в {city}» is fine: for these six cities the accusative is the nominative.
- «{life}, {age} …, {city}», with commas, where English says "in {city}".

## Typesetting

- Quotes are «ёлочки»; inside them „лапки“. Never straight `"` or English “ ”.
- A dash is ` — ` (em dash with spaces), never a spaced hyphen. An ellipsis is one character: `…`.
- **ё** is always written: всё, ещё, жильё, партнёр, заём, учёба.
- The percent sign stands against its number: `{pct}%`, 10%.
- Money, rates and big numbers are formatted by the code (`1 200 $`, `2,5%`, `948 тыс. $`): never write a currency sign or a thousands separator by hand around a placeholder. Fixed amounts inside a sentence are written the Russian way: `1 000 000 $` with a no-break space (U+00A0) between groups and before the sign.
- «в год» for "a year" and "per year"; the short form after an amount is `{amount}/год`.
- No full stop at the end of a label, a button or a title. Sentences end with one.
- Brand and product names stay in Latin letters as the name pack gives them (Rolex, Tesla, S&P 500). Cities are Russian: Мадрид, Лондон, Нью-Йорк, Дубай, Сингапур, Бангкок.
- The game's own name stays **The Rat Race**.

## Words

One English word, one Russian word, everywhere.

| English | Russian | Note |
|---|---|---|
| the rat race | крысиные бега | «выйти из крысиных бегов»; short label: «Выход из бегов» |
| round | раунд | two years |
| life (a game) | жизнь | «Новая жизнь», «Выбери жизнь» |
| ranked life | рейтинговая жизнь | |
| rankings | рейтинги | all time: «За всё время»; this week: «Эта неделя»; friends: «Друзья» |
| records | рекорды | |
| collection | коллекция | |
| badge | значок | |
| card | карта | |
| choice / option | выбор / вариант | |
| order (a thing queued for the round) | план | «Планы на раунд», 1 план, 2 плана, 5 планов |
| play the round | сыграть раунд | |
| cash | наличные | |
| savings | сбережения | |
| flow (cash flow) | поток | long form: денежный поток |
| net worth | чистый капитал | never «стоимость» |
| wealth (part of the score) | богатство | |
| status | статус | |
| score | очки | never «счёт»: in a game about money that is a bank account |
| focus | фокус | uncountable: «+1 к фокусу», «фокуса осталось: 2 из 3» |
| career skill | карьерный навык | |
| finance skill | финансовый навык | |
| salary / pay | зарплата | |
| overtime | сверхурочные | |
| study | учёба | button: «Учиться» |
| job hunt | поиск работы | |
| promotion / demotion | повышение / понижение | |
| passive income | пассивный доход | |
| living costs | расходы на жизнь | |
| lifestyle | образ жизни | tab: «Жизнь» |
| home (where you live) | жильё | a house or flat bought: «дом», «квартира» as the content says |
| property | недвижимость | |
| rent (you pay) | аренда | |
| to rent out / let | сдавать | «Сдаётся», «Сдать» |
| mortgage | ипотека | fixed: «фиксированная», variable: «плавающая» |
| down payment | первый взнос | |
| personal loan | потребительский кредит | short: «кредит» |
| credit card | кредитная карта | |
| debt | долг | tab: «Долги» |
| bankruptcy / bankrupt | банкротство / банкрот | |
| pension plan | пенсионный план | |
| index fund | индексный фонд | |
| government bonds | гособлигации | |
| stocks / shares | акции | |
| crypto | крипта | |
| gold | золото | |
| portfolio | портфель | |
| market | рынок | |
| shop | магазин | |
| taxes | налоги | income tax: «подоходный налог» |
| interest rates | ставки | |
| inflation | инфляция | |
| economy | экономика | |
| crisis | кризис | |
| news / headline | новости / заголовок | |
| insurance | страховка | |
| guide (first-life tips) | подсказки | |
| settings | настройки | |
| account | аккаунт | |
| guest | гость | |
| device | устройство | |
| server | сервер | |
| friend code | код друга | |
| to follow (a player) | подписаться | «Подписки», «Отписаться» |
| name (nickname) | имя | |
| partner | партнёр | |
| child / children | ребёнок / дети | |
| escape (the rat race) | выход из бегов | «вне бегов с {age} …» needs a plural |
| the end | конец | |
