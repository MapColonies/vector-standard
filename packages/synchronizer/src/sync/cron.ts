import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import { schedule, type ScheduledTask } from 'node-cron';
import { context as contextAPI } from '@opentelemetry/api';
import { SERVICES } from '@common/constants';
import { ConfigType } from '@common/config';
import { startActivePromisifiedSpan } from '@common/tracing/util';
import { SyncAttributes, SyncSpanName } from '@common/tracing/sync';
import { SyncModel } from './SyncModel';
import { FileReader } from './fileReader';

export const CRON_MANAGER_SYMBOL = Symbol('cronManagerSymbol');

@injectable()
export class CronManager {
  private task: ScheduledTask | undefined;
  private isRunning = false;
  private lastLayersChecksum: string | undefined;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SyncModel) private readonly dal: SyncModel,
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    private readonly fileReader: FileReader
  ) {}

  public async tick(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('previous sync tick still running, skipping');
      return;
    }
    this.isRunning = true;
    try {
      await startActivePromisifiedSpan(SyncSpanName.SYNC_TICK, {}, contextAPI.active(), async (span) => {
        const { checksum, layers } = await this.fileReader.readLayersWithChecksum(this.config.get('layersFile'));
        const layersChanged = checksum !== this.lastLayersChecksum;
        span.setAttribute(SyncAttributes.LAYERS_COUNT, layers.length);
        span.setAttribute(SyncAttributes.LAYERS_CHANGED, layersChanged);

        const luaLayersMap = await this.dal.luaFileData();
        for (const layer of layers) {
          const luaLayer = luaLayersMap.get(layer.layerName);
          if (luaLayer === undefined) {
            this.logger.warn({ layerName: layer.layerName }, 'Layer not found in lua file, skipping');
            continue;
          }
          await this.dal.syncLayer(layer.layerName, luaLayer.layerId, luaLayer.alias);
          try {
            const affected = await this.dal.syncProperties(layer, luaLayer.layerId);
            this.logger.info({ layer, affected }, 'synced properties');
          } catch (err) {
            this.logger.warn({ layerName: layer.layerName, err }, 'failed to sync properties, skipping to enum sync');
          }
          const enumsAffected = await this.dal.syncEnum(layer);
          this.logger.info({ layer, enumsAffected }, 'synced enums');
          if (layersChanged) {
            await this.dal.deleteStaleEnumValues(layer.layerName, layer.enums);
          }
        }
        if (layersChanged) {
          await this.dal.deleteLayersNotIn(layers.map((l) => l.layerName));
          this.lastLayersChecksum = checksum;
        }
      });
    } catch (err) {
      this.logger.error({ err }, 'sync tick failed, waiting for next tick');
    } finally {
      this.isRunning = false;
    }
  }

  public start(): void {
    this.task = schedule(this.config.get('schedule'), async () => {
      await this.tick();
    });
  }

  public async stop(): Promise<void> {
    await this.task?.stop();
  }
}
