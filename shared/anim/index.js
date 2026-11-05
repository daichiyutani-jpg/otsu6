import { DEFS_CHEM } from './defs-chem.js';
import { DEFS_CLASS6 } from './defs-class6.js';

export const ANIMS = [...DEFS_CLASS6.filter((d) => d.subject === 'law'), ...DEFS_CHEM, ...DEFS_CLASS6.filter((d) => d.subject !== 'law')];
export const ANIM_BY_ID = new Map(ANIMS.map((a) => [a.id, a]));
