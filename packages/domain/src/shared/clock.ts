/** Pure calendar validation and explicit clock port. No implicit local timezone or system time. */
export interface Clock { nowUtc():string }
export function isCalendarDay(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function requireCalendarDay(value:string):string{
 if(!isCalendarDay(value))throw new Error('Invalid work day');return value;
}
