package br.com.nstech.boletim;

import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;

/**
 * Cache curto de respostas + "single flight": se várias requisições idênticas chegam juntas,
 * só uma vai ao Oracle e as demais aguardam o mesmo resultado.
 */
final class ResultCache {

    private static final int MAX_ENTRIES = 1000;

    private static final class Entry {
        final byte[] body;
        final long expiresAt;

        Entry(byte[] body, long expiresAt) {
            this.body = body;
            this.expiresAt = expiresAt;
        }
    }

    private final long ttlMs;
    private final Map<String, Entry> entries = new ConcurrentHashMap<String, Entry>();
    private final Map<String, FutureTask<byte[]>> inFlight = new ConcurrentHashMap<String, FutureTask<byte[]>>();

    ResultCache(int ttlSeconds) {
        this.ttlMs = ttlSeconds * 1000L;
    }

    byte[] get(String key, boolean cacheable, Callable<byte[]> loader) throws Exception {
        boolean useCache = cacheable && ttlMs > 0;
        if (useCache) {
            Entry e = entries.get(key);
            if (e != null && e.expiresAt > System.currentTimeMillis()) return e.body;
        }

        FutureTask<byte[]> task = new FutureTask<byte[]>(loader);
        FutureTask<byte[]> running = inFlight.putIfAbsent(key, task);
        if (running == null) {
            try {
                task.run();
                byte[] body = unwrap(task);
                if (useCache) {
                    if (entries.size() >= MAX_ENTRIES) entries.clear();
                    entries.put(key, new Entry(body, System.currentTimeMillis() + ttlMs));
                }
                return body;
            } finally {
                inFlight.remove(key, task);
            }
        }
        return unwrap(running);
    }

    private static byte[] unwrap(FutureTask<byte[]> task) throws Exception {
        try {
            return task.get();
        } catch (ExecutionException e) {
            Throwable c = e.getCause();
            if (c instanceof Exception) throw (Exception) c;
            throw e;
        }
    }
}
