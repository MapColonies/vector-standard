import type { Property, PropertySpec } from '@db';

export const mapProperty = ({ property, type, alias, possibleValues }: Property): PropertySpec => {
  const mapped: PropertySpec = { property, type };
  if (alias !== undefined) {
    mapped.alias = alias;
  }
  if (possibleValues && possibleValues.length > 0) {
    mapped.possibleValues = possibleValues.map(({ value }) => value);
  }
  return mapped;
};
