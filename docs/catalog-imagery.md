# Catalog image previews

Owner authorization: 22 November 2026. The owner approved the earlier photorealistic generated catalog style with explicit AI labels. These images illustrate preparation and packaging; they are not actual stock photographs. Real owner-uploaded media and explicitly approved real photography take precedence.

The 16 WebP atlases in `apps/web/public/catalog-previews/` provide 4 states for each of 64 eligible fresh products: whole/raw, cleaned, cut-only, and cut-and-cleaned. Columns 2–4 show transparent sealed food-safe packaging. `apps/web/lib/catalog-previews.mjs` maps each SKU to one row. Other earlier catalog images remain available as labeled whole-product defaults where present. Products without preparation (eggs, minced beef and jackfruit pods) retain their original-pack behavior.

Rendering uses a clipped inline SVG viewport around a single raster cell, preserving its aspect ratio at any card size; no generated SVG or external active content is loaded. A nested viewport prevents neighboring atlas cells appearing in wide cards. Product cards, detail pages and baskets share this renderer. Failed image sources are excluded and retain the existing honest fallback. Credits for a licensed photo are not displayed against an AI-generated replacement.

Generation used the built-in image-generation tool, followed only by lossless layout-preserving WebP optimization. Original PNG files remain unchanged outside the repository. Generated assets are identifiable by their UI label in English and Bengali and by this registry; they do not assert the appearance, quantity or preparation of actual stock.

## Common prompt

Use case: product-mockup. Production sprite atlas for a Bangladesh grocery store. Exactly FOUR equal columns and FOUR equal rows, 16 equal square cells, square canvas, ideally 2048x2048. No labels, no text, no borders or gutters. Pale ivory seamless background, bright professional realistic commercial food photography, fresh appetizing ingredients, soft studio shadows, full subject and tray contained with 10% padding in every cell. One ingredient per row. Col1: beautiful RAW WHOLE product loose, no package. Col2: WASHED CLEANED product kept whole in a neat transparent food-safe sealed bag or clear tray. Col3: CUT ONLY, rustic coarse chunks or trimmed portions retaining edible peel where appropriate, in a clear sealed food-safe tray. Col4: CLEANED AND CUT, uniformly and thoughtfully prepared ready-to-cook portions, beautifully arranged in premium sealed clear food-safe packaging. All packages transparent and visibly showing ingredient. Use genuine-looking photographic food texture, not cartoons, no cooked food. Keep strict 4x4 geometry. For leafy herbs, whole means bunch/leaves; cut-only roughly chopped, clean+cut neatly chopped. 

## First set

4 × 4 grid. Rows: bitter gourd (korola), bottle gourd (lau), cabbage, carrots. Columns: unpackaged whole, cleaned whole in clear sealed packaging, rustic cut-only pieces in clear sealed trays, cleaned uniform ready-to-cook pieces in premium clear sealed trays. Pale ivory studio background, realistic bright catalog photography, no labels or gutters. Cut-and-clean bitter gourd uses deseeded rings; bottle gourd uses peeled cubes; cabbage shredded; carrots peeled rounds.

## Remaining row prompts

### vegetables-2

Row 1, VEG-POTATO: Bangladeshi potatoes.

Row 2, VEG-ONION: red onions.

Row 3, VEG-OKRA: okra pods.

Row 4, VEG-EGGPLANT: long purple eggplants.

### vegetables-3

Row 1, VEG-SPINACH: spinach leaves with stems.

Row 2, CAULIFLOWER: cauliflower head.

Row 3, TOMATO: red round tomatoes.

Row 4, CUCUMBER: green cucumbers.

### vegetables-4

Row 1, PUMPKIN: green-skinned orange-flesh pumpkin.

Row 2, POINTED-GOURD: Bangladeshi pointed gourd potol.

Row 3, RIDGE-GOURD: ridged green ridge gourd jhinga.

Row 4, BEANS: flat green hyacinth bean pods sheem.

### vegetables-5

Row 1, LONG-BEANS: long green yardlong beans.

Row 2, RADISH: long white daikon radish.

Row 3, CHILLI: small fresh green chillies.

Row 4, GINGER: fresh ginger root.

### greens

Row 1, GARLIC: garlic bulbs with papery skins, cleaned cloves column2, sliced cloves col3, neatly minced cloves col4.

Row 2, CORIANDER: fresh coriander herb bunch, neatly trimmed and chopped leaves.

Row 3, RED-SPINACH: red amaranth leaves lal shak, red-purple leafy bunch.

Row 4, MALABAR: Malabar spinach pui shak, thick green leaves and stems.

### seasonal

Row 1, TARO: taro root kochu, raw brown corms, cleaned whole corms, skin-on chunks then peeled white cubes.

Row 2, DRUMSTICK: moringa drumstick vegetable pods sajna, LONG GREEN VEGETABLE PODS not chicken, washed whole long green pods, chopped green pod segments in both cut states.

Row 3, AMARANTH: green amaranth leafy greens data shak, green leaf bunches then chopped leaves and stems.

Row 4, SNAKE-GOURD: snake gourd chichinga, long pale green striped gourd then slices.

### fruit-1

Row 1, MANGO: ripe yellow mango with green-red blush, whole washed mango then skin-on wedges then peeled golden mango cubes.

Row 2, BANANA: ripe yellow banana bunch, washed whole bananas, peel-on banana segments, peeled banana rounds.

Row 3, GUAVA: green guava fruit, washed whole green guavas, skin-on wedges, neatly sliced deseeded guava pieces.

Row 4, PAPAYA: ripe orange-fleshed papaya, washed whole papaya, rustic skin-on wedges, peeled deseeded orange cubes.

### fruit-2

Row 1, PINEAPPLE: pineapple, raw whole crown pineapple, trimmed cleaned whole pineapple sealed clear bag, skin-on wedges, peeled golden chunks.

Row 2, WATERMELON: striped green watermelon, raw whole, cleaned whole wrapped transparent film, triangular red watermelon wedges with rind, neatly cut red seedless cubes.

Row 3, JACKFRUIT: jackfruit kathal, whole green spiky jackfruit, cleaned whole clear wrapped jackfruit, big skin-on wedges showing yellow pods, neatly arranged peeled yellow jackfruit pods with seeds removed.

Row 4, LEMON: yellow-green lemons, whole washed lemons, rough lemon wedges, neat thin lemon rounds.

### fruit-3

Row 1, RAW-PAPAYA: unripe green papaya used as vegetable, white flesh, whole raw, washed whole, skin-on chunks, peeled white julienne.

Row 2, JUJUBE: fresh green and brown jujube boroi fruits, whole washed, coarse halves, neat deseeded halves.

Row 3, LYCHEE: red lychee fruits, whole raw red skins, cleaned whole red lychees, roughly opened halved lychees, neatly peeled translucent white lychee flesh.

Row 4, COCONUT: brown mature coconut, whole fibrous brown shell, cleaned whole coconut clear wrapped, shell-on pieces showing white meat, neatly cut fresh white coconut meat.

### fruit-4

Row 1, APPLE: red apples, whole raw, washed whole, skin-on rustic wedges, neatly sliced apple with core removed.

Row 2, ORANGE: sweet oranges, whole raw, washed whole, rough rind-on wedges, neatly peeled orange segments.

Row 3, GRAPES: green grapes, bunch raw, washed whole grapes on stems, trimmed small clusters, neatly destemmed whole grapes (DO NOT chop grapes into cubes).

Row 4, POMEGRANATE: red pomegranate, whole raw, washed whole, rough rind-on quarters, neatly separated glossy red pomegranate arils.

### fish-1

Row 1, FISH-ROHU: rohu carp rui, elongated silver-gray whole carp fish with reddish fins; cleaned gutted whole fish; coarse bone-in steaks; neatly washed bone-in steaks.

Row 2, FISH-HILSA: hilsa ilish, broad silver shiny whole fish; cleaned gutted whole hilsa; coarse cross-cut bone-in steaks; neatly washed silver-skin bone-in hilsa steaks.

Row 3, FISH-KATLA: katla carp, broad silver-gray carp with large dark head; cleaned gutted whole fish; thick cross-cut bone-in steaks; neatly cleaned thick bone-in steaks.

Row 4, FISH-TILAPIA: tilapia, gray whole tilapia with distinctive deep body and striped tail; scaled gutted whole fish; coarse bone-in portions; neat cleaned bone-in portions.

### fish-2

Row 1, FISH-PANGAS: pangas catfish, whole silver-gray smooth-skinned catfish; cleaned gutted whole; thick white-flesh crosscut steaks; neat cleaned crosscut steaks.

Row 2, FISH-KOI: Bangladeshi climbing perch koi, small olive-brown whole fish; scaled gutted whole; coarse crosscut portions; neatly cleaned crosscut portions.

Row 3, PABDA: pabda butter catfish, small pale silver flat elongated catfish with whiskers; cleaned whole gutted fish; trimmed whole fish portioned as small groups; neatly cleaned whole small fish arranged in clear tray.

Row 4, MOLA: mola small Bangladeshi freshwater silver fish, pile of tiny whole silver fish; cleaned tiny whole fish; trimmed whole small fish portions (do not invent large salmon steaks); neatly cleaned tiny whole fish arranged in clear tray.

### fish-3

Row 1, MRIGAL: mrigal carp, whole long silver-gray carp; cleaned gutted whole; coarse bone-in steaks; neatly cleaned bone-in steaks.

Row 2, SHING: shing stinging catfish, small dark charcoal fish with whiskers and narrow tail; gutted whole; trimmed small fish portioned in groups; neatly cleaned whole small fish in clear tray.

Row 3, MAGUR: magur walking catfish, whole dark gray-brown catfish with whiskers; cleaned gutted whole; coarse bone-in catfish portions; neatly washed bone-in catfish portions.

Row 4, BOAL: boal wallago catfish, elongated large smooth silver-gray catfish with wide mouth; cleaned whole catfish; thick white-flesh bone-in crosscut steaks; neat cleaned bone-in steaks.

### seafood-meat

Row 1, TENGRA: tengra small striped brown freshwater catfish with whiskers; gutted whole; trimmed small whole fish grouped as portions; neatly cleaned whole small fish.

Row 2, PRAWNS: large black tiger prawns, whole raw gray-blue prawns with dark stripes and heads and shells; cleaned deveined shell-on prawns; coarsely butterflied raw gray prawns; neatly peeled deveined raw gray prawns.

Row 3, SHRIMP: small raw gray freshwater shrimp, whole raw shrimp; cleaned shell-on shrimp; coarsely trimmed shrimp; neatly peeled deveined raw gray shrimp.

Row 4, DRUMSTICKS: raw CHICKEN DRUMSTICK LEG meat portions, naturally pale pink raw chicken drumsticks; washed trimmed whole legs; coarse chopped bone-in leg pieces; neatly trimmed raw chicken leg portions.

### meat

Row 1, CHICKEN: whole dressed raw broiler chicken carcass with pale pink skin, no feathers and no live bird; cleaned trimmed whole chicken carcass; coarse bone-in raw chicken curry pieces; neatly trimmed clean raw chicken curry portions.

Row 2, BEEF: raw Bangladeshi beef, large red beef pieces with some white fat; trimmed cleaned whole red beef cut; rustic coarse red beef chunks with some fat; neatly trimmed uniform raw red beef curry cubes.

Row 3, MUTTON: raw mutton goat meat, large pink-red meat cut with bone; neatly trimmed cleaned large goat-meat cut; coarse bone-in goat curry pieces; neatly trimmed bone-in raw goat curry pieces.

Row 4, DUCK: whole dressed raw duck carcass with pale ivory pink skin no feathers no live bird; cleaned whole dressed duck; coarse raw bone-in duck curry pieces; neatly trimmed raw duck curry portions.

Fish/meat constraints: uncooked, no blood, people or market scenes. Whole cleaned fish remain gutted whole fish. Portions match the ingredient; tiny fish stay tiny. Packaging is clear and sealed. Shrimp remain gray and uncooked. No text, brands or stock guarantees.

## Validation

Automated coverage checks all 64 eligible SKU mappings, four distinct cell coordinates each, physical asset existence, AI labeling, failed-image fallback and owner-photo priority. Backend configuration is unchanged: preview mode with live payments and real fulfillment disabled.

