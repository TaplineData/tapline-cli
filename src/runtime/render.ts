const MAX_ROWS = 50;
const MAX_LINE = 120;
const MAX_COLUMNS = 6;
const MAX_CELL = 40;
const MAX_INLINE_MEMBERS = 10;
const MAX_DEPTH = 3;

type Row = Record<string, unknown>;

function isScalar(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  return String(value);
}

function cell(value: unknown): string {
  const text = scalarText(value).replace(/\s+/g, ' ');
  if (value === null || value === undefined) return '-';
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL - 1)}…` : text;
}

/** Rows of objects as an aligned table: the first scalar columns that hold anything. */
function table(rows: Row[]): string[] {
  const first = rows[0]!;
  const shown = rows.slice(0, MAX_ROWS);
  const columns = Object.keys(first)
    .filter((key) => isScalar(first[key]) && shown.some((row) => row[key] !== null && row[key] !== undefined))
    .slice(0, MAX_COLUMNS);
  if (columns.length === 0) return [`${rows.length} item(s); use --json to see them`];

  const body = shown.map((row) => columns.map((column) => cell(row[column])));
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...body.map((row) => row[index]!.length)),
  );
  const line = (cells: string[]): string =>
    cells.map((text, index) => text.padEnd(widths[index]!)).join('  ').trimEnd();

  const out = [line(columns), line(widths.map((width) => '─'.repeat(width))), ...body.map(line)];
  if (rows.length > body.length) out.push(`… ${rows.length - body.length} more row(s); use --json for all`);
  const hidden = Object.keys(first).length - columns.length;
  if (hidden > 0) out.push(`… ${hidden} more field(s) per row; use --json to see them`);
  return out;
}

function indent(lines: string[], by = '  '): string[] {
  return lines.map((line) => (line === '' ? line : by + line));
}

function fieldLines(key: string, value: unknown, depth: number): string[] {
  if (isScalar(value) || value === undefined) {
    const text = scalarText(value);
    if (text.includes('\n')) return [`${key}:`, ...indent(text.split('\n'))];
    return [`${key}: ${text.length > MAX_LINE ? `${text.slice(0, MAX_LINE)}… (--json for the rest)` : text}`];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${key}: (none)`];
    if (value.every(isScalar)) {
      const shown = value.slice(0, MAX_INLINE_MEMBERS).map(scalarText).join(', ');
      const rest = value.length > MAX_INLINE_MEMBERS ? `, … ${value.length - MAX_INLINE_MEMBERS} more` : '';
      return [`${key}: ${shown}${rest}`];
    }
    if (value.every(isRow)) return [`${key}: ${value.length} item(s)`, ...indent(table(value))];
    return [`${key}: ${value.length} item(s); use --json to see them`];
  }
  if (isRow(value)) {
    if (depth >= MAX_DEPTH) return [`${key}: {…}; use --json to see it`];
    const nested = renderLines(value, depth + 1);
    return nested.length === 0 ? [`${key}: (empty)`] : [`${key}:`, ...indent(nested)];
  }
  return [`${key}: ${scalarText(value)}`];
}

/** Scalars first, then nested objects, then the tables: the summary reads top to bottom. */
function renderLines(value: Row, depth: number): string[] {
  const rank = (member: unknown): number => (isScalar(member) || member === undefined ? 0 : Array.isArray(member) ? 2 : 1);
  return Object.entries(value)
    .sort(([, left], [, right]) => rank(left) - rank(right))
    .flatMap(([key, member]) => fieldLines(key, member, depth));
}

/** A response as readable text. `--json` is the way to get the response itself. */
export function render(value: unknown): string {
  if (value === undefined) return '';
  if (isScalar(value)) return scalarText(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '(no results)';
    if (value.every(isRow)) return table(value).join('\n');
    return value.map(scalarText).join('\n');
  }
  if (isRow(value)) return renderLines(value, 0).join('\n');
  return String(value);
}

/** The value at a dotted path, e.g. `pagination.next_cursor` or `results.0.title`. */
export function valueAt(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    if (isRow(current)) return current[segment];
    return undefined;
  }, value);
}
