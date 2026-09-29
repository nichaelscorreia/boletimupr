package br.com.nstech.boletim;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

/** Especificação e validação estrita dos parâmetros aceitos por cada consulta. */
final class Params {

    private static final Pattern DATE = Pattern.compile("\\d{2}/\\d{2}/\\d{4}");
    private static final Pattern INT = Pattern.compile("-?\\d{1,9}");

    private Params() {
    }

    static boolean isValidDate(String s) {
        if (s == null || !DATE.matcher(s).matches()) return false;
        SimpleDateFormat f = new SimpleDateFormat("dd/MM/yyyy");
        f.setLenient(false);
        try {
            f.parse(s);
            return true;
        } catch (ParseException e) {
            return false;
        }
    }

    enum Type { INT, DATE, ENUM, TEXT, PATTERN }

    /** Definição de um parâmetro de consulta. */
    static final class Spec {
        final String name;
        final Type type;
        final boolean required;
        final String doc;
        int min;
        int max;
        List<String> values;
        Object def;
        Pattern pattern;

        private Spec(String name, Type type, boolean required, String doc) {
            this.name = name;
            this.type = type;
            this.required = required;
            this.doc = doc;
        }

        static Spec integer(String name, boolean required, int min, int max, String doc) {
            Spec s = new Spec(name, Type.INT, required, doc);
            s.min = min;
            s.max = max;
            return s;
        }

        static Spec date(String name, boolean required, String doc) {
            return new Spec(name, Type.DATE, required, doc);
        }

        static Spec oneOf(String name, String doc, String... values) {
            Spec s = new Spec(name, Type.ENUM, false, doc);
            s.values = Arrays.asList(values);
            return s;
        }

        /** Texto livre até maxLen caracteres (sem caracteres de controle). */
        static Spec text(String name, boolean required, int maxLen, String doc) {
            Spec s = new Spec(name, Type.TEXT, required, doc);
            s.max = maxLen;
            return s;
        }

        /** Texto que precisa casar inteiro com a expressão regular. */
        static Spec pattern(String name, boolean required, String regex, String doc) {
            Spec s = new Spec(name, Type.PATTERN, required, doc);
            s.pattern = Pattern.compile(regex);
            return s;
        }

        /** Valor usado quando o parâmetro não é enviado. */
        Spec orDefault(Object value) {
            this.def = value;
            return this;
        }

        /** Valida e converte; lança IllegalArgumentException com mensagem amigável. */
        Object parse(String raw) {
            switch (type) {
                case INT:
                    if (!INT.matcher(raw).matches()) throw bad("deve ser inteiro");
                    int n = Integer.parseInt(raw);
                    if (n < min || n > max) throw bad("deve estar entre " + min + " e " + max);
                    return n;
                case DATE:
                    if (!isValidDate(raw)) throw bad("deve ser data dd/mm/aaaa");
                    return raw;
                case TEXT:
                    if (raw.length() > max) throw bad("deve ter no máximo " + max + " caracteres");
                    for (int i = 0; i < raw.length(); i++) {
                        if (Character.isISOControl(raw.charAt(i))) throw bad("contém caracteres inválidos");
                    }
                    return raw;
                case PATTERN:
                    if (!pattern.matcher(raw).matches()) throw bad("em formato inválido");
                    return raw;
                default:
                    if (!values.contains(raw)) throw bad("deve ser um de " + values);
                    return raw;
            }
        }

        private IllegalArgumentException bad(String why) {
            return new IllegalArgumentException("Parâmetro '" + name + "' " + why);
        }

        String describe() {
            StringBuilder sb = new StringBuilder(name).append(": ");
            switch (type) {
                case INT: sb.append("inteiro ").append(min).append("..").append(max); break;
                case DATE: sb.append("data dd/mm/aaaa"); break;
                case TEXT: sb.append("texto até ").append(max).append(" caracteres"); break;
                case PATTERN: sb.append("texto no formato ").append(pattern.pattern()); break;
                default: sb.append(values); break;
            }
            sb.append(required ? " (obrigatório)" : " (opcional)");
            if (doc != null) sb.append(" - ").append(doc);
            return sb.toString();
        }
    }
}
