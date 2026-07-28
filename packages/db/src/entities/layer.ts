import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Layer as ILayer } from '../types/layer';
import { Property } from './property';

export const LAYER_REPOSITORY_SYMBOL = Symbol('LayerRepository');

@Entity('layer')
export class Layer implements ILayer {
  @PrimaryColumn({ name: 'layer_name' })
  public layerName!: string;

  @Column({ name: 'layer_id' })
  public layerId!: number;

  @Column()
  public alias!: string;

  @OneToMany(() => Property, (property) => property.layerRelation)
  public properties!: Property[];
}
