import { ChakraPetch_400Regular, ChakraPetch_600SemiBold } from '@expo-google-fonts/chakra-petch';
import { Exo2_400Regular, Exo2_600SemiBold } from '@expo-google-fonts/exo-2';
import { Jersey15_400Regular } from '@expo-google-fonts/jersey-15';
import { Oswald_500Medium } from '@expo-google-fonts/oswald';
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
