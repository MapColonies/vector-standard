import ajvCtor from 'ajv';
import { ALL_KEYS_SELECTOR } from '@common/constants';
import { AliasesFileError } from './errors';

type AliasesFile = Record<string, Record<string, Record<string, string>>>;

const ajv = new ajvCtor();

const isAliasesFile = ajv.compile<AliasesFile>({
  type: 'object',
  additionalProperties: {
    type: 'object',
    additionalProperties: { type: 'object', additionalProperties: { type: 'string' } },
  },
});

export type FileAliases = Map<string, Map<string, Map<string, string>>>;

export const parseAliases = (raw: unknown, source: string): FileAliases => {
  if (!isAliasesFile(raw)) {
    throw new AliasesFileError(source, ajv.errorsText(isAliasesFile.errors));
  }

  return new Map(
    Object.entries(raw).map(([namespace, layers]) => [
      namespace,
      new Map(Object.entries(layers).map(([layer, props]) => [layer, new Map(Object.entries(props))])),
    ])
  );
};

export const resolveFileAliases = (fileAliases: FileAliases, namespace: string, layerName: string): Map<string, string> => {
  const tiers = [
    fileAliases.get(ALL_KEYS_SELECTOR)?.get(ALL_KEYS_SELECTOR),
    fileAliases.get(ALL_KEYS_SELECTOR)?.get(layerName),
    fileAliases.get(namespace)?.get(ALL_KEYS_SELECTOR),
    fileAliases.get(namespace)?.get(layerName),
  ];
  return new Map(tiers.filter((tier): tier is Map<string, string> => tier !== undefined).flatMap((tier) => [...tier]));
};
