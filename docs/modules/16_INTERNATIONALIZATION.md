# Internationalization Module (i18n)

## Overview
The Internationalization (i18n) module is the core framework powering localization and multilingual rendering across AI Creator OS. Designed as a lightweight, robust, and state-driven system, it manages multi-locale dictionaries, token interpolation, deterministic pluralization, and localized formatters without third-party runtime package overhead.

---

## Architectural Principles

### 1. Unified React State Integration
Instead of relying on heavy third-party packages or introducing page-reload latency, this module uses a lightweight React Context (`I18nProvider`) combined with synchronized `localStorage` persistence. Any change to the active locale propagates instantly to all consumer components hook-driven by `useTranslation()`.

### 2. Multi-Tiered Translation Fallback
The translation retrieval function (`getTranslationValue`) resolves requested keys through a robust multi-tiered fallback hierarchy:
1. **Target Key Match**: Attempts to resolve the dot-notation path in the current active locale's dictionary.
2. **Developer Default**: If not found, utilizes the inline `defaultValue` argument provided in the `t()` invocation.
3. **Primary Language Fallback**: If still unresolved, resolves the path in the source/default locale dictionary (`pt-BR`).
4. **Placeholder Indicator**: Returns a human-readable `[missing: key.path]` string to highlight missing translation paths clearly in development.

### 3. Safe Deterministic Pluralization
Standardizes plural categorization by querying `Intl.PluralRules` for the selected locale (e.g., `'one'`, `'other'`). The engine appends the plural category as a suffix to the key path (e.g. `notification.unread_one`, `notification.unread_other`), avoiding complex execution environments or dangerous eval loops.

---

## Core API Interfaces

### `useTranslation()`
Custom Hook exposed to UI components:
```typescript
const { t, locale, changeLocale, formatDate, formatNumber } = useTranslation();
```

- **`t(key: string, variables?: Record<string, any>)`**: Returns translated string with token replacements.
- **`locale`**: Current active locale (`'pt-BR' | 'en' | 'es'`).
- **`changeLocale(newLocale: string)`**: Transitions application locale seamlessly.

### Formatters
- **`formatDate(date: Date | string)`**: Locale-aware short date rendering.
- **`formatDateTime(date: Date | string)`**: Locale-aware date and time rendering.
- **`formatNumber(num: number)`**: Formats decimals, thousand-separators according to local standards.
- **`formatPercentage(val: number)`**: Formats numeric fraction to localized percentage string.
- **`formatDuration(seconds: number)`**: Translates elapsed seconds into structured time tags (e.g., `2m 30s`).

---

## Architectural Constraints & Best Practices

1. **Explicit Key Mapping Only**: 
   All user-facing interface text must reside in the centralized translation dictionaries (`src/features/i18n/locales/*.ts`) and be retrieved via explicit `t('dot.notation.path')` paths.

2. **Prohibition of Automatic Translation Wrappers**:
   The use of global wrapper components that scan and translate child elements dynamically, crawl the DOM, use `MutationObserver`, or implement reverse-dictionary translation mechanisms is strictly prohibited. Such architectures break typings, impair react render performance, and risk translating user-authored data.

3. **Data/UI Boundary Isolation**:
   Only static user interface copy should be localized. Dynamic user database entities (such as names, custom hypotheses, and raw parameter variables) must remain intact, byte-identical, and unaffected by the active locale context.

