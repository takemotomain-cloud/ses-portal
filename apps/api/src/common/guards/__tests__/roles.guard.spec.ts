/**
 * RolesGuard 単体テスト
 *
 * ロールベースアクセス制御の動作を検証する。
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';

function createMockContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('@Roles()が未指定の場合は全ロール許可', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createMockContext({ role: 'employee' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('空配列の場合も全ロール許可', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const ctx = createMockContext({ role: 'employee' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('指定ロールに一致する場合は許可', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'sales']);
    const ctx = createMockContext({ role: 'admin' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('指定ロールに一致しない場合はForbiddenException', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createMockContext({ role: 'employee' });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('userが存在しない場合はForbiddenException', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createMockContext(null);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
