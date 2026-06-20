# Hooks: guardrail поддержки + суфлёр навыков

Харнес-хуки Claude Code, **усиливающие** защиту типовых конфигураций 1С на поддержке. Это **бонус-слой
поверх пола безопасности** (гард §1B внутри навыков-мутаторов + видимость состояния в info-навыках), который
едет всеми каналами установки. Хуки ловят то, что навыки не видят — правки **мимо навыков**.

> Хуки — фича только Claude Code. На других платформах (Cursor/Codex/…) их нет; там работает переносимый
> пол §1B. Поэтому хуки — усиление, а не замена.

## Что внутри

| Файл | Событие | Назначение |
|------|---------|------------|
| `support-guard.mjs` | **PreToolUse** `Edit\|Write\|MultiEdit` | §1A: блокирует сырую правку объекта поставщика «на замке» / read-only конфигурации мимо навыков. |
| `skill-suggester.mjs` | **PostToolUse** `Read\|Grep\|Glob\|Edit\|Write\|MultiEdit` | Ненавязчиво подсказывает профильный навык 1С, когда модель работает с исходниками напрямую. Не блокирует. |
| `common/support-state.mjs` | — | Декодер `Ext/ParentConfigurations.bin` + правило `G`/`f1` (канон; зеркало гарда §1B). |
| `common/project.mjs` | — | Чтение реакции из `.v8-project.json`. |
| `common/object-class.mjs` | — | Карта путь→навык (с различением cf/cfe и mxl/скд). |
| `test/run.mjs` | — | Standalone-тесты на корпусе `cfsrc` + синтетике. |

Рантайм — **Node.js 18+** (как и для `/web-test`). Скрипты рантайм-независимы (не зависят от PS/Python-порта навыков).

## Поведение

**Гард (§1A).** Срабатывает по наличию `Ext/ParentConfigurations.bin` (walk-up от пути правки). Реакция —
из `.v8-project.json`, поле `editingAllowedCheck`:
- `deny` (**по умолчанию**) — блокирует (`permissionDecision: deny`) с диагностикой (безопасные пути: `cfe-*`,
  `support-edit`, осознанное снятие с поддержки);
- `warn` — пропускает с предупреждением;
- `off` — выключено.

Раскладка: глобальный дефолт + переопределение на запись базы (`databases[].editingAllowedCheck`). Читается
**идентично** гарду §1B внутри навыков.

**Суфлёр.** Поле `skillSuggester` (`on` по умолчанию | `off`). Подсказывает не чаще **1×/сессия/группа навыков**,
мягкой формулировкой, через `additionalContext` (видит модель). Молчит на коде модулей (`*.bsl`), нераспознанных
путях и при `off`.

## Установка

### Плагин (рекомендуется) — автоматически
`.claude-plugin/plugin.json` декларирует `"hooks": "./hooks/hooks.json"`. При включении плагина хуки
подключаются сами, пути резолвятся через `${CLAUDE_PLUGIN_ROOT}`. Ничего настраивать не нужно.

### Копия папки / `switch.py` — вручную (опт-ин)
Эти каналы не несут хуки автоматически (копируется только `.claude/skills/`, а `settings.json` не переносится).
Чтобы включить:
1. Скопируйте каталог `hooks/` в проект, например в `<проект>/.claude/hooks/`.
2. Добавьте в `<проект>/.claude/settings.json` (проектный, **не** `settings.local.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command",
          "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/support-guard.mjs\"" }] }
    ],
    "PostToolUse": [
      { "matcher": "Read|Grep|Glob|Edit|Write|MultiEdit",
        "hooks": [{ "type": "command",
          "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/skill-suggester.mjs\"" }] }
    ]
  }
}
```

## Тесты

```bash
node hooks/test/run.mjs
```

Прогоняет декодер/гард/суфлёр на корпусе `cfsrc` (bp `G=1` → deny, erp `K=0` → allow) и на синтетических
фикстурах (`test-tmp/`, gitignored; корпус не трогается). Все ветки: per-object `f1=0/1/2`, warn/off,
throttle, слепые пятна, cf/cfe, mxl/скд.
