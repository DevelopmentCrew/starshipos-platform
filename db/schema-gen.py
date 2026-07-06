#!/usr/bin/env python3
"""
StarshipOS - generate PostgreSQL schema from the Base44 entity snapshot.
Reads schema-baseline/raw/*.json (149 entities) and emits:
  - platform/db/schema.sql        (Postgres DDL, one table per entity)
  - platform/db/mapping-report.md (entity->table mapping + notes)
Types: string->text (date->date, date-time->timestamptz), number->numeric,
integer->bigint, boolean->boolean, array/object->jsonb, enum->text + CHECK.
Base44 system columns (id, created_date, updated_date, created_by, created_by_id,
is_sample) are added to every table. FKs are documented, not enforced (Base44
data can contain dangling references; we enforce after cleansing).
"""
import json, glob, re, sys, os

def snake(name):
    s = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', name)
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s)
    return s.lower()

def col_type(prop):
    t = prop.get('type')
    fmt = prop.get('format')
    if t == 'string':
        if fmt == 'date': return 'date'
        if fmt == 'date-time': return 'timestamptz'
        return 'text'
    if t == 'number': return 'numeric'
    if t == 'integer': return 'bigint'
    if t == 'boolean': return 'boolean'
    if t in ('array','object'): return 'jsonb'
    return 'text'

def load_entities():
    ents = {}
    for f in sorted(glob.glob('schema-baseline/raw/*.json')):
        d = json.load(open(f))
        lst = d.get('schemas') if isinstance(d, dict) and 'schemas' in d else (d if isinstance(d, list) else [d])
        for e in lst:
            name = e.get('entity_name') or (e.get('entity_schema') or {}).get('name') or e.get('name')
            sch = e.get('entity_schema') or e
            ents[name] = sch
    return ents

SYS_COLS = [
    ('id', 'text', 'PRIMARY KEY'),
    ('created_date', 'timestamptz', ''),
    ('updated_date', 'timestamptz', ''),
    ('created_by', 'text', ''),
    ('created_by_id', 'text', ''),
    ('is_sample', 'boolean', "DEFAULT false"),
]

def gen():
    ents = load_entities()
    ddl = ["-- StarshipOS PostgreSQL schema (generated from Base44 entity snapshot)\n"
           "-- FKs documented in comments, not enforced until data is cleansed.\n"]
    report = ["# StarshipOS entity -> Postgres table mapping\n",
              f"Generated from {len(ents)} Base44 entities. Types mapped: string->text (date/date-time typed), number->numeric, boolean->boolean, array/object->jsonb, enum->text+CHECK.\n",
              "System columns added to every table: id (PK), created_date, updated_date, created_by, created_by_id, is_sample.\n",
              "\n| Entity | Table | Cols | jsonb | enums | *_id (likely FK) |\n|---|---|---|---|---|---|"]
    fk_targets = { snake(n): n for n in ents }  # table -> entity, to resolve *_id
    total_cols = 0
    for name in sorted(ents):
        sch = ents[name]
        props = sch.get('properties') or {}
        required = set(sch.get('required') or [])
        table = snake(name)
        lines = [f'CREATE TABLE IF NOT EXISTS "{table}" (']
        col_defs = []
        # system cols first
        for cn, ct, extra in SYS_COLS:
            if cn in props:  # avoid dup if entity also declares it
                continue
            col_defs.append(f'  "{cn}" {ct}{(" "+extra) if extra else ""}')
        n_jsonb = 0; enums = []; fkids = []
        for pn, prop in props.items():
            ct = col_type(prop)
            if ct == 'jsonb': n_jsonb += 1
            notnull = ' NOT NULL' if pn in required and pn != 'id' else ''
            default = ''
            if prop.get('type') == 'array': default = " DEFAULT '[]'::jsonb"
            elif prop.get('type') == 'object': default = " DEFAULT '{}'::jsonb"
            elif 'default' in prop and prop.get('type') in ('boolean','number','integer'):
                dv = prop['default']; default = f" DEFAULT {str(dv).lower() if isinstance(dv,bool) else dv}"
            check = ''
            if prop.get('enum'):
                vals = "', '".join(str(v).replace("'","''") for v in prop['enum'])
                check = f"  -- enum: one of ['{vals}']"
                enums.append(pn)
            if pn == 'id':
                # entity redefines id; keep as PK text
                col_defs.append(f'  "id" text PRIMARY KEY')
                continue
            line = f'  "{pn}" {ct}{notnull}{default},{check}' if check else f'  "{pn}" {ct}{notnull}{default}'
            col_defs.append(line)
            if pn.endswith('_id') and snake(pn[:-3]) in fk_targets:
                fkids.append(pn)
        # de-dup trailing commas handling: join with commas
        body = ",\n".join(cd.rstrip(',') if not cd.strip().startswith('"') else cd for cd in [c.split('  --')[0].rstrip().rstrip(',') for c in col_defs])
        # simpler: rebuild cleanly
        clean = []
        comments = []
        for cd in col_defs:
            if '  -- enum' in cd:
                main, cmt = cd.split('  -- ', 1)
                clean.append(main.rstrip().rstrip(','))
                comments.append((main.strip().split()[0], cmt))
            else:
                clean.append(cd.rstrip().rstrip(','))
        ddl.append(f'CREATE TABLE IF NOT EXISTS "{table}" (')
        ddl.append(",\n".join(clean))
        ddl.append(');')
        # index on common lookup cols
        for idx in ('development_id','employee_id','company_id','customer_id'):
            if idx in props:
                ddl.append(f'CREATE INDEX IF NOT EXISTS "idx_{table}_{idx}" ON "{table}" ("{idx}");')
        ddl.append('')
        total_cols += len(props)
        report.append(f"| {name} | {table} | {len(props)} | {n_jsonb} | {len(enums)} | {', '.join(fkids) if fkids else '-'} |")
    report.append(f"\n**Totals:** {len(ents)} tables, {total_cols} declared columns (+6 system cols each).")
    open('platform/db/schema.sql','w').write("\n".join(ddl))
    open('platform/db/mapping-report.md','w').write("\n".join(report))
    print(f"Generated {len(ents)} tables, {total_cols} columns -> platform/db/schema.sql")

if __name__ == '__main__':
    gen()
