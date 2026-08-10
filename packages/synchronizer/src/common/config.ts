import { type ConfigInstance, config } from '@map-colonies/config';
import { vectorVectorStandardSynchronizerV3, type vectorVectorStandardSynchronizerV3Type } from '@map-colonies/schemas';

// Choose here the type of the config instance and import this type from the entire application
type ConfigType = ConfigInstance<vectorVectorStandardSynchronizerV3Type>;

let configInstance: ConfigType | undefined;

/**
 * Initializes the configuration by fetching it from the server.
 * This should only be called from the instrumentation file.
 * @returns A Promise that resolves when the configuration is successfully initialized.
 */
async function initConfig(offlineMode?: boolean): Promise<void> {
  configInstance = await config({
    schema: vectorVectorStandardSynchronizerV3,
    offlineMode,
  });
}

function getConfig(): ConfigType {
  if (!configInstance) {
    throw new Error('config not initialized');
  }
  return configInstance;
}

export { getConfig, initConfig, ConfigType };
