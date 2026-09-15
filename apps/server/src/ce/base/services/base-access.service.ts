import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Page, User, Workspace } from '@docmost/db/types/entity.types';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { PageAccessService } from '../../../core/page/page-access/page-access.service';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service';
import { Feature } from '../../../common/features';
import { BasePage, BasePageRepo } from '../repos/base-page.repo';
import { BasePermissions } from '../types/base.types';

/**
 * Shared guard sequence for every /bases route: feature gate → load page →
 * page-level view/edit check via the open-source PageAccessService.
 */
@Injectable()
export class BaseAccessService {
  constructor(
    private readonly basePageRepo: BasePageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly licenseCheckService: LicenseCheckService,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  async assertFeature(workspace: Workspace): Promise<void> {
    let licenseKey = workspace.licenseKey;
    if (!licenseKey) {
      licenseKey = await this.workspaceRepo.findLicenseKeyById(workspace.id);
    }
    const ok = this.licenseCheckService.hasFeature(
      licenseKey,
      Feature.BASES,
      workspace.plan,
    );
    if (!ok) {
      throw new ForbiddenException('This feature requires a valid license');
    }
  }

  /** A live page (base or not); 404 otherwise. */
  async loadPage(pageId: string, workspaceId: string): Promise<BasePage> {
    const page = await this.basePageRepo.findPage(pageId);
    if (!page || page.deletedAt || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  /** A live page flagged as a base; 404 otherwise. */
  async loadBase(pageId: string, workspaceId: string): Promise<BasePage> {
    const page = await this.basePageRepo.findPage(pageId);
    if (
      !page ||
      page.deletedAt ||
      !page.isBase ||
      page.workspaceId !== workspaceId
    ) {
      throw new NotFoundException('Base not found');
    }
    return page;
  }

  async canView(page: BasePage, user: User): Promise<BasePermissions> {
    return this.pageAccessService.validateCanViewWithPermissions(
      page as unknown as Page,
      user,
    );
  }

  async canEdit(page: BasePage, user: User): Promise<void> {
    await this.pageAccessService.validateCanEdit(page as unknown as Page, user);
  }
}
