/*
 * react-native-web ships no types. The one piece of it the web twins reach for: the registry a Metro asset's number is looked up in (on the web
 * Expo points `react-native/asset-registry` at react-native-web's, so the `require`d image of a sprite is a number in this registry).
 */
declare module 'react-native-web/dist/modules/AssetRegistry' {
  /** What the packager knows of an image file: where it is served, how it is named, its size, and the scales it has. */
  export interface PackagerAsset {
    httpServerLocation: string;
    name: string;
    type: string;
    width?: number;
    height?: number;
    scales: number[];
  }
  export function registerAsset(asset: PackagerAsset): number;
  export function getAssetByID(id: number): PackagerAsset | undefined;
}
