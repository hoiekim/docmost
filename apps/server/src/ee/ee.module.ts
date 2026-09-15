// Adapter only. The open-source app.module.ts requires './ee/ee.module' by
// fixed relative path; the real implementation lives in ../ce. See ce/README.md.
export { EeModule } from '../ce/ee.module';
