import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1779102013028 implements MigrationInterface {
  name = 'Migration1779102013028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "standard"."enum_value" ("value" character varying NOT NULL, "layer_name" character varying NOT NULL, "property" character varying NOT NULL, CONSTRAINT "PK_08cf35141adc487a902990ccff2" PRIMARY KEY ("value", "layer_name", "property"))`
    );
    await queryRunner.query(`CREATE TYPE "standard"."column_type" AS ENUM('bigint', 'real', 'boolean', 'text', 'timestamp', 'geometry', 'enum')`);
    await queryRunner.query(
      `CREATE TABLE "standard"."property" ("layer_name" character varying NOT NULL, "property" character varying NOT NULL, "type" "standard"."column_type" NOT NULL, CONSTRAINT "PK_c92abce6639221fa0e46b3d1380" PRIMARY KEY ("layer_name", "property"))`
    );
    await queryRunner.query(
      `ALTER TABLE "standard"."enum_value" ADD CONSTRAINT "FK_8548a0384cc733008852a8f4e70" FOREIGN KEY ("layer_name", "property") REFERENCES "standard"."property"("layer_name","property") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "standard"."enum_value" DROP CONSTRAINT "FK_8548a0384cc733008852a8f4e70"`);
    await queryRunner.query(`DROP TABLE "standard"."property"`);
    await queryRunner.query(`DROP TYPE "standard"."column_type"`);
    await queryRunner.query(`DROP TABLE "standard"."enum_value"`);
  }
}
