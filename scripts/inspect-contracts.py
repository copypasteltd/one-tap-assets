"""Concise implementation inventory; never reads secrets or writes frozen artifacts."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
base = root / 'assets/development/v1.1'
mode = sys.argv[1] if len(sys.argv) > 1 else 'schemas'
if mode == 'schemas':
    api = json.loads((base / 'contracts/openapi.json').read_text(encoding='utf-8'))
    for name in sys.argv[2:]:
        print(name, json.dumps(api['components']['schemas'][name], ensure_ascii=False, separators=(',', ':')))
elif mode == 'tables':
    for entity in json.loads((base / 'data-model.json').read_text(encoding='utf-8'))['entities']:
        print(entity['table'], entity['primary_key'], ','.join(entity['fields']))
elif mode == 'pages':
    print((root / 'assets/design/柚子创作社/v1.0/page-registry.json').read_text(encoding='utf-8'))
elif mode == 'management':
    api = json.loads((base / 'contracts/management-openapi.json').read_text(encoding='utf-8'))
    for path, row in api['paths'].items():
        for method, op in row.items():
            if method in ('post', 'get', 'patch', 'put', 'delete'):
                print(method, path, op['operationId'])
