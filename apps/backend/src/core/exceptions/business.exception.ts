import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../constants/error-codes';

export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly details?: any,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        statusCode,
        errorCode,
        message: ErrorMessages[errorCode],
        details,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

// Specific Business Exceptions
export class UserNotFoundException extends BusinessException {
  constructor(userId?: string) {
    super(
      ErrorCode.USER_NOT_FOUND,
      { userId },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BusinessNotFoundException extends BusinessException {
  constructor(businessId?: string) {
    super(
      ErrorCode.BUSINESS_NOT_FOUND,
      { businessId },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class FileNotFoundException extends BusinessException {
  constructor(fileId?: string) {
    super(
      ErrorCode.FILE_NOT_FOUND,
      { fileId },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidCredentialsException extends BusinessException {
  constructor() {
    super(
      ErrorCode.INVALID_CREDENTIALS,
      null,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(message?: string) {
    super(
      ErrorCode.UNAUTHORIZED,
      { message },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
