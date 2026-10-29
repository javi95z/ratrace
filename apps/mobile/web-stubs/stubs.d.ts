/** The modules the web reads a stand-in for (`stubs.js`, `metro.config.js`). */
declare const stubs: readonly { label: string; file: RegExp; stub: string }[];
export = stubs;
