import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * 初始建表迁移（与实体保持一致，含唯一约束与索引）。
 * 注：开发/部署默认采用 synchronize 自动建表；生产环境可改为 migrationsRun
 * 并移除 synchronize。本迁移作为生产迁移的基准。
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'username', type: 'varchar', length: '64', isUnique: true },
          { name: 'password_hash', type: 'varchar' },
          { name: 'display_name', type: 'varchar', length: '128', default: "''" },
          { name: 'role', type: 'varchar', length: '16', default: "'warehouse'" },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'products',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'sku_code', type: 'varchar', length: '64', isUnique: true },
          { name: 'sku_name', type: 'varchar', length: '255', default: "''" },
          { name: 'is_gift', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'upload_batches',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'source', type: 'varchar', length: '16' },
          { name: 'file_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'content_hash', type: 'varchar', length: '64' },
          { name: 'uploader_id', type: 'bigint', isNullable: true },
          { name: 'batch_name', type: 'varchar', length: '128', isNullable: true },
          { name: 'row_count', type: 'int', default: 0 },
          { name: 'rows_valid', type: 'int', default: 0 },
          { name: 'rows_invalid', type: 'int', default: 0 },
          { name: 'status', type: 'varchar', length: '16', default: "'pending'" },
          { name: 'error_summary', type: 'jsonb', isNullable: true },
          { name: 'imported_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'upload_batches',
      new TableIndex({ name: 'uq_batch_idempotent', columnNames: ['source', 'content_hash'], isUnique: true }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'eop_inventory',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'batch_id', type: 'bigint' },
          { name: 'sku_code', type: 'varchar', length: '64' },
          { name: 'warehouse', type: 'varchar', length: '16' },
          { name: 'stock_qty', type: 'numeric', precision: 18, scale: 3, default: 0 },
          { name: 'actual_qty', type: 'numeric', precision: 18, scale: 3, default: 0 },
          { name: 'return_qty', type: 'numeric', precision: 18, scale: 3, default: 0 },
          { name: 'snapshot_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'eop_inventory',
      new TableIndex({ name: 'idx_eop_batch_sku', columnNames: ['batch_id', 'sku_code', 'warehouse'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'wms_inventory',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'batch_id', type: 'bigint' },
          { name: 'sku_code', type: 'varchar', length: '64' },
          { name: 'warehouse', type: 'varchar', length: '16' },
          { name: 'stock_qty', type: 'numeric', precision: 18, scale: 3, default: 0 },
          { name: 'available_qty', type: 'numeric', precision: 18, scale: 3, default: 0 },
          { name: 'unsorted_qty', type: 'numeric', precision: 18, scale: 3, default: 0 },
          { name: 'snapshot_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'wms_inventory',
      new TableIndex({ name: 'idx_wms_batch_sku', columnNames: ['batch_id', 'sku_code', 'warehouse'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'wms_unsorted_order',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'batch_id', type: 'bigint' },
          { name: 'warehouse', type: 'varchar', length: '16' },
          { name: 'order_no', type: 'varchar', length: '64', isNullable: true },
          { name: 'order_type', type: 'varchar', length: '16', isNullable: true },
          { name: 'carrier_code', type: 'varchar', length: '64', isNullable: true },
          { name: 'express_no', type: 'varchar', length: '64', isNullable: true },
          { name: 'wave_no', type: 'varchar', length: '64', isNullable: true },
          { name: 'sku_code', type: 'varchar', length: '64' },
          { name: 'sku_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'qty', type: 'numeric', precision: 18, scale: 3, default: 0 },
          { name: 'recipient', type: 'text', isNullable: true },
          { name: 'province', type: 'varchar', length: '64', isNullable: true },
          { name: 'city', type: 'varchar', length: '64', isNullable: true },
          { name: 'district', type: 'varchar', length: '64', isNullable: true },
          { name: 'address', type: 'text', isNullable: true },
          { name: 'id_card', type: 'text', isNullable: true },
          { name: 'fail_reason', type: 'text', isNullable: true },
          { name: 'created_at', type: 'varchar', length: '32', isNullable: true },
          { name: 'imported_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'wms_unsorted_order',
      new TableIndex({ name: 'idx_unsorted_batch_sku', columnNames: ['batch_id', 'sku_code'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'gift_skus',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'sku_code', type: 'varchar', length: '64' },
          { name: 'effective_date', type: 'date', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'gift_skus',
      new TableIndex({ name: 'uq_gift_sku', columnNames: ['sku_code'], isUnique: true }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'inventory_reconcile',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'eop_batch_id', type: 'bigint', isNullable: true },
          { name: 'wms_batch_id', type: 'bigint', isNullable: true },
          { name: 'sku_code', type: 'varchar', length: '64' },
          { name: 'warehouse', type: 'varchar', length: '16' },
          { name: 'is_gift', type: 'boolean', default: false },
          { name: 'eop_stock', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'eop_actual', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'eop_return', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'wms_total', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'wms_available', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'wms_unsorted', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'diff_value', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'diff_value_actual', type: 'numeric', precision: 18, scale: 3, isNullable: true },
          { name: 'diff_rate', type: 'numeric', precision: 9, scale: 4, isNullable: true },
          { name: 'diff_type', type: 'varchar', length: '16', default: "'none'" },
          { name: 'possible_cause', type: 'varchar', length: '64', isNullable: true },
          { name: 'status', type: 'varchar', length: '16', default: "'match'" },
          { name: 'reconciled_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'inventory_reconcile',
      new TableIndex({
        name: 'uq_reconcile',
        columnNames: ['sku_code', 'warehouse', 'eop_batch_id', 'wms_batch_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'diff_handling',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'reconcile_id', type: 'bigint' },
          { name: 'status', type: 'varchar', length: '16', default: "'pending'" },
          { name: 'cause', type: 'varchar', length: '16', default: "'unset'" },
          { name: 'note', type: 'text', isNullable: true },
          { name: 'operator_id', type: 'bigint', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'diff_handling',
      new TableIndex({ name: 'idx_diff_handling_reconcile', columnNames: ['reconcile_id'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'operation_logs',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'user_id', type: 'bigint', isNullable: true },
          { name: 'action', type: 'varchar', length: '64' },
          { name: 'target', type: 'varchar', length: '128', isNullable: true },
          { name: 'detail', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'operation_logs',
      new TableIndex({ name: 'idx_op_log_user', columnNames: ['user_id', 'created_at'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'alert_configs',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'key', type: 'varchar', length: '64' },
          { name: 'value', type: 'varchar', length: '64', isNullable: true },
          { name: 'scope', type: 'varchar', length: '32', default: "'global'" },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'alert_configs',
      new TableIndex({ name: 'uq_alert_key', columnNames: ['key', 'scope'], isUnique: true }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'user_id', type: 'bigint', isNullable: true },
          { name: 'type', type: 'varchar', length: '32' },
          { name: 'title', type: 'varchar', length: '128' },
          { name: 'message', type: 'text' },
          { name: 'related_id', type: 'bigint', isNullable: true },
          { name: 'is_read', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'notifications',
      'alert_configs',
      'operation_logs',
      'diff_handling',
      'inventory_reconcile',
      'gift_skus',
      'wms_inventory',
      'eop_inventory',
      'upload_batches',
      'products',
      'users',
    ];
    for (const t of tables) {
      await queryRunner.dropTable(t, true);
    }
  }
}
