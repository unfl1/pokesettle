export type Dictionary = Record<string, string>;
export function createTranslator(dictionary: Dictionary) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const text = Object.hasOwn(dictionary, key) ? dictionary[key] : key;
    return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
  };
}
