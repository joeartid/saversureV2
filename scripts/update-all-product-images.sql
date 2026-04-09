BEGIN;

UPDATE products
SET image_url = CASE sku
  -- Main products (59 items)
  WHEN 'C1-15G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 33-4cd2c036-8d18-491f-b113-0a7a11fbffb4.png'
  WHEN 'C1-6G'        THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 32-6eeb329c-cd8c-4c37-9a6c-565d9136bbb6.png'
  WHEN 'C3-30G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 21-45ee5baa-7cae-43b9-a08f-d8fa5a6149db.png'
  WHEN 'C3-7G'        THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 20-c698fa0d-f11f-4004-831b-3e2f039196a1.png'
  WHEN 'C4-35G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 14-a8404140-79ed-4a65-a954-5ee37fe5a189.png'
  WHEN 'C4-8G'        THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 13-8d54970c-1358-4e95-89ee-723c22b3440a.png'
  WHEN 'D2-70G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 18-0ebae17f-a155-4d8d-8b22-d61e22ba767d.png'
  WHEN 'D3-70G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 81_0-3c7ec833-c59a-4b63-a8e6-75c79f6178aa.png'
  WHEN 'JH905-70G'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 15-ad564861-e360-4141-9f48-61d7e8e22390.png'
  WHEN 'JHD1-70G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 85-7a2b0639-c4c4-422a-8c7f-0ba03a7350c8.png'
  WHEN 'JHK4-8G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2023/07/JHK4-8G-74d99472-c8fc-4e66-9697-2b48aec23643.jpg'
  WHEN 'JHK5-15G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 36-98883d3e-e8d5-468f-9816-909b83593902.png'
  WHEN 'JHK6-7G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 20-81836d65-68bc-46a2-94a7-baab7815b084.png'
  WHEN 'JHM2-30G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 41-d5015dd8-2cc3-468a-b132-acd49a448f01.png'
  WHEN 'JHM2-4G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 40-55511148-a63b-40b5-aaa2-bd5c09ded2a6.png'
  WHEN 'JHP1-80G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/11/JHP1-80G-1-sm-500-lrsuAYdbZ.jpg'
  WHEN 'JHP2-200G'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/11/JHP2-200G-1-sm-500-sOAVWvJwy.jpg'
  WHEN 'JHQ1-30G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2023/02/JHQ1-30G-ef21842e-a902-4598-92a9-4561b7d21827.jpg'
  WHEN 'JHQ2-30G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2023/02/JHQ2-30G-0b0f883d-4036-4e30-988e-1a089165089a.jpg'
  WHEN 'JHW1-12GX15'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/12/JHW1-Box-500x500-q5-PLWuZMlVQ.jpg'
  WHEN 'L1-150G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 47-4b7f7f2d-ce07-4ad3-b634-c2f558b03b56.png'
  WHEN 'L10-30G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 30-0965f816-7355-4e34-ad3b-edc87b8f430f.png'
  WHEN 'L10-7G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 31-5e92ad90-eac4-4f0b-ad93-4e91fc2e6165.png'
  WHEN 'L11-400G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 88-a4cb3dd3-eeb1-413f-b8ad-0919c1bb0514.png'
  WHEN 'L11-40G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 75-ed5229c5-0bbe-4710-9e5b-8fa8362f1b8a.png'
  WHEN 'L12-400G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 74-4cda3fb2-c6cf-49ff-a91c-fdd1a3aeb36d.png'
  WHEN 'L13-10G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 46-f56fa6f6-1e5c-41c4-8649-8771eef8f34a.png'
  WHEN 'L13-40G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/12/Artboard 92-5362991c-c1bf-46db-a9da-94ccf191be1b.png'
  WHEN 'L14-40G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 79_0-70e9da04-53bd-4783-bd7f-ecb377a341a3.png'
  WHEN 'L14-70G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 91-bb292800-8668-4d97-8830-1bdd151272f3.png'
  WHEN 'L19-48G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 72-43eb2fd0-8d0f-4df8-a39a-f11eb32ad422.png'
  WHEN 'L19-8G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 71-716f59c6-b5f5-4903-9946-dcdf07329fa6.png'
  WHEN 'L20-30G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2026/03/Artboard 98_0-350dd2ac-c2e9-437e-bd3b-db727a9f650c.png'
  WHEN 'L20-7Gx6'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2026/03/Artboard 96(1)-6fea871a-e599-4ce9-acfd-1491dab3f4e0.png'
  WHEN 'L21-100G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2026/03/1773656385242-e7bb83ff-e291-4cb0-a3cd-077893e39fc6.jpg'
  WHEN 'L3-40G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 2-e2b2e537-955b-4595-8f15-89b7a3699c13.png'
  WHEN 'L4-8G'        THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 3-27da010b-104d-4a55-aa2a-f44a3494fb5b.png'
  WHEN 'L5-15G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 36-46271569-79d5-4e96-bc87-1ceffd57251f.png'
  WHEN 'L5-90G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 37-aee1a508-424f-44d5-b5e4-e90da1ccc76e.png'
  WHEN 'L5A-90G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/12/Artboard 93-eeec3148-0956-4380-9e63-8eca0dc47a35.png'
  WHEN 'L6-40G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 6-2e6fc756-8474-4314-bd6d-fbf8e7bc3792.png'
  WHEN 'L6-8G'        THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 5-fdfaae8e-075b-4418-81d9-9b31fbb4ede1.png'
  WHEN 'L7-30G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 12-7d020829-47e4-4acd-bbc2-b316b953858a.png'
  WHEN 'L7-6G'        THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2024/05/LINE_ALBUM_à¸£à¸§à¸¡à¸ªà¸´à¸™à¸„à¹‰à¸²à¹ƒà¸«à¸¡à¹ˆ_à¹’à¹”à¹à¹•à¹à¹—_1-c9e485bc-6493-4feb-bd77-204485d816b0.jpg'
  WHEN 'L8A-6G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 7-93a99c5f-0ad9-4e21-ad56-529859625526.png'
  WHEN 'L8B-6G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 8-420ccd0d-47e8-4cb8-9ef2-c45f50a59bfe.png'
  WHEN 'L9-8G'        THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 34-24c494bd-9c4d-40c2-8e42-4f4cd474ca5e.png'
  WHEN 'R1-30G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 69-3914b475-00b6-4efd-9a37-792cc68735f5.png'
  WHEN 'S4-70G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 89-8dadc8df-82e0-4c4d-89d3-96afff98c371.png'
  WHEN 'T5A-2.5G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 25-e997702c-21d8-4d1f-bbb1-b244378d04ce.png'
  WHEN 'T5A-2G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 22-7a7894ba-5fd2-469a-b859-a8ae9552c371.png'
  WHEN 'T5B-2G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 23-b1bdc613-bae2-4c35-96a9-6d079d42f6e0.png'
  WHEN 'T5C-2.5G'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 27-ba450693-7cdf-487e-9f30-796091a7e3d3.png'
  WHEN 'T5C-2G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 24-c1dc434a-bfae-41d3-a254-ed23dd95ff54.png'
  WHEN 'T6A-10G'      THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 29-2ae1e844-cd7d-494a-8d37-00e004d4b265.png'
  WHEN 'T6A-5G'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 28-7ab0e0ee-e89c-4878-9484-8c952aa1e0ee.png'
  WHEN 'TB-JHM1-120G' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/à¸¡à¸°à¸«à¸²à¸” à¸šà¸­à¸”à¸µà¹‰ à¹€à¸‹à¸£à¸±à¹ˆà¸¡ à¸­à¸´à¸™à¹€à¸—à¸™à¸‹à¸µà¸Ÿ à¹„à¸§à¸—à¹Œ-BQVggUFPD.jpg'
  WHEN 'V1-14C'       THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 77-3ad0c309-ead4-49f1-b095-f0d504840368.png'

  -- BOX products (45 items)
  WHEN 'BOX-C1-6Gx6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/12/Artboard 61-d0f5bcc1-2da3-434f-b645-21f249fdf652.png'
  WHEN 'BOX-C2-8Gx6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/12/Artboard 63-0b63dba1-060a-40ac-934d-95db55836086.png'
  WHEN 'BOX-C3-7GX6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/12/Artboard 56-d6b07411-aa5c-4fab-9775-47ca15b4a3ea.png'
  WHEN 'BOX-C4-8GX6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/12/Artboard 54-dc2cdd91-9176-4236-8d4b-76db15ab4195.png'
  WHEN 'BOX-JH701-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/marigold-acne-gel-4-cXYwfsygk.jpg'
  WHEN 'BOX-JH701-8GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/marigold-acne-gel1-gIkvoNufO.jpg'
  WHEN 'BOX-JH702-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/moringa-repair-gel-4-ORuBzYYxN.jpg'
  WHEN 'BOX-JH702-8GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/moringa-repair-gel1-coPcvUGtL.jpg'
  WHEN 'BOX-JH703-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/ddcream-watermelon-4-eUaAtXlHv.jpg'
  WHEN 'BOX-JH703-8GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/ddcream-watermelon1-jdOVxSvoE.jpg'
  WHEN 'BOX-JH704-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/serum-longan-4-TwcQeXgKv.jpg'
  WHEN 'BOX-JH704-8GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/serum-longan1-KXcmweeSQ.jpg'
  WHEN 'BOX-JH705-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/01/mango-yogurt-serum-5-caBmlMGyv-nxngYvouM.jpg'
  WHEN 'BOX-JH705-8GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/mango-yogurt-serum-1-DaxPPedlt.jpg'
  WHEN 'BOX-JH706-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/carot-daily-serum-4-STKARjVKD.jpg'
  WHEN 'BOX-JH706-8GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/carot-daily-serum-1-HexuycypC.jpg'
  WHEN 'BOX-JH707-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/black-ginger-serum-4-LNYMwJMDd.jpg'
  WHEN 'BOX-JH707-8GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/black-ginger-serum-1-VUVeJrTuM.jpg'
  WHEN 'BOX-JH708-6GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/watermelon-ee-cushion-1-hJBgnzObL.jpg'
  WHEN 'BOX-JH905-70G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 82-1167c32a-ed01-4d4f-9a8e-8ff8e02fc683.png'
  WHEN 'BOX-JHA1-40GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 55-0a7d3be1-ccc3-44b0-a875-608daaa28818.png'
  WHEN 'BOX-JHA2-40GX6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 68-811dba58-16f0-4265-aea8-90f864296a01.png'
  WHEN 'BOX-JHK1-40G'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/10/BOX-JHK1-40G-fiFYKTAvF.jpg'
  WHEN 'BOX-JHK2-40G'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/10/BOX-JHK2-40G-CoNDPPvzF.jpg'
  WHEN 'BOX-JHK3-6Gx6'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/01/à¸ à¸²à¸ž SKU (11)-2c0f55af-0648-49ff-8803-421addd50adb.jpg'
  WHEN 'BOX-JHK4-8Gx6'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/sku à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 500kb-dce6431b-3952-4219-a027-55cfea150d67.png'
  WHEN 'BOX-JHK6-7Gx6'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 56-488ed016-8df2-415c-a5a2-d1994cb1de8a.png'
  WHEN 'BOX-JHL5-15Gx6' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 86-1abc2864-15e1-4d13-b398-fa6d2216512e.png'
  WHEN 'BOX-JHM2-4Gx6'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 64-a97fbf63-6127-4f6b-9048-8bdae25971bf.png'
  WHEN 'BOX-JHT1-2G'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 65-0248b43b-7382-459f-adcf-8aed10ce8e22.png'
  WHEN 'BOX-JHT2-2G'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 66-360ce798-4057-4e98-8af2-252799f50784.png'
  WHEN 'BOX-JHT3-2G'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 67-066ce3e3-b560-485e-bc66-0d63768e08cf.png'
  WHEN 'BOX-L10-7Gx6'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 60-93ffa2da-be5e-455f-a6a3-d412400e0196.png'
  WHEN 'BOX-L11-40Gx6'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 76-234d8e70-bd62-442f-af28-d59d77264726.png'
  WHEN 'BOX-L13-10Gx6'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 87-8bbd0dc7-0be8-4721-affa-bbb90f941b7b.png'
  WHEN 'BOX-L14-40Gx6'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 80_0-340c3779-1946-4eed-882b-bfbe832ae82a.png'
  WHEN 'BOX-L19-8Gx6'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 73-6c35c651-f2ac-47e3-9c41-342722b60171.png'
  WHEN 'BOX-L3-8Gx6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 48-f390bbd5-50e2-42fd-b9c9-f250133b174b.png'
  WHEN 'BOX-L4-8Gx6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 49-eff4c4cb-c8a3-4d63-8a52-93e35e106434.png'
  WHEN 'BOX-L6-8Gx6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 50-cfa473af-0691-476e-84dd-30612028db01.png'
  WHEN 'BOX-L7-6Gx6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2026/01/Artboard 53-650c38ec-aa3d-484b-b798-5f8aff19b340.png'
  WHEN 'BOX-L8A-6Gx6'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2026/01/Artboard 51-2d13ad42-8499-4543-8d29-49443a5f2a79.png'
  WHEN 'BOX-L8B-6Gx6'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2026/01/Artboard 52-4991cfbf-045c-47d8-b0ca-a92e421cde9f.png'
  WHEN 'BOX-L9-8Gx6'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 62-b42e8ee8-c287-486e-9c08-e8550f6d0e00.png'
  WHEN 'BOX-S4-70Gx6'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 90-864abb26-dbec-480f-9af5-119e869f6827.png'

  -- SCH (sachet) products (16 items)
  WHEN 'SCH-JH701-8G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/01/Packshot_Marigold_Sashet_M02_resize-UvmnbAxNr.jpg'
  WHEN 'SCH-JH702-8G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/01/Packshot_Moringa_Sachet_resize-FBwwIPhhP.jpg'
  WHEN 'SCH-JH703-8G'  THEN 'https://prod-saversure-julaherb-static-file.s3.ap-southeast-1.amazonaws.com/upload/images/2022/01/Packshot_Watermelon_Sashet_NEW_resize-jxswuYRNV.jpg'
  WHEN 'SCH-JH704-8G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/01/Packshot_Longan_Sashet_NEW_resize-hHhyTioFP.jpg'
  WHEN 'SCH-JH705-8G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/07/mango-yogurt-serum-1-xZcFqsQaL.jpg'
  WHEN 'SCH-JH706-8G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/01/Jula''s-Herb_Carrot-Daily-Serum_Sachet_Front_M01_resize-siUPartUe.jpg'
  WHEN 'SCH-JH707-8G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/01/Packshot_MenSerum_Sachet_M01_resize-WOgCBCeqH.jpg'
  WHEN 'SCH-JH708-6G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/01/Packshot_Watermelon-EE-Cushion_resize-ehHoNNjfA.jpg'
  WHEN 'SCH-JHA1-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 19-d061e76b-0e05-4dd4-a21f-257aa294a537.png'
  WHEN 'SCH-JHA2-40G'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 45-3ce93e98-6fc5-42fc-8d61-9afb3e44ad6a.png'
  WHEN 'SCH-JHK1-8G'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/12/Packshot_Marigold_Front_M1_resize-xXWcLzSRM.jpg'
  WHEN 'SCH-JHK2-8G'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/12/Packshot_Aloe_M01_resize-KlBsQijkY.jpg'
  WHEN 'SCH-JHT1-2G'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 42-4a0d9391-3924-416f-9178-5845033d7fcb.png'
  WHEN 'SCH-JHT2-2G'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 43-2af57d78-2089-4313-a4cc-f53987d6f2ab.png'
  WHEN 'SCH-JHT3-2G'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2025/11/Artboard 44-b4d95e16-4fb8-46e2-960b-89f1c0e805e7.png'

  -- Premium (PM) products (12 items)
  WHEN 'PM-BLAKET'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/02/5-FsBGnTqXg.jpg'
  WHEN 'PM-BOX'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/11/LINE_ALBUM_à¸ªà¸´à¸™à¸„à¹‰à¸²à¸žà¸£à¸µà¹€à¸¡à¸µà¸¢à¸¡_211123-ZchbiRTKO.jpg'
  WHEN 'PM-CHAIR'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/11/LINE_ALBUM_à¸ªà¸´à¸™à¸„à¹‰à¸²à¸žà¸£à¸µà¹€à¸¡à¸µà¸¢à¸¡_211126-aCvCsFfWV.jpg'
  WHEN 'PM-COSBAG'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/02/3-hKFpNEczq.jpg'
  WHEN 'PM-JMUG'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/11/pm-jdent-mug_211123-OFnENbxfC.jpg'
  WHEN 'PM-MIRROR'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/02/mirror.001-HoXBjmdoC.jpeg'
  WHEN 'PM-SMIRROR' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/02/mirror.001-HoXBjmdoC.jpeg'
  WHEN 'PM-PILLOW'  THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2024/10/à¸«à¸¡à¸­à¸™à¹ƒà¸šà¹ƒà¸«à¸¡à¹ˆ-05-05-1c763792-1f4f-4729-aede-f9be4b326ab9.jpg'
  WHEN 'PM-SBAG'    THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/02/4-LERXsSYcy.jpg'
  WHEN 'PM-TOWEL'   THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/06/towel-sm-IfIaksOTr.jpg'
  WHEN 'PM-UMB'     THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2021/11/LINE_ALBUM_à¸ªà¸´à¸™à¸„à¹‰à¸²à¸žà¸£à¸µà¹€à¸¡à¸µà¸¢à¸¡_211123_1-uAeQALTLn.jpg'

  -- SET products (2 items)
  WHEN 'SET-JH-M2-B2G3' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/10/salepage-longan-ct-14-crop-uPbBBTIdD.jpg'
  WHEN 'SET-JH-M2-B4G7' THEN 'https://api.svsu.me/media/saversure-dev/upload/images/2022/10/salepage-longan-ct-14-crop-uPbBBTIdD.jpg'

  ELSE image_url
END
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND (image_url IS NULL OR image_url = '')
  AND sku IN (
    'C1-15G','C1-6G','C3-30G','C3-7G','C4-35G','C4-8G','D2-70G','D3-70G',
    'JH905-70G','JHD1-70G','JHK4-8G','JHK5-15G','JHK6-7G',
    'JHM2-30G','JHM2-4G','JHP1-80G','JHP2-200G','JHQ1-30G','JHQ2-30G','JHW1-12GX15',
    'L1-150G','L10-30G','L10-7G','L11-400G','L11-40G','L12-400G',
    'L13-10G','L13-40G','L14-40G','L14-70G','L19-48G','L19-8G',
    'L20-30G','L20-7Gx6','L21-100G','L3-40G','L4-8G','L5-15G','L5-90G','L5A-90G',
    'L6-40G','L6-8G','L7-30G','L7-6G','L8A-6G','L8B-6G','L9-8G',
    'R1-30G','S4-70G',
    'T5A-2.5G','T5A-2G','T5B-2G','T5C-2.5G','T5C-2G','T6A-10G','T6A-5G',
    'TB-JHM1-120G','V1-14C',
    'BOX-C1-6Gx6','BOX-C2-8Gx6','BOX-C3-7GX6','BOX-C4-8GX6',
    'BOX-JH701-40G','BOX-JH701-8GX6','BOX-JH702-40G','BOX-JH702-8GX6',
    'BOX-JH703-40G','BOX-JH703-8GX6','BOX-JH704-40G','BOX-JH704-8GX6',
    'BOX-JH705-40G','BOX-JH705-8GX6','BOX-JH706-40G','BOX-JH706-8GX6',
    'BOX-JH707-40G','BOX-JH707-8GX6','BOX-JH708-6GX6','BOX-JH905-70G',
    'BOX-JHA1-40GX6','BOX-JHA2-40GX6','BOX-JHK1-40G','BOX-JHK2-40G',
    'BOX-JHK3-6Gx6','BOX-JHK4-8Gx6','BOX-JHK6-7Gx6','BOX-JHL5-15Gx6',
    'BOX-JHM2-4Gx6','BOX-JHT1-2G','BOX-JHT2-2G','BOX-JHT3-2G',
    'BOX-L10-7Gx6','BOX-L11-40Gx6','BOX-L13-10Gx6','BOX-L14-40Gx6',
    'BOX-L19-8Gx6','BOX-L3-8Gx6','BOX-L4-8Gx6','BOX-L6-8Gx6',
    'BOX-L7-6Gx6','BOX-L8A-6Gx6','BOX-L8B-6Gx6','BOX-L9-8Gx6','BOX-S4-70Gx6',
    'SCH-JH701-8G','SCH-JH702-8G','SCH-JH703-8G','SCH-JH704-8G',
    'SCH-JH705-8G','SCH-JH706-8G','SCH-JH707-8G','SCH-JH708-6G',
    'SCH-JHA1-40G','SCH-JHA2-40G','SCH-JHK1-8G','SCH-JHK2-8G',
    'SCH-JHT1-2G','SCH-JHT2-2G','SCH-JHT3-2G',
    'PM-BAG','PM-BLAKET','PM-BOX','PM-CHAIR','PM-COSBAG','PM-JMUG',
    'PM-MIRROR','PM-SMIRROR','PM-PILLOW','PM-SBAG','PM-TOWEL','PM-UMB',
    'SET-JH-M2-B2G3','SET-JH-M2-B4G7'
  );

COMMIT;

