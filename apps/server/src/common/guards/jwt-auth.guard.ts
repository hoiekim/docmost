import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import { validate as isValidUUID } from 'uuid';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
      private reflector: Reflector,
      private pageRepo: PageRepo,
      private spaceRepo: SpaceRepo
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    if (this.isPublicApi(context)) return true;

    try {
      const superResult = await super.canActivate(context)
      return superResult as boolean
    } catch (error) {
      const isPublishedPage = await this.isPublishedPage(context);
      if (isPublishedPage) return true
      else throw error
    }
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }

  isPublicApi(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  async isPublishedPage(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const referer = request?.headers?.referer;
  
    if (!referer) return false;
  
    try {
      const { pathname } = new URL(referer);
      const parts = pathname.split("/");
      const pIndex = parts.indexOf("p");
      if (pIndex !== parts.length - 2) return false;
  
      const slug = this.extractPageSlugId(parts[parts.length - 1]);
      const page = await this.pageRepo.findById(slug)
      if (!page) return false
  
      const { spaceId, workspaceId } = page
      const space = await this.spaceRepo.findById(spaceId, workspaceId)
      if (!space) return false

      const { isPublished } = space

      request.isPublishedPage = isPublished
      return isPublished
    } catch (error) {
      console.error('Invalid Referer URL:', referer);
    }
  
    return false;
  }

  extractPageSlugId(slug: string): string {
    if (!slug) {
      return undefined;
    }
    if (isValidUUID(slug)) {
      return slug;
    }
    const parts = slug.split("-");
    return parts.length > 1 ? parts[parts.length - 1] : slug;
  }
}