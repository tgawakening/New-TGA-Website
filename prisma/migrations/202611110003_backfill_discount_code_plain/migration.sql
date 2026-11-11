-- Backfill the shareable plaintext for the four known Sīrah discount codes,
-- matched by codeHash (the only identifier stored before codePlain existed).
-- Data-only; no schema change. Each UPDATE is scoped to one codeHash, so any
-- row whose hash is not listed here keeps codePlain = NULL and shows "hidden".
UPDATE `SirahManualDiscount` SET `codePlain` = 'SIRAH-PK-3000-K7M4'
  WHERE `codeHash` = 'fd5db7319f21f5f96ee2cd5d9d75cb69ea9fa725e84fabb29992333dc86a8237' AND `codePlain` IS NULL;
UPDATE `SirahManualDiscount` SET `codePlain` = 'SIRAH-PK-3000-AZ7Q'
  WHERE `codeHash` = '47d6545ff20977b94daf926f889052fb3e0492e19fc03ae750c2bf8033db96a0' AND `codePlain` IS NULL;
UPDATE `SirahManualDiscount` SET `codePlain` = 'SIRAH-PK-3000-ALL'
  WHERE `codeHash` = '913e7ef8c94126689fa6eaf17af79c711e1cec1e9380caeb04ed9a9dee985234' AND `codePlain` IS NULL;
UPDATE `SirahManualDiscount` SET `codePlain` = 'SEERAH-TEST-3000'
  WHERE `codeHash` = 'f71bafaae74f60814b800ca12d5ffe6f5b2ede3b1751dcceee4c4c8adcc90625' AND `codePlain` IS NULL;
