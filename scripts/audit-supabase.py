"""Static PostgreSQL grammar audit. Install pglast in an isolated venv, never connects to a DB."""
import json, re, sys
from pathlib import Path
from pglast import parse_sql, parse_plpgsql, __version__
from pglast.stream import RawStream
path=Path('supabase/migrations/202610230001_crown.sql')
sql=path.read_text()
statements=parse_sql(sql)
created=set(); references=[]; functions=[]; procedures=[]; dynamic=[]
for raw in statements:
    node=raw.stmt; kind=type(node).__name__
    if kind=='CreateStmt':
        name=node.relation.relname
        # Inline foreign keys must resolve to a previously declared table (or auth.users).
        segment=RawStream()(node)
        for schema,table in re.findall(r'REFERENCES\s+(?:(\w+)\.)?(\w+)',segment,re.I):
            if schema=='auth' and table=='users':continue
            assert table in created or table==name, f'Forward or unknown reference: {name} -> {table}'
            references.append([name,table])
        assert name not in created, f'Duplicate table: {name}'
        created.add(name)
    if kind=='CreateFunctionStmt':
        rendered=RawStream()(node)
        functions.append('.'.join(x.sval for x in node.funcname))
        if re.search(r'LANGUAGE\s+plpgsql',rendered,re.I):
            parse_plpgsql(rendered)
            procedures.append(functions[-1])
        else:
            for option in node.options:
                if option.defname=='as':parse_sql(option.arg[0].sval)
    if kind=='DoStmt':
        for option in node.args:
            if option.defname=='as':
                parse_plpgsql('CREATE FUNCTION audit_block() RETURNS void LANGUAGE plpgsql AS $audit$'+option.arg.sval+'$audit$;')
                dynamic.append(option.arg.sval)
# Validate the generated policy/index/privilege/trigger statements, not merely the DO wrappers.
for block in dynamic:
    arrays=re.findall(r"array\[(.*?)\]",block,re.S|re.I)
    names=re.findall(r"'([a-z_]+)'",arrays[-1]) if arrays else []
    formats=re.findall(r"format\('((?:[^']|'')*)',\s*t(?:\.tablename)?\)",block,re.S)
    for template in formats:
        for name in names:parse_sql(template.replace('%I',name).replace("''","'"))
assert not re.search(r'\b(?:notnull|timestamptznot|referencespublic)\b',sql,re.I)
assert len(created)==69, f'Table count changed: {len(created)}'
assert 'set search_path=public' not in sql.lower()
assert 'from public,anon,authenticated' in sql.lower()
report={'mode':'static-only','parser':'pglast '+__version__,'postgresqlExecution':'PENDING: no local server executable','statements':len(statements),'tables':len(created),'foreignKeyReferences':len(references),'sqlFunctionsAndTriggers':functions,'plpgsqlBodiesParsed':procedures,'doBodiesParsed':len(dynamic),'tableList':sorted(created),'result':'PASS grammar and declaration order; runtime, RLS role and concurrency tests still required'}
print(json.dumps(report,ensure_ascii=False,indent=2))
