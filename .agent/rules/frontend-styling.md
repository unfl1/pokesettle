# Frontend Styling Rules

## Scope and activation

- Read and follow this document before changing frontend styles, JSX markup, theme tokens, fonts, or animations.
- Applies to `frontend/src/**/*.{ts,tsx}` and the frontend styling pipeline.
- This is a repository convention referenced by the root `AGENTS.md`; `.agent/rules/` is not an automatic Codex instruction discovery location.

## File ownership

| Location | Responsibility |
| --- | --- |
| `frontend/src/globals.css` | The only authored CSS file: Tailwind import, shared theme tokens, animation keyframes, custom variants, and font plugin registration |
| `frontend/src/styles/document.ts` | Shared document utilities: defaults, inherited dark palette, focus visibility, selection, and reduced motion |
| React components | Layout, spacing, typography, responsive behavior, and interaction states through `className` utilities |
| `frontend/tailwind-fonts.mjs` | Generate Unicode font-face subsets from the existing manifest; preserve font licenses and loading behavior |
| `frontend/src/app/fonts.ts` | Next.js local font registration for common glyphs |

## Required styling approach

- Use Tailwind CSS v4 CSS-first configuration and React `className` utilities. “Inline” means utilities next to JSX, not React `style` objects.
- Do not add CSS Modules, additional CSS/Sass/Less files, styled-jsx, CSS-in-JS, `@apply` component classes, or global page selectors.
- Prefer built-in utilities such as `mx-auto`, `items-start`, and `motion-reduce:` over equivalent arbitrary properties or media variants.
- Keep arbitrary values and variants for values or selectors without an equivalent utility. Prefer styles directly on owned elements; descendant variants are appropriate for shared document defaults or generated content.
- Keep class candidates complete and statically detectable. Use explicit maps of full class strings for finite dynamic states; do not interpolate fragments such as `bg-${color}`.
- Extract React components when repeated markup represents the same UI responsibility. Do not create a separate selector-based styling system to shorten JSX.
- Keep nonvisual hooks required by selectors, tests, or code; inspect references before removing or renaming class names.

## Global configuration decisions

- Keep the Tailwind source root explicitly scoped to `frontend/src` using `source('./')` in `globals.css`. Register any future external utility source explicitly.
- Add shared semantic tokens only when they represent a reusable product concept. Keep one-off values in component utilities.
- Preserve the 4px spacing scale and existing typography. Do not change root sizing to simplify class names.
- Use `@theme inline` for utilities that must resolve another variable where the utility is applied, such as the Next.js font variable.
- Preserve semantic color inheritance across light and dark mode. Avoid fixed light colors for surfaces or readable text.
- Reuse existing responsive variants. `max-tablet` includes 780px; do not reintroduce the duplicate `screen-780` variant. Preserve inclusive boundary behavior when refactoring.
- Keep keyframes in `@theme`, connected to `--animate-*` tokens. Preserve related animation timing and reduced-motion alternatives.
- Use the font plugin for generated font-face declarations. Do not replace Unicode subsets with eager full-font downloads.

## Runtime values and accessibility

- Use SVG numeric attributes for statistical bars and Web Animations API for capture movement based on measured DOM coordinates.
- Preserve visible keyboard focus, disabled states, reduced motion, readable dark colors, and mobile overflow behavior.
- Keep theme initialization and shared document classes consistent across localized and legal root layouts.

## Verification and reporting

- Inspect installed package versions and scripts before choosing commands.
- Run checks needed by the change; do not mandate lint, typecheck, tests, and build as a fixed batch.
- For changes to class detection or theme generation, inspect compiled CSS. For layout changes, check affected viewport boundaries and themes when a browser is available.
- Report completed checks and unverified behavior accurately. Do not claim runtime or transfer-size improvements from source cleanup alone.

## References

- [Tailwind theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind class detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Codex AGENTS.md instructions](https://developers.openai.com/codex/guides/agents-md)
