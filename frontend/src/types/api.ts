export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface Status {
  ready: boolean;
  modelConfigured: boolean;
  metadataCount: number;
  speciesCount?: number;
  alternateVarietyCount?: number;
  documentChunkCount: number;
  missing: string[];
}
export interface SafeError {
  code: string;
  message: string;
  retryable: boolean;
}
