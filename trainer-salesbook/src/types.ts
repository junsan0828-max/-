export type JobType = "pt" | "pilates" | "yoga" | "crossfit" | "group" | "custom";

export interface Certificate {
  id: string;
  name: string;
}

export interface BodyCompItem {
  id: string;
  name: string;
  description: string;
  normalRange: string;
  riskDescription: string;
}

export interface MusculoskeletalItem {
  id: string;
  area: string;
  analysisPoint: string;
  painPattern: string;
}

export interface Program {
  id: string;
  name: string;
  frequency: string;
  duration: string;
  target: string;
  expectedResult: string;
}

export interface PricePackage {
  id: string;
  name: string;
  sessions: string;
  originalPrice: string;
  discountedPrice: string;
}

export interface Objection {
  id: string;
  customerSays: string;
  responseScript: string;
}

export interface FollowUpScenario {
  id: string;
  timing: string;
  message: string;
}

export interface SalesbookData {
  jobType: JobType;
  customJobTitle: string;

  // Section 1
  trainerName: string;
  centerName: string;
  experienceYears: string;
  certificates: Certificate[];
  profilePhotoUrl: string;
  openingMent: string;
  introPhilosophy: string;

  // Section 2
  bodyCompItems: BodyCompItem[];

  // Section 3
  musculoskeletalItems: MusculoskeletalItem[];

  // Section 4
  comprehensiveMent: string;
  riskConnectionMent: string;
  lifestyleConnectionMent: string;

  // Section 5
  exerciseNeedMent: string;
  soloVsProMent: string;
  proAdvantagesMent: string;

  // Section 6
  programs: Program[];

  // Section 7
  pricePackages: PricePackage[];
  anchoringMent: string;
  discountConditionMent: string;

  // Section 8
  objections: Objection[];

  // Section 9
  followUpScenarios: FollowUpScenario[];
  reconsultMent: string;
  firstSessionGuideMent: string;
}
