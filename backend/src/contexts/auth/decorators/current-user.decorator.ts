import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserEntity } from '../../identity/user.entity';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserEntity => {
    const req = ctx
      .switchToHttp()
      .getRequest<Record<string, unknown> & { user: UserEntity }>();
    return req.user;
  },
);
