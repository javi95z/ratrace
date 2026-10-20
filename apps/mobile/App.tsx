// Phase 0 spike (throwaway): does the game's own code run on a phone? A whole life played by a bot,
// saved in the phone's store, opened again from it, and a sprite and the game's words shown.
import { bots, content, lives } from '@ratrace/content';
import { finalScore } from '@ratrace/engine';
import { formatFor } from '@ratrace/core/lib/format';
import { LocalSessions } from '@ratrace/core/session/local';
import type { GameSession } from '@ratrace/core/session/types';
import { messagesFor } from '@ratrace/i18n';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MemoryStore } from '@ratrace/core/session/memory';
import { KvStore } from './src/kvStore';
import { missing } from './src/polyfills';

const store = Platform.OS === 'web' ? new MemoryStore() : new KvStore();
const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
const sessions = new LocalSessions(store, content, lives, { newId: () => crypto.randomUUID(), newSeed: () => randomHex(32), now: () => Date.now() });
const fmt = formatFor('es');
const words = messagesFor('es');
const saver = bots.find((bot) => bot.id === 'saver') ?? bots[0];

/** Plays a life to its end the way the balance tool does, through the same session the web uses. */
async function playOut(session: GameSession, onRound: (round: number) => void): Promise<void> {
  while (!session.view().finished) {
    while (session.view().phase === 'cards') await session.answerCard(saver.pick(content, session.view()));
    await session.playRound({ orders: saver.orders(content, session.view()) });
    onRound(session.view().round);
  }
}

export default function App() {
  const [log, setLog] = useState<string[]>([
    `Plataforma: ${Platform.OS} · motor JS: ${(globalThis as { HermesInternal?: unknown }).HermesInternal ? 'Hermes' : 'otro'}`,
    `Rellenos usados: ${missing.length ? missing.join(', ') : 'ninguno'}`,
    `Textos del juego: «${words.challenge.title}» · dinero: ${fmt.money(1234567)}`,
  ]);
  const [busy, setBusy] = useState(false);
  const say = (line: string) => setLog((lines) => [...lines, line]);

  const play = async () => {
    setBusy(true);
    try {
      const started = Date.now();
      const session = await sessions.start('nurse');
      say(`Vida empezada: ${session.lifeId}, ronda ${session.view().round}`);
      await playOut(session, (round) => round % 10 === 0 && say(`… ronda ${round}`));
      const view = session.view();
      say(`Vida terminada en ${((Date.now() - started) / 1000).toFixed(1)} s: ${fmt.number(finalScore(content, view as never))} puntos, ${view.player.escapedAtRound !== null ? 'escapó' : 'no escapó'}`);
      const runs = await store.listRuns();
      say(`Vidas guardadas en el móvil: ${runs.length}`);
    } catch (error) {
      say(`ERROR: ${error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const halfAndReopen = async () => {
    setBusy(true);
    try {
      const session = await sessions.start('nurse');
      for (let i = 0; i < 5; i++) {
        while (session.view().phase === 'cards') await session.answerCard(saver.pick(content, session.view()));
        await session.playRound({ orders: saver.orders(content, session.view()) });
      }
      const before = session.view();
      const { session: again, lost } = await sessions.resume();
      say(again ? `Reabierta desde el guardado: ronda ${again.view().round} (era ${before.round}), mismo dinero: ${JSON.stringify(again.view().player) === JSON.stringify(before.player) ? 'sí' : 'NO'}` : `No se pudo reabrir: ${lost}`);
    } catch (error) {
      say(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <Image source={require('./assets/mascot.png')} style={styles.mascot} />
      <Text style={styles.title}>The Rat Race · prueba fase 0</Text>
      <View style={styles.row}>
        <Pressable style={styles.button} disabled={busy} onPress={play}>
          <Text style={styles.buttonText}>Jugar una vida entera</Text>
        </Pressable>
        <Pressable style={styles.button} disabled={busy} onPress={halfAndReopen}>
          <Text style={styles.buttonText}>Guardar y reabrir</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.log}>
        {log.map((line, i) => (
          <Text key={i} style={line.startsWith('ERROR') ? styles.error : styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1b2340', paddingTop: 56, paddingHorizontal: 16 },
  mascot: { width: 128, height: 128, alignSelf: 'center' },
  title: { color: '#f2c14e', fontSize: 20, fontWeight: '700', textAlign: 'center', marginVertical: 12 },
  row: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, backgroundColor: '#f2c14e', padding: 12, borderRadius: 4 },
  buttonText: { color: '#1b2340', fontWeight: '700', textAlign: 'center' },
  log: { marginTop: 16 },
  line: { color: '#f4ecd8', fontSize: 13, marginBottom: 6 },
  error: { color: '#ff8a80', fontSize: 12, marginBottom: 6 },
});
