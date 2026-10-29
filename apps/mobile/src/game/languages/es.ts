import messages from '@ratrace/i18n/messages/es.json';

/**
 * Every word of one language every page may speak, the interface's and the content's, in one chunk of the web export (`languageWords.web.ts` loads
 * it). The cards' text, which only a life in play reads, is a chunk of its own (`cardWords/es.ts`).
 */
export { messages };
export { es as text } from '@ratrace/content/text/es';
