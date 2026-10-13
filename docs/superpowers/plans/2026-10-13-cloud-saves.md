# Cloud Saves: Build Plan

Date: 2026-10-13
Spec: `docs/superpowers/specs/2026-10-13-ratrace-online-design.md` (sections 2, 3, 6, 7 "Casual sync", 8, 9 and phase 2 of section 10)
Builds on: the online foundation (roadmap step 11), on branch `online`.

This is roadmap step 12. It records decisions and tasks, not code.

## What this step gives

A player's life in progress, their finished lives and everything they have unlocked are in their account. On a second device they sign in with Google and find them there. Nothing about how the game plays changes: it still plays on the device, with or without a connection.

Not here: ranked games, where the server holds the seed (13), rankings (13), the daily challenge (14), rooms (15).

## Decisions

### The device plays, the cloud follows

- Everything is written on the device first, exactly as today. The cloud is a mirror that is brought up to date in the background. No screen ever waits for it.
- A write that could not reach the cloud is not an error and is not queued one by one: the next thing that syncs sends the whole of what the device has. The device is always enough to rebuild the cloud's copy.
- The account is read when device and account meet: the page opens, the connection comes back, the page is looked at again after a minute or more, someone signs in. Between two meetings a write is only sent, so a card answered costs one request.
- After a failure the mirror tries again by itself, after 30 seconds and then twice as long each time, up to five minutes.
- With no account (no project configured, or sign-in failed) none of this exists and the game is what it is today.
- The store the game writes to is wrapped once more: device, then mirror. Screens still talk to `PlayerStore` and nothing else.

### What goes up

| Thing | When | How |
|---|---|---|
| The life in progress | after every card and every round | the player's own row in `games`: seed, log, round, state hash. Only the latest matters, so a burst of saves sends one, and a life that stands as it did when it was last sent is not sent again |
| What is unlocked (badges, gallery, unlocked lives, the guide) | whenever it changes | the player's own row in `player_progress`, after being merged with what is there |
| A finished life | once, when it ends | the device asks the server to finish it. The server plays the log again and writes the run itself. Lives finished before there was an account go up five at a time. One on versions this build does not play, or one the server will not finish, stays on the device |
| A life given up | when another takes its place | marked `abandoned` in the account, so it is not offered to other devices. Given up with no connection, it is noted in the browser until the account has been told |
| Settings (less motion) | never | they belong to the device |

### A finished life is the server's to write

- Players cannot write `runs`. The device uploads the finished game and calls the `finish-run` function with its id.
- The function reads the game row, which must be the caller's own and casual, plays it again with the bundled engine of its versions, and writes one row in `runs`: score, net worth, status, escape, bankruptcies, the badges and cities of the life, and the net-worth history. Every number is the engine's, none is the device's.
- The run takes the game's id, so finishing twice writes once.
- `verified` now means "the server played this log itself", which is true of every row it writes. Whether the future was secret is what `mode` says: a casual life could be peeked at on its own device, so it will stay off the global rankings of step 13.
- For the server to know the badges of a life, the record of a life (net-worth history, bankruptcies, the journal the badges are judged from) moves from the web app into the content package, next to the badge rules it uses. The web and the server then keep the same record with the same code.
- The two badges that count the gallery across lives ("twenty items", "every car") are not a property of one life, so the server's run does not list them. They stay in the player's progress.

### What comes down, and how two copies become one

This happens when an account starts on a device and when a guest becomes a member.

- **What is unlocked: union.** A badge earned anywhere is earned, with its earliest date. The gallery and the unlocked lives are joined. A tip of the guide seen anywhere is seen; the guide is off if it was turned off anywhere. The result is written to the device and to the cloud. Nothing a player has can be lost by signing in.
- **Finished lives: union by id.** Lives finished on other devices appear in the records. They carry the server's numbers.
- **The life in progress:**
  - The device has none, the cloud has one: the device takes it, and the player finds their life waiting.
  - Both have the same life: the copy with more of it played wins. They are never merged.
  - They have different lives: the device keeps its own, and nothing is replaced behind the player's back. The front door offers "Continue the life in your account", which asks before it ends the one on the device, as starting a new life does. The player can end the life in the account instead.
  - The device has a life that is over: it stays there, where its score can still be looked at, and the cloud's is offered.
  - The device still holds as in progress a life that was lived to the end on another device: it lets go of it, and the result arrives with the finished lives.
  - A game on versions this build does not have is left alone in the cloud. So is a copy that does not play back to a sound life.
  - A life given up on one device while another is still playing it is taken up again by that device's next save. "Abandoned" means "offered to nobody", not "closed"; only a life the server has finished is closed.
- A life taken from the cloud is rebuilt by playing its log again on the device, the same way a save is opened today, so a damaged or tampered copy cannot be opened as if it were sound.

### Signing in on a second device

- A new device starts as a guest, like every device. "Keep it with Google" there finds that the Google account already has a player. Step 11 stopped at saying so.
- Now the notice offers "Use that account on this device". It signs in with Google as that player; then the merge above runs, so whatever the guest had done on this device joins the account.
- The guest account left behind is empty of anything the player needs. Removing abandoned guests is housekeeping for a later step.

### Limits

- A player may hold at most 50 games in the cloud; the oldest abandoned and finished ones make room. Enforced in the database, not in the client.
- The function refuses a game that is not finished, not the caller's, ranked, or on versions it does not hold.

### What the player sees

- Settings, account block: one line of truth about saving. "Saved to your account" when the mirror is up to date; "Saving to your account…" while a write is on its way; "Saved on this device. Waiting for a connection." when the last try did not get through. A guest is told theirs is "an account that only this browser can open".
- Records: lives from other devices, without any mark; they are the player's own.
- Front door: the offer to continue the account's life, only when it differs from the device's. Taking it asks first; it can be ended instead.
- A life the account brings from another device while one is on screen opens as it now stands, with the notice a life moved in another tab already had.

### Tests

- The merge rules are pure functions with a table of cases each, including every "who wins" above.
- The mirror is tested against a fake cloud: what it sends and when, that a failure changes nothing on the device, that the next sync catches up.
- The function's logic is tested without a server, as `engine`'s is.
- The database limit and the new rules are added to the SQL security tests.
- The live check gains the whole journey, through the game's own code: a guest saves a life, a second client signed in as the same player finds it, plays it further, gives it up and sees it taken up again; what is unlocked crosses over; the server finishes a life and the other device finds the run.
- One test runs the real account, mirror and follower together on two devices, with only the network and the page stood in for.

## Tasks

- [x] 1. The record of a life moves to the content package; `replayLife`; the bundle exports it
- [x] 2. Merge rules: progress, runs, the life in progress
- [x] 3. Database: the limit of 50 games, what `verified` means; SQL tests
- [x] 4. The `finish-run` function and its logic; deployed
- [x] 5. The cloud's new verbs and the mirror store; wired in one place
- [x] 6. Pulling down on start and on becoming a member; taking the cloud's life
- [x] 7. Signing in to an existing account from a second device
- [x] 8. What the player sees: the saving line, the offer on the front door, text in both languages
- [x] 9. The live check extended; the end-to-end suite with no cloud still untouched
- [ ] 10. Spec and roadmap brought up to date
- [ ] 11. Fresh review and one fix pass (together with the review of step 11)
