export function splitSingerText(value: string): string[];

export function consumeSingerDraft(draft: string): { chips: string[]; draft: string };

export function withCommittedDraft(singers: string[], draft: string): string[];
