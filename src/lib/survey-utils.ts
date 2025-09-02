import _ from 'lodash';

export const normalizeHeight = (input: string) => {
  let height: string | null = input.trim();
  let height_inches_total: number | null = null;

  if (height.toLowerCase() === 'skip' || height.toLowerCase() === 'none' || height.toLowerCase() === 'not sure' || height === '') {
    return { height: null, height_inches_total: null };
  }

  // Try to parse ft/in
  const ftInMatch = height.match(/(\d+)\s*(?:ft|feet|')\s*(\d*)\s*(?:in|inch|")?/i);  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1], 10);
    const inches = ftInMatch[2] ? parseInt(ftInMatch[2], 10) : 0;
    height_inches_total = (feet * 12) + inches;
    height = `${feet}'${inches}"`; // Standardize format
  } else {
    // Try to parse cm
    const cmMatch = height.match(/(\d+(\.\d+)?)\s*cm/i);
    if (cmMatch) {
      const cm = parseFloat(cmMatch[1]);
      height = `${cm} cm`; // Standardize format
    }
  }
  return { height, height_inches_total };
};

export const normalizeWeight = (input: string) => {
  let weight_pounds: number | null = null;
  const lowerInput = input.toLowerCase();

  if (lowerInput === 'skip' || lowerInput === 'none' || lowerInput === 'not sure' || lowerInput === '') {
    return null;
  }

  const kgMatch = lowerInput.match(/(\d+(\.\d+)?)\s*kg/);
  if (kgMatch) {
    const kg = parseFloat(kgMatch[1]);
    weight_pounds = Math.round(kg * 2.20462); // Convert kg to pounds, round to nearest integer
  } else {
    const lbMatch = lowerInput.match(/(\d+(\.\d+)?)\s*(?:lb|lbs|pounds)?/);
    if (lbMatch) {
      weight_pounds = Math.round(parseFloat(lbMatch[1]));
    }}
  return weight_pounds;
};

export const normalizeList = (input: string): string[] => {
  if (input.toLowerCase() === 'skip' || input.toLowerCase() === 'none' || input.toLowerCase() === 'not sure' || input === '') {
    return [];
  }
  return input
    .split(/[,/\n]/) // Split by commas, slashes, or line breaks
    .map(item => item.trim()) // Trim whitespace
    .filter(item => item !== '') // Remove empty strings
    .filter((item, index, self) => self.indexOf(item) === index); // De-duplicate
};

export const normalizeEnumMulti = (input: string, enumList: string[], otherLabel: string = 'Other', noneLabel: string = 'None'): { label: string; other_note: string | null }[] | string[] => {
  const normalizedItems = normalizeList(input);

  if (normalizedItems.length === 1 && normalizedItems[0].toLowerCase() === noneLabel.toLowerCase()) {
    return [{ label: noneLabel, other_note: null }]; // Special handling for "None"
  }

  const result: { label: string; other_note: string | null }[] = [];
  const otherNotes: string[] = [];

  normalizedItems.forEach(item => {
    const matchedEnum = enumList.find(e => e.toLowerCase() === item.toLowerCase());
    if (matchedEnum) {
      result.push({ label: matchedEnum, other_note: null });
    } else if (item.toLowerCase() === otherLabel.toLowerCase()) {
      // Only add 'Other' if it's explicitly mentioned or if there are unmatched items
      if (!result.some(r => r.label === otherLabel)) {
        result.push({ label: otherLabel, other_note: null });
      }
    } else {
      // If user provides an item not in enum and not 'Other', treat it as an 'Other' note
      otherNotes.push(item);
    }
  });

  // If there are unmatched items, and 'Other' was selected, add them to the first 'Other' item's note
  if (otherNotes.length > 0) {
    let otherItem = result.find(item => item.label === otherLabel);
    if (!otherItem) {
      otherItem = { label: otherLabel, other_note: null };
      result.push(otherItem);
    }
    otherItem.other_note = otherItem.other_note ? `${otherItem.other_note}, ${otherNotes.join(', ')}` : otherNotes.join(', ');
  }

  // De-duplicate labels in the result, merging other_notes if multiple 'Other' entries
  const uniqueResult: { label: string; other_note: string | null }[] = [];
  const seenLabels = new Set<string>();
  result.forEach(item => {
    if (!seenLabels.has(item.label)) {
      uniqueResult.push(item);
      seenLabels.add(item.label);
    } else if (item.label === otherLabel && item.other_note) {      const existingOther = uniqueResult.find(u => u.label === otherLabel);
      if (existingOther && item.other_note) {
        existingOther.other_note = existingOther.other_note ? `${existingOther.other_note}, ${item.other_note}` : item.other_note;
      }
    }
  });

  return uniqueResult;
};

export const normalizeCamFields = (input: string, enumList: string[]): string[] => {
  const normalized = normalizeList(input);
  const camOptions = enumList.filter(e => e !== 'All'); // Exclude 'All' from actual options

  if (normalized.some(item => item.toLowerCase() === 'all')) {
    return camOptions.map(item => {
      if (item.toLowerCase() === 'tcm') return 'Traditional Chinese Medicine';
      if (item.toLowerCase() === 'hanbang' || item.toLowerCase() === 'korean medicine') return 'Hanyak';
      return item;
    });
  }

  const result: string[] = [];
  normalized.forEach(item => {
    let processedItem = item;
    if (item.toLowerCase() === 'tcm') processedItem = 'Traditional Chinese Medicine';
    if (item.toLowerCase() === 'hanbang' || item.toLowerCase() === 'korean medicine') processedItem = 'Hanyak';

    if (camOptions.some(e => e.toLowerCase() === processedItem.toLowerCase())) {
      result.push(camOptions.find(e => e.toLowerCase() === processedItem.toLowerCase()) || processedItem);
    }
  });
  return [...new Set(result)]; // De-duplicate
};

export const normalizeWearables = (input: string, enumList: string[]): string[] => {
  const normalized = normalizeList(input);
  if (normalized.some(item => item.toLowerCase() === 'none')) {    return ['None'];
  }
  const result: string[] = [];
  normalized.forEach(item => {
    const matchedEnum = enumList.find(e => e.toLowerCase() === item.toLowerCase());    if (matchedEnum && matchedEnum !== 'None') {
      result.push(matchedEnum);
    }
  });
  return [...new Set(result)];
};

export const getNestedValue = (obj: any, path: string) => {
  return _.get(obj, path);
};

export const setNestedValue = (obj: any, path: string, value: any) => {
  return _.set(obj, path, value);
};
