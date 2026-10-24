// Each weight from its own folder of its family's package: the package's index names every weight it has (Exo 2's eighteen), and each one named is
// carried into the app and the web export, and precached by the site's worker, whether or not the game draws it (scripts/webSize.ts `GAME_FACES`).
import { ChakraPetch_400Regular } from '@expo-google-fonts/chakra-petch/400Regular';
import { ChakraPetch_600SemiBold } from '@expo-google-fonts/chakra-petch/600SemiBold';
import { Exo2_400Regular } from '@expo-google-fonts/exo-2/400Regular';
import { Exo2_600SemiBold } from '@expo-google-fonts/exo-2/600SemiBold';
import { Jersey15_400Regular } from '@expo-google-fonts/jersey-15/400Regular';
import { Oswald_500Medium } from '@expo-google-fonts/oswald/500Medium';
import ChakraPetch_400Regular_Slant from '../../assets/fonts/ChakraPetch_400Regular_Slant.ttf';
import ChakraPetch_600SemiBold_Slant from '../../assets/fonts/ChakraPetch_600SemiBold_Slant.ttf';
import Exo2_400Regular_Slant from '../../assets/fonts/Exo2_400Regular_Slant.ttf';
import Exo2_600SemiBold_Slant from '../../assets/fonts/Exo2_600SemiBold_Slant.ttf';

/**
 * The font files the game sets type in, by the family name fonts.ts uses: the six of the web's stacks, and the four slanted faces of the reading fonts
 * (assets/fonts, made from them by scripts/slant_fonts.py: what a browser draws for `italic` where a face has none). Only the app loads this file: a test cannot require a .ttf.
 */
export const FONT_SOURCES = {
  Jersey15_400Regular,
  ChakraPetch_400Regular,
  ChakraPetch_600SemiBold,
  Oswald_500Medium,
  Exo2_400Regular,
  Exo2_600SemiBold,
  ChakraPetch_400Regular_Slant,
  ChakraPetch_600SemiBold_Slant,
  Exo2_400Regular_Slant,
  Exo2_600SemiBold_Slant,
};
