// object-class.mjs v1.0 — classify a 1C source path → relevant skill group (suggester)
// Source: https://github.com/Nikolay-Shirokov/cc-1c-skills
//
// Conservative path→skill map for the skill-suggester hook. Returns { group, message }
// or null (stay silent) when the path is not a recognizable 1C artifact. Distinguishes
// cf vs cfe (extension) by sniffing <ConfigurationExtensionPurpose> in Configuration.xml,
// and mxl vs skd templates by the root namespace. Never throws.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, dirname } from 'node:path';

// Top-level metadata collections handled by meta-* (Roles handled separately → role-*).
const META_COLLECTIONS = new Set([
  'Catalogs', 'Documents', 'Enums', 'Reports', 'DataProcessors', 'InformationRegisters',
  'AccumulationRegisters', 'AccountingRegisters', 'CalculationRegisters', 'DocumentJournals',
  'ChartsOfCharacteristicTypes', 'ChartsOfAccounts', 'ChartsOfCalculationTypes', 'BusinessProcesses',
  'Tasks', 'ExchangePlans', 'Constants', 'CommonModules', 'FilterCriteria', 'SettingsStorages',
  'CommonAttributes', 'DefinedTypes', 'SessionParameters', 'CommonForms', 'CommonTemplates',
  'CommonCommands', 'CommandGroups', 'CommonPictures', 'WebServices', 'HTTPServices', 'WSReferences',
  'ScheduledJobs', 'FunctionalOptions', 'FunctionalOptionsParameters', 'EventSubscriptions',
  'Sequences', 'ExternalDataSources', 'IntegrationServices',
]);

const MESSAGES = {
  meta: 'Структуру объекта 1С быстрее даёт навык `meta-info` (одна сводка вместо сырого XML), а структурные правки — `meta-edit` (реквизиты/ТЧ/измерения/ресурсы).',
  form: 'Для управляемой формы 1С есть `form-info` (анализ элементов/реквизитов/команд) и `form-edit` (точечные правки).',
  mxl: 'Это табличный документ 1С: `mxl-info`/`mxl-decompile` дают редактируемое описание, `mxl-compile` собирает обратно.',
  skd: 'Это схема компоновки данных (СКД): `skd-info` для анализа, `skd-edit` для точечных правок.',
  role: 'Для прав роли 1С есть `role-info` (сводка прав/RLS) и `role-compile` (создание из DSL).',
  cf: 'Корень конфигурации 1С: `cf-info` (обзор состава/свойств) и `cf-edit` (правки настроек/состава).',
  cfe: 'Это расширение конфигурации (CFE): `cfe-diff` для анализа, а доработку безопаснее вести через `cfe-borrow`/`cfe-patch-method`.',
  subsystem: 'Подсистема 1С: `subsystem-info` (состав/дерево) и `subsystem-edit` (правки состава/свойств).',
  template: 'Это макет объекта 1С: для табличного документа — навыки `mxl-*`, для СКД — `skd-*`.',
  search: 'Для навигации по метаданным 1С есть структурированные навыки `*-info` (meta-info/cf-info/form-info/…) — обычно быстрее сырого поиска по XML.',
};

function segments(p) {
  return p.replace(/\\/g, '/').split('/').filter(Boolean);
}

function sniffRoot(path) {
  try {
    if (!existsSync(path) || !statSync(path).isFile()) return '';
    const fd = readFileSync(path, 'utf8');
    return fd.slice(0, 600);
  } catch {
    return '';
  }
}

// Classify a concrete file path. Returns { group, message } or null.
export function classifyFile(path) {
  try {
    const segs = segments(path);
    const name = basename(path);
    if (!name) return null;

    if (name.toLowerCase().endsWith('.bsl')) return null; // module code — no skill, stay silent

    // Form.xml under .../Forms/<Name>/Ext/
    if (name === 'Form.xml' && segs.includes('Forms')) return mk('form');

    // Template.xml under .../Templates/<Name>/Ext/ → sniff root namespace (mxl vs skd)
    if (name === 'Template.xml' && segs.includes('Templates')) {
      const head = sniffRoot(path);
      if (/data\/spreadsheet/.test(head)) return mk('mxl');
      if (/DataCompositionSchema|data-composition-schema/i.test(head)) return mk('skd');
      return mk('template'); // unreadable / unknown → generic
    }

    // Roles: Rights.xml or Roles/<Name>.xml
    if (name === 'Rights.xml' && segs.includes('Roles')) return mk('role');

    // Configuration.xml → cf vs cfe (extension marker)
    if (name === 'Configuration.xml') {
      const head = sniffRoot(path);
      return /ConfigurationExtensionPurpose/.test(head) ? mk('cfe') : mk('cf');
    }

    const parent = basename(dirname(path));
    // Top-level object root: <Collection>/<Name>.xml
    if (name.toLowerCase().endsWith('.xml')) {
      if (parent === 'Roles') return mk('role');
      if (parent === 'Subsystems') return mk('subsystem');
      if (META_COLLECTIONS.has(parent)) return mk('meta');
    }
    return null;
  } catch {
    return null;
  }
}

// Classify a Grep/Glob search target: if it points inside a 1C config tree (or a known
// collection appears in the path/pattern) → suggest the info-skills. Best-effort, lean silent.
export function classifySearch(target) {
  try {
    if (!target) return null;
    const segs = segments(target);
    if (segs.some((s) => META_COLLECTIONS.has(s) || s === 'Roles' || s === 'Subsystems')) return mk('search');
    return null;
  } catch {
    return null;
  }
}

function mk(group) {
  return { group, message: MESSAGES[group] };
}
