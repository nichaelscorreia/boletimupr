package br.com.nstech.boletim;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Converte SQL com parâmetros nomeados (:safra) em SQL JDBC (?) e guarda a ordem dos nomes.
 * Ignora ':' dentro de literais ('hh24:mi'), identificadores entre aspas e comentários.
 */
final class NamedSql {

    final String jdbcSql;
    final List<String> paramNames;

    private NamedSql(String jdbcSql, List<String> paramNames) {
        this.jdbcSql = jdbcSql;
        this.paramNames = Collections.unmodifiableList(paramNames);
    }

    static NamedSql parse(String sql) {
        StringBuilder out = new StringBuilder(sql.length());
        List<String> names = new ArrayList<String>();
        int n = sql.length();
        int i = 0;
        while (i < n) {
            char c = sql.charAt(i);
            if (c == '\'' || c == '"') {
                int end = i + 1;
                while (end < n) {
                    if (sql.charAt(end) == c) {
                        if (end + 1 < n && sql.charAt(end + 1) == c) {
                            end += 2; // aspas escapadas ('')
                            continue;
                        }
                        break;
                    }
                    end++;
                }
                end = Math.min(end + 1, n);
                out.append(sql, i, end);
                i = end;
            } else if (c == '-' && i + 1 < n && sql.charAt(i + 1) == '-') {
                int end = sql.indexOf('\n', i);
                end = end < 0 ? n : end;
                out.append(sql, i, end);
                i = end;
            } else if (c == '/' && i + 1 < n && sql.charAt(i + 1) == '*') {
                int end = sql.indexOf("*/", i + 2);
                end = end < 0 ? n : end + 2;
                out.append(sql, i, end);
                i = end;
            } else if (c == ':' && i + 1 < n && Character.isJavaIdentifierStart(sql.charAt(i + 1))) {
                int end = i + 1;
                while (end < n && Character.isJavaIdentifierPart(sql.charAt(end))) end++;
                names.add(sql.substring(i + 1, end));
                out.append('?');
                i = end;
            } else {
                out.append(c);
                i++;
            }
        }
        return new NamedSql(out.toString(), names);
    }
}
