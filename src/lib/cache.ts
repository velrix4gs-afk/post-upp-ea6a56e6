// IndexedDB cache for offline-first experience
const DB_NAME = 'postup_cache';
const DB_VERSION = 1;
const STORES = {
  POSTS: 'posts',
  PROFILES: 'profiles',
  PAGES: 'pages',
  STORIES: 'stories'
};

class CacheManager {
  private db: IDBDatabase | null = null;

  async init() {
    if (this.db) return this.db;

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores if they don't exist
        Object.values(STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        });
      };
    });
  }

  async set(storeName: string, key: string, value: any) {
    try {
      const db = await this.init();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      await store.put({
        id: key,
        data: value,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async get(storeName: string, key: string) {
    try {
      const db = await this.init();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          // Check if cache is less than 5 minutes old
          if (result && Date.now() - result.timestamp < 5 * 60 * 1000) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async getAll(storeName: string) {
    try {
      const db = await this.init();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const results = request.result.filter((item: any) => 
            Date.now() - item.timestamp < 5 * 60 * 1000
          );
          resolve(results.map((r: any) => r.data));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache getAll error:', error);
      return [];
    }
  }

  async clear(storeName: string) {
    try {
      const db = await this.init();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      await store.clear();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async clearAll() {
    try {
      const db = await this.init();
      Object.values(STORES).forEach(storeName => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
      });
    } catch (error) {
      console.error('Cache clearAll error:', error);
    }
  }
}

export const cache = new CacheManager();
export { STORES };
