const fs = require('fs');
let src = fs.readFileSync('background.ts', 'utf8');

// Remove interface blocks
src = src.replace(/^interface\s+\w+\s*\{[^}]*\}/gm, '');

// Remove type annotations on variables/params: ": Type"
// This handles : string, : number, : any, : void, : boolean, : chrome.xxx.Yyy, TabInfo, etc.
src = src.replace(/:\s*(chrome\.\w+(\.\w+)*(\[\])?\s*(\|\s*(null|undefined|chrome\.\w+(\.\w+)*))*|TabInfo(\[\])?|ConsoleMessage(\[\])?|ToolRequest|ToolResponse|string|number|boolean|any|unknown|void|null|undefined|Set<number>|ConsoleMessage\[\]|Record<string,\s*unknown>)/g, '');

// Remove "as Type" casts
src = src.replace(/\s+as\s+(chrome\.\w+(\.\w+)*(\[\])?|any|number|string|TabInfo|Record<string,\s*unknown>|Record<string,\s*any>)/g, '');

// Remove generic type parameters like <number>, <void>, <string>, but not JSX
src = src.replace(/new Set<number>/g, 'new Set');
src = src.replace(/<ConsoleMessage>/g, '');
src = src.replace(/Promise<void>/g, 'Promise');
src = src.replace(/Promise<ToolResponse>/g, 'Promise');

// Remove remaining "export" if any
// src = src.replace(/^export\s+/gm, '');

fs.writeFileSync('background.js', src, 'utf8');
console.log('Done! background.js written.');
