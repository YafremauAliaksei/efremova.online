/**
 * Тесты сторожа команд. Каждый случай — либо реальная команда из работы агента,
 * которая должна проходить молча, либо способ обойти правило, который должен
 * быть пойман. Если тест на «пойман» начал падать — сторож ослаб.
 */
import { describe, expect, it } from 'vitest';

import { evaluate, splitCommands } from './guard-commands.mjs';

/** Контекст по умолчанию: агент в своей ветке, ветка трогает только src/. */
function ctx(overrides = {}) {
  return {
    currentBranch: () => 'feat/contacts',
    upstream: () => 'origin/feat/contacts',
    changedFiles: () => ['src/app/page.tsx'],
    ...overrides,
  };
}

const decide = (command, overrides) => evaluate(command, ctx(overrides)).decision;

describe('обычная работа проходит без вопросов', () => {
  it.each([
    'git status',
    'git add -A && git commit -m "Контакты: шапка сайта"',
    'git commit -am "Короткое сообщение -n внутри текста"',
    'git push -u origin feat/contacts',
    'git push',
    'git push origin HEAD',
    'git switch -c feat/header',
    'git fetch origin && git merge origin/main',
    'git reset --hard origin/feat/contacts',
    'gh pr create --title "Шапка" --body "Описание" --base main',
    'gh pr checks 35 --watch',
    'gh pr view 35 --json state',
    'gh api repos/YafremauAliaksei/efremova.online/rulesets',
    'gh api graphql -f query="{ viewer { login } }"',
    'gh auth status',
    'npm run ci',
    'npm ci',
    'npm install zod@4',
    'npx prisma generate',
    'curl -sI http://localhost:3000/admin',
    'curl -s https://registry.npmjs.org/next',
    'cat .env.example',
    'cp .env.example .env',
    'node scripts/check-security-headers.mjs',
  ])('%s', (command) => {
    expect(decide(command)).toBe('none');
  });
});

describe('push: только своя ветка и только в origin', () => {
  it.each([
    ['git push origin main', 'в main напрямую'],
    ['git push origin HEAD:main', 'в main через HEAD:'],
    ['git push origin feat/x:refs/heads/main', 'в main полным именем'],
    ['git -C . push origin main', 'через глобальный параметр -C'],
    ['cd src && git push origin main', 'после другой команды'],
    ['bash -c "git push origin main"', 'внутри bash -c'],
    ['echo $(git push origin main)', 'внутри $( )'],
    ['git push --force', 'force'],
    ['git push -uf origin feat/contacts', 'склеенный -f'],
    ['git push --force-with-lease origin feat/contacts', 'force-with-lease'],
    ['git push origin +feat/contacts', 'force через +'],
    ['git push origin :feat/old', 'удаление ветки через :'],
    ['git push --delete origin feat/old', 'удаление ветки'],
    ['git push --mirror', 'mirror'],
    ['git push --no-verify', 'обход хуков'],
    ['git push https://github.com/someone/else.git feat/contacts', 'в чужой адрес'],
    ['git push upstream feat/contacts', 'в другой remote'],
  ])('%s — %s', (command) => {
    expect(decide(command)).toBe('deny');
  });

  it('push без параметров из main запрещён', () => {
    expect(decide('git push', { currentBranch: () => 'main', upstream: () => 'origin/main' })).toBe(
      'deny'
    );
  });

  it('ветка, которая отслеживает origin/main, не уходит в main', () => {
    expect(decide('git push', { upstream: () => 'origin/main' })).toBe('deny');
  });

  it('ветка с изменённым workflow требует «да» владельца', () => {
    const result = evaluate(
      'git push -u origin feat/ci',
      ctx({ changedFiles: () => ['.github/workflows/ci-security.yml'] })
    );
    expect(result.decision).toBe('ask');
    expect(result.reasons.join()).toContain('секретами');
  });

  it.each([['.claude/settings.json'], ['.githooks/pre-commit'], ['CLAUDE.md']])(
    'ветка с изменённым %s требует «да» владельца',
    (file) => {
      expect(decide('git push', { changedFiles: () => [file] })).toBe('ask');
    }
  );

  it('если сравнить с main не удалось — спросить, а не пропустить', () => {
    expect(decide('git push', { changedFiles: () => null })).toBe('ask');
  });
});

describe('обход git-хуков', () => {
  it.each([
    'git commit --no-verify -m "x"',
    'git commit -nm "x"',
    'git -c core.hooksPath=/dev/null commit -m "x"',
    'git config core.hooksPath .nothing',
    'git config alias.p "push --force"',
    'git config remote.origin.pushurl https://evil.example/repo.git',
  ])('%s', (command) => {
    expect(decide(command)).toBe('deny');
  });

  it('коммит прямо в main запрещён', () => {
    expect(decide('git commit -m "x"', { currentBranch: () => 'main' })).toBe('deny');
  });
});

describe('GitHub: слияние и настройки остаются за владельцем', () => {
  it.each([
    'gh pr merge 35 --squash',
    'gh --repo YafremauAliaksei/efremova.online pr merge 35',
    'gh api -X PUT repos/YafremauAliaksei/efremova.online/rulesets/1 --input r.json',
    'gh api repos/YafremauAliaksei/efremova.online/pulls/35/merge -f merge_method=squash',
    'gh api --method=DELETE repos/YafremauAliaksei/efremova.online/rulesets/1',
    'gh api graphql -f query="mutation { mergePullRequest(input: {}) { clientMutationId } }"',
    'gh auth token',
    'gh auth refresh -s delete_repo',
    'gh secret set SEMGREP_APP_TOKEN',
    'gh repo edit --visibility private',
    'gh repo delete YafremauAliaksei/efremova.online',
    'gh workflow run ci-security.yml',
    'gh gist create notes.txt --public',
    'gh pr list --repo someone/else',
    'git credential fill',
    'git remote set-url origin https://evil.example/x.git',
    'git filter-repo --path secret.txt --invert-paths',
    'npm publish',
    'terraform apply',
    'docker push efremova:latest',
    'powershell -EncodedCommand ZwBpAHQA',
  ])('%s', (command) => {
    expect(decide(command)).toBe('deny');
  });
});

describe('секреты не читаются через терминал', () => {
  it.each([
    'cat .env',
    'Get-Content .env.production',
    'grep DATABASE ./.env.local',
    'type infra\\terraform\\terraform.tfvars',
    'node -e "console.log(1)" .env',
  ])('%s', (command) => {
    expect(decide(command)).toBe('deny');
  });
});

describe('правка файлов-правил через терминал — с вопросом', () => {
  it.each([
    'rm .claude/hooks/guard-commands.mjs',
    "sed -i 's/deny/none/' .claude/hooks/guard-commands.mjs",
    'echo "" > .githooks/pre-commit',
    'Set-Content -Path .github/workflows/ci-security.yml -Value x',
    'git checkout -- CLAUDE.md',
  ])('%s', (command) => {
    expect(decide(command)).toBe('ask');
  });
});

describe('разбор строки', () => {
  it('кавычки не разрывают слово, разделители разрывают команду', () => {
    expect(splitCommands('git commit -m "a && b" && git push').map((c) => c.words)).toEqual([
      ['git', 'commit', '-m', 'a && b'],
      ['git', 'push'],
    ]);
  });

  it('обратная косая черта в пути Windows сохраняется', () => {
    expect(splitCommands('type infra\\terraform\\x.tf')[0]?.words).toEqual([
      'type',
      'infra\\terraform\\x.tf',
    ]);
  });
});
