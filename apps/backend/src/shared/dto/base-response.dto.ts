export class BaseResponseDto<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  timestamp: string;

  constructor(data?: T, message: string = 'Operation successful') {
    this.success = true;
    this.statusCode = 200;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }
}

export class PaginatedResponseDto<T> extends BaseResponseDto<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };

  constructor(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
    message: string = 'Data retrieved successfully',
  ) {
    super(data, message);
    
    const totalPages = Math.ceil(total / pageSize);
    
    this.pagination = {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
}
