/**
 * Pure TypeScript SQL Query Formatter with uppercase keyword beautification and indentation.
 */
export function formatSqlQuery(sql: string): string {
  if (!sql.trim()) return "";

  const keywords = [
    "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING",
    "LIMIT", "OFFSET", "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN",
    "CROSS JOIN", "FULL JOIN", "ON", "AND", "OR", "NOT", "IN",
    "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE",
    "ALTER TABLE", "DROP TABLE", "PRIMARY KEY", "FOREIGN KEY", "REFERENCES",
    "UNION", "UNION ALL", "AS", "CASE", "WHEN", "THEN", "ELSE", "END",
    "COUNT", "SUM", "AVG", "MIN", "MAX", "ROUND", "COALESCE", "DISTINCT",
    "LIKE", "ILIKE", "IS NULL", "IS NOT NULL", "EXISTS", "BETWEEN",
  ];

  let formatted = sql.trim();

  // Keyword capitalization (word boundary aware)
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "gi");
    formatted = formatted.replace(regex, kw);
  }

  // Clause indentation
  const majorClauses = [
    "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING",
    "LIMIT", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM",
  ];

  for (const clause of majorClauses) {
    const regex = new RegExp(`\\s*\\b${clause}\\b\\s*`, "g");
    formatted = formatted.replace(regex, `\n${clause} `);
  }

  // Indent joined clauses
  formatted = formatted.replace(/\s*\b(LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|CROSS JOIN)\b\s*/g, "\n  $1 ");
  formatted = formatted.replace(/\s*\b(AND|OR)\b\s*/g, "\n  $1 ");

  // Clean up duplicate newlines
  formatted = formatted.replace(/\n{3,}/g, "\n\n").trim();

  return formatted + "\n";
}
