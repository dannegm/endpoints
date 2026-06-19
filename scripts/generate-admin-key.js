import { createInterface } from 'readline';
import { randomBytes } from 'crypto';

const argv = process.argv.slice(2);

const hasFlag = flag => argv.includes(flag);
const getArg = flag => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] ?? null : null;
};

const outputRaw = hasFlag('--raw');
const outputJson = hasFlag('--json');

if (hasFlag('--help') || hasFlag('-h')) {
    process.stdout.write(`
Usage: bun scripts/generate-admin-key.js [options]

Input:
  --password, -p <pass>  Use the given password
  --gen                  Generate a random secure password

Output:
  --raw                  Print only the hash (pipeable)
  --json                 Print { password, hash } as JSON
  (default)              Human-readable, prompts to stderr

Examples:
  bun scripts/generate-admin-key.js
  bun scripts/generate-admin-key.js --password mysecret
  bun scripts/generate-admin-key.js --gen --raw | pbcopy
  bun scripts/generate-admin-key.js --gen --json
`.trimStart());
    process.exit(0);
}

function emit(password, hash) {
    if (outputJson) {
        process.stdout.write(JSON.stringify({ password, hash }) + '\n');
    } else if (outputRaw) {
        process.stdout.write(hash + '\n');
    } else {
        if (password) process.stderr.write(`password : ${password}\n`);
        process.stdout.write(`hash     : ${hash}\n`);
    }
}

async function run() {
    let password = getArg('--password') ?? getArg('-p');

    if (hasFlag('--gen')) {
        password = randomBytes(32).toString('base64url');
        if (!outputRaw && !outputJson) {
            process.stderr.write(`generated: ${password}\n`);
        }
    }

    if (!password) {
        password = await new Promise(resolve => {
            // Prompt on stderr so stdout stays pipeable
            const rl = createInterface({ input: process.stdin, output: process.stderr });
            rl.question('Password: ', ans => {
                rl.close();
                resolve(ans.trim());
            });
        });
    }

    if (!password) {
        process.stderr.write('Error: password cannot be empty\n');
        process.exit(1);
    }

    const hash = await Bun.password.hash(password, { algorithm: 'argon2id' });
    emit(password, hash);
}

run();
