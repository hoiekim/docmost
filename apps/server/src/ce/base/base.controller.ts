import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { BaseAccessService } from './services/base-access.service';
import { BaseService } from './services/base.service';
import { BasePropertyService } from './services/base-property.service';
import { BaseRowService } from './services/base-row.service';
import { BaseViewService } from './services/base-view.service';
import { BaseCsvService } from './services/base-csv.service';
import {
  BasePageIdDto,
  ConvertBaseDto,
  CreateBaseDto,
  ListBasesDto,
  UpdateBaseDto,
} from './dto/base.dto';
import {
  CreatePropertyDto,
  DeletePropertyDto,
  ReorderPropertyDto,
  UpdatePropertyDto,
} from './dto/property.dto';
import {
  CreateRowDto,
  DeleteRowDto,
  DeleteRowsDto,
  ListRowsDto,
  ReorderRowDto,
  RowInfoDto,
  UpdateRowDto,
} from './dto/row.dto';
import { CreateViewDto, DeleteViewDto, UpdateViewDto } from './dto/view.dto';
import { ExpandPagesDto } from './dto/pages-expand.dto';

/**
 * REST surface consumed by apps/client/src/ee/base/services/base-service.ts.
 * Every route: feature gate → load base page → page-level view/edit check.
 */
@UseGuards(JwtAuthGuard)
@Controller('bases')
export class BaseController {
  constructor(
    private readonly access: BaseAccessService,
    private readonly baseService: BaseService,
    private readonly propertyService: BasePropertyService,
    private readonly rowService: BaseRowService,
    private readonly viewService: BaseViewService,
    private readonly csvService: BaseCsvService,
  ) {}

  private async viewable(pageId: string, user: User, workspace: Workspace) {
    await this.access.assertFeature(workspace);
    const page = await this.access.loadBase(pageId, workspace.id);
    const permissions = await this.access.canView(page, user);
    return { page, permissions };
  }

  private async editable(pageId: string, user: User, workspace: Workspace) {
    await this.access.assertFeature(workspace);
    const page = await this.access.loadBase(pageId, workspace.id);
    await this.access.canEdit(page, user);
    return page;
  }

  // ---- base ----

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() dto: ListBasesDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.access.assertFeature(workspace);
    return this.baseService.list(user, workspace, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.access.assertFeature(workspace);
    return this.baseService.create(user, workspace, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(
    @Body() dto: BasePageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { page, permissions } = await this.viewable(dto.pageId, user, workspace);
    return this.baseService.getBase(page, permissions);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    return this.baseService.update(page, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(
    @Body() dto: BasePageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    await this.baseService.delete(page, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('convert')
  async convert(
    @Body() dto: ConvertBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.access.assertFeature(workspace);
    return this.baseService.convert(user, workspace, dto.pageId, dto.template);
  }

  @HttpCode(HttpStatus.OK)
  @Post('export-csv')
  async exportCsv(
    @Body() dto: BasePageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    const { page } = await this.viewable(dto.pageId, user, workspace);
    const { fileName, content } = await this.csvService.export(page, user);
    const encoded = encodeURIComponent(fileName);
    res.headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    });
    res.send(content);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/expand')
  async expandPages(
    @Body() dto: ExpandPagesDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.access.assertFeature(workspace);
    return this.baseService.expandPages(user, workspace, dto.pageIds);
  }

  // ---- properties ----

  @HttpCode(HttpStatus.OK)
  @Post('properties/create')
  async createProperty(
    @Body() dto: CreatePropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    return this.propertyService.create(page, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('properties/update')
  async updateProperty(
    @Body() dto: UpdatePropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    return this.propertyService.update(page, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('properties/delete')
  async deleteProperty(
    @Body() dto: DeletePropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    await this.propertyService.delete(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('properties/reorder')
  async reorderProperty(
    @Body() dto: ReorderPropertyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    await this.propertyService.reorder(page, dto);
  }

  // ---- rows ----

  @HttpCode(HttpStatus.OK)
  @Post('rows')
  async listRows(
    @Body() dto: ListRowsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { page } = await this.viewable(dto.pageId, user, workspace);
    return this.rowService.list(page, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/create')
  async createRow(
    @Body() dto: CreateRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    return this.rowService.create(page, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/info')
  async rowInfo(
    @Body() dto: RowInfoDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { page } = await this.viewable(dto.pageId, user, workspace);
    return this.rowService.info(page, dto.rowId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/update')
  async updateRow(
    @Body() dto: UpdateRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    return this.rowService.update(page, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/delete')
  async deleteRow(
    @Body() dto: DeleteRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    await this.rowService.delete(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/delete-many')
  async deleteRows(
    @Body() dto: DeleteRowsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    await this.rowService.deleteMany(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/reorder')
  async reorderRow(
    @Body() dto: ReorderRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    await this.rowService.reorder(page, user, dto);
  }

  // ---- views ----

  @HttpCode(HttpStatus.OK)
  @Post('views')
  async listViews(
    @Body() dto: BasePageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { page } = await this.viewable(dto.pageId, user, workspace);
    return this.viewService.list(page);
  }

  @HttpCode(HttpStatus.OK)
  @Post('views/create')
  async createView(
    @Body() dto: CreateViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    return this.viewService.create(page, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('views/update')
  async updateView(
    @Body() dto: UpdateViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    return this.viewService.update(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('views/delete')
  async deleteView(
    @Body() dto: DeleteViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.editable(dto.pageId, user, workspace);
    await this.viewService.delete(page, dto);
  }
}
