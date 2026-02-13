import { Hocuspocus, Server as HocuspocusServer, Document } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { Injectable, Logger } from '@nestjs/common';
import { Redis } from '@hocuspocus/extension-redis';
import { EnvironmentService } from '../integrations/environment/environment.service';
import {
  createRetryStrategy,
  parseRedisUrl,
  RedisConfig,
} from '../common/helpers';
import { LoggerExtension } from './extensions/logger.extension';
import { tiptapExtensions } from './collaboration.util';

@Injectable()
export class CollaborationGateway {
  private readonly logger = new Logger(CollaborationGateway.name);
  private hocuspocus: Hocuspocus;
  private redisConfig: RedisConfig;

  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
    private loggerExtension: LoggerExtension,
    private environmentService: EnvironmentService,
  ) {
    this.redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());

    this.hocuspocus = HocuspocusServer.configure({
      debounce: 10000,
      maxDebounce: 45000,
      unloadImmediately: false,
      extensions: [
        this.authenticationExtension,
        this.persistenceExtension,
        this.loggerExtension,
        ...(this.environmentService.isCollabDisableRedis()
          ? []
          : [
              new Redis({
                host: this.redisConfig.host,
                port: this.redisConfig.port,
                options: {
                  password: this.redisConfig.password,
                  db: this.redisConfig.db,
                  family: this.redisConfig.family,
                  retryStrategy: createRetryStrategy(),
                },
              }),
            ]),
      ],
    });
  }

  handleConnection(client: WebSocket, request: IncomingMessage): any {
    this.hocuspocus.handleConnection(client, request);
  }

  getConnectionCount() {
    return this.hocuspocus.getConnectionsCount();
  }

  getDocumentCount() {
    return this.hocuspocus.getDocumentsCount();
  }

  async destroy(): Promise<void> {
    await this.hocuspocus.destroy();
  }

  /**
   * Replace document content and sync to all connected Y.js clients.
   * This properly updates all browsers viewing the page without disconnecting them.
   * @param documentName The document name (e.g., "page.{pageId}")
   * @param prosemirrorJson The new content in ProseMirror/TipTap JSON format
   */
  async replaceDocumentContent(
    documentName: string,
    prosemirrorJson: Record<string, any>,
  ): Promise<void> {
    this.logger.debug(`Replacing content for ${documentName}`);
    
    const connection = await this.hocuspocus.openDirectConnection(documentName);
    try {
      await connection.transact((doc: Document) => {
        const fragment = doc.getXmlFragment('default');
        
        // Clear existing content
        if (fragment.length > 0) {
          fragment.delete(0, fragment.length);
        }
        
        // Create new Y.js doc from ProseMirror JSON and apply update
        const newDoc = TiptapTransformer.toYdoc(
          prosemirrorJson,
          'default',
          tiptapExtensions,
        );
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(newDoc));
      });
    } finally {
      await connection.disconnect();
    }
  }
}
