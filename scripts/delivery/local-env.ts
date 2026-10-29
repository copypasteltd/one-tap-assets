import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';

// These two local-only entry points must use the same project configuration
// as setup and native tests. Existing process variables keep precedence.
if(existsSync('.env.local'))loadEnvFile('.env.local');
