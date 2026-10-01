import fs from 'fs';
import path from 'path';

const routesDir = path.join(__dirname, '../src/routes');
const schemaPath = path.join(__dirname, '../database/schema_3fn.sql');

const schemaSql = fs.readFileSync(schemaPath, 'utf8');

// Parse tables and their columns from schema
const tableRegex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s*\(([\s\S]+?)\);/g;
const schemaTables: Record<string, Set<string>> = {};

let match: RegExpExecArray | null;
while ((match = tableRegex.exec(schemaSql)) !== null) {
  const tableName = match[1];
  const body = match[2];
  const cols = new Set<string>();
  
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('CONSTRAINT') || trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('FOREIGN KEY')) continue;
    const colNameMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+/);
    if (colNameMatch) {
      cols.add(colNameMatch[1].toLowerCase());
    }
  }
  schemaTables[tableName.toLowerCase()] = cols;
}

console.log('Tablas detectadas en schema_3fn.sql:', Object.keys(schemaTables).length);

// Scan all TS files in routes recursively
function getFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = getFiles(routesDir);
const issues: Array<{ file: string; table: string; col: string; query: string }> = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  
  // Buscar sentencias UPDATE
  const updateRegex = /UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)(?:WHERE|RETURNING|;|\$|`|"|')/gi;
  let uMatch: RegExpExecArray | null;
  while ((uMatch = updateRegex.exec(content)) !== null) {
    const tbl = uMatch[1].toLowerCase();
    const setClause = uMatch[2];
    
    if (schemaTables[tbl]) {
      const colRegex = /([a-zA-Z0-9_]+)\s*=/g;
      let cMatch: RegExpExecArray | null;
      while ((cMatch = colRegex.exec(setClause)) !== null) {
        const col = cMatch[1].toLowerCase();
        if (['case', 'when', 'then', 'else', 'end', 'coalesce', 'and', 'or'].includes(col)) continue;
        if (!schemaTables[tbl].has(col)) {
          issues.push({
            file: path.relative(routesDir, f),
            table: tbl,
            col,
            query: uMatch[0].replace(/\s+/g, ' ').slice(0, 100)
          });
        }
      }
    }
  }

  // Buscar sentencias INSERT
  const insertRegex = /INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([\s\S]+?)\)/gi;
  let iMatch: RegExpExecArray | null;
  while ((iMatch = insertRegex.exec(content)) !== null) {
    const tbl = iMatch[1].toLowerCase();
    const colsPart = iMatch[2];
    
    if (schemaTables[tbl]) {
      const cols = colsPart.split(',').map(s => s.trim().toLowerCase());
      for (const col of cols) {
        const cleanCol = col.replace(/[^a-zA-Z0-9_]/g, '');
        if (cleanCol && !schemaTables[tbl].has(cleanCol)) {
          issues.push({
            file: path.relative(routesDir, f),
            table: tbl,
            col: cleanCol,
            query: iMatch[0].replace(/\s+/g, ' ').slice(0, 100)
          });
        }
      }
    }
  }
}

if (issues.length === 0) {
  console.log('✅ ¡PERFECTO! Ninguna columna referenciada en routes falta en schema_3fn.sql');
} else {
  console.log(`⚠️ Se detectaron ${issues.length} posibles discrepancias:`);
  console.table(issues);
}
