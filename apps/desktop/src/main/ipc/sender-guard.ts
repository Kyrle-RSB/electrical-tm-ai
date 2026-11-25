export type FrameLike={url:string;top?:FrameLike|null};
export type WebContentsLike={id:number;isDestroyed?:()=>boolean};
export type SenderEventLike={sender:WebContentsLike;senderFrame:FrameLike|null};
/** Guard both sender webContents identity and exact top-frame URL, never broad startsWith. */
export function isTrustedSender(event:SenderEventLike,primary:WebContentsLike,expectedFrameUrl:string):boolean{
  if(event.sender!==primary||event.sender.isDestroyed?.())return false;
  const frame=event.senderFrame;
  if(!frame||frame.top!==frame||frame.url!==expectedFrameUrl)return false;
  return true;
}
