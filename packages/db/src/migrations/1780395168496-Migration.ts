import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1780395168496 implements MigrationInterface {
  name = 'Migration1780395168496';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "layer" RENAME COLUMN "layerId" TO "layer_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "layer" RENAME COLUMN "layer_id" TO "layerId"`);
  }
}
