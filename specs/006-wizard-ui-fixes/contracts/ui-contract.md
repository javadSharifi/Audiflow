# UI Contracts: Wizard UI Fixes

## C1. `WizardResultList` props

```text
{ lang: Lang }
```

- Reads `jobs` from `useAppStore` directly (no props for data).
- Renders `data-testid="wizard-result-list"`.
- Success row: `data-testid="result-row-{index}"` with name, format, size (when known), done icon.
- Error row: `data-testid="result-error-{index}"` with name + error text, no size.
- Folder banner(s): `data-testid="result-folder-banner"` with folder path + guidance text.
- MUST NOT render: `audio` elements, share/copy/open buttons.

## C2. Wizard CTA scale

- `wizard-next`, `wizard-convert`, `wizard-restart`, `wizard-back`: height `h-[52px]` (nav-button scale), `rounded-3xl`/`rounded-full`, gradient for primary / ghost for back.
- Wizard scroll container keeps bottom clearance ≥ bottom-nav height + spacing at 360px width.

## C3. FileRow trim/boost controls

- Desktop: `trim-toggle-{name}` / `boost-toggle-{name}`; mobile: `trim-toggle-mobile-{name}` / `boost-toggle-mobile-{name}` (testids preserved).
- Each control: icon + visible text label, min target 40×40px.
- Helper line under list: `data-testid="trim-boost-hint"` with emphasized key terms.

## C4. i18n keys (en + fa, no hardcodes)

`resultDoneMessage`, `resultFolderGuidance`, `resultFailedLabel`, `trimBoostHint`, (+ reuse of existing `resultSize`, `converterResultEmpty`, `trimEdit`, `fileBoosterTitle` where they fit).
