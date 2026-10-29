import React from 'react';
type Props=Record<string,any>;
export function View({children,...props}:Props){return <div {...props}>{children}</div>;}
export function Text({children,selectable:_,...props}:Props){return <span {...props}>{children}</span>;}
export function Button({children,ariaLabel,...props}:Props){return <button type="button" {...(ariaLabel?{'aria-label':ariaLabel}:{})} {...props}>{children}</button>;}
export function Image({src,mode,className,...props}:Props){return <img src={src} alt="" className={className} style={{objectFit:mode==='aspectFit'?'contain':'cover'}} {...props}/>;}
export function Video({objectFit,...props}:Props){return <video {...props} style={{objectFit:objectFit??'contain'}}/>;}
export function Switch({checked,onChange,color:_,...props}:Props){return <input type="checkbox" aria-label="确认规则" checked={checked} onChange={e=>onChange?.({detail:{value:e.target.checked}})} {...props}/>;}
export function Textarea({onInput,maxlength,...props}:Props){return <textarea {...props} maxLength={maxlength} onChange={e=>onInput?.({detail:{value:e.target.value}})}/>;}
export function Input({onInput,maxlength,...props}:Props){return <input {...props} maxLength={maxlength} onChange={e=>onInput?.({detail:{value:e.target.value}})}/>;}
export function Picker({children,range,onChange,...props}:Props){return <label>{children}<select aria-label="选择" {...props} onChange={e=>onChange?.({detail:{value:e.target.value}})}>{range?.map((v:string,i:number)=><option key={i} value={i}>{v}</option>)}</select></label>;}
