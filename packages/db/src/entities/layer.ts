import { Check, Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Layer as ILayer } from '../types/layer';
import { LayerSource, layerSource } from '../types/enums';
import { Property } from './property';

export const LAYER_REPOSITORY_SYMBOL = Symbol('LayerRepository');

export const LAYER_SOURCE_CHECK = 'CHK_layer_source_layer_id';

@Entity('layer')
@Check(
  LAYER_SOURCE_CHECK,
  `("source" = '${layerSource.sharedLua}' AND "layer_id" IS NOT NULL) OR ("source" = '${layerSource.perLayerJson}' AND "layer_id" IS NULL)`
)
export class Layer implements ILayer {
  @PrimaryColumn()
  public namespace!: string;

  @PrimaryColumn({ name: 'layer_name' })
  public layerName!: string;

  @Column({ name: 'layer_id', type: 'integer', nullable: true })
  public layerId!: number | null;

  @Column({ type: 'enum', enum: Object.values(layerSource), enumName: 'layer_source' })
  public source!: LayerSource;

  @Column()
  public alias!: string;

  @OneToMany(() => Property, (property) => property.layerRelation)
  public properties!: Property[];
}
