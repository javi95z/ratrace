/*
 * The web's stand-in for @supabase/storage-js (metro.config.js): supabase-js makes a storage client with every client, which the game never uses (it
 * keeps no file in Supabase's storage). Asked for a bucket, it says so rather than doing nothing.
 */
export class StorageApiError extends Error {
  constructor(message, status, statusCode) {
    super(message);
    this.name = 'StorageApiError';
    this.status = status;
    this.statusCode = statusCode;
  }
}

export class StorageClient {
  from() {
    throw new Error('Supabase storage is not part of the web build (apps/mobile/web-stubs/storage-js.js)');
  }
}
