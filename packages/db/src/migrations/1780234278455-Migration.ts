import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1780234278455 implements MigrationInterface {
  name = 'Migration1780234278455';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "layer" ("layer_name" character varying NOT NULL, "alias" character varying NOT NULL, CONSTRAINT "PK_ee22a436b5250ea132444cd9baa" PRIMARY KEY ("layer_name"))`
    );
    await queryRunner.query(`ALTER TABLE "property" ADD "alias" character varying`);
    await queryRunner.query(
      `ALTER TABLE "property" ADD CONSTRAINT "FK_34ce6cedb279510bb20da63cf21" FOREIGN KEY ("layer_name") REFERENCES "layer"("layer_name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "property" DROP CONSTRAINT "FK_34ce6cedb279510bb20da63cf21"`);
    await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "alias"`);
    await queryRunner.query(`DROP TABLE "layer"`);
  }
}
