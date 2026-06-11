import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsAppCartAndMetrics1709650000000 implements MigrationInterface {
  name = 'AddWhatsAppCartAndMetrics1709650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela de carrinhos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_carts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "customer_phone" character varying(20) NOT NULL,
        "items" jsonb NOT NULL DEFAULT '[]',
        "subtotal" decimal(10,2) NOT NULL DEFAULT 0,
        "coupon_code" character varying(50),
        "discount_amount" decimal(10,2) NOT NULL DEFAULT 0,
        "shipping_amount" decimal(10,2) NOT NULL DEFAULT 0,
        "total_amount" decimal(10,2) NOT NULL DEFAULT 0,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_carts" PRIMARY KEY ("id")
      )
    `);

    // Índices para carrinhos
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_carts_tenant_phone_status"
      ON "whatsapp_carts" ("tenant_id", "customer_phone", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_carts_expires"
      ON "whatsapp_carts" ("expires_at") WHERE status = 'active'
    `);

    // Criar tabela de métricas de mensagens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_message_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "customer_phone" character varying(20) NOT NULL,
        "message_id" character varying(100) NOT NULL,
        "direction" character varying(10) NOT NULL,
        "message_type" character varying(20) NOT NULL,
        "processing_time_ms" integer NOT NULL,
        "intent" character varying(50),
        "action" character varying(50),
        "success" boolean NOT NULL DEFAULT true,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_message_metrics" PRIMARY KEY ("id")
      )
    `);

    // Índices para métricas de mensagens
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_msg_metrics_tenant_created"
      ON "whatsapp_message_metrics" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_msg_metrics_phone_created"
      ON "whatsapp_message_metrics" ("customer_phone", "created_at")
    `);

    // Criar tabela de métricas de conversas
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_conversation_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "customer_phone" character varying(20) NOT NULL,
        "started_at" TIMESTAMP NOT NULL,
        "ended_at" TIMESTAMP,
        "message_count" integer NOT NULL DEFAULT 0,
        "inbound_count" integer NOT NULL DEFAULT 0,
        "outbound_count" integer NOT NULL DEFAULT 0,
        "intent_distribution" jsonb NOT NULL DEFAULT '{}',
        "action_distribution" jsonb NOT NULL DEFAULT '{}',
        "conversion_events" jsonb NOT NULL DEFAULT '[]',
        "abandonment_point" character varying(100),
        "average_response_time_ms" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_conversation_metrics" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_conv_metrics_tenant_started"
      ON "whatsapp_conversation_metrics" ("tenant_id", "started_at")
    `);

    // Criar tabela de eventos de conversão
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_conversion_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "customer_phone" character varying(20) NOT NULL,
        "cart_id" character varying(100) NOT NULL,
        "order_id" uuid NOT NULL,
        "conversion_value" decimal(10,2) NOT NULL,
        "converted_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_conversion_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_conv_events_tenant_converted"
      ON "whatsapp_conversion_events" ("tenant_id", "converted_at")
    `);

    // Criar tabela de eventos de abandono
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_abandonment_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "customer_phone" character varying(20) NOT NULL,
        "cart_id" character varying(100) NOT NULL,
        "abandonment_point" character varying(100) NOT NULL,
        "cart_value" decimal(10,2) NOT NULL,
        "abandoned_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_abandonment_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_abandon_events_tenant_abandoned"
      ON "whatsapp_abandonment_events" ("tenant_id", "abandoned_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_abandonment_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_conversion_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_conversation_metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_message_metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_carts"`);
  }
}