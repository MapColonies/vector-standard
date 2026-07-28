import { describe, it, expect } from 'vitest';
import { parseLuaLayers } from '@src/sync/luaParser';

const ID_FIELD = 'layer_id';
const NAME_FIELD = 'layer_name';
const ALIAS_FIELD = 'layer_alias';

const makeLua = (variableName: string, entries: string): string => `local ${variableName} = {\n${entries}\n}`;

const makeEntry = (layerId: string, layerName: string, alias: string): string =>
  `  { ${ID_FIELD} = '${layerId}', ${NAME_FIELD} = '${layerName}', ${ALIAS_FIELD} = '${alias}' },`;

describe('parseLuaLayers', function () {
  describe('Happy Path', function () {
    it('should parse a single layer entry correctly', function () {
      const content = makeLua('layers', makeEntry('42', 'buildings', 'Buildings'));

      const result = parseLuaLayers(content, 'layers', ID_FIELD, NAME_FIELD, ALIAS_FIELD);

      expect(result.size).toBe(1);
      expect(result.get('buildings')).toEqual({ layerId: 42, layerName: 'buildings', alias: 'Buildings' });
    });

    it('should parse multiple layer entries and key by layerName', function () {
      const content = makeLua('layers', [makeEntry('1', 'buildings', 'Buildings'), makeEntry('2', 'roads', 'Roads')].join('\n'));

      const result = parseLuaLayers(content, 'layers', ID_FIELD, NAME_FIELD, ALIAS_FIELD);

      expect(result.size).toBe(2);
      expect(result.get('buildings')?.layerId).toBe(1);
      expect(result.get('roads')?.layerId).toBe(2);
    });

    it('should only parse the variable matching the given name', function () {
      const content = [makeLua('other', makeEntry('99', 'ignore_me', 'ignored')), makeLua('layers', makeEntry('1', 'buildings', 'Buildings'))].join(
        '\n'
      );

      const result = parseLuaLayers(content, 'layers', ID_FIELD, NAME_FIELD, ALIAS_FIELD);

      expect(result.size).toBe(1);
      expect(result.has('ignore_me')).toBe(false);
      expect(result.has('buildings')).toBe(true);
    });

    it('should parse layer_id as an integer', function () {
      const content = makeLua('layers', makeEntry('007', 'buildings', 'Buildings'));

      const result = parseLuaLayers(content, 'layers', ID_FIELD, NAME_FIELD, ALIAS_FIELD);

      expect(result.get('buildings')?.layerId).toBe(7);
    });

    it('should handle surrounding lua content outside the block', function () {
      const content = `
-- some comment
local config = { version = '1' }
${makeLua('layers', makeEntry('5', 'parks', 'Parks'))}
local other = 'value'
    `;

      const result = parseLuaLayers(content, 'layers', ID_FIELD, NAME_FIELD, ALIAS_FIELD);

      expect(result.size).toBe(1);
      expect(result.get('parks')?.alias).toBe('Parks');
    });
  });

  describe('Sad Path', function () {
    it('should return an empty map when the block is empty', function () {
      const result = parseLuaLayers(makeLua('layers', ''), 'layers', ID_FIELD, NAME_FIELD, ALIAS_FIELD);

      expect(result.size).toBe(0);
    });
  });

  describe('Bad Path', function () {
    it('should return an empty map when the variable is not found', function () {
      const result = parseLuaLayers('local other = {}', 'layers', ID_FIELD, NAME_FIELD, ALIAS_FIELD);

      expect(result.size).toBe(0);
    });
  });
});
