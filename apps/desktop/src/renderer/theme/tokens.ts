/** Typed names for the design tokens in tokens.css (the one source of values).
 * Use these when TypeScript needs a token, for example `token.color.accent` gives
 * `var(--tm-color-accent)`. tests/unit/design-tokens.test.ts fails if a name here is
 * missing from tokens.css in either theme, or if a listed contrast pair fails WCAG AA. */

export const colorTokens=[
 'bg','surface','surface-subtle','surface-hover','surface-selected',
 'border','border-strong','border-control',
 'text','text-secondary','text-muted',
 'accent','accent-hover','accent-pressed','accent-subtle','accent-text','text-on-accent','focus-ring',
 'danger','danger-hover','danger-text','danger-subtle','text-on-danger',
 'success-text','success-subtle','info-text','info-subtle',
 'skeleton','overlay','tooltip-bg','tooltip-text'
] as const;
export type ColorToken=typeof colorTokens[number];

/** Business document states. Every later screen shows them with StatusBadge. */
export const statuses=['draft','sent','paid','overdue','signed','locked'] as const;
export type Status=typeof statuses[number];

export const textSizes=['xs','sm','md','lg','xl','2xl','3xl','figure','figure-lg'] as const;
export const spaceSteps=['0-5','1','1-5','2','2-5','3','4','5','6','8','10','12','16'] as const;
export const radii=['xs','sm','md','lg','xl','pill'] as const;
export const shadows=['xs','sm','md','lg'] as const;
export const durations=['fast','base','slow'] as const;
export const easings=['standard','exit'] as const;
export const controlHeights=['sm','md','lg'] as const;

type Var<P extends string,K extends string>=`var(--tm-${P}-${K})`;
function vars<P extends string,K extends string>(prefix:P,keys:readonly K[]):{readonly [Key in K]:Var<P,Key>}{
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,`var(--tm-${prefix}-${k})`]))) as {readonly [Key in K]:Var<P,Key>};
}

export const token=Object.freeze({
 color:vars('color',colorTokens),
 status:Object.freeze(Object.fromEntries(statuses.map(s=>[s,{fg:`var(--tm-status-${s}-fg)`,bg:`var(--tm-status-${s}-bg)`}]))) as {readonly [S in Status]:{fg:string;bg:string}},
 text:vars('text',textSizes),
 space:vars('space',spaceSteps),
 radius:vars('radius',radii),
 shadow:vars('shadow',shadows),
 duration:vars('duration',durations),
 ease:vars('ease',easings),
 control:vars('control',controlHeights),
 font:{sans:'var(--tm-font-sans)',mono:'var(--tm-font-mono)'}
});

/** Every custom property name a theme block must define. */
export const themedPropertyNames:readonly string[]=Object.freeze([
 ...colorTokens.map(k=>`--tm-color-${k}`),
 ...statuses.flatMap(s=>[`--tm-status-${s}-fg`,`--tm-status-${s}-bg`]),
 ...shadows.map(k=>`--tm-shadow-${k}`),
 '--tm-overlay-opacity'
]);
/** Every custom property the theme-independent :root block must define. */
export const scalePropertyNames:readonly string[]=Object.freeze([
 '--tm-font-sans','--tm-font-mono',
 ...textSizes.map(k=>`--tm-text-${k}`),
 ...spaceSteps.map(k=>`--tm-space-${k}`),
 ...radii.map(k=>`--tm-radius-${k}`),
 ...durations.map(k=>`--tm-duration-${k}`),
 ...easings.map(k=>`--tm-ease-${k}`),
 ...controlHeights.map(k=>`--tm-control-${k}`)
]);

/** Text and control pairs that must pass in both themes. min is the WCAG ratio:
 * 4.5 for body text, 3 for large text, focus rings and control borders. */
export type ContrastPair={fg:string;bg:string;min:number;use:string};
export const contrastPairs:readonly ContrastPair[]=Object.freeze([
 ...['bg','surface','surface-subtle','surface-hover'].flatMap(bg=>['text','text-secondary','text-muted'].map(fg=>({fg:`--tm-color-${fg}`,bg:`--tm-color-${bg}`,min:4.5,use:`${fg} on ${bg}`}))),
 {fg:'--tm-color-text',bg:'--tm-color-surface-selected',min:4.5,use:'text on a selected row'},
 {fg:'--tm-color-text-on-accent',bg:'--tm-color-accent',min:4.5,use:'primary button label'},
 {fg:'--tm-color-text-on-accent',bg:'--tm-color-accent-hover',min:4.5,use:'primary button label, hover'},
 {fg:'--tm-color-text-on-accent',bg:'--tm-color-accent-pressed',min:4.5,use:'primary button label, pressed'},
 {fg:'--tm-color-accent-text',bg:'--tm-color-surface',min:4.5,use:'accent text and links'},
 {fg:'--tm-color-accent-text',bg:'--tm-color-accent-subtle',min:4.5,use:'accent badge'},
 {fg:'--tm-color-text-on-danger',bg:'--tm-color-danger',min:4.5,use:'danger button label'},
 {fg:'--tm-color-text-on-danger',bg:'--tm-color-danger-hover',min:4.5,use:'danger button label, hover'},
 {fg:'--tm-color-danger-text',bg:'--tm-color-surface',min:4.5,use:'field error message'},
 {fg:'--tm-color-danger-text',bg:'--tm-color-danger-subtle',min:4.5,use:'danger toast'},
 {fg:'--tm-color-success-text',bg:'--tm-color-success-subtle',min:4.5,use:'success toast'},
 {fg:'--tm-color-info-text',bg:'--tm-color-info-subtle',min:4.5,use:'info toast'},
 {fg:'--tm-color-tooltip-text',bg:'--tm-color-tooltip-bg',min:4.5,use:'tooltip'},
 ...statuses.map(s=>({fg:`--tm-status-${s}-fg`,bg:`--tm-status-${s}-bg`,min:4.5,use:`${s} badge`})),
 ...['bg','surface'].map(bg=>({fg:'--tm-color-focus-ring',bg:`--tm-color-${bg}`,min:3,use:`focus ring on ${bg}`})),
 {fg:'--tm-color-border-control',bg:'--tm-color-surface',min:3,use:'field border'}
]);
