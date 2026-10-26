import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';
import { COLORS } from './theme';

/*
 * A QR code, drawn in squares as the game's pixels are: dark on cream, its quiet zone round it (four modules, as a camera needs), each row's dark
 * modules joined into runs so a code of 33 modules is a few hundred boxes, not a thousand. The same on the phone and on the web: a phone's camera
 * reads it off another screen.
 */

/** The quiet zone round a code, in modules: what the standard asks, so any camera finds it. */
const QUIET = 4;

/** Each row of a code's modules as its runs of dark ones: where each starts, and how long it is. */
export function qrRuns(value: string): { size: number; rows: Array<Array<[number, number]>> } {
  const code = qrcode(0, 'M');
  code.addData(value);
  code.make();
  const size = code.getModuleCount();
  const rows: Array<Array<[number, number]>> = [];
  for (let row = 0; row < size; row += 1) {
    const runs: Array<[number, number]> = [];
    for (let col = 0; col < size; col += 1) {
      if (!code.isDark(row, col)) continue;
      const last = runs[runs.length - 1];
      if (last && last[0] + last[1] === col) last[1] += 1;
      else runs.push([col, 1]);
    }
    rows.push(runs);
  }
  return { size, rows };
}

/** `value` as a QR code, `width` points across with its quiet zone (each module a whole number of points, the rest left round it). */
export function QrCode({ value, width, label }: { value: string; width: number; label: string }) {
  const { size, rows } = useMemo(() => qrRuns(value), [value]);
  const cell = Math.max(1, Math.floor(width / (size + 2 * QUIET)));
  const side = cell * (size + 2 * QUIET);
  return (
    <View role="img" aria-label={label} style={{ width: side, height: side, backgroundColor: COLORS.cream, padding: cell * QUIET }}>
      {rows.map((runs, row) => (
        <View key={row} style={{ height: cell, width: cell * size, flexDirection: 'row' }}>
          {runs.map(([start, length]) => (
            <View key={start} style={{ position: 'absolute', left: start * cell, width: length * cell, height: cell, backgroundColor: COLORS['night-900'] }} />
          ))}
        </View>
      ))}
    </View>
  );
}
