export {};
declare global {
  interface Window {
    tmBridge: {
      ping():Promise<{status:string;foundation:boolean}>;
      createProject(x:{code:string;customer:string;siteAddress:string}):Promise<{projectId:string}>;
      updateProject(x:{id:string;code:string;customer:string;siteAddress:string}):Promise<{updated:boolean}>;
      listProjects():Promise<Array<{id:string;project_code:string;customer_name:string;site_address:string}>>;
      listProjectsDetailed():Promise<Array<{id:string;project_code:string;customer_name:string;site_address:string;status:string;project_name:string;billing_address:string;notes:string}>>;
      updateProjectDetails(value:{id:string;name:string;billingAddress:string;notes:string}):Promise<{updated:boolean}>;
      setProjectStatus(value:{id:string;status:string}):Promise<{updated:boolean}>;
      getBusinessProfile():Promise<{legalName:string;tradeName:string;phone:string;email:string;mailingAddress:string;currency:string;taxId:string;contractorLicense:string}>;
      updateBusinessProfile(value:{legalName:string;tradeName:string;phone:string;email:string;mailingAddress:string;taxId:string;contractorLicense:string}):Promise<{updated:boolean}>;
      importReceiptImage():Promise<unknown>;
      saveSyntheticPdf():Promise<string|null>;
      chooseBackupFolderAndBackUp():Promise<unknown>;
      getBackupFolder():Promise<{folder:string|null}>;
      chooseBackupFolder():Promise<{folder:string}|null>;
      backUpToSelectedFolder():Promise<{backupPath:string;manifest:unknown}>;
      chooseBackupAndRestore():Promise<unknown>;
      storeFakeSecretProof():Promise<unknown>;
      checkFakeSecretProof():Promise<unknown>;
      removeFakeSecretProof():Promise<unknown>;
    }
  }
}
