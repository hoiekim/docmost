import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { EventName } from '../../../common/events/event.contants';
import {
  BASE_INBOUND_EVENTS,
  getBaseRoomName,
  getSpaceRoomName,
} from '../../../ws/ws.utils';
import { BasePageRepo } from '../repos/base-page.repo';
import {
  BaseFormulaRecomputeCompletedEvent,
  BaseFormulaRecomputeStartedEvent,
  BasePropertyEvent,
  BaseRowCreatedEvent,
  BaseRowDeletedEvent,
  BaseRowReorderedEvent,
  BaseRowsDeletedEvent,
  BaseRowsUpdatedEvent,
  BaseRowUpdatedEvent,
  BaseSchemaBumpedEvent,
  BaseViewEvent,
} from '../types/base.types';

const AUTH_WAIT_ATTEMPTS = 30;
const AUTH_WAIT_INTERVAL_MS = 100;

/**
 * Realtime bridge for bases. Implements the interface expected by the
 * open-source ws/base-realtime.bridge.ts (setServer / isBaseEvent /
 * handleInbound / handleDisconnect) and fans domain events out to the
 * `base-<pageId>` room using the operation names the client hook understands.
 */
@Injectable()
export class BaseWsService {
  private readonly logger = new Logger(BaseWsService.name);
  private server: Server | null = null;

  constructor(
    private readonly basePageRepo: BasePageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  setServer(server: Server): void {
    this.server = server;
  }

  isBaseEvent(data: any): boolean {
    return (
      !!data &&
      typeof data.operation === 'string' &&
      BASE_INBOUND_EVENTS.has(data.operation) &&
      typeof data.pageId === 'string'
    );
  }

  async handleInbound(client: Socket, data: any): Promise<void> {
    switch (data.operation) {
      case 'base:subscribe':
        await this.subscribe(client, data.pageId);
        return;
      case 'base:unsubscribe':
        client.leave(getBaseRoomName(data.pageId));
        return;
      default:
        // base:presence / base:presence:leave are accepted but unused.
        return;
    }
  }

  async handleDisconnect(_client: Socket): Promise<void> {
    // socket.io removes the socket from its rooms on disconnect.
  }

  /**
   * WsGateway.handleConnection verifies the cookie asynchronously; a
   * subscribe sent right after `connect` can arrive before client.data is
   * populated. Wait briefly for it instead of dropping the request.
   */
  private async waitForAuth(client: Socket): Promise<boolean> {
    for (let i = 0; i < AUTH_WAIT_ATTEMPTS; i++) {
      if (client.data?.userId && client.data?.workspaceId) return true;
      if (client.disconnected) return false;
      await new Promise((r) => setTimeout(r, AUTH_WAIT_INTERVAL_MS));
    }
    return false;
  }

  private async subscribe(client: Socket, pageId: string): Promise<void> {
    try {
      if (!(await this.waitForAuth(client))) return;
      const page = await this.basePageRepo.findPage(pageId);
      if (!page || page.deletedAt || !page.isBase) return;
      if (page.workspaceId !== client.data.workspaceId) return;
      // Prefer the DB over client.rooms: the space rooms may not be joined yet.
      const inSpace =
        client.rooms.has(getSpaceRoomName(page.spaceId)) ||
        (await this.spaceMemberRepo.getUserSpaceIds(client.data.userId)).includes(
          page.spaceId,
        );
      if (!inSpace) return;
      const canAccess = await this.pagePermissionRepo.canUserAccessPage(
        client.data.userId,
        page.id,
      );
      if (!canAccess) return;

      client.join(getBaseRoomName(page.id));
      client.emit('message', {
        operation: 'base:subscribed',
        pageId: page.id,
        schemaVersion: page.baseSchemaVersion,
      });
    } catch (err) {
      this.logger.warn(`base:subscribe failed: ${(err as Error).message}`);
    }
  }

  private broadcast(pageId: string, payload: Record<string, unknown>): void {
    this.server?.to(getBaseRoomName(pageId)).emit('message', payload);
  }

  @OnEvent(EventName.BASE_ROW_CREATED)
  onRowCreated(e: BaseRowCreatedEvent) {
    this.broadcast(e.pageId, { operation: 'base:row:created', ...e });
  }

  @OnEvent(EventName.BASE_ROW_UPDATED)
  onRowUpdated(e: BaseRowUpdatedEvent) {
    this.broadcast(e.pageId, { operation: 'base:row:updated', ...e });
  }

  @OnEvent(EventName.BASE_ROW_DELETED)
  onRowDeleted(e: BaseRowDeletedEvent) {
    this.broadcast(e.pageId, { operation: 'base:row:deleted', ...e });
  }

  @OnEvent(EventName.BASE_ROWS_DELETED)
  onRowsDeleted(e: BaseRowsDeletedEvent) {
    this.broadcast(e.pageId, { operation: 'base:rows:deleted', ...e });
  }

  @OnEvent(EventName.BASE_ROW_REORDERED)
  onRowReordered(e: BaseRowReorderedEvent) {
    this.broadcast(e.pageId, { operation: 'base:row:reordered', ...e });
  }

  @OnEvent(EventName.BASE_ROWS_UPDATED)
  onRowsUpdated(e: BaseRowsUpdatedEvent) {
    this.broadcast(e.pageId, { operation: 'base:rows:updated', ...e });
  }

  @OnEvent(EventName.BASE_PROPERTY_CREATED)
  onPropertyCreated(e: BasePropertyEvent) {
    this.broadcast(e.pageId, { operation: 'base:property:created', ...e });
  }

  @OnEvent(EventName.BASE_PROPERTY_UPDATED)
  onPropertyUpdated(e: BasePropertyEvent) {
    this.broadcast(e.pageId, { operation: 'base:property:updated', ...e });
  }

  @OnEvent(EventName.BASE_PROPERTY_DELETED)
  onPropertyDeleted(e: BasePropertyEvent) {
    this.broadcast(e.pageId, { operation: 'base:property:deleted', ...e });
  }

  @OnEvent(EventName.BASE_PROPERTY_REORDERED)
  onPropertyReordered(e: BasePropertyEvent) {
    this.broadcast(e.pageId, { operation: 'base:property:reordered', ...e });
  }

  @OnEvent(EventName.BASE_VIEW_CREATED)
  onViewCreated(e: BaseViewEvent) {
    this.broadcast(e.pageId, { operation: 'base:view:created', ...e });
  }

  @OnEvent(EventName.BASE_VIEW_UPDATED)
  onViewUpdated(e: BaseViewEvent) {
    this.broadcast(e.pageId, { operation: 'base:view:updated', ...e });
  }

  @OnEvent(EventName.BASE_VIEW_DELETED)
  onViewDeleted(e: BaseViewEvent) {
    this.broadcast(e.pageId, { operation: 'base:view:deleted', ...e });
  }

  @OnEvent(EventName.BASE_SCHEMA_BUMPED)
  onSchemaBumped(e: BaseSchemaBumpedEvent) {
    this.broadcast(e.pageId, { operation: 'base:schema:bumped', ...e });
  }

  @OnEvent(EventName.BASE_FORMULA_RECOMPUTE_STARTED)
  onRecomputeStarted(e: BaseFormulaRecomputeStartedEvent) {
    this.broadcast(e.pageId, {
      operation: 'base:formula:recompute:started',
      ...e,
    });
  }

  @OnEvent(EventName.BASE_FORMULA_RECOMPUTE_COMPLETED)
  onRecomputeCompleted(e: BaseFormulaRecomputeCompletedEvent) {
    this.broadcast(e.pageId, {
      operation: 'base:formula:recompute:completed',
      ...e,
    });
  }
}
