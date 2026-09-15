import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { User } from '@docmost/db/types/entity.types';
import { sanitizeFileName } from '../../../common/helpers';
import { BasePage } from '../repos/base-page.repo';
import { BasePropertyRepo } from '../repos/base-property.repo';
import { BaseRowRepo } from '../repos/base-row.repo';
import { cellToText, readCell, RenderRefs } from '../engine/cell-renderer';
import { BaseReferenceService } from './base-reference.service';
import { IBaseRow, toIBaseProperty, toIBaseRow } from '../types/base.types';

export type CsvExport = { fileName: string; content: string };

@Injectable()
export class BaseCsvService {
  constructor(
    private readonly propertyRepo: BasePropertyRepo,
    private readonly rowRepo: BaseRowRepo,
    private readonly referenceService: BaseReferenceService,
  ) {}

  /**
   * Render every live row in position order. Choice ids become names,
   * user and page ids become names/titles the exporting user may see.
   */
  async export(page: BasePage, user: User): Promise<CsvExport> {
    const props = (await this.propertyRepo.findAlive(page.id)).map(
      toIBaseProperty,
    );
    const records: string[][] = [props.map((p) => p.name)];

    for await (const batch of this.rowRepo.iterateByPosition(page.id)) {
      const rows: IBaseRow[] = batch.map(toIBaseRow);
      const references = await this.referenceService.buildRowReferences(
        rows,
        props,
        user,
        page.workspaceId,
      );
      const refs: RenderRefs = {
        users: new Map(Object.entries(references.users)),
        pages: new Map(Object.entries(references.pages)),
      };
      for (const row of rows) {
        records.push(props.map((p) => cellToText(readCell(row, p), p, refs)));
      }
    }

    const content = stringify(records, { bom: true });
    const title = sanitizeFileName(page.title || 'Untitled base', {
      preserveSpaces: true,
    });
    return { fileName: `${title || 'base'}.csv`, content };
  }
}
