export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch {
    throw new ApiError(
      'CONNECTION_FAILED',
      '서버에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해 주세요.',
      true,
    );
  }
  if (response.status === 204) return undefined as T;
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      '서버 응답을 읽을 수 없습니다.',
      true,
    );
  }
  if (!response.ok)
    throw new ApiError(
      body.error?.code ?? 'SERVER_ERROR',
      body.error?.message ?? '요청을 처리하지 못했습니다.',
      body.error?.retryable ?? false,
    );
  return body.data as T;
}

export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
