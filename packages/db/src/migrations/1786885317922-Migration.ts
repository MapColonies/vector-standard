import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1786885317922 implements MigrationInterface {
  name = 'Migration1786885317922';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "enum_value" DROP CONSTRAINT "FK_8548a0384cc733008852a8f4e70"`);
    await queryRunner.query(`ALTER TABLE "property" DROP CONSTRAINT "FK_34ce6cedb279510bb20da63cf21"`);
    await queryRunner.query(`ALTER TABLE "enum_value" ADD "namespace" character varying NOT NULL`);
    await queryRunner.query(`ALTER TABLE "enum_value" DROP CONSTRAINT "PK_08cf35141adc487a902990ccff2"`);
    await queryRunner.query(
      `ALTER TABLE "enum_value" ADD CONSTRAINT "PK_0607639cc6d4c22cad2fa8552e9" PRIMARY KEY ("value", "layer_name", "property", "namespace")`
    );
    await queryRunner.query(`ALTER TABLE "layer" ADD "namespace" character varying NOT NULL`);
    await queryRunner.query(`ALTER TABLE "layer" DROP CONSTRAINT "PK_ee22a436b5250ea132444cd9baa"`);
    await queryRunner.query(`ALTER TABLE "layer" ADD CONSTRAINT "PK_0080403b718d78e8dc9590e56ad" PRIMARY KEY ("layer_name", "namespace")`);
    await queryRunner.query(`CREATE TYPE "public"."layer_source" AS ENUM('sharedLua', 'perLayerJson')`);
    await queryRunner.query(`ALTER TABLE "layer" ADD "source" "public"."layer_source" NOT NULL`);
    await queryRunner.query(`ALTER TABLE "property" ADD "namespace" character varying NOT NULL`);
    await queryRunner.query(`ALTER TABLE "property" DROP CONSTRAINT "PK_c92abce6639221fa0e46b3d1380"`);
    await queryRunner.query(
      `ALTER TABLE "property" ADD CONSTRAINT "PK_f92b1edaa8f549c489fc2de4a05" PRIMARY KEY ("layer_name", "property", "namespace")`
    );
    await queryRunner.query(`ALTER TABLE "layer" ALTER COLUMN "layer_id" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "layer" ADD CONSTRAINT "CHK_layer_source_layer_id" CHECK (("source" = 'sharedLua' AND "layer_id" IS NOT NULL) OR ("source" = 'perLayerJson' AND "layer_id" IS NULL))`
    );
    await queryRunner.query(
      `ALTER TABLE "enum_value" ADD CONSTRAINT "FK_10b4583c2705fa3454d63f05534" FOREIGN KEY ("namespace", "layer_name", "property") REFERENCES "property"("namespace","layer_name","property") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "property" ADD CONSTRAINT "FK_d4a43c70a881756a56e51b86b84" FOREIGN KEY ("namespace", "layer_name") REFERENCES "layer"("namespace","layer_name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "property" DROP CONSTRAINT "FK_d4a43c70a881756a56e51b86b84"`);
    await queryRunner.query(`ALTER TABLE "enum_value" DROP CONSTRAINT "FK_10b4583c2705fa3454d63f05534"`);
    await queryRunner.query(`ALTER TABLE "layer" DROP CONSTRAINT "CHK_layer_source_layer_id"`);
    await queryRunner.query(`ALTER TABLE "layer" ALTER COLUMN "layer_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "property" DROP CONSTRAINT "PK_f92b1edaa8f549c489fc2de4a05"`);
    await queryRunner.query(`ALTER TABLE "property" ADD CONSTRAINT "PK_c92abce6639221fa0e46b3d1380" PRIMARY KEY ("layer_name", "property")`);
    await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "namespace"`);
    await queryRunner.query(`ALTER TABLE "layer" DROP COLUMN "source"`);
    await queryRunner.query(`DROP TYPE "public"."layer_source"`);
    await queryRunner.query(`ALTER TABLE "layer" DROP CONSTRAINT "PK_0080403b718d78e8dc9590e56ad"`);
    await queryRunner.query(`ALTER TABLE "layer" ADD CONSTRAINT "PK_ee22a436b5250ea132444cd9baa" PRIMARY KEY ("layer_name")`);
    await queryRunner.query(`ALTER TABLE "layer" DROP COLUMN "namespace"`);
    await queryRunner.query(`ALTER TABLE "enum_value" DROP CONSTRAINT "PK_0607639cc6d4c22cad2fa8552e9"`);
    await queryRunner.query(
      `ALTER TABLE "enum_value" ADD CONSTRAINT "PK_08cf35141adc487a902990ccff2" PRIMARY KEY ("value", "layer_name", "property")`
    );
    await queryRunner.query(`ALTER TABLE "enum_value" DROP COLUMN "namespace"`);
    await queryRunner.query(
      `ALTER TABLE "property" ADD CONSTRAINT "FK_34ce6cedb279510bb20da63cf21" FOREIGN KEY ("layer_name") REFERENCES "layer"("layer_name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "enum_value" ADD CONSTRAINT "FK_8548a0384cc733008852a8f4e70" FOREIGN KEY ("layer_name", "property") REFERENCES "property"("layer_name","property") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }
}
