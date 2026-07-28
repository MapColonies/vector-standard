const NOT_FOUND = -1;

export const extractBlock = (content: string, variableName: string): string | null => {
  const declarationMatch = new RegExp(`\\blocal\\s+${variableName}\\s*=`).exec(content);
  if (declarationMatch === null) {
    return null;
  }

  const openBrace = content.indexOf('{', declarationMatch.index + declarationMatch[0].length);
  if (openBrace === NOT_FOUND) {
    return null;
  }

  let depth = 0;
  for (let i = openBrace; i < content.length; i++) {
    if (content[i] === '{') {
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(openBrace + 1, i);
      }
    }
  }

  return null;
};

export interface LuaLayer {
  layerId: number;
  layerName: string;
  alias: string;
}

export const parseLuaLayers = (
  content: string,
  variableName: string,
  idField: string,
  nameField: string,
  aliasField: string
): Map<string, LuaLayer> => {
  const result = new Map<string, LuaLayer>();
  const block = extractBlock(content, variableName);
  if (block === null) {
    return result;
  }

  const entryRegex = /\{([^}]+)\}/g;
  let match;

  while ((match = entryRegex.exec(block)) !== null) {
    const entry = match[1];
    const fields: Record<string, string> = {};
    const fieldRegex = /(\w+)\s*=\s*'([^']*)'/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(entry)) !== null) {
      fields[fieldMatch[1]] = fieldMatch[2];
    }
    const layerId = fields[idField];
    const layerName = fields[nameField];
    const layerAlias = fields[aliasField];
    result.set(layerName, {
      layerId: parseInt(layerId, 10),
      layerName,
      alias: layerAlias,
    });
  }

  return result;
};
