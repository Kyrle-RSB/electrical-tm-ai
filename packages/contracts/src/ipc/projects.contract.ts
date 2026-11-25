/** Project DTOs are shared across renderer, application and persistence boundaries. */
export type ProjectState='planned'|'active'|'on-hold'|'complete'|'closed'|'archived';
export type ProjectDetailsFields={name:string;billingAddress:string;notes:string};
export type ProjectInput={code:string;customer:string;siteAddress:string;details?:ProjectDetailsFields};
export type ProjectEditInput=ProjectInput&{id:string};
export type ProjectDetailsInput=ProjectDetailsFields&{id:string};
export type ProjectStatusInput={id:string;status:ProjectState;reason?:string};
export type ProjectData={id:string;project_code:string;customer_name:string;site_address:string};
export type DetailedProject=ProjectData&{status:ProjectState;project_name:string;billing_address:string;notes:string;opened_utc:string};
