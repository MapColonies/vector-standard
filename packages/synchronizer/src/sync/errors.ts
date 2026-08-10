abstract class SyncError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LayerSyncError extends SyncError {
  public constructor(layerName: string, layerId: number, cause?: unknown) {
    super(`Failed to sync layer ${layerName} (${layerId})`, { cause });
  }
}

export class TableColumnsQueryError extends SyncError {
  public constructor(schema: string, tableName: string, cause?: unknown) {
    super(`Failed to get table columns for ${schema}.${tableName}`, { cause });
  }
}

export class EnumDistinctValuesError extends SyncError {
  public constructor(layerName: string, cause?: unknown) {
    super(`Failed to get enum distinct values for ${layerName}`, { cause });
  }
}

export class PropertyUpsertError extends SyncError {
  public constructor(cause?: unknown) {
    super('Failed to upsert properties', { cause });
  }
}

export class StalePropertiesDeletionError extends SyncError {
  public constructor(layerName: string, cause?: unknown) {
    super(`Failed to delete stale properties for ${layerName}`, { cause });
  }
}

export class LayersDeletionError extends SyncError {
  public constructor(layerNames: string[], cause?: unknown) {
    super(`Failed to delete layers not in [${layerNames.join(', ')}]`, { cause });
  }
}

export class EnumIndexError extends SyncError {
  public constructor(layerName: string, cause?: unknown) {
    super(`Failed to ensure enum indexes for ${layerName}`, { cause });
  }
}

export class StaleEnumValuesDeletionError extends SyncError {
  public constructor(layerName: string, cause?: unknown) {
    super(`Failed to delete stale enum values for ${layerName}`, { cause });
  }
}

export class TypeMapError extends SyncError {
  public constructor(filePath: string, reason: string, cause?: unknown) {
    super(`Invalid type map file ${filePath}: ${reason}`, { cause });
  }
}

export class EnumSaveError extends SyncError {
  public constructor(layerName: string, cause?: unknown) {
    super(`Failed to save enum values for ${layerName}`, { cause });
  }
}
