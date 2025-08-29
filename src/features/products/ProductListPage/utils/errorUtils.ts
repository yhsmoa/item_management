// Error handling utility functions

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    return JSON.stringify(error, null, 2);
  }
  return '알 수 없는 오류가 발생했습니다.';
};

export const getErrorStack = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.stack;
  }
  if (error && typeof error === 'object' && 'stack' in error && typeof error.stack === 'string') {
    return error.stack;
  }
  return undefined;
};