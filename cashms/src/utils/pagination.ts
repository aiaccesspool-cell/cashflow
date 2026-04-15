export interface NormalizedPaginatedResponse<T> {
  data: T[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  summary?: Record<string, any>;
  filters?: Record<string, any>;
}

export function normalizePaginatedResponse<T>(
  responseData: any,
  page: number,
  pageSize: number,
  summaryFallback?: Record<string, any>
): NormalizedPaginatedResponse<T> {
  if (Array.isArray(responseData)) {
    const total = responseData.length;

    return {
      data: responseData,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      page,
      pageSize,
      startIndex: total === 0 ? 0 : 1,
      endIndex: total,
      summary: summaryFallback || {},
      filters: {},
    };
  }

  return {
    data: Array.isArray(responseData?.data) ? responseData.data : [],
    total: Number(responseData?.total || 0),
    totalPages: Number(responseData?.totalPages || 1),
    page: Number(responseData?.page || page),
    pageSize: Number(responseData?.pageSize || pageSize),
    startIndex: Number(responseData?.startIndex || 0),
    endIndex: Number(responseData?.endIndex || 0),
    summary: responseData?.summary || summaryFallback || {},
    filters: responseData?.filters || {},
  };
}