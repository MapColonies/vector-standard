import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1780395142415 implements MigrationInterface {
  name = 'Migration1780395142415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "standard"."layer" ADD "layerId" integer NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "standard"."layer" DROP COLUMN "layerId"`);
  }
}
