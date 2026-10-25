# Google Play: seguridad de los datos, contenido y público

Borrador para copiar en Play Console (App content). Los nombres de los campos van en inglés, como los muestra la consola; lo demás en español.
Hecho a partir del código el 2026-10-25 (app 1.0.0, motor 0.44, contenido 1.49) y de la página legal (`/en/legal`). Si algo de lo que guarda el
juego cambia, hay que cambiar esto y la página legal a la vez.

## Data safety

### Data collection and security

| Pregunta | Respuesta |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (todo va por https a Supabase; los avisos, por Expo y Google FCM, también https) |
| Which of the following methods of account creation does your app support? | **OAuth** (Google) y **Other**: «una cuenta de invitado anónima se crea sola al abrir el juego» |
| Do you provide a way for users to request that their data is deleted? | **Yes** |
| Delete account URL | `https://ratrace-plum.vercel.app/en/legal#delete` |

### Data types

Nada se **comparte** (shared): Supabase, Expo (avisos) y Google (inicio de sesión, FCM) son proveedores que tratan los datos por nosotros, y Play
no cuenta eso como compartir. Que el apodo y la rata se vean en rankings y partidas es parte del juego, no compartir con terceros. Sin anuncios
ni SDK de terceros de analítica o publicidad.

Nada se trata solo de forma efímera (ephemeral: **No** en todos): todo se guarda.

| Categoría → tipo | Collected | Shared | Required / Optional | Purposes | De dónde sale |
|---|---|---|---|---|---|
| Personal info → **Name** | Yes | No | Optional | App functionality, Account management | El apodo que el jugador elige (se ve en rankings y partidas), y el nombre de Google si guarda la cuenta con Google |
| Personal info → **Email address** | Yes | No | Optional | Account management | Solo si guarda la cuenta con Google |
| Personal info → **User IDs** | Yes | No | Required | App functionality, Account management | El id de la cuenta (de invitado o de Google) y el código de amigo |
| App activity → **Other actions** | Yes | No | Required | App functionality | Las vidas, los récords, la rata, los amigos y las partidas con otros: se guardan en la cuenta para jugar en cualquier dispositivo |
| App activity → **App interactions** | Yes | No | Required | Analytics | Recuentos anónimos de ocho cosas (vidas empezadas y acabadas por modo, retos, partidas con otros empezadas y unidas, cuentas guardadas, instalaciones, compartidos), por día y plataforma, sin id ni nada de quién (`private.app_events`) |
| App info and performance → **Crash logs** | Yes | No | Required | App functionality, Analytics | Errores técnicos sin nada personal (se quitan correos, ids, tokens, IPs y números largos antes de enviarlos), sin cuenta asociada |
| App info and performance → **Diagnostics** | Yes | No | Required | App functionality | Con cada error: la versión de la app y el nombre y versión del sistema |
| Device or other IDs → **Device or other IDs** | Yes | No | Optional | App functionality | El token de avisos de Expo, solo si el jugador acepta los avisos |

Lo que **no** se recoge: ubicación, contactos del teléfono, fotos (la app solo *añade* la imagen de una vida a la galería cuando el jugador lo pide,
sin leer nada), audio, archivos, calendario, salud, datos financieros reales, historial web, apps instaladas, id de publicidad.

La política de privacidad (`/en/legal`, la página legal de la web) nombra a todos los que tratan datos, también Expo y Google FCM, que llevan los
avisos de la app del teléfono (actualizada el 2026-10-25). La app muestra su propia versión (`phone.legal`), con lo mismo dicho para el teléfono.

## Otros apartados de App content

| Apartado | Respuesta |
|---|---|
| Privacy policy | `https://ratrace-plum.vercel.app/en/legal` |
| Ads | **No, my app does not contain ads** |
| App access | **All functionality is available without special access** (el invitado entra solo; Google es opcional) |
| Target audience and content | **13–15, 16–17 y 18+** (decidido: no menores de 13; la página legal pide a los menores de 14 que avisen a sus padres antes de entrar con Google, y el juego no está hecho para niños). **Appeals to children: No.** Así no entra en la política de Familias. |
| News app | **No** |
| Government app | **No** |
| Financial features | **My app doesn't provide any financial features** (es un juego: el dinero es ficticio y no se compra nada) |
| Health | **No** |
| Data deletion (en la ficha) | La misma URL de borrado de arriba |

### Content rating (cuestionario IARC)

Categoría: **Game**. Respuestas propuestas:

| Pregunta | Respuesta | Por qué |
|---|---|---|
| Violence | No | |
| Fear / horror | No | |
| Sexuality / nudity | No | |
| Language (palabrotas) | No | |
| Controlled substances (drogas, alcohol, tabaco) | **Sí, referencias** si pregunta por alcohol: hay cartas con vino (una cena, un regalo). Sin consumo mostrado. Si la pregunta es solo de drogas o tabaco: No | 2 menciones de vino en las cartas |
| Gambling: real money | No | |
| Simulated gambling | **No** | No hay casino, póquer ni tragaperras. Hay inversiones y una lotería de vivienda protegida (un sorteo de piso), que no es apostar |
| Crude humor | No | |
| Users can interact / exchange content | **Yes** | Rankings con apodo y rata, amigos por código, partidas con otros. **Sin chat** ni texto libre entre jugadores salvo el apodo |
| Shares user location | No | |
| Digital purchases | No | |
| Unrestricted internet access | No | |

Resultado esperado: PEGI 3 / 7 o Everyone, con «Users interact».
