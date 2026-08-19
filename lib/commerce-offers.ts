import offersData from "@/config/commerce_offers.json";
import type { CommerceActionType, CommerceOffer } from "@/lib/conversational-commerce";

const commerceOffers = offersData as CommerceOffer[];

export function listCommerceOffers() {
  return commerceOffers;
}

export function findCommerceOffer(offerId: string) {
  return commerceOffers.find((offer) => offer.id === offerId) || null;
}

export function resolveCommerceActionType(offer: CommerceOffer): CommerceActionType {
  return offer.actionType || "EXTERNAL_DISCOVERY";
}
