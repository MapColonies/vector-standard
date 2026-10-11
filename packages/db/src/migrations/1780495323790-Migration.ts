import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1780495323790 implements MigrationInterface {
  name = 'Migration1780495323790';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "standard"."column_type" RENAME TO "column_type_old"`);
    await queryRunner.query(
      `CREATE TYPE "standard"."column_type" AS ENUM('xsd:long', 'xsd:double', 'xsd:boolean', 'xsd:string', 'xsd:dateTime', 'gml:GeometryPropertyType', 'gml:PointPropertyType', 'gml:LineStringPropertyType', 'gml:PolygonPropertyType', 'gml:MultiPointPropertyType', 'gml:MultiLineStringPropertyType', 'gml:MultiPolygonPropertyType')`
    );
    await queryRunner.query(
      `ALTER TABLE "standard"."property" ALTER COLUMN "type" TYPE "standard"."column_type" USING "type"::"text"::"standard"."column_type"`
    );
    await queryRunner.query(`DROP TYPE "standard"."column_type_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "standard"."column_type_old" AS ENUM('bigint', 'real', 'boolean', 'text', 'timestamp', 'geometry', 'enum')`);
    await queryRunner.query(
      `ALTER TABLE "standard"."property" ALTER COLUMN "type" TYPE "standard"."column_type_old" USING "type"::"text"::"standard"."column_type_old"`
    );
    await queryRunner.query(`DROP TYPE "standard"."column_type"`);
    await queryRunner.query(`ALTER TYPE "standard"."column_type_old" RENAME TO "column_type"`);
  }
}
