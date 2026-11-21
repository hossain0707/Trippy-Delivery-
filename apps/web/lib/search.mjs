const aliases = {
  "VEG-POTATO": "alu aloo potato potatoes আলু",
  "VEG-ONION": "peyaj piyaj piaz onion onions পেয়াজ পিয়াজ পেঁয়াজ",
  "VEG-EGGPLANT": "begun brinjal aubergine eggplant বেগুন",
  "VEG-GOURD": "lau lauki bottle gourd লাউ",
  "BITTER-GOURD": "korola korolla karela bitter gourd করলা",
  "VEG-OKRA": "dherosh dheros dharosh bhindi okra ladies finger ঢেঁড়স ঢেঁড়স",
  "VEG-SPINACH": "palong palak spinach পালং শাক",
  "RED-SPINACH": "lal shak red amaranth লাল শাক",
  MALABAR: "pui shak malabar spinach পুঁই শাক",
  AMARANTH: "data shak notey shak amaranth ডাটা নটে শাক",
  "FISH-ROHU": "rui ruy ruhi rohu রুই",
  "FISH-HILSA": "ilish elish hilsa ইলিশ",
  "FISH-KATLA": "katol katla catla কাতলা",
  "FISH-TILAPIA": "telapia tilapia telapiya তেলাপিয়া",
  "FISH-PANGAS": "pangas pangash pangasius পাঙ্গাস পাঙাশ",
  "FISH-KOI": "koi kai climbing perch কৈ কই",
  PRAWNS: "chingri chingry prawn prawns চিংড়ি",
  SHRIMP: "chingri shrimp চিংড়ি",
  CHICKEN: "murgi murghi broiler chicken মুরগি মুরগী ব্রয়লার",
  BEEF: "gorur goru beef গরু গরুর মাংস",
  MUTTON: "khashi khasi goat mutton খাসি ছাগল",
  EGGS: "dim deem egg eggs ডিম",
  RICE: "chal chaal rice miniket চাল মিনিকেট",
  DAL: "dal daal dhal lentil lentils masoor moshur মসুর ডাল",
  OIL: "tel oil soybean soyabean তেল সয়াবিন",
  ATTA: "ata atta wheat আটা",
  FLOUR: "maida moyda flour ময়দা",
  CHICKPEAS: "chola chickpea chana ছোলা",
  MOONG: "mug moong mung মুগ",
  GARLIC: "roshun rosun rashun garlic রসুন",
  GINGER: "ada adha ginger আদা",
  CHILLI: "morich marich chili chilli chillies কাঁচামরিচ মরিচ",
  CORIANDER: "dhonia dhone pata coriander cilantro ধনেপাতা ধনিয়া",
  TOMATO: "tomato tomatoes টমেটো",
  CAULIFLOWER: "fulkopi phulkopi cauliflower ফুলকপি",
  CABBAGE: "badhakopi bandhakopi cabbage বাঁধাকপি",
  RADISH: "mula mulo radish মুলা",
  PUMPKIN: "mistikumra misti kumra pumpkin মিষ্টি কুমড়া",
  "POINTED-GOURD": "potol pointed gourd পটল",
  "SNAKE-GOURD": "chichinga snake gourd চিচিঙ্গা",
  "RIDGE-GOURD": "jhinga ridge gourd ঝিঙ্গা",
  BEANS: "shim sheem hyacinth beans শিম",
  "LONG-BEANS": "borboti long beans বরবটি",
  CUCUMBER: "shosha shasa cucumber শসা",
  CARROT: "gajor gajar carrot গাজর",
  "RAW-PAPAYA": "kacha pepe papaya কাঁচা পেঁপে",
  BANANA: "kola banana কলা",
  MANGO: "aam am mango আম",
  GUAVA: "peyara guava পেয়ারা",
  PAPAYA: "paka pepe papaya পেঁপে",
  PINEAPPLE: "anaros pineapple আনারস",
  WATERMELON: "tormuj tarbuj watermelon তরমুজ",
  COCONUT: "dab daab coconut ডাব",
  APPLE: "apel apple আপেল",
  ORANGE: "komola orange কমলা",
  GRAPES: "angur grapes আঙুর",
  POMEGRANATE: "dalim anar pomegranate ডালিম",
  LEMON: "lebu lemon lime লেবু",
  JACKFRUIT: "kathal jackfruit কাঁঠাল",
  MILK: "dudh doodh milk দুধ",
  YOGURT: "doi curd yogurt yoghurt দই",
  SALT: "lobon noon salt লবণ নুন",
  SUGAR: "chini sugar চিনি",
  TURMERIC: "holud turmeric হলুদ",
  TEA: "cha tea চা",
  GHEE: "ghi ghee ঘি",
  MURI: "muri puffed rice মুড়ি",
  SEMOLINA: "suji sooji semolina সুজি",
  NAZIRSHAIL: "najirshail nazirshail rice নাজিরশাইল",
  CHINIGURA: "chinigura polao rice চিনিগুঁড়া পোলাও",
  ATOP: "atop rice আতপ",
  BREAD: "pauruti bread পাউরুটি",
  BISCUITS: "biscuit biscuits বিস্কুট",
  DETERGENT: "washing powder detergent ডিটারজেন্ট",
  SOAP: "saban soap সাবান",
  WASH: "dishwash washing liquid বাসন ধোয়া",
  TISSUE: "tissue tissues টিস্যু",
  WATER: "pani water পানি",
};
export function normalizeQuery(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = d[j];
      d[j] = Math.min(
        d[j] + 1,
        d[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return d[b.length];
}
export function searchScore(product, query) {
  const q = normalizeQuery(query)
    .split(" ")
    .filter(
      (w) =>
        !/^\p{N}+$/u.test(w) &&
        ![
          "buy",
          "price",
          "fresh",
          "kg",
          "কেজি",
          "চাই",
          "দাম",
          "কিনতে",
        ].includes(w),
    )
    .join(" ");
  if (!q) return 1;
  const prep =
    product.category === "fresh"
      ? "whole raw clean cleaned cut cutting washed processed preparation কাটা পরিষ্কার ধোয়া"
      : "";
  const text = normalizeQuery(
    [
      product.name_en,
      product.name_bn,
      product.sku,
      product.details?.department,
      aliases[product.sku] || "",
      prep,
      product.unit,
    ].join(" "),
  );
  const words = text.split(" ");
  let score = 0;
  for (const term of q.split(" ")) {
    if (text.includes(term)) {
      score += 5;
      continue;
    }
    if (
      term.length >= 4 &&
      words.some(
        (w) => Math.abs(w.length - term.length) <= 1 && distance(w, term) <= 1,
      )
    ) {
      score += 2;
      continue;
    }
    return 0;
  }
  return score;
}
