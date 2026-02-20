export type ApiErrorCode = "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND";

const API_ERROR_CODES: ApiErrorCode[] = ["AUTH_REQUIRED", "FORBIDDEN", "NOT_FOUND"];

export class ApiError extends Error {
  status: number;
  code?: ApiErrorCode;

  constructor(message: string, status: number, code?: ApiErrorCode) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const isApiErrorCode = (value: unknown): value is ApiErrorCode =>
  typeof value === "string" && API_ERROR_CODES.includes(value as ApiErrorCode);

export const parseApiError = async (
  response: Response,
  fallbackMessage: string,
): Promise<ApiError> => {
  let message = fallbackMessage;
  let code: ApiErrorCode | undefined;

  if (response.status === 403) code = "AUTH_REQUIRED";
  if (response.status === 404) code = "NOT_FOUND";

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.clone().json()) as Record<string, unknown>;
      if (typeof body?.message === "string" && body.message.trim()) {
        message = body.message;
      }
      if (isApiErrorCode(body?.code)) {
        code = body.code;
      }
    } catch {
      // 忽略 JSON 解析失败，沿用默认 code/message
    }
  } else {
    try {
      const text = (await response.clone().text()).trim();
      if (text) message = text;
    } catch {
      // 忽略文本解析失败，沿用默认 code/message
    }
  }

  return new ApiError(message, response.status, code);
};

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export const isAuthRequiredError = (error: unknown): boolean =>
  isApiError(error) && error.status === 403 && error.code === "AUTH_REQUIRED";

export const isForbiddenError = (error: unknown): boolean =>
  isApiError(error) && error.status === 403 && error.code === "FORBIDDEN";

export const isNotFoundError = (error: unknown): boolean =>
  isApiError(error) && error.status === 404 && error.code === "NOT_FOUND";
