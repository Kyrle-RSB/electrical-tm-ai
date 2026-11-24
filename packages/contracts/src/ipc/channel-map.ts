/** Public allowlist. Never forward unstructured channel strings to ipcRenderer. */
export const CHANNELS = {
  ping: 'health.ping',
  projectAdd: 'projects.create',
  projectEdit: 'projects.edit',
  projectList: 'projects.list',
  projectDetailedList: 'projects.listDetailed',
  projectDetails: 'projects.updateDetails',
  projectStatus: 'projects.setStatus',
  businessGet: 'business.get',
  businessUpdate: 'business.update',
  fileImport: 'documents.importImage',
  pdfCreate: 'documents.renderInvoiceProof',
  backupCreate: 'backup.create',
  backupGetLocation:'backup.getLocation',
  backupChooseLocation:'backup.chooseLocation',
  backupCreateStored:'backup.createInSelectedFolder',
  backupRestore: 'backup.restore',
  fakeSecretStore: 'secrets.probeStoreFake',
  fakeSecretCheck: 'secrets.probeCheckFake',
  fakeSecretRemove: 'secrets.probeRemoveFake'
} as const;
export type AllowedChannel = typeof CHANNELS[keyof typeof CHANNELS];
export const ALL_CHANNELS = Object.freeze(Object.values(CHANNELS));
