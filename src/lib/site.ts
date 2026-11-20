export const SITE = {
  name: "Stillmotion",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "",
  adSlots: {
    afterTool: process.env.NEXT_PUBLIC_AD_SLOT_AFTER_TOOL,
    inContent: process.env.NEXT_PUBLIC_AD_SLOT_IN_CONTENT,
  },
};
