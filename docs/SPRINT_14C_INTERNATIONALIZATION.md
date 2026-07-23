# Sprint 14C — Internationalization & Localization (i18n)

## Executive Summary
Sprint 14C introduces complete Internationalization (i18n) and Localization support to AI Creator OS. It implements a custom, robust, lightweight core translation engine supporting English (`en`), Spanish (`es`), and Brazilian Portuguese (`pt-BR`). The interface defaults to Brazilian Portuguese (`pt-BR`) as the source language, with instantaneous locale switching without any full page reloads.

---

## Technical Enhancements & Architecture

### 1. File Structure
- `/src/features/i18n/types.ts`: TypeScript data models and schemas for dictionaries, interpolation options, plurals, and formatters.
- `/src/features/i18n/localeConfig.ts`: Base configurations for supported languages, sanitization of invalid locales, and active fallback defaults.
- `/src/features/i18n/translationUtils.ts`: Translation retrieval function supporting nested dot-notated keys, token interpolation, and pluralization.
- `/src/features/i18n/formatters.ts`: Localization-aware wrappers around native `Intl` formatters for dates, datetimes, numbers, percentages, and duration calculations.
- `/src/features/i18n/I18nProvider.tsx`: Context-based provider that drives reactive locale changes instantly without reloading.
- `/src/features/i18n/useTranslation.ts`: Custom hook exposing the state-driven `t` translation function and formatting utilities.
- `/src/features/i18n/locales/`: Isomorphic dictionaries with 2,059 leaf keys in `en.ts`, `es.ts`, and `pt-BR.ts`.
- `/src/features/i18n/__tests__/i18n.test.ts`: Core translation tests.
- `/src/features/i18n/__tests__/i18nProvider.test.tsx`: Comprehensive provider and reactive event tests.
- `/src/features/i18n/__tests__/regression.test.ts`: AST-backed untranslated-UI and key-resolution safeguards across all 24 route pages.

### 2. Core Translation Engine
- **Dot-Notation Path Resolution**: Parses complex nested paths (e.g. `dashboard.recentActivity`) safely and efficiently.
- **Graceful Fallbacks**: If a key does not exist in the requested locale, the engine checks for a developer-provided `defaultValue` or falls back to the corresponding key in `pt-BR`.
- **Token Interpolation**: Evaluates curly-braced variables (e.g. `{name}`) dynamically.
- **Deterministic Pluralization**: Implements standardized plural selection via `Intl.PluralRules` without using risky evaluations or executable templates.

### 3. Locale-Aware Formatting
- Custom helpers translate numeric, date/time, percentage, and duration values cleanly according to active locales.
- Leverages native `Intl` constructs to ensure browser-native performance and precision.

### 4. Reactive UI Translation
- Critical routes like the **Settings** page and the main **Dashboard** are fully localized and fully reactive.
- Changing locale instantly translates headers, subheadings, actions, and date indicators in real-time.

### 5. Workspace Backup Version 10
- Seamlessly registers workspace backup version 10 inside the backup export/import engine.
- Preserves the user's selected locale during workspace export and restoration.
- **Deep Sanitization**: Automatically strips sensitive authentication keys, access tokens, signed URLs, and authorization headers from backup imports and exports.
- **Atomic Rollbacks**: If writing a restored collection fails midway (e.g., due to local storage limits), a precise transaction rollback restores all pre-existing storage keys.

## Strict Mandate: Explicit-Key Localization Only

AI Creator OS strictly enforces explicit-key translation via `t(...)` mapping. 
- **No Automatic Text Replacement**: Run-time arbitrary string search-and-replace, dynamic DOM crawling, recursive parent-wrapper cloning, or MutationObserver translation systems are strictly forbidden.
- **Explicit Key Usage**: Every user-visible static literal string must be explicitly wrapped in `t('key_path')` calls referencing stable keys in the locale dictionaries (`pt-BR.ts`, `en.ts`, `es.ts`).
- **Data Preservation**: User-created content, product/character/campaign names, custom templates, and system-level raw database IDs/enum values must remain strictly untouched and byte-identical when locale is changed.

---

## Candidate Validation Contract
Before promotion, the candidate must pass the independent Quality Gate with:
- clean `npm ci` from the locked dependency graph;
- TypeScript typecheck and blocking AST localization lint;
- standard and deterministic shuffled Vitest runs;
- production build and all-route preview smoke tests;
- Firebase excluded from the initial `modulepreload`;
- one clean, integrity-verified ZIP with no nested archives or development artifacts.

The source-level repair validates dictionary isomorphism, placeholder parity, literal translation-key resolution, locale-file TypeScript compilation, and AST scanning. The package remains a Sprint 14C candidate until the complete independent Quality Gate is executed.
