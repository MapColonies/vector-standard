import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { ColumnType, columnType } from '../types/enums';
import { EnumValue } from './enumValue';
import { Layer } from './layer';

export const PROPERTY_REPOSITORY_SYMBOL = Symbol('PropertyRepository');

@Entity('property')
export class Property {
  @PrimaryColumn({ name: 'layer_name' })
  public layerName!: string;

  @PrimaryColumn()
  public property!: string;

  @Column({
    type: 'enum',
    enum: Object.values(columnType),
    enumName: 'column_type',
  })
  public type!: ColumnType;

  @Column({ nullable: true, transformer: { from: (v: string | null) => v ?? undefined, to: (v: string | undefined) => v } })
  public alias?: string;

  @OneToMany(() => EnumValue, (enumValue) => enumValue.propertyRelation)
  public possibleValues?: EnumValue[];

  @ManyToOne(() => Layer, (layer) => layer.properties)
  @JoinColumn({ name: 'layer_name', referencedColumnName: 'layerName' })
  public layerRelation!: Layer;
}
