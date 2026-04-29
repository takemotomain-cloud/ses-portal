/**
 * HTTP例外フィルター
 *
 * 全エンドポイントのエラーレスポンスを統一フォーマットにする。
 * ユーザーには「何が起きたか」だけを伝え、内部情報は含めない。
 * 開発者向けの詳細はサーバーログに出力する。
 *
 * セキュリティ: スタックトレース・DB構造・ファイルパスは
 * ユーザー向けレスポンスに絶対に含めない。
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string'
        ? res
        : (res as any).message || '処理中にエラーが発生しました';

      // バリデーションエラーの場合、メッセージが配列の場合がある
      if (Array.isArray(message)) {
        message = message[0];
      }
    } else {
      // 予期しないエラー: 500を返し、詳細はログのみに記録
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'サーバーエラーが発生しました。しばらく経ってから再度お試しください';

      // 開発者向けの詳細ログ（ユーザーには見えない）
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // 4xx系もログに記録（不正アクセス検知に使用）
    if (status >= 400 && status < 500) {
      this.logger.warn(
        `${status} ${request.method} ${request.url} - ${message}`,
      );
    }

    // ユーザー向けレスポンス（内部情報を含めない）
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
