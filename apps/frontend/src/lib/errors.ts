export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado') {
  const anyError = error as any;
  const responseData = anyError?.response?.data;

  if (responseData) {
    if (typeof responseData.message === 'string') {
      return responseData.message;
    }

    if (Array.isArray(responseData.message)) {
      return responseData.message.join('\n');
    }

    if (responseData.error) {
      return responseData.error;
    }
  }

  if (anyError?.message) {
    return anyError.message;
  }

  return fallback;
}
