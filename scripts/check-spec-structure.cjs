const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SPEC_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHECKBOX = /^\s*-\s+\[[ xX]\]\s+/m;
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const SERVICE_KEY = /\bsb_secret_[A-Za-z0-9_-]{8,}\b/;
const SENSITIVE_ENV = /^\s*(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|TOKEN_SECRET|JWT_SECRET|DATABASE_PASSWORD|DB_PASSWORD)\s*=\s*(.+?)\s*$/gim;
const PLACEHOLDER = /^(?:<[^>]+>|\$\{[^}]+\}|\{\{[^}]+\}\}|your[-_].+|example|redacted)$/i;

function validateSpecRoot(root) {
  const specRoot = path.join(root, '.kiro', 'specs');
  const problems = [];
  let specCount = 0;

  if (!fs.existsSync(specRoot)) return { problems, specCount };

  for (const entry of fs.readdirSync(specRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (!entry.name.startsWith('.')) problems.push(`unexpected file in .kiro/specs: ${entry.name}`);
      continue;
    }

    specCount += 1;
    const name = entry.name;
    const dir = path.join(specRoot, name);
    if (!SPEC_NAME.test(name)) problems.push(`${name}: directory must use lowercase kebab-case`);

    const hasBugfix = fs.existsSync(path.join(dir, 'bugfix.md'));
    const hasRequirements = fs.existsSync(path.join(dir, 'requirements.md'));
    if (hasBugfix && hasRequirements) problems.push(`${name}: choose bugfix.md or requirements.md, not both`);

    const required = [hasBugfix ? 'bugfix.md' : 'requirements.md', 'design.md', 'tasks.md'];
    for (const file of required) {
      const target = path.join(dir, file);
      if (!fs.existsSync(target)) {
        problems.push(`${name}: missing ${file}`);
      } else if (!fs.readFileSync(target, 'utf8').trim()) {
        problems.push(`${name}: ${file} is empty`);
      }
    }

    const tasksPath = path.join(dir, 'tasks.md');
    if (fs.existsSync(tasksPath) && !CHECKBOX.test(fs.readFileSync(tasksPath, 'utf8'))) {
      problems.push(`${name}: tasks.md must contain at least one Markdown checkbox`);
    }

    for (const file of fs.readdirSync(dir).filter((item) => item.endsWith('.md'))) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      if (PRIVATE_KEY.test(content)) problems.push(`${name}/${file}: contains a private key`);
      if (SERVICE_KEY.test(content)) problems.push(`${name}/${file}: contains a Supabase secret key`);
      for (const match of content.matchAll(SENSITIVE_ENV)) {
        const value = match[2].trim().replace(/^['"`]|['"`]$/g, '');
        if (value && !PLACEHOLDER.test(value)) {
          problems.push(`${name}/${file}: contains a value for ${match[1]}`);
        }
      }
    }
  }

  return { problems, specCount };
}

function runSelfTest() {
  const roots = [];
  const makeRoot = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'web3d-spec-check-'));
    roots.push(root);
    return root;
  };
  const writeSpec = (root, name, files) => {
    const dir = path.join(root, '.kiro', 'specs', name);
    fs.mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content);
  };

  try {
    assert.deepEqual(validateSpecRoot(makeRoot()), { problems: [], specCount: 0 });

    let root = makeRoot();
    writeSpec(root, 'viewer-config-sync', {
      'requirements.md': '# Requirements\nR1',
      'design.md': '# Design',
      'tasks.md': '# Tasks\n- [ ] Implement R1',
    });
    assert.deepEqual(validateSpecRoot(root), { problems: [], specCount: 1 });

    root = makeRoot();
    writeSpec(root, 'max-gltf-quality', {
      'bugfix.md': '# Bugfix\nR1',
      'design.md': '# Design',
      'tasks.md': '# Tasks\n- [x] Reproduce R1',
    });
    assert.deepEqual(validateSpecRoot(root), { problems: [], specCount: 1 });

    root = makeRoot();
    writeSpec(root, 'missing-design', {
      'requirements.md': '# Requirements',
      'tasks.md': '# Tasks\n- [ ] Work',
    });
    assert.match(validateSpecRoot(root).problems.join('\n'), /missing design\.md/);

    root = makeRoot();
    writeSpec(root, 'empty-design', {
      'requirements.md': '# Requirements',
      'design.md': '',
      'tasks.md': '# Tasks\n- [ ] Work',
    });
    assert.match(validateSpecRoot(root).problems.join('\n'), /design\.md is empty/);

    root = makeRoot();
    writeSpec(root, 'missing-checkbox', {
      'requirements.md': '# Requirements',
      'design.md': '# Design',
      'tasks.md': '# Tasks',
    });
    assert.match(validateSpecRoot(root).problems.join('\n'), /Markdown checkbox/);

    root = makeRoot();
    writeSpec(root, 'secret-leak', {
      'requirements.md': `# Requirements\n${'SUPABASE_SERVICE_ROLE_KEY'}${'=real-value'}`,
      'design.md': '# Design',
      'tasks.md': '# Tasks\n- [ ] Work',
    });
    assert.match(validateSpecRoot(root).problems.join('\n'), /SUPABASE_SERVICE_ROLE_KEY/);
  } finally {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('[check-spec] self-test OK');
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
  } else {
    const root = path.resolve(process.env.SPEC_CHECK_ROOT || process.cwd());
    const result = validateSpecRoot(root);
    if (result.problems.length) {
      console.error('[check-spec] Problems found:');
      for (const problem of result.problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(`[check-spec] OK: ${result.specCount} spec(s) checked`);
  }
}

module.exports = { validateSpecRoot };
