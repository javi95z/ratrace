import { backdropArt, lives, portraitArt } from '@ratrace/content';
import { Face } from '../../ui/Picker';

/** The face a life is chosen by, on the sky of the city it begins in: lives tell apart at a glance in a list. */
export function LifeFace({ lifeId, size = 'sm' }: { lifeId: string; size?: 'sm' | 'md' }) {
  const city = lives.find((life) => life.id === lifeId)?.start.cityId;
  return <Face id={portraitArt(lifeId, 22)} size={size} backdrop={city ? backdropArt(city) : undefined} />;
}
