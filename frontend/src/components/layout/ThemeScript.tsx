export const themeStorageKey = 'pokesettle_theme';

// Apply before first paint without making the shared HTML depend on cookies.
export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{document.documentElement.dataset.theme=localStorage.getItem('${themeStorageKey}')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}`,
      }}
    />
  );
}
