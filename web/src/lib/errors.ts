export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = error.details[0];
    if (first && typeof first === "object" && first !== null && "msg" in first) {
      return `${error.message} ${String((first as { msg: unknown }).msg)}`;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}
