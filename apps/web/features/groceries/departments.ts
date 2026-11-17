export type Department = "vegetables" | "fruit" | "fish" | "meat" | "dairy" | "pantry" | "essentials";
export const departments = {
  vegetables: ["Vegetables & greens", "সবজি ও শাক"],
  fruit: ["Fruit", "ফল"],
  fish: ["Fish & seafood", "মাছ ও সামুদ্রিক খাবার"],
  meat: ["Meat & poultry", "মাংস ও মুরগি"],
  dairy: ["Dairy", "দুগ্ধজাত পণ্য"],
  pantry: ["Rice, pulses & pantry", "চাল, ডাল ও রান্নার পণ্য"],
  essentials: ["Household essentials", "গৃহস্থালি পণ্য"],
} as const;
