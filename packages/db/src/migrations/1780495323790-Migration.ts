import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1780495323790 implements MigrationInterface {
  name = 'Migration1780495323790';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."column_type" RENAME TO "column_type_old"`);
    await queryRunner.query(
      `CREATE TYPE "public"."column_type" AS ENUM('xsd:long', 'xsd:double', 'xsd:boolean', 'xsd:string', 'xsd:dateTime', 'gml:GeometryPropertyType', 'gml:PointPropertyType', 'gml:LineStringPropertyType', 'gml:PolygonPropertyType', 'gml:MultiPointPropertyType', 'gml:MultiLineStringPropertyType', 'gml:MultiPolygonPropertyType')`
    );
    await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "type" TYPE "public"."column_type" USING "type"::"text"::"public"."column_type"`);
    await queryRunner.query(`DROP TYPE "public"."column_type_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."column_type_old" AS ENUM('bigint', 'real', 'boolean', 'text', 'timestamp', 'geometry', 'enum')`);
    await queryRunner.query(
      `ALTER TABLE "property" ALTER COLUMN "type" TYPE "public"."column_type_old" USING "type"::"text"::"public"."column_type_old"`
    );
    await queryRunner.query(`DROP TYPE "public"."column_type"`);
    await queryRunner.query(`ALTER TYPE "public"."column_type_old" RENAME TO "column_type"`);
  }
}
