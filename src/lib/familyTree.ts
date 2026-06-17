/**
 * Shared family-tree types, constants, and validation.
 *
 * The tree is stored as a single JSON document per tree (the `data` column of
 * the `family_trees` table) in exactly the shape the client renderer in
 * src/pages/main/family-tree.astro consumes. Relationships are POSITIONAL
 * inside `structure`, not foreign keys.
 *
 * Because Postgres `jsonb` does not preserve object key order, generation
 * ordering is carried by the explicit `generationOrder` array, and labels by
 * the `generationLabels` map (both edited through the admin UI).
 */

/** Lineage tags. Each has a legend colour + CSS class in the renderer. */
export const FAMILY_KEYS = ['walsh', 'flick', 'littlefield', 'litzel', 'ostrom', 'spouse'] as const;
export type FamilyKey = (typeof FAMILY_KEYS)[number];

export const FAMILY_LABELS: Record<string, string> = {
  walsh: 'Walsh',
  flick: 'Flick',
  littlefield: 'Littlefield',
  litzel: 'Litzel',
  ostrom: 'Ostrom/Åström',
  spouse: 'Spouse / Married in',
};

export interface Person {
  name: string;
  maiden?: string;
  family: string;
  dates?: string;
  info?: string;
  placeholder?: boolean;
}

/** A married couple. `partners` are two person ids; `id` is the couple's id. */
export interface CoupleBlock {
  partners: [string, string];
  id: string;
  siblings?: string[];
  siblings_note?: string;
}

/** A loose group of people (e.g. a set of children), optionally labelled. */
export interface GroupBlock {
  people: string[];
  label?: string;
}

export type Block = CoupleBlock | GroupBlock;

export interface TreeData {
  label: string;
  legendFamilies: string[];
  people: Record<string, Person>;
  structure: Record<string, Block[]>;
  generationOrder: string[];
  generationLabels: Record<string, string>;
}

export function isCoupleBlock(block: Block): block is CoupleBlock {
  return Array.isArray((block as CoupleBlock).partners);
}

export function isGroupBlock(block: Block): block is GroupBlock {
  return Array.isArray((block as GroupBlock).people);
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validate a tree document. Returns a list of human-readable error messages
 * (empty when valid). This is the server-side safety net; the editor should
 * also prevent most of these client-side.
 */
export function validateTree(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data)) return ['Tree data must be an object.'];

  if (!isStr(data.label) || !data.label.trim()) errors.push('Tree label is required.');

  // People
  const people = data.people;
  if (!isObj(people)) {
    errors.push('Tree is missing its people.');
  } else {
    for (const [id, p] of Object.entries(people)) {
      if (!isObj(p)) {
        errors.push(`Person "${id}" is malformed.`);
        continue;
      }
      if (!isStr(p.name) || !p.name.trim()) errors.push(`Person "${id}" needs a name.`);
      if (!isStr(p.family) || !FAMILY_KEYS.includes(p.family as FamilyKey)) {
        errors.push(`Person "${id}" has an invalid family line ("${String(p.family)}").`);
      }
    }
  }
  const personExists = (id: unknown): boolean => isObj(people) && isStr(id) && id in people;

  // legendFamilies
  if (!Array.isArray(data.legendFamilies) || !data.legendFamilies.every(isStr)) {
    errors.push('Legend families must be a list of family names.');
  }

  // Structure + generation order
  const structure = data.structure;
  if (!isObj(structure)) {
    errors.push('Tree is missing its structure.');
    return errors;
  }
  if (!Array.isArray(data.generationOrder) || !data.generationOrder.every(isStr)) {
    errors.push('Generation order must be a list.');
  } else {
    for (const gk of data.generationOrder) {
      if (!(gk in structure)) errors.push(`Generation "${gk}" is ordered but has no content.`);
    }
    for (const gk of Object.keys(structure)) {
      if (!data.generationOrder.includes(gk)) {
        errors.push(`Generation "${gk}" exists but is not in the display order.`);
      }
    }
  }

  for (const [gk, blocks] of Object.entries(structure)) {
    if (!Array.isArray(blocks)) {
      errors.push(`Generation "${gk}" must be a list of blocks.`);
      continue;
    }
    blocks.forEach((block, i) => {
      const where = `Generation "${gk}", block ${i + 1}`;
      if (!isObj(block)) {
        errors.push(`${where} is malformed.`);
        return;
      }
      const couple = block as Partial<CoupleBlock>;
      const group = block as Partial<GroupBlock>;
      if (Array.isArray(couple.partners)) {
        if (couple.partners.length !== 2) errors.push(`${where} (couple) must have exactly two partners.`);
        couple.partners.forEach((pid) => {
          if (!personExists(pid)) errors.push(`${where} references unknown person "${String(pid)}".`);
        });
        if (couple.siblings !== undefined) {
          if (!Array.isArray(couple.siblings)) errors.push(`${where} siblings must be a list.`);
          else
            couple.siblings.forEach((sid) => {
              if (!personExists(sid)) errors.push(`${where} sibling references unknown person "${String(sid)}".`);
            });
        }
      } else if (Array.isArray(group.people)) {
        group.people.forEach((pid) => {
          if (!personExists(pid)) errors.push(`${where} references unknown person "${String(pid)}".`);
        });
      } else {
        errors.push(`${where} must be a couple or a group.`);
      }
    });
  }

  return errors;
}

/** Slugify a name into an id stem; ensures uniqueness against existing ids. */
export function makePersonId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  const stem =
    (name || 'person')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32) || 'person';
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem}-${n}`)) n += 1;
  return `${stem}-${n}`;
}
