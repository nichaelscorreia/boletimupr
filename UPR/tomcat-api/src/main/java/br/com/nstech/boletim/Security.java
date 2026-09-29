package br.com.nstech.boletim;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.HttpServletRequest;

/**
 * Autenticação por assinatura HMAC-SHA256 e limites por IP.
 *
 * O cliente envia:
 *   X-Boletim-Timestamp: epoch em milissegundos
 *   X-Boletim-Signature: hex(HMAC-SHA256(API_SECRET, timestamp + "\n" + método + "\n" + caminho?query))
 *
 * O segredo nunca trafega na rede, e uma assinatura capturada só vale para a mesma URL por poucos minutos.
 */
final class Security {

    static final String HEADER_TIMESTAMP = "X-Boletim-Timestamp";
    static final String HEADER_SIGNATURE = "X-Boletim-Signature";

    private static final long MAX_CLOCK_SKEW_MS = 5 * 60000;
    private static final int MAX_AUTH_FAILURES = 20;
    private static final long AUTH_FAILURE_WINDOW_MS = 10 * 60000;
    private static final int MAX_TRACKED_IPS = 10000;

    private final byte[] secret;
    private final int requestsPerMinute;
    private final Map<String, long[]> requestWindows = new ConcurrentHashMap<String, long[]>();
    private final Map<String, long[]> authFailures = new ConcurrentHashMap<String, long[]>();

    Security(String secret, int requestsPerMinute) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.requestsPerMinute = requestsPerMinute;
    }

    boolean verifySignature(HttpServletRequest req) {
        String ts = req.getHeader(HEADER_TIMESTAMP);
        String sig = req.getHeader(HEADER_SIGNATURE);
        if (ts == null || sig == null || ts.length() > 20 || sig.length() != 64) return false;
        long t;
        try {
            t = Long.parseLong(ts);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Math.abs(System.currentTimeMillis() - t) > MAX_CLOCK_SKEW_MS) return false;

        String qs = req.getQueryString();
        String target = req.getRequestURI() + (qs == null ? "" : "?" + qs);
        String expected = hmacHex(ts + "\n" + req.getMethod() + "\n" + target);
        return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.US_ASCII),
            sig.toLowerCase().getBytes(StandardCharsets.US_ASCII));
    }

    /** true se o IP excedeu o número de falhas de autenticação recentes. */
    boolean isLockedOut(String ip) {
        long[] f = authFailures.get(ip);
        if (f == null) return false;
        synchronized (f) {
            if (System.currentTimeMillis() - f[0] > AUTH_FAILURE_WINDOW_MS) {
                authFailures.remove(ip);
                return false;
            }
            return f[1] >= MAX_AUTH_FAILURES;
        }
    }

    void recordAuthFailure(String ip) {
        hit(authFailures, ip, AUTH_FAILURE_WINDOW_MS);
    }

    /** Janela fixa de 1 minuto por IP. */
    boolean allowRequest(String ip) {
        return hit(requestWindows, ip, 60000) <= requestsPerMinute;
    }

    private static long hit(Map<String, long[]> map, String ip, long windowMs) {
        if (map.size() > MAX_TRACKED_IPS) map.clear();
        long now = System.currentTimeMillis();
        long[] w = map.get(ip);
        if (w == null) {
            long[] fresh = new long[] {now, 0};
            w = map.putIfAbsent(ip, fresh);
            if (w == null) w = fresh;
        }
        synchronized (w) {
            if (now - w[0] > windowMs) {
                w[0] = now;
                w[1] = 0;
            }
            return ++w[1];
        }
    }

    private String hmacHex(String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] out = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(out.length * 2);
            for (byte b : out) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC indisponível", e);
        }
    }
}
