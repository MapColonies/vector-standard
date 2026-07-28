import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Property } from './property';

export const ENUMS_REPOSITORY_SYMBOL = Symbol('EnumsRepository');

@Entity('enum_value')
export class EnumValue {
  @PrimaryColumn()
  public value!: string;

  @PrimaryColumn({ name: 'layer_name' })
  public layerName!: string;

  @PrimaryColumn()
  public property!: string;

  @ManyToOne(() => Property, (p) => p.possibleValues, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'layer_name', referencedColumnName: 'layerName' },
    { name: 'property', referencedColumnName: 'property' },
  ])
  public propertyRelation!: Property;
}
