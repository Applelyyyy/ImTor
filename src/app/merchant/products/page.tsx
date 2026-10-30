import { merchantStore, NoStore } from "@/components/merchant";
import { MerchantProductManager } from "@/components/merchant-product-manager";
import { categories } from "@/lib/queries";
import { db } from "@/lib/db";
import { PricingService } from "@/services/pricing";

export default async function MerchantProducts() {
  // Authorization precedes all product/private discount queries.
  const store = await merchantStore();
  if (!store) return <NoStore />;
  const [cats, globalRules] = await Promise.all([categories(), db.discountRule.findMany({where:{productId:null}})]);
  const now = new Date();
  return <MerchantProductManager storeId={store.id} categories={cats.map(({id,name})=>({id,name}))} products={store.products.map((p) => ({
    id:p.id,name:p.name,imageUrl:p.imageUrl,price:p.price,categoryId:p.categoryId,description:p.description,
    mode:p.mode,reservable:p.reservable,stock:p.stock,published:p.published,archived:p.archived,
    pickupStart:p.pickupStart?.toISOString()??null,pickupEnd:p.pickupEnd?.toISOString()??null,allergens:p.allergens,storage:p.storage,
    currentPrice:PricingService.calculate(p.price,p.mode === "REGULAR"?[]:[...p.discounts,...globalRules],now).current,
    discounts:p.discounts.map(({id,kind,value,startsAt,endsAt})=>({id,kind,value,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()})),demo:!!p.demoBatchId,
  }))} />;
}
