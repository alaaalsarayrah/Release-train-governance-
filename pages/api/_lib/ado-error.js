function classifyByStatus(status) {
  if (status === 401) {
    return {
      status: 401,
      code: 'ADO_AUTH',
      message: 'ADO authentication failed. Check PAT configuration and token expiry.',
      retryable: false
    }
  }

  if (status === 403) {
    return {
      status: 403,
      code: 'ADO_FORBIDDEN',
      message: 'ADO access is forbidden for the current token or organization policy.',
      retryable: false
    }
  }

  if (status === 404) {
    return {
      status: 404,
      code: 'ADO_NOT_FOUND',
      message: 'Requested ADO resource was not found.',
      retryable: false
    }
  }

  if (status === 429) {
    return {
      status: 429,
      code: 'ADO_THROTTLED',
      message: 'ADO request limit reached. Retry after a short delay.',
      retryable: true
    }
  }

  if (status >= 500 && status <= 599) {
    return {
      status: 503,
      code: 'ADO_UNAVAILABLE',
      message: 'ADO service is temporarily unavailable.',
      retryable: true
    }
  }

  return null
}

export function classifyAdoError(err, fallbackMessage = 'ADO request failed') {
  const status = Number(err?.status || err?.statusCode || 0)
  const raw = String(err?.message || err || '').trim()
  const message = raw || fallbackMessage
  const byStatus = classifyByStatus(status)
  if (byStatus) {
    return {
      ...byStatus,
      detail: message
    }
  }

  const lower = message.toLowerCase()

  if (lower.includes('unauthorized') || lower.includes('pat') || lower.includes('token') || lower.includes('tf400813')) {
    return {
      status: 401,
      code: 'ADO_AUTH',
      message: 'ADO authentication failed. Check PAT configuration and token expiry.',
      detail: message,
      retryable: false
    }
  }

  if (lower.includes('forbidden') || lower.includes('permission') || lower.includes('outside your directory') || lower.includes('doesn\'t allow')) {
    return {
      status: 403,
      code: 'ADO_FORBIDDEN',
      message: 'ADO access is forbidden for the current token or organization policy.',
      detail: message,
      retryable: false
    }
  }

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('econnreset') || lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('fetch failed')) {
    return {
      status: 503,
      code: 'ADO_UNAVAILABLE',
      message: 'ADO service is unreachable right now. Retry later.',
      detail: message,
      retryable: true
    }
  }

  return {
    status: 500,
    code: 'ADO_UNKNOWN',
    message: fallbackMessage,
    detail: message,
    retryable: false
  }
}

export function sendAdoError(res, err, fallbackMessage = 'ADO operation failed') {
  const parsed = classifyAdoError(err, fallbackMessage)
  return res.status(parsed.status).json({
    message: fallbackMessage,
    error: parsed.detail,
    adoErrorCode: parsed.code,
    adoErrorMessage: parsed.message,
    retryable: parsed.retryable
  })
}
