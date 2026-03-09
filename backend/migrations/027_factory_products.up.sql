-- factory_products: many-to-many ระหว่าง factory กับ product
-- ใช้กำหนดว่าแต่ละโรงงานผลิตสินค้าอะไรได้บ้าง
CREATE TABLE IF NOT EXISTS factory_products (
    factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (factory_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_products_factory ON factory_products(factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_products_product ON factory_products(product_id);
CREATE INDEX IF NOT EXISTS idx_factory_products_tenant  ON factory_products(tenant_id);
