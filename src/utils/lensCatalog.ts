import { LensCatalogItem, LensProfileId } from '../types/optics';

export const LENS_CATALOG: LensCatalogItem[] = [
  {
    id: 'conv_5',
    codeLabel: '+5 cm',
    name: 'Thấu kính Hội tụ f = +5 cm',
    shortName: 'Hội tụ +5cm',
    lensType: 'converging',
    focalLengthCm: 5,
    refractiveIndex: 1.5,
    centerThicknessCm: 1.75,
    edgeThicknessCm: 0.26,
    description:
      'Thấu kính hội tụ độ tụ lớn (f = +5 cm), hai mặt lồi cong nhiều, rìa mỏng. Chùm tia tới song song hội tụ rất gần tại F’ cách quang tâm 5 cm.',
    svgPath: 'M 25 8 Q 47 40 25 72 L 35 72 Q 13 40 35 8 Z',
  },
  {
    id: 'conv_10',
    codeLabel: '+10 cm',
    name: 'Thấu kính Hội tụ f = +10 cm',
    shortName: 'Hội tụ +10cm',
    lensType: 'converging',
    focalLengthCm: 10,
    refractiveIndex: 1.5,
    centerThicknessCm: 1.35,
    edgeThicknessCm: 0.28,
    description:
      'Thấu kính hội tụ thông dụng nhất trong phòng thí nghiệm (f = +10 cm), phần giữa dày hơn phần rìa.',
    svgPath: 'M 26 8 Q 42 40 26 72 L 34 72 Q 18 40 34 8 Z',
  },
  {
    id: 'conv_15',
    codeLabel: '+15 cm',
    name: 'Thấu kính Hội tụ f = +15 cm',
    shortName: 'Hội tụ +15cm',
    lensType: 'converging',
    focalLengthCm: 15,
    refractiveIndex: 1.5,
    centerThicknessCm: 1.05,
    edgeThicknessCm: 0.3,
    description:
      'Thấu kính hội tụ tiêu cự dài (f = +15 cm), độ cong mặt lồi thoải hơn, hội tụ chùm tia song song tại F’ = +15 cm.',
    svgPath: 'M 27 8 Q 38 40 27 72 L 33 72 Q 22 40 33 8 Z',
  },
  {
    id: 'div_10',
    codeLabel: '-10 cm',
    name: 'Thấu kính Phân kì f = -10 cm',
    shortName: 'Phân kì -10cm',
    lensType: 'diverging',
    focalLengthCm: 10,
    refractiveIndex: 1.5,
    centerThicknessCm: 0.3,
    edgeThicknessCm: 1.55,
    description:
      'Thấu kính phân kì thông dụng (f = -10 cm), phần rìa dày hơn phần giữa. Chùm tia tới song song bị khúc xạ loe rộng có đường kéo dài đi qua F (-10 cm).',
    svgPath: 'M 17 8 Q 28 40 17 72 L 43 72 Q 32 40 43 8 Z',
  },
  {
    id: 'div_20',
    codeLabel: '-20 cm',
    name: 'Thấu kính Phân kì f = -20 cm',
    shortName: 'Phân kì -20cm',
    lensType: 'diverging',
    focalLengthCm: 20,
    refractiveIndex: 1.5,
    centerThicknessCm: 0.34,
    edgeThicknessCm: 1.1,
    description:
      'Thấu kính phân kì tiêu cự dài (f = -20 cm), hai mặt lõm thoải hơn, chùm tia ló phân kì nhẹ với tiêu điểm ảo cách thấu kính 20 cm.',
    svgPath: 'M 21 8 Q 28 40 21 72 L 39 72 Q 32 40 39 8 Z',
  },
  {
    id: 'flat_inf',
    codeLabel: '∞',
    name: 'Kính Phẳng (Bản mặt song song f = ∞)',
    shortName: 'Phẳng (∞)',
    lensType: 'flat',
    focalLengthCm: Number.POSITIVE_INFINITY,
    refractiveIndex: 1.5,
    centerThicknessCm: 1.0,
    edgeThicknessCm: 1.0,
    description:
      'Bản thủy tinh hai mặt phẳng song song (tiêu cự f = ∞, độ tụ D = 0). Tia vuông góc truyền thẳng; tia xiên góc khúc xạ 2 lần cho tia ló song song với tia tới.',
    svgPath: 'M 24 8 L 24 72 L 36 72 L 36 8 Z',
  },
];

export function getLensSpec(id: LensProfileId): LensCatalogItem {
  return LENS_CATALOG.find((item) => item.id === id) || LENS_CATALOG[1];
}
