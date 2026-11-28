/** WCAG 2.x relative luminance and contrast ratio for #rrggbb colours. */
export function parseHexColor(value:string):[number,number,number]{
 const m=/^#([0-9a-f]{6})$/i.exec(value.trim());
 if(!m)throw new Error('Expected a #rrggbb colour, got '+JSON.stringify(value));
 const n=m[1];
 return [0,2,4].map(i=>parseInt(n.slice(i,i+2),16)) as [number,number,number];
}
export function relativeLuminance(hex:string):number{
 const [r,g,b]=parseHexColor(hex).map(c=>{const s=c/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;});
 return 0.2126*r+0.7152*g+0.0722*b;
}
export function contrastRatio(a:string,b:string):number{
 const x=relativeLuminance(a),y=relativeLuminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
