export function orderLabel(status, bn = false) {
  const labels = {
    placed: ["Order received", "অর্ডার পাওয়া গেছে"],
    pending_review: ["Store reviewing", "দোকান পর্যালোচনা করছে"],
    quoted: ["Awaiting your price approval", "দামের অনুমোদন বাকি"],
    awaiting_purchase: [
      "Confirmed · awaiting purchase",
      "নিশ্চিত · বাজার করা বাকি",
    ],
    purchased: [
      "Purchased · ready for preparation",
      "কেনা হয়েছে · প্রস্তুতির জন্য তৈরি",
    ],
    confirmed: ["Confirmed", "নিশ্চিত"],
    preparing: ["Preparing", "প্রস্তুত হচ্ছে"],
    packed: ["Packed", "প্যাক করা হয়েছে"],
    assigned: ["Courier assigned", "কুরিয়ার নিয়োগ হয়েছে"],
    out_for_delivery: ["Out for delivery", "ডেলিভারির পথে"],
    delivered: ["Delivered", "ডেলিভারি সম্পন্ন"],
    cancelled: ["Cancelled", "বাতিল"],
    rejected: ["Not accepted", "গ্রহণ করা হয়নি"],
    failed: ["Delivery issue", "ডেলিভারিতে সমস্যা"],
    preview: ["Preview archive", "প্রিভিউ আর্কাইভ"],
  };
  return (
    labels[status]?.[bn ? 1 : 0] || String(status || "").replaceAll("_", " ")
  );
}
export function canCancelOrder(status) {
  return [
    "placed",
    "pending_review",
    "quoted",
    "confirmed",
    "awaiting_purchase",
    "purchased",
  ].includes(status);
}
export function orderStage(status) {
  return (
    {
      placed: 0,
      pending_review: 0,
      quoted: 0,
      awaiting_purchase: 1,
      purchased: 1,
      confirmed: 1,
      preparing: 2,
      packed: 2,
      assigned: 2,
      out_for_delivery: 3,
      delivered: 4,
    }[status] ?? -1
  );
}
export function paymentLabel(status, paymentStatus, method, bn = false) {
  if (status === "preview" || ["cancelled", "rejected"].includes(status))
    return bn ? "টাকা দিতে হবে না" : "No payment due";
  if (paymentStatus === "paid")
    return bn ? "টাকা আদায় / পরিশোধিত" : "Payment collected / paid";
  if (method === "cod")
    return bn ? "পণ্য পেলে কুরিয়ারকে টাকা দিন" : "Pay the courier on delivery";
  return bn ? "পেমেন্ট যাচাই বাকি" : "Payment verification pending";
}
